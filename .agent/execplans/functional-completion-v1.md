# ExecPlan: Functional Completion V1 (master orchestration)

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close Super Habits' product-depth gaps: users must be able to correct, edit, and manage their own data across Todos (recurring series), Calories (day correction), Workout (routines/custom exercises/logs), and Pomodoro (presets/session metadata); the shipped Weekly Review loop must be reachable from the normal in-app flow; the Linked Actions policy must honestly describe the shipped engine; and Planning-surface persistence must be proven with real-SQL/data-oracle tests.

Success = every shipped correction flow has an explicit contract, an implementation in existing surfaces, and oracle-grade tests, with zero regressions against the certified persistence baseline.

## Context

- Campaign driver: `.agent/EXECUTION_PROMPT.md` (Functional Completion V1, ACTIVE, Planned-From `76f79d9`). Waves 0–10 are defined there; this plan is the master orchestration record. Workstream ExecPlans are opened as waves start (Wave 1).
- Certified foundation to reuse, not rebuild: migrations (`core/db/client.ts`, current schema version 24, append-only), `runSyncedMutation`/`runBackupMutation` + durable outbox, restore invariants (`core/backup/`), account ownership (`core/auth/`), `qa:repeat`, multi-AVD native automation, MATURE corpus seeders, `web:verify`/`web:hygiene`.
- Product disposition (authoritative): `docs/ui-ux/2026-09-01-feature-disposition-ledger.md` line 28 — Weekly Review: keep modal; expose from Plan/Progress, not Today.
- Invariants: soft-delete only (documented exceptions), no `getDatabase` outside data layers, `createId`/`toDateKey`, single-page shell, six sections, one global Add, no seventh tab, no second Gym state, no AI/Ask flag changes.

## Scope

Waves 1–10 of `.agent/EXECUTION_PROMPT.md`: OpenSpec correction contracts; Todos recurring-series management; Calories `consumedOn` correction; Workout routine/exercise/log correction; Pomodoro preset authoring + post-hoc session meta; Weekly Review in-app entry + `deleteWeeklyReview` disposition; Linked Actions policy reconciliation; Planning Hub / Weekly Review E2E + real-SQL test floor; regression ladder; adversarial verification; docs truth.

## Non-Goals

No Production Hardening V3 / Certification V3, no two-way sync, no persistence rewrite, no new top-level section, no cycle-elimination campaign, no `workout.data.ts` split, no migration-block edits, no weakened tests, no AI flag changes.

## Current Checkpoint

