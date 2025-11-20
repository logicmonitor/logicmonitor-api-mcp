/**
 * Session Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { SessionOperationArgsSchema } from '../../resources/session/sessionZodSchemas.js';
import { SessionHandler } from '../../resources/session/sessionHandler.js';

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
      description: `Manage session state, variables, and operation history.

OPERATIONS:

1. list - Get session history
   Parameters: limit (optional, 1-50, default 10)
   Returns: Recent tool calls and available session data

2. get - Get session context or specific variable
   Parameters: 
   - key (optional): Variable name to retrieve. If omitted, returns full session context
   - historyLimit (optional, 1-50): Number of history entries to include
   - includeResults (optional, boolean): Include full result objects
   Returns: Variable value or full session context

3. create - Store a new session variable
   Parameters: key (required), value (required)
   Returns: Confirmation with list of stored variables
   Use for: Storing results for batch operations with applyToPrevious

4. update - Update an existing session variable
   Parameters: key (required), value (required)
   Returns: Confirmation with list of stored variables

5. delete - Clear session data
   Parameters: scope (optional: 'variables' | 'history' | 'results' | 'all', default 'all')
   Returns: Confirmation with remaining data counts

COMMON WORKFLOWS:

Store results for batch operations:
- Use operation: "create" with key and value to store data
- Reference stored data in other tools using applyToPrevious

Example:
1. lm_device with operation: "list" and filter
2. lm_session with operation: "create", key: "myDevices", value: <results>
3. lm_device with operation: "update", applyToPrevious: "myDevices"`,
      inputSchema: SessionOperationArgsSchema
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

