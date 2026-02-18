/**
 * Dashboard Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DashboardOperationArgsSchema } from '../../resources/dashboard/dashboardZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_dashboard tool with the MCP server and returns its metadata
 */
export function registerDashboardTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
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
    inputSchema: DashboardOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  };
  server.registerTool('lm_dashboard', toolDef, handler);
  return { name: 'lm_dashboard', ...toolDef };
}

