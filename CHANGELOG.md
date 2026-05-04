## 2.1.2

### Dependencies
- **axios** – Upgraded axios and related packages to versions that address reported security vulnerabilities.

---

## 2.1.1

### Bug Fix
- **Stdio stdout pollution** – Fixed a bug where Winston log output and audit log entries were written to `stdout` during server startup in stdio mode. MCP clients reading stdout for JSON-RPC (Claude Desktop, Cursor, etc.) would fail with a Zod `invalid_union` validation error on the non-JSON-RPC log lines.
- All Winston console transports now route to `stderr` in stdio mode, keeping `stdout` clean for JSON-RPC.
- `AuditLogger` accepts a `useStderr` flag so its transport also writes to `stderr` in stdio mode.
- `startStdioServer()` logger is no longer restricted to `error` level — all configured levels flow to `stderr`.

---

## 2.1.0

### New Resources
- **SDT (Scheduled Down Time)** – Full CRUD via `lm_sdt`. Supports oneTime, daily, weekly, monthly, and monthlyByWeek schedules targeting devices, device groups, websites, collectors, and datasources.
- **OpsNotes** – Full CRUD via `lm_opsnote`. Scoped visibility (device, service, deviceGroup, serviceGroup) with tag-based categorization.

### Intelligent Response Formatting (Token Reduction)
- **Compact list views** – Lists with >5 items return key-field summary tables instead of full JSON.
- **Time-series data optimization** – Device data responses include summary statistics (min/max/avg/latest) plus sampled data points.
- **Batch result summaries** – Large batch operations return only failure details; full per-item results stored in session.
- **Internal field stripping** – `raw`, `meta`, and `request` fields removed from tool responses.

### Session Filtering Enhancements
- `lm_session get` now supports `fields` (projection), `index` (single item), and `limit` (first N items) for on-demand filtering of stored results.

### Improved Error Messages
- API errors now include `errorMessage`, `errorCode`, and `errorDetail` from the LogicMonitor response body.
- Status-based hints (404: verify IDs, 401/403: check permissions, 429: rate limited) help LLMs recover.

### Device Data Reliability
- **Relative time parsing** – Time parameters support `-6h`, `-24h`, `-7d`, `-30m`, `"now"`, ISO dates, and epoch seconds.
- **Datasource ID disambiguation** – Tool descriptions clarify `id` vs `dataSourceId`.

### Schema Flattening for MCP Clients
- Fixed Zod v4 `oneOf` discriminated unions not recognized by MCP clients. ListTools handler now flattens both `anyOf` and `oneOf` formats.

### LLM Evaluation Harness
- New `tests/eval/` system with 60+ scenarios across 8 categories, multi-provider support (OpenAI GPT-4o, GPT-5.4), scoring engine, and multi-step workflow testing.

### Audit Logging & Security
- Structured audit logging for server events, auth, sessions, and tool calls.
- Bearer tokens hashed with SHA-256.
- Graceful shutdown with clean session closure on SIGTERM/SIGINT.

### Winston Transport Leak Fix
- Fixed memory leak in HTTP mode where session Winston transports were never removed on close.

---

## 2.0.0

### Architecture Modernization
- **Zod validation** – Migrated from Joi to Zod for compile-time type safety and discriminated unions.
- **MCP SDK high-level API** – All tools use `registerTool()` instead of manual `setRequestHandler()`.
- **Unified resource pattern** – Every tool follows `list`, `get`, `create`, `update`, `delete` operations.
- **Enhanced batch operations** – Explicit arrays, session variable references (`applyToPrevious`), and filter-based operations.
- **Smart pagination** – `autoPaginate` parameter for fine-grained control over result sets.

### New Resource Coverage
- **Device Data** – Datasources, instances, and performance metrics.
- **Collector Groups** – Full CRUD for organizing collectors.
- **Dashboards** – Create, update, and manage dashboards.
- **Users** – Complete user management with role assignments and batch operations.

### Developer Experience
- Removed ~2,000 lines of deprecated code (Joi schemas, legacy tool definitions).
- Standardized MCP error codes and validation messages.
- 170+ tests covering CRUD, batch processing, field selection, and error handling.

### Resource Health & Discovery
- Field metadata resources (`health://logicmonitor/fields/{resource}`).
- Per-tool health telemetry via `health://logicmonitor/status`.
- Enhanced session tool for variables, history, and multi-step context.

### Breaking Changes
- Tool input schemas now use `operation` parameter instead of separate tools per operation.
- Switched from Joi to Zod validation.
- Omit `fields` parameter for all fields (instead of `fields: "*"`).
- Update operations use `opType=replace` for custom property merging.

---

## 1.2.0 – 2025-10-28

### Highlights
- Migrated the project to the new `@modelcontextprotocol/sdk` server layer. `src/index.ts` now hosts both STDIO and HTTP transports backed by a shared `createServer` helper, while `src/server.ts` exposes richer instructions, session-aware behaviour, and centralized error logging.
- Added a session framework (`src/session/sessionManager.ts`) and a suite of `lm_*_session_*` tools so assistants can store/retrieve variables, inspect history, and manage session state within a conversation.
- Overhauled the LogicMonitor client (`src/api/client.ts`): every call now returns raw API payloads plus structured metadata (request details, timing, rate-limit headers). LogicMonitor-specific failures are normalized through the new `LogicMonitorApiError` class.
- Introduced per-tool success/failure metrics recorded by `src/metrics/metricsManager.ts` and surfaced through the MCP resource `health://logicmonitor/status` for health monitoring.
- Expanded and hardended all tool handlers (devices, device groups, websites, website groups, collectors, alerts). They now validate input with JOI schemas, leverage the shared `batchProcessor`, store session context, and provide consistent raw responses for both single and batch operations.

### Field Metadata & Validation
- Added Swagger-driven field metadata resources (`health://logicmonitor/fields/<resource>`) so agents can discover valid field names for each LogicMonitor entity. Tool descriptions reference these URIs, and the server instructions highlight where to find them.
- All list/get tools validate requested fields against the Swagger definitions using `sanitizeFields`; invalid names produce clear MCP errors before an API call is issued.
- A lightweight utility (`tests/test-field-metadata.js`) prints the known field lists and verifies the validation logic against the compiled build.

### Quality & Developer Experience
- Standardised batch error handling via the reusable `throwBatchFailure` helper, ensuring detailed diagnostics (status, code, request IDs) flow into metrics and agent responses.
- Documentation (`README.md`) now reflects the raw-response contract, request metadata, health resources, and instructions for retrieving field lists.
- Numerous TypeScript typing improvements across tools keep local casts honest while still returning raw payloads to the caller.
