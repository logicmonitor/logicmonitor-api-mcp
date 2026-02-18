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

## Complete Tool List

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

## 📚 Migration Guide

### From v1.x to v2.0

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