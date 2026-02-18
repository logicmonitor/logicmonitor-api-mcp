/**
 * Website Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebsiteOperationArgsSchema } from '../../resources/website/websiteZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_website tool with the MCP server and returns its metadata
 */
export function registerWebsiteTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor Website Management',
    description: `Manage LogicMonitor websites. Supports the following operations:
- list: Retrieve websites with optional filtering and field selection
- get: Get a specific website by ID
- create: Create one or more websites (supports batch operations)
- update: Update websites (supports batch operations with applyToPrevious or filter)
- delete: Delete websites (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/website

Batch operations support:
- Explicit arrays via 'websites' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all websites matching a filter`,
    inputSchema: WebsiteOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  };
  server.registerTool('lm_website', toolDef, handler);
  return { name: 'lm_website', ...toolDef };
}

