# SuperHabits — Project Structure Map

## Error Handling and Validation Flows

- Error handling strategies are documented in README and knowledge base.
- Validation is hard-reject; errors are surfaced to users.
- See audit findings for more details.

Token-dense navigation map. Authoritative detail: `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`. **Schema v22** is current in `core/db/client.ts`: migration 13 adds durable processed-notification-action state, 14 the durable SQLite sync outbox, 15 its enqueue-time owner binding, 16–19 the planning entities and habit schedule history, 20 the hardening-wave-v2 durable-state promotion (habit lifecycle columns, Pomodoro session metadata columns, `workout_session_sets`, workout timing columns), 21 `daily_plans.top_todo_titles`, and 22 the Gym V2 routine/session extensions plus custom-exercise, weekly-plan, date-override, and body-weight tables. The habit engine retains effective-dated weekly schedule/target history in `habits.rule_history`. Linked Actions, Backup Completeness V2 / Restore V2, Recoverable Account V1, and Gym V2 cloud/portable recovery are live; **Portable Backup V1** (`core/portable/`) adds a user-controlled file export/import path that works without Supabase.

Current shell truth:

- The app is a single-page experience: `app/` contains only `_layout.tsx` and `index.tsx`. The six sections — `overview`, `todos`, `habits`, `pomodoro`, `workout`, `calories` — are rendered inside `app/index.tsx` behind `NavigationContext.activeSection` (from `core/providers/NavigationProvider.tsx`), with a top tab rail of plain `Pressable` items.
- `app/_layout.tsx` mounts the global command-center host (`GlobalCommandCenterHost`); the Command Center is a global overlay only — there is no `/command` route.
- Settings is a full-screen modal (not a route); the command launcher is hidden while it is open and suppressed during active pomodoro/workout sessions.
- Calories supports `form` and `diary` modes and remembers the last selected mode in AsyncStorage (`superhabits.calories.viewMode`).
- Settings is now a six-bucket IA: Appearance, Backup / Sync / Restore, AI / Command, Notifications / Timer defaults, Nutrition defaults, Developer / Internal.

---

## 1. Core directory roles

