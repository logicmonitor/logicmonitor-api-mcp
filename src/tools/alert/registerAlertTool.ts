/**
 * Alert Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { AlertOperationArgsSchema } from '../../resources/alert/alertZodSchemas.js';
import { AlertHandler } from '../../resources/alert/alertHandler.js';

/**
 * Registers the lm_alert tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create an AlertHandler instance
 */
export function registerAlertTool(
  server: McpServer,
  createHandler: () => AlertHandler
): void {
  server.registerTool(
    'lm_alert',
    {
      title: 'LogicMonitor Alert Management',
      description: `Manage LogicMonitor alerts. Supports the following operations:
- list: Retrieve alerts with optional filtering and field selection
- get: Get a specific alert by ID
- update: Update an alert (ack, note, escalate)

Available fields can be found at: health://logicmonitor/fields/alert

Note: Alert creation and deletion are not supported via the API.`,
      inputSchema: AlertOperationArgsSchema
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

