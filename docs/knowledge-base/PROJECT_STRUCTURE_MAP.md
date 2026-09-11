# SuperHabits — Knowledge Base Project Structure Map

Companion map for the unified knowledge base. Canonical structure guidance remains in `docs/PROJECT_STRUCTURE_MAP.md`; this copy keeps the knowledge-base directory self-contained and in sync with current runtime files.

---

## Core directories

| Path        | Responsibility                                                                                                          | Key files                                                                                                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`      | Expo Router entry, single-page shell, command-center host wiring                                                        | `app/_layout.tsx`, `app/index.tsx`                                                                                                                                                                             |
| `features/` | Feature modules with data/domain/screen layering plus the overlay-first command shell                                   | `features/{feature}/{feature}.data.ts`, `features/{feature}/{feature}.domain.ts`, `features/{feature}/{Feature}Screen.tsx`, `features/command/*`                                                               |
| `core/`     | Shared infra: DB, sync, auth bootstrap, providers, UI primitives                                                        | `core/db/client.ts`, `core/sync/sync.engine.ts`, `core/sync/supabase.adapter.ts`, `core/providers/AppProviders.tsx`, `core/providers/NavigationProvider.tsx`, `core/pwa/registerServiceWorker.ts`, `core/ui/*` |
| `lib/`      | Pure helpers and platform utilities                                                                                     | `lib/id.ts`, `lib/time.ts`, `lib/validation.ts`, `lib/supabase.ts`, `lib/useForegroundRefresh.ts`, `lib/notifications.ts`                                                                                      |
| `tests/`    | Unit + integration coverage for domain, command parsing/config, restore, linked actions, sync, and data-layer contracts | `tests/**/*.test.ts`, `tests/integration/**/*.test.ts` (real better-sqlite3 via `tests/integration/helpers/db.ts`)                                                                                             |

---

## Sync and remote architecture

- Queue engine: `core/sync/sync.engine.ts`
- Production adapter: `core/sync/supabase.adapter.ts` (`SupabaseSyncAdapter`)
- Remote auth/config: `lib/supabase.ts`
- Flush wiring + auth bootstrap: `core/providers/AppProviders.tsx`
- Synced write callers: all 21 `BACKUP_ENTITIES` (`core/backup/backup.types.ts`) ride the durable outbox through `runSyncedMutation`/`runBackupMutation` in `features/*/*.data.ts`; only local operational state (`linked_action_events`, `linked_action_executions`, `processed_notification_actions`) stays unsynced

---

## Routing and navigation

- Root provider wrapper + single-page shell: `app/_layout.tsx` and `app/index.tsx`
- Six sections (`overview`, `todos`, `habits`, `pomodoro`, `workout`, `calories`) render inside `app/index.tsx`, switched by `NavigationContext.activeSection` (`core/providers/NavigationProvider.tsx`) with a section switcher of plain `Pressable` items
- Settings is a full-screen modal (`isSettingsOpen` / `openSettings` / `closeSettings`), not a route
- Global command-center host: `app/_layout.tsx` mounts `GlobalCommandCenterHost`; the Command Center is a global overlay only (`features/command/CommandCenterProvider.tsx`) — no `/command` route
- Command Center has no standalone launcher; the single global Add action opens Quick Capture, and Add → Describe it opens Command Center as a drawer on wide web or a bottom sheet elsewhere

## Current product-shell facts

- Calories supports `Form` and `Diary` modes and remembers the last selected view through AsyncStorage.
- Settings currently uses these sections, in render order: Appearance, Accessibility, Backup / Sync / Restore, Portable data, Capture, Notifications / Timer defaults (Notifications + Pomodoro defaults), Nutrition defaults, Developer / Internal.
- Backup/recovery is Backup Completeness V2 (owner-scoped, 21 recoverable entities, versioned integrity manifest) plus atomic Restore V2, Portable Backup V1 (file export/import without Supabase), and the labeled legacy Restore V1 path — still backup + restore, not full two-way sync.

## Quality baseline

- Test inventories drift; verify them with `npx vitest list` and `npx playwright test --list` rather than relying on hard-coded counts (the authoritative current baselines live in `AGENTS.md`).
- Runtime schema version: 25 (migration 25 adds the local-only reward ledger — `gamification_events`, `gamification_streak_freezes`, `gamification_quests`, `gamification_badges`; migration 22 adds Gym V2 routine/session fields plus custom exercise, weekly-plan, schedule-override, and body-weight tables; migration 23 adds semantic aliases/instructions and unilateral/external-load snapshots; migration 24 adds hot-path range indexes for pomodoro_sessions.started_at, workout_logs.completed_at, habit_completions.date_key, and a partial pending-todos index; migration 21 adds `daily_plans.top_todo_titles`; 16–19 planning entities; 20 hardening-wave-v2 durable-state promotion)
- Next migration slot: `if (version < 26)`

---

## Deployment and runtime config

- Web deploy config: `vercel.json` (`build:web` -> `dist`, SPA rewrite, COOP/COEP headers)
- EAS native build profiles: `eas.json` (preview APK profile for Android plus `development`, `production`, and credential-free `e2e-test`)
- Expo app config: `app.json` (includes Android package and EAS project metadata)
- Web shell assets: `public/sw.js`, `public/manifest.json`
- Build/test entry points: `package.json`, `playwright.config.ts`, `scripts/serve-e2e.js`

---

## Invariant reminder

- Data writes belong in `*.data.ts`; UI and domain layers do not access SQLite directly.
- Synced entities enqueue through `syncEngine.enqueue(...)` immediately after writes.
- IDs come from `createId(prefix)` and date keys from `toDateKey()`.
- Migrations are append-only in `core/db/client.ts` (`runMigrations`).
