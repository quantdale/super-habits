---
name: feature-module-pattern
description: Feature module structure for SuperHabits. Use when adding or modifying features: *.data.ts, *.domain.ts, *Screen.tsx, routing, or core/ui/ components.
---

# FEATURE MODULE PATTERN — SuperHabits

Every feature in SuperHabits follows a strict three-file structure unless it is one of the current screen-only exceptions listed below.
Apply this pattern for all new features and when modifying existing ones.

## Directory structure
features/{featureName}/
  {featureName}.data.ts       ← data layer (SQLite CRUD)
  {featureName}.domain.ts     ← pure business logic (no DB)
  {featureName}Screen.tsx     ← React Native screen component

Section render (single-page, no per-feature route):
  app/index.tsx — add the section to the top tab rail behind `NavigationContext.activeSection`

## Exceptions (current repo)
- **`features/overview/`** — `OverviewScreen.tsx` only (dashboard section). No `{overview}.data.ts` / `{overview}.domain.ts` in this folder; it composes data from existing modules.
- **`features/settings/`** — `SettingsScreen.tsx` only. It is a full-screen **modal** (opened via `NavigationProvider.openSettings`), not a tab module or a route.
- **`features/command/`** — experimental overlay-first shell rendered globally from `app/_layout.tsx` (`GlobalCommandCenterHost`); there is **no** `app/command.tsx` route. Current files include `CommandCenterProvider.tsx`, `CommandScreen.tsx`, `commandCenterConfig.ts`, `commandConfig.ts`, `commandInternalRollout.ts`, `commandParser.ts`, `command.domain.ts`, `command.executor.ts`, `mockCommandParser.ts`, `realCommandParser.ts`, and `types.ts` rather than the standard `{feature}.data.ts` pattern.
- **`features/shared/`** — cross-feature UI (`GitHubHeatmap`, `ActivityPreviewStrip`). Not a section-routed module.
- **Nested screens** — e.g. `RoutineDetailScreen.tsx`, `WorkoutSessionScreen.tsx` alongside `WorkoutScreen.tsx` under `features/workout/` for multi-step flows.

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

## Section registration (app/index.tsx) — rules
- The single-page shell (`app/index.tsx`) renders each feature's Screen behind `NavigationContext.activeSection`
- No per-feature route files exist; do not recreate `app/(tabs)/{name}.tsx`
- Register the section in the top tab rail (a plain `Pressable` that calls `setActiveSection`) in `app/index.tsx`

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
  data: addTodo, listTodos, updateTodo, deleteTodo (soft), recurrence fields
  domain: date keys, recurrence helpers (`getTomorrowDateKey`, `findMissingRecurrenceIds`, …)
  screen: TodosScreen — FlashList, add/edit/complete/delete, drag reorder
  e2e: `e2e/todos.spec.ts`

habits:
  data: addHabit, listHabits, increment/decrement completions, soft delete, …
  domain: streaks, grids, aggregated heatmap helpers, …
  screen: HabitsScreen — `HabitCircle`, `HabitsOverviewGrid`, category groups
  e2e: `e2e/habits.spec.ts`

pomodoro:
  data: logPomodoroSession, listPomodoroSessions
  domain: nextPomodoroState, PomodoroState
  screen: PomodoroScreen — countdown timer, setInterval; primary labels are inline (optional: derive from nextPomodoroState)
  e2e: `e2e/pomodoro.spec.ts`

workout:
  data: routines, nested exercises/sets, session logs, soft delete, …
  domain: timer sequence, heatmaps, streak helpers, …
  screen: WorkoutScreen + RoutineDetailScreen + WorkoutSessionScreen
  e2e: `e2e/workout.spec.ts`

calories:
  data: entries, saved meals, goals, soft delete, …
  domain: caloriesTotal, kcalFromMacros, charts/heatmap builders, …
  screen: CaloriesScreen — `Form` / `Diary` mode toggle with remembered last view, meal type picker (breakfast/lunch/dinner/snack), goal modal, saved meal search modal
  e2e: `e2e/calories.spec.ts`

overview:
  screen: OverviewScreen — dashboard section only
  section: registered in app/index.tsx as the default (`activeSection`)

## Adding a new feature checklist
- [ ] Create features/{name}/ directory
- [ ] Create {name}.data.ts with CRUD functions (getDatabase, soft delete, enqueue)
- [ ] Create {name}.domain.ts with pure logic functions
- [ ] Create {name}Screen.tsx using shared UI components
- [ ] Register the section in app/index.tsx (add a Pressable to the top tab rail that calls `setActiveSection`)
- [ ] Add TypeScript types to core/db/types.ts
- [ ] Add migration to core/db/client.ts (version N+1)
- [ ] Write Vitest tests for all domain functions in tests/
- [ ] Add E2E spec: `e2e/{name}.spec.ts` covering: empty state (no data), validation (empty form submission), happy path (add item), delete or primary destructive action where applicable, data persistence (add → reload → still present)
- [ ] Run `npx playwright test e2e/{name}.spec.ts` to confirm the spec passes against the implemented screen
