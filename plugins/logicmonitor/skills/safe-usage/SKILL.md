# safe-usage

## Purpose
Use this skill to keep LogicMonitor tool use deliberate, evidence-based, and low-risk. It is the guardrail skill for reading first, confirming writes, and avoiding accidental batch blast radius.

## Read-first workflow
Start by checking the repository guidance and the server-side session or field hints before acting. Reuse existing results when possible, confirm valid field names from the repository sources, and avoid duplicate list calls when session state already has what you need.

Treat the available tools as a workflow set. Pick the smallest operation that answers the question, then verify the result against the returned payload and session context.

## Write confirmation rules
For create, update, delete, or other state-changing work, confirm the target, the intended scope, and the expected effect before running the change. If the user has not clearly described the outcome, ask a brief clarifying question instead of guessing.

If a write depends on prior results, confirm that the stored session state still reflects the objects you intend to touch before making the change.

## Batch-risk rules
Batch operations should be treated as high impact even when the underlying action seems routine. Always verify the filter, the scope, and the resulting set before proceeding, and prefer reusing stored session handles when the repository has already captured them.

Do not expand a batch beyond the user's request just because more targets are available. If the blast radius is unclear, stop and narrow it first.

## Verification expectations
Check the returned payload after each important action and compare it with what you expected to happen. When the repository offers a dedicated session or history view, use it to verify the change, confirm reuse of prior results, and make follow-up actions safer.

## Out of scope
This skill does not repeat resource-by-resource syntax, parameter tables, or exact endpoint inventories. It also does not replace the repository docs for installation, launcher setup, or listener-auth behavior.

## Truth sources
- `README.md`
- `tests/README.md`
- `AGENTS.md`
- `src/server.ts`
