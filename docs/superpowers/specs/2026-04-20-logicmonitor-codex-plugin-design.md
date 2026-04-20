# LogicMonitor Codex Plugin Design

Date: 2026-04-20
Status: Proposed
Repository: `/Users/tyler.wisdom/Desktop/Projects/logicmonitor-api-mcp`

## Summary

Build a single `logicmonitor` Codex Plugin that wraps `logicmonitor-api-mcp` as the canonical MCP product and adds Codex-specific value on top: setup checks, safer defaults, launcher selection, and LM-focused skills.

The plugin should support two setup modes:

- `Standard`: self-contained from `npm`, bearer-token-first, shareable/installable, no repo checkout required.
- `Advanced local`: checkout-aware, optimized for local development in this repository, with listener/session helpers, repo launcher support, and stronger diagnostics.

The plugin should be implemented now as a repo-local scaffold in this repository, but designed so the same plugin structure can back a shareable/installable artifact later.

This design incorporates the conclusions from the comparative review in `.tmp/logicmonitor-mcp-comparative-review-2026-04-20.md`: `logicmonitor-api-mcp` remains the long-term MCP home; `health-check-automation` contributes patterns to import selectively, especially around session lifecycle, confirmation gating, structured responses, and verification discipline.

## Goals

- Create one canonical Codex Plugin identity for LogicMonitor.
- Keep `logicmonitor-api-mcp` as the source of truth for LogicMonitor MCP behavior.
- Make the shareable/default plugin install path self-contained and `npm`-friendly.
- Provide a first-class local developer workflow for this checkout without making local/session-heavy behavior the public default.
- Bundle Codex-specific extras that improve usability for internal/power users:
  - LM-focused skills
  - setup and doctor checks
  - launcher helpers
  - safer onboarding defaults
- Preserve a clean expansion seam for a future full internal operations suite plugin.

## Non-goals

- Do not turn the phase-one plugin into a full internal operations suite.
- Do not duplicate core LogicMonitor API semantics in plugin logic.
- Do not make listener/session auth the default onboarding path for distributed installs.
- Do not require a source checkout for essential plugin functionality.
- Do not import `health-check-automation` governance/process machinery into this repo.

## Product posture

### Canonical ownership

`logicmonitor-api-mcp` remains the canonical MCP product. The plugin is a Codex-native wrapper around that product, not a replacement and not a second LogicMonitor control plane.

### User posture

The plugin is designed primarily for internal/power users, but its default installation model should still be clean, supportable, and shareable. That means the install story must remain self-contained from `npm`, even if advanced value is unlocked by working from a source checkout.

### Future posture

The initial plugin is intentionally narrower than a full internal operations suite. If internal-only workflows accumulate enough value and stability, they should expand into a second-layer plugin or a future forked suite rather than being forced into the phase-one plugin prematurely.

## Recommended plugin shape

### Chosen approach

Adopt `Approach 2`: a workflow plugin around the MCP server.

That means:

- One plugin identity: `logicmonitor`
- One marketplace presence
- One documentation surface
- Two operating modes
- MCP server remains the execution core
- Plugin adds Codex-native ergonomics and workflow guidance

### Rejected alternatives

#### Thin wrapper only

Rejected because it underuses plugin value. It would package the server but would not add enough Codex-specific setup, skill, or diagnostic leverage for the internal/power-user audience.

#### Full internal operations suite now

Rejected because it would recreate the same repo-gravity and scope drift risks identified in the comparative review. The initial plugin should stay tightly coupled to the MCP product, not become a broader automation platform.

#### Two separate plugin variants

Rejected because it would split docs, create plugin drift risk, and weaken the “one MCP product, one plugin identity” decision.

## Installation and distribution model

### Default distribution path

The distributed plugin should be `npm`-first.

The core assumption for a normal install is:

- no local repo checkout
- no local build requirement
- bearer-token-first onboarding
- clean Codex Plugin install experience

