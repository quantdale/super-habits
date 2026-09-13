# ExecPlan: Habit Reminder Interactions V2

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Upgrade the existing V1 local habit reminder so a user can open the exact habit, mark one legitimate completion, or snooze once for 15 minutes. Duplicate and replayed native responses must not double-mutate the habit or Linked Actions, including after process restart.

## Context

- OpenSpec artifacts live in this directory; V1 is `openspec/changes/add-schedule-aware-habit-reminders/` and Habit Engine V2 is `openspec/changes/add-habit-scheduling-and-history-semantics/`.
- The current worktree already contains the completed V1 implementation as dirty changes on `codex/add-schedule-aware-habit-reminders`; preserve all unrelated dirty changes and extend overlapping V1 files carefully.
- V1 uses one root listener in `app/_layout.tsx`, synchronous `Notifications.getLastNotificationResponse()` recovery, `habit-reminder:<habitId>:<dateKey>` IDs, a 14-day one-shot planner/service, and `HabitReminderHost` lifecycle reconciliation.
- Habit Engine V2 authority is `features/habits/habits.domain.ts`; habit persistence/completion/Linked Actions live in `features/habits/habits.data.ts`; navigation is `NavigationProvider` + mounted section shell.
- Current runtime schema is v12; migrations are append-only in `core/db/client.ts`. Supabase stores synced habit rows, but device-operational response dedupe must remain local and unsynced. Supabase migration: none required.
- Expo Notifications 55 supports `setNotificationCategoryAsync`, action `opensAppToForeground`, `data`, deterministic identifiers, scheduled inventory, and `getLastNotificationResponse`.

## Scope

- Stable actionable notification metadata/category and centralized response dispatcher.
- Exact habit pending focus through existing navigation/edit modal.
- Durable local action claim/cleanup, canonical completion, Linked Actions replay safety, and targeted reminder cancellation.
- Fixed same-day 15-minute snooze and V1 reconciliation preservation.
- Unit, real-SQLite/integration, simulation, web, Android native, and regression QA required by impact.

## Non-Goals

- Configurable/recurring snoozes, new routes, push/backend notifications, analytics, web-native action emulation, habit pausing/skipping, or reminder scheduling redesign.
- Remote schema changes or syncing processed-action IDs.
- Resetting, cleaning, stashing, discarding, or overwriting unrelated dirty work.

## Current Checkpoint

- Current milestone: V2 implementation and required QA are complete; this checkpoint records closure evidence before marking the plan COMPLETED.
- Completed: Read repository guidance, workflow, feature/RN/DB skills, Git status/branch/log/plans, completed Habit Engine V2 and Habit Reminders V1 artifacts, current V1 notification/service/navigation/habit/Linked Actions/native infrastructure, Expo Notifications 55 action API, QA impact/autonomous QA docs, and integration harness. Confirmed V1 currently handles foreground listener plus cold-start last-response routing to Habits only. Scaffolded `add-habit-reminder-actions` OpenSpec artifacts.
- In progress: Final plan resume/validation and clean-worktree audit only.
- Important modified files: Existing unrelated/V1 dirty files listed by `git status --short`; V2 implementation spans `lib/notifications.ts`, `app/_layout.tsx`, `core/notifications/`, `core/providers/NavigationProvider.tsx`, `features/habits/`, migration v13, tests, simulation, and `.maestro/`.
- Last successful validation: TypeScript passes; `qa:fast` passes with 0 lint errors/22 warnings; full `npm test` passes 724 tests across 67 files; full integration passes 67 tests; timezone matrix passes 5 zones/42 tests; web build, OpenSpec validation, impact validation, 17-scenario deterministic simulation, P0 journeys 16/16, sync journeys 19/19, Android smoke, Android lifecycle 5/5, V2 action/replay flows, and Android notification-manager delivery pass.
- Current failures: Full `npm run e2e` executes 169 tests with 147 passed and one pre-existing strict J8/CG-4 host-performance miss (`overview→todos` 981ms > 800ms); the focused CG-4 rerun timed out at 120s while mounting the HEAVY fixture. No V2 functional assertion failed. Aggregate `qa:native:targeted` was also not usable on this emulator after Maestro driver startup/heartbeat contention; the affected reminder persistence flows passed serially and the lifecycle aggregate passed 5/5. Full repository `format:check` reports 91 pre-existing/unrelated files; all V2-touched files pass targeted formatting.
- Relevant quarantines: Native notification-shade visual automation, iOS-on-Windows, and workstation native linker limitations remain; V2 same-path injection provides production-dispatch coverage where shade actions cannot be selected reliably.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — implementation, regression evidence, native evidence, OpenSpec tasks, documentation, and validation are complete.
- Remaining definition of done: None. All OpenSpec tasks are checked, durable marker and action semantics are proven with real SQLite, exact focus/cold-start behavior is covered by the response host and Android replay probe, Android action/replay/snooze probes are run or honestly classified, V1/Pomodoro/timezone/simulation/QA regressions are recorded, and this plan is COMPLETED.

