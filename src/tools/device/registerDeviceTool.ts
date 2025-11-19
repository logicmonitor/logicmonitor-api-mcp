/**
 * Device Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { DeviceOperationArgsSchema } from '../../resources/device/deviceZodSchemas.js';
import { DeviceHandler } from '../../resources/device/deviceHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_device tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a DeviceHandler instance
 */
export function registerDeviceTool(
  server: McpServer,
  createHandler: () => DeviceHandler
): void {
  server.registerTool(
    'lm_device',
    {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(DeviceOperationArgsSchema) as any
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