### Local development path

The same plugin should also support an `Advanced local` mode when used from a valid source checkout. In that mode, the plugin may switch to repo-aware launcher and diagnostic behavior, but only as an enhancement layer.

### Rule

No essential plugin capability should require a source checkout.

## Authentication posture

### Public/default posture

The distributed/default plugin should be bearer-token-first.

That aligns with the comparative review and with LogicMonitor’s official API guidance: the plugin’s public contract should optimize for supportable API-oriented auth rather than browser-derived session capture.

### Advanced local posture

Listener/session auth should be supported, but clearly labeled as:

- `advanced local`
- `developer mode`
- optional

It should never appear to be the standard or preferred onboarding path for all users.

### Silent fallback policy

The plugin should not silently change auth posture. If it switches launch behavior, auth expectations, or setup mode, it must explain that clearly to the user.

## Plugin architecture

### High-level model

The plugin consists of four major layers:

1. `Plugin identity and metadata`
2. `MCP wiring and launcher selection`
3. `Setup and doctor logic`
4. `LM-focused Codex skills`

The MCP server stays external to plugin logic in the architectural sense, even though the repo-local scaffold lives in the same repository.

### Principle

If behavior belongs in the LogicMonitor MCP contract itself, it should be implemented in `logicmonitor-api-mcp` and then surfaced by the plugin. The plugin should not redefine LogicMonitor semantics that properly belong in the server.

## Repository layout

The repo-local scaffold should live at:

`plugins/logicmonitor/`

Recommended phase-one structure:

```text
plugins/logicmonitor/
  .codex-plugin/
    plugin.json
  .mcp.json
  skills/
  scripts/
  assets/
```

Optional later additions:

```text
plugins/logicmonitor/
  .app.json
  hooks/
```

### Responsibility split

#### `.codex-plugin/plugin.json`

Owns:

- plugin identity
- display metadata
- install-facing metadata
- top-level user-visible plugin behavior

#### `.mcp.json`

Owns:

- how the plugin connects Codex to the LogicMonitor MCP server
- standard versus advanced-local launcher selection
- environment and connection defaults

#### `scripts/`

Owns:

- setup/preflight checks
- mode detection
- launcher helpers
- environment validation
- doctor commands

#### `skills/`

Owns:

- LM-focused workflow guidance
- auth-mode guidance
- session/multi-portal guidance
- safe read/write usage patterns

#### `assets/`

Owns:

- examples
- reference snippets
- supporting docs that help the plugin explain itself

## Runtime modes

### Mode 1: Standard

This is the default and shareable path.

Behavior:

- use the published `npm` package
- assume no source checkout
- prefer bearer-token-first setup
- validate runtime and environment prerequisites
- expose safe, clear setup guidance

Expected checks:

- Node is available
- the MCP package is installed or installable
- required bearer env configuration is present
- launch command is valid

### Mode 2: Advanced local

This is an explicitly local/developer enhancement path.

Behavior:

- detect or allow selection of a repo-local checkout
- prefer the repo launcher when appropriate
- validate local build state
- validate repo-local env files and local settings
- optionally expose listener/session workflow guidance

Expected checks:

- expected checkout files exist
- `scripts/start-logicmonitor-mcp.sh` exists and is usable
- local build artifacts exist or can be explained as missing
- `.env.codex.local` expectations are clear
- listener reachability is testable when listener/session mode is selected

### Mode activation

The plugin may auto-detect advanced-local eligibility, but the user-facing output should remain explicit. The plugin should say which mode it is using and why.

## Safer defaults

The plugin should apply these phase-one defaults:

- prefer `npm`-backed launch when no checkout is present
- prefer bearer-token-first onboarding
- label listener/session flows as advanced-local
- fail clearly when prerequisites are missing
- never silently switch modes or auth postures
- avoid presenting local/session-heavy behavior as the default public contract

## Setup and doctor behavior

