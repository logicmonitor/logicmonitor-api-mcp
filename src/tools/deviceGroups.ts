import { ErrorCode, McpError, Tool } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../api/client.js';
import {
  listDeviceGroupsSchema,
  getDeviceGroupSchema,
  createDeviceGroupSchema,
  updateDeviceGroupSchema,
  deleteDeviceGroupSchema
} from '../utils/validation.js';
import { batchProcessor } from '../utils/batchProcessor.js';
import { extractBatchOptions, isBatchInput, normalizeToArray } from '../utils/schemaHelpers.js';
import { SessionContext } from '../session/sessionManager.js';
import { sanitizeFields } from '../utils/fieldMetadata.js';
import { throwBatchFailure } from '../utils/batchUtils.js';
import type { LMDeviceGroup } from '../types/logicmonitor.js';

export const deviceGroupTools: Tool[] = [
  {
    name: 'lm_list_device_groups',
    description: 'List device groups with optional filtering. Automatically paginates through all results if the total exceeds the requested size.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'LogicMonitor query syntax. Examples: "name:*server*", "parentId:1". Wildcards and special characters will be automatically quoted. Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include). Only field names listed in health://logicmonitor/fields/device_group are accepted.'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          description: 'Results per page (max: 1000).'
        },
        offset: {
          type: 'number',
          minimum: 0,
          description: 'Pagination offset.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. Use "*" for all fields. See resource health://logicmonitor/fields/device_group for the complete list.'
        },
        parentId: {
          type: 'number',
          description: 'Filter groups by parent ID.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'lm_get_device_group',
    description: 'Get detailed information about a device group.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'number',
          description: 'The ID of the device group to retrieve.'
        }
      },
      required: ['groupId'],
      additionalProperties: false
    }
  },
  {
    name: 'lm_create_device_group',
    description: 'Create new device group(s). Supports both single and batch operations.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Group name (single mode).' },
        parentId: { type: 'number', description: 'Parent group ID (1 = root).' },
        description: { type: 'string', description: 'Group description.' },
        appliesTo: { type: 'string', description: 'Dynamic group query expression.' },
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
          description: 'Custom properties to assign.'
        },
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              parentId: { type: 'number' },
              description: { type: 'string' },
              appliesTo: { type: 'string' },
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
            required: ['name', 'parentId'],
            additionalProperties: true
          },
          description: 'Array of device groups to create (batch mode).'
        },
        batchOptions: {
          type: 'object',
          properties: {
            maxConcurrent: {
              type: 'number',
              minimum: 1,
              maximum: 20,
              description: 'Maximum concurrent operations (default: 5).'
            },
            continueOnError: {
              type: 'boolean',
              description: 'Continue processing on errors (default: true).'
            }
          }
        }
      },
      additionalProperties: true
    }
  },
  {
    name: 'lm_update_device_group',
    description: 'Update existing device group(s). Supports both single and batch operations.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'number', description: 'Group ID to update (single mode).' },
        name: { type: 'string', description: 'New group name.' },
        description: { type: 'string', description: 'New description.' },
        appliesTo: { type: 'string', description: 'Updated dynamic group query.' },
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
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              groupId: { type: 'number' },
              name: { type: 'string' },
              description: { type: 'string' },
              appliesTo: { type: 'string' },
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
            required: ['groupId'],
            additionalProperties: true
          },
          description: 'Array of groups to update (batch mode).'
        },
        batchOptions: {
          type: 'object',
          properties: {
            maxConcurrent: {
              type: 'number',
              minimum: 1,
              maximum: 20,
              description: 'Maximum concurrent operations (default: 5).'
            },
            continueOnError: {
              type: 'boolean',
              description: 'Continue processing on errors (default: true).'
            }
          }
        }
      },
      additionalProperties: true
    }
  },
  {
    name: 'lm_delete_device_group',
    description: 'Delete device group(s). Supports both single and batch operations.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'number', description: 'Group ID to delete (single mode).' },
        deleteChildren: {
          type: 'boolean',
          description: 'Remove child groups when deleting (default: false).'
        },
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              groupId: { type: 'number' },
              deleteChildren: { type: 'boolean' }
            },
            required: ['groupId'],
            additionalProperties: true
          },
          description: 'Array of group deletions (batch mode).'
        },
        batchOptions: {
          type: 'object',
          properties: {
            maxConcurrent: {
              type: 'number',
              minimum: 1,
              maximum: 20,
              description: 'Maximum concurrent operations (default: 5).'
            },
            continueOnError: {
              type: 'boolean',
              description: 'Continue processing on errors (default: true).'
            }
          }
        }
      },
      additionalProperties: true
    }
  }
];

