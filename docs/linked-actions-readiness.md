# Linked Actions Readiness

## 1. Executive Summary

SuperHabits is ready for a safe Version 1 of Linked Actions only if it is implemented as a new centralized engine with explicit trigger/effect registries, persistent execution metadata, and idempotent target wrappers.

The codebase already has clear per-feature write boundaries:

- `features/*/*.data.ts` owns SQLite writes.
- `*Screen.tsx` owns user orchestration.
- `core/` already contains centralized infrastructure patterns (`getDatabase()`, `syncEngine`, `AppProviders`).

The codebase is not ready for cross-feature triggering through direct reuse of existing mutators:

- `toggleTodo()` toggles, it does not "complete once".
- `incrementHabit()` always increments.
- `addCalorieEntry()`, `completeRoutine()`, `logWorkoutSession()`, and `logPomodoroSession()` always create rows.
- `SyncEngine` is in-memory only and has no dedupe, chain metadata, or persistence.

Safe V1 should therefore:

- keep source feature modules unaware of target feature modules,
- emit normalized source events into a central Linked Actions engine,
- execute target effects through guarded per-feature effect wrappers,
- persist chain, execution, and notification metadata in SQLite,
- allow bidirectional links as paired rules, but never re-trigger from engine-originated writes.

That last rule is the simplest way to satisfy "bidirectional safely": users can link A -> B and B -> A, but an automated write from the engine must not create another trigger wave.

## 2. Source Action Map

This section lists current action origins from actual code. "Recommended V1 triggers" is the safe subset that maps cleanly to Linked Actions without broad refactors.

### Todos

Current write entrypoints:

- `TodosScreen.onSave` -> `addTodo()` for create.
- `TodosScreen.onSave` -> `updateTodo()` for edit.
- `TodoItem.onToggle` -> `toggleTodo()`.
- `TodoItem.onDelete` -> `removeTodo()`.
- `DraggableFlatList.onDragEnd` -> `updateTodoOrder()`.
- `TodosScreen.loadTodosOnFocus` can auto-create recurring instances through `createRecurringInstance()`.

Observations:

- `toggleTodo()` also creates the next recurring instance for daily todos when a task becomes complete.
- recurring instance creation is system-generated, not a user intent source event.

Recommended V1 trigger surface:

- `todo.completed` when `completed` changes `0 -> 1`.

Do not use in V1:

- reorder,
- edit,
- delete,
- recurring instance auto-creation,
- reopen (`1 -> 0`) unless product explicitly wants reverse semantics.

### Habits

Current write entrypoints:

- `HabitsScreen.onSubmit` -> `addHabit()` or `updateHabit()`.
- `HabitCircle.onPress` -> `incrementHabit()`.
- `HabitCircle.onLongPress` -> `decrementHabit()`.
- edit mode delete button -> `deleteHabit()`.

Observations:

- progress is stored in `habit_completions`, not on `habits`.
- `incrementHabit()` and `decrementHabit()` are not synced and are keyed by `habit_id + date_key`.
- decrementing from `1` hard-deletes the completion row by design.

Recommended V1 trigger surface:

- `habit.progress_incremented` after a successful increment.
- `habit.completed_for_day` when post-write count reaches or exceeds `target_per_day`.

Do not use in V1:

- decrement as a trigger,
- habit create/update/delete as linked triggers.

### Calories

Current write entrypoints:

- `CaloriesScreen.handleSubmit` -> `addCalorieEntry()` or `updateCalorieEntry()`.
- swipe delete -> `deleteCalorieEntry()`.
- `CalorieGoalModal.onSave` -> `setCalorieGoal()`.
- `SavedMealSearchModal` long press -> `deleteSavedMeal()`.

Observations:

- `addCalorieEntry()` and `updateCalorieEntry()` also call `upsertSavedMeal()`.
- saved meals are the only reusable nutrition template entity already present in the schema.

Recommended V1 trigger surface:

- `calorie.entry_logged` on create only.

Do not use in V1:

