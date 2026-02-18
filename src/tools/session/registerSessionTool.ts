/**
 * Session Tool Registration using MCP SDK's high-level registerTool API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SessionOperationArgsSchema } from '../../resources/session/sessionZodSchemas.js';
import type { ToolRegistration } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

/**
 * Registers the lm_session tool with the MCP server and returns its metadata
 */
export function registerSessionTool(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration {
  const toolDef = {
    title: 'LogicMonitor Session Management',
    description: `Manage session state, variables, and operation history across tool calls.

OPERATIONS:

1. list - Review the latest tool calls, stored variables, and applyToPrevious candidates (limit defaults to 10).
2. get - Fetch a full session snapshot or a specific variable (historyLimit 1-50, includeResults for raw payloads).
3. create - Persist a new variable (e.g., "myProdDevices") for downstream applyToPrevious usage.
4. update - Overwrite an existing variable while keeping the same key reference.
5. delete - Clear variables, history, and/or cached results (scope defaults to 'all').

QUICK WORKFLOWS:

- Rapid batch edits:
  1. Call lm_device list ... to populate session.lastDeviceList & session.lastDeviceListIds.
  2. Read health://logicmonitor/session or lm_session get to confirm the keys.
  3. Run lm_device update/delete with applyToPrevious: "lastDeviceListIds" (or your custom key).

- Snapshot validation:
  - Use resources/read health://logicmonitor/session?historyLimit=5&includeResults=true to see the exact keys and history before repeating queries.
  - Use lm_session list to surface storedVariables and applyToPreviousCandidates when working entirely via tools.`,
    inputSchema: SessionOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  };
  server.registerTool('lm_session', toolDef, handler);
  return { name: 'lm_session', ...toolDef };
}

