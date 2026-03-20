# 04_FEATURES.md

## Scope

`features/todos`, `features/habits`, `features/pomodoro`, `features/workout`, `features/calories` — `*.data.ts`, screens, domain, supporting components.

---

## Shared conventions

- Data functions: `await getDatabase()` first.
- Soft delete: `UPDATE ... SET deleted_at`, `SELECT ... WHERE deleted_at IS NULL` where applicable.
- IDs: `createId(prefix)`; timestamps: `nowIso()`; date keys: `toDateKey()` (UTC caveat — [03_LIB_SHARED.md](./03_LIB_SHARED.md)).

---

## `features/todos/`

### Files

| File | Role |
|------|------|
| `todos.data.ts` | SQLite CRUD |
| `TodosScreen.tsx` | UI |
| `types.ts` | `export type { Todo } from "@/core/db/types"` |

### `todos.data.ts`

#### `listTodos(): Promise<Todo[]>`

| Step | Detail |
|------|--------|
| SQL | `SELECT * FROM todos WHERE deleted_at IS NULL ORDER BY completed ASC, created_at DESC` |
| Binds | None |
| Returns | All active todos, incomplete first |

#### `addTodo(input: { title: string; notes?: string }): Promise<void>`

| Step | Detail |
|------|--------|
| SQL | `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at) VALUES (?, ?, ?, 0, ?, ?, NULL)` |
| IDs | `createId("todo")` |
| Sync | `syncEngine.enqueue({ entity: "todos", id, updatedAt: now, operation: "create" })` |

#### `toggleTodo(todo: Todo): Promise<void>`

| Step | Detail |
|------|--------|
| SQL | `UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?` — `next = todo.completed === 1 ? 0 : 1` |
| Sync | `{ entity: "todos", id: todo.id, updatedAt: now, operation: "update" }` |

#### `removeTodo(id: string): Promise<void>`

| Step | Detail |
|------|--------|
| SQL | `UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?` (soft delete) |
| Sync | `{ entity: "todos", id, updatedAt: now, operation: "delete" }` |

### `TodosScreen.tsx` — state and behavior

| State | Type | Initial | Updates |
|-------|------|---------|---------|
| `title` | `string` | `""` | Create form |
| `notes` | `string` | `""` | Create form |
| `items` | `Todo[]` | `[]` | `listTodos` → `setItems` |
| `createExpanded` | `boolean` | `false` | Toggle “Make a Task” |

**Derived:** `pendingTasks = items.filter((t) => t.completed === 0)`.

**`useFocusEffect`:** On focus, `refresh()` → `listTodos().then(setItems)`.

**Empty-state / FlashList quirk (exact):**

- When `pendingTasks.length === 0`: show centered “No Pending Tasks” + create dropdown only; **no** `FlashList` — **all todos are hidden**, including **completed-only** lists.
- When `pendingTasks.length > 0`: `FlashList` **`data={items}`** (full list, not `pendingTasks`), so **completed tasks remain visible** alongside pending. Create dropdown moves below the list.

**To surface completed-only todos:** Would require a branch rendering `FlashList` (or alternate list) when `items.length > 0 && pendingTasks.length === 0`, or a filter toggle — **not implemented**.

**Mutations:** After create/toggle/delete → `refresh()`.

---

## `features/habits/`

### Files

| File | Role |
|------|------|
| `habits.data.ts` | SQLite + sync for habits; completions without sync |
| `habits.domain.ts` | `calculateHabitProgress` |
| `HabitsScreen.tsx` | Main UI + modal |
| `HabitCircle.tsx` | Ring + icon |
| `ProgressRing.tsx` | SVG ring |
| `habitPresets.ts` | `HABIT_ICONS`, `HABIT_COLORS`, defaults |
| `types.ts` | Re-exports from `core/db/types` |

### `habits.domain.ts`

#### `calculateHabitProgress(count: number, targetPerDay: number): number`

- If `targetPerDay <= 0` → `0`.
- Else `Math.min(1, count / targetPerDay)`.

**Tests:** [05_QA_AND_TOOLING.md](./05_QA_AND_TOOLING.md).

### `habits.data.ts`

**Ordering constant:** `CATEGORY_ORDER = "CASE category WHEN 'anytime' THEN 0 ... END"`.

#### `listHabits(): Promise<Habit[]>`

