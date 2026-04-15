# SuperHabits — Working Rules

This file is for AI agents and contributors. Follow these rules unless the user explicitly asks for a deliberate exception.

## Read order before editing

Start here:

1. `AGENTS.md`
2. `docs/PROJECT_STRUCTURE_MAP.md`
3. `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`

Then read the specific files you will touch completely.

For UI/domain tasks, also read:

- the target `*Screen.tsx`
- the target `*.domain.ts`
- the corresponding `*.data.ts` as contract

For data/DB/sync tasks, also read:

- `core/db/client.ts`
- `core/db/types.ts`
- the relevant `*.data.ts`
- `lib/id.ts`
- `lib/time.ts`

## Task routing

### UI / domain / routing work

Usually limited to:

- `features/*/*Screen.tsx`
- `features/*/*.domain.ts`
- `core/ui/*`
- `app/*`
- `core/providers/AppProviders.tsx`
- `lib/notifications.ts`

### Data / DB / sync work

Usually limited to:

- `core/db/*`
- `core/sync/*`
- `core/auth/*`
- `features/*/*.data.ts`
- `lib/id.ts`
- `lib/time.ts`

If a task touches both, do data changes first, then UI.

## Hard boundaries

Do not do these:

- do not import DB directly in screen files
- do not import DB in domain files
- do not put React/stateful side effects in domain files
- do not hard-delete main synced entities
- do not generate raw random IDs instead of `createId(prefix)`
- do not use ad hoc time/date generation instead of `nowIso()` and `toDateKey()`
- do not edit older migration blocks
- do not treat `schema.sql` as the source of runtime truth
- do not casually add new global state libraries or patterns
- do not wire React Query feature hooks unless explicitly asked

## Data-layer rules

- every DB function starts from `getDatabase()`
- data layer owns SQLite reads/writes
- data layer owns sync enqueue
- data layer owns soft delete behavior
- all relevant writes enqueue immediately after mutation
- synced entity behavior must remain consistent with current queue/adapter model

Known intentional exceptions exist for some non-synced or special tables such as:

- `habit_completions`
- `pomodoro_sessions`
- `workout_logs`
- nested workout tables
- `saved_meals`

## Domain-layer rules

- pure TypeScript only
- no DB access
- no React imports
- no side effects
- domain functions should be straightforward to test

## UI rules

- use existing shared UI primitives where possible
- respect section color identity
- prefer NativeWind `className`
- keep route files thin
- screen files orchestrate only; do not bury persistence logic in UI

## Migration rules

When schema changes are required:

- add a new migration block only
- current next slot is version 12
- update runtime types accordingly
- do not rewrite history
- verify downstream data-layer impact

## Sync rules

Remember:

- local SQLite is source of truth
- Supabase is optional backup sync
- pull is not implemented
- do not accidentally turn backup sync assumptions into full sync assumptions
- preserve parent-routine sync behavior for nested workout edits

## Testing rules

After meaningful changes:

- run `npm run typecheck`
- run `npm test`

If web UI or behavior changed:

- rebuild static web when needed
- run E2E path as appropriate

When business logic changes:

- add or update Vitest coverage

## Documentation rules

When code and docs conflict:

- trust current code first
- then update docs if part of the task
- call out drift explicitly rather than silently assuming docs are right

## Default implementation style

- smallest correct change first
- preserve current architecture
- avoid speculative refactors
- optimize for maintainability, not cleverness
- be explicit about assumptions and uncertainties
