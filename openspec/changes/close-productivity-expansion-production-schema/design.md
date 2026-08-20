# Design: Production Schema Convergence Closure

## 1. Scope

This change aligns production Supabase with the already-shipped local/client backup contract for Productivity Expansion Wave V1.

It is intentionally narrow: repository migration authoring, schema validation, live production apply when authorized, and exact verification.

## 2. Authoritative sources

Read before implementation:

- `core/db/client.ts` migrations 17–19
- `core/db/types.ts`
- `core/backup/backup.types.ts`
- `core/backup/backupValidators.ts`
- `core/backup/backupRestore.ts`
- `core/backup/backupCheckpoint.ts`
- `core/sync/supabase.adapter.ts`
- `features/projects/projects.data.ts`
- `features/goals/goals.data.ts`
- `features/daily-plan/dailyPlan.data.ts`
- `features/todos/todos.data.ts`
- `features/habits/habits.data.ts`
- `scripts/validate-supabase-schema.mjs`
- all existing Supabase migrations
- this OpenSpec change

## 3. Live production baseline

Project ref:

`kruubbynsmxzxfdunaal`

Observed before authoring:

- `projects`: absent
- `goals`: absent
- `daily_plans`: absent
- `todos`: no `project_id`, `goal_id`, `completed_at`
- `habits`: no `project_id`, `goal_id`, `completed_at`
- `backup_manifest`: no `backup_scope_version`
- no migration version >= `20260819000000` in the live migration ledger

Existing owner-scoped tables have RLS enabled and four authenticated CRUD owner policies using `(select auth.uid()) = user_id` semantics.

## 4. Migration strategy

Do not edit previously committed migration files.

Keep:

`20260820000000_backup_manifest_scope_version.sql`

Create a new additive migration after it for planning schema convergence.

The new migration must be idempotent where practical (`IF NOT EXISTS`) but still fail loudly on incompatible pre-existing objects rather than silently accepting unsafe shape.

## 5. New remote tables

### projects

Mirror authoritative local fields plus `user_id`:

- `id` text primary key
- `user_id uuid not null default auth.uid()`
- `name` text not null
- `description` text nullable
- `color` text not null
- `status` text not null
- `target_date` text nullable
- `sort_order` integer not null default 0
- `created_at` text not null
- `updated_at` text not null
- `deleted_at` text nullable
- `completed_at` text nullable

Owner FK:

`user_id references auth.users(id) on delete cascade`

### goals

Fields:

- `id` text primary key
- `user_id uuid not null default auth.uid()`
- `project_id` text nullable
- `title` text not null
- `description` text nullable
- `horizon` text not null
- `target_date` text nullable
- `status` text not null
- `progress_percent` integer not null default 0
- timestamps/tombstone/completion fields matching local schema

### daily_plans

Fields:

- `id` text primary key
- `user_id uuid not null default auth.uid()`
- `date_key` text not null
- `intention` text not null default ''
- `top_todo_ids` text not null default '[]'
- `focus_target_minutes` integer not null default 0
- `notes` text not null default ''
- `reflection` text not null default ''
- `energy_score` integer nullable
- `status` text not null default 'draft'
- timestamps/tombstone/completion fields matching local schema

Use owner-scoped active uniqueness for Daily Plans, conceptually:

`unique (user_id, date_key) where deleted_at is null`

Do not create global uniqueness across users.

## 6. Existing table columns

### todos

Current client contract requires:

- `project_id` text nullable
- `goal_id` text nullable
- `completed_at` text nullable

Add them additively.

### habits

Current local schema definitely requires:

- `project_id` text nullable
- `goal_id` text nullable

The current backup constant also lists `completed_at`, but SQLite migration 19 does not add that column.

Resolve this inconsistency before remote DDL.

Preferred default unless domain evidence proves otherwise:

- Habits are ongoing scheduled entities and do not have a terminal completion state.
- Therefore `completed_at` should likely be removed from the current Habit backup canonical columns rather than added as a meaningless local/remote field.

But the implementation agent must verify actual code/tests/history before changing the contract.

If removing it changes current scope canonicalization, update tests and compatibility rules carefully so historical Portable V1 remains stable and current Portable V2 remains internally consistent.

## 7. Owner-safe relationships

IDs are globally primary-keyed today, but relationship integrity must also respect owner.

At minimum ensure the database cannot create cross-owner planning relationships.

Preferred design:

- create unique owner/id pairs where needed, e.g. `(user_id, id)`
- `goals (user_id, project_id)` references `projects (user_id, id)` when `project_id` is non-null
- Todo/Habit `(user_id, project_id)` references `projects (user_id, id)` where feasible
- Todo/Habit `(user_id, goal_id)` references `goals (user_id, id)` where feasible