- SQL: `SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY ${CATEGORY_ORDER}, created_at DESC`

#### `addHabit(name, targetPerDay, category, icon, color): Promise<void>`

- INSERT all habit columns; `reminder_time` NULL; `syncEngine.enqueue({ entity: "habits", id, updatedAt: now, operation: "create" })`.

#### `incrementHabit(habitId, dateKey = toDateKey())`

| Step | SQL / action |
|------|----------------|
| 1 | `SELECT id, count FROM habit_completions WHERE habit_id = ? AND date_key = ?` |
| 2a | If row: `UPDATE habit_completions SET count = ?, updated_at = ? WHERE id = ?` with `existing.count + 1` |
| 2b | Else: `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)` with **`createId("hcmp")`** |

**No** `syncEngine.enqueue`.

#### `decrementHabit(habitId, dateKey = toDateKey())`

| Step | SQL / action |
|------|----------------|
| 1 | Same SELECT as increment |
| 2 | If missing or `count <= 0` → return |
| 3 | If `count === 1` → `DELETE FROM habit_completions WHERE id = ?` (**hard delete** — allowed exception) |
| 4 | Else `UPDATE ... count = count - 1` |

#### `getHabitCountByDate(habitId, dateKey = toDateKey())`

- `SELECT count ...` → `row?.count ?? 0`.

#### `updateHabit` / `deleteHabit`

- UPDATE habit fields or soft delete; enqueue `"update"` / `"delete"` for `"habits"`.

### `HabitsScreen.tsx` — modal and state

| State | Purpose |
|-------|---------|
| `habits` | Loaded list |
| `completionMap` | `habitId → count` for `toDateKey()` |
| `modalVisible` | Modal open |
| `editMode` | Toggled by header icon — shows edit/delete chrome on circles vs normal `HabitCircle` |
| `editingHabit` | `null` = add flow; non-null = edit flow |
| `name`, `target`, `category`, `icon`, `color` | Form fields |

**Add flow:** `openAddModal(presetCategory?)` sets `editingHabit = null`, defaults, `modalVisible = true`.

**Edit flow:** `openEditModal(habit)` sets `editingHabit`, seeds fields (icon/color validated against presets), `modalVisible = true`.

**Save (`onSubmit`):** `updateHabit` or `addHabit` → clear form → `modalVisible = false` → `refresh()`.

**Cancel:** Primary “Cancel” clears `modalVisible` and `editingHabit`. Backdrop press on outer `Pressable` also closes and clears `editingHabit`. `Modal.onRequestClose` same.

**Icon/color:** Lists from `HABIT_ICONS` / `HABIT_COLORS`; invalid DB values fall back when opening edit.

### `HabitCircle.tsx`

- `onPress` → increment; `onLongPress` → decrement (`delayLongPress={400}`).
- Progress from `calculateHabitProgress(todayCount, habit.target_per_day)`.

### `ProgressRing.tsx`

- `strokeDashOffset` from `progress` clamped 0–1 in domain of ring math: `Math.min(1, Math.max(0, progress)) * circumference`.

---

## `features/pomodoro/`

### `pomodoro.data.ts`

**No** `syncEngine`.

#### `logPomodoroSession(startedAt, endedAt, durationSeconds, type)`

- INSERT into `pomodoro_sessions` with `createId("pom")`.

#### `listPomodoroSessions(limit = 20)`

- `SELECT * FROM pomodoro_sessions ORDER BY started_at DESC LIMIT ?`

### `pomodoro.domain.ts`

#### `nextPomodoroState(remainingSeconds, isRunning): PomodoroState`

- `remainingSeconds <= 0` → `"finished"`
- else if `isRunning` → `"running"`
- else → `"idle"`

### `PomodoroScreen.tsx`

**Constants:** `FOCUS_SECONDS = 25 * 60`.

| State | Initial | Role |
|-------|---------|------|
| `remaining` | `FOCUS_SECONDS` | Countdown seconds |
| `isRunning` | `false` | Timer active |
| `startedAt` | `null` | `Date` when current focus started — used when logging session at completion |
| `historyVersion` | `0` | Bumps to reload session list after log |
| `sessions` | `[]` | Recent sessions |

**History effect:** `useEffect(() => { listPomodoroSessions(8).then(setSessions); }, [historyVersion])` — **no** `useFocusEffect`.

