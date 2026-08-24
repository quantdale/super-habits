# SuperHabits

SuperHabits is an offline-first productivity app for web and mobile with an overview dashboard, six tab surfaces, a six-bucket settings IA, and an experimental command center that now launches as a global overlay. It runs as a Progressive Web App (PWA) and as native Android/iOS apps from one Expo + React Native codebase.

Data is stored locally in SQLite first, then optionally backed up to Supabase. The current remote story is backup-first: regular app usage pushes the complete recoverable scope to Supabase, and Restore V2 can import that full scope back onto an empty device. This is not full two-way sync. When remote backup is configured, the local SQLite dataset also keeps a durable owner binding so auth loss cannot silently attach existing data to a new anonymous user.

Beyond cloud backup, users also get **Portable Backup V1**: a user-controlled file export/import path that works fully offline — no Supabase, no account, no network required. Export produces one self-contained, versioned, integrity-protected JSON file containing the complete recoverable dataset; import validates the file completely, shows a preview, requires explicit confirmation, and restores everything atomically onto an eligible empty device. The file is plain text (not encrypted) and must be stored somewhere the user trusts. Portable backup is distinct from cloud backup: it never routes through Supabase and never marks the cloud backup complete.

## Project Overview

- Offline-first architecture with local SQLite as the source of truth
- Web support with static export + service worker + OPFS-backed SQLite runtime
- Native support through Expo for Android and iOS
- Feature modules with strict data/domain/UI layering
- Optional anonymous Supabase backup/restore integration with Recoverable Account V1 email protection and empty-device recovery
- Portable file export/import (Backup V1) that works without Supabase
- Global command-center overlay across the six sections (no `/command` route)
- Calories `Form` / `Diary` modes with remembered last-view preference
- Settings grouped into Appearance, Backup / Sync / Restore, AI / Command, Notifications / Timer defaults, Nutrition defaults, and Developer / Internal

## Tech Stack

- Expo SDK 55 + React Native 0.83.10 + Expo Router
- TypeScript 5.9 + NativeWind 4
- SQLite via `expo-sqlite` (WAL on native); web runtime uses SQLite WASM + OPFS
- Supabase (`@supabase/supabase-js`) for anonymous auth, push backup, and Restore V2 preview/import
- Portable file export/import via `expo-file-system` + `expo-sharing` + `expo-document-picker` (native) and browser Blob download + file input (web)
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

The Backup Completeness V2 scope rides the same durable outbox: all 21 recoverable entity tables (including full Gym V2 routine/session structure, custom exercises, weekly plan/date overrides, body-weight entries, planning/review entities, and historical workout facts), plus the synthetic `user_backup_settings` and `backup_manifest` records that carry the certified settings snapshot and the versioned completeness checkpoint. Adapter sync mode is still one-way push backup. `SupabaseSyncAdapter.pull()` is still a stub (`[]`) today; empty-device recovery goes through the Restore V2 coordinator (with the legacy V1 path as the labeled fallback).

### Cloud Backup & Restore (Backup Completeness V2 / Restore V2)

`core/backup/` implements the owner-scoped cloud backup and restore contract:

- The recoverable scope is versioned (`backup.scope_version = 7`, backup schema version 2): all 21 recoverable entities, including habit completions, full Gym V2 routine/exercise/session structure and history, custom exercise metadata, weekly plans/date overrides, body weight, planning/review entities, pomodoro sessions, linked-action rules, and the allowlisted recoverable settings. Scope 6 remains a frozen historical compatibility format.
- A maintenance cycle publishes an owner-scoped `backup_manifest` (generation, per-entity counts + deterministic SHA-256 checksums, certified settings checksum) only after the durable outbox drains — one atomic local coherence boundary.
- Restore V2 (`core/backup/backupRestore.ts`) prefetches and validates every row + the settings payload, verifies all checksums and the dependency graph, requires a completely empty device (all user tables + outbox), then imports everything in ONE SQLite transaction with no historical side effects (no linked-action replay, no notifications, no recurring-todo creation). Theme is staged durably and applied to AsyncStorage after commit with restart retry.
- Legacy V1 backups remain restorable through the legacy path and are labeled `V1 LEGACY/PARTIAL`.
- Restore is only allowed on an empty device; anything — including pomodoro or workout history — blocks it.

