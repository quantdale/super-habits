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

## Durable Agent Work (ExecPlans)

- Substantial, multi-step, delegated, QA-infrastructure, or context-loss-prone
  work requires a task-specific ExecPlan. Follow `.agent/PLANS.md`.
- OpenSpec-backed work stores its living plan at
  `openspec/changes/<change-slug>/execplan.md`; other substantial work uses
  `.agent/execplans/<task-slug>.md`. Never use one global current-task file.
- Keep the plan's `Current Checkpoint` current throughout the task, including
  the exact next action, decisions, discoveries, changed areas, validation,
  blockers, and remaining definition of done. Update it at every meaningful
  milestone, failure, decision, delegation boundary, and before finishing.
- After context compaction or in a fresh session, reread `AGENTS.md`,
  `.agent/PLANS.md`, and the task plan; inspect `git status --short`,
  `git diff --stat`, `git diff --name-only`, relevant diffs, and recent QA
  evidence; reconcile the checkpoint; run `npm run qa:affected` when
  applicable; then resume from `Exact next action`.
- Conversation history and compaction summaries are not authoritative task
  state. Git is authoritative for actual files; OpenSpec is authoritative for
  required behavior; the ExecPlan is authoritative for implementation state
  and recovery context. Update the plan when those sources disagree.
- Use `docs/testing/autonomous-qa.md` and `qa/impact-map.json` for escalation;
  preserve failures and known gaps, never weaken meaningful tests, and do not
  claim completion without validated definition-of-done evidence.
- New plans declare `Plan-Version: 2` and `Status: ACTIVE`, `BLOCKED`, or
  `COMPLETED`. Use `npm run agent:plans` to discover plans,
  `npm run agent:resume -- --plan <path>` for read-only recovery orientation,
  and `npm run agent:plan:validate -- --plan <path>` before complex-task
  completion. These tools never create a second task-state store.
- After suspected compaction or in a fresh session, run the resume command,
  inspect its Git discrepancy warnings and QA impact, reread relevant files,
  update the task plan, and continue only from its `Exact next action`.
- Keep this section stable. Do not put volatile progress for an individual task
  in `AGENTS.md`.

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
- A single-page experience: the six sections are rendered inside `app/index.tsx` behind a `NavigationContext.activeSection` state, with a top tab rail of plain `Pressable` items. Settings is a full-screen **modal**; the Command Center is a **global overlay** (no `/command` route).
- Local **SQLite** is the source of truth; writes may optionally be pushed to **Supabase** as a backup.
- **Restore v1** can import a limited entity set (`todos`, `habits`, `calorie_entries`) onto an empty device. It is not full two-way sync.
- The command center launches as a **global overlay** mounted by `GlobalCommandCenterHost` in `app/_layout.tsx`; there is no `/command` route.
- Calories supports **Form** and **Diary** modes and remembers the last selected view in AsyncStorage (`superhabits.calories.viewMode`).
- Settings is organized into six buckets: Appearance, Backup / Sync / Restore, AI / Command, Notifications / Timer defaults, Nutrition defaults, Developer / Internal.

## Technology Stack

- **Runtime:** Expo SDK `~55.0.28`, React Native `0.83.10`, React `19.2.0`
- **Language:** TypeScript `~5.9.2` (strict mode)
- **Routing:** Expo Router `^55.0.7` (file-based routing in `app/`)
- **Styling:** NativeWind `^4.2.3` + Tailwind CSS `^3.4.19`
- **Database:** `expo-sqlite` (`^55.0.11`); WAL mode on native, SQLite WASM + OPFS on web
- **State:** Local `useState` only; section switching via `NavigationContext.activeSection` (`core/providers/NavigationProvider.tsx`).
- **Backup/Auth:** Supabase (`@supabase/supabase-js`) with anonymous sign-in
- **Networking:** `@react-native-community/netinfo`
- **Notifications:** `expo-notifications` (iOS/Android only)
- **Charts/Lists:** `react-native-gifted-charts`, `@shopify/flash-list`; **drag-reorder:** `react-native-draggable-flatlist` (TodosScreen intentionally uses `DraggableFlatList` — do not convert it to `FlashList`); **date/time picker:** `@react-native-community/datetimepicker`
- **Animations:** `react-native-reanimated`
- **Testing:** Vitest `^3.2.7` (unit), Playwright `^1.58.2` (E2E)
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

