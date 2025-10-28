import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../api/client.js';
import {
  listWebsiteGroupsSchema,
  getWebsiteGroupSchema,
  createWebsiteGroupSchema,
  updateWebsiteGroupSchema,
  deleteWebsiteGroupSchema
} from '../utils/validation.js';
import { batchProcessor } from '../utils/batchProcessor.js';
import { extractBatchOptions, isBatchInput, normalizeToArray } from '../utils/schemaHelpers.js';
import { SessionContext } from '../session/sessionManager.js';

export const websiteGroupTools: Tool[] = [
  {
    name: 'lm_list_website_groups',
    description: 'List website groups with optional filtering and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'LogicMonitor filter syntax for website groups.'
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
          description: 'Comma-separated list of fields to return. Use "*" for all fields.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'lm_get_website_group',
    description: 'Retrieve detailed information about a website group.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'number',
          description: 'Website group ID.'
        }
      },
      required: ['groupId'],
      additionalProperties: false
    }
  },
  {
    name: 'lm_create_website_group',
    description: 'Create website group(s). Supports single and batch operations.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Group name (single mode).' },
        parentId: { type: 'number', description: 'Parent group ID.' },
        description: { type: 'string' },
        disableAlerting: { type: 'boolean' },
        stopMonitoring: { type: 'boolean' },
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
        },
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              parentId: { type: 'number' },
              description: { type: 'string' },
              disableAlerting: { type: 'boolean' },
              stopMonitoring: { type: 'boolean' },
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
          }
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
            continueOnError: { type: 'boolean' }
          }
        }
      },
      additionalProperties: true
    }
  },
  {
    name: 'lm_update_website_group',
    description: 'Update website group(s). Supports single and batch operations.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'number', description: 'Website group ID (single mode).' },
        name: { type: 'string' },
        description: { type: 'string' },
        disableAlerting: { type: 'boolean' },
        stopMonitoring: { type: 'boolean' },
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
        },
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              groupId: { type: 'number' },
              name: { type: 'string' },
              description: { type: 'string' },
              disableAlerting: { type: 'boolean' },
              stopMonitoring: { type: 'boolean' },
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
            required: ['groupId'],
            additionalProperties: true
          }
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
            continueOnError: { type: 'boolean' }
          }
        }
      },
      additionalProperties: true
    }
  },
  {
    name: 'lm_delete_website_group',
    description: 'Delete website group(s). Supports single and batch operations.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'number', description: 'Website group ID (single mode).' },
        deleteChildren: { type: 'boolean', description: 'Remove child groups as well.' },
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
          }
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
            continueOnError: { type: 'boolean' }
          }
        }
      },
      additionalProperties: true
    }
  }
];

export async function handleWebsiteGroupTool(
  toolName: string,
  args: any,
  client: LogicMonitorClient,
  sessionContext: SessionContext
): Promise<any> {
  switch (toolName) {
    case 'lm_list_website_groups': {
      const validated = await listWebsiteGroupsSchema.validateAsync(args);
      const result = await client.listWebsiteGroups(validated);
      const payload = {
        total: result.total ?? result.items?.length ?? 0,
        items: result.items ?? [],
        searchId: result.searchId,
        request: {
          filter: validated.filter,
          fields: validated.fields,
          offset: validated.offset ?? 0,
          size: validated.size ?? (result.items?.length ?? 0)
        }
      };

      sessionContext.variables.lastWebsiteGroupList = payload.items;
      sessionContext.variables.lastWebsiteGroupListMetadata = payload.request;

      return {
        ...payload,
        summary: `Retrieved ${payload.items.length} website group(s).`
      };
    }

    case 'lm_get_website_group': {
      const validated = await getWebsiteGroupSchema.validateAsync(args);
      const groupResult = await client.getWebsiteGroup(validated.groupId);
      const group = groupResult.data;
      sessionContext.variables.lastWebsiteGroup = group;
      sessionContext.variables.lastWebsiteGroupId = validated.groupId;
      return group;
    }

    case 'lm_create_website_group': {
      const validated = await createWebsiteGroupSchema.validateAsync(args);
      const isBatch = isBatchInput(validated, 'groups');
      const groups = normalizeToArray(validated, 'groups');
      const batchOptions = extractBatchOptions(validated);

      const result = await batchProcessor.processBatch(
        groups,
        async (group) => {
          const created = await client.createWebsiteGroup(group as any);
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
          throw new Error(singleResult.error || 'Failed to create website group');
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for created website group.');
        }
        const groupCreated = singleResult.data;
        sessionContext.variables.lastCreatedWebsiteGroup = groupCreated;
        return {
          success: true,
          group: groupCreated,
          message: `Website group '${groupCreated?.name}' created successfully.`
        };
      }

      sessionContext.variables.lastCreatedWebsiteGroups = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data!);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          group: entry.data ?? null,
          error: entry.error
        }))
      };
    }

    case 'lm_update_website_group': {
      const validated = await updateWebsiteGroupSchema.validateAsync(args);
      const isBatch = isBatchInput(validated, 'groups');
      const groups = normalizeToArray(validated, 'groups');
      const batchOptions = extractBatchOptions(validated);

      const result = await batchProcessor.processBatch(
        groups,
        async (group) => {
          const { groupId, ...updates } = group as Record<string, any>;
          const updated = await client.updateWebsiteGroup(groupId, updates);
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
          throw new Error(singleResult.error || 'Failed to update website group');
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for updated website group.');
        }
        const groupUpdated = singleResult.data;
        sessionContext.variables.lastUpdatedWebsiteGroup = groupUpdated;
        return {
          success: true,
          group: groupUpdated,
          message: `Website group '${groupUpdated?.name}' updated successfully.`
        };
      }

      sessionContext.variables.lastUpdatedWebsiteGroups = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data!);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          group: entry.data ?? null,
          error: entry.error
        }))
      };
    }

    case 'lm_delete_website_group': {
      const validated = await deleteWebsiteGroupSchema.validateAsync(args);
      const isBatch = isBatchInput(validated, 'groups');
      const groups = normalizeToArray(validated, 'groups');
      const batchOptions = extractBatchOptions(validated);

      const result = await batchProcessor.processBatch(
        groups,
        async (group) => {
          await client.deleteWebsiteGroup(group.groupId, { deleteChildren: group.deleteChildren });
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
          throw new Error(singleResult.error || 'Failed to delete website group');
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for deleted website group.');
        }
        const deletedGroup = singleResult.data;
        sessionContext.variables.lastDeletedWebsiteGroupId = deletedGroup.groupId;
        return {
          success: true,
          groupId: deletedGroup.groupId,
          message: `Website group ${deletedGroup.groupId} deleted successfully.`
        };
      }

      sessionContext.variables.lastDeletedWebsiteGroupIds = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data!.groupId);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          groupId: entry.data?.groupId ?? null,
          error: entry.error
        }))
      };
    }

    default:
      throw new Error(`Unknown website group tool: ${toolName}`);
  }
}
