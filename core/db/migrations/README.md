# migrations/ — reference SQL for the remote/Supabase side only

This directory holds **reference SQL for the remote/Supabase side** of the
project — currently a single post-MVP placeholder (`001_initial_supabase.sql`).

Local database migrations do **not** live here. Local schema changes are
append-only `if (version < N) { ... }` blocks inside `runMigrations()` in
`core/db/client.ts` (current stored schema version: 22).

Adding numbered `.sql` files here will **NOT** execute them — the local SQLite
schema is created and migrated exclusively by `core/db/client.ts`.
