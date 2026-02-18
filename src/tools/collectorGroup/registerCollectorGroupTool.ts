/**
 * Collector Group Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CollectorGroupOperationArgsSchema } from '../../resources/collectorGroup/collectorGroupZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_collector_group tool with the MCP server and returns its metadata
 */
export function registerCollectorGroupTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor Collector Group Management',
    description: `Manage LogicMonitor collector groups. Supports the following operations:
- list: Retrieve collector groups with optional filtering and field selection
- get: Get a specific collector group by ID
- create: Create one or more collector groups (supports batch operations)
- update: Update collector groups (supports batch operations with applyToPrevious or filter)
- delete: Delete collector groups (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/collector_group

Batch operations support:
- Explicit arrays via 'groups' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all groups matching a filter`,
    inputSchema: CollectorGroupOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  };
  server.registerTool('lm_collector_group', toolDef, handler);
  return { name: 'lm_collector_group', ...toolDef };
}

