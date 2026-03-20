# 04_FEATURES.md

## Scope

This document covers all **`features/*`** modules: **todos**, **habits**, **pomodoro**, **workout**, and **calories** — each with a `*Screen.tsx`, SQLite **`*.data.ts`**, and (where present) **`*.domain.ts`** plus feature-specific components.

---

## Purpose

**What it does:** Implements the five MVP product areas (task list, habit tracking with daily completions, Pomodoro timer with session history, workout routines and logs, calorie logging with macro-derived kcal). Persistence is **local SQLite** via `getDatabase()`; several entities call **`syncEngine.enqueue`** after writes.

**Problem it solves:** Keeps UI, pure logic, and data access separated per feature (`Screen` / `.domain` / `.data`) per project conventions.

---

## Tech stack

| Layer | Evidence |
|-------|----------|
| **React Native + Expo** | Screens use `react-native`, `expo-router` `useFocusEffect` |
| **SQLite** | All `*.data.ts` use `@/core/db/client` |
| **NativeWind** | `className` on views |
| **@shopify/flash-list** | `TodosScreen` |
| **react-native-svg** | `ProgressRing.tsx` |
| **expo-notifications** (via lib) | `PomodoroScreen` → `scheduleTimerEndNotification` |
| **TypeScript** | Typed entities from `@/core/db/types` |

---

## Architecture pattern

**Modular monolith (feature folders):** each feature is a **vertical slice** — UI screen(s), data layer, optional pure domain. **No** separate deployable services.

---

## Entry points

| Feature | Primary UI | Data module | Domain module |
|---------|------------|-------------|---------------|
| Todos | `TodosScreen.tsx` | `todos.data.ts` | **Not found** |
| Habits | `HabitsScreen.tsx` + `HabitCircle.tsx`, `ProgressRing.tsx` | `habits.data.ts` | `habits.domain.ts` |
| Pomodoro | `PomodoroScreen.tsx` | `pomodoro.data.ts` | `pomodoro.domain.ts` |
| Workout | `WorkoutScreen.tsx` | `workout.data.ts` | **Not found** |
| Calories | `CaloriesScreen.tsx` | `calories.data.ts` | `calories.domain.ts` |

Tab routes in `app/(tabs)/` import these screens (see `01_APP_ROUTING.md`).

---

## Folder structure (per feature)

### `features/todos/`

| File | Role |
|------|------|
| `TodosScreen.tsx` | List/create/toggle/delete todos; `FlashList`; collapsible “Make a Task” form. |
| `todos.data.ts` | `listTodos`, `addTodo`, `toggleTodo`, `removeTodo` (soft delete). |

### `features/habits/`

| File | Role |
|------|------|
| `HabitsScreen.tsx` | Category-grouped habits, edit mode, modal add/edit, icon/color pickers. |
| `HabitCircle.tsx` | Circular progress UI; tap = increment, long-press = decrement. |
| `ProgressRing.tsx` | SVG ring for 0–1 progress. |
| `habitPresets.ts` | `HABIT_ICONS`, `HABIT_COLORS`, defaults. |
| `habits.data.ts` | CRUD on `habits`; completion count for date via `habit_completions`; **hard DELETE** on completion row when count hits 0 from 1. |
| `habits.domain.ts` | `calculateHabitProgress(count, targetPerDay)`. |

### `features/pomodoro/`

| File | Role |
|------|------|
| `PomodoroScreen.tsx` | 25-minute countdown, start/reset, session log on complete, recent list. |
| `pomodoro.data.ts` | `logPomodoroSession`, `listPomodoroSessions` — **no** `syncEngine`. |
| `pomodoro.domain.ts` | `PomodoroState`, `nextPomodoroState` (see Quirks). |

### `features/workout/`

| File | Role |
|------|------|
| `WorkoutScreen.tsx` | Create routines, complete workout, delete routine, recent logs. |
| `workout.data.ts` | `listRoutines`, `addRoutine`, `completeRoutine`, `listWorkoutLogs`, `deleteRoutine`. |

### `features/calories/`

| File | Role |
|------|------|
| `CaloriesScreen.tsx` | Macro fields, `kcalFromMacros` preview, add entry, daily total, delete. |
| `calories.data.ts` | `listCalorieEntries` (by `consumed_on`), `addCalorieEntry`, `deleteCalorieEntry` (soft delete). |
| `calories.domain.ts` | `kcalFromMacros`, `caloriesTotal`. |

---

## API surface (HTTP / REST)

**Not found** — features expose no HTTP endpoints.

---

## Data models (feature-specific usage)

Uses **`core/db/types.ts`** (`Todo`, `Habit`, `HabitCompletion`, `PomodoroSession`, `WorkoutRoutine`, `WorkoutLog`, `CalorieEntry`). No additional exported schema types inside `features/`.

### Sync enqueue (observed in `*.data.ts`)

| Feature | `syncEngine.enqueue` on |
|---------|---------------------------|
| Todos | create, update (toggle), delete (soft) |
| Habits | create habit, update habit, delete habit (soft) — **not** on completion increments |
| Pomodoro | **Not called** |
| Workout | create/delete **routine** — **not** on `workout_logs` insert |
| Calories | create, delete (soft) |

---

## Config & environment variables

**Not found** in `features/` — no `.env` reads.

---

## Inter-service communication

