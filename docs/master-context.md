# SuperHabits Master Context

Purpose: a compact, repo-grounded briefing file for future AI agents and human contributors. This is not a replacement for the larger knowledge base; it is the shortest useful path to correct implementation context.

Primary references:
- `docs/PROJECT_STRUCTURE_MAP.md`
- `.cursorrules`
- `.cursor/rules/superhabits-rules.mdc`
- `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`

Companion docs in this folder:
- `docs/working-rules.md` for implementation guardrails
- `docs/ai-task-template.md` for reusable task briefs
- `docs/repo-map.md` for fast file navigation

## Evidence Legend

- Confirmed from code: verified directly in the current repository.
- Confirmed from docs: stated in repo docs/rules.
- Inferred / uncertain: reasonable conclusion from code/docs, but not explicitly guaranteed.

## Project Overview

### Confirmed from code
- Single-package Expo/React Native repository, not a monorepo.
- Main runtime entry is `expo-router/entry` from root `package.json`.
- App shell is an Expo Router app with a root stack and a custom top-tab layout.
- Product modules in active use: Overview, Todos, Habits, Pomodoro/Focus, Workout, Calories.

### Confirmed from docs
- SuperHabits is positioned as an offline-first productivity app for web, iOS, and Android.
- Docs consistently describe local SQLite as the source of truth with optional Supabase backup/sync.

### Inferred / uncertain
- The repo is in an "active MVP" or early hardening phase: it has working features, tests, PWA deployment, and native build config, but still has unfinished sync and some doc/config drift.

## Product Purpose

### Confirmed from code
- Todos: task capture, priority, due dates, reorder, daily recurrence.
- Habits: daily targets, categories, icons/colors, streaks, yearly consistency heatmap.
- Pomodoro: configurable focus/break timer, session logging, yearly focus heatmap, notification scheduling.
- Workout: routines, exercises, timed sets/rests, session logging, yearly workout heatmap.
- Calories: macro entry, auto kcal calculation, saved meals, goals, charts, yearly heatmap.
- Overview: read-only cross-feature dashboard aggregating all major modules.

### Confirmed from docs
- The app is intended to unify day management across tasks, habits, focus, exercise, and nutrition.

## Current App Status / Maturity

### Confirmed from code
- Local-first SQLite app is implemented and bootstrapped at startup.
- Optional Supabase client, anonymous auth bootstrap, and push-only sync adapter exist.
- Vitest suite currently passes: `180` tests passed when run on April 8, 2026.
- Playwright E2E infrastructure is configured for static web export served from `dist/`.

### Confirmed from docs
- `.cursor/rules/superhabits-rules.mdc` calls the project an active MVP.
- CI runs quality checks first, then E2E.

### Inferred / uncertain
- The app is beyond prototype stage, but cloud sync, restore, and some operational polish are incomplete.

## Current Repo Workflow State

### Confirmed from current documentation
- The repo is being operated as a recovered clean baseline.
- New work should branch from current `main`, not from stale task branches.
- Active parallel work should use separate worktrees and separate branches per task.
- Parallel execution is wave-based: only parallel-safe tasks share a wave, and later waves wait for earlier waves to finish.

## Tech Stack

### Confirmed from code
- Expo `^55.0.8`
- React `19.2.0`
- React Native `0.83.4`
- TypeScript `~5.9.2`
- Expo Router
- NativeWind 4 + Tailwind config
- `expo-sqlite`
- Supabase JS client
- React Query 5 provider installed
- Playwright and Vitest for testing
- Vercel static deployment config for web

### Confirmed from docs
- Docs/rules describe Expo 55, React Native, Expo Router, NativeWind, SQLite, Supabase, Vitest, and Playwright.

### Inferred / uncertain
- Some docs appear to have been written during or for a planned RN/TS upgrade: repo docs often say React Native `0.84` and TypeScript `6`, but `package.json` currently pins RN `0.83.4` and TS `5.9.2`.

