# LogicMonitor MCP Server v2.1.2

## Dependency and security updates

Patch release that bumps axios and related dependencies to versions that resolve reported security issues. No MCP tools or runtime behavior changes.

### Dependencies

- **axios** – Upgraded axios and related packages to versions that address reported security vulnerabilities.

### Upgrading from v2.1.1

Drop-in replacement. No configuration or API changes.

---

**Full Changelog**: See [CHANGELOG.md](CHANGELOG.md) for detailed changes.

---

# LogicMonitor MCP Server v2.1.1

## Stdio Transport Fix

Patch release that fixes a startup failure when using stdio-based MCP clients (Claude Desktop, Cursor, etc.).

### Bug Fix

- **Stdio stdout pollution** – Fixed a bug where Winston log output and audit log entries were written to `stdout` during server startup in stdio mode. MCP clients that read stdout exclusively for JSON-RPC messages (such as Claude Desktop) would receive non-JSON-RPC data like `{"level":"info","message":"Starting in STDIO mode","timestamp":"..."}` before the protocol handshake, causing a Zod validation error (`invalid_union` / `unrecognized_keys: ["level","message","timestamp"]`) and failing to connect.

### What Changed

- All Winston console transports now route to `stderr` when running in stdio mode (`--stdio`), keeping `stdout` clean for JSON-RPC.
- The `AuditLogger` accepts a `useStderr` flag so its dedicated transport also writes to `stderr` in stdio mode.
- The `startStdioServer()` logger is no longer restricted to `error` level — all configured log levels now flow to `stderr`, improving debuggability without polluting the protocol channel.

### Upgrading from v2.1.0

Drop-in replacement. No configuration or API changes.

---

**Full Changelog**: See [CHANGELOG.md](CHANGELOG.md) for detailed changes.

---

# LogicMonitor MCP Server v2.1.0

## New Resources, Smarter Responses, and LLM Eval System

Version 2.1 adds new resource coverage (SDT and OpsNotes), significantly reduces token usage through intelligent response formatting, and introduces an automated LLM evaluation harness for testing tool accuracy.

## Highlights

### New Resources

- **SDT (Scheduled Down Time)** – Full CRUD management of maintenance windows via `lm_sdt`. Create one-time or recurring SDTs targeting devices, device groups, websites, collectors, and datasources. Supports all schedule types: oneTime, daily, weekly, monthly, monthlyByWeek.

- **OpsNotes** – Full CRUD management of operational notes via `lm_opsnote`. Document deployments, incidents, and changes with scoped visibility (device, service, deviceGroup, serviceGroup) and tag-based categorization.

### Intelligent Response Formatting (Token Reduction)

Tool responses now adapt based on result size and operation type, dramatically reducing token usage for large result sets:

- **Compact list views** – Lists with more than 5 items return a key-field summary table instead of full JSON. Full details remain accessible via `lm_session get` with field projection.
- **Time-series data optimization** – Device data responses include summary statistics (min/max/avg/latest per metric) plus sampled data points instead of returning every row.
- **Batch result summaries** – Large batch operations return only failure details, with full per-item results stored in session.
- **Internal field stripping** – `raw`, `meta`, and `request` fields are removed from tool responses to reduce noise.

### Session Filtering Enhancements

The `lm_session get` operation now supports on-demand filtering to retrieve exactly what's needed from stored results:

- **`fields`** – Comma-separated field projection (e.g., `fields: "id,displayName,hostStatus"`)
- **`index`** – Return a single item by position from array variables
- **`limit`** – Return only the first N items

This pairs with compact responses — LLMs can list resources (compact table), then retrieve full details for specific items via session without re-querying the API.

### Improved Error Messages

API errors now flow through the full LogicMonitor error response including `errorMessage`, `errorCode`, and `errorDetail`. Status-based hints (404: verify IDs, 401/403: check permissions, 429: rate limited) help LLMs recover from failures.

### Device Data Reliability