- Current milestone: Wave 9 COMPLETE (adversarial verification PASS after repairs) → Wave 10 (final sweep + campaign close) starting.
- Completed:
  - Wave 0 — truth/hygiene/gates/E1–E6 (all CONFIRMED; commit `3e05490`).
  - Wave 1 — OpenSpec change `complete-product-correction-flows-v1` (design D1–D6, 6 specs, tasks; openspec 51/51; commit `62356b5`).
  - Wave 2 — Todos recurring-series correction (data+UI+6 unit+3 integration+E2E; todos 9/9; P0 25/25; commit `0065ae9`).
  - Wave 3 — Calories day correction (integration 3; E2E day-navigation 5/5; commit `de9632e`).
  - Wave 4 — Workout correction: `deleteWorkoutLog` (hard-delete cascade per the `saved_meals` exception — the three log tables have no `deleted_at`; one durable delete intent per removed row, verified) wired to a confirmed “Delete session” action in Session detail; `updateRoutine` activated via Rename routine (top of builder; history keeps snapshot names — proven); new `CustomExerciseManagerModal` (edit/archive/restore + archived list) wired to `updateCustomExercise`/`archiveCustomExercise`/new `restoreCustomExercise`; design.md D3 amended (hard-delete rationale). E2E strengthened the vacuous “completes a workout” (real workout_logs oracle) + 3 new journeys (rename, accidental-log delete, manager). Fixed a weekend-dependent strict-mode flake in gym-v2 reschedules by scoping to the schedule panel (selector fix, assertion kept).
  - Wave 5 — Pomodoro correction depth (no migration; metadata-only per design D4): new `PomodoroPresetManagerModal` (create/edit/delete custom presets through `savePomodoroPresets` onto the app_meta recoverable-settings path; built-ins protected with delete/edit refused) opened from a “Manage presets” action on the Presets card; `RecentSessionsList` rows became pressable (optional `onEdit`) opening new `SessionMetaEditModal`, which edits the note and relinks/unlinks the task-link through the existing `setPomodoroSessionMeta` contract (undefined=keep, null=clear; single coalesced update intent verified; missing row and empty edit are no-ops). Integration `pomodoroCorrection.test.ts` 3/3 (incl. `user_backup_settings` intent); E2E +2 journeys (preset authoring with app_meta oracle + reload persistence; seeded session corrected to note+link with row and single-intent oracles) — pomodoro spec 6/6, momentum-garden 4/4 unaffected.
  - Wave 6 — Weekly Review surfacing + Linked Actions policy honesty (no migration). Weekly Review: Progress view of the Planning Hub gained the disposition-ledger entry (header Card + “Open weekly review” → `openWeeklyReview`; modal kept). History delete wired: `ReviewHistoryView` rows expand with a confirmed danger delete → `deleteWeeklyReview` (SELECT-guarded no-op for missing/already-deleted ids, single coalesced durable delete intent; rollups progress/momentum/timeline already filter `deleted_at IS NULL`). Product fix: `openWeeklyReview` now closes the Plan hub and Settings overlays first (same convention as `openHabit`) — stacked drawers previously painted the hub’s Momentum chart over the review modal’s own buttons, which E2E proved was unclickable. Linked Actions: audit recorded that execution gating is the `LINKED_ACTION_SUPPORTED_RULE_PATHS` table (policy `engineSupport` was descriptive-only; the design D6 premise was disproven) and that only the task-completed and habit-completed-for-day events ever dispatch; exposed `calorie.log`/`pomodoro.log` targets on those two emitted triggers (4 paths) with produce-new editor authoring (inline food/calorie and focus-minute templates, validation, hydration, non-orphan) and honest comments for unemitted triggers; parity guarded by `linkedActionsPolicy.test.ts` (4). Proofs: `weeklyReviewExecutor.test.ts` +3 delete-contract tests; `linkedActionLogTargets.test.ts` 3/3; E2E `weekly-review.spec.ts` (Progress entry → guided flow → oracle → revisit → confirmed delete with coalesced-delete oracle) and `linked-actions-log.spec.ts` (author→fire→effect for pomodoro 1800 s focus row + applied execution + “30m” history surface; calorie inline template → today’s entry + applied execution + create intent). E1 copy already honest from Wave 2 — no recurring-source exposure.
  - Wave 7 — Planning-surface test floor (tests-only, no product change): new real-SQLite contract tests `tests/integration/progressData.test.ts` (3: full current/previous window metric matrix through unmodified data layers incl. soft-delete exclusions, F3 unjoined habit-count rule, focus-only session filter, DISTINCT calorie days, completed-goal-excluded average, app_meta calorie-goal pass-through; exact half-open UTC boundary instants; `countTodosCompletedBetween` local-day scoping) and `tests/integration/activityTimelineData.test.ts` (3: one correct item per source from real rows, orphan-completion fallback label vs soft-deleted-habit real name, soft-deleted task and routine exclusions, F6 local-midnight window edge day-in/day-out, F5 date_key-buckets-beating-updated_at). New `e2e/planning-hub.spec.ts` (2 journeys via the normal Overview “Plan” entry): guided plan flow → `daily_plans` row + single create intent + editor mirror + fresh-mount persistence; Projects/Goals/Progress/Timeline tab tour with `projects`/`goals` row + outbox create oracles, Progress insights real-data render, Timeline real-event items, restart re-read. Vacuous-assertion repair: Habits “increments habit completion” now asserts the 1-of-1 a11y label + `habit_completions` count-oracle (Workout vacuous test was already repaired in Wave 4). Discoveries: habit completion writes are gated at the habit creation date (backdate `created_at` + `rule_history='[]'` to seed historical increments); `rule_history` is NOT NULL; soft-deleted habits keep resolving their real name via the LEFT JOIN — the “a deleted habit” fallback only exists for fully orphaned completion rows; two Intention inputs coexist on the Today view (guided card above the full editor — scope `.first()`), and guided “Save plan” vs editor “Save Plan” need `exact: true`.
