<agent_swarm_result>
<summary>completed: 10</summary>
<subagent agent_id="agent-13" item="AREA 1 — HABITS LIFECYCLE + TODOS BULK: Audit features/habits/** and features/todos/**. Questions: (a) Exactly how are habit due-state, streaks, and consistency computed (files/functions/SQL)? How does rule_history drive scheduling? Identify every calculation that walks dates — what would 'a paused interval must not create false misses' require at each site? (b) How do HabitsScreen/HabitDetailModal pause/archive flows work; what breaks on restore/reinstall or multi-device disagreement? (c) Enumerate ALL todo bulk/multi-record operations (bulk complete/uncomplete/priority/delete etc.) — sequential loops? transactional? idempotent on retry? partial-failure reporting? (d) How do todos interact with projects/goals/daily_plans.top_todo_ids and where can duplicates arise? (e) List every query/surface that must consult habit status once it becomes a durable column." outcome="completed">All evidence gathered. Here is the audit report.

---

# AREA 1 AUDIT — HABITS LIFECYCLE + TODOS BULK

## Area map (answers to the audit questions)

**(a) How due-state, streaks, consistency are computed**

- **Rule resolution:** `getHabitRuleForDate()` (`features/habits/habits.domain.ts:137-159`) parses `habits.rule_history` (JSON array of `{effective_from_date, weekdays, target_per_day}`, deduped/sorted by `parseHabitRuleHistory`:80-102) and returns the last rule with `effective_from_date <= dateKey`; `null` = pre-first-rule date. With **empty** history it falls back to an every-day rule from `'0000-01-01'` unless a `fallbackEffectiveFromDate` is supplied and `dateKey` precedes it.
- **Due-state:** `isHabitScheduledOn()` (`habits.domain.ts:173-186`) = rule exists ∧ `weekdays.includes(weekdayForDateKey(dateKey))` (local calendar, Mon=1…Sun=7, `habits.domain.ts:127-130`).
- **Day history:** `buildDayCompletions()` (`habits.domain.ts:250-282`) walks dates either from `firstHistoryDate()` (first rule date → earliest completion → today, via `buildDateKeysBetween`:205-215) or a trailing `days` window (`buildDateRangeOldestFirst`, `lib/time.ts:64-72`). Per date it emits `{scheduled, eligible = scheduled && dateKey <= todayKey, completed = eligible && count >= target}`.
- **Streaks:** `calculateCurrentStreak()` (`habits.domain.ts:289-309`) filters `scheduled && eligible && <= today`, grants grace to an incomplete *today*, then walks backwards counting consecutive completed until a scheduled miss. `calculateLongestStreak()` (:312-325) resets on any scheduled miss, skips unscheduled/ineligible.
- **Consistency/heatmap:** `buildHabitGrid()` (:381-416, 364 cells/habit) → `calculateOverallConsistency()` (:418-429, eligible cells only), `buildAggregatedHabitHeatmap()` (:432-453), `buildHabitActivityDays()` (:459-479). Insights recompute windows/trend in `features/habits/habitInsights.domain.ts:54-167`.

**Every date-walking site and what "a paused interval must not create false misses" requires there:**

| Site | Requirement |
|---|---|
| `buildDateKeysBetween` / `buildDateRangeOldestFirst` (`habits.domain.ts:205`, `lib/time.ts:64`) | Range generation itself needs no change; masking happens downstream. |
| `buildDayCompletions` (`habits.domain.ts:250`) | Needs a pause-interval input so paused dates get `scheduled=false` (or a dedicated `paused` flag excluded from `eligible`). Marking them unscheduled is sufficient: both streak functions already skip unscheduled dates, so the streak bridges the gap instead of breaking. |
| `calculateCurrentStreak` (:289) / `calculateLongestStreak` (:312) | No code change needed **if** paused days arrive as unscheduled; otherwise they need the interval mask directly. |
| `buildHabitGrid` (:381) + `calculateOverallConsistency` (:418) + `buildAggregatedHabitHeatmap` (:432) + `buildHabitActivityDays` (:459) | Paused dates must leave the eligible denominator entirely (not count as misses). |
| `habitInsights.domain.ts` `calculateRate`/`calculateTrend`/windows (:54-127) | Same denominator exclusion per 7/30/90 window and trend periods. |
| `habitReminders.domain.buildHabitReminderPlan` (:155-214) | Must skip habits currently paused/archived (and ideally any future-dated pause). |
| `habitReminderActions.runSnooze` validity check (`habitReminderActions.ts:149-170`) | Must treat paused/archived as invalid. |
| Consumers: `overview.domain.shapeHabitsSummary` (:216-218), `DailyPlanView.tsx:83`, `command.executor.executeLogHabit` (:182), `command.review.ts:518`, `ask.retrieval.ts:355`, `weeklyReview.summary.summarizeHabits` (:103-115) | All must exclude paused/archived from "scheduled today"/summary denominators. |

Today **none** of these receive any pause information — see Finding 1.

**(b) Pause/archive flows:** `HabitsScreen.handleTogglePause/handleToggleArchive` (`features/habits/HabitsScreen.tsx:191-213`) toggle string-id arrays persisted to AsyncStorage keys `superhabits.habits.pausedIds` / `.archivedIds` (`features/habits/habitLifecycle.store.ts:10-11`). Only consumer: `filterHabits` inside `displayedHabits` (`HabitsScreen.tsx:181-189`) and the `HabitDetailModal` lifecycle card (`HabitDetailModal.tsx:152-178`). Failures listed in Findings 1–3.

**(c) Bulk operations inventory** (all in `features/todos/todos.data.ts`): `bulkSetTodoCompletion` (:732), `bulkUpdateTodoPriority` (:738), `bulkAssignTodosProject` (:744), `bulkRemoveTodos` (:753), plus drag-reorder `updateTodoOrder` (:323) and batch recurrence expansion `createRecurringInstances` (:236). All are **sequential loops of independent single-row transactions** — see Finding 4.

**(d) Todos ↔ projects/goals/top_todo_ids:** associations validated/written in `setTodoProjectGoal`/`updateTodo` (`todos.data.ts:343-548`) with goal→project auto-alignment; project/goal deletion cascades clear children (`goals.data.ts:132-141,174-181`, `projects.data.ts:142-153`) — but without sync enqueue (Finding 5). `daily_plans.top_todo_ids` is deduped and capped by `parseTopTodoIds`/`serializeTopTodoIds` (`dailyPlan.domain.ts:102-130`), `toggleTopTodoId` no-ops duplicates, and `computeCarryForwardIds` (:22-39) excludes current selections — so **in-plan duplicates cannot arise through the domain layer**. Cross-cutting ghost references: Finding 11.

**(e)** Surfaces needing the durable status column: see SCHEMA/SETTINGS INPUTS below.

---

## Findings

### F1 — P1: Pause/archive is display-only; every metric still treats paused/archived habits as active, so pauses create false misses today
- **Where:** `features/habits/habitLifecycle.store.ts:3-8` (docstring claims pause "excludes from today progress"); `features/habits/HabitsScreen.tsx:181-189` (only `displayedHabits` filters) vs `HabitsScreen.tsx:215-282` (streak loop :240-253, consistency grid :255-278) and `HabitsScreen.tsx:627-639` (`todayProgress` iterates unfiltered `habits`); `features/habits/habits.domain.ts:250-479` (all date-walkers take no pause input).
- **What is wrong:** Pausing a habit removes it only from the visible list. Its scheduled-but-incomplete days still break `calculateCurrentStreak`, still count as misses in `calculateOverallConsistency`, the 364-day heatmap, aggregated activity, insights rates/trend, Overview rings (`overview.domain.ts:216-218`), and Daily Plan habit summary (`DailyPlanView.tsx:81-85`). The store's own docstring describes behavior that does not exist.
- **Why it matters:** This is precisely the "paused interval creates false misses" scenario. A user pausing for a vacation returns to a destroyed streak and depressed consistency despite zero missed obligations.
- **Fix:** Make pause a durable interval (see SCHEMA section), thread it into `buildDayCompletions`/`buildHabitGrid` as masked dates (`scheduled=false` semantics — streaks then bridge gaps for free), and exclude paused dates from consistency/heatmap/insight denominators. Update the `habitLifecycle.store.ts` docstring or delete the module once the column lands.

### F2 — P1: Lifecycle state is AsyncStorage-only: lost on reinstall/restore, invisible to other devices, never cleaned up on delete
- **Where:** `features/habits/habitLifecycle.store.ts:10-46`; sole consumer `HabitsScreen.tsx:67-70,191-213,218`; not present in `core/backup/backupSettings.ts` allowlist (calorieGoal, pomodoroSettings, theme.mode, theme.slots only) nor in `BACKUP_ENTITY_COLUMNS.habits` (`core/backup/backup.types.ts:88-102`); `deleteHabit` (`habits.data.ts:742-777`) never removes ids from the sets.
- **What is wrong:** (i) Restore V2 / portable import reconstructs habits but not lifecycle → everything reappears Active after the exact scenarios backup exists for. (ii) Multi-device: pausing on device A leaves device B fully active (reminders, stats). (iii) Deleted habit ids accumulate in the arrays forever. (iv) Write failures are silently swallowed (`store.ts:28-30`), so a failed persist reverts on next `refresh()` with no signal.
- **Why it matters:** User intent ("hide this habit") silently evaporates exactly when restore/reinstall is used; cross-device behavior is contradictory.
- **Fix:** Add durable `habits.status` (+ interval history) in migration v20, backfill once from the AsyncStorage keys, keep AsyncStorage as a deprecated read-only fallback for one release, and have `deleteHabit`'s transaction no longer need set cleanup (row tombstone carries status). Interaction note: this complements the already-registered defect "habit pause/archive lifecycle is AsyncStorage-only".

### F3 — P1: Habit reminders (and notification mark-complete) ignore lifecycle state
- **Where:** `features/habits/habitReminders.service.ts:189-202` (`loadPlannerInputs` → `listHabits()`, unfiltered) feeding `buildHabitReminderPlan` (`habitReminders.domain.ts:155-214`); snooze validity `habitReminderActions.ts:144-170`; `completeHabitFromNotification` (`habits.data.ts:270-384`) checks schedule/target but has no status guard; Command Center `executeLogHabit` (`features/command/command.executor.ts:177-193`) likewise.
- **What is wrong:** A paused or archived habit with a configured `reminder_time` keeps generating native notifications every scheduled day for 14 days out, and tapping "Mark complete" on such a notification still increments it.
- **Why it matters:** The most aggressive user-visible consequence of F1/F2 — notifications nagging about a habit the user explicitly paused; a restored device (post-reinstall) resumes nagging with no way the user expects.
- **Fix:** Once status is durable, filter in `loadPlannerInputs`/`buildHabitReminderPlan` inputs, treat non-active status as invalid in snooze validation, and no-op (with `linked_required=false`) in `completeHabitFromNotification` and `executeLogHabit`.

### F4 — P1: Todo bulk operations are non-transactional loops with silent partial failure and an unhandled rejection that strands the UI
- **Where:** `features/todos/todos.data.ts:727-757` (`bulkSetTodoCompletion`, `bulkUpdateTodoPriority`, `bulkAssignTodosProject`, `bulkRemoveTodos` — documented as intentionally sequential); UI wiring `features/todos/TodosScreen.tsx:366-395` (`runBulkAction` awaits `action()` then exits selection + refreshes) invoked as `void handleBulkComplete()` (:636-641).
- **What is wrong:**
  - Each item is its own `runSyncedMutation` transaction; a failure at item k of N leaves k−1 committed, k..N untouched, **with no result object, count, or error surfaced** — `runBulkAction` has no try/catch, so the rejection escapes as an unhandled promise rejection, `exitSelectionMode()`/`refresh()` never run, and the screen stays in selection mode showing stale rows.
  - Retry is idempotent per-item (completed→complete is a no-op at `todos.data.ts:609-611,639-644`; tombstoned delete no-ops at :770), which is good, but nothing tells the user a retry is needed.
  - `bulkUpdateTodoPriority` routes through `updateTodo`, which re-reads the row and re-syncs the due-date reminder per item (:446-460) — wasted work, and priority-only edits always rewrite + re-enqueue even when the value is unchanged.
