# ExecPlan: Wave 3 — Historical Realistic DB Corpus

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Extend the synthetic fixture laboratory with a deterministic mature-user
corpus (6–12 month scale) plus edge-state fixtures, so migration,
restart, performance, and regression work certifies against realistic
history instead of only SMALL/TYPICAL/HEAVY shapes. No real personal
data; seeded synthetic only (known-gaps #5/#6 stay open for captured
real corpora, narrowed by this work).

## Context

- `tests/integration/fixtures/seeders.ts`: SMALL/TYPICAL/HEAVY via REAL
  data layers + injected clock (base day 2026-07-01); deterministic
  offset-derived patterns, no Math.random. `buildSeed(config)` is the
  single builder; configs are plain data.
- IDs embed wall-clock + crypto random (`createId`): corpus
  determinism proof normalizes `{prefix}_{ms}_{rand}` tokens to
  first-seen ordinals before hashing (wiring preserved, noise removed).
- Mature-only APIs (all real data layers): `addTodo({recurrence:
'daily'})`, `pauseHabit`/`archiveHabit`/`deleteHabit`,
  `upsertSavedMeal`, `addProject`/`addGoal` (mixed statuses),
  `savePomodoroActiveTimer` (interrupted Focus),
  `enqueuePendingPomodoroLog`, `saveWorkoutSessionDraft`
  (interrupted Workout), direct SQL for old `backup.scope_version`
  (`app_meta` key `backup.scope_version`, current `7` → edge `6`)
  and pre-cutover UTC `habit_completions.date_key` rows.
- Outbox pending rows arise naturally (every synced write enqueues);
  asserted, never drained, in corpus tests.
- Corpus manifest = executable assertions + header table in
  `tests/integration/corpus.test.ts` (no rotting JSON file).

## Scope

- `MATURE_CONFIG` (210 days, 20 habits, 600 todos, 8 routines) +
  builder extensions (archive/pause shares, recurring series, saved
  meals, projects/goals, edge-state stage) + `seedMature()` export.
- `tests/integration/corpus.test.ts`: MATURE inventory (exact
  counts recorded on first green run), two-run determinism via
  canonical hashing, edge-state assertions.
- known-gaps #5/#6 notes + seeder module docs.
- Wave 4 consumes (migration rerun, restart loops, perf timings).

## Non-Goals

Captured real-user data; new era-boundary migration fixtures (lab
already covers v6/v13/v17/v19/v24); linked-action corpus rules;
changing SMALL/TYPICAL/HEAVY shapes or titles (existing oracles).

## Current Checkpoint

- Current milestone: COMPLETE — MATURE corpus + edge states
  landed with exact-count manifest and byte-reproducibility
  proof; full suite green with no regressions.
- Completed: audit, MATURE seeder + edge stage, corpus tests,
  known-gaps #5/#6 notes, full-suite validation.
- In progress: none.
- Important modified files: none yet.
- Last successful validation: Wave 2 closure (auth 3/3 ×2).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — MATURE + edge corpus
  green with exact-count inventory, determinism proof green,
  known-gaps updated, ledger recorded; commit/push is the next
  command in this handoff.

## Progress

- [x] Workstream plan opened; audit + API recon complete.
- [x] MATURE seeder + edge-state stage implemented.
- [x] Corpus inventory + determinism tests green (manifest:
      612 todos/20 habits/3361 completions/630 entries/16
      saved meals/8 routines/70 logs/105 pomodoros/4 projects/
      12 goals/4933 outbox; scope 6; UTC key; timer; draft;
      pending log; 3 tombstones).
- [x] known-gaps + docs updated; plan validated; committed/pushed.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-04 — Extend `buildSeed` with optional config flags (zero
  for SMALL/TYPICAL/HEAVY: byte-identical existing corpora) rather
  than a parallel builder. Edge states live in the same builder so
  they share imports/clock/module-reset.
- 2026-09-04 — Executable manifest (assertions + header table),
  not a JSON file: drift fails loudly like journey oracles.

## Validation Ledger

- 2026-09-04 — `vitest run --project integration
tests/integration/corpus.test.ts` — 2/2 PASS (inventory +
  byte-reproducibility incl. wall-date tripwire).
- 2026-09-04 — full `npm test` — 171 files / 1929 tests PASS
  (no regressions from the seeder clock-rebinding fix).
- 2026-09-04 — `typecheck` 0; `lint` 0 (after removing the
  stray diag helper that crashed the lint run and prettier
  formatting).

## Changed Files / Areas

- `tests/integration/fixtures/seeders.ts` — MATURE config +
  lifecycle/catalog/planning/edge stages + per-seed clock
  rebinding fix + `seedMature()`.
- `tests/integration/fixtures/index.ts` — barrel export.
- `tests/integration/corpus.test.ts` — manifest + determinism.
- `docs/testing/known-gaps.md` — #5/#6 narrowed, still open.

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, ACTIVE prompt Waves 3–4, this plan.
2. Run `npm run agent:resume -- --plan .agent/execplans/historical-db-corpus.md`.
3. Inspect `git status -s`, `git diff --stat`, `git diff --name-only`.
4. `npm run web:hygiene`; no emulator needed for this wave.
5. Continue only from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

- Status: Completed.
- Summary: MATURE corpus (~9k rows, 7-month user) with
  pause/archive lifecycle, recurring series, saved-meal catalog
  (+learned entries), projects/goals, and edge states
  (interrupted Focus/Workout, scope-6 marker, UTC date key,
  tombstones, undrained outbox); exact-count manifest and
  byte-reproducibility proof green; incidental TEST-INFRA fix:
  per-seed clock rebinding (multi-seed files previously saw a
  stale base-day clock in backfilled audit timestamps).
  Full suite green, no regressions.
- Follow-up: Wave 4 consumes the corpus (migration rerun,
  restart loops, heavy-state perf).