- In progress: none.
- Important modified files: `tests/integration/{progressData.test.ts,activityTimelineData.test.ts}` (new), `e2e/{planning-hub.spec.ts}` (new), `e2e/habits.spec.ts` (oracle strengthening), `openspec/.../tasks.md` (7.1–7.3 checked). Wave 6 files: `core/providers/NavigationProvider.tsx`, `features/planning-hub/PlanningHubScreen.tsx`, `features/weekly-review/{ReviewHistoryView.tsx,weeklyReview.data.ts}`, `core/linked-actions/{linkedActions.supportedPaths.ts,linkedActions.policy.ts,linkedActionsEditor.types.ts,linkedActionsEditor.model.ts,LinkedActionsEditorSection.tsx}`, `e2e/{weekly-review.spec.ts,linked-actions-log.spec.ts}` (new), `tests/integration/{weeklyReviewExecutor.test.ts,linkedActionLogTargets.test.ts}`, `tests/linkedActionsPolicy.test.ts`.
- Wave 9 evidence (adversarial verification, independent verifier over 76f79d9..bf6fd8d): VERDICT PASS — spec→code→test mapping holds for all six specs; Wave-4 cascade emits exactly one durable delete intent per removed row; outbox coverage complete for every correction write path; migrations/app/ untouched (schema stays 24, six-section shell intact); no test weakening (3 removed assertions all replaced by stronger oracles); no forbidden APIs. Repaired findings: (W9-1 MINOR) two-phase series save now catches template-update failure and surfaces an in-editor retry message (`features/todos/TodosScreen.tsx` onSave); (W9-3 MINOR) calorie day-move E2E now asserts exactly one live row on the new day after reload via row oracle (`e2e/calories-day-navigation.spec.ts`); (W9-6) `ppre` prefix row added to the AGENTS.md table; (W9-7) stale “version 11” comment fixed in `tests/integration/helpers/db.ts`. Accepted minors (documented, no code risk): (W9-2) `deleteWorkoutLog` false return means the row was already absent — close+refresh is the consistent outcome; (W9-4) restart-test spawn inheritance covered indirectly; (W9-5) reminder-cancellation `deleted_at` string-equality matching is brittle but same-constant safe. Re-verification after repairs: typecheck 0; lint 0/0 (`--max-warnings 0`); full Vitest 1975/1975 (184 files); fresh `build:web`; Chromium `e2e/calories-day-navigation.spec.ts` + `e2e/todos.spec.ts` 14/14.
- Wave 8 evidence (all on 73c26cd, 2026-09-05): fast gates PASS (`qa:impact:validate` 13 rules, `agent:plan:validate:all` 49/49, `validate:themes` 140, supabase schema, `qa:timezones` 5 zones). Full `npm run e2e` battery: 210 passed / 43 skipped (pre-existing @sync + internal-parser env gates) / 0 failed. `sim:validate` model clean; deterministic library 23/23 PASS (needs an owned :8081 static server — raw `sim:run` without one fails setup with ERR_CONNECTION_REFUSED by design; server owned + cleaned via exact-PID taskkill). `web:verify` PASS (50.7s, COOP/COEP + crossOriginIsolated probe, port released); `web:hygiene` 8081/8082 FREE. Native on owned Nitro_API_36 with canonical APK (source 73c26cd, SHA 3C03C258…7908): smoke PASS (`native-android-smoke-Nitro_API_36-2026-09-05T064222041Z.json`), persistence 11/11 PASS (`native-android-persistence-Nitro_API_36-2026-09-05T065339570Z` collated); emulator stopped, no leaks. Flake screen `qa:repeat --suite p0 --times 3`: 3/3 PASS, 25/25 each (`simulation-output/repeat/p0-3x-2026-09-05T065822317Z.json`). Sync lane is the opt-in CI main/nightly path (`e2e:sync`), unchanged and unaffected by campaign scope.
- Last successful validation: Wave 8 ladder above; tree clean at `73c26cd` == origin/main.
- Current failures: None. Two TEST_BUGs fixed in-flight (Playwright strict-mode collisions: duplicate Intention inputs → `.first()`; `Save plan`/`Save Plan` and Momentum-vs-Progress “Last 7 days” copy → `exact`/anchored patterns). Three TEST_BUGs from the first integration run fixed (habit pre-creation write gate, NOT NULL rule_history, orphan-vs-soft-deleted label semantics).
- Relevant quarantines: None.
- Blockers: None (externals unchanged).
- Exact next action: Wave 10 — final P0/P1 sweep and campaign close: re-run `qa:fast`-class static gates + P0 on the final tree, docs truth pass (README command-capability claims, Ask capability, structure map vs `app/` reality), then mark `.agent/EXECUTION_PROMPT.md` and this plan COMPLETED, push, and emit the §9 final report.
- Remaining definition of done: terminal condition A of `.agent/EXECUTION_PROMPT.md` §9.

