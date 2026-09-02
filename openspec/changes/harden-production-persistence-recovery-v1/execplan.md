# ExecPlan: Production Hardening V1 — Persistence, Recovery, Heavy-State, Offline

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Super Habits behaves like software the user can trust with years of personal
productivity data: no lost writes, no duplicate writes, no partial restore,
safe migrations, durable restart behavior, honest offline behavior. This
campaign proves (and where needed fixes) those properties with evidence.

## Context

- Predecessor: WM2.4 closed at `ac0d9b2` (origin/main), all gates green.
- Baseline flake reproduced during Phase 1: `tests/restore.coordinator.test.ts`
  — "blocks restore when local synced tables contain tombstones" failed once
  under full `qa:fast` parallel load; passed in isolation (18/18) and on a
  full re-run (1665/1665). Same class as WM2.4 CG-9; mechanism unknown.
- Native environment: doctor PASS; four API-36 AVDs exist (CRBABot_API_36,
  Nitro_API_36, braintraining-qa36, braintraining36); none booted; EAS CLI
  not on PATH (optional).

## Scope

- `core/db/client.ts` migration safety (test-only unless a defect is found).
- `tests/restore.coordinator.test.ts` + related restore/backup/sync tests.
- Data-layer write families under `features/` (only if a duplicate-write
  defect is proven).
- Sync outbox integration coverage (`tests/integration/syncOutbox*.test.ts`).
- Native provisioning/smoke via existing scripts (no product code changes).

## Non-Goals

- No domain semantics changes, no schema redesign, no product surface work.
- No production Supabase; remote-boundary evidence via stubs/disposable lane.
- No performance frameworks; no speculative caching layers.

## Current Checkpoint

- Current milestone: Phase 2 — campaign created; starting Workstream A/B
  (flake + migration hardening).
- Completed: Phase 0 (git truth, hygiene, control plane read), Phase 1
  (baseline gates recorded in tasks.md §1), OpenSpec change created
  (proposal/design/tasks/spec/execplan).
- In progress: restore-tombstone flake mechanism identification.
- Modified files: openspec/changes/harden-production-persistence-recovery-v1/* (new).
- Decisions: D1–D7 in design.md (CG-9 battery protocol; injected-failure
  migration test; runtime-derived historical fixtures; data-layer duplicate
  probes; validator-reuse restore DR matrix; fake-timer outbox torture;
  native provision on available AVD).
- Last successful validation: baseline matrix at `ac0d9b2` — typecheck 0,
  lint 0, Vitest 1892/1892, qa:fast 1665/1665 (after one observed flake,
  see failures), openspec 50/50, plan:validate:all PASS, sim:validate PASS,
  build:web OK, web:verify PASS exit 0 (71.2s), P0 journeys 25/25,
  web:hygiene PASS, migrations/restore/backup integration 46/46.
- Current failures: one load-sensitive flake observed in
  `tests/restore.coordinator.test.ts` ("blocks restore when local synced
  tables contain tombstones") under full `qa:fast` parallel load; passed in
  isolation and on full re-run. Investigation is task §2.
- Relevant quarantines: none.
- Blockers: none.
- Condition required to unblock: none.
- Exact resume action after unblock: n/a.
- Exact next action: investigate the restore-tombstone flake mechanism —
  read `tests/restore.coordinator.test.ts` and
  `core/sync/restore.coordinator.ts`, then run a full-parallel reproduction
  battery capturing complete logs (tasks §2.1–§2.2).
- Remaining definition of done: tasks §2–§8 complete; full validation
  matrix green on the final tree; independent verification PASS; coherent
  commits pushed per policy; web:hygiene PASS with no campaign-owned
  servers.

## Recovery Notes

- After compaction: reread AGENTS.md, .agent/PLANS.md, this plan;
  `npm run agent:resume -- --plan openspec/changes/harden-production-persistence-recovery-v1/execplan.md`;
  inspect `git status --short` + `git log --oneline -5`; continue from
  `In progress` above.
- The flake is the first implementation item; do not skip to §3+ until its
  mechanism is identified and recorded.

## Progress

- 2026-09-03: Campaign created. Baseline recorded (tasks §1). Next: §2
  flake investigation.

## Changed Files / Areas

- `openspec/changes/harden-production-persistence-recovery-v1/` (new):
  proposal.md, design.md, tasks.md, specs/persistence-recovery-hardening/spec.md, execplan.md.
- Expected later: `tests/restore.coordinator.test.ts`, migration/outbox
  integration tests, data-layer fixes only if defects are proven, native
  reports under `simulation-output/native/`.

## Recovery / Resume Instructions

1. Reread `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan.
2. `npm run agent:resume -- --plan openspec/changes/harden-production-persistence-recovery-v1/execplan.md`
   — reconcile Git discrepancies and QA impact.
3. `git status --short` must show only campaign-owned files; anything else
   is user work — do not overwrite.
4. Continue from **Exact next action** in Current Checkpoint.

## Surprises & Discoveries

- Baseline `qa:fast` reproduced a load-sensitive flake in
  `tests/restore.coordinator.test.ts` (tombstone test): 1 failed /
  1663 passed under full parallel load; isolated run 18/18; full re-run
  1665/1665. Same CG-9 class WM2.4 closed elsewhere — mechanism not yet
  identified.

## Decision Log

- D1–D7 recorded in design.md (battery protocol, injected-failure migration
  test, runtime-derived fixtures, duplicate probes at data-layer boundary,
  validator-reuse DR matrix, fake-timer outbox torture, native provision on
  available AVD).

## Validation Ledger

- Baseline (2026-09-03, `ac0d9b2`): typecheck 0 errors; lint 0;
  `npm test` 1892/1892 (166 files); `qa:fast` exit 1 with 1 flake, then
  exit 0 1665/1665 on re-run; openspec 50/50 (after campaign add);
  qa:impact:validate OK (13 rules); validate:themes 140/140;
  supabase:schema:validate PASS; agent:plan:validate:all PASS;
  sim:validate PASS; build:web OK; web:verify PASS exit 0 (71.2s,
  crossOriginIsolated=true); P0 journeys 25/25 (1.1m);
  migrations/restore/backup integration subset 46/46; web:hygiene PASS
  (8081/8082 free); dev:doctor PASS.

## Outcomes & Retrospective

- (populated at closure)