## Repo Structure and Ownership

### Confirmed from code

| Path | Owns |
|---|---|
| `app/` | Expo Router layouts and thin route wrappers only |
| `features/` | Feature modules: data/domain/screen/components |
| `features/shared/` | Cross-feature visualizations such as heatmaps/activity views |
| `core/db/` | SQLite bootstrap, migrations, types, reference schema |
| `core/sync/` | In-memory sync queue and Supabase push adapter |
| `core/providers/` | App bootstrap for DB, sync, auth, query client, gestures |
| `core/auth/` | Guest profile bootstrap |
| `core/pwa/` | Service worker registration |
| `core/ui/` | Shared UI primitives |
| `lib/` | Pure/platform helpers: IDs, time, validation, notifications, Supabase config, focus refresh |
| `constants/` | Section color tokens |
| `tests/` | Vitest tests |
| `e2e/` | Playwright tests |
| `public/` | Manifest and service worker for PWA |

### Confirmed from docs
- This ownership model matches `AGENTS.md`, `docs/PROJECT_STRUCTURE_MAP.md`, and `.cursorrules`.

## Core Architecture and Data Flow

### Confirmed from code
- UI -> feature `*.data.ts` for persistence, never directly to SQLite from screens.
- Feature `*.domain.ts` files hold pure calculations and formatting rules.
- `AppProviders` bootstraps `initializeDatabase()`, service worker registration, guest profile creation, and optional anonymous Supabase session.
- `getDatabase()` in `core/db/client.ts` is the single SQLite entrypoint and uses a singleton promise.
- On web, SQLite runs through Expo web export with OPFS-compatible isolation headers; native enables WAL.
- Mutating writes in synced entities enqueue records into `syncEngine`.
- `syncEngine.flush()` passes queued records to `SupabaseSyncAdapter`, which reads current local rows and upserts them to Supabase by table name.
- Flush triggers are time-based and lifecycle-based: 30 second interval, web visibility hidden, and NetInfo reconnect.

### Confirmed from docs
- `schema.sql` is reference-only, not runtime authority.
- Migrations are append-only and live in `core/db/client.ts`.

## State Management Approach

### Confirmed from code
- Screen-local `useState` is the dominant state model.
- Data reloads usually happen through `useFocusForegroundRefresh()` or `useFocusEffect`.
- React Query is only used as a top-level `QueryClientProvider`; no feature currently uses query hooks.
- No Zustand stores are used in app code.

### Inferred / uncertain
- The app intentionally favors explicit local orchestration over a shared state layer for now.

## Navigation / Routing Structure

### Confirmed from code
- Root redirect sends `/` to `/(tabs)/overview`.
- `app/(tabs)/_layout.tsx` defines a custom top tab bar and swipe navigation between tabs.
- Tab routes are thin wrappers such as `app/(tabs)/todos.tsx` -> `<TodosScreen />`.
- Current tabs: Overview, Todos, Habits, Pomodoro, Workout, Calories.

## UI / Design System Conventions

### Confirmed from code
- Light theme app shell with `#f8f7ff` surface.
- NativeWind `className` styling is common; inline styles are used for dynamic values and complex layout.
- Shared primitives include `Screen`, `Card`, `Button`, `Modal`, `TextField`, `PillChip`, `SwipeableCard`, and validation UI.
- Section colors are first-class and feature-specific:
  - Todos blue
  - Habits green
  - Focus purple
  - Workout orange
  - Calories amber
- GitHub-style yearly heatmaps are reused across multiple features.

### Confirmed from docs
- Per-section color identity and card-based UI are explicit design conventions.

## Database / Storage Model

### Confirmed from code
- Local database file is `superhabits.db`.
- Main tables:
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
- `app_meta` stores schema version and app-level settings/metadata such as guest profile, calorie goal, pomodoro settings, and date-key cutover markers.
- Current runtime schema version is `9`; next migration slot is `if (version < 10)`.
- `toDateKey()` now uses local calendar dates, not UTC.

