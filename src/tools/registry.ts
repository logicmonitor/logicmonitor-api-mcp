/**
 * Consolidated tool registry — data-driven definitions for all LM tools.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DeviceOperationArgsSchema } from '../resources/device/deviceZodSchemas.js';
import { DeviceGroupOperationArgsSchema } from '../resources/deviceGroup/deviceGroupZodSchemas.js';
import { AlertOperationArgsSchema } from '../resources/alert/alertZodSchemas.js';
import { WebsiteOperationArgsSchema } from '../resources/website/websiteZodSchemas.js';
import { WebsiteGroupOperationArgsSchema } from '../resources/websiteGroup/websiteGroupZodSchemas.js';
import { CollectorOperationArgsSchema } from '../resources/collector/collectorZodSchemas.js';
import { CollectorGroupOperationArgsSchema } from '../resources/collectorGroup/collectorGroupZodSchemas.js';
import { UserOperationArgsSchema } from '../resources/user/userZodSchemas.js';
import { DashboardOperationArgsSchema } from '../resources/dashboard/dashboardZodSchemas.js';
import { DeviceDataOperationArgsSchema } from '../resources/deviceData/deviceDataZodSchemas.js';
import { SessionOperationArgsSchema } from '../resources/session/sessionZodSchemas.js';
import { SdtOperationArgsSchema } from '../resources/sdt/sdtZodSchemas.js';
import { OpsnoteOperationArgsSchema } from '../resources/opsnote/opsnoteZodSchemas.js';
import type { ToolRegistration } from './types.js';

export type { ToolRegistration } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallback = (...args: any[]) => Promise<any>;

const LISTENER_PORTAL_DESCRIPTION_SUFFIX = `\n\nPortal targeting: when listener-based auth is configured, pass the optional "portal" argument to target a specific portal. If omitted, the server uses lm_session defaultPortal, then LM_PORTAL if configured.`;
const SESSION_PORTAL_DESCRIPTION_SUFFIX = `\n\nPortal targeting: use lm_session get to inspect availablePortals and portalScopes. Set key="defaultPortal" via lm_session create/update to establish a conversational default, or pass portal to inspect or clear a specific portal scope.`;

/**
 * All tool definitions as a flat data array.
 * Order is preserved from the original individual registration files.
 */
