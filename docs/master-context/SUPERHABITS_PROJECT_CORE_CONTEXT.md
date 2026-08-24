# SuperHabits — Project Core Context

> **SUPERSEDED** — AGENTS.md is the primary agent guide; this document is historical and its baselines (e.g. 427 tests) are stale. Last verified: 2026-05.

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

The app is a single-page experience: `app/` contains only `_layout.tsx` and `index.tsx`. The six sections render inside `app/index.tsx` behind a `NavigationContext.activeSection` state, with a top tab rail of plain `Pressable` items. Settings is a full-screen modal (not a route); the Command Center is a global overlay only (mounted by `GlobalCommandCenterHost` in `app/_layout.tsx`). There are no `/settings`, `/command`, or `/(tabs)/*` routes.

## What this app is

SuperHabits is a local-first personal productivity system. SQLite is the source of truth. Optional Supabase integration exists as one-way remote backup sync, not full two-way sync.

The app is beyond prototype stage: it has working features, a structured architecture, local persistence, optional cloud backup, a Vitest suite, Playwright E2E infrastructure, and web/native deployment setup. But some sync capabilities and some docs/config are still incomplete or drifting.

Current shell reality to preserve:

- all six sections render in `app/index.tsx` behind `NavigationContext.activeSection`, with a plain `Pressable` top tab rail
- the command center is a global overlay with no `/command` page route; settings is a full-screen modal with no `/settings` route
- calories supports `Form` and `Diary` modes and remembers the last selected view
- settings is organized into six buckets: Appearance, Backup / Sync / Restore, AI / Command, Notifications / Timer defaults, Nutrition defaults, Developer / Internal

## Tech stack

- Expo `^55.0.8`
- React `19.2.0`
- React Native `0.83.4`
- Expo Router `^55.0.7`
- TypeScript `~5.9.2`
- NativeWind `^4.2.3` + Tailwind
- expo-sqlite
- Supabase JS client
- Vitest `^3.2.7`
- Playwright `^1.58.2`
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
- screens are mounted inside `app/index.tsx`; there are no per-route wrappers

Exceptions:

- `features/overview/` is dashboard-only
- `features/settings/` is screen-only and rendered inside `app/index.tsx` (full-screen modal)
- `features/command/` is a global overlay shell only (no page route)
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

- Gym V2 routine/catalog builder with built-in and custom exercise identity
- typed strength/bodyweight/timed/cardio prescriptions, notes, supersets, and reorder
- weekly plan plus date-specific rest/reschedule overrides and Today dashboard
- guided modality-aware sessions with durable drafts, previous performance, effort, rest, and wake behavior
- deterministic progression, PR/history/totals/body-area analytics, and body-weight trend/goal tracking
- quick-complete logging and yearly workout history remain distinct

### Calories

- macro entry
- automatic kcal calculation
- saved meals
- `Form` / `Diary` shells with remembered last-view preference
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
- `custom_exercises`
- `workout_weekly_plan`
- `workout_schedule_overrides`
- `body_weight_entries`

`app_meta` stores schema version and app-level settings/metadata such as:

- guest profile
- calorie goal
- pomodoro settings
- date-key cutover markers

Current runtime schema version: `23`

Next migration slot:

- add a new `if (version < 24)` block
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

- every `BACKUP_ENTITIES` member, including nested workout structure/history,
  custom exercises, weekly plan/date overrides, body weight, and planning/review
  rows; synthetic settings/manifest records use the same durable outbox

### Not synced

- local operational state only: linked-action events/executions and processed
  notification actions

### Flush triggers

- periodic timer
- web visibility/lifecycle path
- reconnect path

If remote mode is disabled, listeners are skipped and the in-memory queue can grow until a later flush path runs.

## Auth model

- `app_meta` defines a `guest_profile` key and local owner metadata; account ownership/recovery is coordinated by `core/auth/accountCoordinator.ts` and related account modules
- if Supabase is configured, safe anonymous sign-in is attempted only for an empty/unbound dataset
- if Supabase env vars are missing, app stays local-only and remote work safely no-ops

## Navigation

- `app/index.tsx` renders all six sections behind a `NavigationContext.activeSection` state, with a top tab rail of plain `Pressable` items
- `app/_layout.tsx` wraps the shell in `AppProviders`, mounts `GlobalCommandCenterHost`, and renders the global command-center overlay
- `NavigationContext` (`core/providers/NavigationProvider.tsx`) exposes `activeSection`, `setActiveSection`, `openSettings`, `closeSettings`, `openCommand`, `closeCommand`
- settings is a full-screen modal opened via `openSettings`; the command center is a global overlay opened via `openCommand`
- the command launcher appears on the six sections, opens a drawer on wide web and a bottom sheet elsewhere, and is suppressed during active pomodoro/workout sessions

Current sections:

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
- explicit refresh/reload after mutations using `useActiveForegroundRefresh(isActive, ...)` (keyed on the section's `isActive`) plus `useForegroundRefresh` for app-state/visibility refresh
- neither `@tanstack/react-query` nor `zustand` is installed

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

Current verified quality baseline:

- `npm run typecheck` passes
- `npm test` passes with 427 tests in 41 files
- `npm run build:web` passes
- `npx playwright test --list` reports 90 tests in 14 spec files

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