### Confirmed from docs
- Soft delete is required for main synced entities.
- `habit_completions` at zero and `saved_meals` are intentional hard-delete exceptions.

## API Layer and Service Boundaries

### Confirmed from code
- There is no general REST or RPC layer used by features.
- The only active remote boundary is Supabase, used from `lib/supabase.ts` and `core/sync/supabase.adapter.ts`.
- Features do not call Supabase directly; they write locally and optionally enqueue sync records.
- `SupabaseSyncAdapter.pull()` is a stub returning `[]`.
- `core/db/migrations/001_initial_supabase.sql` only contains a reserved `profiles` table baseline, not a full cloud schema.

### Inferred / uncertain
- Remote sync is currently a one-way backup mechanism, not full multi-device synchronization.

## Auth Model

### Confirmed from code
- Local app bootstrap creates a guest profile stored in `app_meta`.
- If Supabase is configured, app startup attempts anonymous sign-in.
- If Supabase env vars are missing, the app stays local-only and remote operations no-op safely.

## Offline-First / Sync Behavior

### Confirmed from code
- SQLite is the source of truth.
- Syncable entities currently are:
  - `todos`
  - `habits`
  - `calorie_entries`
  - `workout_routines`
- Not synced:
  - `pomodoro_sessions`
  - `habit_completions`
  - `workout_logs`
  - nested workout tables
  - `saved_meals`
- Workout nested edits bump the parent `workout_routines.updated_at` and enqueue the parent routine instead of syncing nested rows directly.
- If remote mode is disabled, flush listeners are skipped and the in-memory queue can grow until a later flush path runs.

## Feature Inventory

### Confirmed from code

| Feature | Current behavior |
|---|---|
| Overview | Dashboard aggregates pending todos, calories vs goal, best habit streak, focus sessions/streak, workout days/streak |
| Todos | Add/edit/delete, swipe actions, priority, due date, drag reorder, daily recurrence, completed toggle |
| Habits | Create/edit/delete, time-of-day grouping, icon/color presets, increment/decrement counts, streaks, yearly consistency view |
| Pomodoro | Focus/short/long break modes, configurable durations, notifications, yearly history heatmap, garden-style history |
| Workout | Routine CRUD, nested exercises/sets, timed session flow, workout logging, yearly workout history |
| Calories | Macro entry with auto kcal, meal types, saved meal reuse/search, goal setting, donut and trend charts, yearly history |

## Domain Concepts and Glossary

### Confirmed from code
- `date_key`: local `YYYY-MM-DD` day identifier produced by `toDateKey()`.
- `recurrence_id`: stable series ID linking daily recurring todo instances.
- `HabitCompletion.count`: per-habit, per-day count used against `target_per_day`.
- `PomodoroMode`: `focus`, `short_break`, `long_break`.
- `RoutineExerciseSet`: one timed active/rest pair inside a workout exercise.
- `SavedMeal`: reusable calorie macro template stored locally.

## Business Rules / Must-Not-Break Behaviors

### Confirmed from code
- `getDatabase()` must remain the only DB entrypoint.
- Main synced entities use soft delete via `deleted_at`.
- Synced writes enqueue immediately after mutation from data-layer code.
- IDs come from `createId(prefix)`.
- Date keys come from `toDateKey()`.
- `habit_completions` enforces `UNIQUE(habit_id, date_key)` and uses insert-or-update semantics in the data layer.
- Todos recurrence generation creates the next daily instance when a recurring todo is completed and tomorrow does not already exist.

### Confirmed from docs
- Never edit old migrations; append new migration blocks only.
- UI should not import DB directly.
- Domain files should remain pure.

## Environment / Config Requirements

### Confirmed from code
- Recognized public env vars:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Web deploy depends on COOP/COEP headers from `vercel.json`.
- Expo app config includes Android package `com.dale16.superhabits`.

## Build / Test / Dev Commands

