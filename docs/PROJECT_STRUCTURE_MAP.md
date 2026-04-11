# SuperHabits Project Structure Map

Purpose: structural source of truth for where code belongs. Keep this file about paths, ownership, and dependency direction. Put behavior in `docs/master-context.md` and execution rules in `docs/working-rules.md`.

## Read This With

- `docs/master-context.md`
- `docs/working-rules.md`

## Top-Level Ownership

| Path | Owns | Notes |
|------|------|-------|
| `app/` | Expo Router entry, stacks, and thin route wrappers | No business logic. Includes the top-tab shell and a standalone `settings` route. |
| `features/` | Product modules and feature-local UI | Standard pattern is data + domain + screen. `features/overview/` is dashboard-only. `features/settings/` is a routed utility screen, not a tab module. |
| `features/shared/` | Cross-feature presentation components | Shared activity and heatmap UI lives here. |
| `core/db/` | SQLite bootstrap, migrations, and entity types | `core/db/client.ts` is the only DB entrypoint. |
| `core/sync/` | Sync queue and Supabase adapter | One-way push backup only. |
| `core/providers/` | App bootstrap and global providers | DB init, guest profile, optional anonymous session, sync flush listeners. |
| `core/auth/` | Local guest profile bootstrap | App-level local identity only. |
| `core/pwa/` | Web service-worker registration | Web-only runtime support. |
| `core/ui/` | Shared UI primitives | Reuse before creating feature-local chrome. |
| `lib/` | Pure helpers and platform utilities | No feature imports, no DB access. |
| `constants/` | Shared visual tokens | Section colors live here. |
| `tests/` | Vitest coverage | Domain-heavy plus selected DB/data/sync coverage. |
| `e2e/` | Playwright specs and helpers | Runs against static `dist/` via `scripts/serve-e2e.js`. |
| `public/` | Static PWA assets | `manifest.json`, `sw.js`. |

## Routing Map

| Route area | Files | Notes |
|-----------|-------|-------|
| Root app shell | `app/_layout.tsx`, `app/index.tsx` | Root redirect goes to `/(tabs)/overview`. |
| Top tabs | `app/(tabs)/_layout.tsx` | Active tabs are Overview, Todos, Habits, Pomodoro, Workout, Calories. |
| Thin tab routes | `app/(tabs)/*.tsx` | Each route should render one screen component and nothing else. |
| Utility route | `app/settings.tsx` | Wraps `features/settings/SettingsScreen.tsx`. Not part of the tab set. |

## Feature Module Pattern

Standard pattern:

```text
features/{feature}/
  {feature}.data.ts
  {feature}.domain.ts
  {Feature}Screen.tsx
  types.ts
app/(tabs)/{feature}.tsx
```

Rules:

- `{feature}.data.ts` owns SQLite reads and writes, sync enqueue, soft delete behavior, and ID/date helper usage.
- `{feature}.domain.ts` owns pure business logic only.
- `{Feature}Screen.tsx` owns orchestration and presentation only.
- Route files in `app/(tabs)/` stay thin.

Known exceptions:

- `features/overview/OverviewScreen.tsx` has no companion data/domain files.
- `features/workout/` includes nested screens for routine detail and session flow.
- `features/settings/SettingsScreen.tsx` exists outside the tab module pattern.

## Dependency Direction

Allowed:

- `app/` -> `core/providers`, `features/*Screen`, Expo Router layout code
- `features/*Screen` -> matching `*.data.ts`, `*.domain.ts`, `core/ui`, `constants`, `lib`, `features/shared`
- `features/*.data.ts` -> `core/db/client.ts`, `core/db/types.ts`, `core/sync/*`, `lib/id.ts`, `lib/time.ts`, `lib/validation.ts`, and pure domain helpers
- `features/*.domain.ts` -> pure helpers such as `lib/time.ts`, constants, and types
- `core/ui/` -> React Native, NativeWind, and small helper utilities

Not allowed:

- UI or route files importing `getDatabase()`
- Domain files importing SQLite, `core/db/*`, or React
- UI calling `syncEngine.enqueue(...)` directly
- `lib/` importing feature code or DB code

## Persistence and Sync Authority

| Concern | Canonical file(s) | Notes |
|--------|--------------------|-------|
| SQLite entrypoint and migrations | `core/db/client.ts` | `schema.sql` is reference-only. |
| Entity TypeScript shapes | `core/db/types.ts` | Data-layer contract types. |
| Sync queue | `core/sync/sync.engine.ts` | Exported `syncEngine` uses `SupabaseSyncAdapter`. |
| Remote adapter | `core/sync/supabase.adapter.ts` | Push upsert only. `pull()` is stubbed. |
| Remote config and auth | `lib/supabase.ts` | Optional anonymous session and remote-mode gating. |
| Flush wiring | `core/providers/AppProviders.tsx` | 30s interval, web hidden-state flush, NetInfo reconnect. |

## Synced Entity Surface

Currently enqueued for sync:

- `todos`
- `habits`
- `calorie_entries`
- `workout_routines`

Currently not synced:

- `pomodoro_sessions`
- `habit_completions`
- `workout_logs`
- `saved_meals`
- `routine_exercises`
- `routine_exercise_sets`
- `workout_session_exercises`

Nested workout edits must continue to update and enqueue the parent `workout_routines` row instead of inventing nested sync records.

## ID Prefix Registry

`createId(prefix)` in `lib/id.ts` currently uses these prefixes:

- `todo`
- `habit`
- `hcmp`
- `cal`
- `smeal`
- `wrk`
- `ex`
- `eset`
- `wsex`
- `pom`
- `guest`
- `rec`

## Fast File Lookup

| Need | File |
|------|------|
| SQL bootstrap and migrations | `core/db/client.ts` |
| DB entity types | `core/db/types.ts` |
| Shared UI primitives | `core/ui/*` |
| Feature CRUD and sync enqueue | `features/*/*.data.ts` |
| Pure business rules | `features/*/*.domain.ts` |
| Top-level screens | `features/*/*Screen.tsx` |
| ID generation | `lib/id.ts` |
| Day-key helpers | `lib/time.ts` |
| Validation messages | `lib/validation.ts` |
| Web E2E static server | `scripts/serve-e2e.js` |
