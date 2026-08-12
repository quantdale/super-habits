## 1. Audit and schema foundation

- [x] 1.1 Record the verified starting habit semantics, dirty-worktree overlap, and implementation decisions in the ExecPlan.
- [x] 1.2 Add the append-only v12 `habits.rule_history` migration with local creation-date initialization and safe rerun behavior.
- [x] 1.3 Extend `Habit` types, runtime bootstrap/reference schema snapshots, migration tests, and the disposable Supabase reference schema for the new synced column.

## 2. Pure schedule and history domain

- [x] 2.1 Add ISO weekday/rule types, normalization, parsing, serialization, effective-date lookup, schedule predicates, target lookup, and display/preset helpers.
- [x] 2.2 Update day-completion and grid builders to expose scheduled/eligible state while preserving local-date and fixed-window behavior.
- [x] 2.3 Replace daily streak/consistency/heatmap assumptions with schedule-aware algorithms, today grace, creation boundaries, neutral no-obligation days, and unbounded streak history.
- [x] 2.4 Add comprehensive domain tests for presets, custom schedules, creation/schedule/target changes, off-days, grace/misses, >30 occurrences, leap/year boundaries, consistency, and heatmap neutrality.

## 3. Habit persistence and compatible pathways

- [x] 3.1 Persist initial rules on habit creation and append/replace effective rules on edits without rewriting completion rows; preserve sync enqueue behavior.
- [x] 3.2 Add unbounded completion-history reads for correctness while retaining an explicit bounded option for callers that need a window.
- [x] 3.3 Normalize old/remote habit rows during restore and verify schedule/target history survives remote serialization and local reload.
- [x] 3.4 Add real-SQLite integration coverage for migration, rule persistence/edit lookup, target compatibility, soft deletion, completion rows, restore, and Linked Actions off-day behavior.

## 4. UI and cross-feature integration

- [x] 4.1 Add accessible Every day/Weekdays/Weekends/Custom schedule controls with weekday toggles to habit create/edit flows.
- [x] 4.2 Render schedule labels and neutral non-actionable off-day cards while retaining edit/management access; preserve the existing day-rollover refresh signal.
- [x] 4.3 Make Habits today progress, consistency, heatmap inputs, and Overview streak/consistency summaries schedule-aware without changing the existing visual language.
- [x] 4.4 Update command habit retrieval and Linked Actions integration to consume effective historical rules without loops, duplicate effects, or schedule mutation.

## 5. User-level, simulation, and native coverage

- [x] 5.1 Add/update Playwright journeys for scheduled creation, off-day neutrality, scheduled completion, schedule edit history, target edit history, no-scheduled-habits state, and fake-clock midnight rollover.
- [x] 5.2 Extend deterministic simulation fixtures/scenarios with daily, weekday, weekend, M/W/F, and custom two-day habits while preserving reproducibility and CG-4/CG-5/J8 behavior.
- [x] 5.3 Extend Maestro Android habit persistence to create a scheduled habit, terminate/relaunch, and assert the schedule remains correct using semantic selectors. Verified on the current Android build with the M/W/F flow; navigation uses the app's supported horizontal section gesture because the native Maestro hierarchy omits the top tab rail.

## 6. Validation and handoff

- [x] 6.1 Run affected fast, integration, timezone, journey, simulation, sync, and OpenSpec/impact validation; classify and resolve failures without weakening contracts.
- [x] 6.2 Run web build/E2E and broad regression, including performance contract checks and fixed 52-column heatmap verification.
- [x] 6.3 Run native smoke/targeted Android validation when the environment is available; preserve explicit environment evidence if it is not. Android smoke passed, lifecycle passed 2/2, and targeted persistence passed 6/6 on the current APK.
- [x] 6.4 Update known-gap/architecture documentation as needed, complete the ExecPlan ledger/outcomes, mark proven OpenSpec tasks complete, and validate the blocked ExecPlan.
- [x] 6.5 Verify the repository-managed additive migration against the authorized Supabase target and prove a Habit V2 remote upsert/read/restore-compatible round trip. Migration state was already `20260810130000` locally and remotely, so no migration reapplication or history repair was performed; live schema/RLS, management and anon REST round trips, cleanup, and local restore/sync regressions all passed.