| Mechanism | Usage |
|-----------|--------|
| **`syncEngine.enqueue`** | After selected SQLite writes (see table above). **No** `flush()` in feature code. |
| **Remote/cloud** | **Not found** in features. |

---

## Auth & authorization

**Not found** in `features/` — no login gates or role checks in screens.

---

## Key business logic (by feature)

### Todos

| Function / area | Behavior |
|-----------------|----------|
| `listTodos` | `WHERE deleted_at IS NULL`, order `completed ASC`, `created_at DESC`. |
| `removeTodo` | Sets `deleted_at` + `updated_at` (soft delete). |
| `TodosScreen` | Refresh on tab focus; create requires non-empty title; **FlashList `data={items}`** when `pendingTasks.length > 0` (see Quirks). |

### Habits

| Function / area | Behavior |
|-----------------|----------|
| `incrementHabit` | Upserts completion for `dateKey` (default `toDateKey()`); new row uses `createId("hcmp")`. **No** sync enqueue. |
| `decrementHabit` | Decrements count or **DELETE FROM habit_completions** when going from 1 → 0 (exception to soft-delete-only pattern for main entities — table-specific). |
| `deleteHabit` | Soft-delete on `habits`. |
| `calculateHabitProgress` | `min(1, count / target)` or 0 if target ≤ 0. |

### Pomodoro

| Function / area | Behavior |
|-----------------|----------|
| `logPomodoroSession` | Inserts into `pomodoro_sessions` with `createId("pom")`. |
| `PomodoroScreen` | `FOCUS_SECONDS = 25 * 60`; `setInterval` 1s; on zero logs session with `startedAt`/`endedAt` ISO, duration `FOCUS_SECONDS`; schedules local notification on **Start**. |
| `nextPomodoroState` | If `remainingSeconds <= 0` → `"finished"`; else if `isRunning` → `"running"`; else `"idle"`. |

### Workout

| Function / area | Behavior |
|-----------------|----------|
| `completeRoutine` | Inserts `workout_logs` with **new** `createId("wrk")` (same prefix as routines). **No** `syncEngine`. |
| `deleteRoutine` | Soft-delete routine + enqueue. |

### Calories

| Function / area | Behavior |
|-----------------|----------|
| `listCalorieEntries` | Default `dateKey = toDateKey()` (UTC-based date key — see `03_LIB_SHARED.md`). |
| `kcalFromMacros` | Documented formula: 4P + 4×max(0,C−F) + 2F + 9×fat, rounded, floored at 0. |
| `CaloriesScreen` | Passes **`mealType: "snack"`** always to `addCalorieEntry`. |

---

## Background jobs / scheduled tasks

**Not found** — Pomodoro uses **in-memory `setInterval`**; `scheduleTimerEndNotification` is a **local scheduled notification**, not a server job.

---

## Error handling

| Location | Behavior |
|----------|----------|
| `TodosScreen` | `Alert.alert` for missing title. |
| `HabitsScreen` | `Alert` for missing name; confirmation for delete habit. |
| `WorkoutScreen` | `Alert` for missing routine name. |
| `CaloriesScreen` | `formError` state; try/catch on add maps errors to message text. |
| `*.data.ts` | Generally **no** try/catch — DB errors surface to callers. |

---

## Testing

| Test file | Covers |
|-----------|--------|
| `tests/habits.domain.test.ts` | `calculateHabitProgress` |
| `tests/pomodoro.domain.test.ts` | `nextPomodoroState` |
| `tests/calories.domain.test.ts` | `caloriesTotal`, `kcalFromMacros` (`calories.domain`) |
| `tests/calories.data.STUB.test.ts` | Skipped stub (future `calories.data` / SQLite tests) |
| **Not found** | Tests for `todos`, `workout`, `*.data.ts` DB integration, or `*Screen.tsx` |

Framework: **Vitest** (see `vitest.config.ts`).

---

## Deployment

**Not found** in `features/` — no CI/Docker here.

---

## Quirks

1. **Todos list vs empty state:** When **`pendingTasks.length === 0`** but some todos exist with **`completed === 1`**, the UI shows the **“No Pending Tasks”** branch and **does not** render `FlashList` — completed-only lists are **not visible** until at least one task is pending again.
2. **`nextPomodoroState`:** Implemented and unit-tested but **`PomodoroScreen` does not import it** — timer state is inline (`remaining`, `isRunning`). Workspace rules note this as dead code relative to UI.
3. **Habit completions:** Uses **hard DELETE** when count goes to zero from one — special-case for `habit_completions` (see project rules).
4. **Calories `mealType`:** Always **`"snack"`** from the screen regardless of meal — known limitation per project rules.
5. **`workout_logs` IDs:** `completeRoutine` uses prefix **`wrk`**, same as routines — distinct tables; IDs remain unique per row.
6. **Pomodoro timer vs notification:** Timer runs in JS `setInterval`; notification is scheduled for the same duration — drift possible if app backgrounded (platform-dependent; not handled in code reviewed).

---

## Open questions

1. Whether **todo ordering** should surface completed items when none pending — **product decision**, not encoded beyond current conditional rendering.
2. Whether **`nextPomodoroState`** will replace inline logic — **not** reflected in `PomodoroScreen.tsx` yet.
3. Intended **meal type** UX for calories — **not** implemented beyond hard-coded `"snack"`.
