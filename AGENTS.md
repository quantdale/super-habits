# SuperHabits Agent Guide

Read this file first in every new session before exploring or editing the repo.

For Codex-based workflows, also read: `docs/codex-workflow.md`

## Startup Checklist

1. Read `docs/PROJECT_STRUCTURE_MAP.md` first.
2. Then read:
   - `.cursorrules`
   - `.cursor/rules/superhabits-rules.mdc`
3. If the task is feature/UI work, also read:
   - `.cursor/skills/feature-module-pattern/SKILL.md`
   - `.cursor/skills/rn-expo-conventions/SKILL.md`
4. If the task is data/DB/sync work, also read:
   - `.cursor/skills/db-and-sync-invariants/SKILL.md`
5. Route work to the right agent:
   - Data/DB/sync/migration issues: `.cursor/agents/data-agent.md`
   - UI/domain/routing/component issues: `.cursor/agents/feature-agent.md`

## Authoritative Docs

- `docs/PROJECT_STRUCTURE_MAP.md`
- `.cursorrules`
- `.cursor/rules/superhabits-rules.mdc`
- `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`

If this file conflicts with the documents above, follow the more specific authoritative document.

## Project Overview

SuperHabits is an offline-first productivity app that runs as a Progressive Web App (PWA) on the web and as native Android/iOS apps from a single Expo + React Native codebase.

Key product facts:

- Six tab surfaces: **Overview**, **Todos**, **Habits**, **Pomodoro**, **Workout**, and **Calories**.
- A non-tab **Settings** route and an experimental **Command Center** route (`/command`).
- Local **SQLite** is the source of truth; writes may optionally be pushed to **Supabase** as a backup.
- **Restore v1** can import a limited entity set (`todos`, `habits`, `calorie_entries`) onto an empty device. It is not full two-way sync.
- The command center launches as a **global overlay** on the main tabs; `/command` remains a retained direct/internal page route.
- Calories supports **Form** and **Diary** modes and remembers the last selected view in AsyncStorage (`superhabits.calories.viewMode`).
- Settings is organized into six buckets: Appearance, Backup / Sync / Restore, AI / Command, Notifications / Timer defaults, Nutrition defaults, Developer / Internal.

## Technology Stack

- **Runtime:** Expo SDK `^55.0.8`, React Native `0.83.4`, React `19.2.0`
- **Language:** TypeScript `~5.9.2` (strict mode)
- **Routing:** Expo Router `^55.0.7` (file-based routing in `app/`)
- **Styling:** NativeWind `^4.2.3` + Tailwind CSS `^3.4.19`
- **Database:** `expo-sqlite` (`^55.0.11`); WAL mode on native, SQLite WASM + OPFS on web
- **State:** Local `useState` only; `zustand` and `@tanstack/react-query` are installed but unused
- **Backup/Auth:** Supabase (`@supabase/supabase-js`) with anonymous sign-in
- **Networking:** `@react-native-community/netinfo`
- **Notifications:** `expo-notifications` (iOS/Android only)
- **Charts/Lists:** `react-native-gifted-charts`, `@shopify/flash-list`
- **Animations:** `react-native-reanimated`
- **Testing:** Vitest `^4.1.1` (unit), Playwright `^1.58.2` (E2E)
- **Patching:** `patch-package` (runs in `postinstall`)

## Key Configuration Files

