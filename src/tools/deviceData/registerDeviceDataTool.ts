/**
 * Device Data Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { DeviceDataOperationArgsSchema } from '../../resources/deviceData/deviceDataZodSchemas.js';
import { DeviceDataHandler } from '../../resources/deviceData/deviceDataHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_device_data tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a DeviceDataHandler instance
 */
export function registerDeviceDataTool(
  server: McpServer,
  createHandler: () => DeviceDataHandler
): void {
  server.registerTool(
    'lm_device_data',
    {
      title: 'LogicMonitor Device Data Management',
      description: `Query device datasources, instances, and performance data. Supports the following operations:
- list_datasources: List datasources applied to a device
- list_instances: List instances for a device datasource
- get_data: Retrieve performance data for device datasource instances

Available fields:
- datasources: health://logicmonitor/fields/device_datasource
- instances: health://logicmonitor/fields/device_datasource_instance

Note: This is a read-only tool for querying monitoring data.`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(DeviceDataOperationArgsSchema) as any
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

