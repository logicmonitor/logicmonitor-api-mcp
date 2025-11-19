/**
 * User Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { UserOperationArgsSchema } from '../../resources/user/userZodSchemas.js';
import { UserHandler } from '../../resources/user/userHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_user tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a UserHandler instance
 */
export function registerUserTool(
  server: McpServer,
  createHandler: () => UserHandler
): void {
  server.registerTool(
    'lm_user',
    {
      title: 'LogicMonitor User Management',
      description: `Manage LogicMonitor users. Supports the following operations:
- list: Retrieve users with optional filtering and field selection
- get: Get a specific user by ID
- create: Create one or more users (supports batch operations)
- update: Update users (supports batch operations with applyToPrevious or filter)
- delete: Delete users (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/user

Batch operations support:
- Explicit arrays via 'users' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all users matching a filter`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(UserOperationArgsSchema) as any
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

