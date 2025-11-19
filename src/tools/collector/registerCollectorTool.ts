/**
 * Collector Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { CollectorOperationArgsSchema } from '../../resources/collector/collectorZodSchemas.js';
import { CollectorHandler } from '../../resources/collector/collectorHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_collector tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a CollectorHandler instance
 */
export function registerCollectorTool(
  server: McpServer,
  createHandler: () => CollectorHandler
): void {
  server.registerTool(
    'lm_collector',
    {
      title: 'LogicMonitor Collector Management',
      description: `List LogicMonitor collectors. Currently supports list operation only.

Available fields can be found at: health://logicmonitor/fields/collector

Note: Collector get, create, update, and delete operations are not yet supported.`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(CollectorOperationArgsSchema) as any
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

