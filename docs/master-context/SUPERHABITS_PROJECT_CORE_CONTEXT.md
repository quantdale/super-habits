# SuperHabits — Project Core Context

SuperHabits is an offline-first productivity app built with Expo + React Native from a single TypeScript codebase targeting:

- Web as a PWA
- Android
- iOS

Primary product modules:

- Overview
- Todos
- Habits
- Pomodoro / Focus
- Workout
- Calories

## What this app is

SuperHabits is a local-first personal productivity system. SQLite is the source of truth. Optional Supabase integration exists as one-way remote backup sync, not full two-way sync.

The app is beyond prototype stage: it has working features, a structured architecture, local persistence, optional cloud backup, a Vitest suite, Playwright E2E infrastructure, and web/native deployment setup. But some sync capabilities and some docs/config are still incomplete or drifting.

## Tech stack

- Expo 55
- React
- React Native
- Expo Router
- TypeScript
- NativeWind + Tailwind
- expo-sqlite
- Supabase JS client
- Vitest
- Playwright
- Vercel static deployment for web

Important note:
Some repo docs mention newer React Native / TypeScript versions than what package.json currently pins. Version-sensitive assumptions must be checked against the actual code before editing.

## High-level architecture

### Directory ownership

- `app/`
  - Expo Router layouts and thin route wrappers only
  - no business logic
- `features/`
  - feature modules
  - `{feature}.data.ts` = persistence + sync enqueue
  - `{feature}.domain.ts` = pure business logic
  - `*Screen.tsx` = UI orchestration
- `features/shared/`
  - shared cross-feature visualizations/components
- `core/db/`
  - SQLite bootstrap, migrations, types
- `core/sync/`
  - in-memory sync queue + Supabase push adapter
- `core/providers/`
  - app bootstrap
- `core/auth/`
  - guest profile bootstrap
- `core/pwa/`
  - service worker registration
- `core/ui/`
  - shared UI primitives
- `lib/`
  - pure/platform helpers
- `constants/`
  - section color tokens
- `tests/`
  - Vitest tests
- `e2e/`
  - Playwright tests
- `public/`
  - PWA assets

### Layering rule

- UI calls data/domain
- Domain stays pure
- Data owns persistence and sync
- DB access goes through `getDatabase()` only

### Standard feature pattern

- `features/{feature}/{feature}.data.ts`
- `features/{feature}/{feature}.domain.ts`
- `features/{feature}/{Feature}Screen.tsx`
- optional `types.ts`
- route wrapper in `app/(tabs)/{feature}.tsx`

Exceptions:

- `features/overview/` is dashboard-only
- `features/shared/` is for shared cross-feature UI
- some features have nested screens, especially workout flows

## Product behavior by module

### Overview

Read-only dashboard aggregating major module summaries:

- pending todos
- calories vs goal
- habit streak/progress signals
- focus sessions/streak
- workout days/streak

### Todos

- add/edit/delete
- swipe actions
- priority
- due date
- drag reorder
- recurrence
- completion toggle

### Habits

- create/edit/delete
- daily target counts
- increment/decrement completions
- categories
- icon/color presets
- streaks
- yearly consistency views

### Pomodoro / Focus

- focus/short break/long break modes
- configurable durations
- notifications
- yearly history heatmap
- session logging

### Workout

- routine CRUD
- nested exercises and sets
- timed session flow
- workout logging
- yearly workout history

### Calories

- macro entry
- automatic kcal calculation
- saved meals
- goal setting
- charts
- yearly history

## Persistence model

SQLite is the primary data store.

Main tables include:

- `todos`
- `habits`
- `habit_completions`
- `pomodoro_sessions`
- `workout_routines`
- `workout_logs`
- `routine_exercises`
- `routine_exercise_sets`
- `workout_session_exercises`
- `calorie_entries`
- `saved_meals`
- `app_meta`

`app_meta` stores schema version and app-level settings/metadata such as:

- guest profile
- calorie goal
- pomodoro settings
- date-key cutover markers

Current runtime schema version: `11`

Next migration slot:

- add a new `if (version < 12)` block
- never edit previous migration blocks

## Sync model

SuperHabits is local-first.

### Current remote behavior

- optional Supabase anonymous auth bootstrap
- queue-based push sync
- `syncEngine` stores mutations in memory
- `SupabaseSyncAdapter` reads current local rows and upserts them remotely
- `pull()` is currently a stub
- this is backup sync, not full multi-device sync

### Synced entities

- `todos`
- `habits`
- `calorie_entries`
- `workout_routines`

### Not synced

- `pomodoro_sessions`
- `habit_completions`
- `workout_logs`
- nested workout tables
- `saved_meals`

### Flush triggers

- periodic timer
- web visibility/lifecycle path
- reconnect path

If remote mode is disabled, listeners are skipped and the in-memory queue can grow until a later flush path runs.

## Auth model

- local guest profile is created and stored in `app_meta`
- if Supabase is configured, anonymous sign-in is attempted
- if Supabase env vars are missing, app stays local-only and remote work safely no-ops

## Navigation

- root route redirects to tabs
- `app/(tabs)/_layout.tsx` defines the custom top tab bar
- route files are thin wrappers that render screen components

Current tabs:

- Overview
- Todos
- Habits
- Pomodoro
- Workout
- Calories

## UI conventions

- card-based UI
- feature-specific section colors
- NativeWind `className` is the main styling approach
- shared UI components live in `core/ui`
- heatmap-style yearly activity visualizations are reused across features

Section color identity:

- Todos = blue
- Habits = green
- Focus = purple
- Workout = orange
- Calories = amber

## State management

- local `useState` is the dominant pattern
- explicit refresh/reload after mutations
- React Query provider exists but feature query hooks are not actively used
- Zustand is not actively used in app code

## Critical invariants

These must not be broken:

- `getDatabase()` is the only DB entrypoint
- main synced entities use soft delete via `deleted_at`
- synced writes enqueue immediately in the data layer
- IDs must come from `createId(prefix)`
- timestamps must use `nowIso()`
- local date keys must use `toDateKey()`
- UI must not import DB directly
- domain files must stay pure
- old migrations must never be edited
- `schema.sql` is reference-only, not runtime authority
- recurring todo completion must keep series generation behavior intact
- `habit_completions` uniqueness by `(habit_id, date_key)` must stay intact
- nested workout edits must preserve parent routine update/enqueue behavior

## Environment / deployment constraints

Public env vars:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Web/PWA constraints:

- static export
- service worker
- OPFS-sensitive SQLite web runtime
- COOP/COEP headers must remain correct for web DB reliability

## Build and test commands

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run build:web`
- `npm run typecheck`
- `npm test`
- `npm run e2e`
- `npm run e2e:report`
- `npm run e2e:headed`
- `npm run e2e:debug`

## Known drift / caution areas

Treat these as real risks:

- some docs mention newer RN/TS versions than package.json
- `schema.sql` is stale compared with runtime migrations
- some E2E docs describe an outdated run path
- version-sensitive or workflow-sensitive claims must be verified against current code
- quality-gate assumptions can drift as configs change

## What future AI agents should optimize for

When changing this repo:

- prefer code truth over stale docs
- preserve architecture boundaries
- preserve invariants before adding polish
- keep data changes minimal and migration-safe
- keep UI work within existing screen/data/domain boundaries unless a refactor is explicitly justified
