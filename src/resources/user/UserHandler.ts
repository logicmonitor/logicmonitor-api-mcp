/**
 * User Resource Handler
 * Handles all user operations (list, get, create, update, delete)
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/ResourceHandler.js';
import { BatchOperationResolver } from '../base/BatchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { batchProcessor } from '../../utils/batchProcessor.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMUser } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import type { BatchResult, BatchItem } from '../../utils/batchProcessor.js';
import {
  validateListUsers,
  validateGetUser,
  validateCreateUser,
  validateUpdateUser,
  validateDeleteUser
} from './userSchemas.js';

export class UserHandler extends ResourceHandler<LMUser> {
  constructor(
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    super(
      {
        resourceType: 'user',
        resourceName: 'user',
        idField: 'id'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMUser>> {
    const validated = validateListUsers(args);
    const { fields, filter, size, offset } = validated;
    const fieldConfig = sanitizeFields('user', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown user field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.listUsers({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset
    });

    const result: OperationResult<LMUser> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMUser[],
      request: {
        filter,
        size,
        offset,
        fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('list', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'user', 'list', result);

    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMUser>> {
    const validated = validateGetUser(args);
    const userId = validated.id ?? this.resolveId(validated);
    
    if (typeof userId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'User ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = sanitizeFields('user', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown user field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.getUser(userId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMUser> = {
      success: true,
      data: apiResult.data,
      request: {
        userId,
        fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('get', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'user', 'get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'user', userId, apiResult.data);

    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMUser>> {
    const validated = validateCreateUser(args);
    const isBatch = this.isBatchCreate(validated);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const usersInput = this.normalizeCreateInput(validated);

    const batchResult = await batchProcessor.processBatch(
      usersInput,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (userPayload) => this.client.createUser(userPayload as any),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const normalized = this.normalizeBatchResults(batchResult);

    if (!isBatch) {
      const entry = normalized[0];
      if (!entry || !entry.success || !entry.data) {
        throwBatchFailure('User create', batchResult.results[0]);
      }
      const createdUser = entry.data as LMUser;
      
      const result: OperationResult<LMUser> = {
        success: true,
        data: createdUser,
        raw: entry.raw ?? createdUser,
        meta: entry.meta ?? undefined
      };

      this.storeInSession('create', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'user', 'create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'user', createdUser.id, createdUser);

      return result;
    }

    const successful = normalized.filter(entry => entry.success && entry.data);
    const successfulUsers = successful
      .filter((entry): entry is typeof entry & { data: LMUser } => entry.data !== undefined)
      .map(entry => entry.data);

    const result: OperationResult<LMUser> = {
      success: batchResult.success,
      items: successfulUsers,
      summary: batchResult.summary,
      request: {
        batch: true,
        batchOptions,
        users: usersInput
      },
      results: normalized
    };

    this.storeInSession('create', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'user', 'create', result);

    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMUser>> {
    const validated = validateUpdateUser(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'users');
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resolution = await BatchOperationResolver.resolveItems<any>(
        validated,
        this.sessionContext,
        this.client,
        'user',
        'users'
      );

      BatchOperationResolver.validateBatchSafety(resolution, 'update');

      const updates = validated.updates || {};
      const batchResult = await batchProcessor.processBatch(
        resolution.items,
        async (user: Record<string, unknown>) => {
          const userId = user.id ?? user.userId;
          if (!userId) {
            throw new McpError(ErrorCode.InvalidParams, 'User ID is required for update');
          }
          const mergedUpdates = { ...user, ...updates };
          delete mergedUpdates.id;
          delete mergedUpdates.userId;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return this.client.updateUser(userId as number, mergedUpdates as any);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);
      const successful = normalized.filter(entry => entry.success && entry.data);

      const result: OperationResult<LMUser> = {
        success: batchResult.success,
        items: successful
          .filter((entry): entry is typeof entry & { data: LMUser } => entry.data !== undefined)
          .map(entry => entry.data),
        summary: batchResult.summary,
        request: {
          batch: true,
          mode: resolution.mode,
          source: resolution.source,
          batchOptions
        },
        results: normalized
      };

      this.storeInSession('update', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'user', 'update', result);

      return result;
    }

    const userId = validated.id ?? this.resolveId(validated);
    if (typeof userId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'User ID must be a number');
    }

    const updates = { ...validated };
    delete updates.operation;
    delete updates.id;
    delete updates.userId;

    const apiResult = await this.client.updateUser(userId, updates);
    const result: OperationResult<LMUser> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'user', 'update', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'user', userId, apiResult.data);

    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMUser>> {
    const validated = validateDeleteUser(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'users') || 
                     (validated.ids && Array.isArray(validated.ids));
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      let itemsToDelete: Array<Record<string, unknown>>;

      if (validated.ids && Array.isArray(validated.ids)) {
        itemsToDelete = validated.ids.map((id: number) => ({ id }));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resolution = await BatchOperationResolver.resolveItems<any>(
          validated,
          this.sessionContext,
          this.client,
          'user',
          'users'
        );
        BatchOperationResolver.validateBatchSafety(resolution, 'delete');
        itemsToDelete = resolution.items;
      }

      const batchResult = await batchProcessor.processBatch(
        itemsToDelete,
        async (user: Record<string, unknown>) => {
          const userId = user.id ?? user.userId;
          if (!userId) {
            throw new McpError(ErrorCode.InvalidParams, 'User ID is required for delete');
          }
          await this.client.deleteUser(userId as number);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return { id: userId } as any as LMUser;
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult as BatchResult<LMUser>);

      const result: OperationResult<LMUser> = {
        success: batchResult.success,
        summary: batchResult.summary,
        request: {
          batch: true,
          batchOptions
        },
        results: normalized
      };

      this.storeInSession('delete', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'user', 'delete', result);

      return result;
    }

    const userId = validated.id ?? this.resolveId(validated);
    if (typeof userId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'User ID must be a number');
    }

    await this.client.deleteUser(userId);
    const result: OperationResult<LMUser> = {
      success: true,
      data: undefined
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'user', 'delete', result);

    return result;
  }

  private isBatchCreate(args: Record<string, unknown>): boolean {
    return !!(args.users && Array.isArray(args.users));
  }

  private normalizeCreateInput(args: Record<string, unknown>): Array<Record<string, unknown>> {
    if (args.users && Array.isArray(args.users)) {
      return args.users;
    }
    const singleUser = { ...args };
    delete singleUser.operation;
    delete singleUser.batchOptions;
    return [singleUser];
  }

  private normalizeBatchResults(batch: BatchResult<LMUser>): Array<BatchItem<LMUser>> {
    return batch.results.map(entry => ({
      index: entry.index,
      success: entry.success,
      data: entry.data,
      error: entry.error,
      diagnostics: entry.diagnostics,
      meta: entry.meta,
      raw: entry.raw
    }));
  }
}