The plugin should provide a setup and diagnostic layer that sits above raw server usage.

Recommended doctor/preflight checks:

- Is Node available?
- Is the MCP package installed or reachable?
- If in local mode, is the checkout valid?
- Is a local build present when required?
- Are required environment variables present for the chosen mode?
- If listener/session mode is selected, is the listener reachable?
- If listener/session mode is selected, can available portals be discovered?

Phase-one requirement:

The plugin should make setup status more understandable than using the MCP server directly.

## LM-focused skills

Phase-one skills should stay narrow and ergonomic. They should help users use the MCP server effectively without becoming a separate operations engine.

Recommended skill themes:

- setup and environment triage
- auth-mode selection guidance
- multi-portal session workflow guidance
- read-first LogicMonitor investigation patterns
- alert triage guidance
- device and dashboard retrieval guidance
- safe bulk-action framing
- session-handle reuse guidance (`lm_session`, stored context, prior-result reuse)

### Rule for skills

Skills should guide usage of the MCP server, not reimplement the LogicMonitor product or embed large volumes of operations logic.

If a skill becomes highly support-specific, team-specific, or logic-heavy, it likely belongs in a future internal operations suite plugin instead.

## Planned imports from comparative review

The plugin plan should explicitly assume future server-side improvements informed by the review:

- better session lifecycle modeling
- stronger structured outputs and error envelopes
- confirmation-gated risky actions
- improved verification discipline
- richer non-sensitive session inspection

The plugin should be designed to surface those improvements cleanly when they land in the MCP server, without needing a plugin rewrite.

## Explicit exclusions from phase one

Phase one should not include:

- a generic `portal_query`-first public plugin contract
- a full internal support/debug workflow suite
- HCA-style governance/runtime artifact machinery
- mandatory checkout-aware behavior
- mandatory listener/session auth
- duplicated server-side LogicMonitor semantics inside plugin scripts or skills

## Future expansion seam

The initial plugin should deliberately preserve a clean path to a later internal operations suite.

That expansion may take one of two shapes:

- an additive second-layer plugin for internal workflows
- a future forked internal operations suite plugin

Criteria that would justify expansion:

- repeated need for internal-only or support-specific workflows
- team-specific operational skills that do not belong in the shareable plugin
- desire for deeper operator automation beyond MCP launch/wiring and focused skills

The initial plugin must remain narrow enough that this future expansion is optional, not inevitable.

## Testing strategy

Testing should cover both plugin coherence and plugin-to-server integration.

### Plugin coherence

Validate:

- manifest correctness
- `.mcp.json` correctness
- mode-specific launcher wiring
- doctor/preflight script behavior
- skill consistency with intended plugin posture

### Integration correctness

Validate:

- `Standard` mode launches against the published/package-backed server path
- `Advanced local` mode launches against the local checkout path
- auth expectations match the selected mode
- errors are clear when prerequisites are missing

### Rollout sequence

1. Create repo-local scaffold
2. Validate it against this checkout
3. Harden doctor/setup experience
4. Prepare shareable artifact assumptions
5. Add marketplace-facing polish later if still useful

## Success criteria

Phase one is successful when all of the following are true:

- A user can use the plugin from `npm` without needing a local checkout.
- A user in this repository can use the same plugin in advanced-local mode.
- The plugin makes setup safer and clearer than raw MCP server usage.
- The plugin does not become a second source of truth for LogicMonitor behavior.
- The plugin creates a clean path for a future internal operations suite.

## Initial implementation target

Phase-one implementation should create a repo-local plugin scaffold that includes:

- `plugins/logicmonitor/.codex-plugin/plugin.json`
- `plugins/logicmonitor/.mcp.json`
- `plugins/logicmonitor/skills/`
- `plugins/logicmonitor/scripts/`
- optional `plugins/logicmonitor/assets/`

The scaffold should be designed so it can later support a shareable/installable artifact without needing a structural rewrite.
