/**
 * Device Group Resource Handler
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/ResourceHandler.js';
import { BatchOperationResolver } from '../base/BatchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { batchProcessor } from '../../utils/batchProcessor.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMDeviceGroup } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import {
  validateListDeviceGroups,
  validateGetDeviceGroup,
  validateCreateDeviceGroup,
  validateUpdateDeviceGroup,
  validateDeleteDeviceGroup
} from './deviceGroupSchemas.js';

export class DeviceGroupHandler extends ResourceHandler<LMDeviceGroup> {
  constructor(
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    super(
      {
        resourceType: 'deviceGroup',
        resourceName: 'deviceGroup',
        idField: 'id'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMDeviceGroup>> {
    const validated = validateListDeviceGroups(args);
    const { fields, filter, size, offset } = validated;
    const fieldConfig = sanitizeFields('deviceGroup', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown device group field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.listDeviceGroups({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset
    });

    const result: OperationResult<LMDeviceGroup> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMDeviceGroup[],
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
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceGroup', 'list', result);

    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMDeviceGroup>> {
    const validated = validateGetDeviceGroup(args);
    const groupId = validated.id ?? this.resolveId(validated);
    
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Device group ID must be a number');
    }

    const { fields } = validated;
    const fieldConfig = sanitizeFields('deviceGroup', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown device group field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.getDeviceGroup(groupId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMDeviceGroup> = {
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
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceGroup', 'get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'deviceGroup', groupId, apiResult.data);

    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMDeviceGroup>> {
    const validated = validateCreateDeviceGroup(args);
    const isBatch = !!((validated as any).groups && Array.isArray((validated as any).groups));
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const groupsInput = isBatch ? (validated as any).groups : [validated];

    const batchResult = await batchProcessor.processBatch(
      groupsInput,
      async (group: any) => this.client.createDeviceGroup(group),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    if (!isBatch) {
      const entry = batchResult.results[0];
      if (!entry || !entry.success || !entry.data) {
        throwBatchFailure('Device group create', entry);
      }

      const result: OperationResult<LMDeviceGroup> = {
        success: true,
        data: entry.data as LMDeviceGroup,
        raw: entry.raw,
        meta: entry.meta
      };

      this.storeInSession('create', result);
      this.sessionManager.recordOperation(this.sessionContext.id, 'deviceGroup', 'create', result);

      return result;
    }

    const successful = batchResult.results.filter(r => r.success && r.data);
    
    const result: OperationResult<LMDeviceGroup> = {
      success: batchResult.success,
      items: successful.map(r => r.data as LMDeviceGroup),
      summary: batchResult.summary,
      results: batchResult.results
    };

    this.storeInSession('create', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceGroup', 'create', result);

    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMDeviceGroup>> {
    const validated = validateUpdateDeviceGroup(args);

    if (BatchOperationResolver.isBatchOperation(validated, 'groups')) {
      return this.handleBatchUpdate(validated);
    }

    const groupId = validated.id ?? this.resolveId(validated);
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Device group ID must be a number');
    }

    const { id: _id, operation: _operation, groups: _groups, applyToPrevious: _applyToPrevious, filter: _filter, batchOptions: _batchOptions, ...updates } = validated;
    const apiResult = await this.client.updateDeviceGroup(groupId, updates);

    const result: OperationResult<LMDeviceGroup> = {
      success: true,
      data: apiResult.data,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceGroup', 'update', result);

    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMDeviceGroup>> {
    const validated = validateDeleteDeviceGroup(args);

    if (BatchOperationResolver.isBatchOperation(validated as any, 'groups')) {
      return this.handleBatchDelete(validated);
    }

    const groupId = validated.id ?? this.resolveId(validated);
    if (typeof groupId !== 'number') {
      throw new McpError(ErrorCode.InvalidParams, 'Device group ID must be a number');
    }

    const apiResult = await this.client.deleteDeviceGroup(groupId, {
      deleteChildren: (validated as any).deleteChildren ?? false
    });

    const result: OperationResult<LMDeviceGroup> = {
      success: true,
      data: { groupId, deleteChildren: (validated as any).deleteChildren ?? false } as any,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceGroup', 'delete', result);

    return result;
  }

  private async handleBatchUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMDeviceGroup>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    const resolution = await BatchOperationResolver.resolveItems<any>(
      args,
      this.sessionContext,
      this.client,
      'deviceGroup',
      'groups'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'update');

    const updateOps = resolution.items.map((item: any) => ({
      groupId: item.id || item.groupId,
      updates: args.updates || item
    }));

    const batchResult = await batchProcessor.processBatch(
      updateOps,
      async ({ groupId, updates }) => this.client.updateDeviceGroup(groupId, updates),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const result: OperationResult<LMDeviceGroup> = {
      success: batchResult.success,
      items: batchResult.results.filter(r => r.success && r.data).map(r => r.data as LMDeviceGroup),
      summary: batchResult.summary,
      results: batchResult.results
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceGroup', 'update', result);

    return result;
  }

  private async handleBatchDelete(args: DeleteOperationArgs): Promise<OperationResult<LMDeviceGroup>> {
    const batchOptions = BatchOperationResolver.extractBatchOptions(args);
    const resolution = await BatchOperationResolver.resolveItems<any>(
      args,
      this.sessionContext,
      this.client,
      'deviceGroup',
      'groups'
    );

    BatchOperationResolver.validateBatchSafety(resolution, 'delete');

    const deleteOps = resolution.items.map((item: any) => ({
      groupId: item.id || item.groupId,
      deleteChildren: (args as any).deleteChildren ?? false
    }));

    const batchResult = await batchProcessor.processBatch(
      deleteOps,
      async ({ groupId, deleteChildren }) => this.client.deleteDeviceGroup(groupId, { deleteChildren }),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const result: OperationResult<LMDeviceGroup> = {
      success: batchResult.success,
      summary: batchResult.summary,
      results: batchResult.results as any
    };

    this.storeInSession('delete', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceGroup', 'delete', result);

    return result;
  }
}

