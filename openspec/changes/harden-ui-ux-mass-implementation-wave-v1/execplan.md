# ExecPlan: Harden UI/UX Mass Implementation Wave V1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Convert the latest code-only Warm Momentum/UI-UX mass implementation wave into a production-grade, regression-verified state while also reconciling the older still-ACTIVE `harden-parallel-completion-wave-v2` campaign.

## Context

- Repository: `quantdale/super-habits`.
- Post-wave baseline independently verified: `6dd41bbd51f091aed44f4918ca8f336ec5c421c9` equals remote `main`.
- Only remote branch is `main`.
- Wave range: `3ee030cbefb0bbc4438a062e63509adc3656ae4e..6dd41bbd51f091aed44f4918ca8f336ec5c421c9`, 19 commits, 82 changed files, roughly +9101/-808.
- `docs/ui-ux-design-dna` was merged intact and deleted remotely.
- The implementation wave intentionally ran only typecheck + slice lint and deferred broad QA.
- Older hardening plan `openspec/changes/harden-parallel-completion-wave-v2/execplan.md` remains ACTIVE and contains pre-UI-wave E2E checkpoint state; it must be reconciled, not ignored.
- Authoritative SQLite chain now ends at migration 21 (`daily_plans.top_todo_titles`). New migration work starts from the actual next free version, expected >=22.
- Independent live Supabase check after the wave: migration ledger currently ends at `20260820010000_planning_schema_convergence`. Repository migrations `20260821000000`, `20260821010000`, and `20260822000000` are not yet live, so current client remote contracts are ahead of production schema.

Authoritative files:

- `proposal.md`
- `design.md`
- `tasks.md`
- `specs/ui-ux-mass-wave-hardening/spec.md`
- this ExecPlan
- all `docs/ui-ux/**`
- all `openspec/changes/harden-parallel-completion-wave-v2/**`.

## Scope

- Fresh full regression after the code-only wave.
- Product/test-drift classification and root-cause repair.
- Todo, Habit, Pomodoro, Workout, Calories, Today/Overview, Planning, Goal/Project, Progress hardening.
- Warm Momentum design-system, responsive, keyboard, screen-reader, reduced-motion validation.
- Daily Plan title-snapshot durability/backup/remote verification.
- Reconciliation of prior hardening obligations.
- Pending live Supabase migration convergence and advisors.
- Full web/E2E/sync/simulation/timezone/native-as-available validation.
- Exact-final-SHA GitHub CI closure.

## Non-Goals

- New unrelated product features.
- Another design rewrite.
- Force push/history rewrite.
- Test weakening/skipping as a substitute for fixing regressions.
- Faked environment/native evidence.

## Current Checkpoint

- Current milestone: POST_UI_WAVE_HARDENING_HANDOFF_READY.
- Completed: independently verified reported final SHA equals current remote main; compared the 19-commit code wave against `3ee030c`; verified only remote `main`; read merged UI/UX roadmap/design DNA and current older hardening ExecPlan/tasks; verified local migration chain now ends at v21; queried live Supabase and established production ledger still ends at `20260820010000`, with repository migrations `20260821000000`, `20260821010000`, and `20260822000000` pending live.
- In progress: None — implementation/hardening session has not started from this handoff.
- Important modified files: this spec-authoring commit adds only `openspec/changes/harden-ui-ux-mass-implementation-wave-v1/**`.
- Last successful validation: independent GitHub/source/Supabase state inspection; the implementation session must run repository validators and the full QA ladder.
- Current failures: Broad post-wave regression is intentionally unknown because the preceding campaign deferred testing. Live Supabase is known to be behind the repository client schema/backup contract.
- Relevant quarantines: None accepted as closure evidence. Existing skips/quarantines must be classified during QA.
- Blockers: None to begin local hardening. Live migration/deployment completion depends on available Supabase credentials/authorization in the execution environment.
- Condition required to unblock: If live access is unavailable, obtain an authenticated Supabase CLI/session capable of applying reviewed migrations to project `kruubbynsmxzxfdunaal`.
- Exact resume action after unblock: Re-snapshot live ledger/schema/row counts, apply the pending reviewed migrations in order, then run schema validator + remote-boundary/dist-sync verification.
- Exact next action: Fresh session fetch/prune latest main, read this change + all `docs/ui-ux/**` + older hardening change, run `npm run agent:plans`, reconcile actual plan state, then execute Tasks 0 and 1 before changing tests or schema.
- Remaining definition of done: all non-environment tasks evidenced; product regressions fixed; intended test drift updated without weakened assertions; prior hardening plan honestly reconciled; live remote contract converged when access is available; full QA green; clean main-only Git; exact final SHA GitHub `quality` + `e2e` green.

