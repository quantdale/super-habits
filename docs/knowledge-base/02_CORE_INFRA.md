# 02_CORE_INFRA.md

## Scope

This document covers **`core/`**: database client and schema bootstrap, TypeScript entity types, SQL reference files, sync engine, guest profile auth, React providers, PWA service worker registration, and shared UI components.

---

## Purpose

**What it does:** Provides shared infrastructure for the Expo app: **singleton SQLite** access with **CREATE TABLE** bootstrap and **versioned migrations**; **typed domain models** aligned with tables; a **pluggable sync queue** (default noop); **local-first “guest” profile** stored in `app_meta`; **React Query** + **gesture handler** root; **Workbox** service worker registration on web; and a small **UI kit** used by feature screens.

**Problem it solves:** Keeps persistence, cross-cutting UI, and future sync hooks in one place so feature modules stay thin and consistent.

---

## Tech stack

| Area | Evidence |
|------|----------|
| **expo-sqlite** | `import * as SQLite from "expo-sqlite"` in `core/db/client.ts` |
| **React / React Native** | `AppProviders`, `core/ui/*` use `react`, `react-native` |
| **@tanstack/react-query** | `QueryClient`, `QueryClientProvider` in `AppProviders.tsx` |
| **react-native-gesture-handler** | `GestureHandlerRootView`, `ScrollView` in `Screen.tsx`, `Pressable` in `Button.tsx` |
| **NativeWind / className** | `core/ui/*` and `Screen.tsx` use `className` |
| **workbox-window** | `Workbox` import in `registerServiceWorker.ts` |
| **TypeScript** | `.ts` / `.tsx` throughout |

---

## Architecture pattern

**Monolithic client shared library** inside a single app repo: **layered helpers** (DB singleton, sync engine, UI primitives) with **no separate npm package**. **Not** a microservice or server.

---

## Entry points

| Entry | Role |
|-------|------|
| **`initializeDatabase()`** | `core/db/client.ts` — exported async function; **await `getDatabase()`** (opens DB, runs bootstrap + migrations). |
| **`getDatabase()`** | Returns shared `Promise<SQLiteDatabase>`; lazy singleton. |
| **`AppProviders`** | `core/providers/AppProviders.tsx` — mounted from `app/_layout.tsx`; runs DB init, SW registration, guest profile in `useEffect`. |
| **`syncEngine`** | `core/sync/sync.engine.ts` — exported singleton `SyncEngine` instance used by feature `.data.ts` files. |
| **`registerServiceWorker()`** | `core/pwa/registerServiceWorker.ts` — called from `AppProviders` on mount. |
| **`ensureGuestProfile()`** | `core/auth/guestProfile.ts` — called from `AppProviders` on mount. |
| **UI components** | Imported by feature screens as needed (no single barrel export file in `core/ui/`). |

---

## Folder structure

| Path | Role |
|------|------|
| `core/db/client.ts` | SQLite singleton, `bootstrapStatements` (DDL), `runMigrations()` (version 2–4), `getDatabase`, `initializeDatabase`. |
| `core/db/types.ts` | Exported TypeScript types for entities (`Todo`, `Habit`, `CalorieEntry`, etc.). |
| `core/db/schema.sql` | **Reference** DDL (see Quirks — may diverge from runtime bootstrap). |
| `core/db/migrations/001_initial_supabase.sql` | Commented as reserved for post-MVP; defines `profiles` table (Postgres-style `uuid`, `timestamptz`) — **not** executed by `client.ts`. |
| `core/sync/sync.engine.ts` | `SyncRecord`, `SyncAdapter`, `NoopSyncAdapter`, `SyncEngine`, `syncEngine`. |
| `core/auth/guestProfile.ts` | Reads/writes `app_meta` key `guest_profile`; creates id via `createId("guest")`. |
| `core/providers/AppProviders.tsx` | `QueryClientProvider`, `GestureHandlerRootView`, startup side effects. |
| `core/pwa/registerServiceWorker.ts` | Registers `/sw.js` via Workbox on web only. |
| `core/ui/Screen.tsx` | Safe area + optional scroll + padding. |
| `core/ui/Button.tsx` | Primary / ghost / danger `Pressable` button. |
| `core/ui/Card.tsx` | White rounded container. |
| `core/ui/TextField.tsx` | Labeled text input; optional `unsignedInteger` digit filter. |
| `core/ui/SectionTitle.tsx` | Title + optional subtitle. |
| `core/ui/NumberStepperField.tsx` | Minus / plus stepper around numeric `TextInput`. |

---

## API surface (HTTP / REST)

**Not found** — `core/` exposes no HTTP endpoints.

---

## Data models

### Runtime SQLite tables (from `client.ts` bootstrap)

| Table | Purpose (inferred from DDL + `types.ts`) |
|-------|------------------------------------------|
| `todos` | Todo items with soft delete (`deleted_at`). |
| `habits` | Habit definitions with `category`, `icon`, `color`, soft delete. |
| `habit_completions` | Per-habit per-day counts; `UNIQUE(habit_id, date_key)`. |
| `pomodoro_sessions` | Completed timer sessions (no `deleted_at` in DDL). |
| `workout_routines` | Named routines, soft delete. |
| `workout_logs` | Completion logs per routine (no `deleted_at` in DDL). |
| `calorie_entries` | Food/macros/meal/day, soft delete. |
| `app_meta` | Key/value store (`db_schema_version`, `guest_profile`, etc.). |

### TypeScript types (`core/db/types.ts`)

