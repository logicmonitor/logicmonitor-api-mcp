import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../api/client.js';
import {
  listDevicesSchema,
  getDeviceSchema,
  createDeviceSchema,
  updateDeviceSchema,
  deleteDeviceSchema
} from '../utils/validation.js';
import { isBatchInput, normalizeToArray, extractBatchOptions } from '../utils/schemaHelpers.js';
import { batchProcessor, BatchItem, BatchResult } from '../utils/batchProcessor.js';
import { SessionContext } from '../session/sessionManager.js';
import { buildToolResponse, resolveReturnMode, ReturnMode } from '../utils/toolResponses.js';
import type { LMDevice } from '../types/logicmonitor.js';
import { LogicMonitorApiError } from '../api/errors.js';

export const deviceTools: Tool[] = [
  {
    name: 'lm_list_devices',
    description: 'List devices with optional filtering. Automatically paginates through all results if total exceeds requested size.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'LogicMonitor query syntax. Examples: "name:*villa*", "hostStatus:alive", "displayName:prod*". Wildcards and special characters will be automatically quoted. Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include).'
        },
        size: {
          type: 'number',
          description: 'Results per page (max: 1000)',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          description: 'Pagination offset',
          minimum: 0
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return (e.g., "id,displayName,hostStatus"). Use "*" for all fields.'
        },
        start: {
          type: 'number',
          description: 'Optional start epoch (milliseconds) for time range queries.'
        },
        end: {
          type: 'number',
          description: 'Optional end epoch (milliseconds) for time range queries.'
        },
        netflowFilter: {
          type: 'string',
          description: 'Netflow filter expression.'
        },
        includeDeletedResources: {
          type: 'boolean',
          description: 'Include deleted resources (default: false).'
        },
        returnMode: {
          type: 'string',
          enum: ['summary', 'raw', 'both'],
          description: 'Controls whether the tool returns summary data, raw API payload, or both (default).'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'lm_get_device',
    description: 'Get detailed information about a specific device.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: {
          type: 'number',
          description: 'The ID of the device to retrieve.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. Use "*" for all fields.'
        },
        start: {
          type: 'number',
          description: 'Optional start epoch (milliseconds) for time range queries.'
        },
        end: {
          type: 'number',
          description: 'Optional end epoch (milliseconds) for time range queries.'
        },
        netflowFilter: {
          type: 'string',
          description: 'Netflow filter expression to apply.'
        },
        needStcGrpAndSortedCP: {
          type: 'boolean',
          description: 'Include static group and sorted custom property information.'
        },
        returnMode: {
          type: 'string',
          enum: ['summary', 'raw', 'both'],
          description: 'Controls whether the tool returns summary data, raw API payload, or both (default).'
        }
      },
      required: ['deviceId'],
      additionalProperties: false
    }
  },
  {
    name: 'lm_create_device',
    description: 'Add a new device or multiple devices to monitoring.',
    inputSchema: {
      type: 'object',
      properties: {
        displayName: {
          type: 'string',
          description: 'Display name for the device (single mode).'
        },
        name: {
          type: 'string',
          description: 'Hostname or IP address (single mode).'
        },
        hostGroupIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of host group IDs (single mode).'
        },
        preferredCollectorId: {
          type: 'number',
          description: 'Preferred collector ID (single mode).'
        },
        disableAlerting: {
          type: 'boolean',
          description: 'Whether to disable alerting (single mode).'
        },
        properties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            },
            required: ['name', 'value'],
            additionalProperties: true
          },
          description: 'Custom properties (single mode).'
        },
        devices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              displayName: { type: 'string' },
              name: { type: 'string' },
              hostGroupIds: {
                type: 'array',
                items: { type: 'number' }
              },
              preferredCollectorId: { type: 'number' },
              disableAlerting: { type: 'boolean' },
              properties: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    value: { type: 'string' }
                  },
                  required: ['name', 'value'],
                  additionalProperties: true
                }
              }
            },
            required: ['displayName', 'name', 'hostGroupIds', 'preferredCollectorId'],
            additionalProperties: true
          },
          description: 'Array of devices to create (batch mode).'
        },
        batchOptions: {
          type: 'object',
          properties: {
            maxConcurrent: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              description: 'Maximum concurrent requests (default: 5).'
            },
            continueOnError: {
              type: 'boolean',
              description: 'Continue processing if some items fail (default: true).'
            }
          },
          description: 'Options for batch processing.'
        },
        returnMode: {
          type: 'string',
          enum: ['summary', 'raw', 'both'],
          description: 'Controls whether responses include summary data, raw API payload, or both (default).'
        }
      },
      additionalProperties: true
    }
  },
  {
    name: 'lm_update_device',
    description: 'Update one or more existing device configurations.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: {
          type: 'number',
          description: 'The ID of the device to update (single mode).'
        },
        displayName: {
          type: 'string',
          description: 'New display name for the device.'
        },
        hostGroupIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'New array of host group IDs.'
        },
        disableAlerting: {
          type: 'boolean',
          description: 'Whether to disable alerting.'
        },
        customProperties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            },
            required: ['name', 'value'],
            additionalProperties: true
          },
          description: 'Custom properties to update.'
        },
        devices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              deviceId: { type: 'number' },
              displayName: { type: 'string' },
              hostGroupIds: {
                type: 'array',
                items: { type: 'number' }
              },
              disableAlerting: { type: 'boolean' },
              customProperties: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    value: { type: 'string' }
                  },
                  required: ['name', 'value'],
                  additionalProperties: true
                }
              }
            },
            required: ['deviceId'],
            additionalProperties: true
          },
          description: 'Array of devices to update (batch mode).'
        },
        batchOptions: {
          type: 'object',
          properties: {
            maxConcurrent: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              description: 'Maximum concurrent requests (default: 5).'
            },
            continueOnError: {
              type: 'boolean',
              description: 'Continue processing if some items fail (default: true).'
            }
          },
          description: 'Options for batch processing.'
        },
        returnMode: {
          type: 'string',
          enum: ['summary', 'raw', 'both'],
          description: 'Controls whether responses include summary data, raw API payload, or both (default).'
        }
      },
      additionalProperties: true
    }
  },
  {
    name: 'lm_delete_device',
    description: 'Remove one or more devices from monitoring.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: {
          type: 'number',
          description: 'The ID of the device to delete (single mode).'
        },
        devices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              deviceId: {
                type: 'number',
                description: 'The ID of the device to delete.'
              }
            },
            required: ['deviceId'],
            additionalProperties: false
          },
          description: 'Array of devices to delete (batch mode).'
        },
        batchOptions: {
          type: 'object',
          properties: {
            maxConcurrent: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              description: 'Maximum concurrent requests (default: 5).'
            },
            continueOnError: {
              type: 'boolean',
              description: 'Continue processing if some items fail (default: true).'
            }
          },
          description: 'Options for batch processing.'
        },
        returnMode: {
          type: 'string',
          enum: ['summary', 'raw', 'both'],
          description: 'Controls whether responses include summary data, raw API payload, or both (default).'
        }
      },
      additionalProperties: false
    }
  }
];

