/**
 * Collector Group Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { CollectorGroupOperationArgsSchema } from '../../resources/collectorGroup/collectorGroupZodSchemas.js';
import { CollectorGroupHandler } from '../../resources/collectorGroup/collectorGroupHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_collector_group tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a CollectorGroupHandler instance
 */
export function registerCollectorGroupTool(
  server: McpServer,
  createHandler: () => CollectorGroupHandler
): void {
  server.registerTool(
    'lm_collector_group',
    {
      title: 'LogicMonitor Collector Group Management',
      description: `Manage LogicMonitor collector groups. Supports the following operations:
- list: Retrieve collector groups with optional filtering and field selection
- get: Get a specific collector group by ID
- create: Create one or more collector groups (supports batch operations)
- update: Update collector groups (supports batch operations with applyToPrevious or filter)
- delete: Delete collector groups (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/collector_group

Batch operations support:
- Explicit arrays via 'groups' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all groups matching a filter`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(CollectorGroupOperationArgsSchema) as any
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (args: any) => {
      const handler = createHandler();
      const result = await handler.handleOperation(args);
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );
}

