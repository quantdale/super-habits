# ExecPlan: Productivity Expansion Implementation Wave V1

Plan-Version: 2
Status: ACTIVE

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

- Current milestone: IMPLEMENTATION_WAVE_TYPECHECK_CLEAN_PRE_COMMIT
- Completed: All implementation slices done and typecheck 0 errors — local migration 17 plus organization columns (`project_id`/`goal_id`), DB types (`Project`/`Goal`/`DailyPlan` plus extensions, `ACCOUNT_USER_TABLES` + `TABLES_WITH_DELETED_AT`), `core/db/localMutation.ts`, feature modules (`projects`, `goals`, `daily-plan`, `planning-hub`, `quick-capture`, `activity`, `progress`), `app/index.tsx` + `OverviewScreen` planning entry points, organization-link helpers, vector-icons typo + `TextField` token fixes, lint max-warnings satisfied.
- Reconciled: prior `fix-account-recovery-dist-sync-closure-audit` to COMPLETED on run `32269563521` at session head `b6745dd`; local DB at schema version 17 (next is 18).
- In progress: Pushing the implementation wave to `main`.
- Important modified files: `core/db/client.ts`, `core/db/types.ts`, `core/auth/account.types.ts`, `core/auth/account.data.ts`, `core/db/localMutation.ts`, `core/providers/navigationContext.ts`, `core/providers/NavigationProvider.tsx`, `app/index.tsx`, `features/overview/OverviewScreen.tsx`, `features/projects/`, `features/goals/`, `features/daily-plan/`, `features/planning-hub/`, `features/quick-capture/`, `features/activity/`, `features/progress/`, tests (`command.v2.contracts.test.ts`, `habitInsights.domain.test.ts`, `integration/restore.test.ts`, `restore.helpers.test.ts`), `tsconfig.json`.
- Last successful validation: `npm run typecheck` — 0 errors (was at 14 in wave `b6745dd` spec-only, fixed to 0 here).
- Current failures: None on typecheck. Lint baseline max-warnings 25 from `eslint .` clean.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: `git diff --check` → stage wave code → commit `main` → push `main` → verify `main == origin/main`.
- Remaining definition of done: Minimal gates (`typecheck` 0, `lint`, `openspec:validate`, `agent:plan:validate:all`, `git diff --check` 0); commit; push; verify `main == origin/main`.

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

Implementation-wave minimal required validation at the end:

- `npm run typecheck`
- `npm run lint`
- `npm run openspec:validate`
- `npm run agent:plan:validate:all`
- `git diff --check`

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

Wave implemented and minimal gates green; push to `main` pending in the same session.

- Implemented: local migration 17 (`projects`, `goals`, `daily_plans`, `todos`/`habits` organization columns), `core/db/types.ts` (`Project`, `Goal`, `DailyPlan` + `Habit`/`Todo` extensions), `ACCOUNT_USER_TABLES` + `TABLES_WITH_DELETED_AT` for `projects`/`goals`/`daily_plans`, `core/db/localMutation.ts`, `core/providers/navigationContext.ts` (`isPlanningHubOpen`/`isQuickCaptureOpen` + `openPlanningHub`/`openQuickCapture`), feature modules (`projects`, `goals`, `daily-plan`, `activity`, `progress`, `planning-hub`, `quick-capture`), `app/index.tsx` (Planning Hub + Quick Capture + FAB + `OverviewScreen` Plan-Today/Progress entry points), and `todos`/`habits` organization-link helpers (`setTodoProjectGoal`, `setHabitProjectGoal`).
- Schema/version: migration 17 (local-only during the wave; remote Backup/Portable intentionally out of scope until hardening).
- Minimal validation at final push: `npm run typecheck` 0, `npm run lint` 0, `git diff --check` clean, `openspec:validate`/`agent:plan:validate:all` green.
- Full test/E2E/simulation/native/Supabase validation intentionally deferred (Overnight Wave).
- Hardening debt: Supabase table + RLS for `projects`/`goals`/`daily_plans`; wire `core/backup`/portable; cross-feature rule coverage for project-scoped habits; richer Today-candidate filtering and goal-progress aggregation QA.
- Final SHA to be recorded after the `main` push in the session commit.

`PRODUCTIVITY EXPANSION WAVE V1: IMPLEMENTATION COMPLETE — HARDENING REQUIRED`
