/**
 * Device Resource Handler
 * Handles all device operations (list, get, create, update, delete)
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { BatchOperationResolver } from '../base/batchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMDevice } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult,
  OperationType
} from '../../types/operations.js';
import type { BatchResult, BatchItem } from '../../utils/batchProcessor.js';
import {
  validateListDevices,
  validateGetDevice,
  validateCreateDevice,
  validateUpdateDevice,
  validateDeleteDevice
} from './deviceZodSchemas.js';
import { getDeviceLink } from '../../utils/resourceLinks.js';

export class DeviceHandler extends ResourceHandler<LMDevice> {
  constructor(
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    super(
      {
        resourceType: 'device',
        resourceName: 'device',
        idField: 'id'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMDevice>> {
    const validated = validateListDevices({ ...args, operation: 'list' as const });
    const { fields, filter, size, offset, autoPaginate, start, end, netflowFilter, includeDeletedResources } = validated;
    const fieldConfig = sanitizeFields('device', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown device field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.listDevices({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset,
      autoPaginate,
      start,
      end,
      netflowFilter,
      includeDeletedResources
    });

    const result: OperationResult<LMDevice> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMDevice[],
      request: {
        filter,
        size,
        offset,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.attachDeviceLinks(result);
    this.storeInSession('list', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'device', 'list', result);

    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMDevice>> {
    const validated = validateGetDevice(args);
    
    // Resolve ID from args or session context
    const deviceId = validated.id ?? this.resolveId(validated);
    
    if (typeof deviceId !== 'number') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Device ID must be a number'
      );
    }

    const { fields, start, end, netflowFilter, needStcGrpAndSortedCP } = validated;
    const fieldConfig = sanitizeFields('device', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown device field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.getDevice(deviceId, {
      fields: fieldConfig.fieldsParam,
      start,
      end,
      netflowFilter,
      needStcGrpAndSortedCP
    });

    const result: OperationResult<LMDevice> = {
      success: true,
      data: apiResult.data,
      request: {
        deviceId,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(','),
        start,
        end,
        netflowFilter,
        needStcGrpAndSortedCP
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.attachDeviceLinks(result);
    this.storeInSession('get', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'device', 'get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'device', deviceId, apiResult.data);

    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMDevice>> {
    const validated = validateCreateDevice(args);
    const isBatch = this.isBatchCreate(validated);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated as any);
    const devicesInput = this.normalizeCreateInput(validated);

    const batchResult = await this.processBatch(
      devicesInput,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (devicePayload) => this.client.createDevice(devicePayload as any),
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
        throwBatchFailure('Device create', batchResult.results[0]);
      }
      const createdDevice = entry.data as LMDevice;
      
      const result: OperationResult<LMDevice> = {
        success: true,
        data: createdDevice,
        raw: entry.raw ?? createdDevice,
        meta: entry.meta ?? undefined
      };

      this.attachDeviceLinks(result);
      this.storeInSession('create', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'device', 'create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'device', createdDevice.id, createdDevice);

      return result;
    }

    const successful = normalized.filter(entry => entry.success && entry.data);
    const successfulDevices = successful
      .filter((entry): entry is typeof entry & { data: LMDevice } => entry.data !== undefined)
      .map(entry => entry.data);

    const result: OperationResult<LMDevice> = {
      success: batchResult.success,
      items: successfulDevices,
      summary: batchResult.summary,
      request: {
        batch: true,
        batchOptions,
        devices: devicesInput
      },
      results: normalized
    };

    this.attachDeviceLinks(result);
    this.storeInSession('create', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'device', 'create', result);

    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMDevice>> {
    const validated = validateUpdateDevice(args);

    // Check if this is a batch operation
    if (BatchOperationResolver.isBatchOperation(validated, 'devices')) {
      return this.handleBatchUpdate(validated);
    }

    // Single device update
    const deviceId = validated.id ?? this.resolveId(validated);
    
    if (typeof deviceId !== 'number') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Device ID must be a number'
      );
    }

    const payload = this.buildUpdatePayload(validated);
    const apiResult = await this.client.updateDevice(deviceId, payload);

    const result: OperationResult<LMDevice> = {
      success: true,
      data: apiResult.data,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.attachDeviceLinks(result);
    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'device', 'update', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'device', deviceId, apiResult.data);

    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMDevice>> {
    const validated = validateDeleteDevice(args);

    // Check if this is a batch operation
    if (BatchOperationResolver.isBatchOperation(validated, 'devices')) {
      return this.handleBatchDelete(validated);
    }

    // Single device delete
    const deviceId = validated.id ?? this.resolveId(validated);
    
    if (typeof deviceId !== 'number') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Device ID must be a number'
      );
    }

    const apiResult = await this.client.deleteDevice(deviceId);

    const result: OperationResult<LMDevice> = {
      success: true,
      data: { id: deviceId } as LMDevice,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'device', 'delete', result);

    return result;
  }

  /**
   * Handle batch update operations
   */
  private async handleBatchUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMDevice>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    
    // Resolve items from various sources
    const resolution = await BatchOperationResolver.resolveItems<LMDevice>(
      args,
      this.sessionContext,
      this.client,
      'device',
      'devices'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'update');

    // Build update operations
    const updateOps = resolution.items.map(item => ({
      deviceId: (item as unknown as Record<string, unknown>).deviceId || item.id,
      payload: args.updates || this.buildUpdatePayload(item as unknown as Record<string, unknown>)
    }));

    const batchResult = await this.processBatch(
      updateOps,
      async ({ deviceId, payload }) => this.client.updateDevice(deviceId as number, payload),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const normalized = this.normalizeBatchResults(batchResult);
    const successful = normalized.filter(entry => entry.success && entry.data);

    const result: OperationResult<LMDevice> = {
      success: batchResult.success,
      items: successful
        .filter((entry): entry is typeof entry & { data: LMDevice } => entry.data !== undefined)
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

    this.attachDeviceLinks(result);
    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'device', 'update', result);

    return result;
  }

  /**
   * Handle batch delete operations
   */
  private async handleBatchDelete(args: DeleteOperationArgs): Promise<OperationResult<LMDevice>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    
    // Resolve items from various sources
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolution = await BatchOperationResolver.resolveItems<any>(
      args,
      this.sessionContext,
      this.client,
      'device',
      'devices'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'delete');

    // Extract device IDs
    const deviceIds = resolution.items.map(item => ({
      deviceId: (item as Record<string, unknown>).deviceId || item.id
    }));

    const batchResult = await this.processBatch(
      deviceIds,
      async ({ deviceId }) => this.client.deleteDevice(deviceId),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const normalized = this.normalizeBatchResults(batchResult as unknown as BatchResult<LMDevice>);

    const result: OperationResult<LMDevice> = {
      success: batchResult.success,
      summary: batchResult.summary,
      request: {
        batch: true,
        mode: resolution.mode,
        source: resolution.source,
        batchOptions
      },
      results: normalized
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'device', 'delete', result);

    return result;
  }

  protected override enhanceResult(operation: OperationType, result: OperationResult<LMDevice>): void {
    super.enhanceResult(operation, result);
    this.attachDeviceLinks(result);
  }

  /**
   * Helper methods
   */
  private attachDeviceLinks(result: OperationResult<LMDevice>): void {
    if (result.data) {
      this.addLinkToDevice(result.data as unknown as Record<string, unknown>);
    }
    if (Array.isArray(result.items)) {
      result.items.forEach(item =>
        this.addLinkToDevice(item as unknown as Record<string, unknown>)
      );
    }
  }

  private addLinkToDevice(device: Record<string, unknown> | undefined): void {
    if (!device) return;
    const deviceId = device.id ?? device.deviceId;
    if (deviceId === null || typeof deviceId === 'undefined') {
      return;
    }
    try {
      device.linkUrl = getDeviceLink({
        company: this.client.getAccount(),
        deviceId: deviceId as number | string
      });
    } catch {
      // Ignore link generation errors
    }
  }

  private isBatchCreate(args: Record<string, unknown>): boolean {
    return !!(args.devices && Array.isArray(args.devices) && args.devices.length > 1);
  }

  private normalizeCreateInput(args: Record<string, unknown>): Array<Record<string, unknown>> {
    if (args.devices && Array.isArray(args.devices)) {
      return args.devices.map(device => this.mapCreateDeviceInput(device));
    }
    return [this.mapCreateDeviceInput(args)];
  }

  private mapCreateDeviceInput(input: Record<string, unknown>) {
    const customProps = Array.isArray(input.customProperties)
      ? input.customProperties
      : Array.isArray(input.properties)
        ? input.properties
        : undefined;

    return {
      displayName: input.displayName,
      name: input.name,
      hostGroupIds: Array.isArray(input.hostGroupIds) ? input.hostGroupIds : [],
      preferredCollectorId: input.preferredCollectorId,
      disableAlerting: input.disableAlerting ?? false,
      customProperties: customProps
    };
  }

  private buildUpdatePayload(input: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (input.displayName !== undefined) payload.displayName = input.displayName;
    if (input.disableAlerting !== undefined) payload.disableAlerting = input.disableAlerting;
    
    if (Array.isArray(input.customProperties)) {
      payload.customProperties = input.customProperties;
    } else if (Array.isArray(input.properties)) {
      payload.customProperties = input.properties;
    }

    if (Array.isArray(input.hostGroupIds)) {
      payload.hostGroupIds = input.hostGroupIds;
    }

    return payload;
  }

  private normalizeBatchResults(batch: BatchResult<LMDevice>): Array<BatchItem<LMDevice>> {
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

