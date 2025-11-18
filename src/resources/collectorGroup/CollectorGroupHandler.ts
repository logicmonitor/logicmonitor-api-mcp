/**
 * Collector Group Resource Handler
 * Handles all collector group operations (list, get, create, update, delete)
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/ResourceHandler.js';
import { BatchOperationResolver } from '../base/BatchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { batchProcessor } from '../../utils/batchProcessor.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMCollectorGroup } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import {
  validateListCollectorGroups,
  validateGetCollectorGroup,
  validateCreateCollectorGroup,
  validateUpdateCollectorGroup,
  validateDeleteCollectorGroup
} from './collectorGroupSchemas.js';

export class CollectorGroupHandler extends ResourceHandler<LMCollectorGroup> {
  constructor(
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    super(
      {
        resourceType: 'collectorGroup',
        resourceName: 'collectorGroup',
        idField: 'id'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateListCollectorGroups(args);
    const { fields, filter, size, offset } = validated;
    const fieldConfig = sanitizeFields('collectorGroup', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown collector group field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.listCollectorGroups({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset
    });

    const result: OperationResult<LMCollectorGroup> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMCollectorGroup[],
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
    this.sessionManager.recordOperation(this.sessionContext.id, 'collectorGroup', 'list', result);

    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateGetCollectorGroup(args);
    const groupId = validated.id ?? this.resolveId(validated);
    
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Collector group ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = sanitizeFields('collectorGroup', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown collector group field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.getCollectorGroup(groupId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMCollectorGroup> = {
      success: true,
      data: apiResult.data,
      request: {
        groupId,
        fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('get', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'collectorGroup', 'get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'collectorGroup', groupId, apiResult.data);

    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateCreateCollectorGroup(args);
    const isBatch = this.isBatchCreate(validated);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const groupsInput = this.normalizeCreateInput(validated);

    const batchResult = await batchProcessor.processBatch(
      groupsInput,
      async (groupPayload) => this.client.createCollectorGroup(groupPayload),
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
        throwBatchFailure('Collector group create', batchResult.results[0]);
      }
      const createdGroup = entry.data as LMCollectorGroup;
      
      const result: OperationResult<LMCollectorGroup> = {
        success: true,
        data: createdGroup,
        raw: entry.raw ?? createdGroup,
        meta: entry.meta ?? undefined
      };

      this.storeInSession('create', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'collectorGroup', 'create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'collectorGroup', createdGroup.id, createdGroup);

      return result;
    }

    const successful = normalized.filter((entry: any) => entry.success && entry.data);
    const successfulGroups = successful.map((entry: any) => entry.data as LMCollectorGroup);

    const result: OperationResult<LMCollectorGroup> = {
      success: batchResult.success,
      items: successfulGroups,
      summary: batchResult.summary,
      request: {
        batch: true,
        batchOptions,
        groups: groupsInput
      },
      results: normalized
    };

    this.storeInSession('create', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'collectorGroup', 'create', result);

    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateUpdateCollectorGroup(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'groups');
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      const resolution = await BatchOperationResolver.resolveItems<any>(
        validated,
        this.sessionContext,
        this.client,
        'collectorGroup',
        'groups'
      );

      BatchOperationResolver.validateBatchSafety(resolution, 'update');

      const updates = validated.updates || {};
      const batchResult = await batchProcessor.processBatch(
        resolution.items,
        async (group: any) => {
          const groupId = group.id ?? group.groupId;
          if (!groupId) {
            throw new McpError(ErrorCode.InvalidParams, 'Collector group ID is required for update');
          }
          const mergedUpdates = { ...group, ...updates };
          delete mergedUpdates.id;
          delete mergedUpdates.groupId;
          return this.client.updateCollectorGroup(groupId, mergedUpdates);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);
      const successful = normalized.filter((entry: any) => entry.success && entry.data);

      const result: OperationResult<LMCollectorGroup> = {
        success: batchResult.success,
        items: successful.map((entry: any) => entry.data as LMCollectorGroup),
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
      this.sessionManager.recordOperation(this.sessionContext.id, 'collectorGroup', 'update', result);

      return result;
    }

    const groupId = validated.id ?? this.resolveId(validated);
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Collector group ID must be a number');
    }

    const updates = { ...validated };
    delete updates.operation;
    delete updates.id;
    delete updates.groupId;

    const apiResult = await this.client.updateCollectorGroup(groupId, updates);
    const result: OperationResult<LMCollectorGroup> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'collectorGroup', 'update', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'collectorGroup', groupId, apiResult.data);

    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateDeleteCollectorGroup(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'groups') || 
                     (validated.ids && Array.isArray(validated.ids));
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      let itemsToDelete: any[];

      if (validated.ids && Array.isArray(validated.ids)) {
        itemsToDelete = validated.ids.map((id: number) => ({ id }));
      } else {
        const resolution = await BatchOperationResolver.resolveItems<any>(
          validated,
          this.sessionContext,
          this.client,
          'collectorGroup',
          'groups'
        );
        BatchOperationResolver.validateBatchSafety(resolution, 'delete');
        itemsToDelete = resolution.items;
      }

      const batchResult = await batchProcessor.processBatch(
        itemsToDelete,
        async (group: any) => {
          const groupId = group.id ?? group.groupId;
          if (!groupId) {
            throw new McpError(ErrorCode.InvalidParams, 'Collector group ID is required for delete');
          }
          return this.client.deleteCollectorGroup(groupId);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);

      const result: OperationResult<LMCollectorGroup> = {
        success: batchResult.success,
        summary: batchResult.summary,
        request: {
          batch: true,
          batchOptions
        },
        results: normalized
      };

      this.storeInSession('delete', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'collectorGroup', 'delete', result);

      return result;
    }

    const groupId = validated.id ?? this.resolveId(validated);
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Collector group ID must be a number');
    }

    await this.client.deleteCollectorGroup(groupId);
    const result: OperationResult<LMCollectorGroup> = {
      success: true,
      data: undefined
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'collectorGroup', 'delete', result);

    return result;
  }

  private isBatchCreate(args: any): boolean {
    return args.groups && Array.isArray(args.groups);
  }

  private normalizeCreateInput(args: any): any[] {
    if (args.groups && Array.isArray(args.groups)) {
      return args.groups;
    }
    const singleGroup = { ...args };
    delete singleGroup.operation;
    delete singleGroup.batchOptions;
    return [singleGroup];
  }

  private normalizeBatchResults(batch: any) {
    return batch.results.map((entry: any) => ({
      index: entry.index,
      success: entry.success,
      data: entry.data ?? null,
      error: entry.error,
      diagnostics: entry.diagnostics,
      meta: entry.meta,
      raw: entry.raw
    }));
  }
}

