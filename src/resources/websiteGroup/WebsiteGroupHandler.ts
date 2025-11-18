/**
 * Website Group Resource Handler
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/ResourceHandler.js';
import { BatchOperationResolver } from '../base/BatchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { batchProcessor } from '../../utils/batchProcessor.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMWebsiteGroup } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import {
  validateListWebsiteGroups,
  validateGetWebsiteGroup,
  validateCreateWebsiteGroup,
  validateUpdateWebsiteGroup,
  validateDeleteWebsiteGroup
} from './websiteGroupSchemas.js';

export class WebsiteGroupHandler extends ResourceHandler<LMWebsiteGroup> {
  constructor(client: LogicMonitorClient, sessionManager: SessionManager, sessionId?: string) {
    super(
      { resourceType: 'websiteGroup', resourceName: 'websiteGroup', idField: 'id' },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMWebsiteGroup>> {
    const validated = validateListWebsiteGroups(args);
    const { fields, filter, size, offset } = validated;
    const fieldConfig = sanitizeFields('websiteGroup', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown website group field(s): ${fieldConfig.invalid.join(', ')}`);
    }

    const apiResult = await this.client.listWebsiteGroups({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset
    });

    const result: OperationResult<LMWebsiteGroup> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMWebsiteGroup[],
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('list', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'websiteGroup', 'list', result);
    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMWebsiteGroup>> {
    const validated = validateGetWebsiteGroup(args);
    const groupId = validated.id ?? this.resolveId(validated);
    
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Website group ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = sanitizeFields('websiteGroup', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown website group field(s): ${fieldConfig.invalid.join(', ')}`);
    }

    const apiResult = await this.client.getWebsiteGroup(groupId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMWebsiteGroup> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('get', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'websiteGroup', 'get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'websiteGroup', groupId, apiResult.data);
    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMWebsiteGroup>> {
    const validated = validateCreateWebsiteGroup(args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isBatch = !!((validated as any).groups && Array.isArray((validated as any).groups));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupsInput = isBatch ? (validated as any).groups : [validated];

    const batchResult = await batchProcessor.processBatch(
      groupsInput,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (group: Record<string, unknown>) => this.client.createWebsiteGroup(group as any),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    if (!isBatch) {
      const entry = batchResult.results[0];
      if (!entry || !entry.success || !entry.data) {
        throwBatchFailure('Website group create', entry);
      }

      const result: OperationResult<LMWebsiteGroup> = {
        success: true,
        data: entry.data as LMWebsiteGroup,
        raw: entry.raw,
        meta: entry.meta
      };

      this.storeInSession('create', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'websiteGroup', 'create', result);
      return result;
    }

    const successful = batchResult.results.filter(r => r.success && r.data);
    const result: OperationResult<LMWebsiteGroup> = {
      success: batchResult.success,
      items: successful.map(r => r.data as LMWebsiteGroup),
      summary: batchResult.summary,
      results: batchResult.results
    };

    this.storeInSession('create', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'websiteGroup', 'create', result);
    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMWebsiteGroup>> {
    const validated = validateUpdateWebsiteGroup(args);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (BatchOperationResolver.isBatchOperation(validated as any, 'groups')) {
      return this.handleBatchUpdate(validated);
    }

    const groupId = validated.id ?? this.resolveId(validated);
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Website group ID must be a number');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { id: _id, operation: _operation, updates: _updateData, applyToPrevious: _applyToPrevious, filter: _filter, batchOptions: _batchOptions, ...rest } = validated as any;
    const apiResult = await this.client.updateWebsiteGroup(groupId, rest);

    const result: OperationResult<LMWebsiteGroup> = {
      success: true,
      data: apiResult.data,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'websiteGroup', 'update', result);
    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMWebsiteGroup>> {
    const validated = validateDeleteWebsiteGroup(args);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (BatchOperationResolver.isBatchOperation(validated as any, 'groups')) {
      return this.handleBatchDelete(validated);
    }

    const groupId = validated.id ?? this.resolveId(validated);
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Website group ID must be a number');
    }

    const apiResult = await this.client.deleteWebsiteGroup(groupId, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deleteChildren: (validated as any).deleteChildren ?? false
    });

    const result: OperationResult<LMWebsiteGroup> = {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { groupId } as any,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'websiteGroup', 'delete', result);
    return result;
  }

  private async handleBatchUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMWebsiteGroup>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolution = await BatchOperationResolver.resolveItems<any>(
      args,
      this.sessionContext,
      this.client,
      'websiteGroup',
      'groups'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'update');

    const updateOps = resolution.items.map(item => ({
      groupId: item.id || item.groupId,
      updates: args.updates || item
    }));

    const batchResult = await batchProcessor.processBatch(
      updateOps,
      async ({ groupId, updates }) => this.client.updateWebsiteGroup(groupId, updates),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const result: OperationResult<LMWebsiteGroup> = {
      success: batchResult.success,
      items: batchResult.results.filter(r => r.success && r.data).map(r => r.data as LMWebsiteGroup),
      summary: batchResult.summary,
      results: batchResult.results
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'websiteGroup', 'update', result);
    return result;
  }

  private async handleBatchDelete(args: DeleteOperationArgs): Promise<OperationResult<LMWebsiteGroup>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolution = await BatchOperationResolver.resolveItems<any>(
      args,
      this.sessionContext,
      this.client,
      'websiteGroup',
      'groups'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'delete');

    const deleteOps = resolution.items.map(item => ({
      groupId: item.id || item.groupId,
      deleteChildren: (args.deleteChildren as boolean) ?? false
    }));

    const batchResult = await batchProcessor.processBatch(
      deleteOps,
      async ({ groupId, deleteChildren }) => this.client.deleteWebsiteGroup(groupId, { deleteChildren }),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const result: OperationResult<LMWebsiteGroup> = {
      success: batchResult.success,
      summary: batchResult.summary,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: batchResult.results as any
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'websiteGroup', 'delete', result);
    return result;
  }
}

