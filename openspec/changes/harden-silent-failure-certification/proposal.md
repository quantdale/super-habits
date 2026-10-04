## Why

Several backup, restore, and sync paths label an operation as complete, legacy, or successful on the basis of evidence that does not establish it. An empty error message from a proxy is classified as "the remote predates V2" and silently downgrades a full backup to a three-entity restore that is then reported as a success; every manifest-fetch failure — including a transient network error under a complete V2 backup — is summarized as `v1_legacy`, so the Settings screen states an untruth during an outage; a single outbox record that can never push blocks the completeness checkpoint forever with no terminal state; and `upsert` with `onConflict: 'id'` skips silently when a conflicting row belongs to another owner, so the push is recorded as a success and the manifest then certifies counts and checksums for rows the remote never stored. In each case the system tells the user or the certification record that something is true when it has not been verified.

## What Changes

- Require the V2-versus-legacy classification to be established by a probe that is independent of the failing transport, and require an empty or unrecognized error message to produce an indeterminate result rather than a legacy classification.
- Give the backup state summary an indeterminate/unknown state distinct from `v1_legacy`, and stop reporting a transient remote failure as a legacy-only backup.
- Surface the already-computed `missingEntities` set in the Settings coverage copy, and report per-entity restored counts on a successful V2 restore.
- Add a terminal classification for outbox records that can never succeed, with a distinct backup state and a user-visible diagnosis, so a permanently blocked backup is not indistinguishable from an in-progress one.
- Verify after each remote upsert that the pushed row is visible to the pushing owner before the manifest certifies it, and surface a silent-skip as a push failure rather than a success.
- Certify that no backup entity carries a global uniqueness constraint whose scope is narrower than the owner, by extending the existing schema validator guard that already covers `saved_meals` and `daily_plans` to `habit_completions`.
- Replace the vacuous remote-ownership check with one whose evidence is not derived from the same filter that produced the hypothesis it is meant to disprove.
- Close the unprimed-owner-cache hole in `resolveSyncOwnerUserId()` so the pristine-dataset safety check runs on every path, and add a post-migration assertion that the chain landed on the expected maximum schema version plus an idempotency guard on the destructive `sort_order` backfill.
- Correct the restore-prompt copy that promises the legacy V1 restore surface it does not deliver, and stop counting outbox rows owned by a different owner in `pendingChangeCount`.
- Add a guard that the remote DDL column set covers the client's canonical push projection, mirroring the local coherence test that already compares `BACKUP_ENTITY_COLUMNS` against `PRAGMA table_info`.

## Capabilities

### New Capabilities

None. Every requirement below extends a capability the repository already owns.

### Modified Capabilities

- `backup-completeness-v2`: Add requirements that backup coverage and restore outcomes are reported only from established evidence — an indeterminate state distinct from legacy, a probe independent of the failing transport, disclosed omitted entity groups, per-entity restored counts, a terminal state for un-pushable outbox records, and a guarded, version-asserting migration chain.
- `supabase-backup-ownership`: Add requirements that a remote write is verified before it is certified, that global uniqueness constraints narrower than the owner are refused by the schema guard, that the remote-ownership defense-in-depth check is not vacuous, and that the pristine-dataset owner check runs on every resolution path.

## Impact

Touches `core/backup/`, `core/sync/`, `core/auth/`, `core/db/client.ts`, `scripts/validate-supabase-schema.mjs`, `features/settings/`, and `core/providers/`. No local schema migration is earned: local schema stays 25 and no new migration block is proposed. This change does not query or mutate Supabase production, does not raise any ceiling or threshold, and does not weaken Restore V2 checksum rejection, soft-delete, one-way backup, or SQLite-authority invariants. Applying it converts several silent degradations into visible, classified failures, so the first run after apply may surface a backup that the previous build reported as healthy; that is the intended outcome.
