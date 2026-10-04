# ExecPlan: Harden silent-failure certification

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Apply the [harden-silent-failure-certification OpenSpec change](proposal.md) and its
[tasks](tasks.md): every backup, restore, and sync outcome is reported only from
evidence that establishes it — an indeterminate answer is a first-class visible state
distinct from legacy, a remote write that silently affected nothing is a push failure,
every ownership safety check is reachable by construction, a permanently un-pushable
record reaches a diagnosable terminal state instead of freezing the checkpoint forever,
and the migration chain fails loudly rather than re-running destructively.

## Context

- Starting HEAD `c1bc380ce330cda1e089fd79b49a12029defbb72` on `main`, with six earlier
  changes from this wave already applied on top of it.
- An empty error message from a proxy satisfied `isMissingV2RemoteTableError`, so a
  complete V2 backup was downgraded to the three-entity legacy restore and reported as a
  success; the coverage summary's `catch` collapsed every manifest-fetch failure to
  `v1_legacy`, so Settings stated a falsehood during an outage.
- `upsert(..., { onConflict: 'id' })` returns HTTP 200 while affecting zero rows when a
  row with the same id belongs to another owner (RLS makes the write a no-op), so the
  record was dropped from the outbox and the manifest certified a row the remote never
  stored.
- `getRemoteFingerprint` derived `ownerIds` from a count already filtered to the current
  user, so the set could only be `[userId]` or `[]` and the `remote_foreign_owner`
  protection branch was unreachable by construction.
- `resolveSyncOwnerUserId` ran the pristine-dataset check only for an explicitly `null`
  owner cache, so an unprimed cache skipped it and a device with real data stamped new
  intents with whichever account was current.
- A corrupted `db_schema_version` parsed to 0 and re-ran the whole chain, whose block 6
  rewrites user-authored todo ordering; `habit_completions` carried a global
  `UNIQUE (habit_id, date_key)` whose scope is narrower than the owner.

## Scope

The seven task groups in tasks.md: backup coverage and restore honesty (1.1-1.7), terminal
outbox classification (2.1-2.5), remote write verification (3.1-3.4), ownership-scoped
uniqueness and non-vacuous checks (4.1-4.6), migration and remote-projection integrity
(5.1-5.5), copy and count accuracy (6.1-6.2), and validation (7.1-7.6).

## Non-Goals

No change to the Restore V2 checksum algorithm or its strictness, the one-way backup
model, soft-delete semantics, or any threshold. No bidirectional sync, merge-on-restore,
or degraded-restore policy. No dead-letter table, retention policy, or operator UI. No
change to any Maestro flow, E2E journey, or fixture. No Supabase production access: the
remediation is repository-side migration SQL. No new local migration — the local schema
stays 25 and every change is configuration or logic.

## Current Checkpoint

- Current milestone: COMPLETE — all 35 tasks in tasks.md are checked, each backed by an
  edit plus executing coverage, with the validation gate recorded from the final tree.
- Completed: the three-valued capability probe and the indeterminate coverage state
  (a first-class state distinct from legacy) with its own copy; the `missingEntities` disclosure; per-entity restored counts; the durable
  outbox attempt ledger with a terminal `blocked` state, its copy, and its exclusion from
  the completeness gate (with the matching manifest omission so integrity holds); the
  post-push read-back; the generalized owner-scoped uniqueness table with the
  `habit_completions` remediation; the distinct-owner remote probe; the unprimed-cache
  fix; the migration version/head/ordering guards and the remote-DDL projection guard;
  the corrected restore-prompt copy; and the owner-scoped pending-change count.
