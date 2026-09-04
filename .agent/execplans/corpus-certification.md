# ExecPlan: Wave 4 — Corpus-Backed Certification

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Certify the Wave 3 MATURE corpus across the three axes it was built
for — migration/backfill, restart/recovery, heavy-state performance —
with measured evidence, fixing only proven defects.

## Context

- Corpus: `seedMature()` (~9k rows, scope-6 marker, UTC key,
  interrupted Focus/Workout, pending logs, tombstones, undrained
  outbox); manifest + determinism in `tests/integration/corpus.test.ts`.
- Backfill idiom: `freshDatabase()` → seed → `setLocalDatasetOwner`
  → `ensureBackupBackfill()` returns `running`/`waiting`/`done`
  (`tests/integration/backupBackfill.test.ts`).
- Restart idiom: `VACUUM INTO` a tmp file from the seeded memory DB,
  `closeAsync()`, `freshDatabase(sameFile)` (migration-test
  precedent for file reopen; avoids mock-wrestling).
- Data layers imported dynamically AFTER `seedMature()` bind the
  seeder generation's seeded DB (module-registry generation is
  stable post-seed).
- Perf precedent: generous tripwire ceilings + printed timings
  (portableLargeDataset, backupPerformance); no intuition-only
  indexes; query/render analysis only on measured signal.

## Scope

- `tests/integration/corpusBackfill.test.ts`: backfill a MATURE
  corpus from scope 6 → 7 (marker, idempotency, entity presence).
- `tests/integration/corpusRestart.test.ts`: VACUUM INTO file,
  close, reopen, full manifest re-verified + writability +
  durable edge-state survival (timer/draft/pending/outbox).
- `tests/integration/corpusPerformance.test.ts`: hot-path timings
  on MATURE (todos pending, habit year history, calorie
  diary+summary, saved-meal search, workout routines/logs,
  project rollups, pomodoro range) with printed timings +
  generous ceilings.
- Ledger: migration lab suites re-run explicitly on current tree.

## Non-Goals

E2E J8 retargeting to MATURE (HEAVY stays the web gate; Wave 8
reruns it); native heavy-state lanes (deferred with rationale);
new product indexes without measured signal; touching seeder
shapes (manifest is frozen).

## Current Checkpoint

- Current milestone: COMPLETE — backfill/restart/perf certified
  on the MATURE corpus with measured evidence; no product
  defects found.
- Completed: all Wave 4 implementation + validation (see
  Progress and Validation Ledger).
- In progress: none.
- Important modified files: none yet.
- Last successful validation: full `npm test` 171/1929 green.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — three suites green
  with measured evidence; migration lab re-run green; ledger
  recorded; commit/push is the next command in this handoff.

## Progress

- [x] Workstream plan opened; idioms reconnoitered.
- [x] Backfill-from-6 test green (scope 6→7, idempotent,
      entity presence; owner adoption via bindLocalDatasetOwner
      as the coordinator does).
- [x] Restart/recovery test green (full manifest + edge +
      writability across VACUUM INTO close/reopen).
- [x] Heavy-state perf timings recorded, ceilings green (max
      4.3ms vs 5000ms tripwires; no bottleneck signal, so no
      query/render changes).
- [x] Migration lab re-run green (5+10 suites, 15/15).
- [x] Plan validated; committed/pushed; COMPLETED.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-04 — VACUUM INTO + reopen for restart (not seeder
  file-backing): no mock wrestling, exercises the real reopen path
  including migration idempotency.
- 2026-09-04 — Generous timing tripwires (not product budgets)
  with printed measurements for the ledger.

## Validation Ledger

- 2026-09-04 — `corpusBackfill` — PASS (10.9s; scope 6→7,
  second run `done`, 8 entities present). Incident: first
  version bound the owner without adopting the seeding outbox
  and hit the fail-closed rebind guard — test setup error
  (real flow adopts), fixed by mirroring the coordinator.
- 2026-09-04 — `corpusRestart` — PASS (4.3s; manifest +
  timer/draft/pending/outbox intact; toggle/add/increment
  writability proven). Incidents: Windows EBUSY on tmp sweep
  (best-effort cleanup) and an increment probe on an
  archived habit (lifecycle gate correctly refused; probe now
  selects an active habit).
- 2026-09-04 — `corpusPerformance` — PASS; timings (this host):
  pending 189/1.0ms, year-history 3360/4.3ms, diary 630/2.3ms,
  summary 210/1.3ms, saved-search 2/0.4ms, routines 8/0.2ms,
  logs 70/0.6ms, rollups 4/0.9ms, pomodoro 105/0.5ms.
- 2026-09-04 — `migrationFixtures` 5/5 + `migrations` 10/10
  re-run green on current tree.
- 2026-09-04 — `typecheck` 0; `lint` 0 (console.warn per
  perf-log precedent; assertion cleanup).

## Changed Files / Areas

- `tests/integration/corpusBackfill.test.ts` — scope-6→7 on
  MATURE + idempotency.
- `tests/integration/corpusRestart.test.ts` — VACUUM INTO
  close/reopen + writability.
- `tests/integration/corpusPerformance.test.ts` — 9 hot-path
  timings + tripwires.

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, ACTIVE prompt Waves 3–4, this plan.
2. Run `npm run agent:resume -- --plan .agent/execplans/corpus-certification.md`.
3. Inspect `git status -s`, `git diff --stat`, `git diff --name-only`.
4. `npm run web:hygiene`; no emulator needed for this wave.
5. Continue only from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

- Status: Completed.
- Summary: MATURE corpus certified for migration/backfill
  (scope 6→7 exactly once), restart (manifest + durable edge
  state + writability across close/reopen), and heavy-state
  reads (all ≤4.3ms vs 5000ms tripwires; no bottleneck signal
  → no product changes). Migration lab re-green. No
  PRODUCT_BUG; two test-setup incidents fixed at test layer
  with documented rationale.
- Follow-up: Wave 5/6 repetition + provenance; Wave 8 battery.