**Timer effect** (deps `[isRunning, startedAt]`):

- When `isRunning` false → no interval (cleanup clears).
- `setInterval` 1000ms:
  - `setRemaining((prev) => { ... })`:
    - If `prev <= 1`: `clearInterval(timer)`, `setIsRunning(false)`, if `startedAt` then `logPomodoroSession(startedAt.toISOString(), endedAt.toISOString(), FOCUS_SECONDS, "focus")` (errors logged), `setHistoryVersion(v+1)`, return `0`.
    - Else return `prev - 1`.

**`startedAt`:** Set in `start()` to `new Date()` when user starts — captured for ISO start time at tick 0.

**Button label:** `pomodoroState = nextPomodoroState(remaining, isRunning)` — primary button shows **"Running..."** when state is `"running"`, else **"Start focus"**. (`"finished"` with `remaining === 0` shows “Start focus” — user can start again.)

**Quirk:** Reset sets `isRunning` false and `remaining` to `FOCUS_SECONDS` but **does not** clear `startedAt` — irrelevant until next `start()` overwrites.

**Notifications:** `start()` awaits `scheduleTimerEndNotification(FOCUS_SECONDS, ...)`.

---

## `features/workout/`

### `workout.data.ts`

#### `listRoutines`

- `SELECT * FROM workout_routines WHERE deleted_at IS NULL ORDER BY created_at DESC`

#### `addRoutine(name, description)`

- INSERT routine; `syncEngine.enqueue({ entity: "workout_routines", id, updatedAt: now, operation: "create" })`.

#### `completeRoutine(routineId, notes?)`

- INSERT `workout_logs` with **`createId("wrk")`** — **same prefix** as routines; **no** enqueue.

#### `listWorkoutLogs(limit = 12)`

- `SELECT * FROM workout_logs ORDER BY completed_at DESC LIMIT ?`

#### `deleteRoutine`

- Soft delete routine; enqueue `{ entity: "workout_routines", id: routineId, operation: "delete" }`.

### `WorkoutScreen.tsx`

#### State (`useState`)

| Variable | Type | Initial | What updates it |
|----------|------|---------|-----------------|
| `name` | `string` | `""` | `TextField` “Routine name” → `setName`; cleared to `""` after successful **Add routine** |
| `description` | `string` | `""` | `TextField` “Description” → `setDescription`; cleared with `name` after successful add |
| `routines` | `WorkoutRoutine[]` | `[]` | `setRoutines(r)` from `refresh()` only |
| `logs` | `WorkoutLog[]` | `[]` | `setLogs(l)` from `refresh()` only |

#### `useFocusEffect` / `useEffect`

| Hook | Deps | Behavior | Cleanup |
|------|------|----------|---------|
| `useFocusEffect` | `[refresh]` where `refresh = useCallback(async () => { ... }, [])` | On tab focus: `await Promise.all([listRoutines(), listWorkoutLogs(8)])` then `setRoutines` / `setLogs` | None (expo-router handles focus subscription) |

**No** `useEffect` in this file.

#### Error handling and alerts

| Situation | Behavior |
|-----------|----------|
| **Empty routine name on Add** | `Alert.alert("Missing name", "Enter a routine name.")` — **title** `"Missing name"`, **message** `"Enter a routine name."`; early `return`; no DB call |
| **Delete confirmation** | **None** — Delete button calls `deleteRoutine(routine.id)` directly with **no** `Alert` |
| **`addRoutine` / `completeRoutine` / `deleteRoutine`** | **No** `try/catch` in the screen. Failed promises from `await` in `onCreate` or button `onPress` handlers are **unhandled** at the screen level (may surface as console / RN error overlay depending on environment) |

#### Mutations → refresh

| User action | Data call | After await | `refresh` effect |
|-------------|-----------|-------------|------------------|
| Add routine (valid name) | `addRoutine(name.trim(), description.trim())` | `setName("")`, `setDescription("")` | `refresh()` — updates `routines` and `logs` |
| Complete workout | `completeRoutine(routine.id)` | — | `refresh()` |
| Delete routine | `deleteRoutine(routine.id)` | — | `refresh()` |

`refresh` is `async () => { const [r, l] = await Promise.all([listRoutines(), listWorkoutLogs(8)]); setRoutines(r); setLogs(l); }`.

