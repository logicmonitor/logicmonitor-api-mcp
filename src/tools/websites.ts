import { ErrorCode, McpError, Tool } from '@modelcontextprotocol/sdk/types.js';
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
import { sanitizeFields } from '../utils/fieldMetadata.js';
import { throwBatchFailure } from '../utils/batchUtils.js';
import type { LMWebsite } from '../types/logicmonitor.js';

export const websiteTools: Tool[] = [
  {
    name: 'lm_list_websites',
    description: 'List monitored websites with optional filtering and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'LogicMonitor filter syntax for websites. Only field names listed in health://logicmonitor/fields/website are accepted.'
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
          description: 'Comma-separated list of fields to return. Use "*" for all fields. See resource health://logicmonitor/fields/website for the complete list.'
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
      const { fields, ...rest } = validated;
      const fieldConfig = sanitizeFields('website', fields);

      if (fieldConfig.invalid.length > 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown website field(s): ${fieldConfig.invalid.join(', ')}`
        );
      }

      const apiResult = await client.listWebsites({
        ...rest,
        fields: fieldConfig.fieldsParam
      });

      const response = {
        total: apiResult.total,
        items: apiResult.items as LMWebsite[],
        request: {
          ...rest,
          fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
        },
        meta: apiResult.meta,
        raw: apiResult.raw
      };

      sessionContext.variables.lastWebsiteList = response;

      return response;
    }

    case 'lm_get_website': {
      const validated = await getWebsiteSchema.validateAsync(args);
      const websiteResult = await client.getWebsite(validated.websiteId);
      const response = {
        website: websiteResult.data,
        meta: websiteResult.meta,
        raw: websiteResult.raw
      };
      sessionContext.variables.lastWebsite = response;
      sessionContext.variables.lastWebsiteId = validated.websiteId;
      return response;
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
          throwBatchFailure('Website create', singleResult);
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for created website.');
        }
        const websiteCreated = singleResult.data as LMWebsite;
        sessionContext.variables.lastCreatedWebsite = websiteCreated;
        return {
          success: true,
          website: websiteCreated,
          raw: singleResult.raw ?? websiteCreated,
          meta: singleResult.meta ?? null
        };
      }

      sessionContext.variables.lastCreatedWebsites = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data as LMWebsite);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          website: entry.data ? (entry.data as LMWebsite) : null,
          error: entry.error,
          raw: entry.raw ?? null,
          meta: entry.meta ?? null
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
          throwBatchFailure('Website update', singleResult);
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for updated website.');
        }
        const websiteUpdated = singleResult.data as LMWebsite;
        sessionContext.variables.lastUpdatedWebsite = websiteUpdated;
        return {
          success: true,
          website: websiteUpdated,
          raw: singleResult.raw ?? websiteUpdated,
          meta: singleResult.meta ?? null
        };
      }

      sessionContext.variables.lastUpdatedWebsites = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => entry.data as LMWebsite);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          website: entry.data ?? null,
          error: entry.error,
          raw: entry.raw ?? null,
          meta: entry.meta ?? null
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
          throwBatchFailure('Website delete', singleResult);
        }
        if (!singleResult.data) {
          throw new Error('No response data returned for deleted website.');
        }
        const deletedWebsite = singleResult.data as { websiteId: number };
        sessionContext.variables.lastDeletedWebsiteId = deletedWebsite.websiteId;
        return {
          success: true,
          websiteId: deletedWebsite.websiteId,
          raw: singleResult.raw ?? deletedWebsite,
          meta: singleResult.meta ?? null
        };
      }

      sessionContext.variables.lastDeletedWebsiteIds = result.results
        .filter(entry => entry.success && entry.data)
        .map(entry => (entry.data as { websiteId: number }).websiteId);

      return {
        success: result.success,
        summary: result.summary,
        results: result.results.map(entry => ({
          index: entry.index,
          success: entry.success,
          websiteId: entry.data?.websiteId ?? null,
          error: entry.error,
          raw: entry.raw ?? null,
          meta: entry.meta ?? null
        }))
      };
    }

    default:
      throw new Error(`Unknown website tool: ${toolName}`);
  }
}