### Confirmed from code
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

### Confirmed from code on April 8, 2026
- `npm test`: passes with `180` tests.
- `npm run typecheck`: currently fails because `tsconfig.json` uses invalid `ignoreDeprecations: "6.0"` with the installed TypeScript version.

### Confirmed from code
- No lint script or lint config was found.

## Coding Conventions Detected

### Confirmed from code
- `@/` path alias rooted at the repo.
- File naming follows feature conventions:
  - `{feature}.data.ts`
  - `{feature}.domain.ts`
  - `{Feature}Screen.tsx`
  - thin route wrappers in `app/(tabs)/`
- Shared UI lives in `core/ui`.
- Validation is centralized in `lib/validation.ts`.
- Date and ID helpers are centralized in `lib/time.ts` and `lib/id.ts`.

## Known Gaps, Ambiguities, and Outdated Docs

### Confirmed from code vs docs
- `core/db/schema.sql` is stale: it still says schema version `4`, while runtime code is version `9`.
- `e2e/README.md` is stale: it says E2E runs against `npm run web`, but `playwright.config.ts` actually serves static `dist/` via `node scripts/serve-e2e.js`.
- `.github/copilot-instructions.md` is stale in at least two places:
  - says `toDateKey()` uses UTC, but current code uses local dates
  - says E2E work starts from `npm run web`, which conflicts with actual Playwright config
- Multiple docs/rules say React Native `0.84` and TypeScript `6`, but `package.json` currently uses React Native `0.83.4` and TypeScript `5.9.2`.
- Repo guidance treats `npm run typecheck` as a standard quality gate, but it currently fails due to an invalid `tsconfig.json` `ignoreDeprecations` value with the installed TypeScript version.

### Confirmed from code
- `App.tsx` and `index.ts` are legacy Expo starter files and are not the active app entry because `package.json` points to `expo-router/entry`.
- `HabitHeatmap.tsx` exists but the active habits overview uses `GitHubHeatmap` / `HabitsOverviewGrid`.

### Inferred / uncertain
- Some repo instructions were updated ahead of package/config changes, so version-sensitive guidance should be verified against code before editing.

## Current Priorities / Likely Next Areas of Work

### Confirmed from code and docs
- Implement real pull/restore/conflict handling for Supabase sync.
- Decide whether to activate or remove dormant React Query and Zustand usage.
- Clarify or improve background/off-app behavior for long-running Pomodoro sessions.
- Continue cleaning documentation drift around schema, E2E flow, and stack versions.

### Inferred / uncertain
- Accessibility/usability audit appears to be a likely missing workstream; the knowledge base explicitly calls out the lack of a documented audit.

## How to Brief an AI Agent for This Repo

Give the agent this minimum context before asking for changes:

1. Name the feature and target files.
   - Example: "Update `features/todos/` only" or "This touches `core/db/client.ts` and workout data flow."
2. State whether the task is UI/domain work or data/DB/sync work.
   - UI/domain tasks should stay in screens/components/domain files.
   - Data/DB/sync tasks must respect `getDatabase()`, soft delete, `createId()`, `toDateKey()`, and immediate sync enqueue for synced entities.
3. Mention any invariant that must not change.
   - Examples: "Do not break recurring todos", "Do not hard-delete synced entities", "Do not edit prior migrations."
4. Say whether web, native, or sync behavior matters.
   - Web-specific work may involve static export, OPFS, service worker, or Playwright behavior.
5. Ask the agent to verify code before editing when business logic changes.
   - The correct contract is usually in the feature's `*.data.ts` and `*.domain.ts`, not just in the screen.

Short briefing template:

> Read `AGENTS.md`, `docs/PROJECT_STRUCTURE_MAP.md`, `.cursorrules`, and `.cursor/rules/superhabits-rules.mdc` first. This task is `[UI/domain or data/sync]` work in `[paths]`. Preserve these invariants: `[list]`. Verify behavior against the current code, not stale docs.
