## Why

Agent-facing guidance is the first thing every automated session reads, but it sits outside the doc-drift guard and currently instructs `build:web` before Playwright — the exact command that previously inlined live Supabase credentials from the developer `.env` and drained the sync outbox into the production project (`docs/testing/known-gaps.md:267`). `README.md:148` separately asserts the AI Ask experiment flag is "currently `true`", contradicting the code, a passing unit test, and both certification packets, and `core/db/schema.sql:6` still declares local schema version 24 while the runtime authority is 25. A reader has no mechanical way to distinguish truth from stale prose, and two of these stale statements describe a data-integrity incident and a shipped-AI-surface claim.

## What Changes

- Correct the web-export instruction in `CLAUDE.md:36,45`, `ONBOARDING.md:72`, and `docs/codex-workflow.md:35,69,70`: Playwright lanes MUST serve a `dist/` produced by `npm run build:e2e` (hermetic), never `npm run build:web`.
- Correct `README.md:148`: Ask/Auto are default-OFF behind `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT`; delete the false "currently `true`" claim and the 2026-08-05 enablement date; add the flag to the README/`CLAUDE.md` env-var lists and to `.env.example`; replace `.env.example`'s two invalid placeholder values with values `commandConfig.ts` actually accepts.
- Correct `core/db/schema.sql:6` to declare schema version 25, matching `core/db/client.ts`.
- Correct the provider bootstrap-order statements in `docs/PROJECT_STRUCTURE_MAP.md:62`, `README.md:81`, and `CLAUDE.md:59` to the real order in `core/providers/AppProviders.tsx:105-243` (sync hydrate precedes ownership reconciliation).
- Correct the four `--max-warnings` claims (`CLAUDE.md:26`, `.cursor/commands/pre-pr.md:262`, `.cursor/commands/audit-performance.md:128`, `docs/master-context.md:383`) to the pinned `0`.
- Demote `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md` out of `AGENTS.md` "Authoritative Docs" into an explicitly historical section, as its own header already self-declares.
- Extend `tests/agentDocConsistency.test.ts` so the runtime-derived values it already pins for `AGENTS.md`/copilot instructions are also pinned for `README.md`, `.cursor/rules/superhabits-rules.mdc`, `ONBOARDING.md`, `docs/codex-workflow.md`, and `core/db/schema.sql`, and so any agent doc that instructs `build:web` before a Playwright lane fails the test.
- Correct `docs/testing/known-gaps.md` gap 15's status label so it matches its own 2026-09-24 root-cause resolution note, and add a guard that fails when a register entry's status label contradicts a later resolution note in the same entry.

## Capabilities

### New Capabilities

- `agent-guidance-truth`: Agent-facing documentation and reference snapshots state only facts derivable from source; the superseded web-export instruction, the AI-rollout default, the local schema version, the bootstrap order, and the lint warning cap are each pinned by an executing guard, and any drift fails `qa:fast`.

### Modified Capabilities

None. The existing `agent-execplan-lifecycle` and `durable-agent-execplans` capabilities govern ExecPlan artifacts, not repository guidance prose, so no existing requirement changes scope.

## Impact

Touches documentation only plus one test file. No `app/`, `core/`, `features/`, or `lib/` product file changes; local schema stays 25 and no migration is earned. This change does not build, deploy, or query Supabase. Applying it removes the last instruction that can re-attach a local E2E run to the live project, and makes the guidance self-checking rather than hand-maintained.