| File                   | Purpose                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `package.json`         | Dependencies, scripts, version `1.0.0`, main `expo-router/entry`                                                           |
| `app.json`             | Expo config: scheme `superhabits`, Android package `com.dale16.superhabits`, web static export, COOP/COEP headers, plugins |
| `eas.json`             | EAS Build profiles (`development`, `preview` APK, `production`); CLI `>= 18.5.0`                                           |
| `vercel.json`          | Static web PWA deploy: `npm run build:web` → `dist/`, SPA rewrite, COOP/COEP headers                                       |
| `tsconfig.json`        | Expo TS base, strict, `@/*` → `./*`, Vitest globals                                                                        |
| `metro.config.js`      | Metro + NativeWind, `.wasm` asset extension, dev COOP/COEP middleware                                                      |
| `babel.config.js`      | Presets: `babel-preset-expo`, `nativewind/babel`; plugin: `react-native-reanimated/plugin` (must be last)                  |
| `tailwind.config.js`   | NativeWind preset, content paths, per-tab colors (`todos`, `habits`, `focus`, `workout`, `calories`, `brand`, `surface`)   |
| `vitest.config.ts`     | Node env, `tests/**/*.test.ts` + `core/**/__tests__/**/*.test.ts`, `@/` alias, `__DEV__ = true`                            |
| `playwright.config.ts` | E2E against `http://localhost:8081`, Chromium, `workers: 1` locally, serial files, `scripts/serve-e2e.js`                  |
| `scripts/serve-e2e.js` | Static server for E2E; serves `dist/` with `require-corp` COEP and SPA fallback                                            |
| `.env` / `.env.local`  | Optional Supabase and command-parser environment variables (no committed secrets)                                          |

## Directory Structure

