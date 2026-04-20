/**
 * Dashboard Resource Handler
 * Handles all dashboard operations (list, get, create, update, delete)
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { BatchOperationResolver } from '../base/batchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
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
import type { BatchResult } from '../../utils/batchProcessor.js';
import { validateDashboardOperation } from './dashboardZodSchemas.js';
import { getDashboardLink } from '../../utils/resourceLinks.js';

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
        idField: 'id',
        pluralKey: 'dashboards',
        linkBuilder: (portalUiBaseUrl, resource) => {
          const id = resource.id ?? resource.dashboardId;
          if (id == null) return undefined;
          const groupIds = parseGroupIds(resource.groupId ?? resource.groupIds);
          return getDashboardLink({
            portalUiBaseUrl,
            dashboardId: id as number | string,
            groupIds
          });
        }
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateDashboardOperation(args) as Extract<ReturnType<typeof validateDashboardOperation>, { operation: 'list' }>;
    const { fields, filter, size, offset, autoPaginate } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.listDashboards({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset,
      autoPaginate
    });

    const result: OperationResult<LMDashboard> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMDashboard[],
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

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateDashboardOperation(args) as Extract<ReturnType<typeof validateDashboardOperation>, { operation: 'get' }>;
    const dashboardId = validated.id ?? this.resolveId(validated);

    if (typeof dashboardId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.getDashboard(dashboardId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMDashboard> = {
      success: true,
      data: apiResult.data,
      request: {
        dashboardId,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'dashboard', dashboardId, apiResult.data);

    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateDashboardOperation(args) as Extract<ReturnType<typeof validateDashboardOperation>, { operation: 'create' }>;
    const isBatch = this.isBatchCreate(validated);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const dashboardsInput = this.normalizeCreateInput(validated);

    const batchResult = await this.processBatch(
      dashboardsInput,
      async (dashboardPayload) => this.client.createDashboard(dashboardPayload as Parameters<LogicMonitorClient['createDashboard']>[0]),
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

      this.recordAndStore('create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'dashboard', createdDashboard.id, createdDashboard);

      return result;
    }

    const successfulDashboards = this.extractSuccessfulItems(normalized);

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

    this.recordAndStore('create', result);

    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateDashboardOperation(args) as Extract<ReturnType<typeof validateDashboardOperation>, { operation: 'update' }>;
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'dashboards');
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
        validated,
        this.sessionContext,
        this.client,
        'dashboard',
        'dashboards'
      );

      BatchOperationResolver.validateBatchSafety(resolution, 'update');

      const updates = validated.updates || {};
      const batchResult = await this.processBatch(
        resolution.items,
        async (dashboard: Record<string, unknown>) => {
          const dashboardId = dashboard.id ?? dashboard.dashboardId;
          if (!dashboardId) {
            throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID is required for update');
          }
          const mergedUpdates = { ...dashboard, ...updates };
          delete mergedUpdates.id;
          delete mergedUpdates.dashboardId;
          return this.client.updateDashboard(dashboardId as number, mergedUpdates);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);
      const successfulDashboards = this.extractSuccessfulItems(normalized);

      const result: OperationResult<LMDashboard> = {
        success: batchResult.success,
        items: successfulDashboards,
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

    const dashboardId = validated.id ?? this.resolveId(validated);
    if (typeof dashboardId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID must be a number');
    }

    const updates: Record<string, unknown> = { ...validated };
    delete updates.operation;
    delete updates.portal;
    delete updates.id;
    delete updates.dashboardId;

    const apiResult = await this.client.updateDashboard(dashboardId, updates);
    const result: OperationResult<LMDashboard> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('update', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'dashboard', dashboardId, apiResult.data);

    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMDashboard>> {
    const validated = validateDashboardOperation(args) as Extract<ReturnType<typeof validateDashboardOperation>, { operation: 'delete' }>;
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'dashboards') ||
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
          'dashboard',
          'dashboards'
        );
        BatchOperationResolver.validateBatchSafety(resolution, 'delete');
        itemsToDelete = resolution.items;
      }

      const batchResult = await this.processBatch(
        itemsToDelete,
        async (dashboard: Record<string, unknown>) => {
          const dashboardId = dashboard.id ?? dashboard.dashboardId;
          if (!dashboardId) {
            throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID is required for delete');
          }
          await this.client.deleteDashboard(dashboardId as number);
          return { id: dashboardId } as unknown as LMDashboard;
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult as BatchResult<LMDashboard>);

      const result: OperationResult<LMDashboard> = {
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

    const dashboardId = validated.id ?? this.resolveId(validated);
    if (typeof dashboardId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID must be a number');
    }

    await this.client.deleteDashboard(dashboardId);
    const result: OperationResult<LMDashboard> = {
      success: true,
      data: undefined
    };

    this.recordAndStore('delete', result);

    return result;
  }

  protected resolveId(args: Record<string, unknown>): number {
    const id = (args.id ?? args.dashboardId) as number | undefined;
    if (!id) {
      throw new McpError(ErrorCode.InvalidParams, 'Dashboard ID is required');
    }
    return id;
  }

}

function parseGroupIds(value: unknown): Array<number | string> | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const filtered = value
      .map(entry => (typeof entry === 'number' || typeof entry === 'string' ? entry : undefined))
      .filter((entry): entry is number | string => typeof entry !== 'undefined');
    return filtered.length ? filtered : undefined;
  }
  if (typeof value === 'string') {
    const parts = value
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }
  if (typeof value === 'number') {
    return [value];
  }
  return undefined;
}