## Progress

- [x] Wave 0 — Re-baseline: Git/plan truth, hygiene, qa:fast, E1–E6 re-verification (all CONFIRMED) — 2026-09-05
- [x] Wave 1 — OpenSpec contracts + design decisions D1–D6 (commit `62356b5`, openspec 51/51)
- [x] Wave 2 — Todos recurring-series correction (unit 6 + integration 3 + E2E; full Vitest 1946/1946; todos spec 9/9; P0 25/25)
- [x] Wave 3 — Calories day-correction (integration 3 + E2E 5/5 day-navigation; unit 22/22)
- [x] Wave 4 — Workout correction (integration 4; E2E workout 12/12 incl. rename/delete/manager; gym-v2 flake scoped; full Vitest 1953/1953)
- [x] Wave 5 — Pomodoro correction depth (integration 3; E2E pomodoro 6/6 incl. preset authoring + session correction; full Vitest 1956/1956)
- [x] Wave 6 — Weekly Review surfacing + Linked Actions policy (integration +3, policy suite +4, E2E +3 journeys; overlay-stacking product fix in NavigationProvider; full Vitest 1969/1969; P0 25/25)
- [x] Wave 7 — Planning-surface test floor (real-SQL progress/timeline 3+3; planning-hub E2E 2/2 with row/intent oracles; Habits increment oracle; full Vitest 1975/1975)
- [x] Wave 8 — Regression ladder (e2e 210/43s/0f; deterministic sim 23/23; web:verify/hygiene; native smoke + persistence 11/11 on Nitro_API_36 @73c26cd; p0×3 repeat PASS)
- [x] Wave 9 — Adversarial verification (PASS after repairs; independent red-team over 76f79d9..bf6fd8d)

## Surprises & Discoveries

