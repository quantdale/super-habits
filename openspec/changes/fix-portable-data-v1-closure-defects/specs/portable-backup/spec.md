# Portable Backup — remediation spec delta (Portable V1 closure)

## Purpose

Closes the three Portable Data Export & Import V1 closure defects: the
imported-owner recovery dead end, the native post-read size check, and the
missing export/import size contract. This delta amends the existing
`portable-backup` spec; it does not change the portable file format
(`PORTABLE_BACKUP_FORMAT_VERSION` stays 1).

## ADDED Requirements

### Requirement: Imported-owner recovery

When a file carrying an owner fingerprint is imported onto an unclaimed
device (populated dataset, no permanent owner binding, source fingerprint
recorded), the app SHALL expose a supported path to authenticate and bind the
matching source account. The path SHALL be an explicit user action in
Settings, distinct from import itself, and SHALL NOT require the device to be
empty. Eligibility SHALL require ALL of: meaningful local user data, no local
owner binding, a recorded import-origin owner fingerprint in valid 64-hex
format, no owner-bound outbox rows, and a dataset produced by a validated
Portable Import V1. The exception SHALL NOT apply to arbitrary legacy unbound
local data, local-only portable imports, populated owner-bound devices,
conflicting outbox state, or generic populated-device account switching.

#### Scenario: Matching account recovers an imported dataset

- **WHEN** a user imports an owner-backed file (fingerprint FP_A) on an
  unclaimed device and later requests recovery with the matching account's
  email, completes OTP authentication, and the verified UID's deterministic
  fingerprint equals FP_A,
- **THEN** the dataset is permanently bound to that verified account, the
  imported rows are unchanged, the pending recovery record is cleared, and
  Backup V2 backfill enqueues the imported state under the matched account
  without claiming cloud completeness.

#### Scenario: Nonmatching account cannot bind an imported dataset

- **WHEN** a user imports an owner-backed file (fingerprint FP_A) on an
  unclaimed device and later authenticates an account whose verified UID
  fingerprints to something other than FP_A,
- **THEN** the newly authenticated session is signed out, the local dataset
  and owner binding are untouched, the source fingerprint is preserved, and
  the app returns an owner-mismatch result; imported data is never attached
  to the nonmatching account.

### Requirement: Imported-owner fingerprint authentication boundary

Authentication SHALL occur only through Supabase verification of the account.
The portable file's fingerprint SHALL be treated as compatibility metadata:
it SHALL NOT authenticate anyone, SHALL NOT be rewritten to any account, and
SHALL NOT set `account.owner_user_id`. The binding decision SHALL be: the
verified UID's deterministic fingerprint compared for EXACT equality with the
recorded import-origin fingerprint.

#### Scenario: File fingerprint never authenticates

- **WHEN** an attacker edits a portable file to carry a fingerprint that
  matches their own account,
- **THEN** the file is rejected by payload integrity verification, and even a
  hand-crafted file with a valid checksum cannot bind any account without a
  Supabase-verified session whose fingerprint matches the recorded
  import-origin fingerprint.

### Requirement: Temporary anonymous session safety

Before the app switches from a temporary anonymous session T to the imported
dataset's source account, the app SHALL check whether T has remote backup
rows. If T has remote rows, the switch SHALL be refused as an account
conflict without merging or orphaning T's data. If the remote check cannot
run, the switch SHALL be refused with a retryable remote-unavailable state.
Portable file import itself SHALL NOT require this check and SHALL remain
fully usable without Supabase.

#### Scenario: Temporary session with remote data blocks the switch

- **WHEN** the destination's temporary anonymous session already has remote
  backup rows and the user attempts to authenticate the imported dataset's
  source account,
- **THEN** the switch is refused with an account-conflict result, no account
  binding changes, and no local data is modified.

### Requirement: Native pre-read file size bound

On native platforms, the app SHALL determine the selected file's size from
picker metadata (`DocumentPickerAsset.size`) or file metadata
(`expo-file-system` `File` stat) BEFORE loading the file body, and SHALL
reject the file when that size exceeds `PORTABLE_V1_MAX_BYTES` without
invoking any body read. When the size cannot be verified (missing, zero, or
unreadable metadata), the app SHALL reject the file conservatively. After a
bounded read, the app SHALL still verify the actual UTF-8 byte length and
reject files that exceed the bound (metadata may under-report).

#### Scenario: Oversized native file is rejected before reading

- **WHEN** a user selects a native file whose metadata reports a size greater
  than `PORTABLE_V1_MAX_BYTES`,
- **THEN** the import is rejected immediately and the file body is never read
  into memory.

#### Scenario: Under-reported metadata is still caught

- **WHEN** a native file's metadata reports a size at or below the bound but
  its actual UTF-8 byte length exceeds the bound,
- **THEN** the import is rejected by the post-read byte verification with no
  local state changed.

### Requirement: V1 export/import size contract

The app SHALL define ONE shared `PORTABLE_V1_MAX_BYTES` bound used by
successful export eligibility, web import, native import, tests, and UI copy.
Every successful V1 export SHALL satisfy `byteLength <=
PORTABLE_V1_MAX_BYTES`. When the serialized export would exceed the bound,
the app SHALL return a typed `too_large` failure (with byte length and
maximum) and SHALL NOT present the file as a successful backup; it SHALL NOT
truncate or omit data to fit.

#### Scenario: Oversized dataset cannot be exported

- **WHEN** a user exports a dataset whose serialized portable file exceeds
  `PORTABLE_V1_MAX_BYTES`,
- **THEN** the export reports a safe `too_large` failure, no portable file is
  presented, the local dataset is unchanged, and cloud backup is unaffected.

## MODIFIED Requirements

### Requirement: Import validation pipeline (size bound)

The 100 MB bound in the import validation pipeline SHALL be the shared
`PORTABLE_V1_MAX_BYTES` constant (same value), and native imports SHALL
enforce it before loading the file body in addition to the post-read
verification.

#### Scenario: Web and native enforce the same V1 bound

- **WHEN** an import is attempted on web or native,
- **THEN** the file is rejected against the single shared
  `PORTABLE_V1_MAX_BYTES` bound, with native rejecting before any body read
  and web rejecting before `File.text()`.

### Requirement: Import-origin ownership protection

Adds the recovery transition: the app SHALL provide a supported path for the
matching source account to authenticate and bind a populated imported
dataset (see "Imported-owner recovery"), while preserving the existing
fail-closed protection against unrelated accounts. This path SHALL NOT apply
to arbitrary legacy unbound local data, local-only portable imports,
populated owner-bound devices, conflicting outbox state, or generic
populated-device account switching.

#### Scenario: Imported dataset still protected after the recovery path is added

- **WHEN** a populated imported dataset exists and a user attempts any action
  other than the imported-owner recovery flow,
- **THEN** the dataset remains unbound, unrelated accounts fail closed, and
  no local data or owner binding changes.

### Requirement: Owner fingerprint (source metadata)

Unchanged contract; the fingerprint remains one-way compatibility metadata.
The remediation adds the explicit binding rule (verified UID → deterministic
fingerprint → exact compare) and SHALL document that the fingerprint is not
authentication and can never set `account.owner_user_id`.

#### Scenario: Fingerprint metadata never authenticates

- **WHEN** the app binds an imported dataset to an account,
- **THEN** binding occurs only after Supabase verifies the account and the
  verified UID's deterministic fingerprint exactly matches the recorded
  import-origin fingerprint; the file itself never authenticates anyone.
