# SuperHabits Repo Map

Purpose: fast navigation to the files most likely to matter during implementation. This is a lightweight map, not a second architecture document.

Use with:
- `docs/master-context.md` for architecture and drift
- `docs/working-rules.md` for guardrails

## Start Here

- `AGENTS.md`
- `README.md`
- `docs/PROJECT_STRUCTURE_MAP.md`
- `docs/master-context.md`
- `docs/working-rules.md`

## App Shell and Routing

- `app/_layout.tsx` - root providers and stack
- `app/index.tsx` - root redirect to overview
- `app/settings.tsx` - thin settings route wrapper
- `app/(tabs)/_layout.tsx` - custom top tabs and swipe navigation
- `app/(tabs)/*.tsx` - thin route wrappers

## Core Infrastructure

- `core/providers/AppProviders.tsx` - DB bootstrap, service worker, guest profile, anonymous auth, sync flush lifecycle
- `core/providers/ThemeProvider.tsx` - persisted theme mode and shared UI tokens
- `core/db/client.ts` - SQLite bootstrap, singleton, migrations
- `core/db/types.ts` - entity types
- `core/db/schema.sql` - stale reference snapshot only
- `core/sync/sync.engine.ts` - queue and flush behavior
- `core/sync/supabase.adapter.ts` - push-only Supabase upsert adapter
- `core/auth/guestProfile.ts` - local guest metadata
- `core/pwa/registerServiceWorker.ts` - web service worker registration

## Shared Utilities

- `lib/id.ts` - ID generation
- `lib/time.ts` - date keys and date ranges
- `lib/validation.ts` - form/business validation messages
- `lib/supabase.ts` - Supabase config, remote mode, anonymous session
- `lib/useForegroundRefresh.ts` - focus/foreground refresh hooks
- `lib/notifications.ts` - timer notifications
- `constants/sectionColors.ts` - feature color tokens

## Shared UI

- `core/ui/Screen.tsx`
- `core/ui/Card.tsx`
- `core/ui/Button.tsx`
- `core/ui/Modal.tsx`
- `core/ui/TextField.tsx`
- `core/ui/PillChip.tsx`
- `core/ui/SwipeableCard.tsx`
- `core/ui/ValidationError.tsx`

## Feature Modules

### Overview
- `features/overview/OverviewScreen.tsx`

### Todos
- `features/todos/TodosScreen.tsx`
- `features/todos/todos.data.ts`
- `features/todos/todos.domain.ts`

### Habits
- `features/habits/HabitsScreen.tsx`
- `features/habits/habits.data.ts`
- `features/habits/habits.domain.ts`
- `features/habits/habitPresets.ts`

### Pomodoro
- `features/pomodoro/PomodoroScreen.tsx`
- `features/pomodoro/pomodoro.data.ts`
- `features/pomodoro/pomodoro.domain.ts`

### Workout
- `features/workout/WorkoutScreen.tsx`
- `features/workout/RoutineDetailScreen.tsx`
- `features/workout/WorkoutSessionScreen.tsx`
- `features/workout/workout.data.ts`
- `features/workout/workout.domain.ts`

### Calories
- `features/calories/CaloriesScreen.tsx`
- `features/calories/calories.data.ts`
- `features/calories/calories.domain.ts`

### Settings
- `features/settings/SettingsScreen.tsx`

### Cross-feature visuals
- `features/shared/GitHubHeatmap.tsx`

## Testing and Delivery

- `tests/` - Vitest suite
- `e2e/` - Playwright specs
- `playwright.config.ts` - static `dist/` server flow
- `vitest.config.ts`
- `.github/workflows/ci.yml`
- `scripts/serve-e2e.js`
- `vercel.json`
- `app.json`
- `eas.json`

## Known Navigation Traps

- `App.tsx` and `index.ts` are legacy Expo starter files, not the active runtime entry.
- `core/db/schema.sql` is not the runtime schema authority.
- E2E runs against static `dist/` via `scripts/serve-e2e.js`; verify details in `playwright.config.ts` and `e2e/README.md`.
