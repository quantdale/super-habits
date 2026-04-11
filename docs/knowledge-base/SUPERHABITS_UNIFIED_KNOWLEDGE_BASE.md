# SuperHabits Unified Knowledge Base

Purpose: supporting deep-dive reference for contributors and AI agents after they have read the canonical docs.

Read first:

1. `AGENTS.md`
2. `docs/PROJECT_STRUCTURE_MAP.md`
3. `docs/master-context.md`
4. `docs/working-rules.md`

This file is intentionally secondary. Do not duplicate canonical rules here unless a deeper explanation is necessary.

## What This File Covers

- module-by-module product behavior
- web/PWA runtime details
- sync implementation detail beyond the master-context summary
- testing and delivery notes
- known drift and risk areas that are useful during audits

## Product Modules

### Overview

- Read-only dashboard
- Aggregates top-level signals from todos, habits, focus, workout, and calories
- Implemented in `features/overview/OverviewScreen.tsx`

### Todos

- create, edit, reorder, complete, delete
- due date and priority support
- recurring daily todo generation via `recurrence` and `recurrence_id`

### Habits

- daily target counts
- per-day completion rows in `habit_completions`
- streak and consistency calculations
- color and icon presets

### Pomodoro / Focus

- focus, short break, and long break modes
- local session logging
- notification support
- yearly history views

### Workout

- routine CRUD
- nested exercises and sets
- session flow and workout logging
- parent routine row acts as the sync surface for nested routine edits

### Calories

- macro entry with kcal calculation
- saved meal reuse
- calorie goal setting
- daily and yearly progress visuals

### Settings

- routed utility screen at `/settings`
- currently a scaffold for app-level controls
- not part of the top-tab navigation

## Sync Deep Dive

Files involved:

- `core/sync/sync.engine.ts`
- `core/sync/supabase.adapter.ts`
- `lib/supabase.ts`
- `core/providers/AppProviders.tsx`

Current behavior:

- synced writes enqueue `SyncRecord` items in memory
- the exported `syncEngine` uses `SupabaseSyncAdapter`
- `flush()` snapshots the queue, attempts push, and restores records on adapter failure
- the Supabase adapter groups queued records by entity, loads the current local rows, and upserts them remotely
- unknown entity names are skipped with a warning
- `pull()` returns `[]`

Implications:

- sync is push-only
- the remote is not authoritative
- there is no restore, conflict resolution, or merge flow in the current runtime

## Web / PWA Deep Dive

- Web is served from static export output in `dist/`.
- Playwright E2E uses `scripts/serve-e2e.js`, not Metro.
- The static server and Vercel deployment both rely on:
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`
- Those headers are required for OPFS-backed SQLite on web.
- `public/sw.js` and `core/pwa/registerServiceWorker.ts` provide the service-worker path.

## Testing and Delivery Notes

- Vitest coverage lives in `tests/`.
- Playwright coverage lives in `e2e/`.
- CI runs `quality` before `e2e`.
- CI builds the web export before Playwright.
- Local `npm run e2e` assumes `dist/` is already built.

## Known Drift / Risks

- `core/db/schema.sql` is stale relative to runtime migrations and is reference-only.
- `tsconfig.json` currently has an `ignoreDeprecations` value that does not match the installed TypeScript version, so typecheck is a known repo-level failure until config is corrected.
- Sync language must stay precise:
  - it is backup-oriented push sync
  - it is not realtime
  - it is not bidirectional
  - it is not a complete restore path
- Legacy duplicate docs under `docs/master-context/` should remain thin compatibility pointers only.