#### Empty states

| Condition | What renders |
|-----------|----------------|
| **`routines.length === 0`** | No routine **cards** — only the top “create routine” `Card` (name + description + Add). **No** dedicated empty-state message for routines |
| **`logs.length === 0`** | Section title **“Recent workout logs”** still renders; **no** log cards — **no** “no logs yet” placeholder |

---

## `features/calories/`

### `features/calories/types.ts`

| Export | Definition | Notes |
|--------|------------|--------|
| `CalorieEntry` | `export type { CalorieEntry } from "@/core/db/types"` | Re-export of DB row type |
| `MealType` | `import("@/core/db/types").CalorieEntry["meal_type"]` | Alias for the **`meal_type` field union** on `CalorieEntry` — **not** spelled as inline literals in this file |
| `CalorieEntryTotals` | `{ calories: number }` | **Local** minimal shape for `caloriesTotal()` in `calories.domain.ts` — **only** `calories`; represents one row’s energy for summing |

**`MealType` resolved literals** (from `core/db/types.ts` → `CalorieEntry.meal_type`): `"breakfast" | "lunch" | "dinner" | "snack"`.

**`MEAL_OPTIONS`:** Defined in **`CaloriesScreen.tsx`** (not in `types.ts`), constant:

| `value` | `label` |
|---------|---------|
| `"breakfast"` | `"Breakfast"` |
| `"lunch"` | `"Lunch"` |
| `"dinner"` | `"Dinner"` |
| `"snack"` | `"Snack"` |

Type: `{ value: MealType; label: string }[]`.

---

### `calories.domain.ts`

#### `kcalFromMacros(proteinG, carbsG, fatsG, fiberG): number`

- `digestibleCarbG = Math.max(0, carbsG - fiberG)`
- `Math.round(proteinG*4 + digestibleCarbG*4 + fiberG*2 + fatsG*9)` then `Math.max(0, ...)`

#### `caloriesTotal(entries): number`

- Sums `entry.calories`.

### `calories.data.ts`

#### `listCalorieEntries(dateKey = toDateKey())`

- `SELECT * FROM calorie_entries WHERE deleted_at IS NULL AND consumed_on = ? ORDER BY created_at DESC`

#### `addCalorieEntry(...)`

- INSERT; `consumedOn ?? toDateKey()`; enqueue `{ entity: "calorie_entries", id, updatedAt: now, operation: "create" }`.

#### `deleteCalorieEntry`

- Soft delete + enqueue delete.

### `CaloriesScreen.tsx` — state machine

| State | Role |
|-------|------|
| `food`, `protein`, `carbs`, `fats`, `fiber` | Form strings |
| `mealType` | `MealType`; default `"breakfast"` |
| `formError` | `string \| null` |
| `entries` | `CalorieEntry[]` |

**`useEffect` on `[food, protein, carbs, fats, fiber, mealType]`:** clears `formError` on any field change.

**`computedKcal`:** `useMemo` → `kcalFromMacros(Number(protein)\|\|0, ...)` — preview in read-only field; shows **"—"** when `computedKcal <= 0`.

**`onAdd`:** Async IIFE:

1. `setFormError(null)`
2. Validate food non-empty → else set error message
3. Validate `computedKcal` finite and `> 0` → else error about zero calories
4. `addCalorieEntry` with `calories: computedKcal`, macro numbers, `mealType`
5. Clear fields, `refresh()`
6. `catch` → `setFormError` with Error message or fallback string

**Meal type:** User selects from `MEAL_OPTIONS` (breakfast / lunch / dinner / snack) — **not** hard-coded to snack in runtime code (contrast with stale `audit.md` / `feature-agent` text).

---

## Sync summary by feature

| Feature | enqueue |
|---------|---------|
| Todos | create, update, delete |
| Habits | create, update, delete (not completions) |
| Pomodoro | **none** |
| Workout | routines create/delete only (not logs) |
| Calories | create, delete |

---

## Feature matrix

| Feature | `toDateKey()` | `useFocusEffect` | `*.domain.ts` |
|---------|---------------|------------------|----------------|
| Todos | No | Yes | No |
| Habits | Via data defaults | Yes | Yes |
| Pomodoro | No | No | Yes |
| Workout | No | Yes | No |
| Calories | Yes (data) | Yes | Yes |
