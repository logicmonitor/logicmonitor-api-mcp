/**
 * Device Group Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import { DeviceGroupOperationArgsSchema } from '../../resources/deviceGroup/deviceGroupZodSchemas.js';
import { DeviceGroupHandler } from '../../resources/deviceGroup/deviceGroupHandler.js';
import { zodToJsonSchema } from '../../schemas/zodToJsonSchema.js';

/**
 * Registers the lm_device_group tool with the MCP server
 * @param server - The MCP server instance
 * @param createHandler - Factory function to create a DeviceGroupHandler instance
 */
export function registerDeviceGroupTool(
  server: McpServer,
  createHandler: () => DeviceGroupHandler
): void {
  server.registerTool(
    'lm_device_group',
    {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(DeviceGroupOperationArgsSchema) as any
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

