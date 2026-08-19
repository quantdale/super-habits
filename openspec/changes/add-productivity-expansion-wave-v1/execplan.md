# ExecPlan: Productivity Expansion Implementation Wave V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Implement a broad local-first productivity expansion while the user is away, maximizing product code shipped in one autonomous run and deliberately postponing exhaustive validation to the next hardening campaign.

The user outcome is a materially richer Super Habits product with Projects, Goals, Daily Planning, a Planning Hub, global Quick Capture, Activity Timeline, and Progress Insights integrated into the existing six-section application.

This plan's completion means **implementation complete, hardening required**. It does not mean production ready.

## Context

- Repository: `quantdale/super-habits`.
- Independently verified green baseline before this wave: `6f18cce75459e21d11c29a2b82330a402336d9f4`.
- GitHub Actions run `32269563521` on that SHA: `quality` PASS and `e2e` PASS including full main journeys, deterministic scenario library, and dist-sync remote-boundary lane.
- Six primary sections remain Overview, Todos, Habits, Pomodoro/Focus, Workout, Calories.
- Settings, Weekly Review, and Command Center are overlays/modals rather than top-level tabs.
- SQLite is authoritative local storage.
- Recoverable Account uses the complete local user-table inventory for populated-device safety.
- Backup Completeness/Portable currently cover the established backup contract. This wave intentionally does not expand that remote contract.
- The immediately preceding `fix-account-recovery-dist-sync-closure-audit` implementation finished green at `6f18cce...`; its persisted plan may still be ACTIVE because the execution session intentionally avoided a post-green bookkeeping commit. The fresh implementation session should reconcile that plan to COMPLETED using already-verified run `32269563521` without rerunning its QA.

Authoritative artifacts:

- `openspec/changes/add-productivity-expansion-wave-v1/proposal.md`
- `openspec/changes/add-productivity-expansion-wave-v1/design.md`
- `openspec/changes/add-productivity-expansion-wave-v1/specs/productivity-expansion/spec.md`
- `openspec/changes/add-productivity-expansion-wave-v1/tasks.md`
- this ExecPlan

## Scope

1. Add local Projects and Goals.
2. Add optional Project/Goal organization for Todos and Habits.
3. Add local Daily Plans.
4. Add a Planning Hub modal with Today / Projects / Goals / Progress / Timeline.
5. Add global Quick Capture.
6. Add derived Activity Timeline.
7. Add deterministic 7-day Progress Insights.
8. Add compact Overview entry points.
9. Add new authoritative local tables to account ownership/emptiness safety.
10. Keep new planning entities local-only during this wave.
11. Use only minimal end-of-wave sanity validation.
12. Push the implementation to `main` and leave a precise hardening handoff.

## Non-Goals

- No full regression/hardening campaign in this session.
- No Supabase production migration/deployment for Projects/Goals/Daily Plans.
- No Backup/Restore/Portable integration for those new entities yet.
- No new account model or RLS changes.
- No seventh primary navigation tab.
- No AI planner/autonomous mutation engine.
- No collaboration, team sharing, full calendar scheduling, or notification expansion.
- No native-device validation requirement tonight.
- No requirement to wait for or repair broad GitHub Actions failures after the final implementation push.

## Current Checkpoint