- **Relative time parsing** – Time parameters now support `-6h`, `-24h`, `-7d`, `-30m`, `"now"`, ISO dates, and epoch seconds. Previously, relative strings like `-6h` silently failed.
- **Datasource ID disambiguation** – Tool descriptions now clearly distinguish between the `id` field (used for subsequent API calls) and the `dataSourceId` field (the global datasource identifier).

### Schema Flattening for MCP Clients

Fixed a compatibility issue where Zod v4's `oneOf` discriminated unions were not recognized by MCP clients (tools appeared with no parameters). The server now handles both `anyOf` and `oneOf` formats, and the ListTools handler correctly flattens discriminated unions so all parameters are visible.

### LLM Evaluation Harness

A new automated eval system (`tests/eval/`) tests how accurately LLMs interpret the MCP server's tool schemas:

- **Multi-provider support** – Currently supports OpenAI models (GPT-4o, GPT-5.4) via function calling
- **Scenario-based testing** – 60+ scenarios across 8 categories: device, alert, device-data, SDT, OpsNote, general tool selection, multi-step conversations, and multi-tool workflows
- **Scoring engine** – Evaluates tool selection accuracy, operation correctness, and parameter mapping with argument matchers (exact, contains, pattern, present, absent, oneOf, type)
- **Multi-step workflow testing** – Scenarios with synthetic results that test conversation context across 3-4 step workflows
- **CLI and Jest integration** – Run via `npm run eval` or `npm test -- tests/eval/`

### Audit Logging & Security

- **Structured audit logging** – Server events, auth successes/failures, session lifecycle, and tool calls are logged with clientId, authMode, IP, and requestId.
- **Bearer token security** – Tokens hashed with SHA-256 for defense-in-depth.
- **Graceful shutdown** – Clean session closure and transport cleanup on SIGTERM/SIGINT with configurable timeouts.

### Winston Transport Leak Fix

Fixed a memory leak in HTTP mode where each new session added a Winston logging transport that was never removed on session close. After 11+ sessions, Node.js would emit `MaxListenersExceededWarning`. Transports are now properly cleaned up on session close and eviction.

## Complete Tool List

All 13 tools:

1. **lm_device** – Device management with custom properties and host groups
2. **lm_device_group** – Device group hierarchy and dynamic membership
3. **lm_device_data** – Performance metrics, datasources, and instances
4. **lm_alert** – Alert management (list, get, update for ack/note/escalate)
5. **lm_collector** – Collector discovery and monitoring
6. **lm_collector_group** – Collector group organization
7. **lm_website** – Website monitoring (webcheck/pingcheck)
8. **lm_website_group** – Website group management
9. **lm_dashboard** – Dashboard creation and management
10. **lm_user** – User management with role assignments
11. **lm_sdt** – Scheduled Down Time management (new)
12. **lm_opsnote** – Operational notes and change tracking (new)
13. **lm_session** – Session state, variables, and operation history

## Upgrading from v2.0

No breaking changes. The new tools and response formatting are additive. Existing tool calls continue to work unchanged. The only observable difference is that large list responses now return compact tables instead of full JSON — use `lm_session get` with `fields`/`index`/`limit` to retrieve full details when needed.

---

**Full Changelog**: See [CHANGELOG.md](CHANGELOG.md) for detailed changes.

---

# LogicMonitor MCP Server v2.0.0

## Major Release - Complete Architecture Modernization

Version 2.0 represents a complete rewrite of the LogicMonitor MCP Server with modern validation, improved type safety, and expanded resource coverage.

## Highlights

### New Resource Coverage
- **Device Data** – Query datasources, instances, and performance metrics for devices
- **Collector Groups** – Full CRUD operations for organizing collectors
- **Dashboards** – Create, update, and manage LogicMonitor dashboards
- **Users** – Complete user management with role assignments and batch operations

### Architecture Improvements