## Progress

- [x] Recover repository guidance, Git state, completed Habit Engine V2/V1 artifacts, and current response/native architecture.
- [x] Decide stable metadata, category, exact focus, durable marker, canonical completion, snooze, and web/remote boundaries.
- [x] Create `add-habit-reminder-actions` OpenSpec proposal/spec/design/tasks and this ExecPlan.
- [x] Validate OpenSpec/ExecPlan and inspect apply context.
- [x] Implement metadata/category and centralized response dispatcher.
- [x] Implement exact focus/cold-start pending intent.
- [x] Implement migration 13, durable claims, notification completion, and Linked Actions replay.
- [x] Implement snooze and reconciliation preservation.
- [x] Add unit/integration/web/native same-path action and replay coverage.
- [x] Extend deterministic simulation for V2 action state transitions.
- [x] Run affected/broad/native QA and classify limitations.
- [x] Complete OpenSpec tasks and mark this plan COMPLETED/valid.

## Surprises & Discoveries

- V1's current root host uses `getLastNotificationResponse()` synchronously and does not clear it, so repeated mounting can re-route the same body tap. V2 will keep this recovery boundary but add serialization, durable action keys, and clear-after-handle behavior.
- Expo's installed API states that `opensAppToForeground: false` prevents killed-app action listener delivery; V2 will use foregrounding actions for correctness.
- Existing Linked Actions already dedupe by source event/execution and can repair a post-mutation replay if V2 stores a stable event ID in the local action marker.
- Integration tests use real better-sqlite3 through the app's actual bootstrap/migrations and expose `runAsync().changes`, making migration/claim/restart proof feasible.

## Decision Log

- 2026-08-12 — Use one stable `habitReminder` category with two actions and `opensAppToForeground: true` — installed Expo semantics favor reliable cold-start delivery over invisible action execution.
- 2026-08-12 — Keep normal V1 occurrence IDs and derive snooze IDs as `habit-reminder-snooze:<habitId>:<dateKey>` — preserves V1 reconciliation identity while making snoozes distinguishable and deterministic.
- 2026-08-12 — Add a local SQLite processed-action table at schema v13 — app_meta JSON would make atomic claim plus bounded cleanup less explicit and harder to test/replay.
- 2026-08-12 — Store a generated Linked Action event ID in each Mark Complete claim — completion/marker can commit atomically while the existing Linked Actions engine remains outside that transaction and still dedupes/retries safely.
- 2026-08-12 — Use existing Habits edit modal for exact focus — satisfies routing without a new detail screen or route.
- 2026-08-12 — No Supabase migration — processed-action state is device-local operational metadata, and completion rows remain local-only.
- 2026-08-12 — Use foregrounding actionable categories plus a same-path test injection seam — Expo’s installed API documents that background-only actions do not reliably reach the JS response listener after process death; the e2e build therefore tests native delivery and production dispatch separately where shade automation is unreliable.

## Validation Ledger