- In progress: none.
- Important modified files: `core/backup/backupRestore.ts`,
  `core/backup/backupCheckpoint.ts`, `core/sync/{outboxAttempts (new), sync.engine,
syncPersistence, supabase.adapter, syncedMutation, restore.types}`,
  `core/auth/accountCoordinator.ts`, `core/db/{client, appMeta}.ts`,
  `core/providers/AppProviders.tsx`, `core/sync/restore.coordinator.ts`,
  `features/settings/{SettingsScreen,SettingsBackupSection}.tsx`,
  `scripts/validate-supabase-schema.mjs`, `simulation/backend/schema.sql`, one new
  Supabase migration, and eleven test files.
- Last successful validation: pinned Node `v22.23.2` — `npm run typecheck` 0 errors;
  `npx eslint .` 0 errors / 0 warnings; unit project 169 files / 2052 tests green;
  real-SQLite integration project 80 files / 397 tests passed, 1 file / 2 tests skipped
  (pre-existing); `npm run supabase:schema:validate` PASS; `npm run openspec:validate
--all` 68/68; the strict per-change validate OK; `npm run build:e2e` hermetic (0
  Supabase hosts); the two affected journeys re-run against that fresh export.
- Current failures: none. Under full-suite parallel load on this host, three unrelated
  files intermittently hit vitest's 5s per-test budget on their FIRST test, which pays a
  cold module import (measured 5.0-6.1s). Each failure disappears in isolation, a
  different set appears per run, and the whole unit project is green at
  `--maxWorkers=4` (169/169, 2052/2052). The three files whose first test is an import of
  code this change touched were fixed at the source by moving the load to collection time
  (`tests/accountRemoteFingerprint.test.ts`,
  `core/sync/__tests__/supabase.adapter.test.ts`, `tests/askDefaultOffSurface.test.ts`);
  the remaining ones are pre-existing exposure on a loaded host, left unchanged rather
  than given longer timeouts.
- Relevant quarantines: none. No test was weakened, skipped, or given a longer timeout.
  Five data-layer unit fixtures gained a stub for the owner inspection and the
  sync-engine read members their code now calls, and the Ask-pipeline suites declared
  their explicit rollout opt-in — each a fixture correction, not a relaxed assertion.
- Blockers: none.
- Condition required to unblock: not applicable.
- Exact resume action after unblock: not applicable.
- Exact next action: none — the change is fully applied. Archiving into `openspec/specs/`
  and committing the tree are separate, user-invoked steps.
- Remaining definition of done: complete.

## Progress

- [x] Wave 1 — the three-valued capability probe (1.1); empty/unrecognized messages
      yielding indeterminate rather than legacy (1.2); the `unknown` state in the summary
      and the union, with the catch no longer collapsing to `v1_legacy` (1.3); its copy
      (1.4); the `missingEntities` disclosure beside the completeness claim (1.5);
      per-entity restored counts on the V2 success path (1.6); and integration coverage
      for the empty-message case, the unknown-not-legacy case, the genuine-legacy
      control, and the count report (1.7).
- [x] Wave 2 — the durable attempt ledger in `app_meta`, surviving restarts (2.1); the
      four persistent classes with every transient failure kept on the existing backoff
      (2.2); the `blocked` state and its copy (2.3); the checkpoint exclusion plus the
      matching manifest omission that keeps the certified scope truthful (2.4); and
      coverage for every persistent class, the transient control, the terminal
      no-freeze, and the omission (2.5).
- [x] Wave 3 — the post-upsert read-back scoped to the pushing owner (3.1); its
      zero-rows outcome surfacing as a per-entity failure through the existing
      `SyncPushPartialFailureError` path (3.2); integration coverage that a conflicting
      foreign row fails the push and keeps the record (3.3); and the added request
      counted and asserted to be one per entity per flush (3.4).
- [x] Wave 4 — the uniqueness assertions generalized into a `{ table, ownerColumns,
remediation }` table (4.1); `habit_completions` added with an additive remediation
      migration and a matching fixture change (4.2); the distinct-owner probe replacing
      the self-answering count (4.3); coverage that a foreign owner pauses the backup and
      records `remote_foreign_owner` (4.4); the unprimed-cache hole closed so the
      pristine check runs on every unconfirmed path (4.5); and coverage for the
      cached-session-versus-verified-user divergence (4.6).
