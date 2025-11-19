/**
 * Website Group Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { WebsiteGroupOperationArgsSchema } from '../../resources/websiteGroup/websiteGroupZodSchemas.js';
import { WebsiteGroupHandler } from '../../resources/websiteGroup/websiteGroupHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_website_group tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a WebsiteGroupHandler instance
 */
export function registerWebsiteGroupTool(
  server: McpServer,
  createHandler: () => WebsiteGroupHandler
): void {
  server.registerTool(
    'lm_website_group',
    {
      title: 'LogicMonitor Website Group Management',
      description: `Manage LogicMonitor website groups. Supports the following operations:
- list: Retrieve website groups with optional filtering and field selection
- get: Get a specific website group by ID
- create: Create one or more website groups (supports batch operations)
- update: Update website groups (supports batch operations with applyToPrevious or filter)
- delete: Delete website groups (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/website_group

Batch operations support:
- Explicit arrays via 'groups' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all groups matching a filter`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(WebsiteGroupOperationArgsSchema) as any
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

