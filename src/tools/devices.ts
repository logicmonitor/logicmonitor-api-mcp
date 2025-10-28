import { McpError, Tool, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../api/client.js';
import {
  listDevicesSchema,
  getDeviceSchema,
  createDeviceSchema,
  updateDeviceSchema,
  deleteDeviceSchema
} from '../utils/validation.js';
import { isBatchInput, normalizeToArray, extractBatchOptions } from '../utils/schemaHelpers.js';
import { batchProcessor, BatchResult } from '../utils/batchProcessor.js';
import { SessionContext } from '../session/sessionManager.js';
import type { LMDevice } from '../types/logicmonitor.js';
import { sanitizeFields } from '../utils/fieldMetadata.js';
import { throwBatchFailure } from '../utils/batchUtils.js';


export const deviceTools: Tool[] = [
  {
    name: 'lm_list_devices',
    description: 'List devices with optional filtering. Automatically paginates through all results if total exceeds requested size.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'LogicMonitor query syntax. Examples: "name:*villa*", "hostStatus:alive", "displayName:prod*". Wildcards and special characters will be automatically quoted. Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include). Only field names listed in health://logicmonitor/fields/device are accepted.'
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
          description: 'Comma-separated list of fields to return (e.g., "id,displayName,hostStatus"). Use "*" for all fields. See resource health://logicmonitor/fields/device for the complete list.'
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
          description: 'Comma-separated list of fields to return. Use "*" for all fields. See resource health://logicmonitor/fields/device for the complete list.'
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
        }
      },
      additionalProperties: false
    }
  }
];

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

export async function handleDeviceTool(
  toolName: string,
  args: any,
  client: LogicMonitorClient,
  sessionContext: SessionContext
): Promise<any> {
  switch (toolName) {
    case 'lm_list_devices': {
      const validated = await listDevicesSchema.validateAsync(args);
      const { fields, ...rest } = validated;
      const fieldConfig = sanitizeFields('device', fields);

      if (fieldConfig.invalid.length > 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown device field(s): ${fieldConfig.invalid.join(', ')}`
        );
      }

      const query = {
        ...rest,
        fields: fieldConfig.fieldsParam
      };

      const apiResult = await client.listDevices(query);

      const response = {
        total: apiResult.total,
        items: apiResult.items as LMDevice[],
        request: {
          ...rest,
          fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
        },
        meta: apiResult.meta,
        raw: apiResult.raw
      };

      sessionContext.variables.lastDeviceList = response;
      sessionContext.variables.lastDeviceListIds = apiResult.items.map((device) => device.id);

      return response;
    }

    case 'lm_get_device': {
      const validated = await getDeviceSchema.validateAsync(args);
      const { deviceId, fields, ...options } = validated;
      const fieldConfig = sanitizeFields('device', fields);

      if (fieldConfig.invalid.length > 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown device field(s): ${fieldConfig.invalid.join(', ')}`
        );
      }

      const apiResult = await client.getDevice(deviceId, {
        ...options,
        fields: fieldConfig.fieldsParam
      });

      const response = {
        device: apiResult.data,
        request: {
          deviceId,
          ...options,
          fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
        },
        meta: apiResult.meta,
        raw: apiResult.raw
      };

      sessionContext.variables.lastDevice = apiResult.data;
      sessionContext.variables.lastDeviceId = deviceId;

      return response;
    }

    case 'lm_create_device': {
      const validated = await createDeviceSchema.validateAsync(args);
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
        return {
          success: true,
          device: createdDevice,
          raw: entry.raw ?? createdDevice,
          meta: entry.meta ?? null
        };
      }

      const successful = normalized.filter((entry) => entry.success && entry.data);
      sessionContext.variables.lastCreatedDevices = successful.map((entry) => entry.data as LMDevice);

      return {
        success: batchResult.success,
        summary: batchResult.summary,
        request: {
          batch: true,
          batchOptions,
          devices: mappedDevices
        },
        results: normalized
      };
    }

    case 'lm_update_device': {
      const validated = await updateDeviceSchema.validateAsync(args);
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
        return {
          success: true,
          device: updatedDevice,
          raw: entry.raw ?? updatedDevice,
          meta: entry.meta ?? null
        };
      }

      const successful = normalized.filter((entry) => entry.success && entry.data);
      sessionContext.variables.lastUpdatedDevices = successful.map((entry) => entry.data as LMDevice);

      return {
        success: batchResult.success,
        summary: batchResult.summary,
        request: {
          batch: true,
          batchOptions,
          devices: mappedDevices.map((entry) => ({
            deviceId: entry.deviceId,
            ...entry.payload
          }))
        },
        results: normalized
      };
    }

    case 'lm_delete_device': {
      const validated = await deleteDeviceSchema.validateAsync(args);
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
        return {
          success: true,
          deviceId: deletedId,
          raw: entry.raw ?? entry.data,
          meta: entry.meta ?? null
        };
      }

      const successfulIds = normalized
        .filter((entry) => entry.success && entry.data)
        .map((entry) => (entry.data as { deviceId: number }).deviceId);

      sessionContext.variables.lastDeletedDeviceIds = successfulIds;

      return {
        success: batchResult.success,
        summary: batchResult.summary,
        request: {
          batch: true,
          batchOptions,
          devices: mappedDevices
        },
        results: normalized
      };
    }

    default:
      throw new Error(`Unknown device tool: ${toolName}`);
  }
}
