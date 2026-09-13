## Purpose

This capability provides durable, reproducible evidence that the application
survives sustained realistic use, repeated restart/foreground cycles,
representative old-database upgrades, malformed or interrupted recovery
operations, and broad cross-feature state transitions without silent data
loss, duplicated writes, resource runaway, stale-day behavior, or dishonest
test classification.

## ADDED Requirements

### Requirement: Long-session behavior stays bounded

The repository MUST provide a repeatable, bounded soak lane that drives
realistic sustained product behavior and emits machine-readable evidence.
Repeated long sessions MUST NOT exhibit unexplained monotonic resource
runaway, late-sequence product failure, or data-integrity drift. Soak
thresholds MUST derive from existing contracts, known-good baselines, or
documented trend rationale rather than invented constants.

#### Scenario: Repeated sustained interaction remains stable

- **WHEN** the soak lane runs a bounded realistic action sequence from fresh
  state at least twice after final fixes
- **THEN** recorded resource samples show bounded growth or stabilization,
  every action completes through product contracts, and final database
  invariants hold with no duplicate or lost writes

#### Scenario: Soak report is replayable

- **WHEN** a soak run produces its machine-readable report
- **THEN** the report names the scenario manifest/seed, per-phase samples,
  timing distributions where measured, and the exact replay command

### Requirement: Historical databases upgrade safely

Representative historical SQLite schemas MUST upgrade to the current schema
through automated fixture-based tests that assert schema version advancement,
required objects, row survival with correct defaults, tombstone persistence,
date-key semantics, ownership/outbox coherence, reader compatibility, and
initialization idempotency. Documentation MUST state clearly whether this
coverage is synthetic rather than real user-corpus proof.

#### Scenario: A representative historical boundary upgrades cleanly

- **WHEN** a synthetic fixture representing a selected historical schema
  boundary is initialized through the real migration chain to current version
- **THEN** version metadata, required tables/columns/indexes, pre-existing
  rows, soft-delete tombstones, date keys, and owner/outbox state match the
  asserted expectations and re-running initialization changes nothing

#### Scenario: Interrupted migration cannot silently corrupt state

- **WHEN** a supported test seam injects failure into an upgrade step on a
  historical fixture
- **THEN** the resulting observable state matches the repository's documented
  transactional/idempotency semantics instead of a silent partial upgrade

### Requirement: Recovery boundaries fail atomically

Backup completeness checkpoint/restore, portable export/import, account
ownership binding, and sync outbox interactions MUST treat malformed or
interrupted input as hostile: each representative failure MUST leave
authoritative local state either unchanged or coherently committed per the
documented contract, MUST NOT leave half-imported rows or misleading success
markers, and MUST support safe retry.

#### Scenario: Corrupted recovery input changes nothing

- **WHEN** any representative corrupted/mismatched/unsupported recovery input
  is presented (manifest/checksum mismatch, missing sections, duplicate IDs,
  invalid fields, tombstones, owner mismatch, partial settings, future
  versions)
- **THEN** validation fails with the documented status and the authoritative
  database state is unchanged

#### Scenario: Interrupted import retries safely

- **WHEN** an import/recovery operation is interrupted via an injected test
  seam and then retried
- **THEN** no partial rows persist from the failed attempt and the retry
  produces the same coherent result as a clean attempt

### Requirement: Cross-feature time and lifecycle transitions agree

Local-calendar day rollover, foreground-after-day-change, timezone matrix
boundaries, lifecycle-masked habit dates, planning references to later-deleted
rows, timestamp-boundary session/aggregation edges, reminder/linked-action
replay after reload, and stale-async refresh races MUST preserve established
semantics when features are combined. Newly discovered cross-feature
invariants MUST gain regression proof at the narrowest stable layer.

#### Scenario: Day rollover during combined use stays correct

- **WHEN** the app crosses local midnight while mounted across multiple
  sections with seeded history
- **THEN** every day-scoped surface reflects the new local day without stale
  reads, duplicate writes, or yesterday's data presented as today's

#### Scenario: Stale async results never overwrite newer state

- **WHEN** rapid overlapping refreshes, section switches, or reloads race
  pending async reads
- **THEN** only the newest request's results are applied to mounted state

### Requirement: Native endurance evidence is honest and sequential

When the supported Android environment is available, provisioning, smoke,
persistence, lifecycle, and repeated kill/relaunch endurance lanes MUST run
sequentially against verified current-source provenance with preserved
reports; unavailable platform capabilities MUST be classified `ENVIRONMENT`
or registered capability gaps rather than claimed as passing.

#### Scenario: Sequential native qualification records real evidence

- **WHEN** the campaign requires native proof and the API-36 x86_64 target is
  provided
- **THEN** each native lane runs one at a time with JSON/Maestro reports,
  provenance metadata, and exact replay commands retained

### Requirement: System audit findings are classified and resolved

The whole-codebase audit MUST record severity/root-cause classifications for
material findings in the campaign ExecPlan. Critical/High durability,
migration, corruption, ownership, data-loss, lifecycle, or long-session
defects MUST be fixed with regression proof before completion; unrelated
Medium/Low debt MAY be recorded without expanding scope.

#### Scenario: Audit ledger reflects final reality

- **WHEN** the campaign reaches completion review
- **THEN** every material finding has a severity, root cause, resolution (or
  explicit deferral rationale), and the regression tests proving it
