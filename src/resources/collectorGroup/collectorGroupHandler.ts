/**
 * Collector Group Resource Handler
 * Handles all collector group operations (list, get, create, update, delete)
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { BatchOperationResolver } from '../base/batchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
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
import type { BatchResult } from '../../utils/batchProcessor.js';
import {
  validateListCollectorGroups,
  validateGetCollectorGroup,
  validateCreateCollectorGroup,
  validateUpdateCollectorGroup,
  validateDeleteCollectorGroup
} from './collectorGroupZodSchemas.js';

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
        idField: 'id',
        pluralKey: 'groups'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateListCollectorGroups(args);
    const { fields, filter, size, offset, autoPaginate } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.listCollectorGroups({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset,
      autoPaginate
    });

    const result: OperationResult<LMCollectorGroup> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMCollectorGroup[],
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

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateGetCollectorGroup(args);
    const groupId = validated.id ?? this.resolveId(validated);

    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Collector group ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.getCollectorGroup(groupId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMCollectorGroup> = {
      success: true,
      data: apiResult.data,
      request: {
        groupId,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'collectorGroup', groupId, apiResult.data);

    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateCreateCollectorGroup(args);
    const isBatch = this.isBatchCreate(validated);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const groupsInput = this.normalizeCreateInput(validated);

    const batchResult = await this.processBatch(
      groupsInput,
      async (groupPayload) => this.client.createCollectorGroup(groupPayload as Parameters<LogicMonitorClient['createCollectorGroup']>[0]),
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

      this.recordAndStore('create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'collectorGroup', createdGroup.id, createdGroup);

      return result;
    }

    const successfulGroups = this.extractSuccessfulItems(normalized);

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

    this.recordAndStore('create', result);

    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateUpdateCollectorGroup(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'groups');
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
        validated,
        this.sessionContext,
        this.client,
        'collectorGroup',
        'groups'
      );

      BatchOperationResolver.validateBatchSafety(resolution, 'update');

      const updates = validated.updates || {};
      const batchResult = await this.processBatch(
        resolution.items,
        async (group: Record<string, unknown>) => {
          const groupId = group.id ?? group.groupId;
          if (!groupId) {
            throw new McpError(ErrorCode.InvalidParams, 'Collector group ID is required for update');
          }
          const mergedUpdates = { ...group, ...updates };
          delete mergedUpdates.id;
          delete mergedUpdates.groupId;
          return this.client.updateCollectorGroup(groupId as number, mergedUpdates);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);
      const successfulGroups = this.extractSuccessfulItems(normalized);

      const result: OperationResult<LMCollectorGroup> = {
        success: batchResult.success,
        items: successfulGroups,
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

    const groupId = validated.id ?? this.resolveId(validated);
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Collector group ID must be a number');
    }

    const updates: Record<string, unknown> = { ...validated };
    delete updates.operation;
    delete updates.portal;
    delete updates.id;
    delete updates.groupId;

    const apiResult = await this.client.updateCollectorGroup(groupId, updates);
    const result: OperationResult<LMCollectorGroup> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('update', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'collectorGroup', groupId, apiResult.data);

    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMCollectorGroup>> {
    const validated = validateDeleteCollectorGroup(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'groups') ||
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
          'collectorGroup',
          'groups'
        );
        BatchOperationResolver.validateBatchSafety(resolution, 'delete');
        itemsToDelete = resolution.items;
      }

      const batchResult = await this.processBatch(
        itemsToDelete,
        async (group: Record<string, unknown>) => {
          const groupId = group.id ?? group.groupId;
          if (!groupId) {
            throw new McpError(ErrorCode.InvalidParams, 'Collector group ID is required for delete');
          }
          await this.client.deleteCollectorGroup(groupId as number);
          return { id: groupId } as unknown as LMCollectorGroup;
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult as BatchResult<LMCollectorGroup>);

      const result: OperationResult<LMCollectorGroup> = {
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

    const groupId = validated.id ?? this.resolveId(validated);
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Collector group ID must be a number');
    }

    await this.client.deleteCollectorGroup(groupId);
    const result: OperationResult<LMCollectorGroup> = {
      success: true,
      data: undefined
    };

    this.recordAndStore('delete', result);

    return result;
  }
}
