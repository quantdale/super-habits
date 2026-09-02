# SuperHabits Working Rules

Purpose: concise implementation guardrails for contributors and AI agents. This file is operational by design. Use `docs/master-context.md` for architecture and project identity, and `docs/repo-map.md` for navigation.

## Read Order

1. `AGENTS.md`
2. `docs/PROJECT_STRUCTURE_MAP.md`
3. `docs/master-context.md`
4. Relevant feature `*.data.ts` and `*.domain.ts`

If this file conflicts with current code, trust the code and document the conflict.

## Task Execution Workflow

### Confirmed workflow for the recovered clean repo

- Start each new task from updated `main`.
- Create one branch per task.
- Use one worktree per active task whenever tasks may proceed in parallel.
- Keep the task scope isolated to that branch and worktree until it is ready to merge.

### Wave rules

- Group work into waves.
- A wave may contain multiple tasks only if they are parallel-safe.
- Do not start the next wave until the current wave is complete.
- Re-plan before the next wave if completed work changes assumptions or file ownership.

### Parallel-safe vs overlapping

- Parallel-safe tasks do not touch the same files and do not depend on each other's output.
- Overlapping tasks share files, shared contracts, or sequencing dependencies and must not run in the same wave.
- If there is any doubt about overlap, treat the tasks as sequential.

## Layering Rules

### Confirmed from code and docs

- `app/` is Expo Router only.
- `app/index.tsx` renders all six sections behind `NavigationContext.activeSection`; there are no per-feature route files (`app/(tabs)/` was removed).
- `features/{feature}/{feature}.data.ts` owns SQLite reads/writes, soft delete behavior, ID/date helpers, and sync enqueue.
- `features/{feature}/{feature}.domain.ts` stays pure.
- `*Screen.tsx` and feature components orchestrate and render UI; they do not open the DB directly.
- `lib/` stays free of feature imports and DB access.

## Current Product-Shell Facts

### Confirmed from code

- The app is single-page: `app/index.tsx` renders all six sections behind `NavigationContext.activeSection`; there is no `/` redirect or `/(tabs)/` routes.
- The command center is overlay-first: `app/_layout.tsx` mounts the global overlay host, but the only global floating action is Add. Advanced capture is reached through Add → Describe it; there is no retained `/command` page route.
- Do not add a second global command launcher. Command Center can still open from Add → Describe it and explicit advanced/developer entry points.
- Calories supports `Form` and `Diary` modes and remembers the last selected mode.
- Settings keeps six buckets in this order: Appearance, Backup / Sync / Restore, AI / Command, Notifications / Timer defaults, Nutrition defaults, Developer / Internal.
- Backup wording must stay conservative: push backup + Restore V2 (legacy V1 labeled) + Portable file export/import, not full two-way sync.

## Data and Sync Invariants

### Confirmed from code and docs

- SQLite is the source of truth.
- `getDatabase()` in `core/db/client.ts` must remain the only DB entrypoint.
- Linked Actions tables are live in schema migrations: `linked_action_rules`, `linked_action_events`, and `linked_action_executions`.
- Restore v1 preview/import is live through `core/sync/restore.coordinator.ts`, but it is intentionally narrower than full sync.
- Main synced entities use soft delete with `deleted_at`.
- Do not hard-delete synced main entities.
- Enqueue sync immediately after mutating writes for the full recoverable
  scope (see Backup Completeness V2 below): `todos`, `habits`,
  `habit_completions`, `calorie_entries`, `saved_meals`,
  `pomodoro_sessions`, `workout_routines`, `routine_exercises`,
  `routine_exercise_sets`, `workout_logs`, `workout_session_exercises`,
  `linked_action_rules`, `weekly_reviews`, `projects`, `goals`, `daily_plans`,
  `workout_session_sets`, `custom_exercises`, `workout_weekly_plan`,
  `workout_schedule_overrides`, `body_weight_entries`, plus the synthetic
  settings/manifest records.
