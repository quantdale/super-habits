## Purpose

Extends Backup Completeness V2 so that backup coverage, restore eligibility, and sync progress are reported only from evidence that actually establishes them, and so a remote or local operation that cannot be verified produces a visible, classified failure instead of a reassuring label.

## ADDED Requirements

### Requirement: V2-versus-legacy classification comes from independent evidence

The decision that a remote backup is a pre-V2 legacy backup SHALL be established by a probe whose result does not share the failure signature of the error being classified. A missing, empty, or unrecognized error message SHALL produce an indeterminate result, not a legacy classification.

#### Scenario: The transport fails with an empty message

- **WHEN** the manifest fetch and the V2-presence probe fail with an empty or unrecognized error message
- **THEN** restore reports an indeterminate state and does not fall through to the legacy path

#### Scenario: The server genuinely predates V2

- **WHEN** the V2-presence probe reports the tables absent through a working transport
- **THEN** restore reports legacy and the legacy path runs

#### Scenario: The probe shares the failure signature

- **WHEN** the only evidence for legacy is an error whose text merely resembles a missing-relation error
- **THEN** the classification is indeterminate and restore refuses rather than importing a partial dataset

### Requirement: Backup coverage has an indeterminate state

The backup coverage state SHALL include a state distinct from `v1_legacy` for "the remote state could not be established". A transient remote failure on an account with a certified V2 manifest SHALL NOT be summarized as a legacy-only backup, and the summary SHALL NOT assert that a legacy backup exists when none has been observed.

#### Scenario: The manifest fetch fails transiently

- **WHEN** the manifest row cannot be fetched because of a network or transport failure
- **THEN** the coverage summary is indeterminate and does not claim that only a legacy backup exists

#### Scenario: The manifest is genuinely absent

- **WHEN** no manifest exists for the owner
- **THEN** the coverage summary reports the legacy state with its existing copy

### Requirement: Omitted entity groups are disclosed to the user

The backup coverage summary SHALL disclose every entity group that the certified scope omits relative to the current backup scope. The summary SHALL NOT state that a verified complete backup exists while entity groups are omitted.

#### Scenario: The most recent manifest predates the current scope

- **WHEN** the certified manifest omits entity groups that the current scope includes
- **THEN** the coverage copy names the omitted groups instead of reporting a complete backup

### Requirement: A successful restore reports what it restored

A restore that completes SHALL report the per-entity restored counts to the user. A restore that reports success SHALL NOT leave the user without any confirmation of which entity groups were populated.

#### Scenario: A V2 restore completes

- **WHEN** a V2 restore finishes successfully
- **THEN** the user is shown the per-entity restored counts

### Requirement: An un-pushable outbox record reaches a terminal state

An outbox record that cannot succeed SHALL be classified with a terminal state after a bounded number of attempts, and the resulting backup state SHALL be distinguishable from an in-progress backup. The user SHALL be shown a diagnosis naming the blocked entity rather than an indefinitely frozen pending count.

#### Scenario: One entity's records can never drain

- **WHEN** a remote entity's records can never be pushed successfully
- **THEN** the backup state reports a blocked condition naming that entity, distinct from in-progress

#### Scenario: The outbox drains normally

- **WHEN** every outbox record is eventually pushed
- **THEN** no terminal classification is applied and the normal completeness path runs unchanged

### Requirement: Restore prompts describe the surface they deliver

A prompt that offers a legacy restore SHALL enumerate only the entity groups the legacy path imports.

#### Scenario: The legacy path is offered

- **WHEN** the restore prompt describes a legacy V1 restore
- **THEN** it names only the entity groups the legacy path imports and states that history and settings are excluded

### Requirement: Pending change counts are owner-scoped

The reported pending change count SHALL count only outbox records that the current owner can push.

#### Scenario: A foreign owner's records remain

- **WHEN** the outbox contains records owned by a previously bound owner
- **THEN** those records are excluded from the reported pending change count

### Requirement: The migration chain lands on its expected version

After the migration chain runs, the stored schema version SHALL equal the expected maximum version. A destructive backfill SHALL be guarded so that re-running it cannot recompute values the user has since changed, and a non-numeric or missing stored version SHALL be treated as an integrity failure rather than as a safe re-run of every block.

#### Scenario: The stored version is corrupted

- **WHEN** the stored schema version is non-numeric or missing on a populated database
- **THEN** the migration run fails loudly rather than silently re-running every block from version zero

#### Scenario: The chain completes

- **WHEN** the migration chain completes successfully
- **THEN** the stored schema version equals the expected maximum and the run asserts it
