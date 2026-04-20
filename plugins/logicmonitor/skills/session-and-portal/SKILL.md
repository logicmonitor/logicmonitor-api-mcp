# session-and-portal

## When to use
Use this skill when a task depends on listener-backed session auth, selecting the correct LogicMonitor portal, or understanding how portal-scoped session state is reused across calls.

## Portal precedence
In listener mode, portal selection follows this order: an explicit tool `portal` first, then the session default stored in `lm_session`, and then the fallback `LM_PORTAL` configuration.

## How to inspect lm_session
Use `lm_session get` when you need to confirm the current default portal, the list of available portals, or the portal-scoped session state already recorded for the conversation.

If you need a fuller picture of recent work, inspect session history before repeating a query or starting a follow-up write.

## Multi-portal workflow
When more than one portal is available, treat the portal as part of the request context. Reuse the session default when it is correct, otherwise pass the target portal explicitly and let the session state capture the portal-specific scope for later reuse.

## Failure modes
If no portal can be resolved, the issue is usually missing listener context, a missing session default portal, or a missing fallback portal configuration. If a portal exists but no active session is loaded, refresh the target LogicMonitor portal page while the listener is running and try again.

If the listener cannot return portals or a portal session, treat that as a listener or auth problem rather than a LogicMonitor resource problem.

## What this skill must not redefine
Do not restate the low-level session schema or resource-specific call shapes here. This skill only explains portal choice, session inspection, and the listener-backed workflow.

## Truth sources
- `README.md`
- `AGENTS.md`
- `src/auth/portalResolution.ts`
- `src/api/sessionAuth.ts`
- `src/session/portalSessionState.ts`
