# LogicMonitor MCP Server v1.2.0

## Highlights

- **Smarter agent experience** – the server now advertises field metadata resources so assistants can discover valid fields for each LogicMonitor resource before making a call.
- **Cleaner, richer responses** – every tool returns the full LogicMonitor payload along with request metadata, making conversational workflows align with direct API usage.
- **Consistent batching** – shared diagnostics and error handling across all batch-capable tools ensure LogicMonitor status codes and request IDs are surfaced uniformly.
- **Session intelligence** – new session helpers let agents store variables, inspect history, and maintain context across steps.
- **Health telemetry** – per-tool success/failure metrics are exposed via `health://logicmonitor/status` for easier monitoring.
- **Docs & validation upgrades** – clearer instructions, better runtime validation, and improved error messages reduce guesswork for anyone using the tools.