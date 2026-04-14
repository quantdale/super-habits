# SuperHabits — Project Structure Map

## Error Handling and Validation Flows
- Error handling strategies are documented in README and knowledge base.
- Validation is hard-reject; errors are surfaced to users.
- See audit findings for more details.


Token-dense navigation map. Authoritative detail: `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`. **Schema v11** → next migration: `if (version < 12)` in `core/db/client.ts`. Linked Actions foundation is merged on `main` (rules/events/executions schema, engine/effects contracts, notice scaffold, settings preview scaffold, first habits source entrypoint).

---

## 1. Core directory roles

| Path | Role |
|------|------|
| **`app/`** | Expo Router only: root stack, index redirect, `(tabs)/_layout` + **thin** `*.tsx` per tab (each renders one `*Screen`). No business logic. |
| **`core/`** | Cross-cutting infra: **DB singleton + migrations** (`core/db/client.ts`), **entity types** (`core/db/types.ts`), **sync queue** (`core/sync/sync.engine.ts`), **Linked Actions** (`core/linked-actions/*`), provider bootstrap (`core/providers/AppProviders.tsx`), guest profile (`core/auth/guestProfile.ts`), PWA SW registration (`core/pwa/registerServiceWorker.ts`), shared **`core/ui/`** primitives. |
| **`features/`** | Product modules: `{feature}.data.ts` (SQLite + enqueue), optional `{feature}.domain.ts` (pure), `*Screen.tsx` + subcomponents, `types.ts` barrel, `features/shared/` for cross-feature UI. |
| **`lib/`** | Pure / platform helpers: `id`, `time`, `validation`, **`supabase`** (client + anonymous session + `remoteMode`), `useForegroundRefresh`, notifications, horizontal scroll style. **No** `features/`, **no** DB. |
| **`constants/`** | Design tokens (e.g. `sectionColors.ts` — per-tab section palette). |
| **`tests/`** | Vitest: `lib/`, `*.domain.ts`, validation, sync engine tests, Linked Actions tests, and selected data/DB tests (`calories.data`, `db.client`). |

**Also:** `e2e/` Playwright (+ `playwright.config.ts`, `scripts/serve-e2e.js`); `public/` static (`sw.js`, `manifest.json`); `assets/` images; `patches/` patch-package; deployment config `vercel.json` (web PWA) and `eas.json` (native builds); Expo app config in `app.json`.

---

## 2. Feature module pattern

```
features/{name}/
  {name}.data.ts    ← SQLite CRUD, syncEngine.enqueue, createId/toDateKey/nowIso
  {name}.domain.ts  ← pure logic, no DB/React (optional but preferred for rules/math)
  {Name}Screen.tsx  ← UI: calls .data + .domain, core/ui, constants, lib/validation
  types.ts          ← re-exports / narrow types
app/(tabs)/{name}.tsx → default export <{Name}Screen /> only
```

- **Screen** orchestrates; **never** `getDatabase()` in screen.
- **Data** owns writes, soft delete, `syncEngine.enqueue` where applicable.
- **Domain** unit-tested; **data** may import **domain** pure helpers (e.g. `kcalFromMacros`, `getTomorrowDateKey`).

---

## 3. Database & sync authority (single sources of truth)

| Concern | File | Notes |
|---------|------|--------|
| **Persistence** | `core/db/client.ts` | `getDatabase()`, `initializeDatabase()`, bootstrap DDL, **append-only** `runMigrations()`, WAL native-only. `schema.sql` = reference, **not** runtime. |
| **Row shapes** | `core/db/types.ts` | TypeScript entity types consumed by data layer. |
| **Sync** | `core/sync/sync.engine.ts`, `core/sync/supabase.adapter.ts` | `SyncRecord`, `SyncEngine`, `syncEngine.enqueue`, `flush` → **`SupabaseSyncAdapter`** on the exported **`syncEngine`** (push upsert; `NoopSyncAdapter` remains for ctor default / tests). **Not** duplicated elsewhere. |

Remote flush (30s interval / visibility hidden / NetInfo reconnect) when `isRemoteEnabled()` (`lib/supabase.ts`, default **enabled**) — wired in `AppProviders` alongside **`ensureAnonymousSession()`**.

---

## 4. Dependency invariants

### Allowed (summary)

- `app/` → `AppProviders`, `features/*Screen`, expo-router layouts.
- `features/*Screen` → `*.data`, `*.domain`, `core/ui`, `constants`, `lib` (e.g. validation, time), `features/shared`.
- `features/*.data` → `core/db/client`, `core/db/types`, `core/sync/sync.engine`, `lib/id`, `lib/time`, `lib/validation`; **may** import `features/*.domain` pure functions.
- `features/*.domain` → `lib/time`, `constants`, `features/shared` types; **no** `getDatabase`, **no** React.
- `core/ui` → RN, NativeWind; may use `lib/horizontalScrollViewportStyle`.
- `core/db/client` → expo-sqlite, Platform; **no** feature imports.
- `lib/` → **no** features, **no** DB.

### Violations (do not)

- `getDatabase` in `*Screen.tsx` or `*.domain.ts`.
- `syncEngine.enqueue` from UI — only from **`*.data.ts`** after mutating writes.
- `DELETE FROM` on main entity tables (soft delete + filter `deleted_at IS NULL`), except documented exceptions (`habit_completions` at count 0; `saved_meals` hard delete).
- Edit past migration blocks; non-append schema changes.

---

## 5. Entity prefix registry (`createId` in `lib/id.ts`)

Format: `{prefix}_{ms}_{rand8}` — not crypto-strong; local IDs only.

| Prefix | Entity / use |
|--------|----------------|
| `todo` | `todos` |
| `habit` | `habits` |
| `hcmp` | `habit_completions` |
| `cal` | `calorie_entries` |
| `smeal` | `saved_meals` |
| `wrk` | `workout_routines`, `workout_logs`, session log ids |
| `ex` | `routine_exercises` |
| `eset` | `routine_exercise_sets` |
| `wsex` | `workout_session_exercises` |
| `pom` | `pomodoro_sessions` |
| `guest` | guest profile (`app_meta`) |
| `rec` | `todos.recurrence_id` (daily series) |

---

## 6. Quick “where does X live?”

| Logic type | Location |
|------------|----------|
| Route / tab shell | `app/` |
| SQL, migrations, `getDatabase` | `core/db/client.ts` only |
| Entity TS types | `core/db/types.ts` |
| Sync queue API | `core/sync/sync.engine.ts` |
| Linked Actions contracts/engine | `core/linked-actions/*` |
| Reusable RN UI chrome | `core/ui/` |
| Feature CRUD + enqueue | `features/*/*.data.ts` |
| Pure rules, streaks, formatting | `features/*/*.domain.ts` |
| Screens & wiring | `features/*/*Screen.tsx` |
| IDs / date keys | `lib/id.ts`, `lib/time.ts` (`toDateKey` for YYYY-MM-DD) |
| Form messages | `lib/validation.ts` |
| Section colors | `constants/sectionColors.ts` |
| Unit tests | `tests/*.test.ts` |

---

## 7. Sync enqueue (by entity string)

Enqueued after writes: **todos**, **habits** (not completions), **calorie_entries**, **workout_routines** (+ bump after nested routine edits).

**Not synced:** `pomodoro_sessions`, `workout_logs`, `habit_completions`, `saved_meals`, `workout_session_exercises`, nested workout tables (routine row bump covers remote story).
