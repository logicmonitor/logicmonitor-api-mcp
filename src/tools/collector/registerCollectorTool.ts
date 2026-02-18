/**
 * Collector Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CollectorOperationArgsSchema } from '../../resources/collector/collectorZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_collector tool with the MCP server and returns its metadata
 */
export function registerCollectorTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor Collector Management',
    description: `List LogicMonitor collectors. Currently supports list operation only.

Available fields can be found at: health://logicmonitor/fields/collector

Note: Collector get, create, update, and delete operations are not yet supported.`,
    inputSchema: CollectorOperationArgsSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  };
  server.registerTool('lm_collector', toolDef, handler);
  return { name: 'lm_collector', ...toolDef };
}