- 2026-08-12 — `git status --short; git branch -vv; git log --oneline --decorate -15; npm run agent:plans` — PASS — recovered current V1-dirty worktree and completed plans; unrelated changes preserved.
- 2026-08-12 — V1/Habit Engine/OpenSpec/source/API/native audit — PASS — response, navigation, mutation, Linked Actions, Expo categories/actions, SQLite harness, and QA boundaries recorded.
- 2026-08-12 — New OpenSpec/ExecPlan validation — PASS — strict OpenSpec validation and `npm run agent:plan:validate -- --plan ...` both passed.
- 2026-08-12 — Core V2 implementation and focused QA — PASS — typecheck, unit, focused dispatcher/domain, real-SQLite action/restart/retention, migration, and notification-category tests passed; full unit total is 654 tests.
- 2026-08-12 — V2 native action probes — PASS — rebuilt/installed Android APK; exact ID tap, Mark complete UI refresh, fixed 15-minute Snooze path, replay after kill/relaunch, real notification-manager delivery, and Pomodoro lifecycle isolation passed through the production response bridge; iOS correctly blocked by Windows/Xcode environment.
- 2026-08-12 — V2 broad QA — PASS — full `npm test` 724/724, `qa:fast`, integration 67/67, timezone 5-zone matrix, web build, OpenSpec validation, impact validation, deterministic simulation 17/17, P0 journeys 16/16, and sync journeys 19/19 passed. Full E2E preserved one existing J8 CG-4 performance miss and focused rerun timeout without threshold changes.

## Changed Files / Areas

- `openspec/changes/add-habit-reminder-actions/` — V2 proposal, spec, design, tasks, and living plan.
- `lib/notifications.ts`, `core/notifications/notificationResponseDispatcher.ts`, `app/_layout.tsx` — category/action metadata and one response path.
- `core/providers/NavigationProvider.tsx`, `features/habits/HabitsScreen.tsx` — exact ID focus and one-shot pending intent.
- `core/db/client.ts`, `features/habits/notificationActions.data.ts`, `features/habits/habits.data.ts` — v13 local dedupe and canonical notification completion.
- `features/habits/habitReminders.domain.ts`, `features/habits/habitReminders.service.ts`, `features/habits/habitReminderActions.ts` — occurrence/snooze semantics and reconciliation.
- `tests/`, `tests/integration/`, `simulation/`, `.maestro/`, `docs/testing/`, and `qa/impact-map.json` — contract, native, simulation, and QA evidence.
- `simulation/scenarios/habitReminderActions.ts`, `tests/simulation.habitReminderActions.test.ts` — deterministic V2 action-state simulation coverage.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan, and all files in this OpenSpec change.
2. Run `git status --short`, `git diff --stat`, and `git diff --name-only`; preserve unrelated/V1 dirty files and inspect overlapping diffs.
3. Run `npm run agent:resume -- --plan openspec/changes/add-habit-reminder-actions/execplan.md` and reconcile warnings.
4. Run `npx --no-install openspec status --change add-habit-reminder-actions --json` and `npx --no-install openspec instructions apply --change add-habit-reminder-actions --json`; read every returned context file before implementation.
5. Continue only from `Exact next action`; update this checkpoint after every milestone, decision, failure, fix, and before native/broad QA.
6. Use `npm run qa:affected` after meaningful code changes and follow its selected gates. Preserve failures/artifacts and classify them with repository taxonomy.
7. Before finishing, run OpenSpec validation, `npm run agent:plan:validate -- --plan ...`, relevant QA, inspect diff/stat/status, and update Outcomes.

## Outcomes & Retrospective

- Status: COMPLETED.
- Summary: Habit Reminder Interactions V2 is implemented, specified, tested against real SQLite, exercised on Android through the production response seam, and documented with known platform/performance limitations.
- Proof: 724 full Vitest tests including 15 real-SQLite action tests, 3 deterministic V2 simulation tests, Android action/replay/delivery/lifecycle evidence, and green V1/sync/timezone/web regression lanes.
- Remaining risks: Visual notification-shade action selection and iOS actionable notifications remain unproven on Nitro; CG-4 remains a pre-existing strict HEAVY performance risk; aggregate native targeted execution is sensitive to Maestro emulator contention.
- Follow-up: Next product phase should address the highest-value HEAVY interaction bottleneck (CG-4) with dedicated profiling, then pursue native shade/iOS action UX coverage on supported infrastructure.
