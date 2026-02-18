/**
 * Device Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DeviceOperationArgsSchema } from '../../resources/device/deviceZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_device tool with the MCP server and returns its metadata
 */
export function registerDeviceTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor Device Management',
    description: `Manage LogicMonitor devices. Supports the following operations:
- list: Retrieve devices with optional filtering and field selection
- get: Get a specific device by ID
- create: Create one or more devices (supports batch operations)
- update: Update devices (supports batch operations with applyToPrevious or filter)
- delete: Delete devices (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/device

Batch operations support:
- Explicit arrays via 'devices' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all devices matching a filter`,
    inputSchema: DeviceOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  };
  server.registerTool('lm_device', toolDef, handler);
  return { name: 'lm_device', ...toolDef };
}

