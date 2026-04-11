# SuperHabits Repo Map

Purpose: quick navigation only. Structural authority stays in `docs/PROJECT_STRUCTURE_MAP.md`.

## Start Here

- `AGENTS.md`
- `docs/PROJECT_STRUCTURE_MAP.md`
- `docs/master-context.md`
- `docs/working-rules.md`

## App Shell

- `app/_layout.tsx`
- `app/index.tsx`
- `app/(tabs)/_layout.tsx`
- `app/settings.tsx`

## Core Infra

- `core/providers/AppProviders.tsx`
- `core/db/client.ts`
- `core/db/types.ts`
- `core/sync/sync.engine.ts`
- `core/sync/supabase.adapter.ts`
- `core/auth/guestProfile.ts`
- `core/pwa/registerServiceWorker.ts`

## Shared Helpers

- `lib/id.ts`
- `lib/time.ts`
- `lib/validation.ts`
- `lib/supabase.ts`
- `lib/useForegroundRefresh.ts`
- `lib/notifications.ts`
- `constants/sectionColors.ts`

## Shared UI

- `core/ui/Screen.tsx`
- `core/ui/Card.tsx`
- `core/ui/FeaturePanel.tsx`
- `core/ui/FeatureStatCard.tsx`
- `core/ui/Modal.tsx`
- `core/ui/TextField.tsx`
- `core/ui/PillChip.tsx`
- `core/ui/SwipeableCard.tsx`
- `core/ui/ValidationError.tsx`

## Feature Entry Points

- `features/overview/OverviewScreen.tsx`
- `features/todos/TodosScreen.tsx`
- `features/habits/HabitsScreen.tsx`
- `features/pomodoro/PomodoroScreen.tsx`
- `features/workout/WorkoutScreen.tsx`
- `features/calories/CaloriesScreen.tsx`
- `features/settings/SettingsScreen.tsx`

## Testing and Delivery

- `tests/`
- `e2e/`
- `playwright.config.ts`
- `scripts/serve-e2e.js`
- `.github/workflows/ci.yml`
- `vercel.json`
- `app.json`
- `eas.json`
