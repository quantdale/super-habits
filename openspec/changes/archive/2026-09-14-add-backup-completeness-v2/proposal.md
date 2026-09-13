## Why

Recoverable Account V1 provides the repository-side identity boundary needed
for disaster recovery, but remote backup itself is still incomplete. Restore
V1 recovers only `todos`, `habits`, and `calorie_entries`; workout routine
structure is synced but deliberately excluded from restore because the
nested tables are not remotely represented; and significant user-owned state
remains local-only — habit completion history, pomodoro history, workout
nested structure and history, saved meals, linked-action configuration, and
approved user preferences. A user who loses a device and recovers the same
protected account currently gets back only a fraction of their data.

Backup Completeness V2 makes the remote backup a COMPLETE, versioned,
integrity-checked recovery target for all meaningful user-owned state, while
remaining backup + restore (push-only) rather than full bidirectional sync.

## What Changes

- Expand the remote backup scope to cover habit completion history, pomodoro
  history, full workout routine structure (exercises + sets), workout
  history (logs + session exercises), saved meals, linked-action rule
  configuration, workout routines (restore now included), and an explicit
  allowlisted user-settings snapshot (calorie goal, pomodoro defaults, theme
  preference).
- Add owner-scoped Supabase tables for every new entity plus
  `user_backup_settings` and `backup_manifest`, created by an additive,
  repository-owned migration with the hardened RLS contract
  (`(select auth.uid()) = user_id`, authenticated-only, no anon/PUBLIC,
  UPDATE USING + WITH CHECK).
- Extend the durable SQLite outbox and `SupabaseSyncAdapter` to push the new
  entities with the same owner semantics; hard-delete entities
  (`habit_completions` at count 0, `saved_meals`) get a remote DELETE path;
  settings and the manifest ride the outbox as synthetic entities.
- Introduce a versioned existing-data backfill (`backup_scope_version = 2`)
  that durably enqueues every existing local row (including tombstones) and
  the settings snapshot once durable owner evidence exists, idempotently and
  restart-safe, without blocking local use.
- Introduce a versioned backup completeness checkpoint: a `backup_manifest`
  row containing `backup_schema_version`, a generation, completion time,
  per-entity row counts, and deterministic SHA-256 checksums over canonical
  rows. A manifest is published only after the outbox drains and the queue
  is rechecked; a failed/newer publication never destroys the previous
  known-complete checkpoint.
- Replace Restore V1 with a validate-before-import Restore V2: manifest
  verification, full prefetch with pagination, per-row runtime validation,
  count + checksum integrity verification, dependency-graph validation,
  complete local-data emptiness guard (all user tables, not only synced
  tables), and a single atomic SQLite transaction. Import never replays
  linked actions, recurring-todo expansion, habit thresholds, historical
  reminders, or notification actions; only current/future reminder
  reconciliation runs after commit.
- Add explicit backup states — `V2 COMPLETE`, `V1 LEGACY/PARTIAL`,
  `BACKUP IN PROGRESS`, `BACKUP INVALID`, `UNAVAILABLE` — in Settings UI
  and the startup restore prompt, without weakening V1 behavior.
- Deliberately exclude execution ledgers (`linked_action_events`,
  `linked_action_executions`), `processed_notification_actions`, auth/sync
  internal state, and device-specific preferences from backup; restore
  therefore cannot replay historical effects.
- Add unit, real-SQLite integration, web E2E, and simulation coverage:
  semantic source→restore equivalence for habits/streaks, focus summaries,
  workouts, calories/saved meals, linked-action no-replay + new-event
  behavior, corruption/race/offline failure, large-history scale, and
  cross-user security.

## Capabilities

### New Capabilities

- `backup-completeness-v2`: complete owner-scoped backup scope, versioned
  backfill, integrity-checked completeness checkpoints, dependency-safe
  atomic Restore V2, side-effect suppression, and backup-state UX.

### Modified Capabilities

- `recoverable-account`: unchanged; Backup V2 consumes the existing owner
  binding and emptiness semantics instead of bypassing them.

## Impact

- `core/sync/` (adapter, restore coordinator/types), `core/db/` (app_meta
  registry, schema version 16 metadata additions), new `core/backup/`
  modules (validators, canonical checksum, settings allowlist, backfill,
  checkpoint, restore), feature data layers (transactional enqueue +
  `applyRemote*` import functions), `features/settings/SettingsBackupSection.tsx`,
  `core/providers/AppProviders.tsx`, `supabase/migrations/`,
  `scripts/validate-supabase-schema.mjs`, `simulation/backend/schema.sql`,
  tests/E2E/simulation/docs.
- No destructive SQLite or Supabase changes; no V1 ownership rewrites; no
  new client dependencies.
