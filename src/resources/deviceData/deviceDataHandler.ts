/**
 * Device Data Resource Handler
 * Handles device datasources, instances, and metric data operations
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { batchProcessor } from '../../utils/batchProcessor.js';
import type {
  LMDeviceDatasource,
  LMDeviceDatasourceInstance,
  LMDeviceData,
  LMDeviceDataFormatted
} from '../../types/logicmonitor.js';
import type { OperationResult } from '../../types/operations.js';
import type { BatchResult, BatchItem } from '../../utils/batchProcessor.js';
import {
  validateListDatasources,
  validateListInstances,
  validateGetData
} from './deviceDataZodSchemas.js';

interface DeviceDataOperationArgs {
  operation: 'list_datasources' | 'list_instances' | 'get_data';
  [key: string]: unknown;
}

type DeviceDataType = LMDeviceDatasource | LMDeviceDatasourceInstance | LMDeviceDataFormatted;

export class DeviceDataHandler extends ResourceHandler<DeviceDataType> {
  constructor(
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    super(
      {
        resourceType: 'deviceData',
        resourceName: 'deviceData',
        idField: 'id'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  async handleOperation(args: DeviceDataOperationArgs): Promise<OperationResult<DeviceDataType>> {
    const { operation } = args;

    switch (operation) {
      case 'list_datasources':
        return this.handleListDatasources(args);
      case 'list_instances':
        return this.handleListInstances(args);
      case 'get_data':
        return this.handleGetData(args);
      default:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown operation: ${operation}`
        );
    }
  }

  /**
   * List datasources for a device
   */
  private async handleListDatasources(args: unknown): Promise<OperationResult<LMDeviceDatasource>> {
    const validated = validateListDatasources(args);
    const { deviceId, filter, size, offset, autoPaginate, fields, datasourceIncludeFilter, datasourceExcludeFilter } = validated;

    const apiResult = await this.client.listDeviceDatasources(deviceId, {
      filter,
      size,
      offset,
      autoPaginate,
      fields
    });

    let items = apiResult.items;

    // Apply datasource name filters if provided
    if (datasourceIncludeFilter) {
      const includePattern = new RegExp(
        '^' + datasourceIncludeFilter.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
        'i'
      );
      items = items.filter(ds => includePattern.test(ds.dataSourceName));
    }

    if (datasourceExcludeFilter) {
      const excludePattern = new RegExp(
        '^' + datasourceExcludeFilter.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
        'i'
      );
      items = items.filter(ds => !excludePattern.test(ds.dataSourceName));
    }

    const result: OperationResult<LMDeviceDatasource> = {
      success: true,
      total: items.length,
      items,
      request: {
        deviceId,
        filter,
        size,
        offset,
        fields,
        datasourceIncludeFilter,
        datasourceExcludeFilter
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('list_datasources', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceData', 'list_datasources', result);

    return result;
  }

  /**
   * List instances for a datasource
   */
  private async handleListInstances(args: unknown): Promise<OperationResult<LMDeviceDatasourceInstance>> {
    const validated = validateListInstances(args);
    const { deviceId, datasourceId, filter, size, offset, autoPaginate, fields } = validated;

    const apiResult = await this.client.listDeviceDatasourceInstances(deviceId, datasourceId, {
      filter,
      size,
      offset,
      autoPaginate,
      fields
    });

    const result: OperationResult<LMDeviceDatasourceInstance> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items,
      request: {
        deviceId,
        datasourceId,
        filter,
        size,
        offset,
        fields
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('list_instances', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceData', 'list_instances', result);

    return result;
  }

  /**
   * Get metric data for instance(s)
   */
  private async handleGetData(args: unknown): Promise<OperationResult<LMDeviceDataFormatted>> {
    const validated = validateGetData(args);
    const {
      deviceId,
      datasourceId,
      instanceId,
      instanceIds,
      startDate,
      endDate,
      start,
      end,
      datapoints,
      format,
      aggregate,
      batchOptions: rawBatchOptions
    } = validated;

    // Calculate time range - default to last 24 hours
    const now = Math.floor(Date.now() / 1000);
    const defaultStart = now - (24 * 60 * 60); // 24 hours ago

    let startEpoch: number;
    let endEpoch: number;

    if (startDate) {
      startEpoch = typeof startDate === 'string' ? Math.floor(new Date(startDate).getTime() / 1000) : startDate;
    } else if (start) {
      startEpoch = typeof start === 'string' ? Math.floor(new Date(start).getTime() / 1000) : start;
    } else {
      startEpoch = defaultStart;
    }

    if (endDate) {
      endEpoch = typeof endDate === 'string' ? Math.floor(new Date(endDate).getTime() / 1000) : endDate;
    } else if (end) {
      endEpoch = typeof end === 'string' ? Math.floor(new Date(end).getTime() / 1000) : end;
    } else {
      endEpoch = now;
    }

    // Prepare datapoints parameter
    let datapointsParam: string | undefined;
    if (datapoints) {
      datapointsParam = Array.isArray(datapoints) ? datapoints.join(',') : datapoints;
    }

    // Check if this is a batch operation (multiple instances)
    if (instanceIds && Array.isArray(instanceIds) && instanceIds.length > 1) {
      return this.handleBatchGetData(
        deviceId,
        datasourceId,
        instanceIds,
        startEpoch,
        endEpoch,
        datapointsParam,
        format,
        aggregate,
        rawBatchOptions
      );
    }

    // Single instance operation
    const instId = instanceId || (instanceIds && instanceIds[0]);
    
    if (!instId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Either instanceId or instanceIds must be provided'
      );
    }

    const apiResult = await this.client.getDeviceData(deviceId, datasourceId, instId, {
      start: startEpoch,
      end: endEpoch,
      datapoints: datapointsParam,
      format,
      aggregate
    });

    // Format the raw data into readable structure
    const formatted = this.formatDeviceData(
      deviceId,
      datasourceId,
      instId,
      apiResult.data
    );

    const result: OperationResult<LMDeviceDataFormatted> = {
      success: true,
      data: formatted,
      request: {
        deviceId,
        datasourceId,
        instanceId: instId,
        startEpoch,
        endEpoch,
        datapoints: datapointsParam
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('get_data', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceData', 'get_data', result);

    return result;
  }

  /**
   * Handle batch get data operations for multiple instances
   */
  private async handleBatchGetData(
    deviceId: number,
    datasourceId: number,
    instanceIds: number[],
    startEpoch: number,
    endEpoch: number,
    datapointsParam: string | undefined,
    format: string | undefined,
    aggregate: string | undefined,
    rawBatchOptions: unknown
  ): Promise<OperationResult<LMDeviceDataFormatted>> {
    const batchOptions = (rawBatchOptions as Record<string, unknown>) || {} as Record<string, unknown>;

    // Build batch operations
    const batchOps = instanceIds.map(instId => ({
      instanceId: instId,
      deviceId,
      datasourceId,
      startEpoch,
      endEpoch,
      datapointsParam,
      format,
      aggregate
    }));

    const batchResult = await batchProcessor.processBatch(
      batchOps,
      async (op) => {
        const apiResult = await this.client.getDeviceData(
          op.deviceId,
          op.datasourceId,
          op.instanceId,
          {
            start: op.startEpoch,
            end: op.endEpoch,
            datapoints: op.datapointsParam,
            format: op.format,
            aggregate: op.aggregate
          }
        );

        return this.formatDeviceData(
          op.deviceId,
          op.datasourceId,
          op.instanceId,
          apiResult.data
        );
      },
      {
        maxConcurrent: (batchOptions.maxConcurrent as number) || 5,
        continueOnError: (batchOptions.continueOnError as boolean) ?? true,
        retryOnRateLimit: true
      }
    );

    const normalized = this.normalizeBatchResults(batchResult as BatchResult<LMDeviceDataFormatted>);
    const successful = normalized.filter(entry => entry.success && entry.data);

    const result: OperationResult<LMDeviceDataFormatted> = {
      success: batchResult.success,
      items: successful
        .filter((entry): entry is typeof entry & { data: LMDeviceDataFormatted } => entry.data !== undefined)
        .map(entry => entry.data),
      summary: batchResult.summary,
      request: {
        deviceId,
        datasourceId,
        instanceIds,
        startEpoch,
        endEpoch,
        datapoints: datapointsParam,
        batch: true,
        batchOptions
      },
      results: normalized
    };

    this.storeInSession('get_data', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'deviceData', 'get_data', result);

    return result;
  }

  /**
   * Normalize batch results to consistent format
   */
  private normalizeBatchResults(batchResult: BatchResult<LMDeviceDataFormatted>): Array<BatchItem<LMDeviceDataFormatted>> {
    return batchResult.results.map((result, index) => ({
      index,
      success: result.success,
      data: result.success ? result.data : undefined,
      error: result.error,
      diagnostics: result.diagnostics
    }));
  }

  /**
   * Format raw device data into readable structure
   */
  private formatDeviceData(
    deviceId: number,
    datasourceId: number,
    instanceId: number,
    rawData: LMDeviceData
  ): LMDeviceDataFormatted {
    const dataPoints: Array<{
      timestampEpoch: number;
      timestampUTC: string;
      [datapoint: string]: number | string;
    }> = [];

    if (!rawData.time || !rawData.values || !rawData.dataPoints) {
      return {
        deviceId,
        deviceName: '',
        datasourceId,
        datasourceName: '',
        instanceId,
        instanceName: '',
        dataPoints: []
      };
    }

    // Convert raw data into structured format
    for (let i = 0; i < rawData.time.length; i++) {
      const timestamp = rawData.time[i];
      const dataPoint: Record<string, number | string> = {
        timestampEpoch: timestamp,
        timestampUTC: new Date(timestamp).toISOString()
      };

      // Add each metric value
      for (let j = 0; j < rawData.dataPoints.length; j++) {
        const metricName = rawData.dataPoints[j];
        const value = rawData.values[i]?.[j];
        dataPoint[metricName] = value !== null && value !== undefined ? value : 0;
      }

      dataPoints.push(dataPoint as { timestampEpoch: number; timestampUTC: string; [datapoint: string]: number | string });
    }

    return {
      deviceId,
      deviceName: '',
      datasourceId,
      datasourceName: '',
      instanceId,
      instanceName: '',
      dataPoints
    };
  }

  // Required abstract methods from ResourceHandler
  protected async handleList(_args: unknown): Promise<OperationResult<DeviceDataType>> {
    throw new McpError(
      ErrorCode.MethodNotFound,
      'Use list_datasources or list_instances operations instead'
    );
  }

  protected async handleGet(_args: unknown): Promise<OperationResult<DeviceDataType>> {
    throw new McpError(
      ErrorCode.MethodNotFound,
      'Use get_data operation instead'
    );
  }

  protected async handleCreate(_args: unknown): Promise<OperationResult<DeviceDataType>> {
    throw new McpError(
      ErrorCode.MethodNotFound,
      'Device data cannot be created via API'
    );
  }

  protected async handleUpdate(_args: unknown): Promise<OperationResult<DeviceDataType>> {
    throw new McpError(
      ErrorCode.MethodNotFound,
      'Device data cannot be updated via API'
    );
  }

  protected async handleDelete(_args: unknown): Promise<OperationResult<DeviceDataType>> {
    throw new McpError(
      ErrorCode.MethodNotFound,
      'Device data cannot be deleted via API'
    );
  }
}

