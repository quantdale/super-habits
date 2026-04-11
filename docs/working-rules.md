# SuperHabits Working Rules

Purpose: concise implementation guardrails for contributors and AI agents. This file is operational by design. Use `docs/master-context.md` for architecture and project identity, and `docs/repo-map.md` for navigation.

## Read Order

1. `AGENTS.md`
2. `docs/PROJECT_STRUCTURE_MAP.md`
3. `docs/master-context.md`
4. Relevant feature `*.data.ts` and `*.domain.ts`

If this file conflicts with current code, trust the code and document the conflict.

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
- Main synced entities use soft delete with `deleted_at`.
- Do not hard-delete synced main entities.
- Enqueue sync immediately after mutating writes for synced entities:
  - `todos`
  - `habits`
  - `calorie_entries`
  - `workout_routines`
- `pomodoro_sessions`, `habit_completions`, `workout_logs`, nested workout tables, and `saved_meals` are not part of active Supabase sync.
- Nested workout edits should continue to bump `workout_routines.updated_at` and enqueue the parent routine instead of inventing nested sync.

## IDs, Dates, and Migrations

### Confirmed from code and docs
- Create IDs only with `createId(prefix)` from `lib/id.ts`.
- Create day keys only with `toDateKey()` from `lib/time.ts`.
- `toDateKey()` currently uses local calendar dates, not UTC.
- Runtime schema version is `9`.
- The next schema change belongs in a new `if (version < 10)` block in `core/db/client.ts`.
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

## UI Consistency Rules

### Confirmed from current UI code
- `features/overview/OverviewScreen.tsx` is the canonical visual baseline for top-level screen structure.
- Top-level screens should share the same structural language:
  - page header via the shared `SectionTitle` pattern
  - summary/stat row directly below the header when the screen exposes headline metrics
  - named panels/cards for major sections
  - consistent vertical spacing between header, stat row, and major sections
- Feature identity stays color-coded by section:
  - Todos blue
  - Habits green
  - Focus purple
  - Workout orange
  - Calories amber
- Structural consistency matters more than page-by-page novelty. New screens and refactors should inherit the shared layout/card/header/spacing system instead of inventing feature-local chrome.
- When a header, stat card, section panel, or repeated empty-state pattern already exists in `core/ui/`, reuse it before creating screen-local styling.
- Preserve feature-specific interaction patterns and content hierarchy; do not flatten modules into one generic page.

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
- `npm test` currently passes with `180` tests.
- `npm run typecheck` currently fails because `tsconfig.json` has an incompatible `ignoreDeprecations` value for the installed TypeScript version.

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

### Known drift to keep in mind
- `README.md` still reports planned stack versions rather than current package versions.
- `e2e/README.md` still describes the old Metro-based E2E flow.
- `.github/copilot-instructions.md` is stale on `toDateKey()` and E2E startup.
