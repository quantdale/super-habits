# SuperHabits Master Context

Purpose: single source of truth for current product behavior, architecture, and known repo-level risks. Keep structural path ownership in `docs/PROJECT_STRUCTURE_MAP.md` and execution constraints in `docs/working-rules.md`.

## Read This With

- `docs/PROJECT_STRUCTURE_MAP.md`
- `docs/working-rules.md`

## Project Snapshot

- SuperHabits is an offline-first productivity app built from one Expo + React Native codebase.
- Supported platforms are web, iOS, and Android.
- Web runs as a static-exported PWA.
- Local SQLite is the source of truth.
- Supabase is optional and currently acts as one-way backup sync only.

## Current Runtime Stack

Canonical source for exact versions: `package.json`.

Current repo state:

- Expo `^55.0.8`
- React `19.2.0`
- React Native `0.83.4`
- TypeScript `~5.9.2`
- Expo Router
- NativeWind 4
- `expo-sqlite`
- `@supabase/supabase-js`
- Vitest
- Playwright

## Product Surface

Active top-level tabs:

- Overview
- Todos
- Habits
- Pomodoro / Focus
- Workout
- Calories

Additional routed screen:

- Settings at `/settings`
  - implemented as `app/settings.tsx` -> `features/settings/SettingsScreen.tsx`
  - utility route, not part of the tab set

## Architecture Truths

- `app/` is Expo Router only.
- `features/` holds product modules.
- Data files own persistence and sync enqueue.
- Domain files own pure business logic.
- Screen files own orchestration and presentation.
- `core/db/client.ts` owns SQLite bootstrap and migrations.
- `core/sync/` owns the in-memory queue and Supabase adapter.
- `lib/` holds pure helpers and platform utilities, not feature logic or DB access.

## Data Flow

Canonical flow:

`UI -> domain/data orchestration -> data layer -> SQLite`

Important implications:

- UI does not talk to SQLite directly.
- Domain code does not open the DB.
- Data-layer code is the contract for writes, soft delete behavior, timestamps, IDs, and sync enqueue.

## Persistence Model

SQLite database:

- file name: `superhabits.db`
- entrypoint: `getDatabase()` in `core/db/client.ts`
- runtime schema version: `9`
- next migration slot: `if (version < 10)`

<<<<<<< HEAD
### Confirmed from code
- Light theme app shell with `#f8f7ff` surface.
- NativeWind `className` styling is common; inline styles are used for dynamic values and complex layout.
- Shared primitives include `Screen`, `Card`, `Button`, `Modal`, `TextField`, `PillChip`, `SwipeableCard`, and validation UI.
- `OverviewScreen` is the canonical structural reference for top-level tabs.
- Shared top-level screen structure now centers on:
  - `SectionTitle` for the page header and optional header actions
  - a consistent stat-row treatment for headline metrics
  - panel-style section cards for major content groups, with icon badge, title/subtitle row, and shared padding rhythm
- Section colors are first-class and feature-specific:
=======
Main runtime tables:

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

Important metadata in `app_meta` includes:

- `db_schema_version`
- guest profile
- calorie goal
- pomodoro settings
- date-key cutover metadata

## IDs, Dates, and Deletion Semantics

- IDs must come from `createId(prefix)` in `lib/id.ts`.
- Day keys must come from `toDateKey()` in `lib/time.ts`.
- `toDateKey()` currently uses local calendar dates, not UTC.
- Main synced entities use soft delete through `deleted_at`.
- Intentional hard-delete exceptions include:
  - `habit_completions` rows when count reaches zero
  - `saved_meals`

## Sync Model

Current sync behavior:

- local-first
- optional Supabase auth bootstrap via anonymous sign-in
- in-memory queue in `core/sync/sync.engine.ts`
- push adapter in `core/sync/supabase.adapter.ts`
- remote push reads current local rows and upserts them by table name
- `pull()` is not implemented

Currently synced entities:

- `todos`
- `habits`
- `calorie_entries`
- `workout_routines`

Currently not synced:

- `pomodoro_sessions`
- `habit_completions`
- `workout_logs`
- `saved_meals`
- nested workout tables

Flush behavior:

- every 30 seconds
- on web visibility change when the page becomes hidden
- on reconnect through NetInfo
- only while remote mode is enabled

Remote configuration behavior:

- `remoteMode` defaults to `"enabled"`
- if Supabase env vars are missing, the app stays local-first and remote operations no-op safely

## Auth Model

- App bootstrap creates a local guest profile in `app_meta`.
- If Supabase is configured, startup attempts anonymous sign-in.
- There is no full user-account settings flow in the current runtime.

## UI Conventions

- Shared primitives live in `core/ui/`.
- `features/overview/OverviewScreen.tsx` is the best reference for top-level tab structure.
- Feature identity stays color-coded:
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
  - Todos blue
  - Habits green
  - Focus purple
  - Workout orange
  - Calories amber
- Card and panel-based composition is the current UI language.

<<<<<<< HEAD
### Confirmed from docs
- Per-section color identity and card-based UI are explicit design conventions.
- Future UI work should preserve color identity while matching the shared Overview-derived header/card/panel/spacing system.

### Practical design DNA
- Strong hierarchy: page title first, metrics second, major sections third.
- Consistent spacing rhythm: one shared vertical cadence between page blocks instead of feature-specific padding stacks.
- Cleaner section chrome: icon-led panel headers, shared card padding, and shared surface treatment on light app background.
- Better grouping: related controls, summaries, and visualizations belong inside named panels rather than loose ad hoc containers.
- Shared primitives first: if a pattern already exists in `core/ui/`, new screens should extend that system instead of introducing page-local visual drift.
=======
## Web / PWA Reality
>>>>>>> a74517a (dark mode, documentatiton, blank fix)

- Web deploys from static export via `npm run build:web`.
- E2E does not run against Metro.
- `playwright.config.ts` uses `node scripts/serve-e2e.js` to serve `dist/`.
- OPFS-backed SQLite on web depends on:
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`
- Those headers are configured in `vercel.json` for deployment and are required for reliable web DB behavior.

## Testing and Delivery

Primary commands:

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run build:web`
- `npm run typecheck`
- `npm test`
- `npm run e2e`

CI behavior:

- `quality` job runs typecheck then unit tests
- `e2e` job runs after `quality`
- CI builds web before running Playwright

## Known Drift / Risks

- `core/db/schema.sql` is stale and is not runtime truth.
- Push-only sync can be described as backup, but not as restore or full multi-device sync because `pull()` is still a stub.
- `tsconfig.json` currently declares `ignoreDeprecations: "6.0"` while the repo uses TypeScript `~5.9.2`, so `npm run typecheck` is presently expected to fail until config is corrected.
- Legacy duplicate docs under `docs/master-context/` exist for compatibility and should not become independent authorities.
- Version-sensitive guidance must be verified against `package.json`, not memory or older docs.
