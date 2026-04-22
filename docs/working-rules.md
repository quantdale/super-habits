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
- `app/(tabs)/*.tsx` should stay thin route wrappers that only render screens.
- `features/{feature}/{feature}.data.ts` owns SQLite reads/writes, soft delete behavior, ID/date helpers, and sync enqueue.
- `features/{feature}/{feature}.domain.ts` stays pure.
- `*Screen.tsx` and feature components orchestrate and render UI; they do not open the DB directly.
- `lib/` stays free of feature imports and DB access.

## Data and Sync Invariants

### Confirmed from code and docs
- SQLite is the source of truth.
- `getDatabase()` in `core/db/client.ts` must remain the only DB entrypoint.
- Linked Actions tables are live in schema migrations: `linked_action_rules`, `linked_action_events`, and `linked_action_executions`.
- Restore v1 preview/import is live through `core/sync/restore.coordinator.ts`, but it is intentionally narrower than full sync.
- Main synced entities use soft delete with `deleted_at`.
- Do not hard-delete synced main entities.
- Enqueue sync immediately after mutating writes for synced entities:
  - `todos`
  - `habits`
  - `calorie_entries`
  - `workout_routines`
- `pomodoro_sessions`, `habit_completions`, `workout_logs`, nested workout tables, and `saved_meals` are not part of active Supabase sync.
- Nested workout edits should continue to bump `workout_routines.updated_at` and enqueue the parent routine instead of inventing nested sync.
- Restore v1 only imports `todos`, `habits`, and `calorie_entries`, and only when synced local tables are still empty.
- Do not document workout restore, saved meal restore, or habit completion restore as shipped behavior.

## IDs, Dates, and Migrations

### Confirmed from code and docs
- Create IDs only with `createId(prefix)` from `lib/id.ts`.
- Create day keys only with `toDateKey()` from `lib/time.ts`.
- `toDateKey()` currently uses local calendar dates, not UTC.
- Runtime schema version is `11`.
- The next schema change belongs in a new `if (version < 12)` block in `core/db/client.ts`.
- Migrations are append-only. Never edit prior migration blocks.
- `core/db/schema.sql` is reference-only and currently stale.

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
- Validation baseline on April 21, 2026:
  - `npm run typecheck` passes.
- `npm test` passes with `326` tests.
  - `npm run build:web` passes.
  - `npx playwright test --list` reports `69` tests in `9` files.

## Web / PWA Constraints

### Confirmed from code and docs
- Web export is static.
- OPFS-backed SQLite on web depends on:
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`
- Those headers are enforced in development and in `vercel.json` for deployment.
- E2E and production-like web testing should use the static export flow, not `npm run web`.

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