If PostgreSQL partial/nullable FK mechanics or legacy existing rows make direct composite FKs impractical, use a proven owner-safe alternative and document it. Do not weaken to client-only trust.

Daily Plan `top_todo_ids` remains serialized JSON/text by current design; graph validation remains the application integrity boundary for those IDs.

## 8. RLS

Enable RLS immediately on all three new public tables.

Create four policies per table for `authenticated`:

- SELECT using owner predicate
- INSERT with owner check
- UPDATE using + with check owner predicate
- DELETE using owner predicate

Use `(select auth.uid()) = user_id` style consistent with existing hardened tables.

Do not rely on `TO authenticated` alone.

## 9. Grants

Match the current production convergence model.

- `authenticated` may receive the table privileges needed by the Data API.
- `anon` and `PUBLIC` must not have table privileges.
- RLS remains the row authorization layer for authenticated access.

Do not grant service-role-like privileges to clients.

## 10. Indexes

At minimum add owner/product indexes supporting current access patterns:

Projects:

- `(user_id, status, sort_order)` for active listing
- `(user_id, target_date)`

Goals:

- `(user_id, project_id)`
- `(user_id, status)`

Daily Plans:

- owner-scoped active unique date index
- `(user_id, date_key)` lookup index if not covered by the unique index

Todos/Habits:

- owner/project and owner/goal indexes if current queries/sync paths need them

## 11. Schema validator

Extend `scripts/validate-supabase-schema.mjs` so CI fails if the repository migration contract lacks:

- three planning tables
- required columns
- `user_id` owner defaults/FKs
- RLS
- owner CRUD policies
- no anon/PUBLIC grants
- owner-scoped active Daily Plan uniqueness
- required indexes
- `backup_manifest.backup_scope_version`
- required existing Todo/Habit columns
- owner-safe relationship mechanism

The validator should also reject global `UNIQUE(date_key)` and any global planning-name/title uniqueness.

## 12. Repository tests before live apply

Required focused tests:

- current sync adapter can serialize/push Project/Goal/DailyPlan rows against a schema-compatible test double
- backup/restore/portable tests still pass after any Habit contract correction
- migration/schema validator passes
- dist-sync remote-boundary lane remains green

Run the normal repository quality stack required by the current CI before production apply.

## 13. Live apply protocol

Before mutation:

1. read live migration ledger
2. snapshot counts/owner/null-owner counts for all existing user tables
3. snapshot table/column/RLS/policy/grant/index state
4. confirm no conflicting planning tables already appeared since this spec was authored

Then apply pending migrations in repository order.

Do not rewrite the migration ledger manually.

After apply verify:

- migration ledger contains `20260820000000` and the new planning migration
- tables/columns exactly exist
- row counts of existing tables unchanged except schema metadata
- no existing user rows changed ownership
- RLS enabled
- grants correct
- policies correct
- indexes/constraints correct
- cross-owner references blocked
- same-owner references allowed

## 14. Live smoke / isolation proof

Use a safe disposable/test-user strategy where possible.

Prove at minimum:

- owner A can create/read/update/delete own Project/Goal/DailyPlan rows
- owner B cannot read or mutate A rows
- owner B cannot attach own Todo/Habit to A Project/Goal
- same-owner associations succeed
- Daily Plan same date is allowed for different owners
- duplicate active date for the same owner is blocked
- soft-delete then recreate same owner/date succeeds

Clean up test data afterward.

Do not use production user data for destructive proofs.

## 15. Production backup smoke

After schema convergence, verify a current client-shaped Project/Goal/DailyPlan payload can be accepted by the Data API contract and that backup manifest scope 4 can persist `backup_scope_version`.

Do not mark cloud completeness from a synthetic test unless the normal checkpoint pipeline actually completed.

## 16. ExecPlan state

The prior hardening plan may remain ACTIVE solely because live Supabase/native gates were environment-bound.

This closure owns the Supabase gate.

After successful live convergence:

- reconcile the prior hardening task 11 evidence honestly
- do not falsely mark native Android/iOS as executed
- native may remain ENVIRONMENT/deferred if unavailable
- this new closure can be COMPLETED when the production-schema requirements are satisfied and exact-final-SHA GitHub CI is green

## 17. Final Git/CI

Finish on clean `main`, local == origin/main, remote main-only.

The exact final pushed SHA must have GitHub Actions:

- `quality` PASS
- `e2e` PASS

Do not stop with CI pending/red.
