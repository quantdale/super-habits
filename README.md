# SuperHabits

SuperHabits is an offline-first productivity app for web and mobile with an overview dashboard, six active route surfaces, and a lightweight settings screen for appearance, backup restore status, and shipped-scope notes. It runs as a Progressive Web App (PWA) and as native Android/iOS apps from one Expo + React Native codebase.

Data is stored locally in SQLite first, then optionally backed up to Supabase. The current remote story is conservative: regular app usage pushes synced entities to Supabase, and restore v1 can import a limited subset back onto an empty device.

## Project Overview

- Offline-first architecture with local SQLite as the source of truth
- Web support with static export + service worker + OPFS-backed SQLite runtime
- Native support through Expo for Android and iOS
- Feature modules with strict data/domain/UI layering
- Optional anonymous Supabase backup/restore integration
- Experimental quick-command route for single todo or habit draft creation

## Tech Stack

- Expo SDK 55 + React Native 0.83.4 + Expo Router
- TypeScript 5.9 + NativeWind 4
- SQLite via `expo-sqlite` (WAL on native); web runtime uses SQLite WASM + OPFS
- Supabase (`@supabase/supabase-js`) for anonymous auth, push backup, and restore v1 preview/import
- Vercel for static PWA hosting (`dist/` output + SPA rewrites + COOP/COEP headers)
- Vitest for unit tests; Playwright for E2E

## High-Level Architecture

### Delta-Sync Engine

`syncEngine` (in `core/sync/sync.engine.ts`) is an in-memory queue that receives `SyncRecord` entries from feature data-layer writes (for synced entities). `flush()` snapshots the queue, sends it through an adapter, and restores records on adapter failure.

### SupabaseSyncAdapter

`SupabaseSyncAdapter` (in `core/sync/supabase.adapter.ts`) is the production adapter used by the exported `syncEngine`. On flush, it:

1. Groups queued records by entity
2. Reads current rows from local SQLite by id
3. Upserts those rows to matching Supabase tables (`onConflict: "id"`)

Current adapter sync mode is still one-way push backup. `SupabaseSyncAdapter.pull()` is still a stub (`[]`) today, but the app also ships a separate restore coordinator for empty-device restore v1.

### Restore V1

`core/sync/restore.coordinator.ts` provides the current restore path used by startup and Settings:

- Restore is only allowed when the device is empty for synced tables.
- Restore imports `todos`, `habits`, and `calorie_entries`.
- Habit completion history stays local-only.
- Saved meals stay local-only.
- `workout_routines` backup status is shown, but workout restore is intentionally excluded in this phase because nested routine structure is not fully synced.

### Flush and Auth Lifecycle

`AppProviders` wires sync and auth bootstrap:

- Calls `ensureAnonymousSession()` at app startup when Supabase env vars are configured
- Registers `syncEngine.flush()` on:
  - 30-second interval
  - Web `visibilitychange` when page becomes hidden
  - NetInfo connectivity events when connected
- Gated by `isRemoteEnabled()` (`remoteMode` defaults to `"enabled"`)

## Quick Start

### Prerequisites

- Node.js 20+ recommended
- npm

### Install

```bash
npm install
```

### Run development server

```bash
npx expo start
```

Optional platform commands:

- `npm run android`
- `npm run ios`
- `npm run web`

## Routes and Surfaces

Current route surfaces:

- `/(tabs)/overview`
- `/(tabs)/todos`
- `/(tabs)/habits`
- `/(tabs)/pomodoro`
- `/(tabs)/workout`
- `/(tabs)/calories`
- `/command` for the experimental quick-command shell
- `/settings`

The Overview screen is the entry point for the experimental command shell. It shows an "Add with command" card when `COMMAND_EXPERIMENT_ENABLED` is true.

## Command Shell

`/command` is an experimental quick-command shell, not a general assistant surface.

- Supported draft kinds are limited to `create_todo` and `create_habit`.
- The flow is parse -> review -> confirm before write.
- Default parser mode is `mock`.
- Optional model-backed parsing uses `remote_with_fallback`.
- The local parser remains the fallback and guardrail path when remote parsing is disabled or unavailable.
- Todo due dates stay limited to `today`, `tomorrow`, or explicit `YYYY-MM-DD`.

Relevant env vars for the optional real parser path:

- `EXPO_PUBLIC_AI_COMMAND_PARSE_MODE` with `remote_with_fallback` to enable remote parsing
- `EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST`
- `EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME`
- `EXPO_PUBLIC_AI_COMMAND_PROXY_URL`

## Deployment

### Vercel PWA Deployment

This repo is configured for static Expo web export.

- Build command: `npm run build:web`
- Output directory: `dist`
- SPA rewrite: `/(.*)` -> `/index.html` (from `vercel.json`)
- Required headers (configured in `vercel.json`):
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`

Recommended validation after deploy:

1. Confirm build output includes `dist/index.html`
2. Open a deep link (for example `/todos`) and verify it resolves to the app shell

### EAS Android APK Build (Preview)

`eas.json` defines a preview profile that produces an internal APK.

```bash
eas build -p android --profile preview
```

Relevant config:

- CLI version: `>= 18.5.0`
- Profile: `preview`
- Android build type: `apk`
- Android package id: `com.dale16.superhabits` (from `app.json`)

## Supabase Environment Variables

Set these for cloud sync/auth:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

If unset, the app runs local-only and remote backup/restore operations stay unavailable without crashing the app.

## Quality Gates

- Type checking: `npm run typecheck`
- Unit tests: `npm test`
- E2E tests: `npm run e2e` (run `npm run build:web` first when web bundle changes; Playwright serves static `dist/` through `node scripts/serve-e2e.js`)

## Additional Documentation

- Architecture map: `docs/PROJECT_STRUCTURE_MAP.md`
- Unified knowledge base: `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`
