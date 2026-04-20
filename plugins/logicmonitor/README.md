# What this plugin is

This plugin is a thin Codex wrapper around the LogicMonitor MCP server in this repository. The MCP server remains the source of truth for tool behavior, auth resolution, portal routing, and session state.

# Mode summary

| Mode | Default audience | Launcher | Auth posture |
| --- | --- | --- | --- |
| Standard | Shareable/default | `launch.sh -> dist/index.js --stdio` | Bearer token |
| Advanced local | Repo checkout users | `scripts/start-logicmonitor-mcp.sh` | Listener/session |

# Standard mode

Use `Standard` mode when you want the default shareable setup. The plugin prefers the packaged `dist/index.js --stdio` path and only falls back to `npx -y logicmonitor-api-mcp --stdio` when the packaged entrypoint is unavailable.

This mode is bearer-token-first and expects `LM_ACCOUNT` plus `LM_BEARER_TOKEN` in the plugin environment.

# Advanced local mode

Use `Advanced local` when you are running from this repository checkout and want the listener-backed local workflow. The plugin delegates to `scripts/start-logicmonitor-mcp.sh`, which expects a built `dist/index.js` plus an ignored `.env.codex.local` file.

That local env file should include `LM_SESSION_LISTENER_BASE_URL`, and it can optionally include `LM_PORTAL` as a default portal.

# Doctor workflow

Run `plugins/logicmonitor/scripts/doctor.sh` when the plugin picks the wrong mode, the launcher path looks stale, or the listener-backed setup is not behaving the way you expect.

The doctor script reports which mode will run, checks the prerequisites for that mode, and points you back to the repo-local launcher or env configuration instead of duplicating MCP behavior in the plugin.

# What stays authoritative in the MCP server

The MCP server remains authoritative for tool schemas, auth and portal precedence, session storage, and request handling. This plugin only describes how Codex reaches the server and how to validate the two supported setup modes.
