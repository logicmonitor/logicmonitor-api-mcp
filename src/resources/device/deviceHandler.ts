/**
 * Device Resource Handler
 * Handles all device operations (list, get, create, update, delete)
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { BatchOperationResolver } from '../base/batchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMDevice } from '../../types/logicmonitor.js';
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
        idField: 'id',
        pluralKey: 'devices',
        linkBuilder: (portalUiBaseUrl, resource) => {
          const id = resource.id ?? resource.deviceId;
          return id != null ? getDeviceLink({ portalUiBaseUrl, deviceId: id as number | string }) : undefined;
        }
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMDevice>> {
    const validated = validateListDevices({ ...args, operation: 'list' as const });
    const { fields, filter, size, offset, autoPaginate, start, end, netflowFilter, includeDeletedResources } = validated;
    const fieldConfig = this.validateFields(fields);

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


    this.recordAndStore('list', result);

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
    const fieldConfig = this.validateFields(fields);

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


    this.recordAndStore('get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'device', deviceId, apiResult.data);

    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMDevice>> {
    const validated = validateCreateDevice(args);
    const isBatch = this.isBatchCreate(validated);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const devicesInput = this.normalizeCreateInput(validated);

    const batchResult = await this.processBatch(
      devicesInput,
      async (devicePayload) => this.client.createDevice(devicePayload as Parameters<LogicMonitorClient['createDevice']>[0]),
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

  
      this.recordAndStore('create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'device', createdDevice.id, createdDevice);

      return result;
    }

    const successfulDevices = this.extractSuccessfulItems(normalized);

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


    this.recordAndStore('create', result);

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


    this.recordAndStore('update', result);
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

    this.recordAndStore('delete', result);

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

    // Build update operations - merge item properties with args.updates overrides
    const updates = (args.updates || {}) as Record<string, unknown>;
    const updateOps = resolution.items.map(item => {
      const itemRecord = item as unknown as Record<string, unknown>;
      return {
        deviceId: itemRecord.deviceId || item.id,
        payload: { ...this.buildUpdatePayload(itemRecord), ...updates }
      };
    });

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
    const successfulDevices = this.extractSuccessfulItems(normalized);

    const result: OperationResult<LMDevice> = {
      success: batchResult.success,
      items: successfulDevices,
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

  /**
   * Handle batch delete operations
   */
  private async handleBatchDelete(args: DeleteOperationArgs): Promise<OperationResult<LMDevice>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);

    // Resolve items from various sources
    const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
      args,
      this.sessionContext,
      this.client,
      'device',
      'devices'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'delete');

    // Extract device IDs
    const deviceIds = resolution.items.map(item => ({
      deviceId: (item.deviceId || item.id) as number
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

    this.recordAndStore('delete', result);

    return result;
  }

  /**
   * Override normalizeCreateInput to apply device-specific field mapping.
   */
  protected override normalizeCreateInput(args: Record<string, unknown>): Array<Record<string, unknown>> {
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
}
