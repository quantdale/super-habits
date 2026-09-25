# Production backup schema rollout — owner review required

Status: `OWNER_APPROVAL_REQUIRED`. No production DDL or data repair was run by
this campaign. Target identity is `superhabits` / `kruubbynsmxzxfdunaal` only
after independent verification by the operator.

## Why this is gated

Read-only inspection on 2026-09-25 found 12 applied migrations. Production
lacks the four Gym V2 backup tables from repository migrations
`20260824010000_add_gym_training_v2_backup_scope.sql` and
`20260824020000_add_gym_workout_deep_expansion.sql`. The missing tables make
current Scope-7 Restore V2 remote fetches fail. The live project already has
41 Scope-7 manifests, 33 calorie rows, and 10 saved meals.

The disposable round trip found a second integrity defect: PostgreSQL `REAL`
returned local body weight `80.123456789` as `80.1235`, invalidating the
manifest checksum. The new append-only
`20260925125655_backup_numeric_precision.sql` converts 17 backed-up numeric
columns to unconstrained `NUMERIC`, preserving the currently serialized
decimal via `(column::text)::numeric`. It follows both Gym files. This cannot
recover digits that older remote `REAL` writes already rounded. Source-device
reupload and a coherent new manifest may be needed for existing owners.

The named disposable project `slvctfwphtpeymzghyoc`, verified distinct from
production, applied the corrective SQL and reported all 17 columns as
`NUMERIC`. The executable app-source battery then passed Scope-7 backup,
owner-scoped PostgREST, Restore V2 on an empty SQLite device, durable outbox
retry, owner mismatch protection, and workout hard deletes. Its test users and
rows were removed. This proves the disposable path, not historical production
backup health; the fixture's earlier baseline migration parity remains
unproven.

## Controlled production procedure

1. Confirm project name, ref, API and database host, and last applied migration
   independently. Prove a current restorable database recovery point covering
   both `public` and `auth`; record its timestamp and operator. Snapshot the
   41 owner-scoped manifests, relevant counts, and current numeric column
   types. Check the prerequisite owner index
   `uq_workout_routines_id_user` still exists. Stop on any drift.
2. From a reachable, owner-controlled runner using pinned Node 22.23.2 and
   Supabase CLI, link only `kruubbynsmxzxfdunaal`. Run `supabase db push
--dry-run --linked`; review output before writing. It must list **exactly**
   the three repo files above, in order, with no repair or unrelated migration.
   Record the dry-run, Git SHA, project ref, CLI version, and recovery point.
3. Obtain explicit owner approval for these three production DDL migrations and
   the planned maintenance window. Run `supabase db push --linked` only under
   that approval. A failed file is a separate recovery boundary: inspect
   applied history and catalog, then fix forward from the actual state. Do not
   routinely drop new tables because clients may already have written rows.
4. Verify all three migration versions, four new Gym tables, owner and composite
   FKs, RLS, four owner policies per table, authenticated grants, no anon table
   grant, and required indexes. Verify all 17 target columns are `NUMERIC` and
   none is `REAL`. Run Supabase security advisors. Test a fresh, owner-scoped
   decimal backup and empty-device Restore V2 with exact cleanup.
5. For each existing manifest, fetch only that owner's remote rows and
   recompute the manifest's versioned canonical counts/checksums. Separate
   missing rows, rounded values, and coherent owners. Do not rewrite manifests
   or weaken Restore V2's checksum to make a mismatch pass. Where the source
   device still has authoritative data, reupload it under the verified bound
   owner and capture a new complete manifest; then prove a fresh empty-device
   restore. Escalate owners without a source dataset to a reviewed recovery
   decision. Certify historical recovery only for cohorts that pass this audit.

The incident-residue cleanup in `incident-residue.md` is a separate approval
boundary. Applying schema migrations never authorizes deleting its 135
confirmed synthetic records.
