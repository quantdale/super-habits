# KNOWLEDGE_BASE.md

**SuperHabits — consolidated knowledge base**  
Section files live in `docs/knowledge-base/`. Paths below are relative to that folder.

---

## Master table of contents

| # | File | Topic |
|---|------|--------|
| 0 | [00_INDEX.md](./00_INDEX.md) | Repo layout, cross-feature map, **full dependency inventory** |
| 1 | [01_APP_ROUTING.md](./01_APP_ROUTING.md) | `app/`, Expo Router, tabs, sidebar (`NAV_ITEMS`, `sidebarCollapsed`), entry points |
| 2 | [02_CORE_INFRA.md](./02_CORE_INFRA.md) | **`bootstrapStatements` verbatim DDL**, **`runMigrations` cases 2–4**, **SyncEngine queue/flush**, guest profile, **AppProviders effects**, UI prop tables |
| 3 | [03_LIB_SHARED.md](./03_LIB_SHARED.md) | **`createId` algorithm**, **`toDateKey` UTC blast radius**, notifications, remote stub |
| 4 | [04_FEATURES.md](./04_FEATURES.md) | All features: **SQL per function**, screen state, **Todos FlashList quirk**, **Habits modal**, **Pomodoro timer**, **Calories form**, **habit increment/decrement SQL** |
| 5 | [05_QA_AND_TOOLING.md](./05_QA_AND_TOOLING.md) | **Tests (every `it`)**, **CI steps**, configs, **Metro/COOP/COEP**, **Tailwind brand hexes**, **`public/sw.js`**, patches |
| 6 | [06_EDITOR_AND_DOCS.md](./06_EDITOR_AND_DOCS.md) | **`.cursor` commands/agents/skills` reference**, README, doc gaps |

---

## Executive summary

**What it is:** **SuperHabits** is an **offline-first** **React Native** app (**Expo 55**, **TypeScript 5.9**, **expo-router**) targeting **web (PWA)**, **iOS**, and **Android**. Five MVP areas: **to-dos**, **habits** (daily completion counts per UTC date key), **Pomodoro** (25-minute focus, local session log), **workout** routines + completion logs, **calories** (macro-derived kcal).

**Persistence:** **SQLite** via **expo-sqlite** (`superhabits.db`), singleton **`getDatabase()`**. DDL from **`bootstrapStatements`** in `core/db/client.ts` plus **versioned migrations** (stored version **4**, next **5**). **Guest profile** JSON in **`app_meta`**.

**Sync:** **`syncEngine.enqueue`** after writes on todos, habits, calorie_entries, workout_routines. **`flush()`** runs on interval / visibility / NetInfo **only if** **`isRemoteEnabled()`** (`lib/supabase.ts`); default **disabled** — queue grows in memory with **NoopSyncAdapter** until remote is enabled.

**UI:** **NativeWind** + **`core/ui`** primitives; **custom sidebar tabs** in `app/(tabs)/_layout.tsx`.

**Quality:** **7** Vitest tests (domain-only + one skipped data stub file). CI: **typecheck** then **test** on Node **20**.

---

## Cross-cutting concerns

| Concern | Where | Behavior |
|---------|-------|----------|
| Navigation | `app/_layout.tsx`, `app/(tabs)/_layout.tsx` | Stack → `AppProviders`; `Tabs` + `TabTrigger` + `TabSlot` |
| Database | `core/db/client.ts` | Bootstrap DDL + migrations; `getDatabase` / `initializeDatabase` |
| Types | `core/db/types.ts` | Entity TypeScript shapes |
| IDs & time | `lib/id.ts`, `lib/time.ts` | `createId`, `nowIso`, **`toDateKey` (UTC)** |
| Sync | `core/sync/sync.engine.ts` | In-memory queue; `flush` → adapter.push; noop default |
| Bootstrap | `core/providers/AppProviders.tsx` | DB init, SW register, guest profile; **second effect** flushes sync when remote on |
| PWA | `registerServiceWorker.ts`, `public/sw.js` | Workbox registration; cache-first GET handler |
| Styling | `tailwind.config.js`, `global.css` | Brand palette `brand-*`; NativeWind |

---

## Inconsistencies and gaps

### Documentation vs runtime (resolved / updated in this KB)

| Issue | Detail |
|-------|--------|
| Sync flush | **`syncEngine.flush()` is wired** in `AppProviders` when `isRemoteEnabled()` — interval 30s, visibility hidden, NetInfo connected. Default remote **off** → flush never runs. |
| `nextPomodoroState` | **Used** by `PomodoroScreen` for primary button label (`Running...` vs `Start focus`). |
| Calories `meal_type` | **User-selectable** in `CaloriesScreen` (`MEAL_OPTIONS`); not hard-coded to `"snack"`. |
| `feature-module` skill examples | May reference non-existent helpers — illustrative only. |
| `audit.md` / `feature-agent.md` | May still list stale items (sync never flushed, meal snack) — **see [06_EDITOR_AND_DOCS.md](./06_EDITOR_AND_DOCS.md)**. |

### Still accurate / open

| Issue | Detail |
|-------|--------|
| **Test count** | **7** passing (`npm test`); 1 file `describe.skip` |
| **Schema version** | Stored **4**, next migration **5** |
| **`schema.sql`** | Lags bootstrap (e.g. habits columns) — **not** runtime authority |
| **`SyncRecord` shape** | `{ entity, id, updatedAt, operation }` — skills mentioning other field names are illustrative |
| **`calories.data.test.ts`** | **Not present**; **`tests/calories.data.STUB.test.ts`** is skipped empty suite |
| **HTTP API** | None |
| **Deploy pipeline** | None in repo |
| **Coverage** | Not configured |
| **ESLint / Prettier** | Not in CI |

### Product / code quirks

| Topic | Detail |
|-------|--------|
| **`toDateKey()` UTC** | See [03_LIB_SHARED.md](./03_LIB_SHARED.md) — habits `date_key`, calories `consumed_on` |
| **Todos list** | When **no pending** tasks, **UI hides all todos** (including completed-only) — [04_FEATURES.md](./04_FEATURES.md) |
| **`habit_completions`** | Hard **DELETE** when count goes 1→0 — allowed exception |
| **Pomodoro** | **`startedAt` not cleared** on Reset (minor; next Start overwrites) |

---

## Glossary

Entries are listed **alphabetically** by term.

| Term | Meaning |
|------|--------|
| **app_meta** | Key/value: `db_schema_version`, `guest_profile`, etc. |
| **BaseEntity** | `id`, `created_at`, `updated_at`, `deleted_at` |
| **CalorieEntryTotals** | Type in `features/calories/types.ts`: `{ calories: number }` — minimal shape passed to `caloriesTotal()` for rolling up energy (domain rollup only). |
| **CATEGORY_ORDER** | SQL `CASE` expression in `features/habits/habits.data.ts` (not in `habitPresets.ts`): sorts habits by `category` in order **anytime → morning → afternoon → evening → else**, then `created_at DESC` within group. |
| **COOP / COEP** | Cross-origin policies — Metro middleware + `app.json` expo-router plugin |
| **data-agent** | Cursor agent: DB, migrations, `*.data.ts`, `lib/id`, `lib/time` |
| **date_key** | `YYYY-MM-DD` string; from **`toDateKey()`** (UTC) for habits |
| **feature-agent** | Cursor agent: screens, domain, `core/ui`, `app/` |
| **FlashList** | Virtualized list in `TodosScreen` |
| **FOCUS_SECONDS** | Constant **`25 * 60` (1500)** in `features/pomodoro/PomodoroScreen.tsx` — duration of the focus countdown in seconds, session log duration, and notification delay. (**Not** in `pomodoro.domain.ts`.) |
| **guest** | `createId("guest")` profile JSON in `app_meta` |
| **hcmp** | ID prefix for `habit_completions` |
| **HABIT_COLORS** | Readonly array of hex strings in `features/habits/habitPresets.ts` — palette for habit color dots. Used by **`HabitsScreen`** (color picker) and **`HabitCircle`** (ring / icon tint via `habit.color`). |
| **HABIT_ICONS** | Readonly array of `HabitIcon` literals in `features/habits/habitPresets.ts` — Material icon names for the habit picker. Used by **`HabitsScreen`** and **`HabitCircle`** (via `habit.icon`). |
| **MealType** | Type alias in `features/calories/types.ts`: `CalorieEntry["meal_type"]` — union **`"breakfast" \| "lunch" \| "dinner" \| "snack"`** (same as `core/db/types` `CalorieEntry`). |
| **MEAL_OPTIONS** | Constant in `features/calories/CaloriesScreen.tsx`: four `{ value, label }` pairs (`breakfast`/`Breakfast`, `lunch`/`Lunch`, `dinner`/`Dinner`, `snack`/`Snack`) — meal-type segmented control. |
| **NAV_ITEMS** | Constant array in `app/(tabs)/_layout.tsx` — five tab definitions (`name`, `href`, `label`, `shortLabel`). Full table: [01_APP_ROUTING.md](./01_APP_ROUTING.md). |
| **NativeWind** | Tailwind `className` on RN |
| **NoopSyncAdapter** | Default sync adapter — no-op push/pull |
| **PomodoroState** | `"idle" \| "running" \| "finished"` from `nextPomodoroState` |
| **Soft delete** | `deleted_at` set; filter `deleted_at IS NULL` |
| **SuperHabits** | App name; DB file `superhabits.db` |
| **SyncRecord** | Queue payload: `entity`, `id`, `updatedAt`, `operation` |
| **TabTrigger / TabSlot** | `expo-router/ui` custom tab UI |
| **WAL** | SQLite write-ahead log — native bootstrap only |
| **Workbox** | Registers `/sw.js` on web |
| **wrk** | Prefix for **both** `workout_routines` and `workout_logs` IDs |

### Acronyms

| Acronym | Expansion |
|---------|-----------|
| **CI** | Continuous integration |
| **COEP** | Cross-Origin-Embedder-Policy |
| **COOP** | Cross-Origin-Opener-Policy |
| **DDL** | Data definition language |
| **MVP** | Minimum viable product |
| **PWA** | Progressive web app |
| **RQ** | React Query (`@tanstack/react-query` — provided in `AppProviders`, hooks unused) |
| **RN** | React Native |
| **SQL** | SQLite (dialect via expo-sqlite) |
| **SW** | Service Worker (`/sw.js` on web) |
| **TS** | TypeScript |
| **UI** | User interface |
| **UTC** | Coordinated Universal Time |
| **WAL** | Write-ahead logging (SQLite) |

---

## Maintenance

When the codebase changes, update the numbered section files and this document: **test count**, **schema version**, **sync behavior**, **new routes/features**, and the **inconsistencies** table.
