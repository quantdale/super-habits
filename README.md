# SuperHabits

SuperHabits is an offline-first productivity app for web and mobile with an overview dashboard, five core modules, and a lightweight settings screen for appearance and current platform status. It runs as a Progressive Web App (PWA) and as native Android/iOS apps from one Expo + React Native codebase.

Data is stored locally in SQLite first, then optionally pushed to Supabase as cloud backup via the app's delta-sync pipeline.

## Project Overview

- Offline-first architecture with local SQLite as the source of truth
- Web support with static export + service worker + OPFS-backed SQLite runtime
- Native support through Expo for Android and iOS
- Feature modules with strict data/domain/UI layering
- Optional remote sync with anonymous Supabase authentication

## Tech Stack

- Expo SDK 55 + React Native 0.83.4 + Expo Router
- TypeScript 5.9 + NativeWind 4
- SQLite via `expo-sqlite` (WAL on native); web runtime uses SQLite WASM + OPFS
- Supabase (`@supabase/supabase-js`) for one-way sync backup and anonymous auth
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

Current sync mode is one-way push backup. `pull()` is intentionally a stub (`[]`) today.

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

If unset, the app runs local-only and Supabase push operations no-op safely.

## Quality Gates

- Type checking: `npm run typecheck`
- Unit tests: `npm test`
- E2E tests: `npm run e2e` (run `npm run build:web` first when web bundle changes)

## Additional Documentation

- Architecture map: `docs/PROJECT_STRUCTURE_MAP.md`
- Unified knowledge base: `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`