- Backup Completeness V2 (backup schema version 2; current scope version 7;
  Scope 6 remains frozen compatibility)
  syncs the full recoverable
  scope: todos, habits, habit_completions, calorie_entries, saved_meals,
  pomodoro_sessions, workout_routines, routine_exercises,
  routine_exercise_sets, workout_logs, workout_session_exercises,
  workout_session_sets, custom_exercises, workout_weekly_plan,
  workout_schedule_overrides, body_weight_entries, linked_action_rules,
  weekly_reviews, projects, goals, daily_plans, plus the synthetic
  `user_backup_settings` and
  `backup_manifest` records.
- Hard-delete entities (`habit_completions` at count 0, `saved_meals`)
  remote-delete; soft-delete tables push tombstones.
- Nested workout edits bump `workout_routines.updated_at` AND enqueue the
  nested rows in the same transaction.
- Restore V2 imports the complete scope on a fully empty device (all user
  tables + outbox) in one transaction with no historical side effects;
  legacy V1 backups remain restorable and are labeled `V1 LEGACY/PARTIAL`.

## IDs, Dates, and Migrations

### Confirmed from code and docs

- Create IDs only with `createId(prefix)` from `lib/id.ts`.
- Create day keys only with `toDateKey()` from `lib/time.ts`.
- `toDateKey()` currently uses local calendar dates, not UTC.
- Runtime schema version is `24`.
- The next schema change belongs in a new `if (version < 25)` block in `core/db/client.ts`.
- Migrations are append-only. Never edit prior migration blocks.
- `core/db/schema.sql` is reference-only but is maintained through the current
  runtime schema version; runtime migration code remains authoritative.

## Feature Workflow

### Confirmed from docs

- Before changing feature logic, read the feature’s `*.data.ts` and `*.domain.ts`.
- If changing UI or domain behavior, treat the data layer as the contract.
- If changing persistence, schema, or sync behavior, read:
  - `core/db/client.ts`
  - `core/db/types.ts`
  - `core/sync/sync.engine.ts`
  - `core/sync/supabase.adapter.ts`
  - `lib/id.ts`
  - `lib/time.ts`

## Testing Workflow

### Confirmed from code and docs

- Standard checks:
  - `npm run typecheck`
  - `npm test`
- If web UI or web bundle behavior changes:
  - `npm run build:web`
  - `npm run e2e`
- Playwright runs against static `dist/` served by `node scripts/serve-e2e.js`, not Metro.
- Web/PWA behavior depends on OPFS-compatible isolation headers.

### Confirmed from code

- Validation baseline (point-in-time; re-verify with `npx vitest list` / `npx playwright test --list` instead of trusting the numbers below):
  - `npm run typecheck` passes (0 errors).
  - `npm test` passes with `664` tests across `63` test files (613 unit + 51 integration).
  - `npm run build:web` passes.
  - `npx playwright test --list` reports `181` tests across `19` spec files in 4 projects (chromium 90, journeys 69, simulation 3, journeys-sync 19).

## Web / PWA Constraints

### Confirmed from code and docs

- Web export is static.
- OPFS-backed SQLite on web depends on:
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`
- Those headers are enforced in development and in `vercel.json` for deployment.
- E2E and production-like web testing should use the static export flow, not `npm run web`.
- `npm run web` / `npm run web:dev` is a **persistent Metro server** — agents must never await it as a validation gate. Automated web verification uses only finite commands: `npm run build:web`, Playwright (which owns its server via `scripts/serve-e2e.js`), or `npm run web:verify`. At campaign end, `npm run web:hygiene` must report 8081/8082 free or owned by unrelated processes.

## Documentation Hygiene

### Confirmed from code and docs

- Do not copy large sections between docs.
- Keep authoritative values centralized:
  - schema version and migration guidance in `docs/master-context.md`
  - implementation guardrails here
  - task prompts in `docs/ai-task-template.md`
  - file navigation in `docs/repo-map.md`
- Keep workflow guidance centralized in `docs/codex-workflow.md`; other docs should summarize it, not fork it.

### Known drift to keep in mind

- `core/db/schema.sql` is reference-only and intentionally lags runtime migrations.
- Secondary or historical docs may lag route surfaces, restore scope, or linked-actions support and should be cross-checked against current code before edits.
