# SuperHabits Working Rules

Purpose: execution guardrails for contributors and AI agents. This file is about how to work in the repo, not about repeating the full architecture.

## Read Order

1. `AGENTS.md`
2. `docs/PROJECT_STRUCTURE_MAP.md`
3. `docs/master-context.md`
4. The exact files you plan to touch

If docs conflict with code, trust the code and document the conflict.

## Decision Boundary

- UI / domain / routing work:
  - Read the target screen
  - Read the matching domain file
  - Read the matching data file as the contract
- Data / DB / sync / migration work:
  - Read the target data file
  - Read `core/db/client.ts`
  - Read `core/db/types.ts`
  - Read relevant sync files
  - Read `lib/id.ts` and `lib/time.ts`
- Mixed work:
  - Treat the data layer as the source of truth first

## Core Rules

- SQLite is the source of truth.
- Supabase sync is optional push-only backup, not real-time sync and not bidirectional sync.
- `getDatabase()` in `core/db/client.ts` remains the only DB entrypoint.
- Data-layer files own SQLite reads/writes, soft delete, and sync enqueue.
- Domain files stay pure: no DB access, no React, no side effects.
- UI files orchestrate and render only: no direct SQLite imports.
- Route files stay thin.

## Persistence Rules

- Do not hard-delete synced main entities.
- Preserve the intentional hard-delete exceptions:
  - `habit_completions` rows can be removed when count reaches zero
  - `saved_meals` is hard-deleted by design
- Use `createId(prefix)` from `lib/id.ts` for new IDs.
- Use `toDateKey()` from `lib/time.ts` for local `YYYY-MM-DD` day keys.
- Use `nowIso()` for timestamps when adding new write paths that need timestamps.
- Do not edit historical migration blocks in `core/db/client.ts`.
- `core/db/schema.sql` is reference-only, not runtime authority.

## Sync Rules

- Only data-layer code calls `syncEngine.enqueue(...)`.
- Enqueue immediately after mutating writes for synced entities.
- Synced entities are currently:
  - `todos`
  - `habits`
  - `calorie_entries`
  - `workout_routines`
- Preserve the current workout rule:
  - nested workout edits update and enqueue the parent routine row
- Do not imply pull, restore, conflict resolution, or multi-device merge behavior that the code does not implement today.

## UI Rules

- `features/overview/OverviewScreen.tsx` is the structural reference for top-level tab screens.
- Reuse shared primitives from `core/ui/` before adding feature-local chrome.
- Preserve section color identity by feature.
- Do not move business logic into screens just to simplify UI wiring.

## Documentation Rules

- Keep canonical guidance in one place.
- Prefer referencing canonical docs over copying long rule blocks.
- When you discover drift, call it out explicitly under a drift or risk section instead of silently pretending it never existed.
- For documentation changes, trust code over older prose.

<<<<<<< HEAD
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
=======
## Validation Guidance
>>>>>>> a74517a (dark mode, documentatiton, blank fix)

Standard validation targets:

- `npm run typecheck`
- `npm test`

If web UI or web runtime behavior changed:

- `npm run build:web`
- `npm run e2e`

Current repo caveat:

- `npm run typecheck` is expected to fail until `tsconfig.json` stops using `ignoreDeprecations: "6.0"` with TypeScript `~5.9.2`.

## Known Drift / Risks

- `core/db/schema.sql` does not match runtime migrations and must not be treated as runtime truth.
- Sync is push-only today because `SupabaseSyncAdapter.pull()` returns `[]`.
- `remoteMode` defaults to enabled, but missing Supabase env vars leave remote operations as safe no-ops.
- Legacy duplicate docs still exist for compatibility and should remain thin pointers, not independent sources of truth.
