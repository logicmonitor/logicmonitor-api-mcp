/**
 * User Resource Handler
 * Handles all user operations (list, get, create, update, delete)
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { BatchOperationResolver } from '../base/batchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
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
import type { BatchResult } from '../../utils/batchProcessor.js';
import {
  validateListUsers,
  validateGetUser,
  validateCreateUser,
  validateUpdateUser,
  validateDeleteUser
} from './userZodSchemas.js';

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
        idField: 'id',
        pluralKey: 'users'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMUser>> {
    const validated = validateListUsers(args);
    const { fields, filter, size, offset, autoPaginate } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.listUsers({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset,
      autoPaginate
    });

    const result: OperationResult<LMUser> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMUser[],
      request: {
        filter,
        size,
        offset,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('list', result);

    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMUser>> {
    const validated = validateGetUser(args);
    const userId = validated.id ?? this.resolveId(validated);

    if (typeof userId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'User ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.getUser(userId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMUser> = {
      success: true,
      data: apiResult.data,
      request: {
        userId,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'user', userId, apiResult.data);

    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMUser>> {
    const validated = validateCreateUser(args);
    const isBatch = this.isBatchCreate(validated);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const usersInput = this.normalizeCreateInput(validated);

    const batchResult = await this.processBatch(
      usersInput,
      async (userPayload) => this.client.createUser(userPayload as Parameters<LogicMonitorClient['createUser']>[0]),
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

      this.recordAndStore('create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'user', createdUser.id, createdUser);

      return result;
    }

    const successfulUsers = this.extractSuccessfulItems(normalized);

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

    this.recordAndStore('create', result);

    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMUser>> {
    const validated = validateUpdateUser(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'users');
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
        validated,
        this.sessionContext,
        this.client,
        'user',
        'users'
      );

      BatchOperationResolver.validateBatchSafety(resolution, 'update');

      const updates = validated.updates || {};
      const batchResult = await this.processBatch(
        resolution.items,
        async (user: Record<string, unknown>) => {
          const userId = user.id ?? user.userId;
          if (!userId) {
            throw new McpError(ErrorCode.InvalidParams, 'User ID is required for update');
          }
          const mergedUpdates = { ...user, ...updates };
          delete mergedUpdates.id;
          delete mergedUpdates.userId;
          return this.client.updateUser(userId as number, mergedUpdates);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);
      const successfulUsers = this.extractSuccessfulItems(normalized);

      const result: OperationResult<LMUser> = {
        success: batchResult.success,
        items: successfulUsers,
        summary: batchResult.summary,
        request: {
          batch: true,
          mode: resolution.mode,
          source: resolution.source,
          batchOptions
        },
        results: normalized
      };

      this.recordAndStore('update', result);

      return result;
    }

    const userId = validated.id ?? this.resolveId(validated);
    if (typeof userId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'User ID must be a number');
    }

    const updates: Record<string, unknown> = { ...validated };
    delete updates.operation;
    delete updates.portal;
    delete updates.id;
    delete updates.userId;

    const apiResult = await this.client.updateUser(userId, updates);
    const result: OperationResult<LMUser> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('update', result);
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
        const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
          validated,
          this.sessionContext,
          this.client,
          'user',
          'users'
        );
        BatchOperationResolver.validateBatchSafety(resolution, 'delete');
        itemsToDelete = resolution.items;
      }

      const batchResult = await this.processBatch(
        itemsToDelete,
        async (user: Record<string, unknown>) => {
          const userId = user.id ?? user.userId;
          if (!userId) {
            throw new McpError(ErrorCode.InvalidParams, 'User ID is required for delete');
          }
          await this.client.deleteUser(userId as number);
          return { id: userId } as unknown as LMUser;
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

      this.recordAndStore('delete', result);

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

    this.recordAndStore('delete', result);

    return result;
  }
}
