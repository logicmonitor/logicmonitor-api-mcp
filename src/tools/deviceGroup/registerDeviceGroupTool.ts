/**
 * Device Group Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DeviceGroupOperationArgsSchema } from '../../resources/deviceGroup/deviceGroupZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_device_group tool with the MCP server and returns its metadata
 */
export function registerDeviceGroupTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor Device Group Management',
    description: `Manage LogicMonitor device groups. Supports the following operations:
- list: Retrieve device groups with optional filtering and field selection
- get: Get a specific device group by ID
- create: Create one or more device groups (supports batch operations)
- update: Update device groups (supports batch operations with applyToPrevious or filter)
- delete: Delete device groups (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/device_group

Batch operations support:
- Explicit arrays via 'groups' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all groups matching a filter`,
    inputSchema: DeviceGroupOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  };
  server.registerTool('lm_device_group', toolDef, handler);
  return { name: 'lm_device_group', ...toolDef };
}

