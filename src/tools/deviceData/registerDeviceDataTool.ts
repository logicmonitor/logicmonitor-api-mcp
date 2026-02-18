/**
 * Device Data Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DeviceDataOperationArgsSchema } from '../../resources/deviceData/deviceDataZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_device_data tool with the MCP server and returns its metadata
 */
export function registerDeviceDataTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor Device Data Management',
    description: `Query device datasources, instances, and performance data. Supports the following operations:
- list_datasources: List datasources applied to a device
- list_instances: List instances for a device datasource
- get_data: Retrieve performance data for device datasource instances

Available fields:
- datasources: health://logicmonitor/fields/device_datasource
- instances: health://logicmonitor/fields/device_datasource_instance

Note: This is a read-only tool for querying monitoring data.`,
    inputSchema: DeviceDataOperationArgsSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  };
  server.registerTool('lm_device_data', toolDef, handler);
  return { name: 'lm_device_data', ...toolDef };
}

