/**
 * Website Resource Handler
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { BatchOperationResolver } from '../base/batchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { batchProcessor } from '../../utils/batchProcessor.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMWebsite } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import {
  validateListWebsites,
  validateGetWebsite,
  validateCreateWebsite,
  validateUpdateWebsite,
  validateDeleteWebsite
} from './websiteZodSchemas.js';

export class WebsiteHandler extends ResourceHandler<LMWebsite> {
  constructor(client: LogicMonitorClient, sessionManager: SessionManager, sessionId?: string) {
    super(
      { resourceType: 'website', resourceName: 'website', idField: 'id' },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateListWebsites(args);
    const { fields, filter, size, offset, autoPaginate, collectorIds } = validated;
    const fieldConfig = sanitizeFields('website', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown website field(s): ${fieldConfig.invalid.join(', ')}`);
    }

    const apiResult = await this.client.listWebsites({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset,
      autoPaginate,
      collectorIds
    });

    const result: OperationResult<LMWebsite> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMWebsite[],
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('list', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'website', 'list', result);
    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateGetWebsite(args);
    const websiteId = validated.id ?? this.resolveId(validated);
    
    if (typeof websiteId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Website ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = sanitizeFields('website', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown website field(s): ${fieldConfig.invalid.join(', ')}`);
    }

    const apiResult = await this.client.getWebsite(websiteId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMWebsite> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('get', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'website', 'get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'website', websiteId, apiResult.data);
    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateCreateWebsite(args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isBatch = !!((validated as any).websites && Array.isArray((validated as any).websites));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const websitesInput = isBatch ? (validated as any).websites : [validated];

    const batchResult = await batchProcessor.processBatch(
      websitesInput,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (website: Record<string, unknown>) => this.client.createWebsite(website as any),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    if (!isBatch) {
      const entry = batchResult.results[0];
      if (!entry || !entry.success || !entry.data) {
        throwBatchFailure('Website create', entry);
      }

      const result: OperationResult<LMWebsite> = {
        success: true,
        data: entry.data as LMWebsite,
        raw: entry.raw,
        meta: entry.meta
      };

      this.storeInSession('create', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'website', 'create', result);
      return result;
    }

    const successful = batchResult.results.filter(r => r.success && r.data);
    const result: OperationResult<LMWebsite> = {
      success: batchResult.success,
      items: successful.map(r => r.data as LMWebsite),
      summary: batchResult.summary,
      results: batchResult.results
    };

    this.storeInSession('create', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'website', 'create', result);
    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateUpdateWebsite(args);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (BatchOperationResolver.isBatchOperation(validated as any, 'websites')) {
      return this.handleBatchUpdate(validated);
    }

    const websiteId = validated.id ?? this.resolveId(validated);
    if (typeof websiteId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Website ID must be a number');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { id: _id, operation: _operation, updates: _updateData, applyToPrevious: _applyToPrevious, filter: _filter, batchOptions: _batchOptions, ...rest } = validated as any;
    const apiResult = await this.client.updateWebsite(websiteId, rest);

    const result: OperationResult<LMWebsite> = {
      success: true,
      data: apiResult.data,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'website', 'update', result);
    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateDeleteWebsite(args);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (BatchOperationResolver.isBatchOperation(validated as any, 'websites')) {
      return this.handleBatchDelete(validated);
    }

    const websiteId = validated.id ?? this.resolveId(validated);
    if (typeof websiteId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Website ID must be a number');
    }

    const apiResult = await this.client.deleteWebsite(websiteId);

    const result: OperationResult<LMWebsite> = {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { websiteId } as any,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'website', 'delete', result);
    return result;
  }

  private async handleBatchUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMWebsite>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolution = await BatchOperationResolver.resolveItems<any>(
      args,
      this.sessionContext,
      this.client,
      'website',
      'websites'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'update');

    const updateOps = resolution.items.map(item => ({
      websiteId: item.id || item.websiteId,
      updates: args.updates || item
    }));

    const batchResult = await batchProcessor.processBatch(
      updateOps,
      async ({ websiteId, updates }) => this.client.updateWebsite(websiteId, updates),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const result: OperationResult<LMWebsite> = {
      success: batchResult.success,
      items: batchResult.results.filter(r => r.success && r.data).map(r => r.data as LMWebsite),
      summary: batchResult.summary,
      results: batchResult.results
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'website', 'update', result);
    return result;
  }

  private async handleBatchDelete(args: DeleteOperationArgs): Promise<OperationResult<LMWebsite>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolution = await BatchOperationResolver.resolveItems<any>(
      args,
      this.sessionContext,
      this.client,
      'website',
      'websites'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'delete');

    const deleteOps = resolution.items.map(item => ({
      websiteId: item.id || item.websiteId
    }));

    const batchResult = await batchProcessor.processBatch(
      deleteOps,
      async ({ websiteId }) => this.client.deleteWebsite(websiteId),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const result: OperationResult<LMWebsite> = {
      success: batchResult.success,
      summary: batchResult.summary,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: batchResult.results as any
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'website', 'delete', result);
    return result;
  }
}

