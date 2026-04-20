# setup-and-doctor

## When to use this skill
Use this skill when you need to confirm the LogicMonitor Codex plugin is wired correctly in this fork, especially after a fresh clone, a launcher change, a build, or a listener-auth setup change.

## Mode selection
Prefer the source-checkout workflow for this fork when you need the listener-backed local Codex path. Use the default shareable path when you are intentionally testing the bearer-token-first setup.

## Preflight sequence
Start from the repository root and confirm the active workspace, then check the project instructions in `AGENTS.md`, the top-level usage notes in `README.md`, the local launcher in `scripts/start-logicmonitor-mcp.sh`, and the test guidance in `tests/README.md`.

After that, verify that dependencies are installed, the build output exists, and the launcher points at the current checkout rather than an old scratch path.

## Launcher validation
Validate that the plugin launcher is using stdio and that the advanced-local path delegates to `scripts/start-logicmonitor-mcp.sh`. In the local listener-backed flow, the launcher should expect a built `dist/index.js` plus an ignored `.env.codex.local` file and should reject bearer-token variables when the session-based launcher is in use.

## When to stop and ask the user
Stop and ask before changing the auth model, moving the launcher to a different checkout, or broadening setup beyond this fork. Also pause if the launcher still points at an unexpected path, the build artifact is missing, or the session-listener details are not known.

## Truth sources
- `README.md`
- `AGENTS.md`
- `scripts/start-logicmonitor-mcp.sh`
- `tests/README.md`
