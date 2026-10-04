## Purpose

Extends the Supabase backup ownership contract so that a remote write is verified before it is certified, so ownership-scoped uniqueness is enforced by a guard rather than assumed, and so every ownership safety check is actually reachable.

## ADDED Requirements

### Requirement: A pushed row is verified before the manifest certifies it

A remote upsert SHALL be confirmed to be visible to the pushing owner before the backup manifest records that row's count and checksum. An upsert that reports success while affecting zero rows for the pushing owner SHALL be surfaced as a push failure that leaves the outbox record queued, not as a success that drops it.

#### Scenario: The conflicting row belongs to another owner

- **WHEN** an upsert conflicts with a row the pushing owner cannot see or update
- **THEN** the push reports a failure for that entity and does not drop the outbox record

#### Scenario: The upsert is verified

- **WHEN** the upsert completes and a read-back confirms the row is visible to the pushing owner
- **THEN** the push succeeds and the outbox record is dropped as today

### Requirement: Ownership-scoped uniqueness is enforced by the schema guard

The schema validation guard SHALL refuse a backup entity whose uniqueness constraint is narrower than the owner. Every backup entity table SHALL be checked, and a global uniqueness constraint on a backed-up table SHALL fail the guard with the affected table named.

#### Scenario: A backup entity carries a global unique constraint

- **WHEN** a migration declares a unique constraint on a backed-up table without the owner column
- **THEN** the schema guard fails and names the table and constraint

#### Scenario: A previously remediated table is preserved

- **WHEN** the guard evaluates a table whose global constraint was replaced by an owner-scoped unique index
- **THEN** the guard passes and does not regress the remediation

### Requirement: The remote ownership check is not vacuous

A defense-in-depth check that asserts remote ownership is unchanged SHALL derive its evidence from a source that is not filtered by the same predicate as the hypothesis it is meant to disprove. A check whose evidence is by construction a subset of the hypothesis SHALL be removed or replaced. The replacement MAY be bounded and sampled rather than exhaustive; when it is, the bound SHALL be explicit (which entities are sampled, and the per-entity row cap) and the check SHALL be described as bounded sampled defense-in-depth, never as proof that no foreign owner exists anywhere in the remote dataset.

#### Scenario: Remote ownership actually changed

- **WHEN** remote rows for the owner include a row attributable to a different owner
- **THEN** the ownership check detects the foreign owner and pauses the backup

#### Scenario: The check cannot be satisfied by construction

- **WHEN** the check's evidence is produced by a query already filtered to the owner under test
- **THEN** the check is replaced by one that can observe a foreign owner, or removed

### Requirement: The pristine-dataset owner check runs on every resolution path

The check that refuses to bind a populated dataset to a session that did not create it SHALL run whenever the dataset is populated, regardless of whether the local owner cache has been primed. A resolution that cannot determine the dataset's owner SHALL refuse to bind rather than bind to whatever session happens to be cached.

#### Scenario: The owner cache is unprimed and data exists

- **WHEN** the local owner cache has never been primed and the dataset holds rows
- **THEN** the resolution refuses to bind to the cached session instead of binding silently

#### Scenario: The dataset is genuinely pristine

- **WHEN** the dataset is empty and unbound
- **THEN** binding proceeds exactly as today

### Requirement: The remote projection is guarded against missing remote columns

A guard SHALL verify that the canonical push projection's column set exists in the repository's remote migration SQL for every backup entity. A local schema change that adds a backed-up column without the corresponding remote migration SHALL fail the guard.

#### Scenario: A local column has no remote counterpart

- **WHEN** `BACKUP_ENTITY_COLUMNS` includes a column that no remote migration declares for that table
- **THEN** the guard fails and names the entity and the missing column

#### Scenario: The projection matches the remote DDL

- **WHEN** every canonical column exists in the remote migration SQL
- **THEN** the guard passes
