# KNOWLEDGE_BASE.md

**SuperHabits — consolidated knowledge base**  
Generated from repository analysis and section files under `docs/knowledge-base/`. Paths below are relative to that folder unless noted.

---

## Master table of contents

| # | File | Topic |
|---|------|--------|
| 0 | [00_INDEX.md](./00_INDEX.md) | Discovery: repo layout, tech stack summary, dependency map, documentation order |
| 1 | [01_APP_ROUTING.md](./01_APP_ROUTING.md) | Expo Router: `app/`, tabs, entry points, legacy `App.tsx` / `index.ts` |
| 2 | [02_CORE_INFRA.md](./02_CORE_INFRA.md) | `core/`: SQLite, migrations, sync engine, guest profile, providers, PWA, UI kit |
| 3 | [03_LIB_SHARED.md](./03_LIB_SHARED.md) | `lib/`: IDs, time, notifications, remote-mode stub |
| 4 | [04_FEATURES.md](./04_FEATURES.md) | `features/*`: todos, habits, pomodoro, workout, calories |
| 5 | [05_QA_AND_TOOLING.md](./05_QA_AND_TOOLING.md) | Tests, CI, patches, devcontainer, Babel/Metro/Tailwind, `public/sw.js` |
| 6 | [06_EDITOR_AND_DOCS.md](./06_EDITOR_AND_DOCS.md) | `.cursor/` rules/skills/commands/agents, `README.md`, doc gaps |

---

## Executive summary

**What it is:** **SuperHabits** is a single-repository, **offline-first** **React Native** app built with **Expo 55**, **TypeScript**, and **expo-router**, targeting **web (PWA)**, **iOS**, and **Android**. It ships five MVP areas: **to-dos**, **habits** (with daily completions), **Pomodoro** timer, **workout** routines and logs, and **calorie** logging with macro-derived energy.

**What it does:** Persists data in **SQLite** (`expo-sqlite`, file `superhabits.db`) on device, with a **guest profile** stored in `app_meta`. Selected entities enqueue records into an in-memory **sync engine** (default **noop** adapter) for a future cloud sync story. The UI uses **NativeWind** (Tailwind-style `className`), shared components under **`core/ui`**, and a **sidebar-style tab** layout under **`app/(tabs)`**.

**Who it serves:** End users wanting a **local-first** productivity and tracking tool without a documented production deployment or multi-user cloud product in this repo—**MVP / active development** per project rules.

---

## Cross-cutting concerns

| Concern | Where it lives | Behavior |
|--------|----------------|----------|
| **Navigation shell** | `app/_layout.tsx`, `app/(tabs)/_layout.tsx` | `AppProviders` + Stack; custom `expo-router/ui` tabs with collapsible labels. |
| **Database singleton** | `core/db/client.ts` | `getDatabase()` / `initializeDatabase()`; bootstrap DDL + versioned `runMigrations()`. |
| **Entity types** | `core/db/types.ts` | Shared TS types for rows and domain shapes. |
| **IDs & time** | `lib/id.ts`, `lib/time.ts` | `createId(prefix)`, `nowIso()`, `toDateKey()` (UTC date key — known caveat). |
| **Sync contract** | `core/sync/sync.engine.ts` | `syncEngine.enqueue()` after many writes; **`flush()` not wired** to lifecycle; queue **in-memory**. |
| **App bootstrap** | `core/providers/AppProviders.tsx` | DB init, service worker on web, guest profile; **React Query** `QueryClient` provided, **hooks largely unused**. |
| **PWA (web)** | `core/pwa/registerServiceWorker.ts`, `public/sw.js`, Workbox | SW registration + caching strategy for shell assets. |
| **Styling system** | `tailwind.config.js`, `global.css`, NativeWind | Brand palette (`brand-*`), content globs for `app/`, `features/`, `core/`. |
| **Quality gate** | `npm run typecheck`, `npm test`, `.github/workflows/ci.yml` | CI runs `npm ci`, typecheck, Vitest. |
| **Editor/agent rules** | `.cursor/rules/superhabits-rules.mdc` | Soft delete, sync enqueue, migration rules, known bugs. |

---

## Inconsistencies and gaps

### Documentation vs runtime

| Issue | Detail |
|-------|--------|
| **Test count** | Baselines aligned to **7 tests** (run `npm test` to verify). Update rules when tests change. |
| **Schema version in Cursor assets** | Aligned to **stored version 4**, **next migration 5** (`core/db/client.ts` `runMigrations`). |
| **`schema.sql` vs bootstrap** | DDL in `core/db/schema.sql` does not match full runtime bootstrap (e.g. habits columns). **Runtime** DDL in `client.ts` is authoritative. |
| **`feature-module` skill examples** | References illustrative functions that may not exist in the repo (e.g. streak helpers). |
| **`sync` record shape** | `db-and-sync-invariants` skill text mentions fields like `payload`/`table`; **`sync.engine.ts`** uses `entity`, `id`, `updatedAt`, `operation`. |