| Path             | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`app/`**       | Expo Router only: root stack + single-page shell — `app/_layout.tsx` (root layout + global command-center host wiring) and `app/index.tsx` (renders the six sections behind `NavigationContext.activeSection`). No business logic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **`core/`**      | Cross-cutting infra: **DB singleton + migrations** (`core/db/client.ts`), **entity types** (`core/db/types.ts`), **app_meta key registry** (`core/db/appMeta.ts`), **account ownership/coordinator** (`core/auth/*`), **sync queue** (`core/sync/sync.engine.ts`), **restore v1 coordinator + types** (`core/sync/restore.*`), **backup completeness v2** (`core/backup/*` — versioned scope, validators, canonical checksums, settings allowlist, backfill, checkpoint, Restore V2), **portable backup v1** (`core/portable/*` — file envelope, export, validate→preview→confirm→atomic import, platform file I/O), **Linked Actions** (`core/linked-actions/*`), **in-app notices** (`core/notifications/` — `inAppNotices.store.ts` + `inAppNotices.types.ts`, surfaced by `core/providers/InAppNoticeProvider.tsx`), **theme tokens + 14-theme registry** (`core/theme/` — `registry.ts`, `tokens.ts`, `themes/`), provider bootstrap (`core/providers/AppProviders.tsx`), theme state (`core/providers/ThemeProvider.tsx`), section-switch state (`core/providers/NavigationProvider.tsx`), PWA SW registration (`core/pwa/registerServiceWorker.ts`), shared **`core/ui/`** primitives. |
| **`features/`**  | Product modules: `{feature}.data.ts` (SQLite + enqueue), optional `{feature}.domain.ts` (pure), `*Screen.tsx` + subcomponents, `types.ts` barrel, `features/shared/` for cross-feature UI + shared types (`GitHubHeatmap.tsx`, `activityTypes.ts`). Current screen-only exceptions are `features/overview/` and `features/settings/` (settings also holds the restore-preview helper `settingsRestorePreview.ts`); `features/command/` is an experimental overlay-first shell with `CommandCenterProvider.tsx`, `CommandScreen.tsx`, parser/config helpers, and an executor instead of a normal feature data file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **`lib/`**       | Pure / platform helpers: `id`, `time`, `validation`, **`supabase`** (optional client/session persistence, Auth API wrappers, anonymous session, email OTP, and `remoteMode`), `useForegroundRefresh`, notifications, horizontal scroll style. **No** `features/`, **no** DB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **`constants/`** | Design tokens (e.g. `sectionColors.ts` — per-tab section palette).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **`tests/`**     | Vitest: `lib/`, `*.domain.ts`, command parser/config/executor, linked actions, restore/settings preview flows, sync engine tests, and selected data/DB tests (`todos.data`, `habits.data`, `calories.data`, `pomodoro.data`, `workout.data`, `db.client`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Also:** `e2e/` Playwright (+ `playwright.config.ts`, `scripts/serve-e2e.js`, `14` spec files + helpers); `public/` static (`sw.js`, `manifest.json`); `assets/` images; `patches/` patch-package; deployment config `vercel.json` (web PWA) and `eas.json` (native builds); Expo app config in `app.json`.

---

## 2. Feature module pattern

```
features/{name}/
  {name}.data.ts    ← SQLite CRUD, syncEngine.enqueue, createId/toDateKey/nowIso
  {name}.domain.ts  ← pure logic, no DB/React (optional but preferred for rules/math)
  {Name}Screen.tsx  ← UI: calls .data + .domain, core/ui, constants, lib/validation
  types.ts          ← re-exports / narrow types
```

Screens are mounted in the single-page shell `app/index.tsx` behind `NavigationContext.activeSection`; there are no per-feature route wrappers.

- **Screen** orchestrates; **never** `getDatabase()` in screen.
- **Data** owns writes, soft delete, `syncEngine.enqueue` where applicable.
- **Domain** unit-tested; **data** may import **domain** pure helpers (e.g. `kcalFromMacros`, `getTomorrowDateKey`).

---

## 3. Database & sync authority (single sources of truth)

| Concern         | File                                                                                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persistence** | `core/db/client.ts`                                                                             | `getDatabase()`, `initializeDatabase()`, bootstrap DDL, **append-only** `runMigrations()` (`if (version < N)` blocks; current v22). WAL native-only. `schema.sql` = hand-maintained reference snapshot **not** runtime; it lags the runtime DDL (the runtime authority is `runMigrations()`); keep it aligned when touching tables it documents. `core/db/migrations/` holds remote/Supabase reference SQL only — local migrations never live there. |
| **Row shapes**  | `core/db/types.ts`                                                                              | TypeScript entity types consumed by data layer.                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Sync**        | `core/sync/sync.engine.ts`, `core/sync/supabase.adapter.ts`, `core/sync/restore.coordinator.ts` | `SyncRecord`, `SyncEngine`, `syncEngine.enqueue`, `flush` → **`SupabaseSyncAdapter`** on the exported **`syncEngine`** (push upsert; `NoopSyncAdapter` remains for ctor default / tests). Restore v1 preview/import lives beside the adapter and is intentionally narrower than full sync.                                                                                                                                                           |

Remote flush (30s interval / visibility hidden / NetInfo reconnect) when `isRemoteEnabled()` (`lib/supabase.ts`, default **enabled**) and the account coordinator has verified `current Auth UID = local owner binding = every pending outbox owner`. `AppProviders` runs the coordinator before sync hydration and Restore V1 preview; only an empty/unbound dataset may create a new anonymous session. Session loss and owner mismatch leave local use available but pause remote work.

---

## 4. Dependency invariants

### Allowed (summary)

- `app/` → `AppProviders`, `features/*Screen`, expo-router layouts.
- `features/*Screen` → `*.data`, `*.domain`, `core/ui`, `constants`, `lib` (e.g. validation, time), `features/shared`.
- `features/*.data` → `core/db/client`, `core/db/types`, `core/sync/sync.engine`, `lib/id`, `lib/time`, `lib/validation`; **may** import `features/*.domain` pure functions and the linked-actions hook surface (`core/linked-actions/linkedActions.engine`, `linkedActions.data`, `linkedActions.types`).
- **core → features (accepted):** `core/sync/restore.coordinator.ts` imports `features/{calories,habits,todos}.data` (restore apply helpers); `core/linked-actions/linkedActions.effects.ts` + `linkedActionsTargetProviders.ts` import feature data layers (linked-action effects + target pickers). This direction is load-bearing — see the no-cycle rule below.
- `features/*.domain` → `lib/time`, `constants`, `features/shared` types; **no** `getDatabase`, **no** React.
- `core/ui` → RN, NativeWind; may use `lib/horizontalScrollViewportStyle`.
- `core/db/client` → expo-sqlite, Platform; **no** feature imports.
- `lib/` → **no** features, **no** DB.

### Violations (do not)

- `getDatabase` in `*Screen.tsx` or `*.domain.ts`.
- `syncEngine.enqueue` from UI — only from **`*.data.ts`** after mutating writes.
- Feature `*.data.ts` importing `core/sync/restore.*` (restore imports feature data → cycle); only the Settings **UI** consumes `restore.coordinator` / `restore.types` for the preview/import flow.
- Any feature module importing `core/linked-actions/linkedActions.effects.ts` or `linkedActionsTargetProviders.ts` — those import feature data, so doing so closes the core → features direction into a cycle.
- `DELETE FROM` on main entity tables (soft delete + filter `deleted_at IS NULL`), except documented exceptions (`habit_completions` at count 0; `saved_meals` hard delete).
- Edit past migration blocks; non-append schema changes.

---

## 5. Entity prefix registry (`createId` in `lib/id.ts`)

Format: `{prefix}_{ms}_{rand8}` — rand8 from a CSPRNG (`expo-crypto` / `crypto.getRandomValues`); local IDs only.

| Prefix  | Entity / use                                        |
| ------- | --------------------------------------------------- |
| `todo`  | `todos`                                             |
| `habit` | `habits`                                            |
| `hcmp`  | `habit_completions`                                 |
| `cal`   | `calorie_entries`                                   |
| `smeal` | `saved_meals`                                       |
| `wrk`   | `workout_routines`, `workout_logs`, session log ids |
| `ex`    | `routine_exercises`                                 |
| `eset`  | `routine_exercise_sets`                             |
| `wsex`  | `workout_session_exercises`                         |
| `pom`   | `pomodoro_sessions`                                 |
| `guest` | guest profile (`app_meta`)                          |
| `rec`   | `todos.recurrence_id` (daily series)                |

---

## 6. Quick “where does X live?”

| Logic type                      | Location                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Route / tab shell               | `app/`                                                                                                                                          |
| SQL, migrations, `getDatabase`  | `core/db/client.ts` only                                                                                                                        |
| App meta keys                   | `core/db/appMeta.ts` (`appMetaKeys` registry + text/JSON getters/setters)                                                                       |
| In-app notices                  | `core/notifications/inAppNotices.store.ts` + `inAppNotices.types.ts`, surfaced by `core/providers/InAppNoticeProvider.tsx`                      |
| Theme registry                  | `core/theme/registry.ts` — 14 themes in `core/theme/themes/`, plus `tokens.ts`, `contrast.ts`                                                   |
| Entity TS types                 | `core/db/types.ts`                                                                                                                              |
| Sync queue API                  | `core/sync/sync.engine.ts`                                                                                                                      |
| Restore v1 preview/import       | `core/sync/restore.coordinator.ts`, `core/sync/restore.types.ts` (settings UI helper: `features/settings/settingsRestorePreview.ts`)            |
| Cloud Backup V2 / Restore V2    | `core/backup/*` (scope/validators/settings/checkpoint/backfill/restore)                                                                         |
| Portable export/import V1       | `core/portable/*` (`portableFormat`, `portableExport`, `portableImport`, `portableFileIo`); UI: `features/settings/SettingsPortableSection.tsx` |
| Linked Actions contracts/engine | `core/linked-actions/*`                                                                                                                         |
| Reusable RN UI chrome           | `core/ui/`                                                                                                                                      |
| Feature CRUD + enqueue          | `features/*/*.data.ts`                                                                                                                          |
| Pure rules, streaks, formatting | `features/*/*.domain.ts`                                                                                                                        |
| Screens & wiring                | `features/*/*Screen.tsx`                                                                                                                        |
| Global command-center shell     | `features/command/*`, `app/_layout.tsx`                                                                                                         |
| Calories view-mode preference   | `features/calories/CaloriesScreen.tsx`, AsyncStorage key `superhabits.calories.viewMode`                                                        |
| Settings IA buckets             | `features/settings/SettingsScreen.tsx`                                                                                                          |
| IDs / date keys                 | `lib/id.ts`, `lib/time.ts` (`toDateKey` for YYYY-MM-DD)                                                                                         |
| Form messages                   | `lib/validation.ts`                                                                                                                             |
| Section colors                  | `constants/sectionColors.ts`                                                                                                                    |
| Unit tests                      | `tests/*.test.ts`                                                                                                                               |

---

## 7. Sync enqueue (by entity string)

Enqueued after writes: all 21 `BACKUP_ENTITIES` (`core/backup/backup.types.ts`) ride
the durable outbox through `runSyncedMutation`/`runBackupMutation`: **todos**,
**habits**, **habit_completions**, **calorie_entries**, **saved_meals**,
**workout_routines**, **routine_exercises**, **routine_exercise_sets**,
**workout_logs**, **workout_session_exercises**, **pomodoro_sessions**,
**linked_action_rules**, **weekly_reviews**, **projects**, **goals**,
**daily_plans**, **workout_session_sets**, **custom_exercises**,
**workout_weekly_plan**, **workout_schedule_overrides**, **body_weight_entries** — plus synthetic
`user_backup_settings` / `backup_manifest` records (hard-delete entities
remote-delete; soft-delete tables push tombstones; nested workout edits
enqueue their own rows). Only local operational state stays unsynced:
`linked_action_events`, `linked_action_executions`,
`processed_notification_actions`.

Restore V2 imports the full V2 scope atomically on a completely empty
device (ALL user tables + outbox via `inspectLocalAccountDataState`) with
integrity verification against the versioned manifest; legacy V1 backups
(no manifest) remain restorable through the V1 path and are labeled
`V1 LEGACY/PARTIAL`. Recover Existing binds an authenticated protected
UUID before entering this same preview/import path; it does not add
merging or account switching.

**Portable Backup V1** (`core/portable/`) is the user-controlled FILE path —
no Supabase required. Export snapshots the current scope-6 recoverable entities +
recoverable settings in one serialized read-only transaction into a
versioned JSON envelope with per-entity checksums, a settings checksum, and
a canonical payload checksum; import validates everything (envelope,
versions, rows, settings, checksums, dependency graph, owner compatibility,
complete emptiness), shows a preview, requires explicit confirmation, and
imports atomically via the side-effect-free Restore V2 apply paths. Owner
fingerprints are one-way compatibility metadata (`lib/portableOwnerFingerprint.ts`);
import-origin metadata (`app_meta portable.last_import_*`) fails closed in
`decideAccountState` so an unrelated account can never silently claim an
imported dataset. A file import never marks cloud backup complete: backfill
markers are reset and `backup.dirty` is set so the owner's next checkpoint
re-uploads the imported state.