- **Modern Validation with Zod** – Migrated from Joi to Zod for compile-time type safety and better error messages. All schemas now use discriminated unions for operation-specific validation with complex conditional logic via `superRefine`.

- **MCP SDK High-Level API** – All tools now use the recommended `registerTool()` API instead of manual `setRequestHandler()`, providing better integration with MCP clients and automatic schema handling.

- **Unified Resource Pattern** – Every tool now follows a consistent pattern with 5 core operations:
  - `list` – Retrieve resources with filtering, pagination, and field selection
  - `get` – Fetch individual resources by ID
  - `create` – Create single or batch resources
  - `update` – Update resources (single, batch arrays, or filter-based)
  - `delete` – Delete resources with batch support

- **Enhanced Batch Operations** – All tools support three batch modes:
  - Explicit arrays (e.g., `devices: [...]`)
  - Session variable references (`applyToPrevious: "lastDeviceList"`)
  - Filter-based operations (`filter: "hostStatus:dead"`)

- **Smart Pagination Control** – New `autoPaginate` parameter allows fine-grained control over result sets. Set to `false` to respect `size` limits, or `true` (default) to automatically fetch all pages.

- **Type-Safe Schemas** – Full TypeScript inference from Zod schemas to handlers, eliminating runtime type mismatches and providing better IDE autocomplete.

### Developer Experience

- **Cleaner Codebase** – Removed ~2,000 lines of deprecated code (Joi schemas, legacy tool definitions). All validation now uses a single source of truth per resource.

- **Consistent Error Handling** – Standardized MCP error codes and validation messages across all tools with detailed path information for debugging.

- **Better Testing** – Comprehensive test suite with 170+ tests covering CRUD operations, batch processing, field selection, and error handling for all 11 tools.

### Resource Health & Discovery

- **Field Metadata Resources** – Assistants can discover valid fields via `health://logicmonitor/fields/{resource}` before making API calls.

- **Health Telemetry** – Per-tool success/failure metrics exposed via `health://logicmonitor/status` for monitoring.

- **Session Management** – Enhanced session tool for storing variables, inspecting history, and maintaining context across multi-step workflows.

## Complete Tool List (v2.0)

All 11 tools now support the unified resource pattern:

1. **lm_device** – Device management with custom properties and host groups
2. **lm_device_group** – Device group hierarchy and dynamic membership
3. **lm_device_data** – Performance metrics, datasources, and instances
4. **lm_alert** – Alert management (list, get, update for ack/note/escalate)
5. **lm_collector** – Collector discovery and monitoring
6. **lm_collector_group** – Collector group organization
7. **lm_website** – Website monitoring (webcheck/pingcheck)
8. **lm_website_group** – Website group management
9. **lm_dashboard** – Dashboard creation and management
10. **lm_user** – User management with role assignments
11. **lm_session** – Session state, variables, and operation history

## Breaking Changes/Fixes

- **Tool Input Schema Changes** – All tools now use `operation` parameter with values like `list`, `get`, `create`, `update`, `delete` instead of separate tools per operation.

- **Validation Library Change** – Switched from Joi to Zod. Custom validation logic may need updates if extending the server.

- **Field Selection** – To request all fields, omit the `fields` parameter entirely instead of passing `fields: "*"`.

- **Custom Properties** – Update operations now use `opType=replace` to merge custom properties instead of overwriting them.

## Migration Guide (v1.x to v2.0)

**Before (v1.x):**
```javascript
// Separate tools per operation
await callTool('lm_list_devices', { filter: 'hostStatus:alive' })
await callTool('lm_create_device', { displayName: 'server1', ... })
```

**After (v2.0):**
```javascript
// Unified tool with operation parameter
await callTool('lm_device', {
  operation: 'list',
  filter: 'hostStatus:alive'
})
await callTool('lm_device', {
  operation: 'create',
  displayName: 'server1',
  ...
})
```

---

**Full Changelog**: See [CHANGELOG.md](CHANGELOG.md) for detailed changes.