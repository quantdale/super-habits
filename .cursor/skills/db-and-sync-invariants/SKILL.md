---
name: db-and-sync-invariants
description: Database and sync invariants for SuperHabits. Use when writing SQLite schema, migrations, *.data.ts files, or any code that touches core/db/, lib/id.ts, or lib/time.ts.
---

# DATABASE & SYNC INVARIANTS — SuperHabits

Read this before writing any code that touches the database or data layer.

## SQLite setup
- DB file: superhabits.db (WAL mode)
- Singleton: core/db/client.ts exports getDatabase()
- All data functions start with: const db = await getDatabase()
- NEVER open a second connection. NEVER access db before await getDatabase().
- Bootstrap DDL runs once on first open (core/db/client.ts).
- Migrations run sequentially via a version switch in core/db/client.ts.

## Schema version
- Current stored version: **10** (`app_meta.db_schema_version`)
- Next migration number: **11** (add `if (version < 11) { ... }` in `runMigrations()` in `core/db/client.ts` when a schema change lands)
- Migrations live in: core/db/migrations/ (reference) + inline in `runMigrations()` in `core/db/client.ts`
- schema.sql is a REFERENCE ONLY — not executed at runtime
- To add a column or table: add a new migration block only; never alter past `if (version < N)` blocks or the bootstrap DDL in place

## Entity types (core/db/types.ts)
BaseEntity fields (on ALL mutable entities):
  id: string          — createId() format: {prefix}_{timestamp}_{random8}
  created_at: string  — ISO 8601 UTC via nowIso()
  updated_at: string  — ISO 8601 UTC via nowIso()
  deleted_at: string | null — null = active, non-null = soft deleted

Exported shapes include: **Todo**, **Habit**, **HabitCompletion**, **PomodoroSession**, **WorkoutRoutine**, **WorkoutLog**, **RoutineExercise**, **RoutineExerciseSet**, **WorkoutSessionExercise**, **CalorieEntry**, **SavedMeal** (and related unions such as **TodoPriority**, **TodoRecurrence**, **HabitCategory**, **HabitIcon**). Runtime metadata keys (e.g. `db_schema_version`) live in the **app_meta** table, not as a TS export.

## Soft delete rule
NEVER: DELETE FROM todos WHERE id = ?
ALWAYS: UPDATE todos SET deleted_at = datetime('now') WHERE id = ?
ALWAYS: SELECT ... FROM todos WHERE deleted_at IS NULL

Hard deletion permanently destroys data with no recovery. The app has
no recycle bin. Soft delete is the only delete.

Exception: habit_completions uses hard delete (toggle off = DELETE).

## Sync enqueue rule
After every INSERT or UPDATE on main entities, call:
  syncEngine.enqueue({ entity, id, updatedAt, operation })
  where operation is `"create" | "update" | "delete"` — `SyncRecord` shape in `core/sync/sync.engine.ts` is `{ entity: string; id: string; updatedAt: string; operation: ... }` (not `payload`, `table`, or `timestamp`).

Entities that DO sync: todos, habits, calorie_entries, workout_routines (enqueue entity names match syncEngine usage in *.data.ts)
Entities that do NOT sync: pomodoro_sessions, workout_logs, habit_completions
(This is intentional — local-only data.)

The exported **`syncEngine`** uses **`SupabaseSyncAdapter`** (push upsert to Supabase when the client is configured). **`NoopSyncAdapter`** remains the `SyncEngine` constructor default for tests. **`enqueue()` always runs** — it fills the in-memory queue; never skip it on writes.

## ID generation
File: lib/id.ts
Function: createId(prefix: string): string
Output format: {prefix}_{timestamp_ms}_{8_random_chars}
Examples:
  createId("todo")  → "todo_1741234567890_a3f9b2c1"
  createId("habit") → "habit_1741234567890_x9k2m4n7"
  createId("cal")   → "cal_1741234567890_p1q8r3s5"

NEVER use: Math.random(), crypto.randomUUID(), or Date.now() alone as IDs.

## Timestamp helpers (lib/time.ts)
nowIso(): string     — returns current UTC time as ISO 8601 string
                       use for created_at, updated_at
toDateKey(date: Date): string — returns YYYY-MM-DD using the device’s **local**
                       calendar date (getFullYear / getMonth / getDate).
                       Migration 5 records `app_meta.date_key_format` = `local` and
                       `date_key_cutover` (ISO timestamp). Rows written before that
                       cutover used UTC calendar dates; no automatic backfill.

## Adding a new table
1. Add TypeScript type to core/db/types.ts (extending BaseEntity where appropriate)
2. Add DDL in a **new** migration block in `core/db/client.ts` (next: `if (version < 11) { ... }` today — bump to N+1 when version advances)
3. Create features/{name}/{name}.data.ts with CRUD functions
4. Every function: getDatabase() → soft delete for deletes → enqueue sync (where applicable)
5. Add unit tests for domain functions in tests/
6. Add E2E data persistence coverage: `e2e/{name}.spec.ts` should include a test that adds a row, reloads the page, and confirms the row is still visible — validates SQLite write → read → render. Run: `npx playwright test e2e/{name}.spec.ts`

## UNIQUE constraint on habit_completions
UNIQUE(habit_id, date_key) — enforced at DB level

Data layer (`features/habits/habits.data.ts`):
- **Increment:** SELECT → if no row: INSERT (new row, count=1); if row exists: UPDATE (count+1).
- **Decrement:** SELECT → if count === 1: DELETE (hard delete — allowed exception); else UPDATE (count−1).
- Hard delete is the allowed exception for this table — it is not a synced entity; **no** `syncEngine.enqueue()` needed.

Do not use INSERT OR REPLACE for this flow. Do not introduce duplicate INSERTs for the same (habit_id, date_key).

## E2E infrastructure checks (`e2e/infrastructure.spec.ts`)

The E2E suite includes `e2e/infrastructure.spec.ts`, which verifies (among other things):
- COEP is `require-corp` (not `credentialless`)
- COOP is `same-origin`
- `crossOriginIsolated` is `true` (required for SQLite WASM on web)
- Service worker / shell cache behavior (e.g. `superhabits-shell-v3` / `CACHE_VERSION` in `public/sw.js` — see spec assertions)
- Localhost serves assets from network (SW dev bypass active)
- OPFS lock: second context/tab surfaces lock-related errors when another holds the DB
- No `[db] initializeDatabase failed` (or equivalent) on clean load

Run after changes to `metro.config.js`, `app.json`, `public/sw.js`, or `core/providers/AppProviders.tsx`:
  npx playwright test e2e/infrastructure.spec.ts
