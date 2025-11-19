/**
 * Website Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { WebsiteOperationArgsSchema } from '../../resources/website/websiteZodSchemas.js';
import { WebsiteHandler } from '../../resources/website/websiteHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_website tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a WebsiteHandler instance
 */
export function registerWebsiteTool(
  server: McpServer,
  createHandler: () => WebsiteHandler
): void {
  server.registerTool(
    'lm_website',
    {
      title: 'LogicMonitor Website Management',
      description: `Manage LogicMonitor websites. Supports the following operations:
- list: Retrieve websites with optional filtering and field selection
- get: Get a specific website by ID
- create: Create one or more websites (supports batch operations)
- update: Update websites (supports batch operations with applyToPrevious or filter)
- delete: Delete websites (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/website

Batch operations support:
- Explicit arrays via 'websites' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all websites matching a filter`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(WebsiteOperationArgsSchema) as any
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