- [x] Wave 5 — a non-numeric stored version failing loudly on a populated database (5.1);
      the `addedSortOrder`-style guard on block 6's backfill (5.2); the head-version
      assertion (5.3); the remote-DDL projection guard beside the existing PRAGMA check
      (5.4); and a real-SQLite coverage case for a corrupted version with a
      user-reordered list (5.5).
- [x] Wave 6 — the restore-prompt copy enumerating only what the V1 path imports (6.1)
      and the owner-scoped pending-change count (6.2).
- [x] Wave 7 — the focused and full suites, the schema guard, openspec validation, the
      hermetic build, the affected journeys, and the invariant review (7.1-7.6).

## Surprises & Discoveries

- The generalized uniqueness guard immediately failed against the live fixture: it caught
  `habit_completions`' global `UNIQUE (habit_id, date_key)` in BOTH the migration SQL and
  the disposable-lane fixture — a real cross-owner collision the old per-table guard could
  not see. Fixing it needed a new additive migration (the applied one is historical
  input, per the same reasoning the `saved_meals` remediation used) and a fixture change.
- The remote-DDL guard reads BOTH the migration SQL and `simulation/backend/schema.sql`,
  so a non-vacuity probe must remove the column from both; removing it from the migration
  alone proves nothing, which the first probe attempt demonstrated.
- The checkpoint's outbox gate is one helper called at five sites, so excluding blocked
  records was a single change — but excluding them from the GATE alone would have been
  worse than the freeze: the certified snapshot is computed from local rows, so a blocked
  entity's rows would be checksummed into a manifest the remote cannot match. The blocked
  entities are therefore excluded from the certified metadata as well, and the omission
  is disclosed rather than claimed.
- The read-back changes the `from()` call pattern, which broke three adapter tests that
  asserted call ORDER; they now assert distinct entities in first-seen order, which is
  the property they actually mean.
- The unprimed-owner fix adds a DB read on a path that previously did none, which
  shifted five data-layer unit fixtures that own order-sensitive `getFirstAsync` queues.
  The fixtures now stub the owner inspection explicitly rather than silently depending on
  queue position.
- Three unit files charged a cold module import to their first test's 5s budget. That is
  a real flake source under parallel load, and the fix was to move the load to collection
  time — not to raise the timeout, which would have hidden it.
- `js-yaml` is absent from this repo's declared dependencies, so every structured read
  added here (flow tags, merged manifest, plan sections) uses a small purpose-built parser
  rather than adding an undeclared dependency to a quality gate.
- The replacement remote-ownership probe is bounded, not exhaustive: it samples three of
  the twenty-one recoverable entities (`todos`, `habits`, `calorie_entries`) at up to 20
  rows each (`OWNER_PROBE_ENTITIES` / `DISTINCT_OWNER_PROBE_LIMIT` in
  `core/auth/accountCoordinator.ts`). The spec now requires any such replacement to state
  its bound explicitly and to be described as bounded sampled defense-in-depth; the local
  owner-binding branch stays the primary guard.

## Decision Log

- Separate `unknown` from `v1_legacy` rather than encoding indeterminacy into an existing
  state: `unavailable` already means "not configured for this account", and a legacy claim
  is a promise that most of the dataset is absent.
- Classify by whether the TRANSPORT succeeded, not by which URL answered: two endpoints
  can both fail through one proxy with one empty message, so only a well-formed "absent"
  answer may produce a legacy classification.
- Store the attempt ledger in `app_meta` rather than adding a column or a dead-letter
  table: it is local operational state, never backed up, and the change earns no local
  migration.
- Count ATTEMPTS, never elapsed time, and let only the four distinguishable persistent
  classes reach the terminal state, so a slow-but-working backend and a transient outage
  are never classified as broken.