export async function handleDeviceGroupTool(
  toolName: string,
  args: any,
  client: LogicMonitorClient,
  sessionContext: SessionContext
): Promise<any> {
  switch (toolName) {
    case 'lm_list_device_groups': {
      const validated = await listDeviceGroupsSchema.validateAsync(args);
      const { fields, ...rest } = validated;
      const fieldConfig = sanitizeFields('deviceGroup', fields);

      if (fieldConfig.invalid.length > 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown device group field(s): ${fieldConfig.invalid.join(', ')}`
        );
      }

      const apiResult = await client.listDeviceGroups({
        ...rest,
        fields: fieldConfig.fieldsParam
      });

      const response = {
        total: apiResult.total,
        items: apiResult.items as LMDeviceGroup[],
        request: {
          ...rest,
          fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
        },
        meta: apiResult.meta,
        raw: apiResult.raw
      };

      sessionContext.variables.lastDeviceGroupList = response;

      return response;
    }

    case 'lm_get_device_group': {
      const validated = await getDeviceGroupSchema.validateAsync(args);
      const groupResult = await client.getDeviceGroup(validated.groupId);

      const response = {
        group: groupResult.data,
        meta: groupResult.meta,
        raw: groupResult.raw
      };

      sessionContext.variables.lastDeviceGroup = response;
      sessionContext.variables.lastDeviceGroupId = validated.groupId;

      return response;
    }

    case 'lm_create_device_group': {
      const validated = await createDeviceGroupSchema.validateAsync(args);
      const isBatch = isBatchInput(validated, 'groups');
      const groups = normalizeToArray(validated, 'groups');
      const batchOptions = extractBatchOptions(validated);

      const result = await batchProcessor.processBatch(
        groups,
        async (group) => {
          const created = await client.createDeviceGroup(group);
          return created;
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      if (!isBatch) {
        const singleResult = result.results[0];
        if (!singleResult.success) {
          throwBatchFailure('Device group create', singleResult);
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for created device group.');
        }
        const groupCreated = singleResult.data as LMDeviceGroup;
        sessionContext.variables.lastCreatedDeviceGroup = groupCreated;
        return {
          success: true,
          group: groupCreated,
          raw: singleResult.raw ?? groupCreated,
          meta: singleResult.meta ?? null
        };
      }

      sessionContext.variables.lastCreatedDeviceGroups = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data as LMDeviceGroup);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          group: entry.data ? (entry.data as LMDeviceGroup) : null,
          error: entry.error,
          raw: entry.raw ?? null,
          meta: entry.meta ?? null
        }))
      };
    }

    case 'lm_update_device_group': {
      const validated = await updateDeviceGroupSchema.validateAsync(args);
      const isBatch = isBatchInput(validated, 'groups');
      const groups = normalizeToArray(validated, 'groups');
      const batchOptions = extractBatchOptions(validated);

      const result = await batchProcessor.processBatch(
        groups,
        async (group) => {
          const { groupId, ...updates } = group as Record<string, any>;
          const updated = await client.updateDeviceGroup(groupId, updates);
          return updated;
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      if (!isBatch) {
        const singleResult = result.results[0];
        if (!singleResult.success) {
          throwBatchFailure('Device group update', singleResult);
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for updated device group.');
        }
        const updatedGroup = singleResult.data as LMDeviceGroup;
        sessionContext.variables.lastUpdatedDeviceGroup = updatedGroup;
        return {
          success: true,
          group: updatedGroup,
          raw: singleResult.raw ?? updatedGroup,
          meta: singleResult.meta ?? null
        };
      }

      sessionContext.variables.lastUpdatedDeviceGroups = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data as LMDeviceGroup);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          group: entry.data ? (entry.data as LMDeviceGroup) : null,
          error: entry.error,
          raw: entry.raw ?? null,
          meta: entry.meta ?? null
        }))
      };
    }

    case 'lm_delete_device_group': {
      const validated = await deleteDeviceGroupSchema.validateAsync(args);
      const isBatch = isBatchInput(validated, 'groups');
      const groups = normalizeToArray(validated, 'groups');
      const batchOptions = extractBatchOptions(validated);

      const result = await batchProcessor.processBatch(
        groups,
        async (group) => {
          await client.deleteDeviceGroup(group.groupId, { deleteChildren: group.deleteChildren });
          return { groupId: group.groupId, deleteChildren: group.deleteChildren ?? false };
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      if (!isBatch) {
        const singleResult = result.results[0];
        if (!singleResult.success) {
          throwBatchFailure('Device group delete', singleResult);
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for deleted device group.');
        }
        const deletedGroup = singleResult.data as { groupId: number; deleteChildren: boolean };
        sessionContext.variables.lastDeletedDeviceGroupId = deletedGroup.groupId;
        return {
          success: true,
          groupId: deletedGroup.groupId,
          raw: singleResult.raw ?? deletedGroup,
          meta: singleResult.meta ?? null
        };
      }

      sessionContext.variables.lastDeletedDeviceGroupIds = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data!.groupId);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          groupId: entry.data?.groupId ?? null,
          error: entry.error,
          raw: entry.raw ?? null,
          meta: entry.meta ?? null
        }))
      };
    }

    default:
      throw new Error(`Unknown device group tool: ${toolName}`);
  }
}
