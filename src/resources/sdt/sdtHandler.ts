/**
 * SDT (Scheduled Down Time) Resource Handler
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { BatchOperationResolver } from '../base/batchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMSDT } from '../../types/logicmonitor.js';
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
  validateListSdts,
  validateGetSdt,
  validateCreateSdt,
  validateUpdateSdt,
  validateDeleteSdt
} from './sdtZodSchemas.js';

export class SdtHandler extends ResourceHandler<LMSDT> {
  constructor(
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    super(
      {
        resourceType: 'sdt',
        resourceName: 'sdt',
        idField: 'id',
        pluralKey: 'sdts'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMSDT>> {
    const validated = validateListSdts(args);
    const { fields, filter, size, offset, autoPaginate } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.listSdts({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset,
      autoPaginate
    });

    const result: OperationResult<LMSDT> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMSDT[],
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

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMSDT>> {
    const validated = validateGetSdt(args);
    const sdtId = validated.id ?? this.resolveId(validated);

    if (typeof sdtId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'SDT ID must be a string (format: "XX_##", e.g. "R_42")');
    }

    const { fields } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.getSdt(sdtId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMSDT> = {
      success: true,
      data: apiResult.data,
      request: {
        sdtId,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'sdt', sdtId, apiResult.data);
    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMSDT>> {
    const validated = validateCreateSdt(args);
    const isBatch = this.isBatchCreate(validated);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const sdtsInput = this.normalizeCreateInput(validated);

    const batchResult = await this.processBatch(
      sdtsInput,
      async (sdtPayload) => this.client.createSdt(sdtPayload),
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
        throwBatchFailure('SDT create', batchResult.results[0]);
      }
      const createdSdt = entry.data as LMSDT;

      const result: OperationResult<LMSDT> = {
        success: true,
        data: createdSdt,
        raw: entry.raw ?? createdSdt,
        meta: entry.meta ?? undefined
      };

      this.recordAndStore('create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'sdt', createdSdt.id, createdSdt);
      return result;
    }

    const successfulSdts = this.extractSuccessfulItems(normalized);

    const result: OperationResult<LMSDT> = {
      success: batchResult.success,
      items: successfulSdts,
      summary: batchResult.summary,
      request: {
        batch: true,
        batchOptions,
        sdts: sdtsInput
      },
      results: normalized
    };

    this.recordAndStore('create', result);
    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMSDT>> {
    const validated = validateUpdateSdt(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'sdts');
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
        validated,
        this.sessionContext,
        this.client,
        'sdt',
        'sdts'
      );

      BatchOperationResolver.validateBatchSafety(resolution, 'update');

      const updates = validated.updates || {};
      const batchResult = await this.processBatch(
        resolution.items,
        async (sdt: Record<string, unknown>) => {
          const sdtId = sdt.id;
          if (!sdtId || typeof sdtId !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'SDT ID is required for update');
          }
          const mergedUpdates = { ...sdt, ...updates };
          delete mergedUpdates.id;
          return this.client.updateSdt(sdtId, mergedUpdates);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);
      const successfulSdts = this.extractSuccessfulItems(normalized);

      const result: OperationResult<LMSDT> = {
        success: batchResult.success,
        items: successfulSdts,
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

    const sdtId = validated.id ?? this.resolveId(validated);
    if (typeof sdtId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'SDT ID must be a string (format: "XX_##", e.g. "R_42")');
    }

    const updates: Record<string, unknown> = { ...validated };
    delete updates.operation;
    delete updates.portal;
    delete updates.id;

    const apiResult = await this.client.updateSdt(sdtId, updates);
    const result: OperationResult<LMSDT> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('update', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'sdt', sdtId, apiResult.data);
    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMSDT>> {
    const validated = validateDeleteSdt(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'sdts') ||
                     (validated.ids && Array.isArray(validated.ids));
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      let itemsToDelete: Array<Record<string, unknown>>;

      if (validated.ids && Array.isArray(validated.ids)) {
        itemsToDelete = validated.ids.map((id) => ({ id }));
      } else {
        const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
          validated,
          this.sessionContext,
          this.client,
          'sdt',
          'sdts'
        );
        BatchOperationResolver.validateBatchSafety(resolution, 'delete');
        itemsToDelete = resolution.items;
      }

      const batchResult = await this.processBatch(
        itemsToDelete,
        async (sdt: Record<string, unknown>) => {
          const sdtId = sdt.id;
          if (!sdtId || typeof sdtId !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'SDT ID is required for delete');
          }
          await this.client.deleteSdt(sdtId);
          return { id: sdtId } as unknown as LMSDT;
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult as BatchResult<LMSDT>);

      const result: OperationResult<LMSDT> = {
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

    const sdtId = validated.id ?? this.resolveId(validated);
    if (typeof sdtId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'SDT ID must be a string (format: "XX_##", e.g. "R_42")');
    }

    await this.client.deleteSdt(sdtId);
    const result: OperationResult<LMSDT> = {
      success: true,
      data: undefined
    };

    this.recordAndStore('delete', result);
    return result;
  }
}