- Engine runtime skips `pomodoro.log`/`calorie.log` legacy rules ("unsupported") despite implemented effects — policy likely gates execution too (`linkedActions.engine` + policy resolution). Wave 6 must audit the gate path before choosing A (authorable) vs B (honest deferral). RESOLVED in Wave 6: the gate is the `LINKED_ACTION_SUPPORTED_RULE_PATHS` table, not `linkedActions.policy.ts`; chose A (authorable) for the two emitted triggers, honest-hidden for unemitted ones.
- Stacked `core/ui/Modal` drawers share one modal layer with no z-index ordering: opening the Weekly Review from the Plan hub left the hub’s Momentum chart SVG intercepting pointer events over the review modal’s Next button (real user impact, not a test flake). Convention fix: `openWeeklyReview` dismisses hub/Settings first (mirrors `openHabit` closing Settings).
- `queryRows`/DB-harness calls navigate the Playwright page away from the app — any still-open modal is gone afterwards; finish UI steps before row oracles or `returnToApp` first.
- `web:hygiene` and the whole `qa:fast` chain work cleanly on this Windows host; native lanes use existing `scripts/qa-native*.mjs`.
- E2E (web): nested `core/ui/Modal` stacks (routine builder + exercise picker) can transiently misroute clicks after the inner dialog closes — a close/re-layout race causes tests to hang for the full timeout (~50% flake). Deterministic pattern: don't click builder controls immediately after closing the nested picker; seed at the DB layer (`queryRows`) or re-open the dialog first. Also: `returnToApp` lands on Overview — always `goToTab` again after `queryRows`/`returnToApp`; wait for a UI signal (e.g. session card) before `queryRows` so the harness connection never races the write transaction.
- Durable outbox coalesces intents per (entity, id) — `sync_outbox` holds one row with the latest operation; assert that shape in tests.
- The three completed-log tables (`workout_logs`, `workout_session_exercises`, `workout_session_sets`) have no `deleted_at`; corrections there must follow the hard-delete + per-row delete-intent exception (design D3 amendment).

## Decision Log

- 2026-09-05 — Master orchestration plan + per-wave workstream plans (proven shape from prior campaigns) — single source for campaign checkpoint; workstream plans own implementation detail.
- 2026-09-05 — Wave 4: accidental completed-session delete uses the saved_meals hard-delete exception + durable per-row delete intents instead of soft delete (no `deleted_at` columns exist; remote-schema mirroring out of scope) — user-visible contract unchanged (design D3 amendment records the evidence).
- 2026-09-05 — Wave 6 (D6): expose `calorie.log`/`pomodoro.log` as authorable targets on the two triggers the app actually emits (task completion / habit completed-for-day); unemitted triggers stay hidden with audit comments. Policy file keeps descriptive labels only; the supported-paths table is the single execution gate, drift-guarded by `tests/linkedActionsPolicy.test.ts`.
- 2026-09-05 — Wave 6: `openWeeklyReview` dismisses the Plan hub and Settings overlays (existing `openHabit` convention) because same-layer modal stacking made the review’s controls unclickable when opened from Progress.
- 2026-09-05 — Wave 6: `deleteWeeklyReview` SELECT-guards so deleting a missing or deleted id is a true no-op (no stale outbox intent), matching the Wave-5 pomodoro correction contract.

## Validation Ledger

- 2026-09-05 — `npm run agent:plans` — PASS — 48/48 COMPLETED predecessors.
- 2026-09-05 — `npm run web:hygiene` — PASS — 8081/8082 free.
- 2026-09-05 — `npm run qa:fast` — PASS — typecheck 0, lint 0, Vitest unit 1691/1691 (128 files), label parity OK.
- 2026-09-05 — Wave 6 gates — PASS — typecheck 0; lint 0; full Vitest 1969/1969 (182 files); `npx playwright test --project=chromium e2e/weekly-review.spec.ts e2e/linked-actions-log.spec.ts` 3/3; `npm run e2e:journeys:p0` 25/25.
- 2026-09-05 — Wave 7 gates — PASS — fresh `build:web`; `npx vitest run` 1975/1975 (184 files, both projects); `npx playwright test --project=chromium e2e/planning-hub.spec.ts` 2/2; `e2e/habits.spec.ts` 11/11; typecheck 0; lint `--max-warnings 0` clean; `git diff --check` clean.

## Changed Files / Areas

- `.agent/execplans/functional-completion-v1.md` — this master plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`.
2. Read `.agent/EXECUTION_PROMPT.md` fully (authoritative waves + invariants).
3. Read this plan completely, then any ACTIVE workstream ExecPlan it lists.
4. `git status --short`; `git diff --stat`; `git log --oneline -10`; reconcile checkpoint with Git (Git wins).
5. `npm run agent:resume -- --plan .agent/execplans/functional-completion-v1.md`.
6. `npm run qa:affected` for changed files; run resolved gates.
7. Continue from `Exact next action`; update this plan before finishing any session.

## Outcomes & Retrospective

- Status: Active (Wave 0 complete).
