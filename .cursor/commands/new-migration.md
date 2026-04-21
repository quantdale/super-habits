# new-migration

Safely add a new SQLite migration to SuperHabits. Plan-first.

---

Apply db-and-sync-invariants skill.
Use data-agent subagent.

Migration request: {{change}}

Rules:
- Current schema version: 11. New migration: version 12 (next if (version < 12) block in runMigrations).
- Read core/db/client.ts completely before writing anything.
- Never modify existing migration cases.
- Never modify bootstrap DDL.
- schema.sql is reference only — do not update it.
- After migration, update TypeScript types in core/db/types.ts.

Plan first:
1. Exact SQL for the migration
2. Updated TypeScript type(s) in core/db/types.ts
3. Any data.ts functions that need updating
4. Confirm migration number

Wait for approval, then implement.
Run npm run typecheck and npm test after.
