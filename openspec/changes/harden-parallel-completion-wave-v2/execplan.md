# ExecPlan: Harden Massive Parallel Completion Wave V2

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Turn the accepted massive parallel completion wave into production-grade behavior: correct durable semantics, coherent Backup/Portable/Supabase evolution, complete remote/native integrations, broad regression coverage, and exact-head CI closure.

## Context

- Repository: `quantdale/super-habits`.
- Authoring baseline: `4b9b8ccf0dee7ce9ed9b1c6b8b6a10e3c7732051` on remote `main` only.
- Prior implementation campaign: `openspec/changes/complete-product-roadmap-parallel-wave-v2/`.
- Primary input: its `HARDENING_HANDOFF.md`.
- The wave touched more than one hundred files across nearly every feature and intentionally deferred broad QA.
- Critical correction: the prior wave documents call the local schema v15, but authoritative `core/db/client.ts` already contains migrations 16, 17, 18, and 19. New local schema work must start from the actual next free migration, expected >=20.
- Current production Supabase already supports the pre-wave Backup Scope V4 planning contract; new durable fields from this hardening may require further additive DDL/version evolution.

Authoritative artifacts:

- `proposal.md`
- `design.md`
- `specs/parallel-wave-v2-hardening/spec.md`
- `tasks.md`
- this ExecPlan

## Scope

- Reconcile swarm residue and safe parallel workflow.
- Full correctness/regression hardening for all accepted V2 wave capabilities.
- Durable promotion of domain state that should survive reinstall/restore.
- Backup/Restore/Portable/Supabase contract evolution for approved fields/settings.
- Command Edge Function parity and deployment when accessible.
- Notification response action completion.
- Multi-record transaction/idempotency repairs.
- PWA/browser/native-as-available verification.
- Live Supabase migration/advisor/remote-boundary verification where access exists.
- Exact-final-SHA GitHub quality/e2e closure.

## Non-Goals

- Unrelated feature expansion.
- Force-push/history rewrite for mixed swarm attribution.
- Weakening ownership, RLS, restore emptiness, Backup/Portable integrity, Linked Action exactly-once, or canonical mutation boundaries.
- Faking environment-dependent native results.

## Current Checkpoint

- Current milestone: HARDENING_HANDOFF_AUTHORED.
- Completed: independently verified current main equals the reported wave SHA; compared the wave against pre-wave `6dbbc426...` and confirmed a broad multi-feature implementation; read the completed wave ExecPlan and hardening handoff; verified only remote `main` exists; independently verified authoritative SQLite migrations already run through v19; inspected device-local Habit lifecycle and Pomodoro session metadata stores and confirmed both are currently lost on restore/reinstall.
- In progress: None — implementation session has not started.
- modifiedFiles: None yet in implementation; this spec-authoring commit adds only `openspec/changes/harden-parallel-completion-wave-v2/**`.
- Important modified files: None yet beyond this OpenSpec handoff.
- Last successful validation: authoring review against GitHub source; OpenSpec/ExecPlan validators must be run by the implementation session immediately after pulling this handoff.
- Current failures: Broad regression has not yet been run by design; prior wave explicitly deferred it.
- Relevant quarantines: None accepted as final; classify any existing test skips/quarantines during QA rather than assuming they are harmless.
- Blockers: None known at authoring.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Fresh session fetch/prune latest main, read this change and prior `HARDENING_HANDOFF.md`, reconcile actual migration/version state, run plan/OpenSpec validators, then execute tasks 0 and 1 before schema changes.
- Remaining definition of done: every non-environment task in `tasks.md` satisfied with evidence; all current durable-domain state coherently represented across local/Backup/Portable/remote layers; full required QA green; live remote convergence complete where required and accessible; clean main-only Git state; exact final SHA has GitHub quality and e2e success.

## Progress

