import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../api/client.js';
import {
  listWebsitesSchema,
  getWebsiteSchema,
  createWebsiteSchema,
  updateWebsiteSchema,
  deleteWebsiteSchema
} from '../utils/validation.js';
import { batchProcessor } from '../utils/batchProcessor.js';
import { extractBatchOptions, isBatchInput, normalizeToArray } from '../utils/schemaHelpers.js';
import { SessionContext } from '../session/sessionManager.js';

export const websiteTools: Tool[] = [
  {
    name: 'lm_list_websites',
    description: 'List monitored websites with optional filtering and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'LogicMonitor filter syntax for websites.'
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
        },
        collectorIds: {
          type: 'string',
          description: 'Comma-separated collector IDs to filter websites.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'lm_get_website',
    description: 'Retrieve detailed information about a specific website monitor.',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: {
          type: 'number',
          description: 'Website monitor ID.'
        }
      },
      required: ['websiteId'],
      additionalProperties: false
    }
  },
  {
    name: 'lm_create_website',
    description: 'Create website monitor(s). Supports single and batch creation.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Website name (single mode).' },
        domain: { type: 'string', description: 'Website domain or URL (single mode).' },
        type: { type: 'string', enum: ['webcheck', 'pingcheck'], description: 'Website monitor type.' },
        groupId: { type: 'number', description: 'Website group ID.' },
        description: { type: 'string' },
        disableAlerting: { type: 'boolean' },
        stopMonitoring: { type: 'boolean' },
        useDefaultAlertSetting: { type: 'boolean' },
        useDefaultLocationSetting: { type: 'boolean' },
        pollingInterval: { type: 'number' },
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
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              HTTPMethod: { type: 'string' },
              statusCode: { type: 'string' },
              description: { type: 'string' }
            },
            required: ['url'],
            additionalProperties: true
          },
          description: 'Steps for webcheck monitors.'
        },
        websites: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              websiteId: { type: 'number' },
              name: { type: 'string' },
              domain: { type: 'string' },
              type: { type: 'string', enum: ['webcheck', 'pingcheck'] },
              groupId: { type: 'number' },
              description: { type: 'string' },
              disableAlerting: { type: 'boolean' },
              stopMonitoring: { type: 'boolean' },
              useDefaultAlertSetting: { type: 'boolean' },
              useDefaultLocationSetting: { type: 'boolean' },
              pollingInterval: { type: 'number' },
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
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' },
                    HTTPMethod: { type: 'string' },
                    statusCode: { type: 'string' },
                    description: { type: 'string' }
                  },
                  required: ['url'],
                  additionalProperties: true
                }
              }
            },
            required: ['name', 'domain', 'type', 'groupId'],
            additionalProperties: true
          },
          description: 'Websites to create (batch mode).'
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
    name: 'lm_update_website',
    description: 'Update existing website monitor(s).',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'number', description: 'Website monitor ID (single mode).' },
        name: { type: 'string' },
        description: { type: 'string' },
        disableAlerting: { type: 'boolean' },
        stopMonitoring: { type: 'boolean' },
        useDefaultAlertSetting: { type: 'boolean' },
        useDefaultLocationSetting: { type: 'boolean' },
        pollingInterval: { type: 'number' },
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
        websites: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              websiteId: { type: 'number' },
              name: { type: 'string' },
              description: { type: 'string' },
              disableAlerting: { type: 'boolean' },
              stopMonitoring: { type: 'boolean' },
              useDefaultAlertSetting: { type: 'boolean' },
              useDefaultLocationSetting: { type: 'boolean' },
              pollingInterval: { type: 'number' },
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
            required: ['websiteId'],
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
    name: 'lm_delete_website',
    description: 'Delete website monitor(s).',
    inputSchema: {
      type: 'object',
      properties: {
        websiteId: { type: 'number', description: 'Website monitor ID (single mode).' },
        websites: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              websiteId: { type: 'number' }
            },
            required: ['websiteId'],
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

export async function handleWebsiteTool(
  toolName: string,
  args: any,
  client: LogicMonitorClient,
  sessionContext: SessionContext
): Promise<any> {
  switch (toolName) {
    case 'lm_list_websites': {
      const validated = await listWebsitesSchema.validateAsync(args);
      const result = await client.listWebsites(validated);
      const payload = {
        total: result.total ?? result.items?.length ?? 0,
        items: result.items ?? [],
        searchId: result.searchId,
        request: {
          filter: validated.filter,
          fields: validated.fields,
          collectorIds: validated.collectorIds,
          offset: validated.offset ?? 0,
          size: validated.size ?? (result.items?.length ?? 0)
        }
      };

      sessionContext.variables.lastWebsiteList = payload.items;
      sessionContext.variables.lastWebsiteListMetadata = payload.request;

      return {
        ...payload,
        summary: `Retrieved ${payload.items.length} website(s).`
      };
    }

    case 'lm_get_website': {
      const validated = await getWebsiteSchema.validateAsync(args);
      const websiteResult = await client.getWebsite(validated.websiteId);
      const website = websiteResult.data;
      sessionContext.variables.lastWebsite = website;
      sessionContext.variables.lastWebsiteId = validated.websiteId;
      return website;
    }

    case 'lm_create_website': {
      const validated = await createWebsiteSchema.validateAsync(args);
      const isBatch = isBatchInput(validated, 'websites');
      const websites = normalizeToArray(validated, 'websites');
      const batchOptions = extractBatchOptions(validated);

      const result = await batchProcessor.processBatch(
        websites,
        async (website) => {
          const created = await client.createWebsite(website as any);
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
          throw new Error(singleResult.error || 'Failed to create website');
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for created website.');
        }
        const websiteCreated = singleResult.data;
        sessionContext.variables.lastCreatedWebsite = websiteCreated;
        return {
          success: true,
          website: websiteCreated,
          message: `Website '${websiteCreated?.name}' created successfully.`
        };
      }

      sessionContext.variables.lastCreatedWebsites = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data!);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          website: entry.data ?? null,
          error: entry.error
        }))
      };
    }

    case 'lm_update_website': {
      const validated = await updateWebsiteSchema.validateAsync(args);
      const isBatch = isBatchInput(validated, 'websites');
      const websites = normalizeToArray(validated, 'websites');
      const batchOptions = extractBatchOptions(validated);

      const result = await batchProcessor.processBatch(
        websites,
        async (website) => {
          const { websiteId, ...updates } = website as Record<string, any>;
          const updated = await client.updateWebsite(websiteId, updates);
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
          throw new Error(singleResult.error || 'Failed to update website');
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for updated website.');
        }
        const websiteUpdated = singleResult.data;
        sessionContext.variables.lastUpdatedWebsite = websiteUpdated;
        return {
          success: true,
          website: websiteUpdated,
          message: `Website '${websiteUpdated?.name}' updated successfully.`
        };
      }

      sessionContext.variables.lastUpdatedWebsites = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data!);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          website: entry.data ?? null,
          error: entry.error
        }))
      };
    }

    case 'lm_delete_website': {
      const validated = await deleteWebsiteSchema.validateAsync(args);
      const isBatch = isBatchInput(validated, 'websites');
      const websites = normalizeToArray(validated, 'websites');
      const batchOptions = extractBatchOptions(validated);

      const result = await batchProcessor.processBatch(
        websites,
        async (website) => {
          await client.deleteWebsite(website.websiteId);
          return { websiteId: website.websiteId };
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
          throw new Error(singleResult.error || 'Failed to delete website');
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for deleted website.');
        }
        const deletedWebsite = singleResult.data;
        sessionContext.variables.lastDeletedWebsiteId = deletedWebsite.websiteId;
        return {
          success: true,
          websiteId: deletedWebsite.websiteId,
          message: `Website ${deletedWebsite.websiteId} deleted successfully.`
        };
      }

      sessionContext.variables.lastDeletedWebsiteIds = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data!.websiteId);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          websiteId: entry.data?.websiteId ?? null,
          error: entry.error
        }))
      };
    }

    default:
      throw new Error(`Unknown website tool: ${toolName}`);
  }
}