### Product / code gaps

| Gap | Detail |
|-----|--------|
| **`CODEBASE_KNOWLEDGE.md`** | **Not found** at repository root in this workspace. |
| **HTTP API** | **None** — no backend in repo. |
| **Deployment** | **No** Dockerfile, EAS config, or release workflow observed. |
| **Coverage** | **No** Vitest coverage configuration. |
| **ESLint / Prettier** | **No** committed config files; CI does not run ESLint. |
| **DB / UI tests** | **No** automated tests for SQLite `*.data.ts` or React screens. |
| **`App.tsx` / `index.ts`** | Legacy `registerRootComponent` path; **`package.json` `main`** is **`expo-router/entry`**. |
| **FlashList** | **v2** typings omit `estimatedItemSize` (v1-era docs may still mention it). Skill updated to match `@shopify/flash-list@2.x`. |

### Data / UX quirks (cross-feature)

| Topic | Detail |
|-------|--------|
| **`toDateKey()`** | Uses **UTC**; local “today” may disagree. |
| **Calories `mealType`** | UI passes **`"snack"`** always. |
| **`nextPomodoroState`** | Implemented and tested; **not** used by `PomodoroScreen` UI. |
| **Todos** | When **no pending** tasks, **completed-only** tasks are **not** shown (see `04_FEATURES.md`). |
| **Habit completions** | **Hard-delete** row when count 0←1; exception to soft-delete rule for that table. |

---

## Glossary

| Term | Meaning |
|------|---------|
| **app_meta** | SQLite key/value table for `db_schema_version`, `guest_profile`, etc. |
| **BaseEntity** | `core/db/types` shape: `id`, `created_at`, `updated_at`, `deleted_at`. |
| **COOP / COEP** | Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy — set in Metro middleware and `app.json` for Expo Router web. |
| **data-agent** | Cursor agent definition: owns DB, migrations, `*.data.ts`, `lib/id`, `lib/time`. |
| **date_key** | `YYYY-MM-DD` string for habit completions and calorie day grouping; produced by **`toDateKey()`** (UTC). |
| **Expo Router** | File-based router; `app/` maps to routes; `main` = `expo-router/entry`. |
| **feature-agent** | Cursor agent definition: owns screens, `*.domain.ts`, `core/ui`, `app/`. |
| **FlashList** | `@shopify/flash-list` virtualized list (used in todos). |
| **guest** | Local-only profile: `createId("guest")`, JSON in `app_meta.guest_profile`. |
| **hcmp** | ID prefix for habit completion rows (`habit_completions`). |
| **Metro** | React Native bundler; configured with NativeWind and `wasm` asset extension. |
| **NativeWind** | Tailwind-in-`className` for React Native; uses `global.css` as input. |
| **NoopSyncAdapter** | `SyncEngine` default: `push`/`pull` no-ops. |
| **PWA** | Progressive Web App — service worker + static web output (`app.json` web config). |
| **Soft delete** | Set `deleted_at` instead of removing row; filter `deleted_at IS NULL`. |
| **SuperHabits** | Product name; SQLite DB file `superhabits.db`. |
| **syncEngine** | Singleton `SyncEngine` instance; **`enqueue`** records; **`flush`** pushes to adapter. |
| **SyncRecord** | `{ entity, id, updatedAt, operation }` for sync queue. |
| **TabTrigger / TabSlot** | `expo-router/ui` primitives for custom tab UI in `(tabs)/_layout.tsx`. |
| **WAL** | SQLite write-ahead logging — `PRAGMA journal_mode = WAL` on non-web platforms. |
| **Workbox** | Library used to register `public/sw.js` on web (`workbox-window`). |
| **wrk** | ID prefix used for **workout routines** and **workout log** rows (same prefix string). |

**Acronyms**

| Acronym | Expansion |
|---------|-----------|
| **CI** | Continuous Integration (GitHub Actions). |
| **COEP** | Cross-Origin-Embedder-Policy. |
| **COOP** | Cross-Origin-Opener-Policy. |
| **DDL** | Data Definition Language (CREATE TABLE, etc.). |
| **MCP** | Not used in application code — **not found** in repo. |
| **MVP** | Minimum viable product (README / rules). |
| **PWA** | Progressive Web App. |
| **RN** | React Native. |
| **SQL** | SQLite SQL dialect via `expo-sqlite`. |
| **SW** | Service worker (`/sw.js`). |
| **TS** | TypeScript. |
| **UI** | User interface; `core/ui` shared components. |
| **UTC** | Coordinated Universal Time — `toDateKey`/`toISOString` slice behavior. |
| **WAL** | Write-Ahead Logging (SQLite). |

---

## Maintenance

When the codebase changes materially, update the numbered section files and this master document—especially **test counts**, **schema version**, and **sync/type shapes**.
