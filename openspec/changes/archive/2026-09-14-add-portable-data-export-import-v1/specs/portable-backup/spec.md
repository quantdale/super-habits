# Portable Backup — spec delta

## Purpose

Defines the user-controlled, file-based Portable Data Export & Import V1
capability: a versioned, integrity-protected, self-contained JSON backup file
that can be exported offline and imported atomically onto an eligible empty
installation after full validation, preview, and explicit confirmation.
Portable backup is distinct from owner-scoped cloud backup (Backup
Completeness V2) and never requires Supabase or Auth.

## ADDED Requirements

### Requirement: Portable file format

The app SHALL export the complete recoverable user scope into ONE
self-contained JSON file with envelope fields `format =
"superhabits-portable-backup"`, `formatVersion` (currently 1),
`backupSchemaVersion` (the domain backup schema version, currently 2),
`exportedAt` (ISO-8601), `source {appVersion, platform, ownerFingerprint}`,
`entities` (the 12 recoverable entity arrays), `settings` (the recoverable
settings allowlist payload), and `integrity {entities, settings,
payloadChecksum}`. The file SHALL use the `.json` extension and MIME
`application/json`, SHALL contain no executable content and no arbitrary SQL,
and SHALL NOT contain auth/session/JWT/service-role credentials, raw Supabase
user UUIDs, `sync_outbox` rows, or raw internal `app_meta` values.

#### Scenario: Export produces a complete portable file

- **WHEN** the user exports a portable backup on a device with todos,
  habits, habit completions, calorie entries, saved meals, workout
  routines/exercises/sets, workout logs, session exercises, pomodoro
  sessions, linked action rules, and recoverable settings,
- **THEN** the file contains `entities` arrays for all 12 entities with
  every active and soft-deleted row, `settings` matching the recoverable
  settings snapshot, and a `payloadChecksum` that verifies against the
  documented canonical payload text.

#### Scenario: No secrets enter the file

- **WHEN** the user exports a portable backup,
- **THEN** the file contains no access token, refresh token, session token,
  service-role key, raw Supabase user UUID, `sync_outbox` row, or
  `processed_notification_actions` row.

### Requirement: Export snapshot coherence and read-only behavior

The app SHALL capture the SQLite entity snapshot, the SQLite-backed
recoverable settings, and the AsyncStorage theme snapshot in one serialized
read transaction, re-verify the settings/theme snapshot after commit, and
retry once when it changed. Export SHALL NOT mutate any user data: no sync
records, no linked-action events, no saved-meal use-count changes, no
timestamps, no `app_meta` writes.

#### Scenario: Export does not mutate anything

- **WHEN** the user exports a portable backup on a device with pending
  sync work,
- **THEN** the outbox row count, every row's `updated_at`, saved-meal
  `use_count`, linked-action ledgers, and `app_meta` are byte-identical
  before and after the export.

### Requirement: Owner fingerprint

When the local dataset has a durable owner binding, the exported file SHALL
carry `source.ownerFingerprint` = SHA-256 of the fixed domain separator
`"superhabits-portable-owner-v1:"` concatenated with the owner UUID; a
dataset without a durable binding SHALL carry `null`. The fingerprint SHALL
be treated as one-way compatibility metadata only — the app SHALL NOT treat
it as authentication, SHALL NOT accept it as authority for setting
`account.owner_user_id`, and SHALL NOT use it to transfer ownership.

#### Scenario: Same-owner round trip

- **WHEN** a file exported from an owner-bound dataset is imported on an
  empty device whose durable owner fingerprint matches,
- **THEN** the import is eligible and the dataset remains bound to that
  owner.

#### Scenario: Different-owner file is blocked

- **WHEN** a file carrying fingerprint A is imported on an empty device
  whose durable owner fingerprint is B (A ≠ B),
- **THEN** the import is rejected with an owner-mismatch error and no local
  state changes.

### Requirement: Import eligibility and empty-device guard

Portable import SHALL be allowed only when the destination is semantically
empty per the complete user-data inventory used by Recoverable Account V1 /
Restore V2 (no user rows, active or deleted, in ANY user-owned table; no
pending or unowned outbox work). Import SHALL NOT merge. A device containing
only pomodoro history or only workout history is NOT empty. The emptiness
guard SHALL be re-verified inside the import transaction.

#### Scenario: Populated device cannot import

- **WHEN** the user attempts to import a portable backup on a device that
  contains any user data or pending sync work,
- **THEN** the import is rejected, the preview explains the device must be
  empty, and no local state changes.

### Requirement: Import validation pipeline

Before any local write, the app SHALL validate, in order: file size (≤ 100
MB), JSON parseability, envelope shape, format version (unknown future
version rejected), backup schema version (unknown future or legacy version
rejected), presence of all 12 entity arrays with no unknown entity keys,
every row via the shared backup row validators, settings runtime
validation, per-entity row counts and SHA-256 checksums, settings checksum
and version, the envelope payload checksum, the dependency graph via the
shared graph validator, owner compatibility, and destination emptiness.
Any failure SHALL reject the import and leave the local database unchanged.