- Exclude blocked entities from the certified manifest as well as the outbox gate;
  excluding only the gate would trade a frozen checkpoint for a manifest that fails its
  own integrity check.
- Read back only the ids just written, scoped to the current owner, once per entity per
  flush: bounded by the batch already in use, and it converts the silent skip into a
  classifiable failure without changing the upsert target.
- Name the uniqueness scope in an explicit table rather than regex-scanning for `UNIQUE`
  without `user_id`: a sweep false-positives on legitimate indexes and cannot tell an
  owner-scoped index from an unrelated one.
- State the distinct-owner probe's bound in the requirement text and the design rather
  than implying exhaustive coverage. The property that matters is that the evidence is not
  produced by the same predicate it must disprove; "bounded and sampled" is honest about
  the rest, and the check remains strictly better than the self-answering version it
  replaced. No additional remote reads were added to widen it: cost is a real constraint
  and the local binding check already covers the primary path.
- Query distinct remote owners without a `user_id` filter: the discriminating property
  is that the evidence is not derived from the hypothesis it must disprove.
- Treat an UNPRIMED owner cache exactly like a known-empty one, so the pristine-dataset
  check runs on every path without a confirmed owner.
- Fail a populated database with an unreadable version instead of re-running the chain,
  and keep the head assertion so a silently-skipped block is caught immediately.

## Adversarial Review and Dispositions

- **Could a healthy push be failed by the read-back?** The non-vacuity control pushes
  normally and drains; the read-back is one request per entity and answers from the rows
  the upsert sent.
- **Could the blocked state hide data loss?** No: the entity is omitted from the certified
  scope, the state is `blocked` (not `in_progress`), the copy names the class and reason,
  and `missingEntities` lists the group. A blocked backup is visibly incomplete.
- **Could the terminal state fire on a flaky network?** Every transient class, including
  an empty message, is excluded by construction, and a transient failure resets the streak
  so a later persistent failure must earn its own bound.
- **Did any checksum, soft-delete, one-way, or SQLite-authority rule weaken?** The
  validators and `lib/checksum.ts` are untouched; the only removed lines in
  `backupRestore.ts` are the vacuous empty-message fallback, the boolean probe, the
  `v1_legacy` collapse, and the unscoped count.
- **Is the remote-ownership check now reachable?** A coordinator test drives the
  post-conversion fingerprint with a foreign owner and observes the pause, the recorded
  `remote_foreign_owner` failure, and the cleared pending record.
- **Is the migration guard exercised?** A real-SQLite case seeds a user todo with a
  hand-set `sort_order`, corrupts the stored version, and shows both refusal conditions
  with the ordering intact; the head assertion is cross-checked against the highest
  `applyMigration` target in the source.
- **Could the E2E lane have lost coverage?** The two affected journeys re-ran against a
  fresh hermetic export: 3 passed, 10 skipped — and every skip is a registered `@sync`
  lane attribute (known-gaps entries 8/9 and 20), not a gate this change introduced.

## Validation Ledger