| Path         | Role                                                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`       | Expo Router only. Thin route wrappers and layouts. No business logic. Root layout mounts the global command-center host.                                                                                                                                            |
| `features/`  | Product feature modules. Standard pattern: `{feature}.data.ts`, `{feature}.domain.ts`, `{Feature}Screen.tsx`, optional `types.ts`. Exceptions: `overview/` and `settings/` are screen-only; `command/` is an overlay-first shell; `shared/` holds cross-feature UI. |
| `core/`      | Cross-cutting infrastructure: DB client/migrations, entity types, sync engine + restore, linked actions, providers, PWA service-worker registration, shared UI primitives (`core/ui/`).                                                                             |
| `lib/`       | Pure helpers only. No DB access, no feature imports. Includes `id.ts`, `time.ts`, `validation.ts`, `supabase.ts`, `notifications.ts`, etc.                                                                                                                          |
| `constants/` | Design tokens such as `sectionColors.ts`.                                                                                                                                                                                                                           |
| `tests/`     | Vitest unit tests for domain logic, data-layer contracts, command parser/config/executor, linked actions, restore flows, sync engine, and selected DB/provider tests.                                                                                               |
| `e2e/`       | Playwright E2E specs and helpers. Runs against the static web export in `dist/`.                                                                                                                                                                                    |
| `public/`    | Static PWA assets: `sw.js`, `manifest.json`, icons.                                                                                                                                                                                                                 |
| `assets/`    | App icons and splash images.                                                                                                                                                                                                                                        |
| `scripts/`   | Build/test helpers such as `serve-e2e.js`.                                                                                                                                                                                                                          |
| `supabase/`  | Supabase Edge Functions (`supabase/functions/parse-ai-command/`).                                                                                                                                                                                                   |
| `patches/`   | `patch-package` patches for Metro / React Native CLI plugins.                                                                                                                                                                                                       |
| `docs/`      | Architecture maps, knowledge base, and agent workflows.                                                                                                                                                                                                             |

## Architecture & Runtime

### Database

- Single SQLite connection through `getDatabase()` in `core/db/client.ts`.
- Bootstrap DDL runs on first open, then sequential migrations in `runMigrations()`.
- Current stored schema version: **11** (`app_meta.db_schema_version`). Next migration: add a new `if (version < 12) { ... }` block.
- `schema.sql` is **reference-only**; it is never executed at runtime.
- Entity TypeScript shapes live in `core/db/types.ts`.

### Sync

- `syncEngine` (`core/sync/sync.engine.ts`) is an in-memory queue of `SyncRecord` objects.
- Feature data-layer writes call `syncEngine.enqueue({ entity, id, updatedAt, operation })` after mutating synced entities.
- The exported `syncEngine` uses `SupabaseSyncAdapter` (`core/sync/supabase.adapter.ts`), which groups records by entity, reads local rows, and upserts them to Supabase (`onConflict: "id"`).
- `NoopSyncAdapter` is the constructor default for tests.
- `AppProviders` registers `syncEngine.flush()` on a 30-second interval, web `visibilitychange` (hidden), and NetInfo reconnect events — but only when `isRemoteEnabled()` returns true (`remoteMode` defaults to `"enabled"`).
- Restore v1 (`core/sync/restore.coordinator.ts`) previews and imports `todos`, `habits`, and `calorie_entries` only when the device is empty for synced tables.

### Bootstrap

`AppProviders` initializes the app in this order:

1. `GestureHandlerRootView`
2. `QueryClient` (React Query — dormant)
3. `initializeDatabase()`
4. Service worker registration (web only)
5. `ensureGuestProfile()` (`core/auth/guestProfile.ts`)
6. `ensureAnonymousSession()` (`lib/supabase.ts`) when Supabase env vars are present
7. Restore preview check and optional restore prompt

Any component that calls a `*.data.ts` function must be a descendant of `AppProviders`.

### Routing

- File-based Expo Router: `app/(tabs)/{feature}.tsx` for tabs, `app/_layout.tsx` for root, `app/settings.tsx` and `app/command.tsx` for utility routes.
- Route files are thin wrappers that render a single `*Screen` component.
- `app/(tabs)/_layout.tsx` defines the six tab entries.
- `app/_layout.tsx` mounts `GlobalCommandCenterHost`, which shows the floating launcher on eligible tabs when `COMMAND_EXPERIMENT_ENABLED` is true.

### Linked Actions

`core/linked-actions/` stores the rule/event/execution engine that triggers cross-feature effects (for example, completing a todo that is linked to another todo). It has its own data, engine, policy, effects, editor model, and notice modules.

### PWA / Web

- Static web export to `dist/` via `npx expo export -p web`.
- `public/sw.js` uses cache name `superhabits-shell-v3`.
- `crossOriginIsolated` is required for SQLite WASM; enforced by COOP/COEP headers in Metro dev, `app.json`, and `vercel.json`.

## Layering Rules

### Data layer (`{feature}.data.ts`)

- Owns SQLite reads/writes, soft delete, sync enqueue, ID/time helpers.
- Imports: `getDatabase` from `core/db/client`, `createId` from `lib/id`, `nowIso` / `toDateKey` from `lib/time`, `syncEngine` from `core/sync/sync.engine`.
- All functions start with `const db = await getDatabase()`.
- `SELECT` queries always include `WHERE deleted_at IS NULL`.
- No UI imports, no React.

### Domain layer (`{feature}.domain.ts`)

- Pure logic only.
- No DB imports, no React, no side effects.
- Fully unit-testable.

### UI layer (`*Screen.tsx`, feature components, `core/ui/`, `app/`)

- Presentation and orchestration only.
- Imports from `.data.ts`, `.domain.ts`, `core/ui/`, `constants/`, and `lib/` helpers.
- No direct DB imports.

## Non-Negotiable Invariants

Violating these can cause silent data corruption or break the app on cold start.

1. **Soft delete only** for main entities. Use `UPDATE ... SET deleted_at = datetime('now')` and `WHERE deleted_at IS NULL`. Do not use `DELETE FROM` on synced entity tables.
2. **Sync enqueue on every applicable write.** Call `syncEngine.enqueue(...)` immediately after `INSERT`/`UPDATE` on `todos`, `habits`, `calorie_entries`, and `workout_routines`. Not synced: `pomodoro_sessions`, `workout_logs`, `habit_completions`, `saved_meals`, nested workout tables.
3. **DB singleton.** `getDatabase()` in `core/db/client.ts` is the only entrypoint. Never open a second SQLite connection or access the DB before initialization.
4. **IDs via `createId(prefix)` from `lib/id.ts`.** Format: `{prefix}_{timestamp_ms}_{8_random_chars}`. Never use `Math.random()`, `crypto.randomUUID()`, or `Date.now()` alone.
5. **Date keys via `toDateKey()` from `lib/time.ts`.** Returns local-calendar `YYYY-MM-DD`. Migration 5 records `app_meta.date_key_format` and `date_key_cutover`; old rows are not backfilled.
6. **Migrations are append-only.** Never edit existing migration blocks. Add a new `if (version < N+1) { ... }` block in `runMigrations()` in `core/db/client.ts`.
7. **`schema.sql` is reference-only**, not runtime authority.
8. **Habit completions exception.** `habit_completions` uses `SELECT → INSERT` (new row) or `UPDATE` (count ±1). Hard `DELETE` is allowed only when decrementing from count 1 to 0. This table is not synced.

## Feature Module Pattern

Standard new feature layout:

```
features/{name}/
  {name}.data.ts       ← SQLite CRUD + sync enqueue
  {name}.domain.ts     ← pure logic
  {Name}Screen.tsx     ← React Native screen
  types.ts             ← local type barrel (optional)
