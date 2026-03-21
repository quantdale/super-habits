# SuperHabits

Offline-first productivity app for **web (PWA)**, **iOS**, and **Android**. Data lives in SQLite on device; cloud sync is optional and gated behind remote mode (see `lib/supabase.ts`).

## Modules

| Tab        | Feature                                      |
| ---------- | -------------------------------------------- |
| To Do      | Task list                                    |
| Habits     | Habit tracking and completions               |
| Focus      | Pomodoro timer and session logging           |
| Workout    | Routines and completion checklist          |
| Calories   | Daily calorie log and totals                 |

## Stack

- **React Native** 0.83 · **Expo** 55 · **React** 19  
- **TypeScript** 5.9 · **expo-router** · **NativeWind** 4 (Tailwind)  
- **expo-sqlite** (WAL mode) · **Vitest** for unit tests  

## Prerequisites

- [Node.js](https://nodejs.org/) (use a current LTS; Expo SDK 55 is easiest on Node 20+)
- npm (ships with Node)

## Scripts

| Command              | Purpose                    |
| -------------------- | -------------------------- |
| `npm run start`      | Expo dev server            |
| `npm run web`        | Web / PWA dev              |
| `npm run android`    | Android                    |
| `npm run ios`        | iOS                        |
| `npm run typecheck`  | `tsc --noEmit`             |
| `npm run test`       | Vitest (CI-style, once)    |
| `npm run test:watch` | Vitest watch mode          |

## Project layout

- `features/*` — screens, `.data.ts` (SQLite), `.domain.ts` (pure logic)
- `app/*` — routes; tab shell in `app/(tabs)/`
- `core/*` — DB client, migrations, shared UI/sync helpers
- `lib/*` — IDs, time helpers, remote flags
- `tests/*` — Vitest specs (domain tests today; **19** passing tests)

Schema migrations run in `core/db/client.ts` (`runMigrations`). Stored schema version is tracked in `app_meta.db_schema_version` (currently **4**).

## Web / PWA notes

- **COEP** is set for `crossOriginIsolated` (shared-memory WASM on web); see `metro.config.js` and `app.json`.
- **Service worker** lives under `public/sw.js` (shell cache). Local dev targets use network-first behavior to avoid stale Metro bundles.

## Smoke test (manual)

1. Open **web** and a **native** target; confirm tabs load.
2. **To Do:** add, complete, and remove a task; confirm list updates.
3. **Habits:** add a habit and mark completion for today.
4. **Focus:** run a short pomodoro to completion; confirm a session is recorded.
5. **Workout:** create or use a routine and mark items done.
6. **Calories:** add entries; confirm daily total changes.
7. Force-close and reopen; confirm data persists.

## Contributing / data rules

Main entities use **soft delete** and a **sync enqueue** after writes when remote sync is enabled. Do not hard-delete synced rows or skip enqueue without reading the invariants in `.cursor/rules/superhabits-rules.mdc` (and the db/sync skill under `.cursor/skills/`).

**Known tradeoff:** `toDateKey()` in `lib/time.ts` uses UTC, not local midnight—changing it affects historical keys; coordinate before altering.