- **Why it matters:** A mid-batch SQLite failure (web OPFS pressure, large selection) yields a half-applied bulk edit with zero feedback — the classic "did my delete happen?" support bug.
- **Fix:** Wrap each bulk op in one `runBackupMutation` transaction (enqueue per changed row inside it, mirroring `incrementHabit`'s pattern at `habits.data.ts:172-195`), return `{changed, skipped}` counts, and have `runBulkAction` catch errors → `showNotice` + refresh. Keep per-item semantics identical; single-transaction batching preserves exactly-once linked-action dispatch because `setTodoCompletion`'s engine call runs post-commit per item regardless.

### F5 — P1: Project/goal cascades mutate synced `todos`/`habits` rows without sync-outbox enqueue → permanent backup drift
- **Where:** `features/goals/goals.data.ts:132-141` (goal re-parent cascades `project_id` onto todos+habits) and `:166-192` (goal delete clears `goal_id`); `features/projects/projects.data.ts:142-153` (project delete clears `project_id`); comments at `goals.data.ts:150-154,187-190` claim children are "local-only this wave".
- **What is wrong:** `todos` and `habits` **are** synced entities with a Supabase contract. These cascades `UPDATE ... updated_at = now` outside any `runSyncedMutation`, so no outbox record is created. After the next successful flush of earlier records, the remote row keeps the pre-cascade `project_id`/`goal_id` indefinitely (the adapter reads live rows only when a pending record exists, `core/sync/supabase.adapter.ts:178`). A later cloud restore silently resurrects stale associations.
- **Why it matters:** Silent divergence between local truth and the backup that restore depends on; combined with the registered "cloud restore never imports projects/goals" defect, a restored device shows todos attached to projects/goals that no longer exist remotely.
- **Fix:** Perform the cascades inside the same transaction as an enqueued per-child outbox record (the `enqueue` callback of `runBackupMutation`), or migrate the whole goal/project update onto `runBackupMutation` with child intents. The comment's own escape clause ("once these entities gain a contract") is already stale for todos/habits.

### F6 — P2: Weekly-review habit summary assumes every habit is scheduled 7 days/week (boundary consumer)
- **Where:** `features/weekly-review/weeklyReview.summary.ts:99-115` (`daysInWeek = 7` for every habit; ignores `rule_history`; compares against `target_per_day` only).
- **What is wrong:** An M/W/F habit is counted as 7 scheduled occurrences with 0 completed on off-days → inflated `totalScheduled`, deflated consistency, false "attention" flags. Every other consumer uses `isHabitScheduledOn`/rule-resolved targets.
- **Why it matters:** Incorrect statistics presented in review flow; will also be wrong about pauses once those exist. *(Adjacent area — flagged here because it consumes habit scheduling; coordinate with the weekly-review owner.)*
- **Fix:** Reuse `buildDayCompletions` + rule-resolved targets over the week range, exactly like `HabitDetailModal` does.

### F7 — P2: `buildHabitGrid` ignores its `todayKey` parameter when generating the date range
- **Where:** `features/habits/habits.domain.ts:381-393` — `dateKeys = buildDateRangeOldestFirst(days)` reads the real system clock, while eligibility compares against the injected `todayKey` (:401).
- **What is wrong:** Any caller passing a synthetic `todayKey` (tests, future "as-of" views) gets cells generated for real-today but graded against the synthetic key; harmless in production only by coincidence.
- **Fix:** Derive the range from `todayKey` (mirror `buildDateKeysBetween` semantics) or drop the parameter and document real-clock anchoring.

### F8 — P2: Inconsistent creation-date fallback for empty `rule_history` between streak surfaces
- **Where:** `HabitsScreen.tsx:243-250` and `HabitDetailModal.tsx:73-80` call `buildDayCompletions` with `fallbackEffectiveFromDate = undefined`, while `habitInsights.domain.ts:141-149` passes `creationDateKeyFromTimestamp(habit.created_at)`.
- **What is wrong:** For a row with empty `rule_history` (possible only via a malformed remote/imported row, since migration 12 backfills and `applyRemoteHabits` rebuilds — `habits.data.ts:986-992`), the two surfaces disagree: `getHabitRuleForDate`'s legacy fallback (`habits.domain.ts:144-151`) makes the entire pre-creation history eligible on the streak paths but not the insights path.
- **Fix:** Pass the creation-date fallback uniformly (small helper shared by all three call sites).

### F9 — P2: `sort_order` allocation races in `addTodo` and `createRecurringInstances`
- **Where:** `todos.data.ts:181-185` (MAX(sort_order) read **outside** the insert transaction); `todos.data.ts:239-285` (one pre-read max, then `Promise.all` of independent transactions assigning `firstSortOrder + index`).
- **What is wrong:** Two near-simultaneous adds (or a recurrence batch racing a manual add) can allocate duplicate `sort_order`. Ordering ties then fall to `created_at DESC` (`listTodos`, :71-78), silently reordering. No corruption, but manual order is user-visible state.
- **Fix:** Move the MAX read inside the mutation transaction (it already runs in one), or use `INSERT ... SELECT COALESCE(MAX(sort_order),0)+1 ...` so allocation is atomic with the insert.

### F10 — P2: `updateTodoOrder` commits N separate transactions per drag
- **Where:** `todos.data.ts:323-341`; caller `TodosScreen.tsx:442-454`.
- **What is wrong:** One `runSyncedMutation` per id → N transactions/outbox records; a mid-loop failure leaves a mixed ordering. Absolute values make retries safe, so this is polish, not correctness — but a single transaction with per-row enqueues (F4's primitive) is strictly better and cheaper on web OPFS.
- **Fix:** Batch into one `runBackupMutation`.

### F11 — P2: Deleting a todo leaves dangling ids in `daily_plans.top_todo_ids`
- **Where:** `removeTodo` (`todos.data.ts:759-794`) prunes linked-action rules but not plans; pruning happens only opportunistically at save time (`dailyPlan.data.ts:52-62,74-79`); renderer shows `(unavailable)` placeholders (`DailyPlanView.tsx:140-144`).
- **What is wrong:** Completed/deleted top priorities linger as "(unavailable)" rows until the user manually saves the plan; adherence/carry-forward read plans containing dead ids (`carryForwardFromPreviousDay` tolerates them via `listPendingTodos` filtering, so impact is cosmetic-plus).
- **Fix:** Either prune `top_todo_ids` in `removeTodo`'s transaction (local-only mutation, no outbox needed for `daily_plans` this wave) or filter dead ids at read time in `DailyPlanView`.

### F12 — P2: Bulk "No project" breaks the goal→project alignment invariant
- **Where:** `setTodoProjectGoal` (`todos.data.ts:487-548`) with `{projectId: null}` never inspects `goal_id`; reachable in bulk via `TodoBulkBar` "No project" chip (`TodoBulkBar.tsx:73-78` → `bulkAssignTodosProject`).
- **What is wrong:** A todo assigned to a goal that belongs to project P ends with `project_id = NULL, goal_id = G(P)` — contradicting the alignment invariant the same function documents and enforces in the opposite direction. Single-edit path has the same hole.
- **Fix:** When clearing `projectId` while `goal_id` points to a goal with a project, either refuse, clear the goal too, or re-align to the goal's project — pick one and encode it in `setTodoProjectGoal` so bulk inherits it.

### F13 — P2: `HabitsScreen.refresh()` performs two full completion-table scans per refresh
- **Where:** `HabitsScreen.tsx:225` (`getAllHabitCompletions()` — entire table) followed by `:260` (`getAllHabitCompletionsForRange(start364, end)` — overlapping data).
- **What is wrong:** Redundant full scan on every focus/day-rollover refresh; on web OPFS this is the section's dominant cost as history grows.
- **Fix:** Derive today counts and streaks from the single ranged query (364 days covers both), or fetch once and slice.

---

## SCHEMA/SETTINGS INPUTS

New durable columns (migration **v20**, append-only block in `core/db/client.ts`, using `addColumnIfMissing`):

1. **`habits.status TEXT NOT NULL DEFAULT 'active'`** — values `active | paused | archived` (app-level validation; avoid inline CHECK via `ALTER TABLE`). Consumer sites: `listHabits` consumers above; `HabitsScreen` (replace AsyncStorage sets in `filterHabits` calls, `HabitDetailModal.lifecycleState` prop `HabitDetailModal.tsx:24-27,1387-1395`); `overview.domain.shapeHabitsSummary`; `DailyPlanView.tsx:83`; `command.executor.ts:177-193`; `command.review.ts:486-529`; `ask.retrieval.ts`; `linkedActionsTargetProviders.ts:86` (exclude archived from target picker); reminder pipeline (`habitReminders.service.ts:189-202`, `habitReminders.domain.ts:155-214`, `habitReminderActions.ts:144-170`); completion guards (`habits.data.ts:129-238,270-384`).
2. **`habits.paused_at TEXT NULL`** — ISO timestamp captured when entering `paused` (ordering/debugging; nullable, cleared on resume optional).
3. **`habits.lifecycle_history TEXT NULL`** — JSON array of `{status, from_date_key, to_date_key|null}` intervals, mirroring the established `rule_history` pattern (`parseHabitRuleHistory` precedent). This is what lets `buildDayCompletions`/`buildHabitGrid` mask *historical* paused dates — a bare status boolean cannot repair past misses. All date-walking sites in table (a) consume it via one shared parser next to `habits.domain.ts`.

Downstream contract updates required in the same change:
- `core/backup/backup.types.ts`: append the three columns to `BACKUP_ENTITY_COLUMNS.habits` (:88-102). Do **not** touch `PORTABLE_V1_ENTITY_COLUMNS.habits` (:264-276) — V1 checksums are frozen; Portable V2 column list must gain them.
- `applyRemoteHabits` INSERT column list (`habits.data.ts:993-1020`).
- Remote Supabase table needs matching columns; the adapter pushes raw row objects (`supabase.adapter.ts:178` `SELECT *`), so local/remote name parity is mandatory. *(UNCERTAIN: exact remote DDL location/mechanism — `supabase/migrations/` exists but I did not audit remote schema ownership; coordinate with the backup-area auditor.)*
- `core/backup/backupValidators.ts` habit validator: accept + enum-validate `status`, validate `lifecycle_history` shape.
- One-time backfill in v20: read AsyncStorage `superhabits.habits.pausedIds`/`archivedIds`, write `status` accordingly. *(UNCERTAIN: whether the campaign prefers in-migration AsyncStorage read — migrations are DB-layer and AsyncStorage is async, so more likely a post-open idempotent reconciliation step in `AppProviders` bootstrap or in `habitLifecycle.store.ts`; flagging for design decision.)*
- No new settings keys needed; the recoverable-settings allowlist is untouched (status rides the habits entity, which is the correct owner).

## TEST COVERAGE GAPS

- **`tests/habits.domain.test.ts`** — zero pause-aware tests: paused-interval masking for `buildDayCompletions`, streak bridging across a pause (current *and* longest), consistency/heatmap denominator exclusion, insights windows spanning a pause. Also: `buildHabitGrid` with synthetic `todayKey` (F7).
- **`tests/habitReminders.domain.test.ts` / `tests/habitReminders.service.test.ts`** — no "paused/archived habit produces no planned occurrence / snooze invalid" cases (F3).
- **`tests/habits.data.test.ts`** — no tests for status-column writes, `completeHabitFromNotification` refusing a paused habit, or v20 backfill from AsyncStorage sets.
- **`tests/db.client.test.ts`** — migration v20 append-only/backfill/idempotence test (pattern exists for prior versions; none for lifecycle columns).
- **`tests/todos.data.test.ts`** — bulk coverage (:562-640) is happy-path only. Missing: partial-failure behavior (missing id mid-batch), retry idempotency assertions, returned counts, single-transaction atomicity once F4 lands, `updateTodoOrder` persistence + failure handling (F10).
- **`tests/associationInvariants.test.ts`** — no case for bulk/single project-clear leaving a goal-aligned todo with `project_id = NULL` (F12), nor for cascade-without-enqueue drift (F5 — belongs with the sync/backup suite, e.g. `tests/sync.engine.test.ts` or `tests/integration/backupRestore.test.ts`).
- **`e2e/todos.spec.ts`** — no bulk journey exists anywhere in `e2e/` (grep for `bulk|multi-select|selection mode` returns nothing). New spec `e2e/todos-bulk.spec.ts`: select-many → complete/reopen/delete/priority/project, verify DB-persistent effects after reload, and exit-selection-on-error behavior.
- **`e2e/habits.spec.ts`** — no pause/archive coverage. New spec `e2e/habits-lifecycle.spec.ts`: pause hides from Active but preserves streak across the gap; archive excludes from Today/consistency; state survives reload (this test is **red today** and correctly documents F1/F2).
- **`tests/integration/backupRestore.test.ts`** — round-trip asserting `status`/`lifecycle_history` survive backup→restore and that a paused interval does not produce misses post-restore.</subagent>
<subagent agent_id="agent-14" item="AREA 2 — PLANNING IDEMPOTENCY: Audit features/daily-plan/**, features/planning-hub/**, features/weekly-review/**, features/goals/**, features/projects/**. Questions: (a) Weekly Review next-week application: exact write path; idempotent/duplicate-safe on repeated action? transactional? (b) Daily plan carry-forward/batch writes: same analysis. (c) daily_plans date_key uniqueness after the v18 rebuild — can concurrent/repeated creates duplicate rows? (d) Project/goal rollups: which rollup functions exist in domain vs data layers; do real-SQLite tests exist; what exactly is missing? (e) Any sequential multi-record loops lacking atomicity or structured per-item outcomes. (f) completed_at backfill (v19): any code assuming NULL completed_at means incomplete?" outcome="completed">All audit-area files, migration blocks, sync/backup contracts, and test suites have been examined. Here is the report.

# AREA 2 — PLANNING IDEMPOTENCY AUDIT REPORT

Scope: `features/daily-plan/**`, `features/planning-hub/**`, `features/weekly-review/**`, `features/goals/**`, `features/projects/**`, plus the DB/sync contract surfaces they write through. All line numbers verified on current `main` (HEAD `d817103`).

---

## FINDINGS

### F1 — P0: Projects/Goals/Daily Plans are declared Backup Scope V4 entities, but their data layers never enqueue outbox intents — ongoing writes never reach the remote backup

**Where:**
- Contract side: `core/backup/backup.types.ts:32-49` (`BACKUP_ENTITIES` includes `weekly_reviews`, `projects`, `goals`, `daily_plans`), `:20` (`BACKUP_SCOPE_VERSION = 4`), `:457-469` (all four in `BACKUP_SOFT_DELETE_ENTITIES`), `:179-235` (full column lists); validators exist at `core/backup/backupValidators.ts:483-561`; remote tables exist in `supabase/migrations/20260820010000_planning_schema_convergence.sql`.
- Mutation side: `features/projects/projects.data.ts:44, 119, 134, 171` and `features/goals/goals.data.ts:40, 119, 169` and `features/daily-plan/dailyPlan.data.ts:88, 151, 179` all use `runLocalMutation`, which by design enqueues nothing (`core/db/localMutation.ts:5-24`). A repo-wide grep finds **zero** `entity: 'projects' | 'goals' | 'daily_plans'` enqueue sites.
- The one-time V2 backfill (`core/backup/backupBackfill.ts:142-168`) enqueues existing rows exactly once per scope epoch; after `backup.scope_version >= 4` it returns `'done'` forever.

**What is wrong:** The stale comments in `projects.data.ts:160-165`, `goals.data.ts:150-154, 187-191`, and `localMutation.ts:5-14` still say "Projects/Goals/Daily Plans remain local-only this wave." The contract moved out from under them: these entities are now recoverable-scope entities with remote tables, RLS, and validators — but every create/update/status-change/delete still goes through a mutation boundary that intentionally writes no outbox record and never sets `backupDirty`.

**Why it matters:** After the one-time backfill snapshot, any project/goal/daily-plan mutation is invisible to the remote backup until an unrelated write to the *same row* happens (which never happens, since nothing else enqueues these entities). A restore on a new device resurrects stale planning state — creations, edits, status changes, and deletes are silently absent. This is exactly the "data loss on restore" class. Note the mirror-image defect (cloud restore not importing these entities) is already registered elsewhere; this is the **push-side** half and is independent of it.

**Fix (root cause):** Route all planning-entity writes through the canonical boundary used by `setTodoProjectGoal` (`features/todos/todos.data.ts:487-548` via `runSyncedMutation`/`runBackupMutation`, `core/sync/syncedMutation.ts:65-135`), so the outbox row lands in the same SQLite transaction as the row, carries the resolved `ownerUserId`, and sets `backupDirty`. Alternatively extend `runLocalMutation` with an enqueue callback — but do not leave both semantics under one name. Delete/rewrite the stale "local-only this wave" comments at the same time so the next auditor isn't misled again.

---

### F2 — P1: `saveWeeklyReview`/`deleteWeeklyReview` use the legacy ownerless enqueue pattern — records can never pass the adapter's owner check, and the outbox row is not transactional with the data write

**Where:** `features/weekly-review/weeklyReview.data.ts:66-71, 96-101, 113-118` call `syncEngine.enqueue({ entity: 'weekly_reviews', id, updatedAt, operation })` directly. Compare the canonical pattern in `core/sync/syncedMutation.ts:65-110` and its use in `features/todos/todos.data.ts:494-497`.

**What is wrong (three distinct defects in one call site):**
1. **No `ownerUserId`.** The adapter rejects records whose owner doesn't match both session and local owner (`core/sync/supabase.adapter.ts:108-116`). An `undefined` owner fails unconditionally once any session exists → `"Sync owner mismatch for weekly_reviews"` on every flush. I searched `core/` for any repair path that backfills ownerless outbox rows and found none (verified by absence).
2. **Non-atomic outbox persistence.** `syncEngine.enqueue` → `enqueuePrepared` → async `schedulePersistence` (`core/sync/sync.engine.ts:200-213`) writes the durable outbox row *after* the review INSERT/UPDATE commits — a crash between the two loses the backup intent. `runBackupMutation` exists precisely to close this window.
3. **No owner-binding claim / `backupDirty`.** `saveWeeklyReview` bypasses both `runLocalMutation` (first-content owner claim) and `runBackupMutation` (`backupDirty = '1'`), so a device whose first meaningful write is a weekly review behaves differently from every other first write.

**Why it matters:** Compounding the already-registered "weekly_reviews has no Supabase table" defect (`scripts/validate-supabase-schema.mjs:481-599` requires only `projects`/`goals`/`daily_plans`; no migration creates `weekly_reviews`), each saved review strands a permanently-failing record in the outbox. Because `push()` reports partial failure (`supabase.adapter.ts:162-167`) and `AppProviders.tsx:236-250` skips `runBackupMaintenance` whenever `flush()` throws, **one saved review stalls the completeness-checkpoint cycle for the entire backup**, not just for reviews. Even after the remote table is added, defects 1–3 keep this broken.

**Fix:** Migrate `weeklyReview.data.ts` onto `runBackupMutation` (owner-resolved, in-transaction outbox, dirty flag). This must land together with the remote `weekly_reviews` table migration (see SCHEMA INPUTS) — either half alone leaves the flush loop red.

---

### F3 — P1: `executeWeeklyReview` is not idempotent on retry or re-save — duplicate Todo creation; docstring claims an exactly-once receipt model that does not exist

**Where:** `features/weekly-review/weeklyReview.executor.ts:3-5` ("durable execution receipt model for crash safety / exactly-once semantics"), `:36-46` (create loop), `:49-68` (reschedule loop), `:70-92` (review save).

**What is wrong:**
- There is no receipt. `commitment.createdTodoId` is written at `executor.ts:45` and serialized into `plan_payload` at `:80`, but a repo-wide grep shows **nothing ever reads it back** — not the executor, not the screen, not restore.
- Failure modes that duplicate data:
  - **Retry after partial failure:** `addTodo` #2 throws → commitment #1 already persisted, review row not saved, UI shows the error (`WeeklyReviewScreen.tsx:124-128`) and re-enables Confirm. Re-confirm runs the whole loop again → commitment #1 is created a second time.
  - **Re-saving an existing week:** the screen warns "Saving will update it" (`WeeklyReviewScreen.tsx:288-294`) — accurate for the review *row* (`saveWeeklyReview` is week_key-idempotent, `weeklyReview.data.ts:53-73`), but the newCommitments loop unconditionally creates fresh Todos again on every confirm of the same week.
- The reschedule/carry-forward loop is idempotent (re-setting the same due date is a no-op semantically), so the duplication risk is specific to creation.

**Why it matters:** Duplicate todos pollute the todo list, daily-plan candidate search, weekly summaries, and the synced backup. The misleading docstring will cause the next maintainer to assume safety that isn't there.

**Fix:** Before `addTodo`, resolve each commitment's `createdTodoId` from (a) the in-memory draft if set, else (b) the prior review's stored `plan_payload` via `getWeeklyReviewByWeekKey(week.weekKey)`; skip creation when that todo still exists (and re-validate it's non-deleted). Record per-item outcomes. Optionally persist the receipt in the same transaction as the review row. Do **not** weaken the per-call canonical APIs — keep going through `addTodo`/`updateTodo` as the docstring correctly requires.

---

### F4 — P2: Next-week application is a sequential multi-day batch with no transaction spanning days, no structured per-item outcomes, and silent truncation beyond 21 candidates

**Where:** `features/weekly-review/weeklyReview.applyNextWeek.ts:27-42` (loop; one `getDailyPlan`+`setDailyPlanTopTodos` per day, each its own transaction); `features/weekly-review/weeklyReview.domain.ts:281-313` (`MAX_SUGGESTIONS_PER_DAY = 3`, `MAX_SUGGESTION_DAYS = 7` → hard cap 21 candidates, remainder dropped); `WeeklyReviewScreen.tsx:231-248` advertises "N carry-forward candidates can seed next week's plans" with no mention of the cap.

**What is wrong:** (a) A failure on day 4 leaves days 1–3 applied with no record of which succeeded (the thrown error discards `appliedDateKeys`); the result type has no skipped/failed structure — this is the exact "sequential multi-record loop lacking atomicity or structured per-item outcomes" pattern. (b) Candidates beyond 21 are silently never applied. (c) Re-running after the user manually removes an applied id will re-add it — defensible for an explicit action, but worth documenting.

**What is right:** The merge itself is genuinely idempotent (dedupe + `MAX_TOP_PRIORITIES` capacity, `applyNextWeek.ts:31-38`), and `upsertDailyPlan` prunes stale ids at save time (`dailyPlan.data.ts:52-62`).

**Fix:** Return `{ appliedDateKeys, addedCount, skipped: [...], failed: [...], truncatedCandidateCount }`; apply all days inside a single transaction (the helper can accept a tx handle, mirroring how `updateGoal` runs child reconciliations in-tx); surface the truncated count in the done-step copy.

---

### F5 — P1: Weekly summary parses date keys as UTC — habit consistency (and prior-week ranges) shift by one day in UTC-negative timezones

**Where:** `features/weekly-review/weeklyReview.summary.ts:109` (`const d = new Date(week.startDateKey)` inside the per-habit day loop), `:146-149` and `:168-173` (prior-week bounds computed the same way).

**What is wrong:** `new Date("YYYY-MM-DD")` is parsed as **UTC midnight** (ES spec for date-only forms), while `toDateKey()` formats in **local** time (`lib/time.ts:20-25`). For a user west of UTC, `new Date("2026-08-17")` localizes to Aug 16 → the habit-completion loop checks `date_key`s for the wrong 7-day window, and the pomodoro/workout prior-week ranges shift a day. East of UTC (including CI's `TZ=Asia/Manila`, per `.github/workflows/ci.yml` quality job) the round-trip happens to be identity, which is why no test catches it. `lib/time.ts:27-30` provides `dateKeyToLocalDate()` precisely to prevent this; `planningHub.briefing.ts:34` and `dailyPlan.data.ts:211` use the safe `${dateKey}T00:00:00` form, making `summary.ts` the outlier.

**Why it matters:** Deterministically wrong review statistics (consistency %, "no completions this week" attention items, prior-week comparisons) for roughly half the world's timezones, embedded into the saved `summary_payload` permanently.

**Fix:** Replace all three `new Date(<dateKey>)` occurrences with `dateKeyToLocalDate(...)`; extract the day-key iteration into `weeklyReview.domain.ts` so it is unit-testable without a DB.

---

### F6 — P2: Status-transition writes read pre-transaction state (check-then-act) in all three planning data layers

**Where:** `dailyPlan.data.ts:73` (existence read) vs `:88/:151` (write tx); `projects.data.ts:78` vs `:119`; `goals.data.ts:77` vs `:146-149`. The `completed_at` enter/leave transitions (`dailyPlan.data.ts:141-147`, `projects.data.ts:102-112`, `goals.data.ts:105-114`) and the create-vs-update decision all key off these pre-tx reads.

**What is wrong:** Two interleaved calls (JS async interleaving on web WASM, e.g., command-center write racing a screen save) can both see "no row" for the same `date_key`; the second INSERT then violates the partial unique index `idx_daily_plans_date_key_active` (`core/db/client.ts:653-655`) and surfaces as a raw `SQLITE_CONSTRAINT_UNIQUE` error rather than an update. Similarly, interleaved status flips can stamp `completed_at` twice with skewed timestamps. The index guarantees **no duplicate active rows** (so no corruption — this is why it's P2, not P1), but the failure mode is an unhandled exception in `DailyPlanView.persist` (no `.catch`, `DailyPlanView.tsx:112-137`).

**Fix:** Move the existence read inside the transaction (`tx.getFirstAsync`) and catch the unique violation to fall back to the UPDATE path; or serialize per-dateKey writes. Keep the partial unique index exactly as-is — it is the correct backstop.

---

### F7 — P2: `carryForwardFromPreviousDay` computes the merged list from stale reads, then overwrites — lost-update window

**Where:** `features/daily-plan/dailyPlan.data.ts:223-245`: candidates are computed from plans read at `:225-229`, then `setDailyPlanTopTodos(dateKey, [ ...staleCurrent, ...candidates ])` at `:241-244` replaces `top_todo_ids` wholesale (`upsertDailyPlan` uses the caller's array because `updates.topTodoIds !== undefined`, `dailyPlan.data.ts:74-79, 118-121`).

**What is wrong:** Any concurrent change to today's plan between the outer read and the write (command center `add_todo_to_daily_plan`, weekly-review apply, another device post-sync) is silently reverted. Window is small but real. Idempotency itself is sound (`computeCarryForwardIds` filters existing + completed, bounded capacity — `dailyPlan.domain.ts:22-39`), and the trigger is an explicit button (`DailyPlanView.tsx:102-110, 162-175`), not a mount side effect — the pristine-device invariant holds.

**Fix:** Re-read current `top_todo_ids` inside the write transaction and merge there (pass a tx-scoped variant down, or give `upsertDailyPlan` an `appendTopTodoIds` mode). Also add a `.catch` in `handleCarryForward` — currently an error is an unhandled rejection with only `finally` cleanup.

---

### F8 — P2 (answers audit question d): Rollup/filter/sort domain layers are dead code — no production caller, no data-layer assembly functions, no real-SQLite tests

**Where:** Production callers: **zero** (grep-verified across the repo excluding node</subagent>
<subagent agent_id="agent-15" item="AREA 3 — POMODORO: Audit features/pomodoro/**. Questions: (a) Full session lifecycle: when are pomodoro_sessions rows inserted; can sessions be double-inserted, lost on crash/reload, or created without ended_at? (b) Auto-start-next timing (setTimeout-based): failure modes, duplicate session creation risk, web backgrounding behavior. (c) Stats/focus computations: data sources today; what must change when association/note move into pomodoro_sessions columns linked_todo_id TEXT NULL, linked_todo_title TEXT NULL, note TEXT NULL? (d) Presets store shape/validation/corruption behavior (superhabits.pomodoro.presets/.activePresetId). (e) Legacy AsyncStorage migration design inputs: exact JSON shapes of superhabits.pomodoro.sessionAssociations/.sessionNotes and safe matching rules to local sessions (id match? timestamp window? owner sanity?)." outcome="completed"># AREA 3 — POMODORO Audit Report

Scope: `features/pomodoro/**` plus its direct contracts (`pomodoro.data.ts` write path, `pomodoro_sessions` DDL, backup/portable/validator touchpoints, stats consumers). Read-only audit; nothing was modified.

---

## Findings

### 1. P1 — Session-completion side effects run inside a React state updater (duplicate-row vector)

- **Where:** `features/pomodoro/PomodoroScreen.tsx:209-279` — the entire completion block (cancel notification, `logPomodoroSession`, association write, `setCompletedFocus`, mode transition, auto-start `setTimeout`) executes inside the `setRemaining((prev) => ...)` updater.
- **What is wrong:** React requires updater functions to be pure; it may invoke them more than once (StrictMode double-invokes in dev; interrupted/concurrent renders can replay them). Each invocation calls `logPomodoroSession`, which mints a **fresh** id via `createId('pom')` (`pomodoro.data.ts:125`), so the id-based dedupe in `insertPomodoroSessionRecord` (`pomodoro.data.ts:37-55`) cannot detect the replay — two invocations produce two rows with different ids. The `setTimeout` auto-start would also be scheduled twice (harmless only because `start()` re-entry guards absorb the second call).
- **Why it matters:** duplicated focus rows permanently inflate every stat (minutes, streak, heatmap, garden) with no dedupe possible after the fact; this is silent history corruption.
- **Fix:** keep only pure remaining-math inside the updater. Track `remaining` in a ref updated by the interval callback body (outside `setState`); when the ref crosses 0, run the completion effects exactly once in the callback, then `setRemaining(nextDuration)` with a plain value. Alternatively extract completion into a `useRef`-guarded function so a second entry is a no-op.

### 2. P1 — Running session exists only in component state; crash/reload loses it while the OS notification still fires

- **Where:** state lives at `PomodoroScreen.tsx:85-108`; rows are inserted **only at completion** (`pomodoro.data.ts:119-134`, contract comment at 114-118); on start, an OS-level TIME_INTERVAL notification is scheduled (`PomodoroScreen.tsx:339`, `lib/notifications.ts:125-138`) which survives JS death on native.
- **What is wrong:** web reload, tab discard, or native process kill mid-session discards `startedAt/remaining/mode/completedFocus`. No row is ever written (consistent with "interrupted sessions are never logged"), but the scheduled notification still fires "Focus complete" — the user is told a focus completed that is not in their history. The long-break cycle counter also silently resets to 0.
- **Why it matters:** user-visible inconsistency between the notification surface and durable history; expected data silently missing; cycle cadence lost.
- **Fix:** persist minimal timer intent durably at start (e.g. `app_meta` JSON key `pomodoro.active_timer`: `{ started_at, mode, total_seconds, settings_snapshot }`), clear it on completion/abandon. On boot, reconcile: if end time passed and no row exists for that `started_at`, either log the completed focus or show an in-app notice ("previous session was interrupted") and cancel the orphan notification. Persist `completedFocus` alongside to preserve cycle position.

### 3. P1 — Failed session insert is swallowed; the completed focus is unrecoverably lost

- **Where:** `PomodoroScreen.tsx:233-245` — `.catch((err) => console.error(...))`.
- **What is wrong:** if `logPomodoroSession` rejects (OPFS/SQLite transient failure, owner-claim error inside `runBackupMutation`), the timer has already transitioned to the next mode, no row is written, no user feedback is shown, the note prompt never appears, and `pendingAssociation` stays armed forever (it will attach to whichever *future* session completes next — mis-attribution).
- **Why it matters:** a genuinely completed focus session is lost with zero trace, and a stale todo link silently attaches to a later, unrelated session.
- **Fix:** on failure, retain `{startedAt, endedAt, duration}` in a durable pending-log record (small `app_meta` queue or reuse of the outbox pattern) and retry on next foreground refresh; surface an in-app notice via `useInAppNotices` on final failure; clear `pendingAssociation` only on confirmed success (already correct) and additionally on abandonment of the screen.

### 4. P2 — Paused sessions write internally inconsistent rows (`ended_at − started_at ≠ duration_seconds`)

- **Where:** `PomodoroScreen.tsx:232-233` — `endedAt = new Date()` at completion but `duration_seconds = totalSeconds` (nominal). `startedAt` is wall-clock start (`:332-334`) unaffected by pauses.
- **What is wrong:** a focus paused overnight logs e.g. `duration_seconds = 1500` with start/end spanning 14 hours. No current consumer computes from `ended-started`, but restore validators, future analytics, and integrity checks reasonably assume `ended ≥ started + duration` semantics.
- **Fix:** either set `ended_at = started_at + duration_seconds` (active-time semantics, documented), or add accumulated-pause accounting when the v20 columns land. Document the chosen invariant in `pomodoro.data.ts`.

### 5. P2 — Association/note writes use whole-map read-modify-write on AsyncStorage (lost-update race)

- **Where:** `features/pomodoro/pomodoro.sessionMeta.ts:44-58` and `:64-73` — read full map → mutate → write full map.
- **What is wrong:** two concurrent meta writes (e.g. association attach from completion racing a note save from the previous session's prompt, both plausible within ~1s under auto-start) last-writer-wins the entire map and one update is silently dropped. Also, if the app dies between row insert and `setSessionAssociation` (`PomodoroScreen.tsx:235-240`), the association is lost even though the session row exists.
- **Why it matters:** silent metadata loss; becomes worse once auto-start chains sessions quickly.
- **Fix:** short-term, serialize meta writes through a single promise chain (module-level queue). Root-cause fix is the column migration (see SCHEMA INPUTS): `UPDATE pomodoro_sessions SET linked_todo_id=?, linked_todo_title=? WHERE id=?` is naturally atomic per row.

### 6. P2 — Planning-hub briefing counts break-type sessions as focus minutes

- **Where:** `features/planning-hub/planningHub.briefing.ts:66-68` — sums `duration_seconds` over all rows with no `session_type === 'focus'` filter.
- **What is wrong:** every other consumer filters: `overview.domain.ts:253`, `weeklyReview.summary.ts:143,154`, `ask.retrieval.ts:316`, `computeFocusStats` (`pomodoro.domain.ts:414-416`). Linked-action effects can log `short_break`/`long_break` types (`linkedActions.rows.ts:100-102` allows them) and legacy `'break'` rows exist per `core/db/types.ts:98-99`; those inflate `yesterdayFocusMinutes`.
- **Fix:** add the same filter at `planningHub.briefing.ts:66`.

### 7. P2 — Break rows leak into "focus" surfaces; "This year" label is wrong

- **Where:** `PomodoroScreen.tsx:146-153` loads a trailing **364-day** window; `:477-479` renders `sessions.length` as "Focus sessions … This year"; `GardenGrid.tsx:74-81` renders every row as a plant; `buildPomodoroHeatmapDays` (`pomodoro.domain.ts:235-251`) counts every row toward streak/heatmap. Meanwhile `RecentSessionsList.tsx:22` and the stat cards filter to focus.
- **What is wrong:** inconsistent type filtering across surfaces of the same screen, and a mislabeled window (364 trailing days ≠ calendar year).
- **Fix:** filter `session_type === 'focus'` before garden/heatmap/count, and relabel to "Last 365 days" (or compute the calendar-year range).

### 8. P2 — Auto-start `setTimeout(800)` is uncancellable and its conflicts are silently discarded

- **Where:** `PomodoroScreen.tsx:270-274` (`setTimeout(() => void startRef.current?.(), 800)`).
- **What is wrong:** the pending auto-start cannot be vetoed: if the user taps a mode pill or Start within the 800 ms window, the delayed `start()` still fires (usually absorbed by the running/paused guard at `:310-315`, returning a conflict object that is intentionally ignored). If the web tab reloads inside the window, auto-start vanishes. There is no tracking handle, making the behavior untestable and surprising under rapid interaction.
- **Why it matters:** low-probability incorrect behavior today; explicitly flagged UNTESTED in `openspec/changes/complete-product-roadmap-parallel-wave-v2/HARDENING_HANDOFF.md:99`.
- **Fix:** hold the timer id in a ref (`autoStartTimerRef`), clear it in `start()`, `reset()`, pill presses, and effect cleanup; log/discard conflicts deliberately.

### 9. P2 — Web backgrounding: completion correctness holds, but `ended_at` reflects resume time

- **Where:** tick math uses wall-clock delta catch-up (`PomodoroScreen.tsx:210-217`) — throttled/frozen tabs complete correctly on return with the right nominal duration; `document.hidden` handling is warning-only (`:189-204`, `BackgroundWarning.tsx`).
- **What is wrong:** when a frozen tab resumes after the deadline, `endedAt = new Date()` at catch-up, not at the true deadline. Combined with Finding 4 this further loosens `ended_at` semantics. No duplicate-session risk from backgrounding itself: logging happens once per completion transition and `start()` guards re-entry (`startInFlightRef`, `:310-317`).
- **Fix:** derive `ended_at = started_at + active_seconds` (same remedy as Finding 4).

### 10. P2 — Preset store: solid normalization, two behavioral gaps

- **Where:** `pomodoro.presets.store.ts:13-42`, `pomodoro.domain.ts:314-381`, `PomodoroScreen.tsx:162-170, 362-395`.
- **Verified sound:** corrupt/non-array JSON falls back to built-ins (`store:14-20`, `domain:356-357`); malformed entries dropped, built-ins always present, dedupe by id, values clamped (`domain:361-380`); `activePresetId` validated against the preset list (`store:31-38`).
- **Gaps:**
  - If `activePresetId` is unset/invalid, `activePresetRef` silently remains Classic (`PomodoroScreen.tsx:115,162-170`) — auto-start flags default to off even when saved durations match "Deep Work", and no chip highlights. Fix: fall back to matching durations, or persist a default explicitly.
  - Preset selection overwrites `app_meta.pomodoro_settings` when idle (`:370-375`), but manual duration edits don't update the active preset chip — the UI can highlight "Sprint" while actual settings differ. Fix: clear `activePresetId` on manual settings save, or derive highlight from settings equality.
  - `savePomodoroPresets` has no error handling (`store:23-28`); latent only — no UI creates custom presets today (verified: only `getPomodoroPresets/getActivePresetId/setActivePresetId` are imported).

### 11. P2 — AsyncStorage meta readers don't validate inner value shapes

- **Where:** `pomodoro.sessionMeta.ts:24-34` — `readJsonMap` casts without checking entries; an association like `{"pom_x": {"todoId": 5}}` flows into state and renders raw (`RecentSessionsList.tsx:35,49`).
- **Fix:** validate per entry (`todoId`/`todoTitle` non-empty strings) and drop invalid ones; same defensive posture the presets store already has.

### Verified non-issues (interactions noted, not re-proved)

- **No rows without `ended_at`:** NOT NULL DDL (`core/db/client.ts:40-47`); all three insert paths supply it; backup validator enforces ISO `ended_at` (`core/backup/backupValidators.ts:404-411`).
- **Linked-action exactly-once intact:** `pomodoro.log` uses deterministic `plannedProducedEntityId` (`core/linked-actions/linkedActions.effects.ts:100-110`), which the id-dedupe in `insertPomodoroSessionRecord` correctly absorbs on replay (`tests/integration/linkedActionEffectsExactlyOnce.test.ts:71-72` covers it).
- **Stat-lag race after completion** (`void loadHistory()` racing the insert, `PomodoroScreen.tsx:246`): documented benign/self-healing in `openspec/changes/archive/add-real-world-user-simulation-testing/findings.md:132-135`; interaction only.
- **Known defect class (interaction):** associations/notes/presets are device-local AsyncStorage, absent from backup/portable/restore — registered elsewhere; Findings 5, 11 and the SCHEMA section below are the design inputs for that fix.

---

## SCHEMA/SETTINGS INPUTS

Proposed v20 migration (aligns with `HARDENING_HANDOFF.md` SCHEMA_REQUEST #3, extended with the title snapshot):

```sql
ALTER TABLE pomodoro_sessions ADD COLUMN linked_todo_id TEXT NULL;
ALTER TABLE pomodoro_sessions ADD COLUMN linked_todo_title TEXT NULL;
ALTER TABLE pomodoro_sessions ADD COLUMN note TEXT NULL;
```

Critical implementation constraints and consumer sites:

1. **Bootstrap DDL must gain the same columns** — fresh installs create tables from `bootstrapStatements` (`core/db/client.ts:40-47`) and skip migrations; use the existing `addColumnIfMissing` gating pattern (`client.ts:90-117`) inside the new `if (version < 20)` block.
2. **`core/db/types.ts:93-101`** — extend `PomodoroSession` with `linked_todo_id: string | null`, `linked_todo_title: string | null`, `note: string | null`.
3. **`core/backup/backup.types.ts`** — add the three columns to `BACKUP_ENTITY_COLUMNS['pomodoro_sessions']` (`:153-160`) **and bump `BACKUP_SCOPE_VERSION` (currently 4, `:20`)**. `PORTABLE_V1_ENTITY_COLUMNS['pomodoro_sessions']` (`:327-334`) must stay frozen as-is: `backupEntityColumnsForScope` (`:440-454`) verifies historical manifests against V1 columns, so touching it breaks canonical checksums for existing backups.
4. **`core/backup/backupValidators.ts:404-411`** — add three nullable-text rules to `POMODORO_SESSION_RULES` (length caps 200/200/500 to mirror current truncation).
5. **`core/sync/supabase.adapter.ts:178`** uses `SELECT *` — columns flow automatically once the remote table gains them (remote migration/fixture is another area's deliverable, listed here as dependency). New columns are nullable ⇒ old remote rows stay valid.
6. **`features/pomodoro/pomodoro.data.ts`** — extend INSERT column lists in `insertPomodoroSessionRecord` (`:57-74`) and `applyRemotePomodoroSessions` (`:194-212`); add `setPomodoroSessionMeta(db, {id, linkedTodoId, linkedTodoTitle, note})` routed through `runBackupMutation` + `enqueue({entity:'pomodoro_sessions', operation:'update', ...})` so Backup V4 captures edits.
7. **UI consumers to rewire** (drop the AsyncStorage maps): `PomodoroScreen.tsx:154-159` (loadHistory), `:235-240` (attach association), `RecentSessionsList.tsx:8-12` (props become row fields), `SessionNotePrompt.tsx:27`, `pomodoro.sessionMeta.ts` (retire after migration backfill).
8. **Stats need no change:** `computeFocusStats`, heatmap, streak, overview/weekly-review/ask retrieval consume only `started_at/duration_seconds/session_type`.
9. **Presets:** no schema need; optional follow-up is moving `superhabits.pomodoro.presets/.activePresetId` into `app_meta` (JSON keys, `owner: 'pomodoro'`) via the recoverable-settings allowlist process if cross-device persistence is wanted — per `HARDENING_HANDOFF.md:33-35`, not ad-hoc.

Legacy AsyncStorage migration inputs (exact shapes, verified from `pomodoro.sessionMeta.ts`):

- `superhabits.pomodoro.sessionAssociations` = `Record<sessionId, { todoId: string; todoTitle: string }>`; `todoTitle` truncated to 200 chars on write (`:54`).
- `superhabits.pomodoro.sessionNotes` = `Record<sessionId, string>`; trimmed, ≤500 chars (`:66-71`).
- Safe matching rule: **exact key match on `pomodoro_sessions.id`** (keys are `createId('pom')` ids; pomodoro rows are never soft/hard-deleted locally, so presence check is reliable). Timestamp-window matching is unnecessary and unsafe — do not use. Per-entry validation: require non-empty string fields, enforce length caps, drop invalid/orphan entries instead of failing the migration. Owner sanity beyond id existence is not needed (rows are already owner-claimed). Backfill via `UPDATE ... WHERE id = ?` inside the migration path, then delete both AsyncStorage keys only after verifying matched counts.

---

## TEST COVERAGE GAPS

1. **Completion-path unit/integration test** (Finding 1): assert exactly one `pomodoro_sessions` row per completed countdown even when the completion handler is invoked twice. Home: `tests/pomodoro.data.test.ts` (dedupe-by-id case is also missing there — `existing id → inserted:false` is untested) plus a new component-level spec if component testing lands; minimum viable is an extracted pure `completeSession()` domain/data function tested in `tests/pomodoro.data.test.ts`.
2. **Auto-start-next timing** (Finding 8; flagged UNTESTED in `HARDENING_HANDOFF.md:99`): E2E — complete a shortened focus with the Sprint preset (autoStartBreaks) and assert the break starts exactly once; with Classic, assert nothing auto-starts. Home: `e2e/pomodoro.spec.ts` (currently only idle/start/reset states, 35 lines total).
3. **Crash/reload reconciliation** (Finding 2): E2E — start focus, reload page before completion, assert no phantom row and (post-fix) the reconcile notice/resume behavior; native lane equivalent for the orphan-notification case. Home: `e2e/pomodoro.spec.ts` or a new `e2e/journeys/pomodoro-lifecycle.spec.ts`.
4. **Failed-insert recovery** (Finding 3): unit test for the pending-log retry queue (inject rejecting db). Home: `tests/pomodoro.data.test.ts`.
5. **Briefing focus filter** (Finding 6): no test file touches `buildTodayBriefing` at all (verified: no matches in `tests/**`). Add `tests/planningHub.briefing.test.ts` asserting break-type rows don't count into `yesterdayFocusMinutes`.
6. **Type-filter consistency** (Finding 7): extend `tests/pomodoro.stats.test.ts` / domain tests for `buildPomodoroHeatmapDays` excluding non-focus rows once fixed (today's tests at `tests/pomodoro.domain.test.ts:242-270` don't pin the type behavior).
7. **Column migration + backup scope bump** (SCHEMA inputs): integration tests asserting (a) v20 adds nullable columns to existing DBs and fresh installs, (b) legacy AsyncStorage maps backfill onto matching session ids and invalid/orphan entries are dropped, (c) scope-version-bumped manifests verify while V1-scope files still verify against frozen columns, (d) `applyRemotePomodoroSessions` round-trips the new columns. Homes: `tests/integration/backupRestore.test.ts`, `tests/integration/portableExportImport.test.ts`, and a new `tests/integration/pomodoroMetaMigration.test.ts`.
8. **Meta-write serialization** (Finding 5): only relevant pre-migration; post-migration covered by the row-level UPDATE tests in item 7.</subagent>
<subagent agent_id="agent-16" item="AREA 4 — WORKOUT PROVENANCE: Audit features/workout/**. Questions: (a) Map the complete session capture UX end-to-end: what the user actually does/enters; where weight/reps entry could attach naturally (per-set during timer vs at completion summary). (b) All PR/volume/duration consumers: estimate1RM, computePersonalRecords, findNewPersonalRecords, buildVolumePerWeek, listSessionTotalsForRange, calculateSessionDuration, WorkoutHistoryDetail placeholder feeding — exact current behavior with zero/missing data. (c) Recommend the correct durable model: exercise-level weight REAL/reps INTEGER columns on workout_session_exercises vs a new per-set child table — justify from actual UX/domain needs; specify exact columns/types/nullability so legacy rows mean 'unknown', not zero. (d) Session duration: where real elapsed time exists (started_at/ended_at sources) and how to persist duration_seconds on workout_logs honestly instead of estimates. (e) routine_exercise_sets active_seconds/rest_seconds vs the superhabits.workout.restSeconds preference interplay." outcome="completed">All evidence gathered. Here is the audit report.

---

# AREA 4 — WORKOUT PROVENANCE AUDIT REPORT

Scope: `features/workout/**`, its DB schema (`core/db/client.ts`, `core/db/types.ts`), backup/portable/sync touchpoints, and consumers. Registered defects elsewhere (zero-placeholder PR feeding, missing weight/reps/duration storage) are noted as interactions, not re-proven.

## (a) Session capture UX, end-to-end

1. **Routine authoring** (`WorkoutScreen.tsx` → `RoutineDetailScreen.tsx`): user creates a routine (name + description), adds exercises by free-text name (`addExercise`, each auto-seeded with one default set via `addDefaultSet` → hardcoded 40s active / 20s rest, `workout.data.ts:581-595`), then tunes **only timing** per set via `NumberStepperField`s (active 5–3600s, rest 0–1800s, `RoutineDetailScreen.tsx:193-246`). There is **no weight, reps, or unit input anywhere in the entire feature**.
2. **Session start**: only entry point is "Start workout" in `RoutineDetailModal` (`WorkoutScreen.tsx:208-217`), blocked when the routine has 0 exercises. The "Complete workout" button on the list row (`WorkoutScreen.tsx:330-335`) bypasses the timer entirely (see F4).
3. **Session run** (`WorkoutSessionScreen.tsx`): `buildTimerSequence(applyRestDefault(...))` produces a flat active/rest phase list stepped through by a 1s `setInterval`. Controls: Start, Skip (any phase, `:114-124`), ±15s remaining-adjust during rest only (`:136-138`), a global default-rest ±15 adjuster that persists immediately (`:70-74`), and End = confirm-discard (`:140-152`). An in-memory `elapsedSeconds` counter ticks while running (`:80, :92`).
4. **Save**: completion summary shows Duration / Sets done / Exercises (`:154-203`); "Save and finish" calls `logWorkoutSession({ routineId, exercises: summarizeCompletedSets(sequence, currentIndex) })` (`:126-134`). Only `{exerciseName, setsCompleted}` pairs survive — no per-set identity, no weight/reps, no notes, no timestamps beyond a single `completed_at`.
5. **Natural attach points for weight/reps**: the timer already visits every set individually, so per-set entry fits naturally either (i) in the active-phase card (weight/reps steppers rendered while a set's timer runs, defaulting to the previous session's values for that exercise name), captured at phase transition, or (ii) in the completion summary as an editable per-set recap before save. Option (i) matches gym reality (enter what you just lifted while resting); option (ii) is lower-friction but relies on recall. Both require the durable model in section (c). A pure exercise-level entry point (one weight/reps pair per exercise in the summary) is the minimal-change option but cannot represent per-set progression (see F-model rationale).

## (b) PR/volume/duration consumers — exact behavior at zero/missing data

| Consumer | Location | Behavior today |
|---|---|---|
| `estimate1RM` | `workout.domain.ts:191-196` | Pure; returns 0 for weight≤0/reps≤0/NaN/∞. Correctly guarded; unreachable with real data because no source exists. |
| `computePersonalRecords` | `workout.domain.ts:211-239` | Fed by `WorkoutHistoryDetail.tsx:62-70` with synthetic `LoggedSet[]` where every set has `weight: 0, reps: 0`; the `weight <= 0 || reps <= 0` guard filters all of them, so `prs` is **always `[]`**. Consequences: the per-exercise "Personal record" badge (`WorkoutHistoryDetail.tsx:138-145`) is unreachable dead UI, and the PR section always renders its empty state (`:154-158`). *(Registered defect — interaction noted, not re-proven.)* |
| `findNewPersonalRecords` | `workout.domain.ts:246-263` | Exported + unit-tested (`tests/workout.pr.test.ts:73-90`) but **never called from any screen/data layer** — the "new PR" celebration does not exist in production. |
| `buildVolumePerWeek` | `workout.domain.ts:291-325` | Consumes `listSessionTotalsForRange` output; honest for set counts (`sets_completed` is real timer-derived data). Weeks with sessions-but-zero-sets (quick-completes, F4) still increment `sessions` invisibly — the chart displays only `totalSets` (`WeeklyVolumeChart.tsx:27-38`). |
| `listSessionTotalsForRange` | `workout.data.ts:852-872` | `COALESCE(SUM(e.sets_completed),0)` LEFT JOIN — quick-complete logs (no session-exercise rows) yield `totalSets: 0` but still occupy a row. Honest SQL; upstream display is where the mismatch lives. |
| `calculateSessionDuration` | `workout.domain.ts:104-112` | **Never called in app code** (tests + knowledge-base docs only). Sums raw config `active+rest` without the `applyRestDefault` merge, so even if wired it would estimate from a different basis than the session actually runs (F6). |
| `WorkoutHistoryDetail` placeholder | `WorkoutHistoryDetail.tsx:62-71` | Builds one fake `LoggedSet` per `sets_completed` with zeros purely to feed `computePersonalRecords`; comment admits it. Wasted per-render allocation; see (b) row 2. |

## Findings

### F1 — P1: Skipped active phases are recorded as completed sets
- **Where**: `WorkoutSessionScreen.tsx:114-124` (`handleSkip`), `:126-134` (`handleFinish`), `workout.domain.ts:359-373` (`summarizeCompletedSets`).
- **What**: `summarizeCompletedSets` counts *every* active phase at index ≤ `currentIndex` with no notion of whether it was performed, skipped, or timed out. Pressing Skip through an active phase — or through the whole workout without ever pressing Start (`elapsedSeconds` stays 0) — logs full `sets_completed`. Skipping the final phase also counts it (`handleSkip` completes without advancing `currentIndex`, `:116-120`).
- **Why it matters**: this is the workout feature's primary provenance path; the persisted number systematically overstates work performed, and it silently poisons every downstream consumer (weekly volume, future PR baselines via `findNewPersonalRecords`). Once per-set rows land (section c), skipped-vs-done must be captured per set, not inferred.
- **Fix**: track phase disposition in session state (`'completed' | 'skipped'` per index; Skip marks the current phase skipped before advancing; natural timeout marks completed). Thread the disposition into `summarizeCompletedSets` and persist it per set (`workout_session_sets.completed`). Update the single existing test (`tests/workout.domain.test.ts:200-215`) to the fixed semantics — do not weaken it silently.

### F2 — P1: Session duration is tick-counted and never persisted; no wall-clock start/end survives
- **Where**: `WorkoutSessionScreen.tsx:80` (`elapsedSeconds` state), `:89-110` (interval increments by exactly 1/tick), `:172` (display only); `workout.data.ts:635-678` (`logWorkoutSession` persists neither); `core/db/client.ts:56-62` (`workout_logs` has only `completed_at`/`created_at`, both set to the same finish-time `nowIso()` at `workout.data.ts:641-642`).
- **What**: the only real elapsed-time signal is React state fed by `setInterval` ticks — web background-tab throttling makes tick counting drift low, and the value is discarded on save. `completed_at − created_at` is always 0, so duration is not even derivable after the fact. *(Interaction: registered defect "duration has no storage anywhere"; the honest persistence design is deliverable (d) below.)*
- **Why it matters**: the summary screen explicitly shows "Duration" as if it were a saved stat ("Save this session to update your history"), but nothing about time survives. Any future training-load/weekly-time analytics would be fabricated.
- **Fix**: capture `startedAtMs = Date.now()` on first Start press (not mount — users idle before starting), `endedAtMs` in `handleFinish`; persist `started_at`/`ended_at` ISO plus `duration_seconds = Math.round((endedAtMs - startedAtMs)/1000)` computed from wall clock. Keep `elapsedSeconds` as display-only or reconcile it to the wall-clock delta. See SCHEMA INPUTS.

### F3 — P1: Two competing meanings of `rest_seconds = 0`; the rest preference is simultaneously ignored and overreaching
- **Where**: `workout.domain.ts:331-353` (`applyRestDefault`: `rest_seconds > 0 ? keep : default`), `workout.data.ts:589-594` (`addDefaultSet` hardcodes `restSeconds: 20`), `lib/validation.ts:94-100` (`validateSetTiming` allows 0 as legitimate "no rest"), `RoutineDetailScreen.tsx:244-245` (stepper min 0 invites deliberate 0), `restTimerPreferences.ts:4-15` (preference, clamp 5–600, default 60), `WorkoutSessionScreen.tsx:42-58` (merge applied before `buildTimerSequence`).
- **What**:
  1. Every UI-created set gets `rest_seconds = 20` (non-zero), so `applyRestDefault` never substitutes the user's configured default for it — the `superhabits.workout.restSeconds` preference is **dead for all default-created sets** unless the user manually zeroes them.
  2. Conversely, a set deliberately configured to 0 rest (validation and stepper both permit it) is silently overridden to ≥5s (the preference minimum) at session time. Zero means "no rest" to the validator and "inherit default" to the session merger.
- **Why it matters**: the routine builder's displayed rest ("Set 1 · 0:40 / 0:20") is not what runs in the session for zeroed sets, and the preference promises something it doesn't deliver. This is exactly the config-vs-runtime provenance confusion this audit targets.
- **Fix (root cause)**: establish one precedence rule. Recommended: the preference **seeds newly created sets** — change `addDefaultSet` to write `await loadRestSecondsDefault()` instead of hardcoded 20 — and per-set values are authoritative thereafter; keep `applyRestDefault` solely as a legacy fallback for pre-existing `0` rows, documented as such. If deliberate no-rest must remain expressible, the clean model is a nullable `rest_seconds` (NULL = inherit, 0 = none) in v20; otherwise update stepper/validation copy to say "0 = use default rest". Marking the product choice between these two as **UNCERTAIN** (both are coherent; the current code implements neither consistently).

### F4 — P2: Quick-complete sessions persist a log with zero content
- **Where**: `WorkoutScreen.tsx:330-335` ("Complete workout" button), `workout.data.ts:123-148` (`completeRoutine` inserts only a `workout_logs` row), also reached from `features/command/command.executor.ts:275` and linked actions (`linkedActions.effects.ts:85-99`).
- **What**: these logs have no `workout_session_exercises` children. History detail shows "0 exercises / 0 total sets" and an empty exercise list; they contribute 0 to weekly volume while fully counting toward heatmap/streak/"Workout days".
- **Why it matters**: not corruption — the record honestly reflects a content-free quick log — but the UI presents it identically to a timed session, and volume charts undercount weeks where the user only quick-logged. Users cannot distinguish "did the routine" from "did nothing recorded".
- **Fix**: either render quick-complete logs distinctly in history detail (e.g., "Quick log — no exercises recorded"), or have `completeRoutine` synthesize one session-exercise row per routine exercise with `sets_completed = 0`… which would be dishonest in the other direction. Prefer the labeling fix plus, optionally, routing the quick action through the session flow. Product call — flagged, not dictated.

### F5 — P2: `findNewPersonalRecords` is production-dead code
- **Where**: `workout.domain.ts:246-263`; referenced only by `tests/workout.pr.test.ts`.
- **What/why**: the PR-celebration comparison (session vs history best e1RM) was built and tested but never wired into `handleFinish` or the summary screen. It is the intended consumer of the weight/reps model in section (c).
- **Fix**: not independently fixable — wire it once real `LoggedSet`s exist (compare against prior sessions' sets for the same exercise names, excluding the current log). Track as part of the weight-logging change, not a standalone cleanup.

### F6 — P2: `calculateSessionDuration` unused, and its basis disagrees with the actual session
- **Where**: `workout.domain.ts:104-112`; callers: none in `features/` or `app/` (verified by grep; only `tests/workout.domain.test.ts:59-74` and knowledge-base docs).
- **What**: sums raw config `active_seconds + rest_seconds` without `applyRestDefault`, so it would estimate from unmerged values; and it estimates rather than measures. With F2's real timestamps it becomes redundant.
- **Fix**: delete it (and its doc-table entries) when F2 lands, or re-point it at merged values if a pre-workout estimate is genuinely wanted. Don't ship both an estimator and a measurer.

### F7 — P2: Notes are supported by the data layer but capturable nowhere in the workout UI
- **Where**: `logWorkoutSession` accepts `notes` (`workout.data.ts:636-639`) but `WorkoutSessionScreen.handleFinish` passes none (`WorkoutSessionScreen.tsx:129-132`); `completeRoutine(routineId)` is called without notes from `WorkoutScreen.tsx:332` and `command.executor.ts:275`. Only linked-action effects pass notes (`linkedActions.effects.ts:97`).
- **Why**: `WorkoutHistoryDetail.tsx:95-99` renders `log.notes` — a display path fed exclusively by automation today.
- **Fix**: add an optional notes field to the completion summary (single `TextField`, passed straight through). Low cost, closes a dead display path.

### F8 — P2: Mid-session "Default rest" control silently mutates a global persisted preference
- **Where**: `WorkoutSessionScreen.tsx:70-74` (`handleAdjustRestDefault` calls `saveRestSecondsDefault` immediately), rendered mid-session at `:320-340`.
- **What**: adjusting rest during one session rewrites `superhabits.workout.restSeconds` for all routines and all future sessions, with no indication of that scope and no way to undo except adjusting back. Combined with F3, the value written often has no effect on the current routine's sets anyway.
- **Fix**: keep the adjustment session-local (state only) and persist explicitly (e.g., commit on session end, or move the global default to Settings per the six-bucket layout). At minimum label it "Default rest (all workouts)".

### F9 — P2: Inconsistent rest ceilings across preference, validation, and stepper
- **Where**: `restTimerPreferences.ts:7` (`REST_SECONDS_MAX = 600`), `lib/validation.ts:98` (per-set rest ≤ 1800), `RoutineDetailScreen.tsx:245` (stepper max 1800).
- **What**: a set can be configured to 1800s rest, but if it stores 0 it inherits a preference capped at 600; the preference can never express what the per-set field allows. Also `applyRestDefault` rounds and clamps implicitly via stored preference only.
- **Fix**: pick one ceiling (recommend 1800 everywhere, or justify 600 for the default) and derive both constants from a single shared module.

### F10 — P2: Dead domain exports `buildWorkoutFrequency` / `parseWorkoutTime`
- **Where**: `workout.domain.ts:53-70` and `:86-97`; referenced only by `tests/workout.domain.test.ts` and the knowledge base.
- **Fix**: sweep-delete or wire up; until then they are untested-in-production surface area that docs present as live API.

### F11 — P2 (doc drift): Knowledge base contradicts shipped sync behavior for workout logs
- **Where**: `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md:331` says `completeRoutine` logs are "**not** enqueued"; `workout.data.ts:75-80` enqueues `workout_logs` on every insert (all three creation paths route through `insertWorkoutLogRecord`).
- **Why it matters**: provenance documentation that understates what syncs misleads future audits and restore-scope reasoning.
- **Fix**: update the knowledge-base row (doc-only change; behavior is correct).

## (c) Durable model recommendation for weight/reps

**Recommendation: a new per-set child table `workout_session_sets`, not columns on `workout_session_exercises`.**

Rationale from actual UX/domain needs:
- Real logging varies weight/reps **per set** (warmup → top set → backoff). Exercise-level columns force one of two wrong semantics: "first set only" or "same for all sets", both of which break `computePersonalRecords`' top-set tracking (`workout.domain.ts:227`) and best-e1RM selection, and would make ascending/descending schemes unrepresentable.
- The schema is already symmetric by design: `routine_exercises` ↔ `workout_session_exercises`, `routine_exercise_sets` ↔ (missing session-side counterpart). A per-set session table completes the config/log pairing and gives future actuals (`actual_active_seconds`, `actual_rest_seconds`, RPE) a home without another structural migration.
- Legacy honesty: existing `workout_session_exercises` rows simply get no child rows → "unknown", never zero. Consumers already treat absent weighted sets as unweighted (`computePersonalRecords` filters them), so legacy history keeps rendering exactly as today.
- Rejected alternative: a JSON column on `workout_session_exercises` — breaks the flat-column conventions that `BACKUP_ENTITY_COLUMNS` canonical checksums, validators, and the generic `SELECT *` sync upsert (`core/sync/supabase.adapter.ts:170-202`) are built around.

**Exact DDL (migration v20, append-only block in `runMigrations()`):**
```sql
CREATE TABLE IF NOT EXISTS workout_session_sets (
  id                  TEXT PRIMARY KEY NOT NULL,
  session_exercise_id TEXT NOT NULL,      -- → workout_session_exercises.id
  set_number          INTEGER NOT NULL,
  weight              REAL,               -- NULL = not recorded (unknown), never 0
  reps                INTEGER,            -- NULL = not recorded (unknown)
  weight_unit         TEXT,               -- 'kg' | 'lb' | NULL (see UNCERTAIN below)
  completed           INTEGER NOT NULL DEFAULT 1,  -- 0 = skipped (pairs with F1)
  created_at          TEXT NOT NULL
);
```
New `createId` prefix `sset` (registered alongside the existing prefixes). Insert-only like its parent; no soft-delete needed (session rows are immutable history, matching `workout_session_exercises` which has no `deleted_at`).

Domain typing: `LoggedSet` becomes `{ exerciseName: string; weight: number | null; reps: number | null }`; `computePersonalRecords`' existing `Number.isFinite` guards already skip `null` correctly, but the types must be updated so `0` is never used as a sentinel (this also retires the `WorkoutHistoryDetail.tsx:62-70` placeholder block).

**UNCERTAIN (product decision required)**: no kg/lb unit concept exists anywhere in the app today (grep-verified; only the comment "weight in the user's unit" at `workout.domain.ts:168`). Storing `weight_unit` per set is the safe choice because mixing units across a history makes e1RM comparisons silently wrong; alternatively a single global unit setting (see SETTINGS INPUTS) with per-set column reserved. Either way the column should exist from v20 — adding it later is another migration.

## (d) Honest session-duration persistence

- **Where real elapsed time exists**: nowhere durable. The only sources are (1) `elapsedSeconds` tick state (`WorkoutSessionScreen.tsx:80,92`) — display-only, drift-prone, discarded; (2) `completed_at`/`created_at`, both identical finish-time stamps (`workout.data.ts:641-643`) — delta always 0.
- **Recommended model**: nullable columns on `workout_logs` via the same v20 migration:
```sql
ALTER TABLE workout_logs ADD COLUMN started_at TEXT;          -- NULL = unknown / no timed session
ALTER TABLE workout_logs ADD COLUMN ended_at   TEXT;          -- NULL = unknown
ALTER TABLE workout_logs ADD COLUMN duration_seconds INTEGER; -- NULL = unknown, never 0-derived
```
Nullable is essential: `completeRoutine` (quick-complete, command executor, linked actions) records no timed session, and legacy rows have none — `NULL` means "unknown", `0` would mean "zero-length workout", which is false.
- **Capture points**: `started_at` on first Start press in `WorkoutSessionScreen` (not mount — users open the screen and idle; `isRunning`'s first transition is the honest start); `ended_at` in `handleFinish`; `duration_seconds` computed as wall-clock `Date.now()` delta rounded to seconds, **not** accumulated interval ticks (background-tab throttling makes ticks an undercount, and the tick counter pauses whenever the user pauses). `logWorkoutSession` grows optional `startedAt`/`endedAt` params; `completeRoutine`/`logWorkoutFromLinkedAction` leave all three NULL.
- **Precedent**: `pomodoro_sessions` already models exactly this triple NOT NULL (`core/db/client.ts:40-47`); workout's version is nullable because workout sessions are optional-timed.

## (e) `routine_exercise_sets` timing vs `superhabits.workout.restSeconds`

Config side: `rest_seconds INTEGER NOT NULL DEFAULT 20` (`client.ts:199`), seeded hard at 20 by `addDefaultSet` (`workout.data.ts:593`), editable 0–1800 per set (`lib/validation.ts:97-98`, stepper `RoutineDetailScreen.tsx:244-245`). Preference side: AsyncStorage key `superhabits.workout.restSeconds`, clamped 5–600, step 15, default 60 (`restTimerPreferences.ts:4-15`), adjustable **only** inside a running session (`WorkoutSessionScreen.tsx:320-340`) — it has no Settings-screen presence and is absent from the recoverable-settings allowlist (`core/backup/backupSettings.ts:29-43`, verified: only calorieGoal/pomodoroSettings/theme.mode/theme.slots).

Merge semantics live in `applyRestDefault` (`workout.domain.ts:331-353`), applied before `buildTimerSequence` in the session screen (`WorkoutSessionScreen.tsx:42-58`): `rest_seconds === 0` inherits the preference; anything > 0 wins. The defects and fixes are F3 (dual meaning of 0 / dead preference for default-created sets), F8 (mid-session global mutation), F9 (ceiling mismatch 600 vs 1800), and F6 (`calculateSessionDuration` ignoring the merge). One additional nuance: `duplicateRoutine` copies stored values verbatim (`workout.data.ts:909-916`), so copies preserve whatever convention the source used — consistent under either F3 resolution.

---

## SCHEMA/SETTINGS INPUTS

New columns/keys this area needs (consumers in parens):

1. **Table `workout_session_sets`** — DDL in (c). Consumers: `core/db/types.ts` (new type); `core/backup/backup.types.ts` — add to `BACKUP_ENTITIES` (:38-42 region), `BACKUP_ENTITY_COLUMNS` (:131-152), the V1-compat column map (:305-326), and hard-delete/portable lists (:382-386, :461+) as applicable; `core/backup/backupValidators.ts` — new `WORKOUT_SESSION_SET_RULES` + registration (:550-554) + referential check "references missing session exercise" (:601-656 pattern); `core/portable/portable.types.ts` entity labels (:94-98) and `core/portable/portableImport.ts` applier call site (:301-313) plus a new `applyRemoteWorkoutSessionSets` in `features/workout/workout.data.ts`; Supabase remote table + RLS policy (**cross-area dependency — flag to Area backup/sync owners**; the generic adapter pushes it automatically once the entity is in `BACKUP_ENTITIES`); e2e fixture column maps (`e2e/journeys/new-phone-v2.spec.ts:172-193, 404-505`); new `createId('sset')` prefix in the AGENTS.md prefix table.
2. **`workout_logs.started_at TEXT NULL`, `ended_at TEXT NULL`, `duration_seconds INTEGER NULL`** (migration v20). Consumers: `core/db/types.ts` `WorkoutLog`; `BACKUP_ENTITY_COLUMNS.workout_logs` (:151) + V1-compat map (:325); `WORKOUT_LOG_RULES` (`backupValidators.ts:388-394`) as *optional* nullable rules so legacy manifests without them still validate; `applyRemoteWorkoutLogs` INSERT column list (`workout.data.ts:782-794`); e2e fixtures (`new-phone-v2.spec.ts:192, 440-449`).
3. **Setting key `superhabits.workout.weightUnit`** (`'kg' | 'lb'`) — candidate for the recoverable-settings allowlist (`core/backup/backupSettings.ts` `buildRecoverableSettings`/`normalizeRecoverableSettings` + validator + checksum canonicalization) **if** the global-unit product choice in (c) is taken; per-set `weight_unit` column is the alternative. UNCERTAIN — needs product decision.
4. **Setting key `superhabits.workout.restSeconds` into the recoverable-settings allowlist** — currently device-local and lost on restore, unlike its pomodoro/calorie/theme siblings. Consumers: `backupSettings.ts` (allowlist build/normalize/validate), the settings read/write aggregation site, `tests/backupSettings.test.ts`.

## TEST COVERAGE GAPS

1. **`e2e/workout.spec.ts`** — no session-flow E2E exists at all: start routine → run/skip phases → Save and finish → open history detail → assert exercises/sets (and, post-F2, duration). The only session-related E2E is abandonment (`e2e/journeys/fat-fingers.spec.ts:449-483`, asserts nothing is written). Add a happy-path spec here.
2. **`e2e/workout.spec.ts`** — quick-complete vs timed-session distinction in history detail (guards F4's fix).
3. **`tests/workout.domain.test.ts`** — `summarizeCompletedSets` has exactly one happy-path case (:200-215) and currently *pins* the skip-counts-as-done behavior; add skipped-phase, partial-progress, and final-phase-skip cases reflecting F1's fixed semantics.
4. **`tests/workout.data.test.ts`** — assert `logWorkoutSession` persists `started_at`/`ended_at`/`duration_seconds` (wall-clock derived), and that `completeRoutine`/`logWorkoutFromLinkedAction` leave them NULL.
5. **`tests/integration/workoutIntegrity.test.ts`** — orphan rejection and parent-child cascade for `workout_session_sets` (mirroring the existing `routine_exercise_sets` coverage at :30-35), plus assertion that legacy logs without set rows still read cleanly.
6. **`tests/integration/backupRestore.test.ts`** and **`tests/integration/portableExportImport.test.ts`** — roundtrip coverage for the new table/columns (current workout seeds at :236/:567 can't exercise weight data by construction).
7. **`tests/backupValidators.test.ts`** — extended `WORKOUT_LOG_RULES` acceptance (nullable optional columns; legacy manifests lacking them remain valid) and `WORKOUT_SESSION_SET_RULES` + referential-failure case (pattern exists at :299-335).
8. **`tests/workout.pr.test.ts`** — `estimate1RM`/`computePersonalRecords`/`findNewPersonalRecords` with `null` weight/reps inputs once `LoggedSet` goes nullable (current guards are tested only against 0/NaN/∞).
9. **No unit tests exist for `restTimerPreferences`** (`clampRestSeconds` boundaries 5/600, NaN→default fallback, load/save round-trip) — new `tests/workout.restPreferences.test.ts` or a describe block in `tests/workout.domain.test.ts`.
10. **`tests/workout.pr.test.ts`** — `applyRestDefault` tests (:130-157) cover only the merge math; nothing pins the seed-at-create behavior (F3 fix) or the legacy-0 fallback after the precedence change.

**UNCERTAIN items**: weight-unit product model ((c)/input 3); whether a deliberately skipped-but-performed set should be markable done (F1 UX); whether quick-complete logs should gain synthetic content or stay labeled-empty (F4); whether mid-session rest-default mutation is intended global behavior (F8). Each is flagged with the evidence found; none blocks the schema/duration recommendations above.</subagent>
<subagent agent_id="agent-17" item="AREA 5 — CALORIES: Audit features/calories/**. Questions: (a) Copy-day: exact implementation; duplicate-safety on repeated invocation; mid-loop failure behavior; transactionality; structured outcome options. (b) Targets store (superhabits.calories.targets via features/calories/caloriesTargets.ts): shape/validation; relationship to app_meta calorie_goal already in the settings allowlist; what promoting targets into recoverable settings requires. (c) Diary/Form modes, day navigation, trend chart: local-calendar boundary correctness across timezones; any UTC drift bugs. (d) saved_meals hard-delete semantics — confirm preserved. (e) E2E coverage gaps for day navigation/copy/targets/trends." outcome="completed"># AREA 5 — CALORIES: Production-Hardening Audit Report

Scope: `features/calories/**` plus its direct contracts with `core/db`, `core/sync`, `core/backup`, `lib/time`, and the E2E suite. All findings verified against working tree at `main` (`d817103`).

---

## FINDINGS

### 1. P1 — Copy-day and diary day navigation are dead code: shipped components and data layer are unreachable from any UI

**Files:** `features/calories/DiaryDayNavigator.tsx:60,114,129`; `features/calories/calories.data.ts:338`

**What is wrong:** `DiaryDayNavigator.tsx` exports three components — `CopyDayModal` (:60), `CopyDayButton` (:114), `DiaryDayNavigator` (:129) — and none is imported anywhere in the repo (verified by repo-wide grep; only self-references exist). The data-layer function `copyCalorieEntriesFromDay` (`calories.data.ts:338`) is called only from `tests/calories.data.test.ts:292,360`. Commit `ddd83ea` ("wave(w9): diary day navigation…") added only the component file — `CaloriesScreen.tsx` was never touched. `CaloriesScreen.tsx:49-59` imports confirm no day-navigation/copy wiring.

**Why it matters:** Two advertised wave deliverables are user-invisible. The hardening handoff itself lists "Copy-day, day-navigation, targets modal, trend chart (calories) in browser" as UNTESTED (`openspec/changes/complete-product-roadmap-parallel-wave-v2/HARDENING_HANDOFF.md:98`). Untested dead code rots silently; when someone eventually wires it, findings 2–4 below become live defects.

**Fix:** Wire `DiaryDayNavigator` into `CaloriesDiaryView`: lift a `selectedDateKey` state into `CaloriesScreen`, pass it to `listCalorieEntries(selectedDateKey)` and `groupedEntries`, mount `CopyDayModal` with `onCopy={(src) => copyCalorieEntriesFromDay(src, selectedDateKey)` followed by `refresh()`. Alternatively, if day navigation is deferred, delete both the component file and the data function so the codebase doesn't carry an untested duplicate-write path — do not leave it half-integrated.

---

### 2. P1 — Copy-day is not transactional across the batch: mid-loop failure commits a silent partial copy

**Files:** `features/calories/calories.data.ts:350-378`; `core/sync/syncedMutation.ts:65-135`

**What is wrong:** `copyCalorieEntriesFromDay` loops over source entries and calls `runSyncedMutation` **per entry** (`calories.data.ts:354`). Each call is its own SQLite transaction (`runBackupMutation` → `withSQLiteTransaction`, `syncedMutation.ts:76`). If insert *k* of *N* fails (disk full, WASM/OPFS quota, constraint), entries 1..k−1 remain committed with durable outbox rows, the promise rejects, and the caller receives **no count of what was copied** — the partial result is unreportable and unundoable.

**Why it matters:** Violates the campaign's canonical-mutation-boundary ground rule for a multi-row logical operation. A user who sees "copy failed" cannot know the day is half-populated; retrying then double-copies the already-committed prefix (compounding finding 3). Each row is individually row+outbox atomic, so there is no corruption — but the logical operation has no all-or-nothing semantics.

**Fix:** Collapse to a single transaction: one `runBackupMutation` whose `mutate` reads source rows, inserts all copies, and calls `enqueue(...)` once per prepared record inside the same transaction (the primitive explicitly supports multiple enqueues — see the `upsertSavedMeal` RETURNING-id pattern at `calories.data.ts:237-277`). Return `{ copied }` only on commit; on failure nothing is written. Side benefit: one `resolveSyncOwnerUserId`/session read instead of N (`syncedMutation.ts:72` per iteration today).

---

### 3. P2 — Copy-day has no input validation, no same-day guard, and no structured outcome

**Files:** `features/calories/calories.data.ts:331-341`; `features/calories/DiaryDayNavigator.tsx:63-69`

**What is wrong:**
- No validation of `sourceDateKey`/`targetDateKey` (no `isValidDateKey` check, `lib/time.ts:7`). Malformed keys simply copy nothing.
- Nothing prevents `sourceDateKey === targetDateKey` at the data layer — copying a day onto itself doubles every entry. The only protection is UI-level: `CopyDayModal` filters candidates to `s.dateKey < targetDateKey` (`DiaryDayNavigator.tsx:66`). Future target dates are also accepted.
- Repeated invocation re-duplicates the whole day by design, but the bare `Promise<number>` return gives the caller no outcome vocabulary (`'copied' | 'source-empty' | 'invalid-range'`) to build feedback or an undo around.

**Why it matters:** Latent until finding 1 is fixed, but the data layer is the public contract; tests are currently the only caller and they encode none of these guards.

**Fix:** Add a discriminated outcome, e.g. `type CopyDayResult = { status: 'copied'; copiedCount: number } | { status: 'source-empty' } | { status: 'invalid-range'; reason: 'malformed-date-key' | 'same-day' | 'source-after-target' }`, validate both keys with `isValidDateKey`, reject `source >= target` unless explicitly allowed, and keep the doc comment in sync.

---

### 4. P2 — Macro targets (`superhabits.calories.targets`) are device-local while their fallback (`app_meta.calorie_goal`) is backup-recoverable: restore silently changes what the macro bars show

**Files:** `features/calories/caloriesTargets.ts:6-24`; `features/calories/CaloriesScreen.tsx:197-205,223`; `core/backup/backupSettings.ts:29-43,198-222`; `core/backup/backup.types.ts:544-551`

**What is wrong:** Targets live only in AsyncStorage (`caloriesTargets.ts:10`) and are classified device-local by design (`HARDENING_HANDOFF.md:29`). But the UI renders `effectiveTargets = macroTargets ?? goal` (`CaloriesScreen.tsx:223`), and `goal` **is** restored by Backup V2 / portable import via the settings allowlist. After restore on a new device, a user who had custom macro targets silently gets the restored goal values driving the protein/carbs/fats bars — a preference loss that looks like a bug but is undocumented anywhere user-visible.

**Why it matters:** This is the concrete gap behind "what promoting targets into recoverable settings requires". It is an *accepted* gap today per the handoff, hence P2 not P1 — but the promotion path should be on record before someone improvises it.

**Fix (promotion recipe, recommended Option A):**
1. Move storage from AsyncStorage to a new app_meta JSON key `calorie_targets` (owner `'calories'`) registered in `core/db/appMeta.ts:25-58`, mirroring `calorie_goal`; add load/save to `caloriesTargets.ts` with the same normalize-on-read contract (`getAppMetaJsonOrDefault` + `normalizeMacroTargets`).
2. Extend `RecoverableSettingsV2` (`backup.types.ts:544`) with `macroTargets: CalorieGoal | null`.
3. Touch points in `core/backup/backupSettings.ts`: `buildRecoverableSettings` (:29), `readRecoverableSettings` (:198), `normalizeRecoverableSettings` (:50, using `normalizeMacroTargets` so unknown/malformed falls back to null), `canonicalSettingsPayloadText` (:138, fixed field order like `calorieGoal`), `applyRecoverableSettingsToSqlite` (:231). Because the key becomes SQLite-backed it joins the import transaction — no theme-style staging needed.
4. Note the integrity interaction: adding a field to `canonicalSettingsPayloadText` changes the `user_backup_settings` canonical hash going forward. Older backups stay valid because `normalizeRecoverableSettings` drops unknown keys and absent keys normalize to `null`; update `tests/backupSettings.test.ts` and `tests/integration/backupCheckpoint.test.ts` expectations in the same change.
   *(Option B — keep AsyncStorage and stage application via the `stagePendingThemeApplication` pattern, `backupSettings.ts:257-268` — works but adds a second staged-apply path; Option A is simpler and transactional.)*

---

### 5. P2 — Two overlapping "per-day calories" sources of truth: goal vs. targets

**Files:** `features/calories/CaloriesScreen.tsx:219-250,268-291`; `features/calories/MacroTargetsModal.tsx:16-21`; `features/calories/CalorieGoalModal.tsx`

**What is wrong:** `MacroTargets` is structurally identical to `CalorieGoal` (`calories.domain.ts:150` — `type MacroTargets = CalorieGoal`), and the targets modal exposes a "Daily calories" field (`MacroTargetsModal.tsx:17`) even though only the three macro bars consume `effectiveTargets` (`CaloriesScreen.tsx:224-250`). Everything else — goal progress bar, donut, year chart goal line, heatmap intensity, activity strip — uses `goal.calories`. A user who sets "Daily calories: 2500" in the targets modal sees zero effect; setting it in the goal modal changes everything including the fallback targets.

**Why it matters:** Silent divergence between two identically-shaped settings invites support bugs and makes the future allowlist promotion (finding 4) carry the confusion forward.

**Fix:** Either drop the `calories` field from `MacroTargetsModal` (targets become protein/carbs/fats only — matches actual consumption), or make the modal's copy state explicitly which value drives what. Minimal change: remove the kcal field and the `calories` bounds check at `MacroTargetsModal.tsx:56-58`.

---

### 6. P2 — Diary can only ever show today; command-created past-day entries are invisible in every list surface

**Files:** `features/calories/calories.data.ts:79-85`; `features/calories/CaloriesScreen.tsx:216`; `features/command/command.executor.ts:214-236`

**What is wrong:** `listCalorieEntries()` defaults to `toDateKey()` and `CaloriesScreen` never passes a date. Meanwhile the command executor legitimately creates entries with past `consumedOn` (`command.executor.ts:214-236`, validated "today or a valid past local date"). Those entries appear only in aggregates (charts, ask retrieval, weekly review) — no screen lists them, and `updateCalorieEntry` (`calories.data.ts:153-216`) cannot change `consumed_on`, so they can't be moved either. `activeDateKey = entries[0]?.consumed_on ?? toDateKey()` (`CaloriesScreen.tsx:216`) is therefore always today and misleads as if it were a selected-day concept.

**Why it matters:** Data exists that the user cannot view or correct; this is the observable half of finding 1 and survives until a selected-date state exists.

**Fix:** Same root fix as finding 1: explicit `selectedDateKey` state (default today) passed to `listCalorieEntries`; derive the diary header from that state, not from `entries[0]`. Optionally add `consumedOn` to the edit modal later; not required for correctness.

---

### 7. P2 — No index on `calorie_entries.consumed_on`; every range/list query is a full table scan

**Files:** `core/db/client.ts:63-76` (DDL, no index); consumers: `calories.data.ts:37,54,82,344`; `features/command/ask.retrieval.ts:129`; `features/weekly-review/weeklyReview.summary.ts:200`

**What is wrong:** `consumed_on` is the filter column for the summary aggregate, the per-day list, copy-day source read, ask retrieval, and weekly review, but only the PK index exists. Fine at fixture scale (600 rows); grows linearly with years of use on the hot refresh path (`CaloriesScreen.refresh` runs it on every section activation/foreground).

**Fix:** In migration v20 (`core/db/client.ts` `runMigrations`, append-only): `CREATE INDEX IF NOT EXISTS idx_calorie_entries_consumed_on ON calorie_entries(consumed_on);`. No entity-shape change; backup scope unaffected (indexes aren't backed up). See SCHEMA INPUTS below.

---

### 8. P2 — Goal-driven chart normalizations don't recompute when the goal changes

**Files:** `features/calories/CaloriesScreen.tsx:174,179,668-676`

**What is wrong:** `calorieActivityDays` and `calorieHeatmapDays` are computed in `refresh()` using the goal *at refresh time*. `CalorieGoalModal.onSave` updates `goal` state but not the two arrays, so intensity buckets/value caps render against the stale goal until the next refresh trigger (section re-activation, foreground, rollover).

**Why it matters:** Purely visual staleness, but it's a wrong-number-on-screen class of defect right after a settings change.

**Fix:** Recompute the two arrays from `summary364` in a `useMemo` keyed on `[summary364, goal.calories]` instead of storing them in state inside `refresh()`.

---

### 9. P2 — Polish items (grouped)

- **Unbounded saved-meal catalog load:** `searchSavedMeals('')` (`calories.data.ts:299-304`) does `SELECT *` with no LIMIT on every `refresh()` into `allSavedMeals` (`CaloriesScreen.tsx:161`). Grows without bound with use history. Add a sane cap (e.g. 500) or paginate when it matters.
- **Per-iteration `new Date()` in range builders:** `lib/time.ts:64-72` constructs a fresh `Date` per loop iteration; a midnight straddle mid-loop would produce an inconsistent window. Hoist `const base = new Date()` above the loop. Theoretical, one-line hardening.
- **`MacroTargetsModal` empty-field semantics:** `Number('') === 0` passes the non-negative check, so clearing a macro field silently saves `0` (which then hides the bar via `buildTargetProgress`). `CalorieGoalModal` has identical behavior through `validateCalorieGoal`. Consistent, but consider treating empty as "keep current" or erroring.
- **`CopyDayModal` candidate slice trusts input ordering:** `.slice(-14)` (`DiaryDayNavigator.tsx:67`) assumes summaries are ASC by `dateKey` (true for `getCalorieSummaryByRange`, `calories.data.ts:40`). Sort defensively or document the contract on the props type.

### Confirmed-correct behaviors (no finding)

- **(d) `saved_meals` hard-delete semantics preserved.** `deleteSavedMeal` hard-deletes locally and emits an owner-scoped remote-delete intent in the same transaction (`calories.data.ts:315-329`); the atomic `ON CONFLICT(food_name COLLATE NOCASE)` upsert keeps original id/created_at/casing and bumps `use_count` (`:237-277`); restore import preserves `use_count`/`last_used_at` without counting as usage (`applyRemoteSavedMeals`, `:541-575`); `BACKUP_ENTITY_COLUMNS.saved_meals` exactly matches local columns (`core/backup/backup.types.ts:118-130`). Copy-day deliberately skips saved-meal maintenance so copying doesn't inflate `use_count` (`calories.data.ts:333-336`) — verified no `upsertSavedMeal` call in the copy path.
- **(c) Local-calendar boundary correctness is sound.** All date keys come from `toDateKey()` (local calendar, `lib/time.ts:20-25`); all label parsing anchors at noon (`${dateKey}T12:00:00` — `calories.domain.ts:70,332`, `CaloriesScreen.tsx:79`); `addDays`/`buildWeekStrip` use local `Date` arithmetic, which is DST-safe (`DiaryDayNavigator.tsx:14-18,39-49`); Monday-start computation `(getDay()+6)%7` is correct; `formatEntryTimestamp` renders UTC ISO `created_at` in local time. I found **no UTC drift bug** in this area. Trend windows (`buildDailyTrend` 365d, `buildMacroTrendPoints` 7/30d zero-filled, averages over full window) match their documented intent and their unit tests.

---

## SCHEMA/SETTINGS INPUTS

Nothing in this area requires new entity columns. Two inputs for the v20+ track:

1. **Index (migration v20, append-only block in `core/db/client.ts`):**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_calorie_entries_consumed_on
     ON calorie_entries (consumed_on);
   ```
   Consumers: `getCalorieSummaryByRange`, `countCalorieEntriesByRange`, `listCalorieEntries`, `copyCalorieEntriesFromDay` (`features/calories/calories.data.ts`), `features/command/ask.retrieval.ts:129-130`, `features/weekly-review/weeklyReview.summary.ts:200`, backup backfill reads. Nullable n/a; no type changes.

2. **Settings key for targets promotion (Option A from finding 4):**
   - New app_meta JSON key `calorie_targets`, owner `'calories'` (`core/db/appMeta.ts` registry).
   - `RecoverableSettingsV2.macroTargets: CalorieGoal | null` (`null` = unset → runtime falls back to `calorieGoal`; absent in old payloads normalizes to `null`).
   - Touch points: `core/backup/backup.types.ts:544`; `core/backup/backupSettings.ts` `buildRecoverableSettings` / `readRecoverableSettings` / `normalizeRecoverableSettings` / `canonicalSettingsPayloadText` / `applyRecoverableSettingsToSqlite`; consumer `features/calories/caloriesTargets.ts` (switch store) + `CaloriesScreen.tsx:197-205`.
   - Integrity note: changes the `user_backup_settings` canonical hash; back-compat holds because normalization drops unknown keys and defaults absent ones — update `tests/backupSettings.test.ts`, `tests/integration/backupCheckpoint.test.ts`.
   - If Option B (AsyncStorage retained) is chosen instead: add `'superhabits.calories.targets'` to `e2e/helpers/reset.ts:19-25` `ASYNC_STORAGE_KEYS` (today it is only cleared by the belt-and-braces `superhabits.*` sweep) and implement a staged pending-application marker mirroring `stagePendingThemeApplication`.

---

## TEST COVERAGE GAPS

Unit (Vitest):

- **`tests/caloriesTargets.test.ts` (new file — zero coverage today; verified no references in tests/e2e/simulation):** round-trip save/load; malformed JSON → `null`; non-object → `null`; object with no numeric fields → `null`; out-of-range fields clamped via `normalizeCalorieGoal` bounds.
- **`tests/calories.data.test.ts` additions:** copy-day single-transaction semantics (after finding 2: mock a failure on insert k → assert nothing committed, rejection surfaces); copy-day invalid-range outcomes (after finding 3: same-day, malformed keys, source-after-target); copy-day default `targetDateKey = toDateKey()`; copy-day emits no `saved_meals` writes (pin the deliberate skip).
- **`tests/calories.domain.test.ts`:** DST-boundary test for `buildMacroTrendPoints`/`buildDailyTrend` labels under a fake timer crossing a DST transition (CI runs `TZ=Asia/Manila`, which has none — force a TZ with DST, e.g. `America/New_York`).

E2E (Playwright, against `dist/`):

- **`e2e/calories.spec.ts` additions:** targets modal — open via "Edit daily targets ✎", save, assert bars re-render, persist across reload, and fall back to goal after the key is removed; goal modal save flow on the Calories screen; edit-entry flow (open edit, change macros, assert recomputed kcal); saved-meal browse modal search + category chip + long-press delete.
- **`e2e/calories-day-navigation.spec.ts` (new, after findings 1/6 are wired):** prev/next/jump-to-today, week-strip logged dots, future days disabled, per-day totals header, copy-day end-to-end including repeated-invocation behavior and the structured outcome surfaced in UI.
- **Journey extension (`e2e/journeys/three-months-in.spec.ts`):** a day-navigation + copy-day step over the HEAVY fixture once wired (the handoff's UNTESTED line at `HARDENING_HANDOFF.md:98` names exactly this).

UNCERTAIN (flagged, not asserted): whether `three-months-in` visually asserts the heatmap/trend charts beyond section markers — I did not audit every assertion in that 712-line journey; treat the "trend chart rendering" E2E gap as likely-but-unverified in detail.</subagent>
<subagent agent_id="agent-18" item="AREA 6 — COMMAND REMOTE PARITY: Audit features/command/** and supabase/functions/** (parse-ai-command and user-ai-ask if present). Questions: (a) Exact client-side typed contracts for create_project / update_goal_progress / add_todo_to_daily_plan drafts and ask kinds project_status / goal_progress / today_focus (features/command/types.ts, parser, config, executor). (b) Current Edge Function source: supported intents/asks today; precise gap list to parity; how responses normalize client-side (see tests/parseAiCommand.normalize.test.ts). (c) Confirm parse -&gt; review -&gt; explicit confirm -&gt; canonical executor flow holds for remote drafts; where mode fallback lives; what happens when remote returns unsupported. (d) Required source-level contract tests that do not exist. (e) Env vars gating remote mode and internal rollout." outcome="completed"># AREA 6 — COMMAND REMOTE PARITY AUDIT REPORT

Scope: `features/command/**`, `supabase/functions/parse-ai-command/**`, `supabase/functions/user-ai-ask/**`, `supabase/functions/_shared/aiSecurity.js`, and their tests. Read-only audit; nothing modified.

## Answers to the posed questions (summary before findings)

**(a) Client-side typed contracts.** All 10 create-draft kinds exist in `features/command/types.ts:13-23` (`DraftKind`), including `create_project` (types.ts:137-144: `name/color/targetDate`), `update_goal_progress` (types.ts:146-152: `goalTitle/percent`), `add_todo_to_daily_plan` (types.ts:154-160: `todoTitle/dateKey`). Ask kinds are 7 remote intents in `ask.types.ts:1-9`; the three planning asks (`project_status`/`goal_progress`/`today_focus`) exist only as local fact types (`ask.types.ts:188-213`) — they are **not** members of `AskIntent` and have no classify contract.

**(b) Edge Function source today.** `parse-ai-command` supports exactly 7 kinds (`index.js:44` prompt, `index.js:79-89` schema enum, `normalize.js:409-459` dispatch): `create_todo, complete_todo, create_habit, log_habit, log_calorie_entry, log_workout_routine, start_focus_session`. `user-ai-ask` supports exactly 7 intents (`index.js:62-70`): `pending_todos, calorie_summary, habit_progress, workout_summary, focus_summary, daily_overview, habit_streak`. Precise gap to parity: all six items listed in `openspec/changes/harden-parallel-completion-wave-v2/design.md:114-127`. Client-side normalization of parse responses is strict fail-closed (`realCommandParser.ts:506-578`, exercised by `tests/parseAiCommand.normalize.test.ts` + `tests/realCommandParser.test.ts`); unknown kinds throw → surfaced as `unavailable/response_validation_failed`.

**(c) Flow confirmation.** Parse → review → explicit confirm → canonical executor holds for remote drafts. `CommandScreen.handleParseCommand` (CommandScreen.tsx:352-414) feeds any draft — mock or `model_proxy` — into the same `prepareCommandReview` (command.review.ts:432-649), which assigns a locally-generated `executionToken` (`createId('cmd')`, command.review.ts:102) regardless of parser kind; `handleConfirm` re-prepares the review, requires `status === 'ready'` (CommandScreen.tsx:416-448), then calls `executeDraftAction`, which re-validates fields and enforces token single-use (command.executor.ts:441-455). Mode fallback lives in `CommandParserFacade.parseWithObservation` (commandParser.ts:102-136): remote attempt requires mode env + rollout env + backend configured + device toggle; on `unavailable` it falls back to the rule parser annotated `model_proxy_fallback`; on remote `unsupported` it returns unsupported verbatim with **no** fallback (deliberate, pinned by `tests/commandParser.facade.test.ts:171-193`). When remote returns an unsupported kind the UI shows a retryable card (CommandScreen.tsx:566-573); nothing executes.

**(d)** Missing contract tests listed in TEST COVERAGE GAPS below.

**(e) Env gating.** Create-remote requires ALL of: `EXPO_PUBLIC_AI_COMMAND_PARSE_MODE=remote_with_fallback` (commandConfig.ts:16-18,45-47), `EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT` truthy (commandConfig.ts:24-28,49-51), backend configured — `EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST` = `supabase_edge` (needs `EXPO_PUBLIC_SUPABASE_URL`+`ANON_KEY`) or `custom_url` (needs `EXPO_PUBLIC_AI_COMMAND_PROXY_URL`) (commandConfig.ts:53-59), plus the device-local AsyncStorage toggle `superhabits.command.internal-rollout.remote-enabled` (commandInternalRollout.ts:3-26). Function name override: `EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME` (default `parse-ai-command`). Server secrets: `OPENAI_API_KEY`, `AI_COMMAND_MODEL`, `OPENAI_BASE_URL` (parse, index.js:196-198); `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `AI_ASK_MODEL` (ask, index.js:255-257); `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` for auth+quota (aiSecurity.js:49-51,91-93). Ask/Auto are gated **only** by the compile-time constant `AI_ASK_EXPERIMENT_ENABLED` (types.ts:9) — see Finding 8.

---

## FINDINGS

### 1. P1 — Remote Create catalog is missing all three planning kinds; enabling remote mode regresses working local commands
- **Where:** `supabase/functions/parse-ai-command/index.js:44` (prompt), `index.js:79-89` (kind enum), `index.js:124-178` (fields schema has no planning fields), `normalize.js:409-459` (no dispatch branches); client `realCommandParser.ts:556-577` (no normalize branches either).
- **What's wrong:** The rule parser handles `create_project` / `update_goal_progress` / `add_todo_to_daily_plan` (`command.v2.domain.ts:207-298`) and the executor/review layers fully support them, but the edge function instructs the model they don't exist and rejects them at the schema level. Because the facade deliberately does not fall back on `unsupported` (commandParser.ts:115-121; pinned by `tests/commandParser.facade.test.ts:171-193`), a user who opts into internal rollout loses "create project Apollo", "set goal X to 50%", and "add X to my plan" entirely — they become hard `unsupported`.
- **Why it matters:** This is the exact parity gap the hardening design mandates closing (`harden-parallel-completion-wave-v2/design.md:114-127`, `HARDENING_HANDOFF.md:57-63`). It is a behavior regression gated behind an opt-in flag, so it will ship silently.
- **Fix:** Two-sided lockstep change: extend the edge prompt/enum/fields schema and add three normalizers in `parse-ai-command/normalize.js` (bounds: percent 0–100, targetDate valid YYYY-MM-DD, name ≤ sane length); add matching branches in `normalizeRemoteParseResponse` (client) so old clients fail closed during rolling deploys (they already do — preserve that). Add the parity contract test from TEST COVERAGE GAPS #1 and deploy the function only after source tests pass (per design.md:127).

### 2. P1 — Planning Ask intents (`project_status` / `goal_progress` / `today_focus`) are dead code: retrieval + formatting exist but nothing can ever reach them
- **Where:** facts types `ask.types.ts:188-213`; retrieval `ask.retrieval.ts:410-519` (`retrieveProjectStatus`, `retrieveGoalProgressSummary`, `retrieveTodayFocus` — zero runtime callers, verified repo-wide); formatters `planningAsk.domain.ts:7-43` (imported only by `tests/ask.planningRetrieval.test.ts`); classifier allowlists `user-ai-ask/index.js:62-70` and `askParser.ts:204-212` (7 intents each); auto router `autoModeRouter.ts:22` routes only ask-vs-create.
- **What's wrong:** The W6 planning-ask feature was built as types + retrieval + deterministic formatters but never wired into `AskParser.ask`, `classifyForAutoMode`, or any UI. Questions like "how is my Apollo project doing?" return `unsupported` from the classifier.
- **Why it matters:** Half-shipped surface: code implies capability the product doesn't have; the fact types will rot (`TodayFocusFacts.habitsRemainingCount` is already always null — see Finding 7). Registered elsewhere as a known gap; this report pins the precise missing wiring.
- **Fix:** Either (a) add the three intents end-to-end — edge `VALID_INTENTS` + params + prompt, client `AskIntent`/`ClassifyParams`/`ClassifyResult` variants, `retrieveFactsForIntent` cases, and answer path (deterministic formatting via `planningAsk.domain.ts` without a phrase round-trip is sufficient and avoids sending project/goal names upstream), or (b) delete the unwired retrieval/formatter code until wired. Do not leave it half-present.

### 3. P1 — Unbounded client conversation history breaks Ask mode after 20 questions in a session
- **Where:** `AskConversationContext.tsx:13-15` (`addTurn` appends without cap); `AskConversationView.tsx:33` passes all turns; `askParser.ts:393` sends them verbatim; server rejects >20: `user-ai-ask/normalize.js:10,51-53` → HTTP 400 → client maps to `unavailable/http_error` (`askParser.ts:122-131`).
- **What's wrong:** The 20-turn bound exists only server-side. On the 21st question of a session, every subsequent Ask (and Auto-ask) fails until app restart clears the in-memory provider.
- **Why it matters:** Predictable, user-visible breakage of a shipped surface after normal use; also wastes quota on requests that are guaranteed 400.
- **Fix:** Export a shared `ASK_MAX_CONVERSATION_TURNS = 20` constant; slice to the last N turns in `AskConversationProvider.addTurn` (or at send site in `askParser.ask`). Keep the server bound unchanged. Add test (gap #5).

### 4. P2 — Auto mode classifies every question twice, doubling latency and burning double quota
- **Where:** `AutoModeView.tsx:40-48` calls `classifyForAutoMode` (classify request #1); routing to ask then calls `askParser.ask` which classifies again (`askParser.ts:390-399`) before phrasing.
- **What's wrong:** One auto-mode ask costs 2× `ask_classify` + 1× `ask_phrase` against limits of 20/hour each (`_shared/aiSecurity.js:5-9`) and adds a full model round-trip of latency.
- **Why it matters:** Quota exhaustion arrives twice as fast in the default mode (`DEFAULT_COMMAND_MODE = 'auto'`, commandModePreference.ts:6); users hit 429s after ~10 auto-questions.
- **Fix:** Let `AskParser.ask` accept an optional precomputed `ClassifyResult` (or expose `askWithClassification`), used by `AutoModeView` after `classifyForAutoMode`. No security/semantics change.

### 5. P2 — Warning-code allowlist duplicated in three places and already diverged (`percent_clamped`)
- **Where:** union type `types.ts:38-50` (includes `percent_clamped`); client allowlist `realCommandParser.ts:36-47` (omits it); edge allowlist `parse-ai-command/normalize.js:5-16` (omits it).
- **What's wrong:** The mock parser emits `percent_clamped` (`command.v2.domain.ts:250-256`) and the executor/review surfaces it, but both remote normalizers silently strip it (`normalizeWarnings` drops unknown codes). The moment Finding 1 is fixed, a remote `update_goal_progress` draft clamped to 100% will lose its clamp warning.
- **Why it matters:** Silent information loss on the review screen; three hand-maintained copies guarantee future drift.
- **Fix:** Add `percent_clamped` to both allowlists now, and add the source-level parity test (gap #1) asserting client allowlist == edge allowlist == `DraftWarning['code']` union so the copies cannot drift again.

### 6. P2 — Same input yields different outcomes depending on which side normalizes todo due-date directives
- **Where:** edge `parse-ai-command/normalize.js:126-158` returns `outcome:'unsupported'` for invalid/conflicting date signals and for model-invented dates; client `realCommandParser.ts:217-246` throws for the same conditions, surfacing as `unavailable/response_validation_failed` (realCommandParser.ts:699-707).
- **What's wrong:** Today both sides run identical logic so the divergence is masked, but if the edge normalizer is updated (Finding 1 work touches this file) while a stale client ships, identical responses render as "unsupported" for new clients and "temporarily unavailable" for old ones. Related latent divergence: the edge classify stage accepts `raw.category` as an intent alias (`user-ai-ask/index.js:208`) that the client never would (`askParser.ts:203-215`).
- **Why it matters:** Contract drift between mirrored validators is exactly what produced SEC-001 (see comment header of `tests/parseAiCommand.normalize.test.ts:13-17`).
- **Fix:** Pick one semantic (unsupported) in the client throw paths for directive violations, and pin equivalence with shared-fixture tests (gaps #2/#3).

### 7. P2 — `retrieveTodayFocus` produces lossy facts: completed top priorities vanish and `completed` is hardcoded false
- **Where:** `ask.retrieval.ts:501-518` — `titleById` is built only from `listPendingTodos(...)`, so a top-priority Todo that is already complete is dropped from `topTodos`; survivors get `completed: false` unconditionally; `habitsRemainingCount: null` always despite the field (`ask.types.ts:207-212`).
- **What's wrong:** When the `today_focus` ask gets wired (Finding 2), "what's my focus today" will omit completed priorities and misreport completion state.
- **Why it matters:** Facts feed deterministic answers whose whole value is accuracy; wrong-by-construction facts violate the "report what the data says" phrase contract (`user-ai-ask/index.js:220-234`).
- **Fix:** Resolve `topTodoIds` against the full todo list (completed included), set `completed` from row state, and either populate `habitsRemainingCount` or remove the field before wiring the intent.

### 8. P2 — Ask/Auto have no rollout gating while Create-remote sits behind a four-condition gate
- **Where:** sole gate is compile-time `AI_ASK_EXPERIMENT_ENABLED = true` (`types.ts:9`); `ModeToggle` renders Ask/Auto unconditionally (CommandScreen.tsx:689-697); without Supabase config the failure arrives only at request time as `remote_not_configured` (`askParser.ts:74-83`). Contrast `isAiCommandInternalRolloutAvailable` (commandConfig.ts:61-67) + device toggle for Create.
- **What's wrong:** Inconsistent rollout posture between the two pipelines sharing one overlay; also `askParser.resolveRequestUrl()` ignores `EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST=custom_url` entirely (askParser.ts:54-56), so the proxy escape hatch exists only for parse, not ask.
- **Why it matters:** A bad ask deployment cannot be turned off per-device the way parse can; support burden lands as generic "Ask failed with status …".
- **Fix:** Either document Ask as intentionally always-on when Supabase is configured, or mirror the device-toggle pattern (`superhabits.command.ask.remote-enabled`). If custom-host ask is wanted, route through the same `backendHost` resolution as `realCommandParser.ts:580-590`.

### 9. P2 — Server retry budget is unreachable from clients; resilience is asymmetric between the two functions
- **Where:** `user-ai-ask/index.js:29-31,283-341` retries up to 3 attempts × 15 s timeout (+backoff ≈ up to ~48 s worst case); both clients abort at 4.5 s (`askParser.ts:25`, `realCommandParser.ts:34`). `parse-ai-command` has no upstream retry at all (`index.js:204-233`, single 15 s call).
- **What's wrong:** Ask's retries only complete after the client has already given up (phrase-stage failures degrade to the deterministic answer, `askParser.ts:448-467`, so users get answers but never the phrased ones); parse gets no retry benefit despite being the cheaper failure mode to retry.
- **Why it matters:** Dead complexity on one side, missing resilience on the other; latency-based classification buckets (`fast/noticeable/frustrating`, commandParser.ts:34-38) will systematically log `frustrating` for anything that hits a retry.
- **Fix:** Align deliberately: either shorten server attempts to fit inside the 4.5 s client window (e.g., 2 attempts × ~1.8 s) or raise the client timeout for the phrase stage; optionally add bounded retry to parse-ai-command mirroring ask's 429/5xx policy.

### 10. P2 — Mock `create_project` extraction leaves residue in the name, and the executor color map accepts colors the parsers can never produce
- **Where:** `'create project called Apollo due 2026-05-01 in blue'` → `name: 'Apollo in'` (`command.v2.domain.ts:214-232`; pinned as expected output in `tests/command.planning.domain.test.ts:38-41`); executor hex map includes `emerald/purple/yellow` (`command.executor.ts:316-330`) while the mock regex recognizes only `blue|green|violet|orange|amber|pink|teal|red|indigo|lime` (`command.v2.domain.ts:223-225`).
- **What's wrong:** Stripping the color word leaves the dangling "in"; the executor superset implies a contract the parsers don't fulfill (a remote model could legitimately emit `emerald`, but the local rule set can't).
- **Why it matters:** Users confirming a project named "Apollo in" get a wrong name persisted; parity work will inherit the inconsistent color vocabulary.
- **Fix:** Strip a leading preposition after color/date removal (`\b(?:in|with)\b` cleanup pass); define one canonical color-name list shared by parser regex, executor map, and (future) edge schema description.

### 11. P2 — "update goal …" phrasing is unreachable: preflight kills it before any parser runs
- **Where:** `UNSUPPORTED_ROOT_VERB_PATTERN` includes leading `update` (`command.domain.ts:18-19`), enforced in `preflightCommandDraft` (`command.domain.ts:424-434`) which runs before both mock and remote parsing (commandParser.ts:81-95); therefore the `(?:set|update)` alternative in `parseGoalProgressUpdate` (`command.v2.domain.ts:244-246`) can only ever fire for "set goal …". Tests only exercise "set goal …" (`tests/command.planning.domain.test.ts:50-85`).
- **What's wrong:** The regex advertises an "update goal" phrasing that always returns unsupported ("This command is outside the supported Command Center actions.").
- **Why it matters:** Misleading capability surface; when writing the remote prompt for Finding 1, this phrasing inconsistency will propagate into model guidance.
- **Fix:** Either exempt `update goal <x> to <n>%` from the root-verb preflight (narrow allowlist before the verb check) or drop `update` from the draft regex so the code matches reality.

### 12. P2 — Exactly-once confirm protection is process-memory only (note; do not weaken)
- **Where:** `claimedExecutionTokens` module-level `Set` (`command.executor.ts:37`); tokens are generated at review time for all drafts including remote (`command.review.ts:100-103`); `DraftBase.executionToken` doc states remote parsers never control it (`types.ts:67-68`).
- **What's wrong:** Double-submit protection resets on app restart, and the Set grows unbounded for the session (one entry per confirmed command — trivially small).
- **Why it matters:** Acceptable today because every mutation is idempotent-ish at the data layer and the token is a UX guard, not an integrity mechanism; recorded here so the remote-parity work doesn't mistake it for durable exactly-once semantics. Ground rules forbid weakening it; no change required beyond documentation in the parity contract.

### 13. P2 — Preflight observation labels out-of-scope inputs with the path that never ran (cosmetic telemetry distortion)
- **Where:** `commandParser.ts:81-95`: when preflight intercepts, `effectivePath` is reported as `'remote'` whenever rollout flags are on, even though no remote call was made; internal diagnostics (`InternalMetadataCard`, CommandScreen.tsx:677-681) and any future QA metrics will attribute unsupported outcomes to the remote path.
- **Why it matters:** Internal-rollout evaluation (the whole point of the observation) over-counts remote traffic/outcomes.
- **Fix:** Report a distinct path (e.g., reuse `'mock'` or add `'preflight'`) for preflight-intercepted results.

**UNCERTAIN items:**
- Whether the deployed production `parse-ai-command` matches this repo source (deployment state is outside the repo; `HARDENING_HANDOFF.md:62-63` says the planning kinds were *not* deployed as of the wave). I audited source only.
- `AI_COMMAND_MODEL` / `DEEPSEEK_*` secret values and live model behavior (schema adherence, reasoning-token budget comments at `user-ai-ask/index.js:22-25`) could not be verified locally.

---

## SCHEMA/SETTINGS INPUTS

No new SQLite columns are needed for this area — all command/ask state is either ephemeral (drafts, reviews) or AsyncStorage-backed. Inputs required or recommended:

- **Shared constant (required for Finding 3):** `ASK_MAX_CONVERSATION_TURNS = 20` — proposed export from `features/command/ask.types.ts` (or `lib/`), consumed by `AskConversationProvider.addTurn` (`AskConversationContext.tsx:13`), optionally asserted against `MAX_CONVERSATION_TURNS` in `supabase/functions/user-ai-ask/normalize.js:10` via contract test. Not a setting; a contract constant.
- **Optional settings key (Finding 8):** `superhabits.command.ask.remote-enabled` — AsyncStorage boolean, default `true` (preserves current behavior), pattern-cloned from `commandInternalRollout.ts`; consumers: `ModeToggle.tsx`, `AskConversationView.tsx`, `AutoModeView.tsx`. Only if per-device ask kill-switch is desired.
- **No backup-settings allowlist additions:** conversation turns and command history contain free-form user text; `harden-parallel-completion-wave-v2/design.md:112` already rules command history out of backup for privacy, and ask turns are the same class. Do not add to `core/backup/backupSettings.ts`.
- **If Finding 1 lands (edge schema):** new JSON-schema `fields` properties for planning kinds must be added to `buildStructuredResponseSchema()` (`parse-ai-command/index.js:124-178`) — suggested keys reusing client names: `goalTitle` (string|null), `percent` (number|null, 0–100), `planDateKey` or reuse existing `dateKey` (string|null), `targetDate` (string|null); note `name`/`color` already exist (habit) and can be reused for projects since normalization dispatches by kind. These are function-schema inputs, not SQLite migrations.

## TEST COVERAGE GAPS

1. **`tests/commandRemoteParity.contract.test.ts` (new, highest value):** source-level parity assertions that would have caught Findings 1 & 5 — (a) every member of `DraftKind` (`features/command/types.ts`) appears in the edge kind enum + prompt string (`parse-ai-command/index.js:44,79-89`) and has a client normalize branch; (b) client `SUPPORTED_WARNING_CODES` == edge `SUPPORTED_WARNING_CODES` == `DraftWarning['code']` union; (c) client supported-intent array (`askParser.ts:204-212`) == edge `VALID_INTENTS` (`user-ai-ask/index.js:62-70`) == `AskIntent` union.
2. **`tests/parseAiCommand.normalize.test.ts` (extend):** happy-path, `needs_input`, and bound-violation cases for the three planning kinds once implemented (percent >100, invalid `targetDate`, empty name); equivalence fixtures proving edge-unsupported vs client-throw divergence (Finding 6) is closed.
3. **`tests/realCommandParser.test.ts` (extend):** same three planning-kind payloads through `normalizeRemoteParseResponse`; plus a fail-closed case asserting an unknown future kind throws (never mis-normalizes).
4. **`tests/askConversationContext.test.ts` (new):** turn cap enforcement at 20 (oldest dropped), turn appended only on `answer` outcomes, clearHistory resets — pins Finding 3.
5. **`tests/autoModeRouter.test.ts` (new):** route mapping for all 7 intents + unsupported→create + unavailable→create fallback; after Finding 4's fix, assert exactly one classify request per auto-ask (fetch-call count).
6. **`tests/integration/commandCenterV2.test.ts` (extend):** review→confirm→execute integration for `model_proxy`-kind drafts (parserKind forced) covering all three planning kinds — currently the integration file exercises only mock-rule drafts and none of the planning kinds; asserts executionToken issuance and ready-gating for remote-shaped drafts.
7. **`tests/command.planning.executor.test.ts` (verify/extend):** ensure the daily-plan duplicate (`outcome:'duplicate'`) and 3-priority cap paths, and goal-not-found/ambiguous executor paths are covered (file exists; confirm these branches, add if absent).
8. **`tests/ask.retrieval.test.ts` (extend):** `retrieveProjectStatus` / `retrieveGoalProgressSummary` ambiguous/not-found error codes and `retrieveTodayFocus` completed-priority handling (Finding 7) — the planning retrievers currently have zero direct coverage (only their formatters are tested in `tests/ask.planningRetrieval.test.ts`).</subagent>
<subagent agent_id="agent-19" item="AREA 7 — NOTIFICATION ACTIONS: Audit core/notifications/**, lib/notifications.ts, lib/notificationConstants.ts, features/habits/habitReminderActions.ts, features/habits/notificationActions.data.ts, and any todo reminder scheduler (e.g. core/notifications/todoReminderScheduler.ts). Questions: (a) Exact wiring needed so todo_reminder_mark_done / todo_reminder_snooze flow through notificationResponseDispatcher: classifyNotificationResponse currently yields unknown for kind 'todo-reminder' — specify the required branch, action-key construction, and dedupe integration via claimNotificationActionInTransaction. (b) Mark-done idempotency via canonical todo APIs; behavior for missing/deleted/already-completed todos. (c) Snooze: bounded delay constant, pending-notification cancellation/replacement strategy, permission denial handling, unsupported-platform handling. (d) The existing habit snooze pattern to mirror. (e) Available test seams/mocks (notificationResponseBridge etc.) and required new tests. (f) Daily-plan reminder actions if any exist." outcome="completed">All evidence gathered. Here is the audit report.

---

# AREA 7 — NOTIFICATION ACTIONS AUDIT REPORT

Scope: `core/notifications/**`, `lib/notifications.ts`, `lib/notificationConstants.ts`, `features/habits/habitReminderActions.ts`, `features/habits/notificationActions.data.ts`, `core/notifications/todoReminderScheduler.ts`, plus the response-host wiring in `app/_layout.tsx` and the settings surface that drives the schedulers.

State of the world today: the **scheduling** half of todo/daily-plan reminders exists and is committed (`c1016cc`), including a native category with "Mark done"/"Snooze" buttons — but the **response** half is missing. Every press of those buttons is classified `unknown` and silently dropped. The habit reminder pipeline (schedule → classify → claim → mutate → linked-actions → snooze) is complete and is the pattern to mirror.

---

## FINDINGS

### F1 — P1: Todo reminder "Mark done" / "Snooze" buttons are dead; dispatcher has no `todo-reminder` branch

**Where:** `core/notifications/notificationResponseDispatcher.ts:46-57` (classification), `:27-28` (union type), `:30-44` (handlers); buttons registered at `lib/notifications.ts:247-261`; constants at `lib/notificationConstants.ts:12-15`.

**What is wrong:** `classifyNotificationResponse` only recognizes `HABIT_REMINDER_DATA_KIND` (`'habit-reminder'`). Any payload with `kind === 'todo-reminder'` hits the fallback at `notificationResponseDispatcher.ts:52-57` and returns `{ kind: 'unknown' }`. `dispatchNotificationResponse` (`:112-117`) returns immediately for non-habit kinds. Meanwhile `ensureTodoReminderCategory()` really does attach `todo_reminder_mark_done` / `todo_reminder_snooze` buttons to every scheduled todo reminder (`lib/notifications.ts:249-260`). In `app/_layout.tsx:118-153` an `unknown` response is fingerprint-recorded, queued, and cleared — the user sees nothing.

This is the registered defect (`openspec/changes/complete-product-roadmap-parallel-wave-v2/HARDENING_HANDOFF.md:64-66`); per instructions I do not re-prove it, but the exact wiring was requested:

**Required wiring (exact):**

1. **Types** (`notificationResponseDispatcher.ts`):
   ```ts
   export type TodoReminderResponseAction = 'open' | 'mark_done' | 'snooze';
   export type TodoReminderResponse = {
     kind: 'todo-reminder';
     action: TodoReminderResponseAction;
     actionIdentifier: string;
     todoId: string;
     occurrenceId: string;          // see F2 — must be fireAt-scoped
     notificationIdentifier: string;
     snoozed: boolean;
   };
   ```
   Extend `ClassifiedNotificationResponse` and add `markDone(todoIdInput)`, `snooze(...)`, `openTodo(todoId)` to `NotificationResponseHandlers`.

2. **Classification branch** — after the habit block, before the pomodoro/unknown fallback:
   ```ts
   if (data?.kind === TODO_REMINDER_DATA_KIND) {
     const todoId = data.todoId;
     if (typeof todoId !== 'string' || todoId.length === 0) return { kind: 'unknown', actionIdentifier };
     const action = actionIdentifier === TODO_REMINDER_MARK_DONE_ACTION ? 'mark_done'
       : actionIdentifier === TODO_REMINDER_SNOOZE_ACTION ? 'snooze'
       : (actionIdentifier === DEFAULT_ACTION_IDENTIFIER || actionIdentifier.length === 0) ? 'open'
       : null;                                   // unknown future action → unknown (mirror :84-93)
     if (action === null) return { kind: 'unknown', actionIdentifier };
     return { kind: 'todo-reminder', action, actionIdentifier, todoId,
       occurrenceId: typeof data.occurrenceId === 'string' && data.occurrenceId.length > 0
         ? data.occurrenceId : todoReminderIdentifier(todoId),
       notificationIdentifier: response?.notification.request.identifier ?? '',
       snoozed: data.snoozed === true };
   }
   ```
   Mirror the habit unknown-action guard (`:84-93`) exactly: unrecognized action identifiers must not fall through to body-tap semantics.

3. **Action-key construction** — mirror `getHabitReminderActionKey` (`features/habits/habits.domain`… precisely `features/habits/habitReminders.domain.ts:101-107`): add to `reminderPlanning.ts`
   ```ts
   export function getTodoReminderActionKey(occurrenceId: string, action: 'todo_reminder_mark_done' | 'todo_reminder_snooze'): string {
     return `${occurrenceId}:${action}`;
   }
   ```
   i.e. `todo-reminder:{todoId}:{fireAtMs}:todo_reminder_mark_done`. Keys are consumed by `claimNotificationActionInTransaction` (`features/habits/notificationActions.data.ts:25-71`) whose `action_key` is the `PRIMARY KEY` of `processed_notification_actions` (`core/db/client.ts:405-413`) — the table is generic (`kind`/`action_name` are free-form TEXT), so `kind='todo-reminder'`, `actionName='mark_done'|'snooze'` work with **zero schema change**.

4. **Dedupe integration**:
   - *Mark done*: must NOT call bare `completeTodo()` after a standalone claim. The claim and the mutation must share one SQLite transaction (see F2/Finding below on why). Implement `completeTodoFromNotification` in `features/todos/todos.data.ts` mirroring `completeHabitFromNotification` (`features/habits/habits.data.ts:270-435`): inside the mutation transaction call `claimNotificationActionInTransaction(db, { actionKey, kind: 'todo-reminder', actionName: 'mark_done', occurrenceId, processedAt })`; if `!claim.claimed` → return `duplicate` without mutating; if todo missing/deleted or already completed → `setNotificationActionLinkedRequiredInTransaction(db, actionKey, false)` and return `noop`; else apply the completion, enqueue the sync record durably in-transaction, set `linked_action_required = 1`, then after commit run `linkedActionsEngine.processSourceAction({ eventId: claim.linkedEventId, triggerType: 'todo.completed', ... })` so replays after a crash between the two durable boundaries finish safely (this is exactly the invariant documented at `features/habits/habits.data.ts:246-252`). Note `todos.data.ts:796-848` (`completeTodoFromLinkedAction`) is prior art for the "from-X" variant naming and for missing/already-completed handling.
   - *Snooze*: claim-first is acceptable (mirroring `habitReminderActions.ts:137-143`) because a consumed-but-unapplied snooze claim only suppresses a retry of the *same delivered notification*, which is correct.
   - Keep both handlers inside the serialized `responseQueue` in `app/_layout.tsx:116-150` — do not create a second dispatch path.

5. **Host wiring** (`app/_layout.tsx:128-139`): extend the handlers object with `openTodo: () => setActiveSection('todos')` (NavigationContext has no per-todo focus; `openHabit` at `core/providers/NavigationProvider.tsx:42-49` is the template if focus is later wanted) and implementations delegating to the new `completeTodoFromNotification` / `snoozeTodoReminderAction`, surfacing returned linked-action notices via `showNotice`.

**Why it matters:** two visible buttons on every due-date notification do nothing, silently. Also a trap for implementers: routing the response through `toggleTodo` would make a replayed response **un-complete** the todo — the spec above mandates `desiredCompletion = 1` semantics only (`todos.data.ts:714-717` idempotent-complete contract).

---

### F2 — P1: Per-todo-stable action keys would permanently block legitimate re-completions (design requirement for F1)

**Where:** `core/notifications/todoReminderScheduler.ts:86-95` (payload has only `kind/version/todoId`), `:42-44` (`todoReminderIdentifier` is stable per todo).

**What is wrong:** Unlike habits, whose identifier/actionKey embed `dateKey` so each day gets a fresh claim (`habitReminders.domain.ts:93-107`), a todo reminder's native identifier and payload never change across reschedules. If the actionKey is derived only from `todoId`, then: complete-from-notification → reopen the todo (`setTodoCompletion` reschedules the reminder at `todos.data.ts:649-650`, same identifier, new fire time) → reminder fires again → user taps "Mark done" → `claimNotificationActionInTransaction` finds the existing row → `claimed: false` → permanent silent no-op for that todo until app data is wiped.

**Why it matters:** breaks the feature on a completely ordinary flow, and does so *silently*.

**Fix:** make the occurrence part of the identity. At schedule time embed the fire time in the payload and use it as the occurrence:
```ts
data: { kind, version, todoId,
        occurrenceId: `${identifier}:${fireAt.getTime()}`,   // new
        dueAt: fireAt.toISOString(),                         // optional, enables tap-time validation
        snoozed: false }
```
The snooze replacement carries the **base occurrence's** `occurrenceId` (mirroring `habitReminderActions.ts:206`). Replay-dedupe is preserved because the same delivered notification always carries the same bytes; each reschedule produces a fresh claim namespace. Legacy V1 payloads already on devices lack `occurrenceId` — the classifier fallback from F1 (derive from `todoReminderIdentifier(todoId)`) keeps them working; they are replaced on the next `syncTodoDueReminder` anyway. Keep `TODO_REMINDER_DATA_VERSION = 1` and treat `occurrenceId` as optional-with-fallback rather than bumping, or bump to 2 if the team prefers explicitness — either is defensible; the fallback is what matters.

---

### F3 — P1: No reconcile path for todo reminders — toggle-off leaves notifications firing; toggle-on schedules nothing; restore/bootstrap leave stale inventory

**Where:** `features/settings/SettingsNotificationsSection.tsx:71-86` (toggle handler calls only `syncDailyPlanReminder()`); `core/notifications/todoReminderScheduler.ts` (per-todo sync only, no bulk reconcile); contrast `core/notifications/HabitReminderHost.tsx:15-40` + `features/habits/habitReminders.service.ts:209-331`.

**What is wrong:** Three manifestations of one root cause — there is no `reconcileTodoReminders()`:
- Toggling the master preference **off** cancels nothing (`syncDailyPlanReminder` cancels only `DAILY_PLAN_REMINDER_IDENTIFIER` at `dailyPlanReminderScheduler.ts:29-32`). Already-scheduled due-date reminders keep firing even though the user disabled the feature. Per-todo cancellation happens only if that specific todo is later mutated (`todoReminderScheduler.ts:66-72`).
- Toggling **on** schedules reminders for exactly zero existing todos; only todos created/edited afterwards get reminders (`todos.data.ts:218, 456, 650`).
- After a Restore V2 import (todos imported onto an empty device) or any local wipe that doesn't uninstall, previously scheduled native notifications persist with no diff-and-cancel pass; habits handle this exact scenario by cancelling everything not in the desired plan (`habitReminders.service.ts:283-292`).

**Why it matters:** the preference toggle is a promise the scheduler doesn't keep; stale notifications fire for deleted/restored-away state.

**Fix:** add `reconcileTodoReminders(): Promise<{status:'reconciled'|'permission_denied'|'unsupported'|'failed', cancelled, scheduled}>` to `core/notifications/todoReminderScheduler.ts`: read `listScheduledNotifications()`, partition by `data.kind === TODO_REMINDER_DATA_KIND` (never touch other namespaces — copy the isolation comment discipline of `habitReminders.service.ts:204-208`), compute desired = pending, non-deleted todos with future fire times when the preference is enabled, cancel the rest, schedule the rest. Call it (a) from `handleToggleTodoReminders` after `setTodoRemindersEnabled`, (b) once at bootstrap after `authBootstrapReady` (a small `TodoReminderHost` beside `HabitReminderHost`, or fold into it), and (c) after the restore prompt completes. Use the foreground-refresh hook (`useForegroundRefresh`) as the habit host does.

---

### F4 — P1: Snooze lifecycle is unowned — completing/deleting/updating a todo will strand its snooze replacement

**Where:** `core/notifications/todoReminderScheduler.ts:103-105` (`cancelTodoDueReminder` cancels only the base identifier); mutation-time sync points `features/todos/todos.data.ts:452-459` (update), `:646-651` (completion/reopen), `:793` (delete).

**What is wrong:** This finding is forward-looking but must be fixed *as part of* the F1 snooze wiring, not after it. Once `snoozeTodoReminderAction` schedules a replacement under a second identifier (`todo-reminder-snooze:{todoId}` — proposed, mirroring `getHabitReminderSnoozeIdentifier` at `habitReminders.domain.ts:97-99`), nothing in the todo mutation paths cancels it: `cancelReminderSafely` wraps `cancelTodoDueReminder`, which targets only `todo-reminder:{todoId}`. Complete a todo right after snoozing → the snoozed notification still fires "This todo is due now." for a completed todo. Habits self-heal because `isValidSnoozeRequest` re-validates against completions on every reconcile pass (`habitReminders.service.ts:129-179, 294-325`); todos have no reconcile loop, so **mutation-time cancellation is mandatory**, plus tap-time validation.

**Fix (spec for the snooze implementation, answering question (c)):**
- **Bounded delay constant:** `TODO_REMINDER_SNOOZE_MINUTES = 15` in `reminderPlanning.ts` (mirror `HABIT_REMINDER_SNOOZE_MINUTES`, `habitReminders.domain.ts:18`). Fixed, not cumulative.
- **Cancellation/replacement strategy:** serialize through a module-level promise queue exactly like `snoozeQueue` (`habitReminderActions.ts:102-122`) so foreground-listener and cold-start replays cannot race; claim first (`claimNotificationAction`, `notificationActions.data.ts:86-95`); validate the todo still exists (`deleted_at IS NULL`), `completed = 0`, preference enabled, and the payload's `dueAt`/`occurrenceId` still match the current row; cancel the base reminder and all stale snooze requests for the todo; dedupe a repeated tap by finding a matching future request with the canonical snooze identifier (`habitReminderActions.ts:180-198`); schedule the replacement with `snoozed: true` and the base `occurrenceId`.
- **Midnight/date boundary:** habits refuse to snooze across the dateKey boundary (`habitReminderActions.ts:147-153`). Todos are due-moment-based, not calendar-day-based — **allow crossing local midnight** (a 23:50 due todo snoozed 15 min is legitimate); validity is "todo still pending", not "same dateKey". Document this divergence deliberately.
- **Permission denial:** check `getNotificationPermissionState() !== 'granted'` before scheduling and return `{ status: 'unsupported', identifier }` without throwing (`habitReminderActions.ts:176-178` pattern).
- **Unsupported platform:** the whole path is unreachable on web (listener never installed, `app/_layout.tsx:156`; scheduler no-ops, `todoReminderScheduler.ts:59`); the snooze function should still early-return a `noop`/`unsupported` result defensively.
- **Mutation hooks:** extend `cancelReminderSafely` (or add `cancelTodoReminderSafely(todoId)` that cancels both identifiers) and call it at all three existing sync points plus wherever F3's reconcile lands.

---

### F5 — P2: Scheduler results misreport permission denial (and any native failure) as `'web'`

**Where:** `core/notifications/todoReminderScheduler.ts:98`; `core/notifications/dailyPlanReminderScheduler.ts:46`; root cause `lib/notifications.ts:280-282` and `:329-330` (`scheduleTodoReminderNotification` / `scheduleDailyPlanReminderNotification` return `null` both for web and for `ensureNotificationPermission() === false`).

**What is wrong:** Both bridges translate a `null` return into `{ status: 'skipped', reason: 'web' }`. On a native device with notifications denied, the result claims the platform is web. The result unions have no permission-denied member, so callers (and future tests/UI) cannot distinguish "impossible here" from "blocked by the user".

**Why it matters:** observability and correct branching for F3's reconcile (a permission-denied reconcile must not mass-cancel-and-reschedule in a loop, and the settings UI should say "Blocked in system settings" — which it already computes separately at `SettingsNotificationsSection.tsx:49-57`, so the pieces disagree).

**Fix:** give the lib functions a tri-state outcome (e.g. return `'web' | 'permission-denied' | string | null`, or expose `ensureNotificationPermission` returning the state) and add `reason: 'permission-denied'` to both scheduler result types. Small, contained, no behavior change otherwise.

---

### F6 — P2: Daily-plan reminder is gated by the *todo* reminders toggle, and the UI reports success regardless

**Where:** `core/notifications/dailyPlanReminderScheduler.ts:28-32` (reads `getTodoRemindersEnabled()`); `features/settings/SettingsNotificationsSection.tsx:99-102` ("Daily plan reminder saved for HH:mm" shown unconditionally), `:78` (toggling *todos* re-syncs the *daily-plan* reminder).

**What is wrong:** There is no separate daily-plan enable preference; the daily-plan nudge silently inherits the todo toggle. Saving a daily-plan time while the todo toggle is off stores the time, shows "saved", and schedules nothing (`syncDailyPlanReminder` returns `{ status: 'cancelled' }`). Conversely toggling todos off kills the daily-plan nudge with no indication. Combined with F5, the saved note can also be shown when scheduling was skipped entirely.

**Why it matters:** incorrect feedback about whether a reminder exists; two features coupled by an undocumented key named `todo-reminders-enabled`.

**Fix (pick one explicitly):** (a) introduce `superhabits.notifications.daily-plan-enabled` (AsyncStorage, default `true`? decide product-side) and gate on it; or (b) keep the coupling but render the sync result honestly: disable/annotate the daily-plan field when the master toggle is off, and surface `cancelled`/`skipped` outcomes instead of the unconditional success note. Option (b) is the minimal change.

---

### F7 — P2: Dead `'pomodoro'` classification branch; timer-end taps navigate nowhere

**Where:** `core/notifications/notificationResponseDispatcher.ts:54`; `lib/notifications.ts:125-138` (`scheduleTimerEndNotification` sets no `data` at all).

**What is wrong:** Nothing in the codebase schedules a notification with `data.kind === 'pomodoro'` (verified by grep across the repo), so the `'pomodoro'` classification arm is unreachable; actual pomodoro timer-end taps carry no data, classify `unknown`, and do nothing. Interaction note for the pomodoro area: if timer-end taps should route to the Focus section, the notification needs `data: { kind: 'pomodoro', ... }` plus a dispatcher/navigation branch; otherwise delete the dead arm. No pomodoro behavior was changed or assumed here.

---

### F8 — P2: Todo reminder permission is never requested from an interactive context; `requestTodoReminderPermission` is dead exports

**Where:** `lib/notifications.ts:263-271` (`requestTodoReminderPermission`) and `:234-245` (`ensureTodoReminderChannel`) — zero callers repo-wide (grep-verified); implicit request happens inside scheduling via `ensureNotificationPermission()` (`lib/notifications.ts:113-123, 281`).

**What is wrong:** The settings toggle turns the preference on and shows "Todo reminders on." (`SettingsNotificationsSection.tsx:76-79`) without ever calling `requestTodoReminderPermission`. On iOS/Android 13+ the first OS prompt is instead triggered as a side effect of a later background-ish schedule call, and if the user denies there, nothing surfaces it (compounded by F5). Habits solve this with an explicit request-and-report flow (`HabitsScreen.tsx:400-440`).

**Fix:** in `handleToggleTodoReminders(true)`, call `requestTodoReminderPermission()` first; on anything other than `granted`, show the HabitsScreen-style error text and either revert the switch or leave it on with a visible warning. Also mirrors channel creation before first schedule.

---

### F9 — P2 (note, interaction only): `getNotificationResponseData` accepts arrays; harmless today

**Where:** `lib/notifications.ts:351-356`. `typeof [] === 'object'` passes the guard; `data?.kind` is then `undefined` so classification still yields `unknown`. No action required; listed only for completeness of the parsing seam. Not counted as a defect to fix in this campaign.

---

### Positive observations (no action needed)

- `processed_notification_actions` (migration 13, append-only respected, `core/db/client.ts:402-421`) is fully generic over `kind`/`action_name`; the claim helpers (`features/habits/notificationActions.data.ts`) are reusable for `todo-reminder` with **no schema change** — migration head stays v19 for this area.
- Retention pruning (35 days) runs inside every claim (`notificationActions.data.ts:29-34`) and is covered by a real-SQLite test.
- Restore correctly wipes markers and asserts zero rows (`e2e/journeys/new-phone-v2.spec.ts:816-833`).
- The habit end-to-end chain (claim-in-transaction, crash-replay safety, linked-action exactly-once, single-snooze invariant) is implemented and tested; it is a sound template, not just aspiration.

---

## SCHEMA/SETTINGS INPUTS

**SQLite: none required.** `processed_notification_actions.action_key/kind/action_name/occurrence_id` are free-form TEXT and absorb `kind='todo-reminder'`, `action_name ∈ {'mark_done','snooze'}` unchanged. No v20 migration is needed by this area. Do not sync this table (it is deliberately local operational state, `notificationActions.data.ts:21-24`).

**Notification payload fields (not schema, but contractual):**
- `data.occurrenceId: string` — `${todoReminderIdentifier(todoId)}:${fireAt.getTime()}`; optional-with-fallback for legacy V1 payloads (F2). Consumer sites: classifier fallback, `getTodoReminderActionKey`, snooze replacement payload.
- `data.dueAt: string` (ISO, optional) — enables tap-time validation that the due moment wasn't edited after the notification was scheduled. Consumer: `snoozeTodoReminderAction` validity check (F4).
- `data.snoozed: boolean` — mirrors habit payloads; consumer: classifier (`snoozed` flag) and reconcile-style inventory filters.

**AsyncStorage keys (device-local, `superhabits.notifications.*` prefix, consistent with `notificationPreferences.ts:10-11` and the handoff's durable-data table):**
- Existing (unchanged): `superhabits.notifications.todo-reminders-enabled`, `superhabits.notifications.daily-plan-reminder-time`.
- Proposed only if F6 option (a) is chosen: `superhabits.notifications.daily-plan-enabled` (string `'enabled'` present/absent, mirroring the toggle-key style; default decision needed from product). No backup-settings allowlist change either way — these stay out of the recoverable-settings V2 allowlist (`calorieGoal`, `pomodoroSettings`, `theme.mode`, `theme.slots`), consistent with the handoff's classification of notification prefs as device-local.

---

## TEST COVERAGE GAPS

Existing seams to build on: adapter-injectable snooze (`habitReminderActions.ts:105-122` second parameter), real-SQLite harness (`tests/integration/helpers/db.ts` `freshDatabase()` + `tests/integration/setup.ts` expo-notifications mock), unit-project mocks (`tests/setup.ts`), fake timers with fixed `NOW` (`tests/integration/habitReminderActions.test.ts:15, 39-46`), preference cache reset (`notificationPreferences.ts:67-70`), and the test-only response injection seam (`notificationResponseBridge.ts:16-18`; note it is inert on web since `_layout.tsx:156` never installs the handler — Playwright cannot drive the dispatcher; native lanes use Maestro, cf. `docs/testing/known-gaps.md:105-127`).

Required tests that do not exist today:

1. **`tests/notificationResponseDispatcher.test.ts` (extend)** — `kind:'todo-reminder'` classifies body tap → `open`, `todo_reminder_mark_done` → `mark_done`, `todo_reminder_snooze` → `snooze`; malformed/missing `todoId` → `unknown`; unrecognized action identifier → `unknown` (not treated as open); `dispatchNotificationResponse` invokes the new handlers with the exact `occurrenceId`-derived actionKeys; `kind:'daily-plan-reminder'` remains `unknown`.
2. **`tests/integration/todoReminderActions.test.ts` (new)** — real-SQLite mirror of the habit suite: concurrent duplicate mark-done yields `['applied','duplicate']` with exactly one marker row; missing / soft-deleted / already-completed todo → `noop` with no mutation; replay after closing and reopening the same DB file → `duplicate`; `todo.completed` Linked Action fires exactly once across replay (one `linked_action_executions` row); daily-recurrence spawn still occurs on notification completion; two-todo isolation; marker retention pruning for `kind:'todo-reminder'`.
3. **`tests/integration/todoReminderSnooze.test.ts` (new)** — fixed 15-minute replacement with preserved base payload; repeated tap → `duplicate`, single native request; noop for completed/deleted/disabled-preference todos with no schedule call; permission-denied adapter → `unsupported`; midnight-crossing snooze allowed (documented divergence test); completing/deleting a todo cancels both base and snooze identifiers (F4 regression guard).
4. **`tests/notifications.test.ts` (extend)** — category registration test for `todoReminder` mirroring the habit category test (`:56-98`): asserts buttons `todo_reminder_mark_done` ("Mark done") and `todo_reminder_snooze` ("Snooze") with `opensAppToForeground: true`, and the `todo-reminders` channel options.
5. **`tests/todoReminderScheduler.test.ts` (new, unit project)** — `syncTodoDueReminder` matrix: web skip; disabled preference cancels stale reminder; past-due cancels; completed cancels; missing due date skips; schedule payload contains `kind/version/todoId/occurrenceId(fireAt)/dueAt`; reschedule replaces under the stable identifier; `cancelTodoDueReminder` cancels both identifiers post-F4; skipped-reason is `'permission-denied'` not `'web'` on native denial (F5).
6. **`tests/todoReminderReconcile.test.ts` (new, unit)** — `reconcileTodoReminders`: toggle-off cancels all `kind:'todo-reminder'` requests and never touches habit/pomodoro namespaces; toggle-on schedules for pending due todos; restore-shaped inventory (reminders for nonexistent todos) is cancelled (F3).
7. **`tests/dailyPlanReminderScheduler.test.ts` (new, unit)** — enabled/disabled/web outcomes; gating behavior per the F6 decision; honest result propagation to the settings layer.
8. **Native lane (register, expect NOT RUN unless device available)** — `.maestro/` flow exercising Mark done and Snooze on a real Android notification (shade action selection), mirroring the habit V2 validation recorded in `docs/testing/known-gaps.md:111-120`; per campaign rules an unavailable device lane is reported `ENVIRONMENT`/`NOT RUN`, never assumed.

**UNCERTAIN markers:** (1) Whether the daily-plan reminder's coupling to the todo toggle is intentional product design — the code comment says only "changing the stored time re-schedules it"; F6 offers both readings. (2) Whether pomodoro timer-end taps are *supposed* to navigate — owned by the pomodoro area; F7 records the facts only. (3) Exact desired UX when mark-done succeeds from a cold start (navigate to Todos vs. stay) — the habit precedent navigates (`_layout.tsx:133`); I assumed parity.</subagent>
<subagent agent_id="agent-20" item="AREA 8 — CROSS-FEATURE CONSISTENCY: Audit features/overview/**, features/activity/**, features/progress/**, features/shared/**, plus command retrieval/ask answer paths. Questions: (a) Every aggregate/count that includes habits and whether it must exclude paused/archived habits once status becomes durable — list exact query/function sites. (b) Focus stats: data sources; what changes when pomodoro metadata becomes durable columns. (c) Activity/Progress windows: local-calendar boundary handling; timezone-matrix risks. (d) Overview cards empty/loading/error state coherence. (e) Command center retrieval/ask answers that would wrongly surface paused/archived habits or stale pomodoro metadata." outcome="completed"># AREA 8 — CROSS-FEATURE CONSISTENCY AUDIT REPORT

Scope: `features/overview/**`, `features/activity/**`, `features/progress/**`, `features/shared/**`, plus command retrieval/ask answer paths (`ask.retrieval.ts`, `askParser.ts`, `planningAsk.domain.ts`, resolver). Read-only audit; no files modified.

---

## FINDINGS

### F1 — Paused/archived habits are included in every cross-feature aggregate (conditional P1; activates the moment habit status becomes durable)

Today pause/archive lives only in AsyncStorage (`features/habits/habitLifecycle.store.ts:10-11`, keys `superhabits.habits.pausedIds` / `superhabits.archivedIds`) and is consumed **only** by `HabitsScreen.tsx:218` (verified by repo-wide grep). Every aggregate outside HabitsScreen therefore already disagrees with the Habits screen's definition of "active". Once status is durable (v20+), each of these sites must be revisited. Exact sites within my area:

| # | Site | What it counts today | Must exclude archived? | Must exclude paused? |
|---|------|---------------------|------------------------|----------------------|
| 1 | `features/overview/OverviewScreen.tsx:100` (`listHabits()`) → `overview.domain.ts:216-236` `shapeHabitsSummary` | `scheduledToday`, `completedToday`, rings | **Yes** — an archived habit scheduled today renders a ring forever | **Yes** — HabitsScreen semantics say paused = "excluded from today progress" (`habitLifecycle.store.ts:5-8`) |
| 2 | `features/overview/OverviewScreen.tsx:207` `hasAnyData` (`summaries.habits.scheduledToday > 0`) | Dashboard "nothing tracked" gate | Yes (inherits #1) | Yes (inherits #1) |
| 3 | `features/progress/progress.data.ts:128-139` `countHabitCompletions` → `ProgressInsightsView.tsx:69-74` "Habit completions" card | Raw `habit_completions` rows in window, **no join to habits at all** | Decision needed (see F3) — at minimum document | Decision needed; current-window completions of paused habits inflate "this week vs prior" |
| 4 | `features/activity/activityTimeline.data.ts:72-78` habit events (join `h.deleted_at IS NULL` only) | Timeline "Completed …" items | No — history feed; keep past events, but see F3/F5 | No — history feed |
| 5 | `features/command/ask.retrieval.ts:155` `retrieveHabitStreak(null)` overall scope | Streak list for "how are my habits?" | **Yes** — Ask would recite archived habits' streaks | Yes for current-streak framing |
| 6 | `features/command/ask.retrieval.ts:227-243` `retrieveHabitProgress` (both scopes) | Progress metrics incl. `currentActual/currentTarget` today | **Yes** | Yes |
| 7 | `features/command/ask.retrieval.ts:344,350-370` `retrieveDailyOverview` | `scheduledCount/completedCount/remainingCount` spoken in the daily_overview answer | **Yes** | **Yes** — "3 of 5 habits done" must not count paused ones |

Why it matters: the whole point of pausing/archiving is to remove a habit from "today's" obligations; if Overview, Progress, and Ask still count them, the durable migration silently ships the inconsistency. Adjacent consumers with the same question (one-line cross-ref, other auditors' areas): `weeklyReview.summary.ts:80-125`, `daily-plan/DailyPlanView.tsx:58`, `projects/ProjectDetailView.tsx:70`, `habitReminders.service.ts:195`, `linkedActionsTargetProviders.ts:86`, `command.review.ts:487` / `command.executor.ts:177` (log_habit on a paused/archived habit is currently accepted).

Fix: when adding durable columns (see SCHEMA section), introduce one canonical data-layer helper (e.g. `listActiveHabits()` = `WHERE deleted_at IS NULL AND archived_at IS NULL AND paused_at IS NULL`) plus `listAllHabitsIncludingArchived()` for name resolution/history, and switch sites 1,2,5,6,7 to the active variant. Keep site 4 on the all-rows variant. Do **not** filter inside UI components.

---

### F2 — P1: Overview Habits card undercounts `completedToday` when more than 6 habits are scheduled

- `features/overview/overview.domain.ts:219` — `rings = scheduled.slice(0, 6)`
- `features/overview/overview.domain.ts:226` — `completedToday = rings.filter(ring => ring.count >= ring.target).length`
- `features/overview/overview.domain.ts:228` — `scheduledToday: scheduled.length` (uncapped)
- Rendered together at `features/overview/cards/HabitsCard.tsx:64`: "`{completedToday} of {scheduledToday} complete`".

What is wrong: the numerator is computed over the first 6 habits only while the denominator is the full scheduled count. With 7+ scheduled habits, completions on habits beyond the first 6 are invisible; e.g. 8 scheduled, habits #7 and #8 complete → card says "0 of 8 complete". Same defect in `progressRatio` (`overview.domain.ts:230-234`, divides by capped `rings.length`).

Why it matters: incorrect behavior on the primary dashboard summary; gets worse as users add habits.

Fix: compute `completedToday` over `scheduled` (all), not `rings`; keep `rings` capped purely as a display sample (and consider a "+N more" hint like ProjectsCard). Add the >6 case to `tests/overview.test.ts`.

---

### F3 — P1: "Habit completions" history semantics disagree across surfaces (deleted habits)

- `features/progress/progress.data.ts:133-137` — `SELECT COUNT(*) FROM habit_completions WHERE date_key BETWEEN …` — no join; completions of **soft-deleted** habits count.
- `features/activity/activityTimeline.data.ts:72-78` — joins `habits … WHERE h.deleted_at IS NULL` — completions of deleted habits **vanish from history**.
- `features/habits/habits.data.ts:520-529` `getAllHabitCompletions()` — joins `deleted_at IS NULL` (Habits screen consistency % drops deleted habits).
- `features/command/ask.retrieval.ts:252` — per-selected-habit filtering (neutral).

What is wrong: the same underlying fact ("a completion happened on date X") is counted by Progress but erased by Timeline after the habit is deleted. One of them is wrong; today it is undocumented which.

Why it matters: cross-surface numbers that cannot be reconciled erode trust in all stats; also a trap for the v20 paused/archived work (F1) which will inherit whichever rule is implicit here.

Fix: pick one canonical rule and encode it in the data layer. Recommendation: preserve history — Timeline should `LEFT JOIN habits` and render `"Completed \"<name>\""` with a fallback label for deleted habits instead of dropping rows; keep Progress as-is; document the rule next to `getAllHabitCompletions`. Alternatively exclude everywhere, but that rewrites visible history and should be an explicit product decision, not a side effect of a JOIN.

---

### F4 — P1: Ask `daily_overview` reports lifetime completed-Todo count as the date's completed count

- `features/command/ask.retrieval.ts:341` — `countCompletedTodos()` inside `retrieveDailyOverview(dateKey)`.
- `features/todos/todos.data.ts:152-161` — `countCompletedTodos()` has **no date bound** (`WHERE deleted_at IS NULL AND completed = 1`).

What is wrong: `DailyOverviewFacts.todos.completedCount` (`ask.types.ts:102`) is presented as part of a per-date overview (`"${facts.dateKey}: … ${facts.habits.completedCount} of …"` at `askParser.ts:383` uses habits, but todos.completedCount flows into remote phrasing and any future deterministic template). For any historical `dateKey` the number is the all-time total, not that day's completions — inconsistent with `overdueCount`, which *is* date-scoped via `countPendingTodos({ due: 'overdue', todayDateKey })` (`ask.retrieval.ts:343`).

Why it matters: the Ask contract states answers come from local facts; a date-scoped question getting a lifetime number is factually wrong and will be amplified by LLM phrasing.

Fix: add a date-bounded counter (e.g. `countTodosCompletedBetween(startUtcIso, endUtcExclusiveIso)` mirroring `progress.data.ts:115-126` which already has the correct predicate) and use it in `retrieveDailyOverview`. The existing test bakes in the wrong semantics (`tests/ask.retrieval.test.ts:253-297` mocks the lifetime count) — update it.

---

### F5 — P2: Activity timeline labels every completion-row update as "Completed", using `updated_at` as the event time

- `features/activity/activityTimeline.data.ts:79-89` — item time is `hc.updated_at`, title is always `` `Completed "${hc.name}"` ``.

What is wrong: `habit_completions.updated_at` changes on decrement (`habits.data.ts:456-459`) and on late increments to old `date_key` rows (`habits.data.ts:176-183`). A decrement or a backdated correction surfaces as a fresh "Completed …" event dated today; the row's true `date_key` is relegated to the subtitle.

Fix: prefer the row's `date_key` for day-bucketing (it is the authoritative local fact) and either suppress decrement-only updates (requires an operation marker — may not be worth it) or reword to neutral "Habit logged · <date_key>". At minimum, bucket by `date_key` so backdated edits land on the right day.

---

### F6 — P2: Activity timeline fetch window is anchored to the current time-of-day, not local midnight, and can drop items the domain range filter promises

- `features/activity/activityTimeline.data.ts:45-47` — `windowStart = new Date(Date.now() - (days-1)*86400000)`; `sinceIso = windowStart.toISOString()`.
- `features/activity/activityTimeline.domain.ts:85-93` — `filterTimelineByRange` cuts at **local midnight** of `todayKey − (days−1)`.

What is wrong: with the default 90-day fetch and the "90d" chip, an event at e.g. 00:10 local exactly 89 days ago is excluded by the fetch (`sinceIso` = 89 days ago at *now's* time-of-day) but included by the domain filter (midnight cutoff). The calorie query has the mirror-image off-by-one-day wobble because `sinceDateKey = toDateKey(windowStart)` depends on the current clock time.

Fix: anchor the fetch window to local midnight: `const start = dateKeyToLocalDate(toDateKey()); start.setDate(start.getDate() - (days - 1));` then reuse `getUtcIsoRangeForLocalDateKeys(startKey, todayKey)` (`lib/time.ts:40-55`) — the same primitive Progress already uses.

---

### F7 — P2: Overview has no error state; a failed first load renders fake "all clear" empty states

- `features/overview/OverviewScreen.tsx:142-147` — `catch { console.error(...) }`, summaries stay as `EMPTY_SUMMARIES` (`:63-78`), `isLoading` set false.
- Consequence: every card then shows its legitimate-empty copy — "All clear / No pending tasks", "Rest day", "No focus yet", "Nothing logged today" (`TodosCard.tsx:18-21`, `HabitsCard.tsx:56-60`, `FocusCard.tsx:18-25`, `CaloriesCard.tsx:18-25`) — after a SQLite/AsyncStorage failure. On subsequent failures, stale data is silently kept with no indication.

Fix: track `loadError` separately from empty; render a retryable error panel (pattern exists: `AskConversationView.tsx:133-155`). Do not render per-card empty copy unless the load succeeded.

---

### F8 — P2: Progress Insights and Activity Timeline conflate errors with empty state, swallow rejections, and never refresh while the hub stays open

- `features/progress/ProgressInsightsView.tsx:34-46` — `load` has no catch; `void load(windowDays)` produces an unhandled rejection; on failure `summary === null && !isLoading` renders "No progress data yet" (`:48-57`).
- `features/activity/ActivityTimelineView.tsx:64-77` — identical pattern → "Nothing to show yet" (`:143-149`).
- Neither uses `useActiveForegroundRefresh`/`dayGeneration` (contrast `OverviewScreen.tsx:150-156`, `PomodoroScreen.tsx:187`); they are conditionally mounted in `PlanningHubScreen.tsx:84-88`, so data reloads only on tab re-entry and goes stale across midnight or background mutations while the hub modal is open.

Fix: add try/catch + error state (as F7); refresh on `isActive`/day-generation via the shared hook, or accept a `refreshSignal` prop from PlanningHubScreen.

---

### F9 — P2: `hasAnyData` ignores the daily plan; empty-state CTA hardcodes Todos

- `features/overview/OverviewScreen.tsx:205-212` — gate omits `summaries.plan.hasPlan`.
- `features/overview/OverviewScreen.tsx:323-338` — "Nothing tracked yet / Add your first task" always navigates to `'todos'`.

What is wrong: a user whose only data is a committed plan with an intention (no pending todos/habits/etc.) is told "Nothing tracked yet". Minor, but it contradicts the Plan card rendered directly above the message.

Fix: include `summaries.plan.hasPlan` in the gate (and ideally vary the CTA target by the first non-empty domain).

---

### F10 — P2: Deterministic Ask fallback answers "overall" habit_progress with a single arbitrary habit

- `features/command/askParser.ts:362-366` — `deterministicAnswer` reads only `retrievedFacts.facts.habits[0]`, while `retrieveHabitProgress(null, …)` returns up to 50 habits (`ask.retrieval.ts:253-260`).

What is wrong: when the phrase stage fails/unavailable (offline, timeout — the exact conditions the fallback exists for), "How are my habits going?" is answered with one habit chosen by `listHabits()` ordering (`CATEGORY_ORDER, created_at DESC`, `habits.data.ts:70`), presented without scope qualification.

Fix: in fallback, summarize the set (e.g. count + best streak + list up to N names), or prefix "Only showing <name>" when scope is overall and length > 1.

---

### F11 — P2: Planning Ask retrieval surface is unwired and internally dead (`retrieveTodayFocus`, project/goal retrieval)

- `features/command/ask.retrieval.ts:410-495` (`retrieveProjectStatus`, `retrieveGoalProgressSummary`) and `:497-519` (`retrieveTodayFocus`) have **no runtime caller** — only `tests/ask.planningRetrieval.test.ts` exercises the formatters (`planningAsk.domain.ts`), and no intent routes to these retrievers (`askParser.ts:287-345` covers 7 intents; none planning).
- Within the dead path: `habitsRemainingCount` is hardcoded `null` (`ask.retrieval.ts:517`) and never read by `formatTodayFocusAnswer` (`planningAsk.domain.ts:31-42`); `topTodos` is built exclusively from pending todos so `completed` is always `false` and completed top priorities silently disappear (`ask.retrieval.ts:505-515`).

Why it matters: drift risk — when W6 wiring lands, these defaults ship as-is; the `completed:false` invariant is already misleading.

Fix: either wire the intents or mark the module `@internal/unwired`; populate `topTodos` from the plan's ids against **all** todos (completed flag from the row, not the source list); implement `habitsRemainingCount` via the same scheduled/target logic as `retrieveDailyOverview` (which will also make it respect F1).

---

### F12 — P2 polish (batch): small consistency nits in-area

- `features/overview/overview.domain.ts:230-234` — `progressRatio` is computed and tested (`tests/overview.test.ts:210`) but rendered nowhere (`HabitsCard` uses only counts/rings). Dead field; remove or use.
- `features/overview/overview.domain.ts:269-275` — private `toDateKeyFromIso` duplicates `timestampToLocalDateKey` (`lib/time.ts:32-34`); the "side effects" justification in the comment is inaccurate (lib/time is pure). Use the shared helper.
- `features/command/ask.retrieval.ts:354` — `timestampToLocalDateKey(habit.created_at)` without the invalid-date guard used everywhere else (`habits.data.ts:52-55` `safeTimestampToLocalDateKey`); a corrupt `created_at` yields `"NaN-NaN-NaN"` and poisons string comparisons in `isHabitScheduledOn`.
- `features/pomodoro/pomodoro.data.ts:136-142` — `listPomodoroSessions(limit = 20)` default is a silent truncation trap; no in-area caller uses it today, but its name invites unbounded-looking use (rename `listRecentPomodoroSessions` or force explicit limit).

---

## ANSWERS TO THE AUDIT QUESTIONS (condensed)

**(a) Habit aggregates:** enumerated exhaustively in F1's table (sites 1–7 in-area; adjacent consumers listed). Exclusion policy per site stated there; the canonical-rule decision of F3 must land first so "history vs current" is settled before v20.

**(b) Focus stats data sources:** (1) Overview FocusCard — `listPomodoroSessionsForDateRange(weekStart, today)` (`OverviewScreen.tsx:102`) → `shapeFocusWeekSummary` (`overview.domain.ts:246-267`, filters `session_type==='focus'`, buckets by local key of `started_at`); (2) PomodoroScreen — 364-day range (`PomodoroScreen.tsx:146-160`) → `computeFocusStats` (`pomodoro.domain.ts:423-484`) + `buildPomodoroHeatmapDays` (`:235-251`); (3) Progress — SQL `SUM/COUNT` with half-open UTC bounds (`progress.data.ts:141-165`); (4) Ask — `retrieveFocusSummary` (`ask.retrieval.ts:310-325`); (adjacent: weekly review, planning briefing). All four agree on `session_type==='focus'` and local-calendar bucketing — consistent. When association/note become durable columns (`pomodoro.sessionMeta.ts:11-12` moves into `pomodoro_sessions`): readers switch from AsyncStorage maps (`PomodoroScreen.tsx:154-159`, `RecentSessionsList`) to row columns; writers change `logPomodoroSession`'s signature; backup/portable/restore must carry the new columns (`backup.types.ts:153-160`, `backupValidators.ts:555`, `portableImport.ts:317`, `pomodoro.data.ts:189-213`); restore stops losing notes (registered-defect interaction); Ask focus facts and timeline items can later expose the associated todo.

**(c) Window/timezone handling:** Progress windows are the gold standard (local-midnight-derived half-open UTC bounds, DST-safe `setDate` arithmetic, unit-tested in `tests/progress.test.ts:34-40`). Overview week windows are safe (`buildDateRangeOldestFirst`). Two boundary defects: F6 (timeline rolling anchor) and the calorie-day wobble described there. `formatDayLabel` and `validateRange` are DST-safe via rounding. UNCERTAIN: whether the Playwright timezone matrix exercises the Planning Hub Progress/Timeline tabs — I did not verify the e2e project matrix for those views.

**(d) Overview cards empty/loading/error coherence:** loading skeleton and per-card empty states are coherent (`DashboardCard.tsx:97-99`); error states are absent (F7, F8); FocusCard's zero-fill synthesis at `OverviewScreen.tsx:176-190` is effectively unreachable post-load (harmless).

**(e) Command ask paths surfacing stale/paused state:** yes — F1 sites 5–7 (paused/archived habits in streaks/progress/daily overview once durable; today they already surface soft-deleted-related inconsistencies per F3/F4), F4 (lifetime completed count), F10 (lossy fallback), F11 (unwired planning retrievals with dead fields). Mutation-side interaction noted, not re-proved: `log_habit` resolution accepts any non-deleted habit (`command.review.ts:487-541`), so paused/archived habits remain command-loggable unless the v20 work adds a check.

---

## SCHEMA/SETTINGS INPUTS

1. **Durable habit lifecycle (v20)** — preferred shape: `habits.status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived'))` (or nullable `paused_at TEXT` / `archived_at TEXT`, mutually exclusive, archived wins). Nullability/default must keep pre-v20 rows `active`. Consumer sites: `listHabits` (+ new `listActiveHabits`), `shapeHabitsSummary` via `OverviewScreen.tsx:100`, `hasAnyData` (`OverviewScreen.tsx:207`), `progress.data.ts:128-139` (join + policy), `activityTimeline.data.ts:72-78` (keep history), `ask.retrieval.ts:155/227/344`, `command.review.ts:487`, `command.executor.ts:177`, `habitReminders.service.ts:195`, `linkedActionsTargetProviders.ts:86`, `weeklyReview.summary.ts:80`, `DailyPlanView.tsx:58`, `ProjectDetailView.tsx:70`. Note: backfill cannot be a pure SQL migration — existing AsyncStorage id sets must be reconciled once at app level (idempotent, owner-safe).
2. **Durable pomodoro session metadata (v20)** — `pomodoro_sessions.associated_todo_id TEXT NULL`, `associated_todo_title TEXT NULL` (snapshot mirrors `SessionAssociation`, `pomodoro.sessionMeta.ts:14-17`; snapshot avoids dangling references to soft-deleted todos), `note TEXT NULL` (≤500, mirrors `MAX_NOTE_LENGTH`). Consumers: `core/db/types.ts` `PomodoroSession`, bootstrap DDL + migration block in `core/db/client.ts`, `BACKUP_ENTITY_COLUMNS.pomodoro_sessions` (`core/backup/backup.types.ts:153-160`), validator rules (`core/backup/backupValidators.ts:555`), portable export/import types (`core/portable/`, `portableImport.ts:317`), `insertPomodoroSessionRecord`/`logPomodoroSession`/`applyRemotePomodoroSessions` (`pomodoro.data.ts:16-96,119-134,189-213`), `PomodoroScreen.loadHistory`/`RecentSessionsList`/`TodoAssociationPicker`/`SessionNotePrompt`.
3. **Settings allowlist candidate (product decision, flagging only):** overview card layout (`superhabits.overview.cardLayout`, `cardLayout.storage.ts:5`) is device-local and lost on restore/new device; if dashboard layout should survive Backup V4 restore, it needs a recoverable-settings V2 entry in `core/backup/backupSettings.ts` — otherwise document it as intentionally device-local like habit lifecycle.

## TEST COVERAGE GAPS

- `tests/overview.test.ts` — no case for >6 scheduled habits (F2 numerator cap); no case pinning paused/archived exclusion once `shapeHabitsSummary` gains a status input (F1).
- `tests/integration/progress.data.test.ts` (**missing file**) — `getProgressRawData`/`buildProgressSummary` against a real DB: deleted-habit completion counting rule (F3), date_key vs UTC-bound window alignment across a DST spring-forward weekend, and TZ-matrix run under `TZ=Asia/Manila` parity.
- `tests/activityTimeline.test.ts` — covers pure filters only; add data-layer tests for `buildActivityTimeline`: midnight-anchored window boundary (F6), deleted-habit history rule (F3), decrement/backdated-update labeling (F5), mixed `occurredAt` (bare date-key vs ISO) sort stability, per-source LIMIT merge/truncation.
- `tests/ask.retrieval.test.ts` — daily_overview test asserts the lifetime `completedCount` semantics (F4); replace with date-scoped expectations incl. a past-date case; add paused/archived exclusion cases for streak/progress/overview (F1); add invalid `created_at` robustness case (F12).
- `tests/askParser.test.ts` — no assertion on `deterministicAnswer` for overall-scope `habit_progress` with multiple habits (F10).
- `tests/ask.planningRetrieval.test.ts` — formatters tested but retrievers unwired; when F11 is resolved, add routing tests; until then a test asserting `retrieveTodayFocus` never returns `completed:true` documents the current limitation.
- E2E: no spec drives Planning Hub → Progress/Timeline error or stale-across-midnight behavior (F8); `e2e/journeys/past-midnight-freshness.spec.ts` covers sections but not these hub tabs (verify before adding, to avoid duplicating journey coverage).</subagent>
<subagent agent_id="agent-21" item="AREA 9 — PWA BEHAVIOR: Audit public/sw.js, core/pwa/**, service-worker registration/update banner components, connectivity indicator. Questions: (a) Full update lifecycle: waiting-worker detection, banner show conditions, apply-update handler, reload logic — any reload-loop risk? (b) Ignored-update resurfacing on next visit. (c) Cache versioning: current cache name(s), stranding risks when the shell version bumps; precache list correctness vs dist/ output. (d) Offline/online indicator implementation and edge cases. (e) What Playwright can verify against the dist/ static export served at http://localhost:8081 (service worker over plain http localhost); propose concrete spec outlines for: offline/online indicator, waiting-worker banner + apply-update single-reload, ignored-update resurfacing." outcome="completed">All evidence gathered. Here is the audit report.

---

# AREA 9 — PWA BEHAVIOR AUDIT REPORT

**Scope:** `public/sw.js`, `core/pwa/registerServiceWorker.ts`, `core/ui/UpdateAvailableBanner.tsx`, `core/ui/ConnectivityIndicator.tsx`, wiring in `app/_layout.tsx` / `core/providers/AppProviders.tsx`, e2e infrastructure specs, `scripts/serve-e2e.js`.
**Method:** direct source read + verification of `workbox-window@7.4.0` library internals (`node_modules/workbox-window/build/workbox-window.dev.mjs`) for event semantics. Nothing was modified; no mutating commands run.

## Verified baseline facts

- `public/sw.js:1-2` — `CACHE_VERSION = 'v4'`, cache name `superhabits-shell-v4`. Install precaches 6 URLs (`public/sw.js:10-17`); **no** `skipWaiting()` at install (deliberate, comment at :21-23); `SKIP_WAITING` handled via `message` (:26-30); activate deletes foreign caches + `clients.claim()` (:32-41); fetch handler: GET-only, localhost/127.0.0.1 bypass (`:48-51`), cross-origin passthrough (`:56`), cache-first with runtime put-on-ok (`:58-74`).
- `core/pwa/registerServiceWorker.ts` — Workbox wrapper; module-level listener sets; `waiting` → `updateListeners`, `controlling` → `appliedListeners`; `applyServiceWorkerUpdate()` posts SKIP_WAITING.
- `core/ui/UpdateAvailableBanner.tsx:22-26` — subscribes both events; **reloads unconditionally** on `controlling` (:23-26); dismiss is local state only (:79).
- `core/ui/ConnectivityIndicator.tsx:16-22` — NetInfo listener + initial `fetch()`; renders pill only when `!state.isConnected`.
- Registered once from `core/providers/AppProviders.tsx:59` (web-guarded inside the module).
- Default Playwright projects run with `serviceWorkers: 'block'` (`playwright.config.ts:85,99,146`); only `e2e/infrastructure.spec.ts:5` opts into `'allow'`.

---

## FINDINGS

### F1 [P1] Unconditional reload on every `controlling` event — first-visit auto-reload and cross-tab forced reload

- **Where:** `core/ui/UpdateAvailableBanner.tsx:23-26` (reload with no guard); `core/pwa/registerServiceWorker.ts:37-40` (event forwarded with no metadata); trigger enabled by `clients.claim()` in `public/sw.js:39`.
- **What is wrong:** The `appliedListeners` callback calls `window.location.reload()` whenever workbox-window dispatches `controlling`, regardless of cause. Verified in the library source: `_onControllerChange` "**Unconditionally dispatch[es]** the controlling event" (`workbox-window.dev.mjs:445-457`), and it fires for *any* `controllerchange`, including:
  1. **First visit:** page loads uncontrolled → worker installs → activates → `clients.claim()` → `controllerchange` → `controlling` (with `isUpdate: false`) → **the app reloads itself on a brand-new visitor's first load**, mid-bootstrap (OPFS SQLite init, account bootstrap in `AppProviders`). This is the classic clients.claim()/reload footgun; nothing in the repo guards it.
  2. **Other tabs:** tab A clicks Refresh → new worker activates and claims → every other open tab receives `controllerchange` and reloads without user consent, discarding in-progress UI state (half-typed todo text, command center draft). Note the `isExternal` flag does *not* reliably filter this: a tab that registered while the update was already waiting adopts the waiting worker as `_sw` (`workbox-window.dev.mjs:549-553`), so its own `controlling` event reports `isExternal: false, isUpdate: true`.
- **Why it matters:** Unsolicited reloads on first impression; interrupted DB bootstrap; silent loss of transient user input in secondary tabs. Not persistent-data corruption (SQLite writes are committed), hence P1 not P0.
- **No reload-loop risk in steady state (verified, not a defect):** on a fresh load that is already controlled, workbox resolves its controlling deferred silently without dispatching the event (`workbox-window.dev.mjs:536-539`), so the post-apply reload does not chain into another reload. Loop risk exists only if a future change reintroduces install-time `skipWaiting()` *plus* this handler — the current combination is loop-free.
- **Fix (root cause):** make the reload opt-in per page. Add a module-level `let applyRequested = false` in `registerServiceWorker.ts`, set it in `applyServiceWorkerUpdate()`, extend the applied-listener signature to pass `{ isUpdate, isExternal }` from the WorkboxEvent, and notify `appliedListeners` only when `applyRequested && event.isUpdate`. Reset `applyRequested = false` after notifying. In `UpdateAvailableBanner`, reload only inside that gated callback. Cross-tab tabs then simply never reload (they keep running the old shell until their own next load, which the new worker serves — acceptable and standard).

### F2 [P1] Served build is stale: `dist/sw.js` is still the v3 auto-`skipWaiting` worker, and `e2e/infrastructure.spec.ts` pins the literal `'v3'`

- **Where:** `dist/sw.js:1` (`CACHE_VERSION = 'v3'`) and `dist/sw.js:21` (`self.skipWaiting()` inside install) vs `public/sw.js:1` (`v4`) and the removed install-time skipWaiting; spec pin at `e2e/infrastructure.spec.ts:53` (`expect(swSource).toMatch(/CACHE_VERSION\s*=\s*['"]v3['"]/)`); doc drift in `AGENTS.md` ("`public/sw.js` uses cache name `superhabits-shell-v3`").
- **What is wrong:** HEAD (commit `c1016cc`, 2026-08-21) ships the v4 banner-driven flow in `public/`, but the last `expo export` (Aug 20) copied the older v3 worker into `dist/` and `dist-sync/`. Consequences:
  - The v3 assertion in `infrastructure.spec.ts:53` **passes today only against the stale build** and will fail on the next `npm run build:web` — exactly the brittleness predicted by prior audit OPS-001 (`docs/audit/DEEP_AUDIT_2026-07-12.md:182-197`; interaction noted, not re-proven).
  - Every PWA-behavior E2E run currently exercises the **old** update semantics (auto-activate, no banner path), i.e., the entire update-lifecycle surface is untested against the code that shipped.
- **Why it matters:** False green confidence; the next rebuild turns the infra suite red for a reason unrelated to the change under test; the banner flow (F1's code path) has zero effective coverage.
- **Fix:** (a) Rebuild `dist/` (and `dist-sync/` pipeline) so served artifacts match `public/`. (b) Replace the literal-version assertion with a build-freshness invariant: fetch `/sw.js` from the server and compare its `CACHE_VERSION` bytes against `public/sw.js` read from the repo at global-setup time (or assert equality of the whole file), so drift fails loudly with a "rebuild dist" message instead of a magic number. (c) Update the `AGENTS.md` cache-name mention to v4 or, better, to "versioned `superhabits-shell-<CACHE_VERSION>`" so it stops rotting.

### F3 [P2] Precache list omits the actual app shell payload (hashed entry JS/CSS, icon fonts, favicon), and install failures are swallowed wholesale

- **Where:** `public/sw.js:10-17` (precache list: `/`, `/index.html`, `/manifest.json`, 3 icons) vs actual export contents verified in `dist/`: `_expo/static/js/web/entry-91e2d7b8….js`, `_expo/static/css/web-716be49c….css`, `assets/node_modules/@expo/vector-icons/.../MaterialIcons.<hash>.ttf` (+18 more fonts), `favicon.ico`, `+not-found.html`. Blanket catch at `public/sw.js:18` (`.catch(() => Promise.resolve())`).
- **What is wrong:** The precached set does not include anything `index.html` needs to boot. Those assets are populated only lazily by the runtime cache-first handler (`public/sw.js:58-74`). Two consequences:
  1. **Post-update offline window:** activation deletes the old cache (`:37`) which held the previous hashed bundles; the new bundles enter the new cache only during the post-apply reload. If the network drops during/right after applying an update, the user has a precached new `index.html` referencing uncached bundles → dead shell until back online. For an offline-first product this is the one moment the design guarantees fragility.
  2. **All-or-nothing install that isn't:** `addAll` is atomic — one failed URL rejects the whole batch, and the catch converts that into "install succeeded with an empty/partial cache". A transient icon 404 yields an installed worker whose cache lacks even `index.html`.
- **Why it matters:** Offline-boot integrity is the product's headline promise; the current scheme makes it depend on runtime luck rather than install guarantees. (The broader "manual bump or users strand on old shells / unbounded runtime cache" issue is already registered as OPS-001 — this finding is the complementary *completeness* defect, not a re-proof.)
- **Fix:** Generate the precache manifest at build time — a small post-`expo export` step that walks `dist/`, collects `index.html`-referenced `_expo/static/**` assets + fonts + icons, and injects them (and a content-hash-derived `CACHE_VERSION`) into `sw.js` (`workbox-build injectManifest` or a ~30-line Node script). Until then, minimally: (a) fail the install (or retry per-URL) for the core shell URLs instead of blanket-catching, and (b) warm the entry bundle at install by fetching and caching whatever `index.html` references.

### F4 [P2] "Updating…" button can wedge permanently: `messageSkipWaiting()` is a silent no-op when no worker is waiting, and there is no fallback

- **Where:** `core/ui/UpdateAvailableBanner.tsx:60-67` (disable + label swap on `applying`), `core/pwa/registerServiceWorker.ts:70-76`; library behavior verified at `workbox-window.dev.mjs:679-683` — `messageSkipWaiting()` posts only `if (this._registration && this._registration.waiting)`, otherwise does nothing.
- **What is wrong:** If the waiting worker disappears between banner display and click (another tab applied it; worker went redundant; registration dropped), the click posts nothing, `controlling` never fires in this tab, and the button stays disabled reading "Updating…" forever. There is no timeout, no error path, no recovery affordance.
- **Why it matters:** A permanently disabled primary control on the exact screen whose job is recovery.
- **Fix:** After calling `applyServiceWorkerUpdate()`, start a modest timer (e.g., 10 s) that re-enables the button / falls back to `window.location.reload()` (a plain reload is safe: the browser will activate any waiting-or-active newest worker on next navigation). Clear the timer when the applied listener fires. Optionally have `applyServiceWorkerUpdate()` return a boolean (`!!registration?.waiting`) so the banner can immediately fall back when there is nothing to activate.

### F5 [P2] Localhost dev-bypass in the fetch handler makes the entire cache-serving path untestable in E2E and disables offline on localhost

- **Where:** `public/sw.js:47-51` — any request whose hostname is `localhost`/`127.0.0.1` is answered with a bare `fetch()` passthrough (no cache read, no cache write).
- **What is wrong:** The E2E static server (`scripts/serve-e2e.js`, default `http://localhost:8081`) and Metro dev share those hostnames, so in every Playwright run the worker registers, installs, precaches — and then never serves from or populates the runtime cache. Cache-first logic, offline shell loading, and post-update cache behavior are exercised **nowhere** in CI. It also means a developer (or user) literally on `http://localhost` has no offline capability. Port-based discrimination is impossible today because Metro dev and the E2E server both use 8081 (`playwright.config.ts:4`).
- **Why it matters:** The highest-risk logic in the SW (F3's stranding window lives exactly here) has zero executable coverage; production parity is unverified.
- **Fix (test-infra-contained, no product weakening):** have `scripts/serve-e2e.js` serve a patched `sw.js` — read `public/sw.js`, strip/neutralize the localhost-bypass block (e.g., replace with `const E2E_DISABLE_DEV_BYPASS = true;` honored by a one-line conditional in `sw.js`), and serve the result for `/sw.js`. Product keeps the dev bypass; E2E gains the real fetch handler. Alternative: move the E2E server off 8081 and narrow the bypass to `url.port === '8081'` — rejected here because it couples product code to a port convention. (True offline-navigation testing additionally needs `context.setOffline(true)`; see Test Coverage Gaps.)

### F6 [P2] No update check ever runs during long-lived sessions — installed-PWA users on a single-page app rarely trigger detection

- **Where:** `core/pwa/registerServiceWorker.ts:42` — the only update discovery is the implicit check inside `wb.register()` at page load; nothing calls `wb.update()` afterwards.
- **What is wrong:** Browsers check for SW updates on navigation/`sync`/`push` events and every ~24 h, but this is a single-page app: after the initial load there are no navigation requests, so a standalone-PWA window left open for days (the target usage for a habits app) never learns about a new worker, and the banner (even with F1 fixed) can't appear until the user manually restarts the app.
- **Why it matters:** Update adoption latency is unbounded precisely for the most engaged users.
- **Fix:** On web, call `void workboxInstance?.update()` when `document.visibilityState` transitions to `'visible'` (throttled to e.g. once/hour) from `registerServiceWorker.ts`. Cheap, uses the existing waiting→banner plumbing.

### F7 [P2] `caches.match()` without a `cacheName` searches every cache on the origin, including the incoming worker's partially-filled cache

- **Where:** `public/sw.js:59` (`caches.match(event.request)`), interacting with the install-time precache of the *new* cache (`:7-19`) and deletion-at-activate (`:37`).
- **What is wrong:** During the install/waiting window two caches coexist. The old (controlling) worker's `caches.match` iterates all caches in creation order, so duplicates (`/`, `/index.html`, icons) resolve to the **old** cache first — which is the desirable direction here, but only by accident of ordering, and the new cache is still consulted for keys the old one lacks (e.g., a just-deployed new bundle name), mixing versions within</subagent>
<subagent agent_id="agent-22" item="AREA 10 — RESTORE/PORTABLE/SYNC BOUNDARY: Audit core/backup/**, core/portable/**, core/sync/**, core/auth/**, simulation/backend/schema.sql, scripts/validate-supabase-schema.mjs. Questions: (a) Verify precisely: restoreFromRemoteBackupV2 import order and missing applyRemoteProjects/Goals/DailyPlans; confirmPortableImport entity coverage vs validated entities; weekly_reviews remote absence. Any OTHER validated-but-not-imported or imported-but-not-validated entities in either path? (b) Emptiness checks (isDeviceEmptyForRestore and portable eligibility): do they cover all 16 entities including planning tables? (c) Checksum/manifest implications of adding columns to BACKUP_ENTITY_COLUMNS (scope V5): exactly which historical artifacts must stay byte-stable (PORTABLE_V1_ENTITY_COLUMNS snapshot, scope epochs V2/V3/V4) and what a clean V5 epoch requires step by step. (d) Settings payload evolution to V3: canonical text field order, checksum certification chain, staged theme apply — enumerate every touch point file:line. (e) validate-supabase-schema.mjs: everything that must change for weekly_reviews + new columns; negative self-test coverage gaps. (f) simulation/backend/schema.sql drift vs supabase/migrations/*." outcome="completed">All evidence gathered. Here is the audit report.

---

# AREA 10 — RESTORE / PORTABLE / SYNC BOUNDARY AUDIT

Scope audited: `core/backup/**`, `core/portable/**`, `core/sync/**`, `core/auth/**`, `simulation/backend/schema.sql`, `scripts/validate-supabase-schema.mjs`, plus the consumer sides in `features/weekly-review`, `core/db/client.ts`, `core/providers/AppProviders.tsx` where the boundary contracts meet.

## Findings

### F1 — P0: Portable import validates 16 entities but imports only 12; weekly_reviews/projects/goals/daily_plans are silently dropped
- **Where:** `core/portable/portableImport.ts:291-322` (import block stops at `applyRemoteLinkedActionRules`; no calls for `weekly_reviews`, `projects`, `goals`, `daily_plans`) vs `core/portable/portableFormat.ts:274-301` (formatVersion 2 files *require* the exact 16-entity scope-4 set) and `core/portable/portableImport.ts:169-175, 393-395` (preview counts and `importedCounts` report all 16 entities).
- **What is wrong:** A scope-4 portable file cannot pass validation unless it contains all 16 entity arrays (`portableFormat.ts:286-300`). Every row of every entity is runtime-validated, checksum-verified, and graph-checked (`portableFormat.ts:319-329, 347-366, 411`). Then `confirmPortableImport` writes only 12 entities. The preview shows "Weekly reviews: N / Projects: N / Goals: N / Daily plans: N", the result reports `importedCounts` including those rows (`portableImport.ts:393-395`), and nothing tells the user 4 entity types were discarded.
- **Why it matters:** This is the offline recovery path. A user whose device is gone believes the import restored everything the preview listed. That is silent, unrecoverable data loss (the paper file is the only copy). It also violates the module's own contract ("imports everything atomically", `portableImport.ts:62-78`).
- **Fix:** Import what you validate. Add `applyRemoteWeeklyReviews(transactionDb, …)` (see F3 for its signature), and create `applyRemoteProjects` / `applyRemoteGoals` / `applyRemoteDailyPlans` in the respective `*.data.ts` layers following the existing `applyRemote*` pattern (take `db` first param, plain `INSERT OR REPLACE`, no side effects, no sync enqueue). Call them inside the `withSQLiteTransaction` in dependency order Projects → Goals → Todos/Habits → Daily Plans (matching the documented order in `core/backup/backup.types.ts:26-31`). Until the planning appliers exist, the honest interim option is to reject scope-4 files whose planning arrays are non-empty — but the real fix is importing.

### F2 — P0: Cloud Restore V2 fetches, validates, and integrity-verifies projects/goals/daily_plans, then never imports them
- **Where:** `core/backup/backupRestore.ts:356-367` (scope resolution returns all 16 entities for scope ≥ 4), `:373-385` (prefetch of every scope entity), `:388-403` (row validation), `:405-421` (manifest checksum verification), `:423-431` (graph check) — then `:542-563` imports only 13 entities; there are **no** `applyRemoteProjects/Goals/DailyPlans` functions anywhere in the repo (verified by grep over all `applyRemote*` definitions).
- **What is wrong:** Scope V4 grew the recoverable set (`core/backup/backup.types.ts:8-20, 32-49`) and the whole pre-import pipeline treats planning entities as first-class, but the import transaction omits them. Worse, `importedCounts` at `backupRestore.ts:620-624` maps over `BACKUP_ENTITIES`, so the UI reports projects/goals/daily_plans as restored with their fetched counts. Restored todos/habits carry `project_id`/`goal_id` (`BACKUP_ENTITY_COLUMNS.todos` includes them, `backup.types.ts:84-85`) pointing at projects/goals that were never written locally — dangling references on the restored device.
- **Why it matters:** Restore V2 is advertised as "the complete recoverable scope, atomically". A user recovering on a new phone loses all planning data while the UI says it restored. Same class as F1 but on the primary cloud path.
- **Fix:** Same as F1: implement the three planning appliers and call them inside the transaction at `backupRestore.ts` after `applyRemoteHabits` and before `applyRemoteDailyPlans`-after-todos ordering (parents first: projects → goals → (todos/habits already imported) → daily_plans). Additionally make `importedCounts` truthful (it becomes automatically truthful once the appliers run).

### F3 — P1: `applyRemoteWeeklyReviews` runs OUTSIDE the restore transaction, breaking the atomicity guarantee
- **Where:** `core/backup/backupRestore.ts:563` — `await applyRemoteWeeklyReviews(typed<WeeklyReview[]>('weekly_reviews'));` — compared with every sibling call that passes `transactionDb`. Root cause: `features/weekly-review/weeklyReview.data.ts:132` — `applyRemoteWeeklyReviews(reviews: WeeklyReview[])` takes no db parameter and calls `getDatabase()` internally (`:133`).
- **What is wrong:** All other imports happen on the transaction connection inside `withSQLiteTransaction` (`backupRestore.ts:524-595`). Weekly reviews are written on the singleton connection in autocommit. If anything later in the transaction throws (settings apply at `:570`, staging at `:571`, app_meta writes `:573-591`), the transaction rolls back but the weekly_reviews rows persist: the device is no longer empty, restore reports failure, and a retry is now blocked by `local_data_present`.
- **Why it matters:** Directly contradicts the documented invariant "ONE SQLite transaction import … Any failure leaves the local database untouched" (`backupRestore.ts:261-265`) and creates a half-restored corrupt state.
- **Fix:** Change the signature to `applyRemoteWeeklyReviews(db: SQLite.SQLiteDatabase, reviews: WeeklyReview[])` mirroring the other appliers, pass `transactionDb` at `backupRestore.ts:563`, and use it again for the portable path when F1 is fixed. Grep confirms the only caller today is the restore path, so the signature change is safe.

### F4 — P1: Scope epochs have no V4 registration; `resolveBackupScope` collapses every future scope into "current" — a V5 bump without epoch work bricks all existing backups and portable files
This is the concrete answer to question (c); three defects interact:

- **F4a — `resolveBackupScope` uses `>= BACKUP_SCOPE_VERSION`** (`core/backup/backup.types.ts:417-421`): any manifest with `backup_scope_version` above the running app's current value resolves as the *current* scope. When V5 ships, an old V4-era app reading a V5 manifest will resolve it to scope 4, verify with old columns, get `integrity_mismatch` — misclassifying "requires newer app" as "corrupt backup". 
- **F4b — Scope 4 is not a known historical epoch**: only V2/V3 sets exist (`backup.types.ts:376-394`). After bumping `BACKUP_SCOPE_VERSION` to 5, existing scope-4 manifests (explicit `backup_scope_version=4`, 16-entity metadata) match neither historical set nor the `>=` branch → `resolveBackupScope` returns null → restore returns `unsupported_version` ("unrecognized or partial recoverable scope", `backupRestore.ts:360-367`) and `getBackupStateSummary` flags every existing complete backup `invalid` (`backupRestore.ts:723-736`). Every backup taken before the V5 release becomes unrestorable.
- **F4c — Portable formatVersion 2 requires `backupScopeVersion === BACKUP_SCOPE_VERSION` exactly** (`core/portable/portableFormat.ts:276-285`): after a V5 bump, every previously exported portable file is rejected ("backup scope version 4, which this app cannot import"). Unlike V1 files, V2 files have no historical-scope branch.
- **Why it matters:** The campaign plans new durable columns for v20+, which is precisely the V5 trigger. Doing the column addition without the epoch machinery simultaneously breaks cloud restore for all pre-V5 manifests, marks healthy backups "invalid" in Settings, and permanently bricks all existing portable files.
- **Fix (clean V5 epoch, step by step):**
  1. Ship the remote migration(s) adding the new nullable columns FIRST (plus fixture + validator updates, see F12), because the adapter pushes `SELECT *` (F7) — new-app/old-remote breaks push otherwise.
  2. Freeze today's `BACKUP_ENTITY_COLUMNS` verbatim into a new snapshot constant (e.g. `BACKUP_SCOPE_V4_ENTITY_COLUMNS`) next to `PORTABLE_V1_ENTITY_COLUMNS` (`backup.types.ts:249`). Do not touch `PORTABLE_V1_ENTITY_COLUMNS`.
  3. Add `KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET` = exact copy of today's 16-entry `BACKUP_ENTITIES`.
  4. Rework `resolveBackupScope`: explicit `=== 4` match → `{scope: 4, V4 set}`; explicit `=== BACKUP_SCOPE_VERSION` → current; `> BACKUP_SCOPE_VERSION` → return null (so restores report `unsupported_version`, fixing F4a); entity-set fallback additionally matches the V4 set.
  5. Extend `backupEntityColumnsForScope` (`backup.types.ts:440-454`): `scope === 4` → frozen V4 columns; `>= current` → current columns; `< 4` → V1 snapshot (unchanged).
  6. Append the new columns to `BACKUP_ENTITY_COLUMNS` (append-only, at the end of each entity's array), add `optionalColumnRule`s in `backupValidators.ts` for nullable additions, keeping historical artifacts byte-stable (list below).
  7. Extend `validatePortableBackupFile`'s formatVersion-2 branch to accept `backupScopeVersion === 4` with the V4 entity set + frozen V4 columns (mirror the V1 branch at `portableFormat.ts:263-273`).
  8. Backfill/checkpoint: `ensureBackupBackfill` re-runs automatically (marker `< 5`, `backupBackfill.ts:145`); the done-set skip is fine because the adapter reads live rows at push time. Optionally set `backup.dirty='1'` during the scope-marker upgrade so a fresh scope-5 manifest publishes promptly; until then the remote keeps a valid scope-4 manifest, which the epoch machinery now verifies correctly.
- **Byte-stable artifacts that MUST NOT change** (the exact inventory asked for in (c)):
  - `PORTABLE_V1_ENTITY_COLUMNS` (`backup.types.ts:249-368`) — serves both V1 portable files and all scopes < current via `backupEntityColumnsForScope`.
  - `KNOWN_HISTORICAL_BACKUP_SCOPE_V2/V3_ENTITY_SET` (`backup.types.ts:376-394`).
  - `BACKUP_ENTITIES` positions 0–12 (ordering contract, `backup.types.ts:26-31`) — new entities append at the end only.
  - Canonical row serialization: `canonicalizeRow` / `checksumRows` JSON shape and id-sort (`lib/checksum.ts:129-157`).
  - Canonical settings text field order (`canonicalSettingsPayloadText`, `core/backup/backupSettings.ts:138-165`) — see F8 before touching.
  - Portable canonical payload layout (`core/portable/portableFormat.ts:26-48, 83-112`).
  - Remote `backup_manifest.entity_metadata` JSON of historical generations (immutable applied history — verification must use epoch-frozen columns, which is why step 5 exists).

### F5 — P1: Sync adapter upserts `SELECT *` — any new local column breaks push against an un-migrated remote
- **Where:** `core/sync/supabase.adapter.ts:178` (`SELECT * FROM ${entity} WHERE id IN (...)`) and `:190-193` (spreads the entire local row into the upsert payload; only `user_id` is replaced).
- **What is wrong:** The payload is not projected onto `BACKUP_ENTITY_COLUMNS`. The moment a v20 migration adds a local column, every push of that entity sends the new column to Supabase; if the remote migration has not been applied, PostgREST rejects with an unknown-column/schema-cache error, the entity's records fail (`:156-159`), the flush throws, and the checkpoint cycle defers (`core/backup/backupCheckpoint.ts:174-186`) — backup completeness silently stalls app-wide until the remote catches up.
- **Why it matters:** This turns the v20+ column work (this campaign) into a hard deployment-order coupling with zero defense in the client.
- **Fix:** Project rows onto the entity's canonical columns before upsert (reuse `canonicalizeRow`-style selection or map `BACKUP_ENTITY_COLUMNS[entity]`), so extra local columns ride only after the remote contract acknowledges them. This is additive, does not weaken any invariant, and decouples app releases from migration timing.

### F6 — P1 (interaction with the registered weekly_reviews defect): the missing remote table breaks three boundary flows beyond sync push
The defect "weekly_reviews has no Supabase table" is registered; these are the additional blast-radius points found in *this* area, not re-proofs:
- **Account coordinator fingerprinting throws:** `core/auth/accountCoordinator.ts:59` builds `ACCOUNT_REMOTE_BACKUP_ENTITIES` from all 16 `BACKUP_ENTITIES` + synthetic; `getRemoteFingerprint` (`:66-88`) does `if (error) throw error` per entity. On a remote without `weekly_reviews`, every protection/recovery flow that fingerprints (`:385`, `:522`) fails outright.
- **Cloud restore prefetch fails wholesale:** `restoreFromRemoteBackupV2` fetches every scope entity (`backupRestore.ts:373-385`); `.from('weekly_reviews')` on a missing table returns PGRST205 → `fetch_failed` → the *entire* restore is invalid even when the user has zero weekly reviews. `isMissingV2RemoteTableError` (`:200-213`) is only consulted for the manifest fetch, not entity fetches.
- **Manifest publication permanently deferred:** `saveWeeklyReview` enqueues (`features/weekly-review/weeklyReview.data.ts:66-71, 96-101`); the push fails per-entity, `flush()` throws, and `runMaintenanceCycle` returns before capture (`backupCheckpoint.ts:174-186`) — a device with ≥1 weekly review can never publish any completeness checkpoint (status stuck `in_progress`).
- **Fix direction:** create the `weekly_reviews` remote table (DDL proposed under SCHEMA/SETTINGS INPUTS) — that is the root-cause fix shared with the registered defect; additionally consider tolerating per-entity 404/PGRST205 in `getRemoteFingerprint` (count 0 + diagnostic) and in restore prefetch for entities outside the *certified* manifest generation, without weakening integrity checks for entities the manifest certifies.

### F7 — P2: Legacy V1 restore path imports remote rows with no runtime validation
- **Where:** `core/sync/restore.coordinator.ts:517-544` — fetches `todos`/`habits`/`calorie_entries` and feeds them straight into `applyRemoteTodos/Habits/CalorieEntries` inside the transaction; `validateBackupRow` is never invoked on this path (validators are only used in `backupRestore.ts` and `portableFormat.ts`).
- **Why it matters:** The validator docstring declares restored rows untrusted external input (`core/backup/backupValidators.ts:12-16`); the V1 path is the one remaining surface that violates it. Malformed remote rows land directly in SQLite.
- **Fix:** Run `validateBackupRow` per fetched row in the V1 path and abort as `invalid` on any failure (consistent with V2 semantics). Low effort; closes the last unvalidated import.
- **Related nit:** at `restore.coordinator.ts:536-540` an owner change inside the transaction is reported as `local_data_present` (reuses `localRowsAppeared`), mislabeling the blocked reason.

### F8 — P1 (for the planned V3): the settings certification chain has no historical-version acceptance path
Question (d) enumeration first — every touch point of the settings payload, canonical text, checksum chain, and staged theme apply:

**Contract & canonical text**
- Version constant: `core/backup/backup.types.ts:7` (`BACKUP_SETTINGS_VERSION = 2`); payload type `RecoverableSettingsV2` `:544-551`.
- Builder: `core/backup/backupSettings.ts:29-43` (`buildRecoverableSettings`).
- Normalizer (drops unknown keys, bounds slot keys/values to 100 chars): `backupSettings.ts:50-84`.
- Validator: `backupSettings.ts:86-107`.
- **Canonical text field order** (the exact string hashed): `backupSettings.ts:138-165` — top-level order `calorieGoal` → `pomodoroSettings` → `theme`; calorieGoal fields `calories, protein, carbs, fats`; pomodoro fields `focusMinutes, shortBreakMinutes, longBreakMinutes, sessionsBeforeLongBreak`; theme `{ mode, slots }` with slot keys sorted (`sortedEntries`, `:109-111`). Hash: `sha256Hex` via `canonicalizeSettingsPayload` `:128-130`.

**Certification chain (capture → push → verify)**
1. Capture inside the coherence transaction: `core/backup/backupCheckpoint.ts:242-243` (snapshot + checksum), manifest binds `settingsVersion` + `settingsMetadata {version, checksum}` `:256-257`; snapshot persisted to `backup.pending_settings` `:264-267`.
2. Push settings row from the captured snapshot (never fresh read): `core/sync/supabase.adapter.ts:204-240`; manifest push re-verifies the certified snapshot is still current and drops stale intents `:283-297`, re-uploads settings immediately before the manifest `:302-319`, then writes `backup_manifest` `:320-333`.
3. Cloud restore verify (all pre-write): manifest must carry settingsMetadata `backupRestore.ts:438-445`; row must exist `:446-464`; owner match `:465-472`; **triple version equality** `settingsRow.settings_version === BACKUP_SETTINGS_VERSION === manifest.settingsVersion === manifest.settingsMetadata.version` `:473-488`; validity `:489-496`; normalize + canonicalize + checksum compare `:497-508`.
4. Apply: SQLite-backed settings inside the transaction `backupRestore.ts:570` (`applyRecoverableSettingsToSqlite`, `backupSettings.ts:231-243`); portable equivalent `core/portable/portableImport.ts:327`.
5. Portable: canonical settings line in payload text `portableFormat.ts:109-110`; build `:144-145, 161`; verify version `:370-372` and checksum `:379-384`.

**Staged theme apply (AsyncStorage cannot join the SQLite transaction)**
- Stage durably inside the import transaction: `stagePendingThemeApplication` `backupSettings.ts:257-268`, called at `backupRestore.ts:571` and `portableImport.ts:328`; marker key `backup.pending_theme_apply` (`core/db/appMeta.ts:48`).
- Apply after commit: `backupRestore.ts:617`, `portableImport.ts:375`; crash-recovery retry at bootstrap: `core/providers/AppProviders.tsx:136-144`; marker cleared only on success: `backupSettings.ts:296-314`.

**The V3 trap:** every gate hard-requires `settings_version === BACKUP_SETTINGS_VERSION`. The moment the constant becomes 3, *all existing remote settings rows and manifests fail restore with `unsupported_version`* (`backupRestore.ts:473-488`) and all old portable files fail (`portableFormat.ts:370-372`) until each device republishes a checkpoint — i.e., old backups become unrestorable during the transition window, and old app versions fail closed against new checkpoints (acceptable direction, but classified only by version, which is fine).
- **Fix:** ship V3 with an epoch-aware reader: accept `settings_version === 2` by canonicalizing with a frozen V2 canonical text (same pattern as scope epochs; the V2 shape is exactly today's `canonicalSettingsPayloadText`), and require `version 3` canonicalization for version-3 payloads. Append any new keys at the **end** of the canonical object and only after the version gate so V2 text is byte-identical. `normalizeRecoverableSettings` already drops unknown keys, so applying a V3 payload under a V2-aware reader degrades safely if you choose "reject newer, tolerate older".

### F9 — P2: Dependency-graph validation ignores all planning relationships
- **Where:** `core/backup/backupValidators.ts:588-671` — `validateBackupGraph` checks habit completions, saved meals, workout chains, duplicate ids. It never checks `todos.project_id → projects.id`, `todos.goal_id → goals.id`, `goals.project_id → projects.id`, nor `daily_plans.top_todo_ids → todos.id`.
- **Why it matters:** Scope V4 made these foreign keys part of the certified scope (and the remote enforces composite owner FKs, `supabase/migrations/20260820010000_planning_schema_convergence.sql:63-65, 116-126`), so a tampered/inconsistent backup passes graph validation and then produces dangling references locally (F2's dangling refs would at least be *detected* here once implemented).
- **Fix:** Extend `validateBackupGraph` with the four checks (parent-must-exist semantics, tombstoned parents allowed, matching the existing style).

### F10 — P2: `getBackfillStatusForSummary` compares the scope marker against the wrong constant
- **Where:** `core/backup/backupRestore.ts:780` — `parseInt(scope.value, 10) >= BACKUP_SCHEMA_VERSION` (2), but the marker stores the *scope* version (currently 4) and the writer gates on `BACKUP_SCOPE_VERSION` (`core/backup/backupBackfill.ts:145`).
- **Why it matters:** After any scope bump, a device whose backfill status key was lost reports `complete` from a stale low scope value; the UI can show a complete/no-backfill-needed state while a scope backfill is actually owed. Cosmetic today (the writer path is correct) but it is the exact line a V5 change must not forget.
- **Fix:** Use `BACKUP_SCOPE_VERSION` at `backupRestore.ts:780`.

### F11 — P2: `TABLES_WITH_DELETED_AT` omits `weekly_reviews`
- **Where:** `core/auth/account.data.ts:11-22` — `weekly_reviews` has a `deleted_at` column (`core/db/client.ts:513`) but falls into the plain-count branch (`account.data.ts:49-52`), so `deleted` is always 0 and soft-deleted reviews count as active.
- **Why it matters:** Emptiness verdicts stay correct (total > 0 still blocks restore), but `deletedUserDataCount`/per-table splits are wrong for this table, and any future logic keyed on "only tombstones remain" will misbehave for weekly reviews.
- **Fix:** Add `'weekly_reviews'` to the set at `account.data.ts:11`.

### F12 — P1: `validate-supabase-schema.mjs` has zero `weekly_reviews` coverage and its negative self-tests do not exercise the real checks
Question (e) inventory — everything that must change:
- **Table coverage:** `weekly_reviews` appears in none of `syncTables` / `backupTables` / `planningTables` (`scripts/validate-supabase-schema.mjs:9-21, 490`), so nothing requires its CREATE TABLE, RLS, four owner policies, owner FK/index, grants, or fixture mirror. It must be added as a full citizen (table + RLS + 4 policies + owner predicate + `idx_weekly_reviews_user_id` + revoke/grant + fixture checks), ideally in the `backupTables` group once the migration exists.
- **Column coverage:** `backupRequiredColumns` (`:248-263`) and `requiredColumns` (`:302-307`) need `weekly_reviews` entries (`week_key`, `week_start_date`, `week_end_date`, `next_week_start_date`, `completed_at`, `status`, `summary_payload`, `plan_payload`, `reflection`, `deleted_at`) and, for each V5 column, corresponding entries in both migration and fixture assertions.
- **Negative self-test gap:** the only negative test, `expectPlanningRejection` (`:634-655`), re-implements its own inline `badReq` lambda — it proves the lambda rejects a bad string, not that the script's actual `requireText`/`reqAbsent` checks would catch a mutated fixture/migration. The script is structured as top-level side effects, so it cannot be fed variants.
- **Parity gap:** the validator spot-checks individual columns but has no systematic fixture↔migration column/policy parity, which is why the drifts in F13 are invisible to it.
- **Fix:** refactor the script into an exported `validate(inputs)` returning failures (CLI wrapper prints/exits), then add self-tests (Vitest can import the `.mjs`) that feed: a fixture missing `weekly_reviews`, a policy `TO anon`, a global `USING (true)`, a reintroduced global `saved_meals` unique, a manifest without `settings_metadata`/`backup_scope_version` — each asserted to fail. Add a parity check that diffs `CREATE TABLE` column lists between `simulation/backend/schema.sql` and the union of migrations.

### F13 — P2: `simulation/backend/schema.sql` drifts from `supabase/migrations/*` in constraint strictness (disposable lane is more permissive than production)
Question (f) diff results:
- **Missing composite owner FKs in fixture:** production has `habit_completions_habit_owner_fkey` (`20260815100000_add_backup_completeness_v2.sql:46-48`), `routine_exercises_routine_owner_fkey` (`:73-75`), `routine_exercise_sets_exercise_owner_fkey` (`:91-93`), `workout_logs_routine_owner_fkey` (`:105-107`), `workout_session_exercises_log_owner_fkey` (`:120-122`), plus planning FKs `goals_project_owner_fkey` and todos/habits project/goal FKs (`20260820010000_planning_schema_convergence.sql:63-65, 116-126`). The fixture (`simulation/backend/schema.sql:153-162, 174-213, 197-204, 444-490`) has none of them.
- **Missing owner-pair uniqueness indexes** that those FKs require: `uq_habits_id_user`, `uq_workout_routines_id_user`, `uq_routine_exercises_id_user`, `uq_workout_logs_id_user` (v2 migration `:33-35, 79-80, 111`) and `uq_projects_id_user`, `uq_goals_id_user` (planning migration `:47, 72`). Absent from fixture.
- **Index shape drift:** fixture owner indexes are single-column `(user_id)` (`schema.sql:274-289`) vs migration `(user_id, created_at, id)` (v2 migration `:49-50` etc.). Cosmetic but undetectable by the validator.
- **Type drift:** fixture `saved_meals` macros are `DOUBLE PRECISION` (`schema.sql:220-223`) vs migration `REAL` (float4, v2 migration `:130-133`). UNCERTAIN impact: float4 rounding could alter canonical JSON text for high-precision macro values and flip a restore integrity check; typical values round-trip cleanly. Worth normalizing to `REAL` for exactness.
- **`weekly_reviews` absent from both sources** (consistent with each other, divergent from the app contract — covered by F6).
- **Stale doc:** `simulation/backend/DRIFT.md:18-38` still says the fixture covers "the four synced tables" and that non-synced tables "intentionally have **no** remote counterpart" — both false since the V2/planning sections were added.
- **Why it matters:** the disposable lane accepts cross-owner/cross-parent rows production rejects, so remote-boundary journeys can pass in sim while failing against prod (and mask FK-ordering issues like backfill enqueueing `todos` at position 0 before `projects` at position 13 — a transient composite-FK violation on first backfill of linked data, self-healing on the next flush but delaying completeness).
- **Fix:** mirror the FKs + `uq_*_id_user` indexes in the fixture, align index columns and `REAL` types, update DRIFT.md's snapshot section, and let the F12 parity test hold the line.

### F14 — P2: Stale contract comments that will mislead the v20/V5 work
- `core/auth/accountCoordinator.ts:54` — "Covers all `BACKUP_ENTITIES` (12 table-backed entities)" — now 16.
- `core/db/client.ts:523-527` (migration 17 comment) — claims planning entities "are NOT registered in the remote backup/sync/restore/portable contracts" — false since scope V4 (`backup.types.ts:8-20`); the *restore* gap (F2) makes it accidentally half-true, which is worse.
- Fix both comments as part of the touching commits.

## Answers to the specific questions (summary)

- **(a)** Import order in Restore V2 is `backupRestore.ts:542-563`: todos → habits → habit_completions → calorie_entries → saved_meals → workout_routines → routine_exercises → routine_exercise_sets → workout_logs → workout_session_exercises → pomodoro_sessions → linked_action_rules → weekly_reviews (the last one outside the transaction, F3). `applyRemoteProjects/Goals/DailyPlans` do not exist; planning entities are **validated-but-not-imported** (F2). Portable path: **validated-but-not-imported** = weekly_reviews, projects, goals, daily_plans (F1). **Imported-but-not-validated**: the legacy V1 path imports todos/habits/calorie_entries with no row validation (F7). No entity is imported without validation in the V2/portable paths.
- **(b)** Yes — emptiness is complete. `ACCOUNT_USER_TABLES` (`core/auth/account.types.ts:3-22`) covers all 16 backup entities **plus** `linked_action_events`/`linked_action_executions`; `isDeviceEmptyForRestore` (`backupRestore.ts:249-258`) additionally requires a fully-owned, empty outbox; both restore paths and portable eligibility re-check inside their transactions (`backupRestore.ts:527-536`, `portableImport.ts:268-285`). Only defect: the active/deleted split for `weekly_reviews` (F11).
- **(c)** See F4 (defects + clean V5 epoch steps + byte-stable artifact inventory).
- **(d)** See F8 (full touch-point enumeration file:line, canonical field order, certification chain, staged-theme lifecycle, and the V3 historical-version requirement).
- **(e)** See F12.
- **(f)** See F13.

## SCHEMA/SETTINGS INPUTS

What this area needs from the v20+/V5/V3 work (proposed names/types/nullability + consumer sites):

1. **New durable columns (per entity E, per column C)** — each needs all seven touch points, or push/restore breaks (F5, F4):
   - Local migration: `addColumnIfMissing(db, E, C, '<TEXT|INTEGER>')` in a new `if (version < 20)` block (`core/db/client.ts`).
   - `BACKUP_ENTITY_COLUMNS[E]` — **append at end** (`core/backup/backup.types.ts:70-236`).
   - Validator rule: `optionalColumnRule(C, …)` in `core/backup/backupValidators.ts` (nullable additions must tolerate absence for historical rows).
   - Remote migration: `ALTER TABLE public.E ADD COLUMN IF NOT EXISTS C <TEXT|INTEGER>` (nullable; TEXT matches SQLite ISO-text timestamps per `lib/checksum.ts:18-20`).
   - Fixture: same column in `simulation/backend/schema.sql`.
   - Validator script: entry in `backupRequiredColumns`/`requiredColumns` (`scripts/validate-supabase-schema.mjs:248-269, 302-307`).
   - Frozen snapshots: `PORTABLE_V1_ENTITY_COLUMNS` and the new V4 snapshot must **not** receive the new columns.
2. **`weekly_reviews` remote table (root-cause fix shared with F6).** Proposed DDL shape, matching the established pattern: `id TEXT PRIMARY KEY`, `user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE`, then exactly the `BACKUP_ENTITY_COLUMNS.weekly_reviews` columns (`core/backup/backup.types.ts:179-193`): `week_key TEXT NOT NULL, week_start_date TEXT NOT NULL, week_end_date TEXT NOT NULL, next_week_start_date TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, summary_payload TEXT NOT NULL, plan_payload TEXT NOT NULL, reflection TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT`; plus `UNIQUE (week_key)` is **local-only partial** — remotely use a partial unique index `(user_id, week_key) WHERE deleted_at IS NULL` if desired (note the local index `idx_weekly_reviews_week_key` is *not* owner-scoped because local is single-owner), `idx_weekly_reviews_user_id`, RLS + 4 owner policies + revoke/grant identical to the V2 tables, mirrored in fixture + validator. Consumer sites: `SupabaseSyncAdapter.push` (via `SYNCABLE_ENTITIES`), `getRemoteFingerprint`, `fetchRemoteRows` in restore.
3. **Settings V3 keys:** none required by this area. Constraints if keys are added: keep values within the normalizer's bounds (strings ≤ 100 chars for theme slots, `backupSettings.ts:68-78`), extend `RecoverableSettingsV2` + `buildRecoverableSettings` + `normalizeRecoverableSettings` + `canonicalSettingsPayloadText` (new fields appended **last** in the canonical object), and follow the epoch-aware version reader from F8. Marker/app_meta keys needing no change: `backup.pending_settings`, `backup.pending_theme_apply` (`core/db/appMeta.ts:47-48`).
4. **Planning appliers (new code this area owes the features):** `applyRemoteProjects(db, rows)`, `applyRemoteGoals(db, rows)`, `applyRemoteDailyPlans(db, rows)` in `features/*/ *.data.ts`, plus converting `applyRemoteWeeklyReviews` to take `db` first (F3). Consumers: `core/backup/backupRestore.ts`, `core/portable/portableImport.ts`.

## TEST COVERAGE GAPS

Required tests that do not exist today (verified against `tests/`, `tests/integration/`, `core/sync/__tests__/`, `e2e/`):

1. **`tests/integration/backupRestore.test.ts`** — scope-4 manifest with non-empty `projects`/`goals`/`daily_plans` asserts all three are imported and `importedCounts` matches reality (red today; proves F2 fix). Also: restored `todo.project_id` resolves to an imported project row.
2. **`tests/integration/backupRestore.test.ts`** — atomicity of the weekly_reviews import: force a failure after the weekly_reviews step (e.g., throwing settings hook) and assert `weekly_reviews` is empty after the failed restore (proves F3 fix).
3. **`tests/integration/portableExportImport.test.ts`** — export→import round-trip of a dataset containing weekly_reviews/projects/goals/daily_plans rows; assert DB rows exist post-import and preview counts equal `importedCounts` (proves F1 fix).
4. **`tests/portableFormat.test.ts`** — epoch matrix for `validatePortableBackupFile`: formatVersion 2 + `backupScopeVersion` 4 accepted after the V5 bump using frozen V4 columns; golden byte-stability vectors proving a scope-4 file's `payloadChecksum` verifies identically before/after the V5 code change; V1 files unaffected.
5. **`tests/backupManifest.test.ts`** (or `tests/integration/backupCheckpoint.test.ts`) — `resolveBackupScope` matrix: null/2/3/4/5/6 inputs, including "future scope version → null → restore reports `unsupported_version`, not `integrity_mismatch`" (F4a) and "existing scope-4 manifest still verifies after bump" (F4b).
6. **`tests/backupValidators.test.ts`** — planning graph checks: `todos.project_id`/`goal_id`, `goals.project_id`, `daily_plans.top_todo_ids` referencing missing parents are rejected; tombstoned parents tolerated (F9). Plus rules for each new V5 column.
7. **`tests/restore.coordinator.test.ts`** — legacy V1 path rejects malformed remote rows instead of importing them (F7), and owner-change-inside-transaction reports `owner_mismatch`, not `local_data_present`.
8. **`tests/account.coordinator.test.ts`** (or `tests/accountSupabaseMock.contract.test.ts`) — `getRemoteFingerprint` behavior when one entity's select errors (PGRST205): define and assert the required outcome (fail-closed today; propose count-0 + diagnostic) so the weekly_reviews gap cannot silently break protection/recovery (F6).
9. **New `tests/supabaseSchemaValidator.test.ts`** — after refactoring `scripts/validate-supabase-schema.mjs` into an importable `validate()`: mutated-input self-tests (fixture missing `weekly_reviews`; policy `TO anon`; `USING (true)`; reintroduced global `saved_meals` unique; manifest without `settings_metadata`/`backup_scope_version`) each asserted to fail (F12).
10. **New `tests/integration/backendFixtureParity.test.ts`** — parse `CREATE TABLE` column lists from `simulation/backend/schema.sql` and `supabase/migrations/*.sql`, assert fixture ⊇ migration columns per table (would have caught F13 automatically).
11. **`e2e/journeys/new-phone-v2.spec.ts`** — extend the restore journey to include planning entities + weekly reviews in the backed-up dataset once F1/F2 land, so the E2E layer locks the fixed behavior end-to-end.

UNCERTAIN items flagged inline: the float4/float8 checksum edge (F13) and whether the *live* Supabase project has a hand-created `weekly_reviews` table (repo sources show none; DRIFT.md:14-15 explicitly notes the live project is unverified from this workstation).</subagent>
</agent_swarm_result>