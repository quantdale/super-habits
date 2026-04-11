# SuperHabits Agent Guide

Read this file first in every new session. It is bootstrap-only.

## Read First

Read these in order before broad exploration or edits:

1. `docs/PROJECT_STRUCTURE_MAP.md`
2. `docs/master-context.md`
3. `docs/working-rules.md`

Use `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md` only for supporting detail after the three files above.

## Authority Order

If guidance conflicts:

1. Current code
2. `docs/working-rules.md`
3. `docs/master-context.md`
4. `docs/PROJECT_STRUCTURE_MAP.md`
5. Supporting docs and knowledge-base files
6. This file

## Task Routing

- UI / domain / routing / shared UI tasks:
  - Read the target `*Screen.tsx`
  - Read the matching `*.domain.ts`
  - Read the matching `*.data.ts` as the contract
- Data / DB / sync / migration tasks:
  - Read the target `*.data.ts`
  - Read `core/db/client.ts`
  - Read `core/db/types.ts`
  - Read relevant sync files
  - Read `lib/id.ts` and `lib/time.ts`

## Non-Negotiables

- SQLite is the source of truth.
- Sync is optional, push-only Supabase backup, not bidirectional sync.
- `getDatabase()` stays the only DB entrypoint.
- Data layer owns SQLite writes and sync enqueue.
- Domain layer stays pure.
- UI and route files do not access SQLite directly.
- Synced main entities use soft delete.
- IDs come from `createId(prefix)`.
- Date keys come from `toDateKey()`.
- Migrations in `core/db/client.ts` are append-only.

## Secondary References

- `docs/codex-workflow.md` for Codex-specific execution notes
- `.cursorrules` and `.cursor/rules/superhabits-rules.mdc` for Cursor-specific behavior
- `docs/ai-task-template.md` for reusable task briefs
