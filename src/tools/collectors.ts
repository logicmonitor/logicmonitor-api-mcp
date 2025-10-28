import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../api/client.js';
import { listCollectorsSchema } from '../utils/validation.js';
import { SessionContext } from '../session/sessionManager.js';

export const collectorTools: Tool[] = [
  {
    name: 'lm_list_collectors',
    description: 'List collectors with optional filtering and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'LogicMonitor filter syntax for collectors.'
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
      const result = await client.listCollectors(validated);
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

      sessionContext.variables.lastCollectorList = payload.items;
      sessionContext.variables.lastCollectorListMetadata = payload.request;

      return {
        ...payload,
        summary: `Retrieved ${payload.items.length} collector(s).`
      };
    }

    default:
      throw new Error(`Unknown collector tool: ${toolName}`);
  }
}