export const TOOL_DEFINITIONS: ReadonlyArray<ToolRegistration> = [
  {
    name: 'lm_device',
    title: 'LogicMonitor Device Management',
    description: `Manage LogicMonitor devices. Supports the following operations:
- list: Retrieve devices with optional filtering and field selection
- get: Get a specific device by ID
- create: Create one or more devices (supports batch operations)
- update: Update devices (supports batch operations with applyToPrevious or filter)
- delete: Delete devices (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/device

Device creation workflow (create requires numeric IDs):
1. lm_collector list → find a collector with status "up", note its id
2. lm_device_group list → find a static group (appliesTo field is empty), note its id
3. lm_device create with hostGroupIds and preferredCollectorId from steps 1-2
Important: Do not use dynamic groups (where appliesTo is non-empty) for hostGroupIds — devices cannot be manually assigned to dynamic groups.

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Batch operations support:
- Explicit arrays via 'devices' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all devices matching a filter`,
    inputSchema: DeviceOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_device_group',
    title: 'LogicMonitor Device Group Management',
    description: `Manage LogicMonitor device groups. Supports the following operations:
- list: Retrieve device groups with optional filtering and field selection
- get: Get a specific device group by ID
- create: Create one or more device groups (supports batch operations)
- update: Update device groups (supports batch operations with applyToPrevious or filter)
- delete: Delete device groups (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/device_group

Static vs dynamic groups: Groups with a non-empty "appliesTo" field are dynamic (auto-populated by a rule). Devices cannot be manually added to dynamic groups. When selecting a group for device creation, choose one where appliesTo is empty (static group). Use filter 'appliesTo:""' to list only static groups.

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Batch operations support:
- Explicit arrays via 'groups' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all groups matching a filter`,
    inputSchema: DeviceGroupOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_alert',
    title: 'LogicMonitor Alert Management',
    description: `Manage LogicMonitor alerts. Supports the following operations:
- list: Retrieve alerts with optional filtering and field selection
- get: Get a specific alert by ID
- update: Update an alert (ack, note, escalate)

Available fields can be found at: health://logicmonitor/fields/alert

Severity levels: 2=warning, 3=error, 4=critical. Use in filters like "severity:4" for critical alerts.

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Note: Alert creation and deletion are not supported via the API.`,
    inputSchema: AlertOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_website',
    title: 'LogicMonitor Website Management',
    description: `Manage LogicMonitor websites. Supports the following operations:
- list: Retrieve websites with optional filtering and field selection
- get: Get a specific website by ID
- create: Create one or more websites (supports batch operations)
- update: Update websites (supports batch operations with applyToPrevious or filter)
- delete: Delete websites (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/website

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Batch operations support:
- Explicit arrays via 'websites' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all websites matching a filter`,
    inputSchema: WebsiteOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_website_group',
    title: 'LogicMonitor Website Group Management',
    description: `Manage LogicMonitor website groups. Supports the following operations:
- list: Retrieve website groups with optional filtering and field selection
- get: Get a specific website group by ID
- create: Create one or more website groups (supports batch operations)
- update: Update website groups (supports batch operations with applyToPrevious or filter)
- delete: Delete website groups (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/website_group

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Batch operations support:
- Explicit arrays via 'groups' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all groups matching a filter`,
    inputSchema: WebsiteGroupOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_collector',
    title: 'LogicMonitor Collector Management',
    description: `List LogicMonitor collectors. Currently supports list operation only.

Available fields can be found at: health://logicmonitor/fields/collector

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Note: Collector get, create, update, and delete operations are not yet supported.`,
    inputSchema: CollectorOperationArgsSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'lm_collector_group',
    title: 'LogicMonitor Collector Group Management',
    description: `Manage LogicMonitor collector groups. Supports the following operations:
- list: Retrieve collector groups with optional filtering and field selection
- get: Get a specific collector group by ID
- create: Create one or more collector groups (supports batch operations)
- update: Update collector groups (supports batch operations with applyToPrevious or filter)
- delete: Delete collector groups (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/collector_group

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Batch operations support:
- Explicit arrays via 'groups' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all groups matching a filter`,
    inputSchema: CollectorGroupOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_user',
    title: 'LogicMonitor User Management',
    description: `Manage LogicMonitor users. Supports the following operations:
- list: Retrieve users with optional filtering and field selection
- get: Get a specific user by ID
- create: Create one or more users (supports batch operations)
- update: Update users (supports batch operations with applyToPrevious or filter)
- delete: Delete users (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/user

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Batch operations support:
- Explicit arrays via 'users' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all users matching a filter`,
    inputSchema: UserOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_dashboard',
    title: 'LogicMonitor Dashboard Management',
    description: `Manage LogicMonitor dashboards. Supports the following operations:
- list: Retrieve dashboards with optional filtering and field selection
- get: Get a specific dashboard by ID
- create: Create one or more dashboards (supports batch operations)
- update: Update dashboards (supports batch operations with applyToPrevious or filter)
- delete: Delete dashboards (supports batch operations)

Available fields can be found at: health://logicmonitor/fields/dashboard

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Batch operations support:
- Explicit arrays via 'dashboards' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all dashboards matching a filter`,
    inputSchema: DashboardOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_device_data',
    title: 'LogicMonitor Device Data Management',
    description: `Query device datasources, instances, and performance data. Supports the following operations:
- list_datasources: List datasources applied to a device. Returns objects with "id" (use this as datasourceId in subsequent calls) and "dataSourceName".
- list_instances: List instances for a device datasource. Requires the "id" from list_datasources as the datasourceId parameter.
- get_data: Retrieve performance data for device datasource instances. Returns time-series data ordered newest-first by default.

Typical workflow:
1. list_datasources with deviceId to find the datasource (use filter or datasourceIncludeFilter to narrow by name)
2. list_instances with deviceId + datasourceId (the "id" from step 1) to find instances
3. get_data with deviceId + datasourceId + instanceId/instanceIds to retrieve metrics

Important: datasourceId in steps 2-3 must be the "id" field from list_datasources results, NOT the "dataSourceId" field. These are different values.

Time ranges: Use epoch seconds (e.g., 1711152000), ISO dates (e.g., "2026-03-22T00:00:00Z"), or relative strings ("-6h", "-24h", "-7d"). Defaults to last 24 hours if omitted.

Available fields:
- datasources: health://logicmonitor/fields/device_datasource
- instances: health://logicmonitor/fields/device_datasource_instance

Note: This is a read-only tool for querying monitoring data.`,
    inputSchema: DeviceDataOperationArgsSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'lm_session',
    title: 'LogicMonitor Session Management',
    description: `Manage session state, variables, and operation history across tool calls.

OPERATIONS:

1. list - Review the latest tool calls, stored variables, and applyToPrevious candidates (limit: default 10, max 50).
2. get - Fetch a session snapshot or specific variable. Supports filtering for array variables:
   - key: variable name (e.g., "lastDeviceList")
   - fields: comma-separated field projection (e.g., "id,displayName") to reduce payload size
   - index: return a single item by position (0-based)
   - limit: return only the first N items
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
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_sdt',
    title: 'LogicMonitor SDT Management',
    description: `Manage LogicMonitor Scheduled Down Times (SDTs). Supports the following operations:
- list: Retrieve SDTs with optional filtering and field selection
- get: Get a specific SDT by ID
- create: Create SDTs to suppress alerting during maintenance windows
- update: Update existing SDTs (modify schedule, comment, etc.)
- delete: Delete/end SDTs

Available fields can be found at: health://logicmonitor/fields/sdt

SDT target types (type field, required for create):
- ResourceSDT: Suppress alerts for a specific device (requires deviceId or deviceDisplayName)
- ResourceGroupSDT: Suppress alerts for a device group (requires deviceGroupId)
- WebsiteSDT: Suppress alerts for a website (requires websiteId)
- WebsiteGroupSDT: Suppress alerts for a website group (requires websiteGroupId)
- CollectorSDT: Suppress alerts for a collector (requires collectorId)
- DeviceDataSourceSDT: Suppress alerts for a device datasource (requires deviceId + dataSourceId)
- DeviceDataSourceInstanceSDT: Suppress alerts for a specific instance

Schedule types (sdtType field):
- oneTime: Single occurrence — set startDateTime and endDateTime (epoch ms)
- daily/weekly/monthly/monthlyByWeek: Recurring — set hour, minute, endHour, endMinute, duration, plus weekDay/monthDay/weekOfMonth as applicable

Common workflow:
1. Find the target resource ID (e.g., lm_device list to find deviceId)
2. Create SDT: lm_sdt create with type="ResourceSDT", deviceId=<id>, sdtType="oneTime", startDateTime=<ms>, endDateTime=<ms>, comment="reason"

Note: SDT IDs are strings in format "XX_##" (e.g., "R_42", "D_15").

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Batch operations support:
- Explicit arrays via 'sdts' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all SDTs matching a filter`,
    inputSchema: SdtOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'lm_opsnote',
    title: 'LogicMonitor OpsNote Management',
    description: `Manage LogicMonitor OpsNotes (operational notes for change tracking and incident documentation). Supports the following operations:
- list: Retrieve opsnotes with optional filtering and field selection
- get: Get a specific opsnote by ID
- create: Create opsnotes to document changes, deployments, or incidents
- update: Update existing opsnotes
- delete: Delete opsnotes

Available fields can be found at: health://logicmonitor/fields/opsnote

OpsNotes can be scoped to specific resources:
- Scope types: device, service (website), deviceGroup, serviceGroup (websiteGroup)
- Notes with no scope appear for everything in the account
- Example scopes: [{type: "device", deviceId: 42}] or [{type: "deviceGroup", deviceGroupId: 5}]

Tags: Associate notes with tags for categorization. Use name to create/reference: [{name: "deployment"}, {name: "maintenance"}]

Filter fields: tags, createdBy, happenedOn, monitorObjectGroups, monitorObjectNames, or _all.

Pagination: size (default 50, max 1000), offset (default 0). Set autoPaginate: true to retrieve all pages automatically.

Batch operations support:
- Explicit arrays via 'opsnotes' parameter
- applyToPrevious: Reference session variables for batch operations
- filter: Apply operations to all opsnotes matching a filter`,
    inputSchema: OpsnoteOperationArgsSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
];

function decorateToolDefinition(definition: ToolRegistration): ToolRegistration {
  const suffix = definition.name === 'lm_session'
    ? SESSION_PORTAL_DESCRIPTION_SUFFIX
    : LISTENER_PORTAL_DESCRIPTION_SUFFIX;

  return {
    ...definition,
    description: definition.description ? `${definition.description}${suffix}` : suffix,
  };
}

/**
 * Registers all tools from TOOL_DEFINITIONS with the MCP server and returns
 * the full ToolRegistration[] array for use in ListTools response building.
 */
export function registerAllTools(
  server: McpServer,
  handler: ToolCallback
): ToolRegistration[] {
  return TOOL_DEFINITIONS.map((def) => {
    const decorated = decorateToolDefinition(def);
    const { name, ...toolDef } = decorated;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.registerTool(name, toolDef as any, handler);
    return decorated;
  });
}
