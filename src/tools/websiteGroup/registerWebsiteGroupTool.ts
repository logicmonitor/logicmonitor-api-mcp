/**
 * Website Group Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebsiteGroupOperationArgsSchema } from '../../resources/websiteGroup/websiteGroupZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_website_group tool with the MCP server and returns its metadata
 */
export function registerWebsiteGroupTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor Website Group Management',
    description: `Manage LogicMonitor website groups. Supports the following operations:
- list: Retrieve website groups with optional filtering and field selection
- get: Get a specific website group by ID
- create: Create one or more website groups (supports batch operations)
- update: Update website groups (supports batch operations with applyToPrevious or filter)
- delete: Delete website groups (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/website_group

Batch operations support:
- Explicit arrays via 'groups' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all groups matching a filter`,
    inputSchema: WebsiteGroupOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  };
  server.registerTool('lm_website_group', toolDef, handler);
  return { name: 'lm_website_group', ...toolDef };
}