| Type | Extends / fields |
|------|------------------|
| `BaseEntity` | `id`, `created_at`, `updated_at`, `deleted_at` |
| `Todo` | `title`, `notes`, `completed` (0 \| 1) |
| `HabitCategory` | `"anytime" \| "morning" \| "afternoon" \| "evening"` |
| `HabitIcon` | Union of string literals (Material icon names) |
| `Habit` | `name`, `target_per_day`, `reminder_time`, `category`, `icon`, `color` |
| `HabitCompletion` | `habit_id`, `date_key`, `count`, timestamps |
| `PomodoroSession` | `started_at`, `ended_at`, `duration_seconds`, `session_type` (`"focus" \| "break"`) |
| `WorkoutRoutine` | `name`, `description` |
| `WorkoutLog` | `routine_id`, `notes`, `completed_at` |
| `CalorieEntry` | `food_name`, macros, `meal_type`, `consumed_on` |

### Sync records (`core/sync/sync.engine.ts`)

| Field | Type |
|-------|------|
| `entity` | `string` |
| `id` | `string` |
| `updatedAt` | `string` |
| `operation` | `"create" \| "update" \| "delete"` |

### `001_initial_supabase.sql` (not wired to runtime)

| Object | Definition |
|--------|------------|
| `profiles` | `id uuid primary key`, `created_at timestamptz default now()` |

---

## Config & environment variables

| Item | Location | Notes |
|------|----------|-------|
| `app_meta` keys | SQLite | `db_schema_version` (string int), `guest_profile` (JSON serialized `GuestProfile`) |
| `.env` in `core/` | — | **Not found** |

---

## Inter-service communication

| Mechanism | Details |
|-----------|---------|
| **Sync engine** | `syncEngine.enqueue(record)` pushes to **in-memory** `queue`; `flush()` calls `adapter.push`. Default **`NoopSyncAdapter`** — no network. |
| **Remote backend** | **Not implemented** in `core/` — no Supabase/HTTP client here. |

---

## Auth & authorization

| Mechanism | Details |
|-----------|---------|
| **Guest profile** | `ensureGuestProfile()` ensures a row in `app_meta` with key `guest_profile` containing JSON `{ id, createdAt }` from `createId("guest")`. **No** passwords, OAuth, or role checks in `core/`. |
| **Route protection** | **Not found** in `core/` — no auth gate components. |

---

## Key business logic

| Module | Behavior |
|--------|----------|
| **`getDatabase()`** | Single cached promise; `openDatabaseAsync("superhabits.db")`, then exec bootstrap DDL, then `runMigrations()`. |
| **`runMigrations()`** | Reads `app_meta.db_schema_version`; applies ALTERs for versions 2 (habits `category`), 3 (habits `icon`, `color`), 4 (`calorie_entries.fiber`), idempotent try/catch. |
| **`SyncEngine`** | `enqueue` appends; `flush` snapshots queue, pushes via adapter, clears queue. |
| **`ensureGuestProfile()`** | Returns existing parsed profile or inserts new one. |
| **`registerServiceWorker()`** | One-shot; web only; registers `/sw.js`. |
| **`Screen`** | Optional `ScrollView` from gesture-handler; padding toggle. |
| **`TextField`** | Optional strip non-digits when `unsignedInteger`. |
| **`NumberStepperField`** | Clamps step between `min` and `max` (default 1–999). |

---

## Background jobs / scheduled tasks

**Not found** in `core/` — no `expo-background-fetch` / `expo-task-manager` usage in these files.

---

## Error handling

| Location | Behavior |
|----------|----------|
| `AppProviders` `useEffect` | `initializeDatabase().catch(...)` → **`console.error("[db] initializeDatabase failed", e)`** |
| `AppProviders` `useEffect` | `ensureGuestProfile().catch(() => undefined)` — **errors swallowed** |
| `getDatabase()` | On failure, clears `dbPromise` and rethrows |
| `core/ui/*` | **Not found** — no explicit error UI |

---

## Testing

| Item | Finding |
|------|---------|
| Tests importing `core/` | **Not found** under `tests/` (no `core/` path in test imports at time of writing). |
| Framework | Vitest (project-wide). |

---

## Deployment

**Not found** in `core/` — no `Dockerfile`, CI, or IaC. CI runs at repo root (`.github/workflows/ci.yml`).

---

## Quirks

1. **`schema.sql` vs runtime:** `core/db/schema.sql` **habits** table omits `category`, `icon`, `color` present in **`client.ts`** bootstrap — reference file is **not** the single source of truth. Project rules note `schema.sql` is reference-only.
2. **Supabase migration file:** `001_initial_supabase.sql` is **not** executed by `client.ts`; comment says “Reserved for post-MVP.”
3. **React Query:** `QueryClientProvider` wraps the app, but **`AppProviders` does not** pass queries from feature code in this file — **no** `useQuery` usage verified in `core/`.
4. **Sync:** `flush()` is **not** called automatically from `core/` — queue can grow until something calls `flush()` (project rules: sync queue in-memory only).
5. **Web vs native:** WAL pragma is **skipped** on `Platform.OS === "web"` in `client.ts`.
6. **`Button` ghost variant:** Uses `variant === "ghost"` → `bg-slate-200` but label text remains **`text-white`** — may reduce contrast (visual quirk).

---

## Open questions

1. Whether **`flush()`** is invoked anywhere on app lifecycle or only manually — **requires** searching the full repo outside `core/`.
2. Intended use of **`QueryClient`** without feature-level hooks — **not documented** in `core/`.
3. Whether **`profiles`** in `001_initial_supabase.sql` will map to **`guest_profile`** or replace it — **not specified** in code.