## Progress

- [x] Authoring: verify reported UI/UX wave landed on remote main.
- [x] Authoring: verify branch consolidation resulted in remote main-only.
- [x] Authoring: inspect merged UI/UX roadmap and known debt.
- [x] Authoring: detect migration-head change to v21.
- [x] Authoring: independently detect live Supabase migration lag.
- [x] Authoring: persist post-wave hardening package.
- [ ] Reconcile repository and active historical plans.
- [ ] Establish fresh full post-wave regression baseline.
- [ ] Harden Todos/Habits.
- [ ] Harden Focus/Workout.
- [ ] Harden Calories/Today.
- [ ] Harden Planning/Goals/Projects/Progress.
- [ ] Harden design system/accessibility/responsive behavior.
- [ ] Reconcile Backup/Portable/migration-21 contract.
- [ ] Apply/verify live Supabase convergence.
- [ ] Repair E2E/journeys/simulation test drift and product bugs.
- [ ] Run full final validation ladder.
- [ ] Reconcile older hardening plan and this plan to evidence.
- [ ] Push exact final main and obtain GitHub quality/e2e green.

## Surprises & Discoveries

- 2026-08-22 — The previous code-only wave correctly merged the UI/UX docs branch but also landed on top of an older ACTIVE hardening plan whose exact checkpoint still describes unfinished E2E triage from before the latest redesign.
- 2026-08-22 — Current source has migration 21 while live Supabase remains at `20260820010000`; three later repository migrations are absent from the live ledger.
- 2026-08-22 — The implementation report explicitly identifies four product-debt areas requiring root-cause hardening: workout resumed measurements, quick-kcal saved-meal coupling, Pomodoro crash-recovery summary path, and past-day Habit lifecycle write gating.
- 2026-08-22 — The UI/UX wave changed high-frequency interaction structure enough that multiple E2E selector failures are expected, but each must be reproduced/classified rather than blanket-updated.

## Decision Log

- 2026-08-22 — Create a dedicated post-UI-wave hardening change rather than overwriting the historical hardening artifacts. The new orchestrator must reconcile the older ACTIVE plan as part of closure so both histories stay auditable.
- 2026-08-22 — Treat live Supabase schema lag as blocking because current client backup/sync/restore contracts include fields/tables introduced by pending migrations.
- 2026-08-22 — Do not automatically persist every UI preference remotely; hardening focuses on correctness/recovery contracts already established by the product and current settings architecture.

## Validation Ledger

- 2026-08-22 — GitHub compare `6dd41bb..main` — PASS — identical; exact full SHA `6dd41bbd51f091aed44f4918ca8f336ec5c421c9`.
- 2026-08-22 — GitHub branch search — PASS — remote branch `main` only.
- 2026-08-22 — GitHub compare `3ee030c..main` — PASS — 19 commits; 82 files changed; mass UI/UX implementation confirmed.
- 2026-08-22 — Source inspection `core/db/client.ts` — PASS — migration 20 exists and migration 21 adds `daily_plans.top_todo_titles`; next free migration expected >=22.
- 2026-08-22 — Live Supabase migration-ledger query — FAIL/OPEN — latest live migration is `20260820010000_planning_schema_convergence`; expected later repository migrations are absent and must be converged before closure.

## Changed Files / Areas

At authoring: only `openspec/changes/harden-ui-ux-mass-implementation-wave-v1/**`.

Implementation scope may touch the UI wave surfaces plus tests, migrations, backup/portable/sync, notification/PWA, and shared infrastructure as required by root-cause fixes.

## Recovery / Resume Instructions

1. Fetch/prune and inspect Git state.
2. Read `AGENTS.md`, `.agent/PLANS.md`, all files in this change, all `docs/ui-ux/**`, and `openspec/changes/harden-parallel-completion-wave-v2/**`.
3. Run `npm run agent:plans` and reconcile discrepancies into this ExecPlan before proceeding.
4. Start from `Exact next action`.
5. Do not trust pre-wave test evidence as proof for current main.

## Outcomes & Retrospective

- Status: ACTIVE.
- Outcome: pending implementation.
- Completion requires full evidence in tasks/validation ledger plus exact-head green CI.