app/(tabs)/{name}.tsx  ← thin route wrapper
```

Current exceptions:

- `features/overview/OverviewScreen.tsx` only (dashboard composes existing modules).
- `features/settings/SettingsScreen.tsx` only (utility route).
- `features/command/` is an overlay-first shell with its own provider, screen, parser, config, and executor files.
- `features/shared/` holds cross-feature UI (`GitHubHeatmap`, etc.).
- `features/workout/` includes nested screens (`RoutineDetailScreen`, `WorkoutSessionScreen`).

## Entity ID Prefixes (`createId`)

| Entity                             | Prefix  |
| ---------------------------------- | ------- |
| `todos`                            | `todo`  |
| `habits`                           | `habit` |
| `habit_completions`                | `hcmp`  |
| `calorie_entries`                  | `cal`   |
| `saved_meals`                      | `smeal` |
| `workout_routines`, `workout_logs` | `wrk`   |
| `routine_exercises`                | `ex`    |
| `routine_exercise_sets`            | `eset`  |
| `workout_session_exercises`        | `wsex`  |
| `pomodoro_sessions`                | `pom`   |
| guest profile (`app_meta`)         | `guest` |
| recurring todo series              | `rec`   |

## Build, Run, and Test Commands

```bash
# Install
npm install

# Development
npx expo start
npm run android
npm run ios
npm run web          # headless web dev server

# Quality gates
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . --ext .ts,.tsx
npm run lint:fix     # eslint . --ext .ts,.tsx --fix
npm run format       # prettier --write .
npm run format:check # prettier --check .
npm test             # vitest run

# Web build / deploy
npm run build:web    # npx expo export -p web → dist/

