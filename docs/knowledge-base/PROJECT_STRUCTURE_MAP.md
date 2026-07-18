# SuperHabits — Knowledge Base Project Structure Map

Companion map for the unified knowledge base. Canonical structure guidance remains in `docs/PROJECT_STRUCTURE_MAP.md`; this copy keeps the knowledge-base directory self-contained and in sync with current runtime files.

---

## Core directories

| Path        | Responsibility                                                                                        | Key files                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`      | Expo Router entry, stacks, tab shell, thin tab routes, command-center host wiring                     | `app/_layout.tsx`, `app/index.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/*.tsx`, `app/command.tsx`, `app/settings.tsx`                                                                            |
| `features/` | Feature modules with data/domain/screen layering plus the overlay-first command shell                 | `features/{feature}/{feature}.data.ts`, `features/{feature}/{feature}.domain.ts`, `features/{feature}/{Feature}Screen.tsx`, `features/command/*`                                                   |
| `core/`     | Shared infra: DB, sync, auth bootstrap, providers, UI primitives                                      | `core/db/client.ts`, `core/sync/sync.engine.ts`, `core/sync/supabase.adapter.ts`, `core/providers/AppProviders.tsx`, `core/auth/guestProfile.ts`, `core/pwa/registerServiceWorker.ts`, `core/ui/*` |
| `lib/`      | Pure helpers and platform utilities                                                                   | `lib/id.ts`, `lib/time.ts`, `lib/validation.ts`, `lib/supabase.ts`, `lib/useForegroundRefresh.ts`, `lib/notifications.ts`                                                                          |
| `tests/`    | Unit coverage for domain, command parsing/config, restore, linked actions, and selected data/db logic | `tests/*.test.ts` (including `sync.engine`, `db.client`, `calories.data`, `commandParser.facade`)                                                                                                  |

---

## Sync and remote architecture

- Queue engine: `core/sync/sync.engine.ts`
- Production adapter: `core/sync/supabase.adapter.ts` (`SupabaseSyncAdapter`)
- Remote auth/config: `lib/supabase.ts`
- Flush wiring + auth bootstrap: `core/providers/AppProviders.tsx`
- Synced write callers: `features/*/*.data.ts` for `todos`, `habits`, `calorie_entries`, `workout_routines`

---

## Routing and navigation

- Root provider wrapper + global command-center host: `app/_layout.tsx`
- Top tab UI + swipe navigation: `app/(tabs)/_layout.tsx`
- Thin route wrappers: `app/(tabs)/overview.tsx`, `todos.tsx`, `habits.tsx`, `pomodoro.tsx`, `workout.tsx`, `calories.tsx`
- Utility routes: `app/settings.tsx`, retained `app/command.tsx`
- `/` redirects to `/(tabs)/overview`
- Command launcher shows on the six tab surfaces, opens as a drawer on wide web and a bottom sheet elsewhere, and stays hidden on `/settings`

## Current product-shell facts

- Calories supports `Form` and `Diary` modes and remembers the last selected view through AsyncStorage.
- Settings currently uses six buckets: Appearance, Backup / Sync / Restore, AI / Command, Notifications / Timer defaults, Nutrition defaults, Developer / Internal.
- Supabase remains backup-oriented: push sync plus restore v1 preview/import, not full two-way sync.

## Quality baseline

- `npm test`: 340 tests in 32 files
- `npx playwright test --list`: 87 tests in 13 spec files
- Runtime schema version: 11
- Next migration slot: `if (version < 12)`

---

## Deployment and runtime config

- Web deploy config: `vercel.json` (`build:web` -> `dist`, SPA rewrite, COOP/COEP headers)
- EAS native build profiles: `eas.json` (preview APK profile for Android)
- Expo app config: `app.json` (includes Android package and EAS project metadata)
- Web shell assets: `public/sw.js`, `public/manifest.json`
- Build/test entry points: `package.json`, `playwright.config.ts`, `scripts/serve-e2e.js`

---

## Invariant reminder

- Data writes belong in `*.data.ts`; UI and domain layers do not access SQLite directly.
- Synced entities enqueue through `syncEngine.enqueue(...)` immediately after writes.
- IDs come from `createId(prefix)` and date keys from `toDateKey()`.
- Migrations are append-only in `core/db/client.ts` (`runMigrations`).