### Portable Backup V1 (file export/import)

`core/portable/` implements the user-controlled file path, which works without Supabase:

- **Export** produces ONE self-contained JSON file (`superhabits-backup-*.json`, MIME `application/json`) from a coherent read-only SQLite snapshot: the complete current Scope-7 recoverable entity set + recoverable settings (including theme). No secrets: no tokens, no raw user UUIDs, no `sync_outbox`, no internal `app_meta`. When the dataset has a durable owner binding, the file carries a one-way owner fingerprint (SHA-256 of a fixed domain separator + owner UUID) — compatibility metadata only, never authentication. Every successful V1 export satisfies the V1 import size bound (`PORTABLE_V1_MAX_BYTES`, 100 MB); oversized datasets fail safely before presenting a file.
- **Import** requires an explicit file selection. On native, the file's metadata size is checked BEFORE any body read (`expo-document-picker` asset size or `expo-file-system` `File.info().size`); on web, `File.size` is checked before `File.text()`. A post-read UTF-8 byte verification provides a second defense against metadata under-reporting. Import then validates everything before any write: envelope + format/domain versions, every row, settings, per-entity checksums, settings checksum, payload checksum, dependency graph, owner compatibility, and complete destination emptiness. A human-readable preview is shown, the user confirms explicitly, and ONE atomic SQLite transaction restores all state through the side-effect-free Restore V2 import paths. Historical side effects never replay.
- **Owner compatibility**: same-owner files import onto the matching owner's empty device; different-owner files are blocked; ownerless (local-only) files import with an explicit adoption disclosure; a file can never set the owner binding. Import-origin metadata is recorded so a later unrelated account cannot silently claim an imported dataset.
- **Owner-backed import recovery**: When a file from a protected account is imported on an empty device, the owner fingerprint is recorded and the dataset remains locally unbound. Settings surfaces "Imported backup account required" with an email input and "Send sign-in code" button. On OTP verification, the authenticated UID's fingerprint is compared against the recorded import-origin fingerprint. An exact match permanently binds the dataset (adopting any unowned outbox rows) and triggers `ensureBackupBackfill()` to enqueue imported rows under the matched owner. A non-matching account is signed out, local data is untouched, and the source fingerprint is preserved. This is the ONLY supported path for account recovery after portable import — generic populated-device account switching remains blocked.
- **Size contract**: `PORTABLE_V1_MAX_BYTES` (100 MB) is the single shared bound for export and import. Every successful V1 export satisfies this bound. Oversized exports fail with `reason: 'too_large'` and produce no file. Native import checks file metadata BEFORE any body read; the post-read UTF-8 byte count is a second defense. Local-only portable imports (`ownerFingerprint: null`) do NOT gain the imported-owner recovery exception.
- **Cloud interaction**: a file import never marks cloud backup complete. Backfill markers are reset and the backup is marked dirty, so a compatible owner's next maintenance cycle uploads the imported state and publishes a fresh checkpoint only after a real push.
- The exported file is **not encrypted** and contains personal productivity data — the UI discloses this before export.
- Excluded from portable backup: linked-action events/executions, notification-processing state, `sync_outbox`, auth/session state, account protection/recovery state, backup checkpoint runtime metadata, schema migration metadata, and transient UI state.

### Recoverable Account V1

`core/auth/accountCoordinator.ts` coordinates the optional Supabase Auth boundary. A configured empty installation may use an anonymous session, but a populated SQLite dataset is durably associated with one Supabase user UUID in `app_meta.account.owner_user_id`. Losing Auth storage enters recovery-required state instead of creating a new anonymous owner; a different authenticated UUID enters owner-mismatch state. Local reads and writes continue in both states, while remote flush and restore pause.

Settings exposes **Protect backup with email** for an anonymous owner and **Recover existing backup** for an empty device or a bound dataset recovering its original owner. Protection uses the email-change verification flow and requires the post-verification UUID to match the original UUID. Existing-account recovery uses passwordless OTP with account creation disabled, binds only after verification, and then reuses the existing Restore V1 empty-device guard. Account merging, populated-device switching, ownership transfer, and full two-way sync are not supported.

