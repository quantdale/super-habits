## Purpose

Preserve complete owner-scoped recovery points while new backup data is uploaded, retried or interrupted, and prevent transport failures from silently abandoning valid recovery work.

## ADDED Requirements

### Requirement: Published recovery content is immutable

A published generation MUST identify immutable entity and settings content. Uploading, editing, deleting or abandoning a later generation MUST NOT change the content needed to restore an earlier retained complete generation.

#### Scenario: New data upload is interrupted

- **GIVEN** generation G1 is complete and restorable
- **WHEN** a later upload changes entities and settings, deletes records, and fails before publication
- **THEN** another device MUST restore exactly G1 with valid integrity metadata
- **AND** the incomplete generation MUST NOT be offered as complete

### Requirement: Publication is atomic and idempotent

The authoritative owner head MUST advance only to a fully verified generation in one remote atomic publication boundary. Repeated publication of the same generation MUST be idempotent, and a stale retry MUST NOT regress a newer head.

#### Scenario: Publication response is lost

- **WHEN** publication commits but its acknowledgement is lost and the client retries
- **THEN** the client MUST reconcile the same published generation without duplicate publication or loss of newer pending work

#### Scenario: Two publishers race

- **WHEN** two same-owner clients attempt publication from the same previous head
- **THEN** the head MUST advance according to an explicit serialized conflict contract
- **AND** neither a stale retry nor partial upload MUST overwrite the newer published head

### Requirement: Generation access is owner scoped

Pending and published generations, their content, and their publication operations MUST enforce authenticated owner isolation independently of client-supplied owner fields. Published content MUST reject replacement with different bytes under the same identity.

#### Scenario: Another account supplies the owner's identifier

- **WHEN** account B attempts to read, upload, replace, publish or delete account A's generation content
- **THEN** access MUST be refused without changing A's content or head

### Requirement: Restore reads one coherent retained generation

Restore MUST resolve and validate one generation's entities, settings and relationships before any local import. Concurrent upload/publication MUST NOT mix generation content. Current and previous complete generations MUST survive incomplete-upload cleanup, and an active restore MUST NOT lose its selected generation to cleanup.

#### Scenario: Head changes during restore

- **WHEN** a reader fetches G1 while G2 is published
- **THEN** the reader MUST complete a coherent G1 restore or explicitly restart against G2
- **AND** it MUST NOT import mixed content or replay historical effects

### Requirement: Protocol capability failure preserves local work and legacy recovery

Generation publication MUST use an explicit version/capability contract. Unsupported remotes MUST leave local work durable and report the missing capability without unsafe mutable fallback. Valid supported legacy backups and portable files MUST remain readable with their established checksum semantics.

#### Scenario: Generation capability is unavailable

- **WHEN** the remote lacks the safe publication capability
- **THEN** local writes and pending backup work MUST remain available
- **AND** the client MUST preserve the existing recovery point and disclose paused publication

#### Scenario: Existing legacy backup is selected

- **WHEN** a valid supported legacy backup or portable file is restored
- **THEN** its original protocol, scope, settings and integrity contract MUST be honored without reinterpretation as the new generation protocol

### Requirement: Failure evidence remains specific to affected records

Transient failures MUST NOT count toward a persistent-failure terminal streak. Terminal classification MUST use each affected record's relevant evidence. Success, transient interruption or a different persistent class MUST reset the appropriate consecutive streak. Recovery from an earlier erroneous terminal diagnosis MUST be bounded and preserve diagnostics and data.

#### Scenario: Mixed failures share a batch

- **WHEN** one entity is permanently rejected while another fails transiently and another succeeds
- **THEN** only the permanently failing records MUST be eligible for terminal diagnosis
- **AND** transient records MUST retry after recovery while successful records are acknowledged safely

#### Scenario: Transient failures precede one persistent failure

- **WHEN** repeated transient failures are followed by the first persistent failure
- **THEN** the persistent streak MUST be one and MUST NOT inherit the transient attempt count

### Requirement: Backfill preserves newer committed mutation intent

Backfill MUST preserve the effect of mutations committed after candidate selection, including hard deletes, and MUST NOT replace a newer delete with stale creation work. Concurrent edits/deletions MUST NOT cause surviving rows to be skipped.

#### Scenario: Row is deleted within a backfill batch

- **WHEN** a row is selected, then hard-deleted with a durable delete intent before backfill enqueue commits
- **THEN** the resulting backup work MUST preserve the deletion and MUST NOT require a missing local row to be created remotely

### Requirement: Verification remains complete under bounded transport limits

Push and verification MUST respect supported row and encoded request-size limits without losing completeness. Acknowledgement MUST remove only the exact revisions verified; real missing rows MUST remain diagnosable failures.

#### Scenario: Batch exceeds the response row cap

- **WHEN** the pending records exceed a server response cap and every submitted row is stored
- **THEN** all expected records MUST be verified through bounded requests without a false missing-row failure

#### Scenario: A newer revision arrives during verification

- **WHEN** an earlier revision is verified while a newer same-key mutation commits
- **THEN** acknowledging the earlier revision MUST retain the newer pending work