#### Scenario: Corrupt file rejected without mutation

- **WHEN** the user selects a portable file whose JSON is invalid, or whose
  format/version is unknown, or whose row, checksum, dependency, or payload
  integrity fails, or which exceeds the size bound,
- **THEN** the import is rejected with a readable error, and no local
  database row, outbox record, or `app_meta` value changes.

### Requirement: Preview and explicit confirmation

After validation succeeds, the app SHALL show a human-readable preview
(export creation time, per-domain row counts, settings included, integrity
status, owner compatibility, warnings) and SHALL NOT write anything before
the user explicitly confirms. Cancel SHALL leave everything unchanged. The
confirm action SHALL be idempotent (a double activation SHALL NOT execute
the import twice).

#### Scenario: No write before confirmation

- **WHEN** a valid file has been selected and the preview is shown,
- **THEN** the database and outbox are untouched; only after the user
  presses Import do writes occur.

### Requirement: Atomic import with no historical side effects

The app SHALL import all validated rows through the shared side-effect-free
restore import functions in dependency order (parents before children)
inside ONE SQLite transaction, apply SQLite-backed settings, stage theme
application durably for post-commit AsyncStorage application with restart
retry, and record import-origin metadata (`portable.last_import_at`,
`portable.last_import_format_version`, `portable.last_import_owner_fingerprint`).
Import SHALL NOT replay historical side effects: no linked-action execution,
no recurring-todo creation, no habit-reminder scheduling for the past, no
notification replay, no saved-meal use-count increments. A failure SHALL roll
back the transaction.

#### Scenario: Import restores state without replaying history

- **WHEN** a file containing past habits, completions, linked-action rules,
  and completed workouts is imported,
- **THEN** streaks, calories, focus minutes, and workout summaries match the
  source, linked-action events/executions and notification-processing
  tables remain empty, and no future-dated recurring todos or notifications
  were created by the import.

### Requirement: Post-import backup state

Portable import SHALL NOT mark cloud backup complete. When a durable owner
binding exists after import, the app SHALL reset the backfill completion
markers and scope version, set the backup dirty flag, and enqueue the
imported state for that owner's cloud backup so a subsequent checkpoint can
publish a fresh manifest. When no durable owner exists, the imported data
SHALL remain fully usable locally.

#### Scenario: Imported state later backs up to the compatible owner

- **WHEN** a same-owner file is imported on an owner-bound empty device and
  remote backup is enabled,
- **THEN** the imported rows are durably enqueued for that owner, the cloud
  backup is not claimed complete until a real checkpoint publishes, and the
  next maintenance cycle produces a complete manifest for the imported
  state.

### Requirement: Import-origin ownership protection

When a file with an owner fingerprint is imported onto a device without a
permanent owner binding, the app SHALL drop any provisional binding, record
the import-origin fingerprint, and SHALL refuse to bind a later verified
account whose fingerprint does not match the recorded origin. A local-only
source file (no fingerprint) imported onto an owner-bound device SHALL
require explicit confirmation that the imported data becomes that account's
dataset.

#### Scenario: Unrelated account cannot claim an imported dataset

- **WHEN** a file with owner fingerprint A is imported onto an unclaimed
  device and the user later signs in with account B,
- **THEN** account B is not bound to the dataset; remote backup stays paused
  with an owner-mismatch state, and no imported row is uploaded under B.

### Requirement: Platform behavior

On web, export SHALL generate the file locally (Blob download, object URL
revoked) with no server upload, and import SHALL use an explicit file-input
selection. On native, export SHALL write a temporary file and open the
system share/save surface, cleaning the temporary file when safe, and import
SHALL use the system document picker after explicit user selection. The app
SHALL NOT scan directories or auto-discover files.

#### Scenario: Web round trip

- **WHEN** the user exports on web and re-imports the downloaded file on an
  empty web installation,
- **THEN** the download is a local Blob download with the deterministic
  filename, and the import previews and restores the dataset.

### Requirement: Security and disclosure

All imported strings SHALL be treated as data: rendered inert, inserted with
parameterized SQL only, never executed or evaluated. Imported values SHALL
NOT be used to build SQL dynamically. The export UI SHALL disclose that the
file contains personal Super Habits data and that V1 files are not encrypted.

#### Scenario: Hostile strings stay inert

- **WHEN** a portable file contains HTML/script-like text, SQL-looking
  text, control characters, or very long Unicode in user fields,
- **THEN** the import succeeds or fails on validation alone; no code
  executes, no HTML renders as markup, and the database stores the strings
  as data.

### Requirement: Accessibility

Export/import controls SHALL have accessible labels and roles, visible
disabled/busy states, and announced error messages; the preview SHALL be
screen-reader comprehensible; confirmation focus movement SHALL be
deterministic; no information SHALL be conveyed by color alone.

#### Scenario: Screen reader import flow

- **WHEN** a screen-reader user selects a file and reaches the preview,
- **THEN** every domain count, the integrity status, and the owner
  compatibility message are announced as text, and Cancel/Import are
  labeled buttons with clear disabled states while importing.
