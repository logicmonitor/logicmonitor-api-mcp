/**
 * Website Resource Handler
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { BatchOperationResolver } from '../base/batchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
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
import { getWebsiteLink } from '../../utils/resourceLinks.js';

export class WebsiteHandler extends ResourceHandler<LMWebsite> {
  constructor(client: LogicMonitorClient, sessionManager: SessionManager, sessionId?: string) {
    super(
      {
        resourceType: 'website',
        resourceName: 'website',
        idField: 'id',
        pluralKey: 'websites',
        linkBuilder: (portalUiBaseUrl, resource) => {
          const id = resource.id ?? resource.websiteId;
          return id != null ? getWebsiteLink({ portalUiBaseUrl, websiteId: id as number | string }) : undefined;
        }
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateListWebsites(args);
    const { fields, filter, size, offset, autoPaginate, collectorIds } = validated;
    const fieldConfig = this.validateFields(fields);

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

    this.recordAndStore('list', result);
    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateGetWebsite(args);
    const websiteId = validated.id ?? this.resolveId(validated);

    if (typeof websiteId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Website ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.getWebsite(websiteId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMWebsite> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'website', websiteId, apiResult.data);
    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateCreateWebsite(args);
    const validatedRecord = validated as Record<string, unknown>;
    const isBatch = this.isBatchCreate(validatedRecord);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validatedRecord);
    const websitesInput = this.normalizeCreateInput(validatedRecord);

    const batchResult = await this.processBatch(
      websitesInput,
      async (website: Record<string, unknown>) => this.client.createWebsite(website as Parameters<LogicMonitorClient['createWebsite']>[0]),
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

      this.recordAndStore('create', result);
      return result;
    }

    const successful = batchResult.results.filter(r => r.success && r.data);
    const result: OperationResult<LMWebsite> = {
      success: batchResult.success,
      items: successful.map(r => r.data as LMWebsite),
      summary: batchResult.summary,
      results: batchResult.results
    };

    this.recordAndStore('create', result);
    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateUpdateWebsite(args);

    if (BatchOperationResolver.isBatchOperation(validated, 'websites')) {
      return this.handleBatchUpdate(validated);
    }

    const websiteId = validated.id ?? this.resolveId(validated);
    if (typeof websiteId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Website ID must be a number');
    }

    const { id: _id, operation: _operation, updates: _updateData, applyToPrevious: _applyToPrevious, filter: _filter, batchOptions: _batchOptions, ...rest } = validated as Record<string, unknown>;
    const apiResult = await this.client.updateWebsite(websiteId, rest);

    const result: OperationResult<LMWebsite> = {
      success: true,
      data: apiResult.data,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.recordAndStore('update', result);
    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMWebsite>> {
    const validated = validateDeleteWebsite(args);

    if (BatchOperationResolver.isBatchOperation(validated, 'websites')) {
      return this.handleBatchDelete(validated);
    }

    const websiteId = validated.id ?? this.resolveId(validated);
    if (typeof websiteId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Website ID must be a number');
    }

    const apiResult = await this.client.deleteWebsite(websiteId);

    const result: OperationResult<LMWebsite> = {
      success: true,
      data: { websiteId } as unknown as LMWebsite,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.recordAndStore('delete', result);
    return result;
  }

  private async handleBatchUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMWebsite>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
      args,
      this.sessionContext,
      this.client,
      'website',
      'websites'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'update');

    const globalUpdates = (args.updates || {}) as Record<string, unknown>;
    const updateOps = resolution.items.map(item => ({
      websiteId: (item.id || item.websiteId) as number,
      updates: { ...item, ...globalUpdates }
    }));

    const batchResult = await this.processBatch(
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

    this.recordAndStore('update', result);
    return result;
  }

  private async handleBatchDelete(args: DeleteOperationArgs): Promise<OperationResult<LMWebsite>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
      args,
      this.sessionContext,
      this.client,
      'website',
      'websites'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'delete');

    const deleteOps = resolution.items.map(item => ({
      websiteId: (item.id || item.websiteId) as number
    }));

    const batchResult = await this.processBatch(
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
      results: batchResult.results as OperationResult<LMWebsite>['results']
    };

    this.recordAndStore('delete', result);
    return result;
  }

}