| Path         | Role                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`       | Expo Router only. Single-page entry: `_layout.tsx` mounts `GlobalCommandCenterHost` + `NavigationProvider`; `index.tsx` renders all six sections behind `NavigationContext.activeSection`. No business logic.                                                                                                                                                                              |
| `features/`  | Product feature modules. Standard pattern: `{feature}.data.ts`, `{feature}.domain.ts`, `{Feature}Screen.tsx`, optional `types.ts`. Exceptions: `overview/` is screen-only; `settings/` is a screen plus `settingsRestorePreview.ts`; `command/` is an overlay-first shell; `shared/` holds cross-feature UI and shared types (`activityTypes.ts`).                                         |
| `core/`      | Cross-cutting infrastructure: DB client/migrations, entity types, `app_meta` key registry (`core/db/appMeta.ts`), sync engine + restore, linked actions, in-app notices (`core/notifications/` + `core/providers/InAppNoticeProvider.tsx` + `core/ui/InAppNoticeBanner.tsx`), theme system (`core/theme/`), providers, PWA service-worker registration, shared UI primitives (`core/ui/`). |
| `lib/`       | No DB access, no feature imports — but not all pure: `supabase.ts` has auth side effects (module-scope client), `notifications.ts` registers a module-scope notification handler, `useForegroundRefresh.ts` is React hooks. Includes `id.ts`, `time.ts`, `validation.ts`, etc.                                                                                                             |
| `constants/` | Design tokens such as `sectionColors.ts`.                                                                                                                                                                                                                                                                                                                                                  |
| `tests/`     | Vitest unit tests for domain logic, data-layer contracts, command parser/config/executor, linked actions, restore flows, sync engine, and selected DB/provider tests.                                                                                                                                                                                                                      |
| `e2e/`       | Playwright E2E specs and helpers. Runs against the static web export in `dist/`.                                                                                                                                                                                                                                                                                                           |
| `public/`    | Static PWA assets: `sw.js`, `manifest.json`, icons.                                                                                                                                                                                                                                                                                                                                        |
| `assets/`    | App icons and splash images.                                                                                                                                                                                                                                                                                                                                                               |
| `scripts/`   | Build/test helpers such as `serve-e2e.js`.                                                                                                                                                                                                                                                                                                                                                 |
| `supabase/`  | Supabase Edge Functions (`supabase/functions/parse-ai-command/`).                                                                                                                                                                                                                                                                                                                          |
| `patches/`   | `patch-package` patches for Metro / React Native CLI plugins.                                                                                                                                                                                                                                                                                                                              |
| `docs/`      | Architecture maps, knowledge base, and agent workflows.                                                                                                                                                                                                                                                                                                                                    |

## Architecture & Runtime

### Database

- Single SQLite connection through `getDatabase()` in `core/db/client.ts`.
- Bootstrap DDL runs on first open, then sequential migrations in `runMigrations()`.
- Current stored schema version: **15** (`app_meta.db_schema_version`), including durable processed-notification-action state, the SQLite sync outbox, and its durable owner binding. Next migration: add a new `if (version < 16) { ... }` block.
- `core/db/schema.sql` remains a **reference-only partial snapshot** and is never executed at runtime. It records the v14 outbox addition, but it is not a complete replacement for the bootstrap DDL + migration blocks in `core/db/client.ts`; derive the real schema from those runtime sources.
- Entity TypeScript shapes live in `core/db/types.ts`.

### Sync

- `syncEngine` (`core/sync/sync.engine.ts`) publishes a durable SQLite `sync_outbox` row into an in-memory `SyncRecord` queue; the durable table is authoritative across restart.
- Feature data-layer writes call `syncEngine.enqueue({ entity, id, updatedAt, operation })` after mutating synced entities.
- The exported `syncEngine` uses `SupabaseSyncAdapter` (`core/sync/supabase.adapter.ts`), which groups records by entity, reads local rows, and upserts them to Supabase (`onConflict: "id"`).
- `NoopSyncAdapter` is the constructor default for tests.
- `AppProviders` registers `syncEngine.flush()` on a 30-second interval, web `visibilitychange` (hidden), and NetInfo reconnect events — but only when `isRemoteEnabled()` returns true (`remoteMode` defaults to `"enabled"`).
- Restore v1 (`core/sync/restore.coordinator.ts`) previews and imports `todos`, `habits`, and `calorie_entries` only when the device is empty for synced tables.

### Bootstrap

`AppProviders` initializes the app in this order:

1. `GestureHandlerRootView`
2. `initializeDatabase()`
3. Service worker registration (web only)
4. `ensureAnonymousSession()` (`lib/supabase.ts`) when Supabase env vars are present
5. Sync engine hydrate
6. Restore preview check and optional restore prompt

Any component that calls a `*.data.ts` function must be a descendant of `AppProviders`.

### Routing

- Single-page model: `app/` contains only `_layout.tsx` and `index.tsx`. There are no `app/(tabs)/`, `app/settings.tsx`, or `app/command.tsx` routes.
- `app/_layout.tsx` mounts `GlobalCommandCenterHost` (shows the floating launcher when `COMMAND_EXPERIMENT_ENABLED` is true) and `NavigationProvider`.
- `app/index.tsx` renders the six sections (Overview, Todos, Habits, Pomodoro, Workout, Calories) behind `NavigationContext.activeSection`, with a top tab rail of plain `Pressable` items.
- Settings is a full-screen **modal** opened via `openSettings`; the Command Center is a **global overlay** opened via `openCommand`. Old URLs `/settings`, `/command`, and `/(tabs)/*` no longer exist.

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
2. **Sync enqueue on every applicable write.** Call `syncEngine.enqueue(...)` immediately after `INSERT`/`UPDATE` on `todos`, `habits`, `calorie_entries`, and `workout_routines`. Not synced: `pomodoro_sessions`, `workout_logs`, `habit_completions`, `saved_meals`, `linked_action_rules`, `linked_action_events`, `linked_action_executions`, nested workout tables.
3. **DB singleton.** `getDatabase()` in `core/db/client.ts` is the only entrypoint. Never open a second SQLite connection or access the DB before initialization.
4. **IDs via `createId(prefix)` from `lib/id.ts`.** Format: `{prefix}_{timestamp_ms}_{8_random_chars}`. Never use `Math.random()`, `crypto.randomUUID()`, or `Date.now()` alone.
5. **Date keys via `toDateKey()` from `lib/time.ts`.** Returns local-calendar `YYYY-MM-DD`. Migration 5 records `app_meta.date_key_format` and `date_key_cutover`; old rows are not backfilled.
6. **Migrations are append-only.** Never edit existing migration blocks. Add a new `if (version < N+1) { ... }` block in `runMigrations()` in `core/db/client.ts`.
7. **`schema.sql` is a reference-only partial snapshot** (not runtime authority) — the runtime truth is the bootstrap DDL + append-only migration blocks in `core/db/client.ts`; the snapshot records the current v14 outbox addition but may omit runtime-only details.
8. **Hard-delete exceptions.** `habit_completions` uses `SELECT → INSERT` (new row) or `UPDATE` (count ±1). Hard `DELETE` is allowed only when decrementing from count 1 to 0. `saved_meals` also hard-deletes by design (`DELETE FROM saved_meals WHERE id = ?` in `features/calories/calories.data.ts`). Neither table is synced.

## Feature Module Pattern

Standard new feature layout:

```
features/{name}/
  {name}.data.ts       ← SQLite CRUD + sync enqueue
  {name}.domain.ts     ← pure logic
  {Name}Screen.tsx     ← React Native screen
  types.ts             ← local type barrel (optional)
app/index.tsx  ← section mounted in the single-page shell behind NavigationContext.activeSection
```

Current exceptions:

- `features/overview/OverviewScreen.tsx` only (dashboard composes existing modules).
- `features/settings/` is a screen (`SettingsScreen.tsx`) plus restore-preview logic (`settingsRestorePreview.ts`), shown as a full-screen modal.
- `features/command/` is an overlay-first shell with its own provider, screen, parser, config, and executor files.
- `features/shared/` holds cross-feature UI (`GitHubHeatmap`, etc.) and shared types (`activityTypes.ts`, used by 4 domain layers).
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
npm run lint         # eslint . --max-warnings 25
npm run lint:fix     # eslint . --fix
npm run format       # prettier --write .
npm run format:check # prettier --check .
npm test             # vitest run

# Web build / deploy
npm run build:web    # npx expo export -p web → dist/

# E2E (requires dist/ to be up to date)
npm run e2e          # playwright test (chromium + journeys + simulation projects)
npm run e2e:sync     # remote-boundary journeys against dist-sync/ (:8082) — opt-in, main/nightly only
npm run e2e:report   # open HTML report
npm run e2e:headed   # visible browser for debugging
npm run e2e:debug    # Playwright inspector

# Native E2E (requires a built app installed on a booted target)
npm run qa:native:android  # local Android smoke
npm run qa:native:ios      # local macOS/iOS smoke when available
npm run qa:native:lifecycle
npm run qa:native:targeted
```

Current verified baselines:

- `npm run typecheck`: 0 errors
- `npm run lint`: 0 errors (warnings allowed)
- `npm test`: **740 tests passing** across **70 test files** (672 unit + 68 integration under the `tests/integration/` Vitest project)
- `npx playwright test --list`: **189 tests** across **19 spec files** — the `chromium` project (95 tests in 14 `e2e/*.spec.ts` files), the `journeys` project, the `simulation` project (`simulation/runner/specs/`), and the `journeys-sync` project (`e2e/journeys` `grep /@sync/` — the 19 remote-boundary steps, opt-in via `npm run e2e:sync` against the dummy-Supabase `dist-sync/` build on :8082; main/nightly only)
- `npm run e2e:sync`: **18 passed / 1 skipped** (J3, J4, J5 @sync steps; the skip is J5's CG-2 quarantine) — 0 failed

> The simulation platform (`simulation/`) adds scenario/runner/repro layers on top of the journey suite — see `simulation/README.md` and `docs/testing/known-gaps.md`.

## Testing Strategy

> Test counts in this file (and in `docs/`) are **point-in-time**. Before relying on them, verify with `npx vitest list` and `npx playwright test --list` — they drift as specs are added/removed.

### Unit Tests (Vitest)

- Config: `vitest.config.ts`
- Files: `tests/*.test.ts` and `core/**/__tests__/**/*.test.ts`
- Setup: `tests/setup.ts`
- Coverage emphasis: domain logic, data-layer contracts, command parser/config/executor, linked actions, restore flows, sync engine, and selected DB/provider behavior. Component rendering tests are still limited.
- Every new `*.domain.ts` function should have a Vitest test.

### E2E Tests (Playwright)

- Config: `playwright.config.ts`
- Files: `e2e/*.spec.ts` (14 spec files)
- Runs against the **static web export** in `dist/` served by `node scripts/serve-e2e.js` on `http://localhost:8081`.
- `workers: 1` locally because OPFS + SQLite hold one lock per origin.
- `clearDatabase()` runs in `test.beforeEach`.
- Chromium only, headless by default.
- Report output: `.cursor/playwright-output/e2e-report/`
- Failure artifacts: `.cursor/playwright-output/e2e-failures/`
- Do **not** add `data-testid` attributes to app components to make tests pass.
- If a selector breaks after a UI change, update the selector in the spec; do not weaken assertions.

### Simulation platform (user-simulation)

The user-simulation platform (`simulation/`) layers a typed model + multiple
execution lanes over the journey harness: deterministic/seeded scenarios, repro
bundles, AI exploratory missions, and a disposable-Supabase lane. The runner
now exists (`sim:run`, `sim:validate`) and the lane matrix lives in
`simulation/matrix.ts`. **Read `simulation/README.md` before touching the
platform layer** — it defines the model authoring guide, the lane matrix, the
repro workflow, the isolation rules, and the "which tool for which job"
decision rule.

### Native E2E (Maestro)

- Native flows live in `.maestro/`; they are a focused complement to Playwright,
  not a duplicate feature suite.
- The dedicated EAS profile is `e2e-test`; it creates an Android APK or iOS
  simulator build without production credentials. Do not use Expo Go for native
  lifecycle validation.
- `scripts/qa-native.mjs` performs preflight and writes reports under
  `simulation-output/native/`. Missing Maestro, a booted target, or an
  installed app is an `ENVIRONMENT` blocker, not a pass.
- Native UI/navigation changes require smoke. Native persistence/settings
  changes require targeted persistence flows. Pomodoro, notifications,
  AppState, or lifecycle changes require the lifecycle/notification lane on
  Android and iOS when available.
- `.eas/workflows/native-e2e.yml` is the cloud iOS path and an explicit broader
  native path. It runs manually or with the `native-e2e` pull-request label;
  ordinary web PRs do not implicitly wait for it.
- Notification scheduling-path coverage is not notification-tray delivery.
  Long-running background timers, native `Alert.alert`, and system network
  toggling remain explicit capability gaps in `docs/testing/known-gaps.md`.
- Native failures use the same six classifications as web failures. Preserve
  the flow, platform, target, report, screenshot/log artifacts, and replay
  command before deciding whether the cause is product, test, flake,
  environment, known gap, or ambiguity.

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
- Native E2E profile: `eas build -p android --profile e2e-test` or
  `eas build -p ios --profile e2e-test`; do not submit these builds.
- EAS workflow: `.eas/workflows/native-e2e.yml`.

### CI (GitHub Actions)

`.github/workflows/ci.yml` runs three jobs (lane ids match `simulation/matrix.ts`):

1. **quality** — `npm run typecheck` + `npm run lint` + `npm run test` (Vitest
   runs **both** projects — unit **and** integration — under `TZ=Asia/Manila`).
   Runs on every trigger (PR, push, schedule, dispatch).
2. **e2e** — runs after `quality`, on PRs and on `push` to `main` (and manual
   `workflow_dispatch`); skipped on `schedule` (the `nightly` job covers it).
   - **PR lane:** `npx playwright test --project=chromium` (feature suite) +
     `npm run e2e:journeys:p0` (P0 journeys) + `npm run sim:validate` +
     `npm run sim:run -- --mode deterministic --scenario @p0` (deterministic
     scenario subset, ≤ 10 min budget).
   - **main lane:** full `npm run e2e` (feature + full journeys + simulation
     self-test) + `npm run sim:run -- --mode deterministic` (full library) +
     `dist-sync/` build with DUMMY Supabase env (never PRs, never quality) +
     `npm run e2e:sync` (the dedicated `journeys-sync` project runs the
     remote-boundary journey steps against `dist-sync/` on :8082).
   - Uploads `e2e-report`, `simulation-output/` (run reports, digests, traces,
     repro bundles), and `dist-sync/` — all 7-day retention.
3. **nightly** — `schedule`-only, after `quality`: full `npm run e2e` (full
   journeys) + seeded scenario lane (`sim:run -- --mode seeded`) + `dist-sync/`
   build + the disposable-backend lane (runs only when `SUPABASE_ACCESS_TOKEN`
   is configured; `simulation/backend/guard.ts` hard-isolates it). Non-gating.

The AI exploratory lane and the disposable backend never run on PRs, and the
`dist-sync` build never runs in the quality job — forbidden combinations are
enforced by `validateMatrix()` in `simulation/matrix.ts`.

Native E2E is intentionally outside the ordinary GitHub quality job because
Maestro/device workers and EAS credentials are platform infrastructure. The
EAS workflow is the explicit/manual or `native-e2e`-labeled path; unavailable
iOS or Android infrastructure must be reported as `EXTERNAL BLOCKER`/`NOT RUN`,
never as cross-platform success.

### Autonomous QA workflow

Use `docs/testing/autonomous-qa.md` as the agent-facing escalation guide. Start
with `npm run qa:fast`, inspect `npm run qa:affected` for changed-file impact,
then run the required integration, focused journey, deterministic simulation,
timezone, or full gates. Verification lanes stay deterministic; seeded and AI
exploration preserve their seed/evidence and never replace a gate. On failure,
preserve the assertion and artifacts, reproduce with the same scenario/persona/
seed when applicable, classify as `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`,
`ENVIRONMENT`, `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY`, then fix the underlying
issue and rerun. Never delete/skip/weaken a meaningful test, add blind retries
or arbitrary timeout increases, or ignore persisted DB state because the UI
looks correct.

For every change, use `qa/impact-map.json` through `npm run qa:affected` before
choosing the cheapest sufficient gates. A pure domain change normally stops at
its unit/integration gates; native UI, settings persistence, Pomodoro,
notifications, and lifecycle changes escalate to the corresponding native
commands. A native command that cannot run must remain visible in the handoff.

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
- Sections: rendered in `app/index.tsx` behind `NavigationContext.activeSection` (no per-feature route files)
- Styling: NativeWind `className` with Tailwind utility classes. Do **not** use `StyleSheet.create()` for new code.
- Lists: use `@shopify/flash-list` (`FlashList`), not `FlatList` — except `features/todos/TodosScreen.tsx`, which intentionally uses `DraggableFlatList` (`react-native-draggable-flatlist`) for drag-reorder; do not convert it.
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