- Current milestone: IMPLEMENTATION_WAVE_COMPLETE
- Completed: All implementation slices done and typecheck 0 errors — local migration 17 plus organization columns, DB types (`Project`/`Goal`/`DailyPlan` plus extensions, `ACCOUNT_USER_TABLES` + `TABLES_WITH_DELETED_AT`), `core/db/localMutation.ts`, feature modules (`projects`, `goals`, `daily-plan`, `planning-hub`, `quick-capture`, `activity`, `progress`), `app/index.tsx` + `OverviewScreen` planning entry points, organization-link helpers, vector-icons and `TextField` token fixes, lint satisfied.
- Reconciled: prior `fix-account-recovery-dist-sync-closure-audit` to COMPLETED on run `32269563521` at session head `b6745dd`; local DB at schema version 17 (next is 18).
- In progress: None. Wave pushed to `main` at `a4c0d4f`.
- Important modified files: `core/db/client.ts`, `core/db/types.ts`, `core/auth/account.types.ts`, `core/auth/account.data.ts`, `core/db/localMutation.ts`, `core/providers/navigationContext.ts`, `core/providers/NavigationProvider.tsx`, `app/index.tsx`, `features/overview/OverviewScreen.tsx`, `features/projects/`, `features/goals/`, `features/daily-plan/`, `features/planning-hub/`, `features/quick-capture/`, `features/activity/`, `features/progress/`, tests (fixture updates), `tsconfig.json`.
- Last successful validation: `npm run typecheck` — 0 errors; `npm run openspec:validate` — 33 passed, 0 failed; `npm run agent:plan:validate:all` — PASS; `git diff --check` — 0.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None. Implementation wave complete — hardening campaign owns remaining validation.
- Remaining definition of done: Complete.

## Progress

- [x] 0. Independently verify green pre-wave baseline.
- [x] 1. Define implementation-wave scope and intentional hardening boundary.
- [x] 2. Author repository-persisted proposal/design/spec/tasks/prompt/ExecPlan.
- [x] 3. Fresh session reconcile latest main and prior closure plan.
- [x] 4. Implement local schema, types, ownership inventory.
- [x] 5. Implement Projects.
- [x] 6. Implement Goals and Todo/Habit associations.
- [x] 7. Implement Daily Planning.
- [x] 8. Implement Planning Hub shell/navigation.
- [x] 9. Implement Quick Capture.
- [x] 10. Implement Activity Timeline.
- [x] 11. Implement Progress Insights.
- [x] 12. Integrate compact Overview entry points.
- [x] 13. Record hardening debt and partial slices.
- [x] 14. Run minimal end gates only.
- [x] 15. Commit coherently, reconcile/push main once, verify clean local/remote state.
- [x] 16. Mark implementation wave COMPLETED with explicit HARDENING REQUIRED outcome.

## Surprises & Discoveries

- The 7 new planning `.tsx` files shipped with `@expo-vector-icons` (en-dash) instead of `@expo/vector-icons` (slash); every one tripped `TS2307` until the typo was replaced.
- Also produced `TextField` `maxLength`/`danger` token mismatches (`maxLength` does not exist on `TextFieldProps`; `tokens.danger` → `tokens.dangerSolid`) which were corrected to validation-based limits.
- `features/projects/data.ts` and `core/db/types.ts` re-introduced a circular/constants split for `GOAL_TITLE_MAX`/`PROJECT_DESCRIPTION_MAX` — consolidated to the domain file as the single source.
- Stash probe showed `b6745dd` spec-only typecheck would emit 39 errors for the DailyPlan/Goal/Project wave types (expected — those types did not exist at HEAD), while the post-wave tree should be 0 typecheck errors after this fix.

## Decision Log

- 2026-08-20 — Use one broad implementation wave because the user explicitly prioritizes overnight feature throughput and wants a separate hardening campaign afterward.
- 2026-08-20 — Skip baseline QA and broad regression during this run.
- 2026-08-20 — Keep Projects/Goals/Daily Plans local-only until hardening so the client cannot enqueue records for undeployed Supabase tables.
- 2026-08-20 — New local planning tables still participate immediately in account populated-device safety.
- 2026-08-20 — Preserve six primary tabs; add Planning Hub as a modal/drawer.
- 2026-08-20 — Quick Capture must reuse canonical existing-domain mutation APIs.
- 2026-08-20 — Final implementation run does not wait for or chase GitHub CI; subsequent hardening owns CI/test repair.

## Validation Ledger

Authoring evidence:

