# SuperHabits — Knowledge Base Project Structure Map

Companion map for the unified knowledge base. Canonical structure guidance remains in `docs/PROJECT_STRUCTURE_MAP.md`; this copy keeps the knowledge-base directory self-contained and in sync with current runtime files.

---

## Core directories

| Path | Responsibility | Key files |
|------|----------------|-----------|
| `app/` | Expo Router entry, stacks, tab shell, thin tab routes | `app/_layout.tsx`, `app/index.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/*.tsx` |
| `features/` | Feature modules with data/domain/screen layering | `features/{feature}/{feature}.data.ts`, `features/{feature}/{feature}.domain.ts`, `features/{feature}/{Feature}Screen.tsx` |
| `core/` | Shared infra: DB, sync, auth bootstrap, providers, UI primitives | `core/db/client.ts`, `core/sync/sync.engine.ts`, `core/sync/supabase.adapter.ts`, `core/providers/AppProviders.tsx`, `core/auth/guestProfile.ts`, `core/pwa/registerServiceWorker.ts`, `core/ui/*` |
| `lib/` | Pure helpers and platform utilities | `lib/id.ts`, `lib/time.ts`, `lib/validation.ts`, `lib/supabase.ts`, `lib/useForegroundRefresh.ts`, `lib/notifications.ts` |
| `tests/` | Unit coverage for domain, sync engine, and selected data/db logic | `tests/*.test.ts` (including `sync.engine`, `db.client`, `calories.data`) |

---

## Sync and remote architecture

- Queue engine: `core/sync/sync.engine.ts`
- Production adapter: `core/sync/supabase.adapter.ts` (`SupabaseSyncAdapter`)
- Remote auth/config: `lib/supabase.ts`
- Flush wiring + auth bootstrap: `core/providers/AppProviders.tsx`
- Synced write callers: `features/*/*.data.ts` for `todos`, `habits`, `calorie_entries`, `workout_routines`

---

## Routing and navigation

- Root provider wrapper: `app/_layout.tsx`
- Top tab UI + swipe navigation: `app/(tabs)/_layout.tsx`
- Thin route wrappers: `app/(tabs)/overview.tsx`, `todos.tsx`, `habits.tsx`, `pomodoro.tsx`, `workout.tsx`, `calories.tsx`

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
