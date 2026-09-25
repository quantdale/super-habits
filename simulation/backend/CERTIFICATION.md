# Disposable backend certification

This lane is opt-in and writes only to a project whose live CLI identity contains
`superhabits-disposable`. It refuses the named production host and any ambient
`EXPO_PUBLIC_SUPABASE_*` client credentials before fetching keys or writing.
The Supabase CLI must be logged in. Use Node `22.23.2` (the repository `.nvmrc`).

```powershell
$pinDir = Join-Path $env:LOCALAPPDATA 'tools\node-v22.23.2-win-x64'
$env:PATH = "$pinDir;$env:PATH"
npx tsx simulation/backend/certify.ts --project-ref slvctfwphtpeymzghyoc --production-host kruubbynsmxzxfdunaal.supabase.co
```

The launcher reads a public client key and a service-role cleanup key from the
CLI in memory. It does not print them or pass them on a command line. The cloud
integration test creates two test users, writes through the app's real data
layers into real SQLite, flushes through the production sync adapter, captures
the Scope-7 manifest, reads all 21 entity tables through owner-scoped
PostgREST, and calls real Restore V2 on an empty second SQLite database. It
also exercises RLS isolation, a spoofed owner write, a partial push failure
and retry, restored-owner mismatch with durable outbox retention, and the
workout log/exercise/set remote hard-delete path. The test cleans only rows
owned by its newly created users and then deletes those users. It does not wipe
or delete the project. The test is skipped during ordinary `npm test` unless
the guarded launcher sets `DISPOSABLE_CERTIFY_RUN=1`.

The project currently disables anonymous sign-ins. The test attempts them,
then uses temporary email users when Auth returns that exact configuration
error. This exercises the same `authenticated` RLS role, but **does not certify
the app's anonymous bootstrap**. The cleanup key is used only after the
owner-scoped assertions.

## Evidence on 2026-09-25

- Project `slvctfwphtpeymzghyoc` is `ACTIVE_HEALTHY`, named
  `superhabits-disposable-202609240546-tqp3`, and distinct from production
  `kruubbynsmxzxfdunaal`. The shell had no production client credentials.
- An initial cloud run passed real backup → manifest → Restore V2, RLS,
  failure retry, owner mismatch, and the workout hard-delete triple with an
  exactly representable body weight of `80`. It used the repository
  `simulation/backend/schema.sql` fixture, so that result did not establish
  parity with every production migration.
- Catalog inspection found that the fixture's four Gym V2 tables lacked the
  owner and routine-owner FKs from
  `20260824010000_add_gym_training_v2_backup_scope.sql`. After confirming
  zero auth users, zero rows in those four tables, and zero inbound FKs, only
  those empty disposable tables were dropped. The exact repository
  `20260824010000` and `20260824020000` Gym SQL files were applied to the
  disposable project through a single guarded migration. Catalog inspection
  then showed all four `auth.users` owner FKs, the two composite routine-owner
  FKs, RLS enabled, four owner policies per table, no `anon` SELECT grant,
  and `authenticated` SELECT/INSERT grants. **Parity of the earlier base
  migrations remains unproven.**
- A valid high-precision body weight exposed a product defect before repair:
  local SQLite retained `80.123456789`; the remote PostgreSQL `REAL` column
  returned `80.1235`. The exact-decimal oracle in
  `tests/integration/disposableCloudRoundTrip.test.ts` therefore fails before
  Restore V2. The Scope-7 manifest hashes local JSON numbers exactly, so this
  was a recovery-integrity blocker. The failing oracle was preserved and
  passed after the append-only precision migration. This does not certify
  historical production backups or the anonymous bootstrap path.
- The reference fixture's 17 measured numeric columns were updated to
  `NUMERIC` alongside the append-only migration work. A fixture edit alone
  cannot change an existing project; the corrective migration was therefore
  applied to the disposable project before the next cloud run.
- The corrective migration `20260925125655_backup_numeric_precision.sql`
  subsequently applied to the guarded disposable project. Catalog verification
  found 17/17 target columns `NUMERIC`, zero missing, and zero remaining `REAL`.
  The rerun passed exact decimal comparisons for calorie and saved-meal macros,
  exercise progression and target load, session-set weight, and body weight;
  it also passed owner-B update/delete denial on a Gym custom exercise. The
  `DISPOSABLE_REMOTE_PASS` marker is emitted only after exact-owner cleanup
  returns without errors and selected post-cleanup row counts are zero. The
  other numeric columns have static migration/fixture checks, while this live
  fixture exercises the listed representative measurements.
- Read-only post-run counts showed zero `auth.users`, `todos`, `habits`,
  `backup_manifest`, `workout_routines`, `custom_exercises`, and
  `body_weight_entries` after the passing run; after the precision failure,
  zero `auth.users`, `body_weight_entries`, `backup_manifest`, and `todos`.
- The independent real-SQLite integration suites
  `backupRestore.test.ts` and `backupPushOwnerStamping.test.ts` passed 33/33
  tests on pinned Node 22.23.2. These are local executable oracles, not
  substitutes for the remote precision failure above.

## Edge Functions

Run the bounded no-provider lane separately:

```powershell
npx tsx simulation/backend/certify.ts --project-ref slvctfwphtpeymzghyoc --production-host kruubbynsmxzxfdunaal.supabase.co --edge-only --deploy-edge
```

The launcher first rejects any disposable provider secret named
`OPENAI_API_KEY`, `AI_COMMAND_MODEL`, or `DEEPSEEK_API_KEY`. `--deploy-edge`
deploys only `parse-ai-command` and `user-ai-ask` to the guarded project with
JWT verification left on. Without that flag, it probes already deployed
functions. The live test sends missing and invalid bearer tokens, then a valid
test-user JWT. Both functions returned `401` for missing/invalid tokens and
`403` for the valid user because the internal rollout flags are default off.
No request reached body validation, quota, or a model provider. The deployed
functions remain on the disposable project; remove them by deleting that
project when its certification use ends. **Provider behavior, quota, and
per-user ownership inside provider work are not certified by this lane.**

If the CLI, Auth settings, Data API, or network fails, stop at that failure,
record the project ref and source SHA, and preserve the exact test output.
Do not substitute a production key or point this lane at production. After a
product migration, rerun the full cloud command and verify its exact-owner
cleanup. Keep local SQLite integration results separate from remote results.
