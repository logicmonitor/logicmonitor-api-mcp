/**
 * User Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { UserOperationArgsSchema } from '../../resources/user/userZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_user tool with the MCP server and returns its metadata
 */
export function registerUserTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor User Management',
    description: `Manage LogicMonitor users. Supports the following operations:
- list: Retrieve users with optional filtering and field selection
- get: Get a specific user by ID
- create: Create one or more users (supports batch operations)
- update: Update users (supports batch operations with applyToPrevious or filter)
- delete: Delete users (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/user

Batch operations support:
- Explicit arrays via 'users' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all users matching a filter`,
    inputSchema: UserOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  };
  server.registerTool('lm_user', toolDef, handler);
  return { name: 'lm_user', ...toolDef };
}

