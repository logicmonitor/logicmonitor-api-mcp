/**
 * Session Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { SessionOperationArgsSchema } from '../../resources/session/sessionZodSchemas.js';
import { SessionHandler } from '../../resources/session/sessionHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_session tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a SessionHandler instance
 */
export function registerSessionTool(
  server: McpServer,
  createHandler: () => SessionHandler
): void {
  server.registerTool(
    'lm_session',
    {
      title: 'LogicMonitor Session Management',
      description: `Manage session state, variables, and operation history. Supports the following operations:
- set_variable: Store a value in the session (useful for batch operations with applyToPrevious)
- get_variable: Retrieve a stored session variable
- list_variables: List all session variables
- clear_variables: Clear all session variables
- get_context: Get current session context (ID, variables, cached resources)
- get_history: Get operation history (recent API calls and results)

Session variables are commonly used with batch operations:
1. List resources and store in a variable
2. Use applyToPrevious to reference the variable in subsequent operations

Example workflow:
- List devices with filter and store results
- Update all devices from previous operation using applyToPrevious`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(SessionOperationArgsSchema) as any
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