const DEVICE_SAMPLE_SIZE = 5;

function summarizeDeviceListItem(device: LMDevice) {
  return {
    id: device.id,
    name: device.displayName ?? device.name,
    hostStatus: device.hostStatus,
    alertStatus: device.alertStatus
  };
}

function summarizeDevice(device: LMDevice) {
  const hostGroupIds =
    typeof device.hostGroupIds === 'string'
      ? device.hostGroupIds
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value))
      : device.hostGroupIds;

  return {
    id: device.id,
    name: device.displayName ?? device.name,
    hostStatus: device.hostStatus,
    alertStatus: device.alertStatus,
    collectorId: device.preferredCollectorId,
    hostGroupIds,
    createdOn: device.createdOn,
    updatedOn: device.updatedOn
  };
}

function mapCreateDeviceInput(input: any) {
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

function mapUpdateDeviceInput(input: any) {
  const {
    deviceId,
    properties,
    customProperties,
    ...rest
  } = input;

  const payload: Record<string, unknown> = { ...rest };

  if (Array.isArray(customProperties)) {
    payload.customProperties = customProperties;
  } else if (Array.isArray(properties)) {
    payload.customProperties = properties;
  }

  if (Array.isArray(input.hostGroupIds)) {
    payload.hostGroupIds = input.hostGroupIds;
  }

  return { deviceId, payload };
}

function normalizeBatchEntries<T>(batch: BatchResult<T>) {
  return batch.results.map((entry) => ({
    index: entry.index,
    success: entry.success,
    data: entry.data ?? null,
    error: entry.error,
    diagnostics: entry.diagnostics,
    meta: entry.meta,
    raw: entry.raw
  }));
}

function throwBatchFailure(action: string, entry: BatchItem<any>): never {
  const message = entry.error || `${action} failed`;
  if (entry.diagnostics) {
    throw new LogicMonitorApiError(message, {
      status: entry.diagnostics.status,
      code: entry.diagnostics.code,
      requestId: entry.diagnostics.requestId,
      requestUrl: entry.diagnostics.requestUrl,
      requestMethod: entry.diagnostics.requestMethod
    });
  }
  throw new Error(message);
}

export async function handleDeviceTool(
  toolName: string,
  args: any,
  client: LogicMonitorClient,
  sessionContext: SessionContext
): Promise<any> {
  switch (toolName) {
    case 'lm_list_devices': {
      const validated = await listDevicesSchema.validateAsync(args);
      const { returnMode, ...query } = validated as typeof validated & { returnMode?: ReturnMode };
      const mode = resolveReturnMode(returnMode);
      const apiResult = await client.listDevices(query);
      const requestParams = {
        ...query,
        fields: query.fields ?? '*'
      };
      const summary = {
        total: apiResult.total,
        returned: apiResult.items.length,
        searchId: apiResult.searchId ?? null,
        sample: apiResult.items.slice(0, DEVICE_SAMPLE_SIZE).map(summarizeDeviceListItem)
      };

      sessionContext.variables.lastDeviceList = {
        summary,
        raw: apiResult.raw,
        meta: apiResult.meta,
        request: requestParams
      };
      sessionContext.variables.lastDeviceListIds = apiResult.items.map((device) => device.id);

      return buildToolResponse({
        mode,
        summary,
        raw: apiResult.raw,
        meta: apiResult.meta,
        request: requestParams,
        extra: {
          total: apiResult.total,
          returned: apiResult.items.length,
          searchId: apiResult.searchId ?? undefined,
          items: mode === 'summary' ? summary.sample : apiResult.items
        }
      });
    }

    case 'lm_get_device': {
      const validated = await getDeviceSchema.validateAsync(args);
      const { deviceId, returnMode, ...options } = validated as typeof validated & { returnMode?: ReturnMode };
      const mode = resolveReturnMode(returnMode);
      const apiResult = await client.getDevice(deviceId, options);
      const summary = {
        ...summarizeDevice(apiResult.data),
        message: `Retrieved device ${apiResult.data.displayName ?? apiResult.data.name ?? deviceId}.`
      };

      sessionContext.variables.lastDevice = apiResult.data;
      sessionContext.variables.lastDeviceSummary = summary;
      sessionContext.variables.lastDeviceId = deviceId;

      return buildToolResponse({
        mode,
        summary,
        raw: apiResult.raw,
        meta: apiResult.meta,
        request: { deviceId, ...options },
        extra: {
          deviceId,
          device: mode === 'summary' ? summary : apiResult.data
        }
      });
    }

    case 'lm_create_device': {
      const validated = await createDeviceSchema.validateAsync(args);
      const mode = resolveReturnMode(validated.returnMode);
      const isBatch = isBatchInput(validated, 'devices');
      const batchOptions = extractBatchOptions(validated);
      const devicesInput = normalizeToArray(validated, 'devices');
      const mappedDevices = devicesInput.map(mapCreateDeviceInput);

      const batchResult = await batchProcessor.processBatch(
        mappedDevices,
        async (devicePayload) => client.createDevice(devicePayload),
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = normalizeBatchEntries(batchResult);

      if (!isBatch) {
        const entry = normalized[0];
        if (!entry || !entry.success || !entry.data) {
          throwBatchFailure('Device create', batchResult.results[0]);
        }
        const createdDevice = entry.data as LMDevice;
        sessionContext.variables.lastCreatedDevice = createdDevice;
        const summary = {
          ...summarizeDevice(createdDevice),
          message: `Device '${createdDevice.displayName ?? createdDevice.name}' created successfully.`
        };

        return buildToolResponse({
          mode,
          summary,
          raw: entry.raw ?? createdDevice,
          meta: entry.meta,
          request: mappedDevices[0],
          extra: {
            success: true
          }
        });
      }

      const successful = normalized.filter((entry) => entry.success && entry.data);
      sessionContext.variables.lastCreatedDevices = successful.map((entry) => entry.data as LMDevice);

      const summary = {
        total: batchResult.summary.total,
        succeeded: batchResult.summary.succeeded,
        failed: batchResult.summary.failed,
        sample: successful
          .slice(0, DEVICE_SAMPLE_SIZE)
          .map((entry) => summarizeDevice(entry.data as LMDevice))
      };

      return buildToolResponse({
        mode,
        summary,
        raw: {
          success: batchResult.success,
          summary: batchResult.summary,
          results: normalized
        },
        request: {
          batch: true,
          batchOptions,
          devices: mappedDevices
        },
        diagnostics: normalized
          .filter((entry) => !entry.success)
          .map((entry) => ({
            index: entry.index,
            error: entry.error,
            diagnostics: entry.diagnostics
          })),
        extra: {
          success: batchResult.success,
          results: normalized
        }
      });
    }

    case 'lm_update_device': {
      const validated = await updateDeviceSchema.validateAsync(args);
      const mode = resolveReturnMode(validated.returnMode);
      const isBatch = isBatchInput(validated, 'devices');
      const batchOptions = extractBatchOptions(validated);
      const devicesInput = normalizeToArray(validated, 'devices');
      const mappedDevices = devicesInput.map(mapUpdateDeviceInput);

      const batchResult = await batchProcessor.processBatch(
        mappedDevices,
        async ({ deviceId, payload }) => client.updateDevice(deviceId, payload),
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = normalizeBatchEntries(batchResult);

      if (!isBatch) {
        const entry = normalized[0];
        if (!entry || !entry.success || !entry.data) {
          throwBatchFailure('Device update', batchResult.results[0]);
        }
        const updatedDevice = entry.data as LMDevice;
        sessionContext.variables.lastUpdatedDevice = updatedDevice;
        const summary = {
          ...summarizeDevice(updatedDevice),
          message: `Device '${updatedDevice.displayName ?? updatedDevice.name}' updated successfully.`
        };

        return buildToolResponse({
          mode,
          summary,
          raw: entry.raw ?? updatedDevice,
          meta: entry.meta,
          request: { deviceId: mappedDevices[0].deviceId, ...mappedDevices[0].payload },
          extra: {
            success: true
          }
        });
      }

      const successful = normalized.filter((entry) => entry.success && entry.data);
      sessionContext.variables.lastUpdatedDevices = successful.map((entry) => entry.data as LMDevice);

      const summary = {
        total: batchResult.summary.total,
        succeeded: batchResult.summary.succeeded,
        failed: batchResult.summary.failed,
        sample: successful
          .slice(0, DEVICE_SAMPLE_SIZE)
          .map((entry) => summarizeDevice(entry.data as LMDevice))
      };

      return buildToolResponse({
        mode,
        summary,
        raw: {
          success: batchResult.success,
          summary: batchResult.summary,
          results: normalized
        },
        request: {
          batch: true,
          batchOptions,
          devices: mappedDevices.map((entry) => ({
            deviceId: entry.deviceId,
            ...entry.payload
          }))
        },
        diagnostics: normalized
          .filter((entry) => !entry.success)
          .map((entry) => ({
            index: entry.index,
            error: entry.error,
            diagnostics: entry.diagnostics
          })),
        extra: {
          success: batchResult.success,
          results: normalized
        }
      });
    }

    case 'lm_delete_device': {
      const validated = await deleteDeviceSchema.validateAsync(args);
      const mode = resolveReturnMode(validated.returnMode);
      const isBatch = isBatchInput(validated, 'devices');
      const batchOptions = extractBatchOptions(validated);
      const devicesInput = normalizeToArray(validated, 'devices');
      const mappedDevices = devicesInput.map((device) => ({ deviceId: device.deviceId }));

      const batchResult = await batchProcessor.processBatch(
        mappedDevices,
        async ({ deviceId }) => client.deleteDevice(deviceId),
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = normalizeBatchEntries(batchResult);

      if (!isBatch) {
        const entry = normalized[0];
        if (!entry || !entry.success || !entry.data) {
          throwBatchFailure('Device delete', batchResult.results[0]);
        }
        const deletedId = (entry.data as { deviceId: number }).deviceId;
        sessionContext.variables.lastDeletedDeviceId = deletedId;
        const summary = {
          deviceId: deletedId,
          message: `Device ${deletedId} deleted successfully.`
        };

        return buildToolResponse({
          mode,
          summary,
          raw: entry.raw ?? entry.data,
          meta: entry.meta,
          request: { deviceId: deletedId },
          extra: {
            success: true
          }
        });
      }

      const successfulIds = normalized
        .filter((entry) => entry.success && entry.data)
        .map((entry) => (entry.data as { deviceId: number }).deviceId);

      sessionContext.variables.lastDeletedDeviceIds = successfulIds;

      const summary = {
        total: batchResult.summary.total,
        succeeded: batchResult.summary.succeeded,
        failed: batchResult.summary.failed,
        deletedIds: successfulIds
      };

      return buildToolResponse({
        mode,
        summary,
        raw: {
          success: batchResult.success,
          summary: batchResult.summary,
          results: normalized
        },
        request: {
          batch: true,
          batchOptions,
          devices: mappedDevices
        },
        diagnostics: normalized
          .filter((entry) => !entry.success)
          .map((entry) => ({
            index: entry.index,
            error: entry.error,
            diagnostics: entry.diagnostics
          })),
        extra: {
          success: batchResult.success,
          results: normalized
        }
      });
    }

    default:
      throw new Error(`Unknown device tool: ${toolName}`);
  }
}
