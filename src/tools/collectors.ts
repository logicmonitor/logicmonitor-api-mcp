import { ErrorCode, McpError, Tool } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../api/client.js';
import { listCollectorsSchema } from '../utils/validation.js';
import { SessionContext } from '../session/sessionManager.js';
import { sanitizeFields } from '../utils/fieldMetadata.js';
import type { LMCollector } from '../types/logicmonitor.js';

export const collectorTools: Tool[] = [
  {
    name: 'lm_list_collectors',
    description: 'List collectors with optional filtering and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'LogicMonitor filter syntax for collectors. Only field names listed in health://logicmonitor/fields/collector are accepted.'
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
          description: 'Comma-separated list of fields to return. Use "*" for all fields. See resource health://logicmonitor/fields/collector for the complete list.'
        }
      },
      additionalProperties: false
    }
  }
];

export async function handleCollectorTool(
  toolName: string,
  args: any,
  client: LogicMonitorClient,
  sessionContext: SessionContext
): Promise<any> {
  switch (toolName) {
    case 'lm_list_collectors': {
      const validated = await listCollectorsSchema.validateAsync(args);
      const { fields, ...rest } = validated;
      const fieldConfig = sanitizeFields('collector', fields);

      if (fieldConfig.invalid.length > 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown collector field(s): ${fieldConfig.invalid.join(', ')}`
        );
      }

      const apiResult = await client.listCollectors({
        ...rest,
        fields: fieldConfig.fieldsParam
      });

      const response = {
        total: apiResult.total,
        items: apiResult.items as LMCollector[],
        request: {
          ...rest,
          fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
        },
        meta: apiResult.meta,
        raw: apiResult.raw
      };

      sessionContext.variables.lastCollectorList = response;

      return response;
    }

    default:
      throw new Error(`Unknown collector tool: ${toolName}`);
  }
}