- [x] Authoring: independently review swarm result and current GitHub main.
- [x] Authoring: identify stale schema-version narrative and durable AsyncStorage risks.
- [x] Authoring: persist hardening proposal/design/spec/tasks/ExecPlan.
- [ ] Reconcile current repository and clean swarm residue.
- [ ] Establish baseline full-QA failure inventory.
- [ ] Harden Habit lifecycle durability/history semantics.
- [ ] Harden Pomodoro session metadata durability.
- [ ] Establish real Workout metric provenance and persistence.
- [ ] Evolve Backup/Restore/Portable/settings contracts safely.
- [ ] Evolve/apply Supabase schema and validator safely.
- [ ] Close remote Command parser/classifier parity.
- [ ] Close Todo notification actions.
- [ ] Harden batch/copy/apply transaction and idempotency semantics.
- [ ] Harden cross-feature aggregates and PWA behavior.
- [ ] Run full unit/E2E/sync/simulation/timezone/native-as-available regression.
- [ ] Verify live remote state/advisors/deployment.
- [ ] Obtain exact-final-SHA GitHub quality/e2e green and close plan.

## Surprises & Discoveries

- 2026-08-21 — Prior swarm documentation repeatedly says schema v15 even though `core/db/client.ts` already has migrations through v19; any v16 SCHEMA_REQUEST instruction is stale and dangerous.
- 2026-08-21 — Habit pause/archive state currently lives only in AsyncStorage, so its scheduling/actionability meaning disappears on restore/reinstall.
- 2026-08-21 — Pomodoro Todo associations and notes currently live only in AsyncStorage even though they describe completed session history.
- 2026-08-21 — The wave itself reports lint-staged stash races that temporarily deleted/merged worker content; hardening must reconcile local stash residue and prevent recurrence.

## Decision Log

- 2026-08-21 — Hardening is a convergence campaign, not another breadth wave.
- 2026-08-21 — Migration numbering derives from authoritative code, never the stale wave narrative.
- 2026-08-21 — User-domain state that changes recorded behavior/history should survive restore; presentation/privacy-oriented preferences may remain local by explicit decision.
- 2026-08-21 — Do not blindly apply the handoff's workout SQL; first prove the correct data model and input provenance.
- 2026-08-21 — Shared persistence/backup/sync hotspots remain primary-agent-owned even if sub-agents are used for parallel hardening audits.

## Validation Ledger

- 2026-08-21 — GitHub compare `6dbbc426...` -> `4b9b8ccf...` — PASS — 45 commits, broad multi-feature wave present.
- 2026-08-21 — remote branch search — PASS — `main` only.
- 2026-08-21 — source inspection `core/db/client.ts` — PASS — migrations 16–19 exist; next new migration must be >=20.
- 2026-08-21 — source inspection Habit lifecycle store — PASS — AsyncStorage-only lifecycle confirmed.
- 2026-08-21 — source inspection Pomodoro session metadata store — PASS — AsyncStorage-only association/note confirmed.

## Changed Files / Areas

Expected hardening areas include:

- `core/db/client.ts`, `core/db/types.ts`
- `features/habits/**`, `features/pomodoro/**`, `features/workout/**`
- affected Todos/Calories/Planning/Overview/Progress/Activity/Command/Settings files
- `core/backup/**`, `core/portable/**`, `core/sync/**`
- `core/notifications/**`, `lib/notifications.ts`
- `supabase/migrations/**`, `supabase/functions/parse-ai-command/**`
- simulation schema, schema validator, tests/e2e/QA artifacts
- this change's tasks/ExecPlan

Git remains authoritative for the actual diff.

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md`.
2. Read this entire change and prior wave `HARDENING_HANDOFF.md`.
3. Fetch/prune and reconcile latest origin/main.
4. Inspect `git status --short`, stashes, merge markers, actual migration head, current backup/portable versions, and live-access configuration.
5. Run `npm run agent:resume -- --plan openspec/changes/harden-parallel-completion-wave-v2/execplan.md` if supported.
6. Run OpenSpec/ExecPlan validators before implementation.
7. Continue only from `Exact next action`, updating this checkpoint whenever actual state differs.

## Outcomes & Retrospective

- Status: Active.
- Summary: Hardening implementation has not started; this plan captures the audited starting state and required convergence work.
- Follow-up: None yet; final follow-ups must be limited to genuinely environment-dependent or explicitly non-gating items after the campaign runs.