# E2E (requires dist/ to be up to date)
npm run e2e          # playwright test
npm run e2e:report   # open HTML report
npm run e2e:headed   # visible browser for debugging
npm run e2e:debug    # Playwright inspector
```

Current verified baselines:

- `npm run typecheck`: 0 errors
- `npm run lint`: 0 errors (warnings allowed)
- `npm test`: **343 tests passing** across **33 test files**
- `npx playwright test --list`: **87 tests** across **13 spec files**

## Testing Strategy

### Unit Tests (Vitest)

- Config: `vitest.config.ts`
- Files: `tests/*.test.ts` and `core/**/__tests__/**/*.test.ts`
- Setup: `tests/setup.ts`
- Coverage emphasis: domain logic, data-layer contracts, command parser/config/executor, linked actions, restore flows, sync engine, and selected DB/provider behavior. Component rendering tests are still limited.
- Every new `*.domain.ts` function should have a Vitest test.

### E2E Tests (Playwright)

- Config: `playwright.config.ts`
- Files: `e2e/*.spec.ts` (13 spec files)
- Runs against the **static web export** in `dist/` served by `node scripts/serve-e2e.js` on `http://localhost:8081`.
- `workers: 1` locally because OPFS + SQLite hold one lock per origin.
- `clearDatabase()` runs in `test.beforeEach`.
- Chromium only, headless by default.
- Report output: `.cursor/playwright-output/e2e-report/`
- Failure artifacts: `.cursor/playwright-output/e2e-failures/`
- Do **not** add `data-testid` attributes to app components to make tests pass.
- If a selector breaks after a UI change, update the selector in the spec; do not weaken assertions.

### Pre-PR / Useful Commands

- `/test` — run unit + E2E suite
- `/fix` — classify and fix issues (routes to data-agent or feature-agent)
- `/pre-pr` — full code-quality + live web inspection + optional CI check
- `/e2e-fix` — run E2E and auto-detect selector mismatches
- `.cursor/commands/test.md`, `.cursor/commands/fix.md`, `.cursor/commands/pre-pr.md`

## Deployment

### Vercel (Web PWA)

- Build command: `npm run build:web`
- Output directory: `dist`
- SPA rewrite: `/(.*)` → `/index.html`
- Headers: `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Opener-Policy: same-origin`

### EAS (Native Android preview)

```bash
eas build -p android --profile preview
```

- Android package: `com.dale16.superhabits`
- Build type: `apk`

### CI (GitHub Actions)

`.github/workflows/ci.yml` runs two jobs:

1. **quality** — `npm run typecheck` + `npm test`
2. **e2e** — runs only if `quality` passes; installs Playwright Chromium, runs `npm run build:web`, then `npm run e2e`; uploads the HTML report artifact.

## Environment Variables

Supabase (optional; app runs local-only if unset):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Command parser (optional real-parser path):

- `EXPO_PUBLIC_AI_COMMAND_PARSE_MODE` — use `remote_with_fallback` to enable remote parsing
- `EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT` — allow internal rollout toggle
- `EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST`
- `EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME`
- `EXPO_PUBLIC_AI_COMMAND_PROXY_URL`

Because Expo public env vars are bundled into the client, never put real secrets in `EXPO_PUBLIC_*` variables.

## Code Style & Conventions

- Source files: `camelCase` (e.g. `todoHelpers.ts`)
- React components: `PascalCase` (e.g. `TodoCard.tsx`)
- Data layer: `{feature}.data.ts`
- Domain layer: `{feature}.domain.ts`
- Screens: `{Feature}Screen.tsx`
- Route wrappers: `app/(tabs)/{feature}.tsx`
- Styling: NativeWind `className` with Tailwind utility classes. Do **not** use `StyleSheet.create()` for new code.
- Lists: use `@shopify/flash-list` (`FlashList`), not `FlatList`.
- Animations: `react-native-reanimated`.
- SVG: `react-native-svg`.
- Safe area: use `<Screen>` from `core/ui/Screen.tsx`.
- Platform detection: `Platform.OS === 'web' | 'ios' | 'android'`.
- Refresh pattern: re-call the list function after every mutation.

## Security Considerations

- **No hard deletes** on main synced entities; soft delete preserves data and keeps backup rows consistent.
- **ID generation** uses `createId(prefix)` to avoid collisions and ensure predictable entity prefixes.
- **Timestamps/date keys** are centralized so sync and queries agree on formats.
- **COOP/COEP headers** are required in dev and production for SQLite WASM (`crossOriginIsolated`).
- **Supabase auth** is anonymous only; no user passwords are handled.
- **Environment variables** use the `EXPO_PUBLIC_*` prefix, meaning they are public to the client bundle. Do not store private API keys or secrets in them.
- **Migrations are append-only** to prevent corrupting existing user databases.
- **Sync engine** snapshots the queue before flushing and restores records on adapter failure to avoid silent data loss.

## Task Routing

| Area                               | Read                              |
| ---------------------------------- | --------------------------------- |
| Data/DB/sync/migration issues      | `.cursor/agents/data-agent.md`    |
| UI/domain/routing/component issues | `.cursor/agents/feature-agent.md` |

## Suggested Session Bootstrap Prompt

Use this in a new chat session:

`Read AGENTS.md and follow it before making changes.`
