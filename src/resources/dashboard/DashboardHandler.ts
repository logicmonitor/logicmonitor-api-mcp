/**
 * Dashboard Resource Handler
 * Handles all dashboard operations (list, get, create, update, delete)
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/ResourceHandler.js';
import { BatchOperationResolver } from '../base/BatchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { batchProcessor } from '../../utils/batchProcessor.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMDashboard } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import {
  validateListDashboards,
  validateGetDashboard,
  validateCreateDashboard,
  validateUpdateDashboard,
  validateDeleteDashboard
} from './dashboardSchemas.js';

export class DashboardHandler extends ResourceHandler<LMDashboard> {
  constructor(
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    super(
      {
        resourceType: 'dashboard',
        resourceName: 'dashboard',
        idField: 'id'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateListDashboards(args);
    const { fields, filter, size, offset } = validated;
    const fieldConfig = sanitizeFields('dashboard', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown dashboard field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.listDashboards({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset
    });

    const result: OperationResult<LMDashboard> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMDashboard[],
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
    this.sessionManager.recordOperation(this.sessionContext.id, 'dashboard', 'list', result);

    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateGetDashboard(args);
    const dashboardId = validated.id ?? this.resolveId(validated);
    
    if (typeof dashboardId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = sanitizeFields('dashboard', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown dashboard field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.getDashboard(dashboardId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMDashboard> = {
      success: true,
      data: apiResult.data,
      request: {
        dashboardId,
        fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('get', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'dashboard', 'get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'dashboard', dashboardId, apiResult.data);

    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateCreateDashboard(args);
    const isBatch = this.isBatchCreate(validated);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const dashboardsInput = this.normalizeCreateInput(validated);

    const batchResult = await batchProcessor.processBatch(
      dashboardsInput,
      async (dashboardPayload) => this.client.createDashboard(dashboardPayload),
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
        throwBatchFailure('Dashboard create', batchResult.results[0]);
      }
      const createdDashboard = entry.data as LMDashboard;
      
      const result: OperationResult<LMDashboard> = {
        success: true,
        data: createdDashboard,
        raw: entry.raw ?? createdDashboard,
        meta: entry.meta ?? undefined
      };

      this.storeInSession('create', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'dashboard', 'create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'dashboard', createdDashboard.id, createdDashboard);

      return result;
    }

    const successful = normalized.filter((entry: any) => entry.success && entry.data);
    const successfulDashboards = successful.map((entry: any) => entry.data as LMDashboard);

    const result: OperationResult<LMDashboard> = {
      success: batchResult.success,
      items: successfulDashboards,
      summary: batchResult.summary,
      request: {
        batch: true,
        batchOptions,
        dashboards: dashboardsInput
      },
      results: normalized
    };

    this.storeInSession('create', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'dashboard', 'create', result);

    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateUpdateDashboard(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'dashboards');
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      const resolution = await BatchOperationResolver.resolveItems<any>(
        validated,
        this.sessionContext,
        this.client,
        'dashboard',
        'dashboards'
      );

      BatchOperationResolver.validateBatchSafety(resolution, 'update');

      const updates = validated.updates || {};
      const batchResult = await batchProcessor.processBatch(
        resolution.items,
        async (dashboard: any) => {
          const dashboardId = dashboard.id ?? dashboard.dashboardId;
          if (!dashboardId) {
            throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID is required for update');
          }
          const mergedUpdates = { ...dashboard, ...updates };
          delete mergedUpdates.id;
          delete mergedUpdates.dashboardId;
          return this.client.updateDashboard(dashboardId, mergedUpdates);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);
      const successful = normalized.filter((entry: any) => entry.success && entry.data);

      const result: OperationResult<LMDashboard> = {
        success: batchResult.success,
        items: successful.map((entry: any) => entry.data as LMDashboard),
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
      this.sessionManager.recordOperation(this.sessionContext.id, 'dashboard', 'update', result);

      return result;
    }

    const dashboardId = validated.id ?? this.resolveId(validated);
    if (typeof dashboardId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID must be a number');
    }

    const updates = { ...validated };
    delete updates.operation;
    delete updates.id;
    delete updates.dashboardId;

    const apiResult = await this.client.updateDashboard(dashboardId, updates);
    const result: OperationResult<LMDashboard> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'dashboard', 'update', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'dashboard', dashboardId, apiResult.data);

    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateDeleteDashboard(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'dashboards') || 
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
          'dashboard',
          'dashboards'
        );
        BatchOperationResolver.validateBatchSafety(resolution, 'delete');
        itemsToDelete = resolution.items;
      }

      const batchResult = await batchProcessor.processBatch(
        itemsToDelete,
        async (dashboard: any) => {
          const dashboardId = dashboard.id ?? dashboard.dashboardId;
          if (!dashboardId) {
            throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID is required for delete');
          }
          return this.client.deleteDashboard(dashboardId);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);

      const result: OperationResult<LMDashboard> = {
        success: batchResult.success,
        summary: batchResult.summary,
        request: {
          batch: true,
          batchOptions
        },
        results: normalized
      };

      this.storeInSession('delete', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'dashboard', 'delete', result);

      return result;
    }

    const dashboardId = validated.id ?? this.resolveId(validated);
    if (typeof dashboardId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID must be a number');
    }

    await this.client.deleteDashboard(dashboardId);
    const result: OperationResult<LMDashboard> = {
      success: true,
      data: undefined
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'dashboard', 'delete', result);

    return result;
  }

  private isBatchCreate(args: any): boolean {
    return args.dashboards && Array.isArray(args.dashboards);
  }

  private normalizeCreateInput(args: any): any[] {
    if (args.dashboards && Array.isArray(args.dashboards)) {
      return args.dashboards;
    }
    const singleDashboard = { ...args };
    delete singleDashboard.operation;
    delete singleDashboard.batchOptions;
    return [singleDashboard];
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