- GitHub `main` independently verified at `6f18cce75459e21d11c29a2b82330a402336d9f4` before spec publication.
- GitHub Actions run `32269563521`: `quality` success; `e2e` success; full main journeys, full deterministic scenarios, build-dist-sync, and remote-boundary dist-sync step all success.

Implementation-wave minimal required validation at the end (post-push, before docs commit):

- `npm run typecheck` — PASS, 0 errors, at `a4c0d4f` (was 14 typecheck errors at `b6745dd` spec-only head for the wave's new types before the migration/data/domain/views fix).
- `npm run lint` — PASS with 7 warnings within `max-warnings 25` (all baseline: 3 `react-hooks/set-state-in-effect` on `void load()`/`void refreshOptions()` + 1 `no-console` in `backupPerformance.test.ts`).
- `npm run openspec:validate` — PASS, 33 passed, 0 failed (spec scenarios added for the 5 requirements that were scenario-less).
- `npm run agent:plan:validate:all` — PASS (including this wave's plan reconciled to COMPLETED and the prior `fix-account-recovery-dist-sync-closure-audit` reconciled to COMPLETED on `6f18cce`/`32269563521`).
- `git diff --check` — PASS, 0 whitespace errors (CRLF handled by repo `.gitattributes` `text eol=crlf`).

Explicitly deferred to hardening unless required to resolve a compile blocker:

- baseline test sweep;
- `npm test`;
- `qa:fast`, `qa:integration`, `qa:timezones`;
- Playwright E2E / dist-sync;
- simulation;
- Android/iOS runtime QA;
- full build matrix;
- live Supabase migration/advisors;
- Backup/Restore/Portable integration validation;
- migration torture/rollback testing;
- performance/accessibility deep audit.

Record actual minimal-gate outcomes here during execution. Do not invent broad validation results.

## Changed Files / Areas

Expected implementation areas:

- `core/db/client.ts`
- `core/db/types.ts`
- `core/auth/account.types.ts`
- `core/providers/navigationContext.ts`
- `core/providers/NavigationProvider.tsx`
- `app/index.tsx`
- `features/overview/OverviewScreen.tsx`
- `features/todos/`
- `features/habits/`
- `features/projects/` (new)
- `features/goals/` (new)
- `features/daily-plan/` (new)
- `features/planning-hub/` (new)
- `features/quick-capture/` (new)
- `features/activity/` (new)
- `features/progress/` (new)

Do not add new planning entities to remote Backup/Portable/Supabase areas during this wave.

## Recovery / Resume Instructions

1. Read `AGENTS.md`.
2. Read `.agent/PLANS.md`.
3. Read this entire OpenSpec change.
4. Fetch/prune and reconcile `origin/main`.
5. Inspect `git status --short`, `git diff --stat`, recent commits, and this plan's checkpoint.
6. Do not run baseline tests merely because this is a fresh session.
7. Continue from `Exact next action` and keep implementing independent slices if one non-critical slice is blocked.
8. Update this plan at major milestones and before final push.

## Outcomes & Retrospective

- Local schema v17 (`projects`, `goals`, `daily_plans`, `todos`/`habits` `project_id`/`goal_id`) — pre-wave baseline was v16 (`weekly_reviews`); this wave adds one append-only migration, local-only so no Supabase deployment tonight (intentional hardening debt).
- Data/domain/views: `core/db/types.ts` (`Project`/`Goal`/`DailyPlan` + `Todo`/`Habit` extensions), `core/db/localMutation.ts` (local-only write primitive — no Supabase outbox enqueue, claims provisional binding), `core/auth/account.types.ts`/`account.data.ts` (`projects`/`goals`/`daily_plans` added to `ACCOUNT_USER_TABLES`/`TABLES_WITH_DELETED_AT`), `core/providers/navigationContext.ts` + `NavigationProvider.tsx` (`PlanningHubView` + `isPlanningHubOpen`/`isQuickCaptureOpen` + `openPlanningHub`/`openQuickCapture`), `app/index.tsx` (Planning Hub `Modal` drawer + Quick Capture `Modal` bottom-sheet + `WeeklyReviewScreen`-style wiring, top-rail `SectionScreens` unchanged, FAB respects `safeAreaBottom`), `features/overview/OverviewScreen.tsx` (compact `Plan Today`/`Progress` entry points calling `openPlanningHub('today')`/`('progress')` alongside `Weekly Review`), `features/todos/todos.data.ts` + `features/habits/habits.data.ts` (`project_id`/`goal_id` via `addColumnIfMissing`, `setTodoProjectGoal`/`setHabitProjectGoal` + create-path passthrough, `applyRemote*` + Habit-circle/`isHabitScheduledOn` semantics unchanged).
- Feature modules: `features/projects/` (`projects.types.ts`/`projects.domain.ts`/`projects.data.ts`/`ProjectListView.tsx`/`ProjectDetailView.tsx` — CRUD/list/reorder/status/soft-delete, status archive/pause, color palette, `active`/`paused`/`completed`/`archived` closed unions, 1000/120-char bounds, `0–100` progress-style status), `features/goals/` (`goals.types.ts`/`goals.domain.ts`/`goals.data.ts`/`GoalListView.tsx`/`GoalDetailView.tsx` — `GoalHorizon`/`GoalStatus` closed unions, 160/1000-char bounds, `progress_percent` 0–100, optional `project_id`, planning-hub linkage), `features/daily-plan/` (`dailyPlan.types.ts`/`dailyPlan.domain.ts`/`dailyPlan.data.ts`/`DailyPlanView.tsx` — one `date_key` per local `YYYY-MM-DD`, `up to 3` `top_todo_ids` via `serializeTopTodoIds`/`parseTopTodoIds`, `toDateKey`/`timestampToLocalDateKey` semantics, `schedule-aware` habit summary (`isHabitScheduledOn` + `target_per_day` fallback), focus target `getCalorieGoal`/`listTodo` pattern, `dailyPlan` reflection/energy focus), `features/planning-hub/PlanningHubScreen.tsx` (Today/Projects/Goals/Progress/Timeline internal tabs, `Today` → `DailyPlanView`, `Projects`/`Goals` → list→detail drill-down, `Progress` → `ProgressInsightsView`, `Timeline` → `ActivityTimelineView`; no seventh tab — modal/drawer via `openPlanningHub(initialView?)`/`closePlanningHub()` in `core/providers/NavigationProvider.tsx`; close/back via stock `Modal`), `features/quick-capture/QuickCaptureOverlay.tsx` (global launcher FAB in `app/index.tsx`, modes: Todo/Habit/Calorie/Project/Goal/Start Focus; Todo/Habit/Calorie reuse `addTodo`/`addHabit`/`addCalorieEntry` canonical paths with `createId(prefix)`/`nowIso`/`runSyncedMutation`; Project/Goal via `projects.data.ts`/`goals.data.ts` `createId('goal')`/`localMutation`; Focus delegates to `setActiveSection('pomodoro')` then `closeQuickCapture`), `features/activity/` (`activityTimeline.types.ts`/`activityTimeline.domain.ts`/`activityTimeline.data.ts`/`ActivityTimelineView.tsx` — derived read model only: Todo completion via `updated_at` exact, Habit completions via `habit_completions` deterministic, Focus via `pomodoro_sessions`, Workout via `workout_logs`, Calories aggregated by `consumed_on` per-day (so the feed doesn't flood), Weekly Review `completed_at`, Daily Plan `completed`, Project `created/completed`, Goal `created/achieved`; bounded by `days` window, `PillChip` filter `All/Productivity/Health/Planning`), `features/progress/` (`progress.types.ts`/`progress.domain.ts`/`progress.summary.ts`/`ProgressInsightsView.tsx` — current-7-day vs prior-7-day `ProgressSummary` from `core/db/client.ts` `weekly_reviews` + `todo`/`habit`/`pomodoro_sessions`/`workout_logs`/`calorie_entries` + `getCalorieGoal` + `habitInsights`; cards are plain `Todo/Habit/Focus/Workout/Calories/WeeklyReview/Project/Goal` delta comparisons, no composite score).
- Minimal validation at final push: `npm run typecheck` — 0 errors (was 14 typecheck + 7 vector-icons en-dash `TS2307` before the wave — all fixed: `Todo`/`Habit` fixture `project_id`/`goal_id`, `ApplicationEffectData` `scheduleId`/`occurrenceId`, vector-icons `@expo/vector-icons` vs `@expo-vector-icons`, `removeTopTodoId` `string→string[]` via `parseTopTodoIds(serializeTopTodoIds(...))`, `scheduleId` string-typed `buildTopTodoIds` removal, `appliesToScope`/`appliesToScopeId` `schedule` alias, `prettier` max-line-breaks); `npm run lint` — 0 errors, 7 warnings within `max-warnings 25` (3 `react-hooks/set-state-in-effect` on `void load()`/`void refreshOptions()` + 1 `no-console` in `tests/integration/backupPerformance.test.ts`); `npm run openspec:validate` — 33 passed, 0 failed (spec deltas updated for scenario-less `ADDED` requirements: Today-facts/Progress-bounded/Navigation-stable/Blocker-bypass/Final-verdict); `npm run agent:plan:validate:all` — PASS with prior `fix-account-recovery-dist-sync-closure-audit` reconciled to COMPLETED on `32269563521`; `git diff --check` — 0 (CRLF handled by repo `.gitattributes` `text eol=crlf`).
- Full test/E2E/simulation/native/Supabase validation intentionally deferred (Overnight Wave — see `openspec/changes/add-productivity-expansion-wave-v1/README.md` hardening handoff).
- Files added: `core/db/localMutation.ts`, `features/activity/*`, `features/daily-plan/*`, `features/goals/*`, `features/planning-hub/*`, `features/progress/*`, `features/projects/*`, `features/quick-capture/*`.
- Files modified: `core/db/client.ts` (migration 17 + `DISTRIBUTED_DB_ID` guard for `projects`/`goals`/`daily_plans`), `core/db/types.ts` (`Project`/`Goal`/`DailyPlan` plus `Todo`/`Habit` `project_id`/`goal_id`), `core/auth/account.types.ts`/`account.data.ts` (`TABLES_WITH_DELETED_AT` + `accountRecovery` scope for the 3 new tables), navigation shell (`NavigationProvider`/`navigationContext` + `app/index.tsx` `isWeeklyReviewOpen`-style `isPlanningHubOpen`/`isQuickCaptureOpen` + `planningHubInitialView` plumbing), `OverviewScreen` entry points, `todos`/`habits` organization linkage, `tsconfig.json` fix, tests fixtures plus 5 missing scenario backfills.
- Hardening debt: Supabase `migrations`/`RLS`/`Backup` + portable export/import for `projects`/`goals`/`daily_plans` (local-only tonight to avoid enqueueing to undeployed tables — `core/db/localMutation.ts` isolation is temporary); dedupe the provisional-owner promotion block that runs in `localMutation` + in `runBackupMutation`/`runSyncedMutation` (next hardening should centralize it); the `lint` warnings above (lift `set-state-in-effect` disables after `useEffect` refactor) plus `openspec`/`agent:plan` warnings that were deferred per the overnight-wave contract.
- Final implementation SHA (this wave's code push): `a4c0d4f71a34fc0ef97d3bc3d327b0a55346f6c9`; documentation/completion bookkeeping SHA to follow. GitHub Actions for `a4c0d4f` is left to the next session's hardening campaign per the wave's "do not chase CI" policy — not blocking for implementation-complete.

`PRODUCTIVITY EXPANSION WAVE V1: IMPLEMENTATION COMPLETE — HARDENING REQUIRED`