### Flush and Auth Lifecycle

`AppProviders` wires sync and the account coordinator:

- Initializes SQLite, inspects all user-owned tables plus durable outbox owners, and calls `ensureAnonymousSession()` only for an empty/unbound dataset when Supabase env vars are configured
- Hydrates the durable outbox and restore preview only after account ownership is reconciled
- Registers `syncEngine.flush()` on:
  - 30-second interval
  - Web `visibilitychange` when page becomes hidden
  - NetInfo connectivity events when connected
- Gated by `isRemoteEnabled()` and verified account ownership (`remoteMode` defaults to `"enabled"`); every queued owner must match both the local binding and current verified Auth UID

## Quick Start

### Prerequisites

- Node.js 22.22.1–22.x required (the checked-in `.nvmrc` selects the CI/dev
  baseline)
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

The app is a single-page experience: `app/` contains only `_layout.tsx` and `index.tsx`. The six sections — Overview, Todos, Habits, Pomodoro, Workout, Calories — are rendered inside `app/index.tsx` behind `NavigationContext.activeSection`, switched by a top tab rail of plain `Pressable` items:

- Overview
- Todos
- Habits
- Pomodoro
- Workout
- Calories

Settings is a full-screen modal (not a route). The Command Center is a global overlay only — there is no `/command` route. Old URLs `/settings`, `/command`, and `/(tabs)/*` no longer exist.

The root layout mounts `GlobalCommandCenterHost`, so when `COMMAND_EXPERIMENT_ENABLED` is true the eligible sections show a floating launcher that opens a drawer on wide web and a bottom sheet elsewhere. The launcher is hidden while Settings is open and suppressed during active pomodoro/workout sessions.

Workout is the Gym V2 training workspace inside that tab: users can choose
built-in or custom exercises, build typed strength/bodyweight/timed/cardio
routines, reorder and schedule them, train from Today with durable session
drafts and previous-performance context, and review progression, PRs, trends,
training totals, and body-weight history. Quick-complete logs remain a separate
lightweight path for linked actions and fast entries.

## Command Shell

The Command Center is an experimental overlay-first quick-command shell, not a general assistant surface.

- The primary user-facing entry is the global overlay launcher across all six sections.
- The Command Center is a global overlay only (mounted by `GlobalCommandCenterHost` in `app/_layout.tsx`); there is no `/command` route.
- Supported draft kinds are limited to `create_todo` and `create_habit`.
- The flow is parse -> review -> confirm before write.
- Default parser mode is `mock`.
- Optional model-backed parsing uses `remote_with_fallback`, but only on internal-capable builds after a tester enables it locally.
- The local parser remains the fallback and guardrail path when remote parsing is disabled or unavailable.
- Todo due dates stay limited to `today`, `tomorrow`, or explicit `YYYY-MM-DD`.
- The CommandScreen's Ask mode toggle is gated behind `AI_ASK_EXPERIMENT_ENABLED` (false by default); Create mode is the primary surface.
- The Command Center copy stays intentionally experimental and draft-focused; it does not imply broad production AI availability.

Relevant env vars for the optional real parser path:

- `EXPO_PUBLIC_AI_COMMAND_PARSE_MODE` with `remote_with_fallback` to enable remote parsing
- `EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT` to allow the internal rollout toggle on supported builds
- `EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST`
- `EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME`
- `EXPO_PUBLIC_AI_COMMAND_PROXY_URL`

Internal rollout note:

- The model parser toggle is device-local and disposable.
- Clearing app storage may reset it.
- Testers can disable it locally at any time to return to mock mode immediately.

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

Test inventories are intentionally not hard-coded here because they change as
coverage evolves. Re-verify them with `npx vitest list` and
`npx playwright test --list`; the gate is zero failures in the applicable unit,
integration, web, and native lanes. Recoverable Account V1 coverage lives in
`tests/account.*`, `tests/integration/account*`, and
`e2e/journeys/recoverable-account-v1.spec.ts`.

## Additional Documentation

- Architecture map: `docs/PROJECT_STRUCTURE_MAP.md`
- Unified knowledge base: `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`
