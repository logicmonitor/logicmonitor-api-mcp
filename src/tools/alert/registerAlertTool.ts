/**
 * Alert Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AlertOperationArgsSchema } from '../../resources/alert/alertZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_alert tool with the MCP server and returns its metadata
 */
export function registerAlertTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor Alert Management',
    description: `Manage LogicMonitor alerts. Supports the following operations:
- list: Retrieve alerts with optional filtering and field selection
- get: Get a specific alert by ID
- update: Update an alert (ack, note, escalate)

Available fields can be found at: health://logicmonitor/fields/alert

Note: Alert creation and deletion are not supported via the API.`,
    inputSchema: AlertOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  };
  server.registerTool('lm_alert', toolDef, handler);
  return { name: 'lm_alert', ...toolDef };
}

