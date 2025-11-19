/**
 * Dashboard Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { DashboardOperationArgsSchema } from '../../resources/dashboard/dashboardZodSchemas.js';
import { DashboardHandler } from '../../resources/dashboard/dashboardHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_dashboard tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a DashboardHandler instance
 */
export function registerDashboardTool(
  server: McpServer,
  createHandler: () => DashboardHandler
): void {
  server.registerTool(
    'lm_dashboard',
    {
      title: 'LogicMonitor Dashboard Management',
      description: `Manage LogicMonitor dashboards. Supports the following operations:
- list: Retrieve dashboards with optional filtering and field selection
- get: Get a specific dashboard by ID
- create: Create one or more dashboards (supports batch operations)
- update: Update dashboards (supports batch operations with applyToPrevious or filter)
- delete: Delete dashboards (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/dashboard

Batch operations support:
- Explicit arrays via 'dashboards' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all dashboards matching a filter`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(DashboardOperationArgsSchema) as any
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