| Date       | Command / source                                                                                                     | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | `npm run typecheck` (pinned Node v22.23.2)                                                                           | PASS — 0 errors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-01 | `npx eslint .`                                                                                                       | PASS — 0 errors, 0 warnings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-01 | `npx vitest run --project unit --maxWorkers=4`                                                                       | PASS — 169 files / 2052 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-01 | `npm run test:integration` (real better-sqlite3)                                                                     | PASS — 80 files / 397 tests passed, 1 file / 2 tests skipped (pre-existing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-01 | `npx vitest run tests/integration/backupRestore.test.ts`                                                             | PASS — 33/33 (empty-message never legacy, unknown-not-legacy, genuine-legacy control, restored counts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-01 | `npx vitest run tests/integration/backupCheckpoint.test.ts`                                                          | PASS — 13/13 (no freeze on a terminal record, manifest omission, transient control)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-10-01 | `npx vitest run tests/integration/syncPushVerification.test.ts`                                                      | PASS — 3/3 (silent skip fails and keeps the record; healthy push drains; one read-back per entity)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-01 | `npx vitest run tests/outboxTerminalFailure.test.ts`                                                                 | PASS — 11/11 (four persistent classes, bound, transient never blocks, streak reset, terminal stability, colon ids)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-01 | `npx vitest run tests/migrationChainIntegrity.test.ts`                                                               | PASS — 6/6 (loud refusal, block-6 guard shape, head assertion, append-only shape, real corrupted-version database)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-01 | `npx vitest run tests/integration/backupCanonicalColumns.test.ts`                                                    | PASS — 3/3; non-vacuity: removing `todos.title` from BOTH DDL sources fails with exactly `{ todos: ['title'] }`, restored to green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-01 | `npm run supabase:schema:validate`                                                                                   | PASS — 16 migrations; non-vacuity: restoring the global `habit_completions` constraint fails the guard, restored to green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-01 | `npm run openspec:validate --all`                                                                                    | PASS — 68 passed / 0 failed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-01 | `openspec validate harden-silent-failure-certification --type change --strict`                                       | PASS — change is valid                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-01 | `npm run web:hygiene` + `npm run build:e2e`                                                                          | PASS — ports 8081/8082 free before the run; hermetic export with 0 Supabase hosts in `dist/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-01 | `npx playwright test --project=journeys e2e/journeys/new-phone.spec.ts e2e/journeys/portable-owner-recovery.spec.ts` | PASS — 3 passed, 10 skipped; every skip is a registered `@sync` lane attribute (known-gaps 8/9/20), including the CG-2 restore-contract step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-01 | Full-diff review (7.6)                                                                                               | PASS — validators and `lib/checksum.ts` untouched; no Maestro flow, E2E journey, or fixture edited; the only removed lines are the four vacuous ones named above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-01 | `npm run build:sync` then `npm run e2e:sync` (pinned Node v22.23.2, fresh dummy-env `dist-sync/`)                    | **44 passed, 1 failed, 7 skipped, 1 did not run** (4.3 m). The failure is the documented host-unreachability gap: `bad-backend` P5 step 5 (partial failure) misses because `dummy.supabase.co` is NXDOMAIN on this host (`nslookup` → "Non-existent domain"; `curl` exit 6 / HTTP 000) — `known-gaps.md:216` records the same deterministic local miss at pre-campaign `7a49647` with a green CI run at that SHA. **The 7 skips are the restore-prompt branches themselves**, still `test.fixme(!remoteBackupDetected)`: an unreachable dummy host means `getRestorePreview()` reports `remote_backup_unavailable`, so the prompt cannot appear locally. Tasks 1.5/1.6 therefore still have **no runtime journey evidence on this host**; their only lane is the nightly report-only `e2e:sync` step (`simulation/matrix.ts` marks dist-sync `gates: false`, so the gating `e2e` job builds `dist-sync/` but never runs the lane — pinned by `tests/ciLaneIntegrity.test.ts`). Classification: `ENVIRONMENT` (documented known gap), not a product regression. |

## Changed Files / Areas

- `core/backup/backupRestore.ts` — three-valued `V2CapabilityProbe`; the empty-message
  refusal in `isMissingV2RemoteTableError`; the `unknown` and `blocked` states;
  owner-scoped `pendingChangeCount`; `describeRestoredCounts` / `totalRestoredCount`; and
  a self-explaining diagnostic on the non-legacy path.
- `core/backup/backupCheckpoint.ts` — blocked-aware `durableOutboxCount` (one helper, five
  call sites) and `computeEntityMetadata`'s exclusion of blocked entities, so the frozen
  checkpoint and the certified scope agree.
- `core/sync/outboxAttempts.ts` (new) — failure classification, the bounded attempt
  ledger, the terminal state, and the user-facing diagnosis.
- `core/sync/sync.engine.ts` — ledger load/save, per-record failure classification,
  blocked records kept out of the retry queue, streak clearing on success, and
  `blockedEntities` in the status.
- `core/sync/syncPersistence.ts` — durable ledger access in `app_meta` with a validator, so
  a corrupt row can never wedge the outbox.
- `core/sync/supabase.adapter.ts` — the post-upsert read-back and its failure message.
- `core/sync/syncedMutation.ts` — the unprimed-cache path now runs the pristine check.
- `core/sync/restore.types.ts`, `core/sync/restore.coordinator.ts` — the `unknown` and
  `blocked` states, and `missingEntities` on the preview.
- `core/auth/accountCoordinator.ts` — the bounded distinct-owner probe.
- `core/db/client.ts` — `EXPECTED_SCHEMA_VERSION` with the head assertion, the populated
  corrupted-version refusal, and the block-6 `addedSortOrder` guard.
- `core/db/appMeta.ts` — the `sync.outbox_attempts` key.
- `core/providers/AppProviders.tsx` — restore-prompt copy matching the V1 import set.
- `features/settings/SettingsBackupSection.tsx`, `features/settings/SettingsScreen.tsx` —
  the `unknown`/`blocked` copy, the scope disclosure, and the per-entity restored report.
- `scripts/validate-supabase-schema.mjs` — the owner-scoped uniqueness table and the
  habit-completions remediation checks.
- `supabase/migrations/20260930000000_habit_completions_owner_scoped_uniqueness.sql` (new),
  `simulation/backend/schema.sql` — the additive owner-scoped index and its fixture mirror.
- Tests: `tests/outboxTerminalFailure.test.ts` (new),
  `tests/migrationChainIntegrity.test.ts` (new),
  `tests/integration/syncPushVerification.test.ts` (new), plus updates to the backup
  restore/checkpoint, canonical-columns, sync-adapter, saved-meal, performance, account
  coordinator/fingerprint, db-client, and data-layer fixtures.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the change's
   `proposal.md` / `design.md` / `specs/` / `tasks.md`.
2. `git status --short` and `git diff --stat`; reconcile this checkpoint against the real
   tree.
3. Re-run the focused suites named in the ledger, then
   `npx vitest run --project unit --maxWorkers=4` and `npm run test:integration`.
4. No implementation action remains. Archiving the change into `openspec/specs/` and
   committing the tree are separate, user-invoked steps.

## Outcomes & Retrospective

- Status: Completed.
- Summary: "we could not verify this" is now a first-class outcome in the backup state
  machine rather than a silent downgrade; a remote write that stored nothing is a push
  failure instead of a certified row; a permanently un-pushable record reaches a visible
  terminal state with a named cause instead of freezing the completeness checkpoint
  forever; the ownership checks are reachable by construction rather than by assertion;
  and the migration chain fails loudly rather than re-running a destructive backfill.
  Two real defects were found and fixed by the new guards themselves — the global
  `habit_completions` uniqueness, and the silent-skip upsert.
- Follow-up: archive this change into `openspec/specs/` when the user invokes the
  OpenSpec archive step. All seven changes in this wave are now applied and committed;
  running the workflows remains user-invoked. Two recorded follow-ups remain
  owner-gated: `docs/release/release-signing-posture.md`'s signing decisions, and the
  native device leg recorded in `harden-native-evidence-and-release-posture`.
- Runtime-evidence gap, recorded 2026-10-01: tasks 1.5 (`missingEntities` disclosure)
  and 1.6 (per-entity restored counts) are covered by unit/integration assertions, but
  the journeys that would render them are the P6 restore-prompt branches, which stay
  `test.fixme(!remoteBackupDetected)` on this host because `dummy.supabase.co` does not
  resolve locally. `npm run e2e:sync` was run against a fresh dummy-env `dist-sync/`
  and the branches still skipped. The tasks stay checked on their unit/integration
  evidence; the missing runtime leg is `ENVIRONMENT` with the CI sync lane as the
  authoritative lane.