- calorie goal changes,
- saved meal deletion,
- entry update/delete.

### Workout

Current write entrypoints:

- `WorkoutScreen.onCreate` -> `addRoutine()`.
- routine swipe delete -> `deleteRoutine()`.
- "Complete workout" button -> `completeRoutine()`.
- `WorkoutSessionScreen.handleFinish` -> `logWorkoutSession()`.
- `RoutineDetailModal` mutates routine structure through `addExercise()`, `deleteExercise()`, `addDefaultSet()`, `updateSet()`, `deleteSet()`.

Observations:

- workout has two completion paths today:
  - fast log: `completeRoutine()`,
  - structured session log: `logWorkoutSession()`.
- nested routine edits update the parent routine timestamp and enqueue the parent routine for sync.

Recommended V1 trigger surface:

- `workout.completed` for both `completeRoutine()` and `logWorkoutSession()`.

Do not use in V1:

- routine structure edits,
- routine create/delete.

### Pomodoro

Current write entrypoints:

- `PomodoroScreen.handleSaveSettings` -> `savePomodoroSettings()`.
- `PomodoroScreen` timer completion flow -> `logPomodoroSession()`.

Observations:

- `logPomodoroSession()` is only called after a completed focus session, not for breaks.
- the source action is screen-driven state machine logic, not a reusable data-layer wrapper yet.
- `lib/notifications.ts` is only used for local timer-end OS notifications.

Recommended V1 trigger surface:

- `pomodoro.focus_completed` after a successful `logPomodoroSession()` call.

Do not use in V1:

- settings changes,
- pause/resume/reset.

## 3. Target / Effect Map

This section lists which target mutations exist today and how they can safely map into Linked Actions effects.

### Todos

Current writable state:

- `completed` flag on an existing todo.
- create/edit/delete/reorder.

Safe Linked Actions target:

- `binary_complete` on an existing todo.

Implementation note for later:

- do not call `toggleTodo()` from the engine.
- add a dedicated idempotent wrapper such as `completeTodoIfNeeded(todoId, originMeta)`.

### Habits

Current writable state:

- daily progress count in `habit_completions`.
- create/edit/delete habit definitions.

Safe Linked Actions targets:

- `progress_increment` for today's count.
- `progress_set` / `progress_ensure_at_least` for "complete habit today".

Implementation note for later:

- do not call raw `incrementHabit()` unless guarded by execution dedupe.
- add a dedicated wrapper that can:
  - increment once for a specific source event, or
  - ensure count is at least `target_per_day`.

### Calories

Current writable state:

- create/update/delete `calorie_entries`.
- create/update/delete/search `saved_meals`.
- set global calorie goal.

Safe Linked Actions targets:

- `log_create` -> create `calorie_entries` rows from a saved-meal template or link-local macro payload.

Best target object for V1:

- `saved_meals` row, because it is already the app's reusable nutrition template entity.

### Workout

Current writable state:

- create/delete routine definitions,
- edit nested exercises and sets,
- create `workout_logs`,
- create `workout_session_exercises` through session logging.

Safe Linked Actions target:

- `log_create` -> create a workout completion log for a target routine.

Best target object for V1:

- existing `workout_routines` row.

Prefer in V1:

- a single linked-actions wrapper around the simpler `completeRoutine()` behavior,
- optional notes payload from the link.

### Pomodoro

Current writable state:

- save one global settings blob,
- create `pomodoro_sessions` rows.

Safe Linked Actions target:

- `log_create` -> create a pomodoro session row.

Important current limitation:

- Pomodoro has no reusable target entity comparable to todos, habits, routines, or saved meals.

Safe V1 recommendation:

- store a pomodoro session template directly on the link payload:
  - `session_type`,
  - `duration_seconds`,
  - optional label for UI.

Do not add a new Pomodoro entity table for V1 unless product specifically needs reusable templates across many links.

## 4. Proposed Linked Actions Data Model

Safe V1 needs three persistent tables.

### `linked_action_rules`

