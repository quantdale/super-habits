---
name: feature-module-pattern
description: Feature module structure for SuperHabits. Use when adding or modifying features: *.data.ts, *.domain.ts, *Screen.tsx, routing, or core/ui/ components.
---

# FEATURE MODULE PATTERN — SuperHabits

Every feature in SuperHabits follows a strict three-file structure.
Apply this pattern for all new features and when modifying existing ones.

## Directory structure
features/{featureName}/
  {featureName}.data.ts       ← data layer (SQLite CRUD)
  {featureName}.domain.ts     ← pure business logic (no DB)
  {featureName}Screen.tsx     ← React Native screen component

Route file (thin wrapper):
  app/(tabs)/{featureName}.tsx

## types.ts (feature-local barrel)
Each feature may include `types.ts` that re-exports entity types from `@/core/db/types` and defines local types (e.g. `MealType`, `CalorieEntryTotals` in `features/calories/types.ts`). Screens import from `./types`, not from `@/core/db/types` directly, unless there is a deliberate exception.

## {featureName}.data.ts — rules
- Imports: getDatabase from core/db/client, createId from lib/id,
           nowIso/toDateKey from lib/time, syncEngine from core/sync
- All functions are async
- All functions start with: const db = await getDatabase()
- SELECT queries always include: WHERE deleted_at IS NULL
- DELETE operations always use soft delete (set deleted_at)
- Every write calls syncEngine.enqueue() after the DB operation
- Returns typed objects using types from core/db/types.ts
- No UI imports, no React imports

## {featureName}.domain.ts — rules
- Pure TypeScript only — no DB imports, no React imports, no side effects
- Takes typed inputs, returns typed outputs
- Fully unit-testable (no mocking needed)
- Houses calculations, transformations, validations, state machines
- Examples from existing features:
  - habits.domain.ts: calculateStreak(), isCompletedToday(), groupByCategory()
  - pomodoro.domain.ts: `nextPomodoroState()`, `PomodoroState` type (Vitest-covered; screen may wire labels through this helper)

## {featureName}Screen.tsx — rules
- Imports data functions from .data.ts
- Imports pure logic from .domain.ts
- Imports shared UI from core/ui/ (Button, Card, TextField, etc.)
- Local state with useState for UI state only
- Calls data functions directly (no React Query hooks currently)
- Refresh pattern: call load function after every mutation
- Uses NativeWind className for styling (Tailwind utility classes)
- Wraps content in <Screen> component from core/ui/Screen.tsx

## Route file (app/(tabs)/{name}.tsx) — rules
- ONLY renders the Screen component
- No logic, no state, no imports from data/domain
- Example:
    import { WorkoutScreen } from "@/features/workout/WorkoutScreen";
    export default function WorkoutTab() { return <WorkoutScreen />; }

## Shared UI components (core/ui/)
- Button: variants = "primary" | "ghost" | "danger"
- Card: container with standard padding/shadow
- TextField: labeled text input
- NumberStepperField: numeric input with +/− stepper
- Screen: SafeAreaView wrapper with optional ScrollView
- SectionTitle: section heading with optional subtitle

DO NOT create one-off styled containers in screen files.
Extend core/ui/ instead, or use NativeWind className directly on View/Text.

## Existing features — quick reference
todos:
  data: addTodo, listTodos, updateTodo, deleteTodo (soft)
  domain: none yet
  screen: TodosScreen — FlashList, add/edit/complete/delete
  e2e: `e2e/todos.spec.ts`

habits:
  data: addHabit, listHabits, toggleCompletion, getCompletionsForDate
  domain: calculateStreak, isCompletedToday, HABIT_PRESETS
  screen: HabitsScreen — progress rings, daily completion
  e2e: `e2e/habits.spec.ts`

pomodoro:
  data: logPomodoroSession, listPomodoroSessions
  domain: nextPomodoroState, PomodoroState
  screen: PomodoroScreen — countdown timer, setInterval; primary labels are inline (optional: derive from nextPomodoroState)
  e2e: `e2e/pomodoro.spec.ts`

workout:
  data: addWorkoutLog, listWorkoutLogs
  domain: none yet
  screen: WorkoutScreen — routine list, log entry
  e2e: `e2e/workout.spec.ts`

calories:
  data: addCalorieEntry, listCalorieEntries, getDailySummary
  domain: caloriesTotal, kcalFromMacros
  screen: CaloriesScreen — entry form with meal type picker (breakfast/lunch/dinner/snack); mealType is user-selectable
  e2e: `e2e/calories.spec.ts`

## Adding a new feature checklist
- [ ] Create features/{name}/ directory
- [ ] Create {name}.data.ts with CRUD functions (getDatabase, soft delete, enqueue)
- [ ] Create {name}.domain.ts with pure logic functions
- [ ] Create {name}Screen.tsx using shared UI components
- [ ] Create app/(tabs)/{name}.tsx as thin route wrapper
- [ ] Add tab entry in app/(tabs)/_layout.tsx
- [ ] Add TypeScript types to core/db/types.ts
- [ ] Add migration to core/db/client.ts (version N+1)
- [ ] Write Vitest tests for all domain functions in tests/
- [ ] Add E2E spec: `e2e/{name}.spec.ts` covering: empty state (no data), validation (empty form submission), happy path (add item), delete or primary destructive action where applicable, data persistence (add → reload → still present)
- [ ] Run `npx playwright test e2e/{name}.spec.ts` to confirm the spec passes against the implemented screen