Purpose:

- stores the explicit user-defined rules.

Suggested columns:

- `id TEXT PRIMARY KEY`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `deleted_at TEXT`
- `status TEXT NOT NULL` (`active`, `paused`)
- `bidirectional_group_id TEXT NULL`
- `source_feature TEXT NOT NULL`
- `source_entity_type TEXT NOT NULL`
- `source_entity_id TEXT NOT NULL`
- `source_trigger_type TEXT NOT NULL`
- `target_feature TEXT NOT NULL`
- `target_entity_type TEXT NOT NULL`
- `target_entity_id TEXT NULL`
- `effect_type TEXT NOT NULL`
- `effect_payload TEXT NOT NULL` (JSON)
- `ui_label TEXT NULL`

Notes:

- `target_entity_id` is nullable because Pomodoro can use a link-local template payload.
- `bidirectional_group_id` groups two separate rules that the UI presents as one paired link.

### `linked_action_events`

Purpose:

- stores normalized trigger events for auditability, retries, dedupe, and notification copy.

Suggested columns:

- `id TEXT PRIMARY KEY`
- `chain_id TEXT NOT NULL`
- `root_event_id TEXT NOT NULL`
- `occurred_at TEXT NOT NULL`
- `origin_kind TEXT NOT NULL` (`user`, `linked_action`, `system`)
- `origin_link_id TEXT NULL`
- `origin_event_id TEXT NULL`
- `source_feature TEXT NOT NULL`
- `source_entity_type TEXT NOT NULL`
- `source_entity_id TEXT NOT NULL`
- `source_trigger_type TEXT NOT NULL`
- `source_record_id TEXT NULL`
- `date_key TEXT NULL`
- `payload TEXT NOT NULL` (JSON)

Notes:

- `source_record_id` is useful for log-style events like calorie/workout/pomodoro.
- `origin_kind` is the core loop-prevention flag.

### `linked_action_executions`

Purpose:

- stores one execution result per `(rule, source_event)` and carries produced row IDs for log effects.

Suggested columns:

- `id TEXT PRIMARY KEY`
- `rule_id TEXT NOT NULL`
- `source_event_id TEXT NOT NULL`
- `chain_id TEXT NOT NULL`
- `effect_fingerprint TEXT NOT NULL`
- `status TEXT NOT NULL` (`applied`, `skipped`, `failed`)
- `produced_entity_type TEXT NULL`
- `produced_entity_id TEXT NULL`
- `notification_id TEXT NULL`
- `error_message TEXT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Suggested uniqueness:

- `UNIQUE(rule_id, source_event_id)`

This is the minimum durable dedupe key.

### Optional `linked_action_notifications`

If product wants persistent inbox history separate from execution rows, add:

- `id`
- `execution_id`
- `status`
- `title`
- `body`
- `target_href`
- `target_feature`
- `target_entity_type`
- `target_entity_id`
- `read_at`
- `dismissed_at`
- `created_at`

If minimalism matters more than query clarity, notification data can live on `linked_action_executions` instead.

## 5. Proposed Execution Architecture

### High-level flow

1. A whitelisted source action succeeds in its owning feature.
2. That source point emits a normalized event to `linkedActionsEngine.handleSourceEvent(...)`.
3. The engine persists a `linked_action_events` row.
4. The engine finds matching active rules for that exact `(source_feature, source_entity_id, source_trigger_type)`.
5. For each rule, the engine tries exactly one execution for `(rule_id, source_event_id)`.
6. The engine dispatches to a target effect handler from a central registry.
7. The handler performs an idempotent write or no-op.
8. The engine persists the execution result and creates a tappable in-app notification when appropriate.

### Proposed module layout

Suggested new structure:

- `core/linked-actions/linked-actions.types.ts`
- `core/linked-actions/linked-actions.data.ts`
- `core/linked-actions/linked-actions.engine.ts`
- `core/linked-actions/trigger-registry.ts`
- `core/linked-actions/effect-registry.ts`
- `core/linked-actions/notifications.data.ts`

Suggested target handlers:

- `features/todos/todos.linked-effects.ts`
- `features/habits/habits.linked-effects.ts`
- `features/calories/calories.linked-effects.ts`
- `features/workout/workout.linked-effects.ts`
- `features/pomodoro/pomodoro.linked-effects.ts`

These effect files should only export idempotent wrappers for the engine. They should not call back into the engine.

### Why not reuse `syncEngine`

`syncEngine` is the wrong primitive for Linked Actions because it:

- is in-memory only,
- has no DB persistence,
- has no rule lookup,
- has no chain metadata,
- has no per-effect idempotency,
- has no notification or audit surface,
- is designed for remote backup batching, not local rule execution.

Use it only as a conceptual precedent for centralized orchestration.

## 6. Bidirectional Safety Strategy

Bidirectional support should be modeled as two separate rules:

- Rule A: source A -> target B
- Rule B: source B -> target A

Those two rules can share one `bidirectional_group_id` so the UI treats them as one linked relationship.

### Safety rule for V1

Engine-originated effects must not emit new Linked Actions triggers.

Mechanically:

- user/manual actions emit events with `origin_kind = user`,
- engine-applied effects emit writes tagged with `origin_kind = linked_action`,
- source instrumentation checks that flag and skips event emission for engine-originated writes.

This allows:

- user completes Todo A -> Habit B updates,
- user later completes Habit B manually -> Todo A updates,

while preventing:

- user completes Todo A -> engine updates Habit B -> engine re-emits Habit B -> engine updates Todo A -> loop.

This is the safest V1 interpretation of "bidirectional".

## 7. Idempotency and Dedupe Strategy

Two layers are required.

### Layer 1: engine-level dedupe

Rule:

- one execution attempt per `(rule_id, source_event_id)`.

Mechanism:

- `linked_action_executions.UNIQUE(rule_id, source_event_id)`.

This prevents duplicate retries from reapplying the same rule for the same source event.

### Layer 2: effect-level idempotency

Handlers must still be state-aware.

#### Todo complete

- if `completed = 1`, skip.
- never call `toggleTodo()` from the engine.

#### Habit progress

- `progress_increment` can apply once per unique execution row.
- `progress_set` / `ensure_at_least_target` is naturally idempotent.
- if using increment, the execution row is the only protection against double progress.

#### Calorie log

- if execution row already has `produced_entity_id`, skip create.
- on retry after partial success, reload by execution metadata before inserting again.

#### Workout log

- same as calorie log: create at most one `workout_logs` row per execution.

#### Pomodoro log

- same as calorie/workout: create at most one `pomodoro_sessions` row per execution.

### Additional skip rules

Skip without notification spam when:

- target entity was deleted,
- target is already in the desired terminal state,
- rule is paused,
- rule source and target now point to the same incompatible object,
- source event was system-generated (`origin_kind = system`) and the rule only allows manual/user triggers.

## 8. Notification System Integration

Current state:

- `lib/notifications.ts` only manages OS timer notifications for Pomodoro.
- there is no app-wide in-app notification store, banner, or tap handler.

Safe V1 should add a separate in-app notification path for Linked Actions.

### Write-time integration

When the engine finishes an execution:

- `applied` -> create a success notification,
- `failed` -> create an actionable failure notification,
- `skipped` -> usually no notification unless product wants transparency for no-op links.

### Display integration

Recommended surfaces:

- `AppProviders`: mount a lightweight notification provider/store.
- `app/(tabs)/_layout.tsx`: render a top-of-content tappable banner above `TabSlot` for the newest unread notification.
- `features/overview/OverviewScreen.tsx`: add an inbox entry point beside the existing settings icon.

These are grounded surfaces that already exist globally or near-global.

### Tap behavior

Notification payload should include enough navigation metadata to:

- switch to the right tab,
- optionally focus/highlight the linked target item,
- optionally reopen the create/edit modal if the notification refers to a missing target.

Because the current app uses mostly tab screens and modals, V1 should navigate to the tab first and keep any deeper "open modal/highlight row" behavior optional.

## 9. UI Integration Plan

### Where links should be configured

V1 should attach linking UI to existing create/edit flows rather than inventing a separate global rule-builder first.

Recommended entry points:

- Todos: task create/edit modal.
- Habits: habit create/edit modal.
- Calories: add-entry card and entry edit modal.
- Workout: routine create card and routine detail modal.
- Pomodoro: timer screen, likely through a new "Linked Actions" modal adjacent to settings.

### Linking flow

For each source item:

1. open "Linked Actions",
2. choose target feature,
3. choose effect type allowed for that feature,
4. either select an existing target or create one inline,
5. optionally enable "also link back" which creates the reverse rule with the same `bidirectional_group_id`.

### "Select existing OR create new" by module

Todos:

- select existing todo,
- or create a new todo inline, then bind the rule to that new todo.

Habits:

- select existing habit,
- or create a new habit inline, then bind the rule to that new habit.

Calories:

- select existing saved meal,
- or create a new saved meal template inline, then bind the rule to that saved meal.

Workout:

- select existing routine,
- or create a new routine inline, then bind the rule to that routine.

Pomodoro:

- there is no reusable target entity today,
- so V1 should store a link-local session template inline in the rule.

This is the only feature that cannot honestly support a true "select existing entity" flow with current schema.

### Why not put Linked Actions in route files

The repo rule is explicit: `app/(tabs)/*.tsx` files stay thin. Linking UI belongs in feature screens or new feature-local modal components, not in `app/`.

## 10. Minimal Implementation Roadmap

1. Add SQLite schema support in a new migration block for:
   - `linked_action_rules`
   - `linked_action_events`
   - `linked_action_executions`
   - optional notification table
2. Add `core/linked-actions` engine, types, registries, and data access.
3. Add idempotent effect wrappers per feature instead of calling raw toggle/increment/log functions from the engine.
4. Instrument the V1 trigger surface only:
   - todo complete
   - habit increment / habit completed-for-day
   - calorie entry create
   - workout complete
   - pomodoro focus complete
5. Add linking UI to existing create/edit flows.
6. Add in-app notification banner + inbox entry point.
7. Add tests for:
   - loop prevention
   - rule/event dedupe
   - bidirectional no-ping-pong
   - per-feature effect idempotency
   - notification creation and tap routing

## 11. Risks and Edge Cases

- `toggleTodo()` auto-creates recurring instances for daily tasks. Those system-generated rows must not become Linked Actions trigger sources.
- Habit progress uses `date_key`; workout and pomodoro logs use ISO timestamps. The engine needs an explicit day-key policy when a source event creates a target log.
- `decrementHabit()` deletes the completion row at zero. Reverse links based on decrement should not be in V1.
- Calories add/update also modify `saved_meals`; that secondary write must not create a second Linked Actions event.
- Workout has two completion paths. Both should normalize to one source trigger type.
- Pomodoro logs only focus sessions today. Breaks should not silently participate.
- Deleted or soft-deleted targets must resolve to `skipped`, not `failed`, unless the UI needs repair guidance.
- Multiple rules can target the same object from the same source event. The execution table must still make each rule independent.
- There are no current cross-feature action tests. Existing tests only cover per-feature domain/data logic plus sync engine and notifications.
- If Linked Actions execution is kept in memory, app restarts will lose chain state. Persistence is required from day one.
- Overview is the only current cross-feature read aggregator. There is no existing cross-feature write orchestration to extend.

## Final Recommendation

Proceed with Linked Actions only as a centralized, persisted, opt-in engine.

Do not:

- let features call each other directly,
- let engine-originated writes re-trigger rules,
- let the engine call raw non-idempotent mutators,
- broaden V1 beyond the small whitelist of semantically clean source triggers.

That yields the smallest implementation that is consistent with the current SuperHabits architecture and the stated safety constraints.
