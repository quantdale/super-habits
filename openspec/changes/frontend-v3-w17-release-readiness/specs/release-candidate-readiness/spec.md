## Purpose

Defines the Frontend V3 W17 release-candidate contract: what provenance an RC
claim requires, what the verification ladder must execute and report, how the
security gate and residuals are classified, and what a truthful verdict and
handoff contain. W17 changes no behavioural contract; it verifies the
integrated state and repairs reproduced cross-wave defects.

## ADDED Requirements

### Requirement: An RC claim names its exact source and artifacts

A release-candidate statement SHALL name the exact source revision, the tree
state, and the identity of every artifact it relies on, and SHALL NOT describe
a result from a different revision as applying to the candidate.

#### Scenario: The RC manifest is source-specific

- **WHEN** the candidate manifest is written
- **THEN** it records the source SHA, tree-clean state, build commands, artifact hashes and environment
- **AND** every lane result in the verification matrix cites that same revision

### Requirement: Every verification lane reports its own real result

The verification matrix SHALL report each lane's executed count, pass, fail,
skip and blocked/not-run values from the lane's own output, and SHALL NOT
present a blended "all green" summary that hides a skip or a failure.

#### Scenario: A skipped lane is visible

- **GIVEN** a lane that did not run (no device, no credentials, or an upstream gate failure)
- **THEN** it is recorded as skipped, blocked or not-run with the reason
- **AND** it is not counted as a pass

#### Scenario: Counts come from the run

- **WHEN** a lane's result is recorded
- **THEN** the numbers match that lane's own report
- **AND** the same tests are not counted twice as separate coverage

### Requirement: The security gate is re-read at current head and never waived

The dependency security audit SHALL be evaluated against the current lock graph
at the candidate revision, with each finding's package chain, advisory,
reachability and safe-fix availability recorded, and SHALL NOT be resolved by
loosening thresholds, adding waivers, or mislabeling a failure as success.

#### Scenario: An unremediated advisory stays red

- **GIVEN** an inherited advisory with no safe bounded fix
- **THEN** the audit remains failing
- **AND** the record states why it cannot be fixed in this session, its impact and its owner
- **AND** no allowlist or threshold change is made

### Requirement: Cross-wave defects are reproduced before repair

A defect attributed to the integrated waves SHALL be reproduced on the current
integrated source, its cause assigned to an owning module, and its fix SHALL
carry an executable regression or a rendered re-check.

#### Scenario: A fixed defect is verified

- **GIVEN** a reproduced cross-wave defect
- **WHEN** it is marked fixed
- **THEN** a regression test or an inspected post-fix capture exists
- **AND** the affected and adjacent surfaces are re-run

### Requirement: The verdict is one of the defined honest outcomes

The final assessment SHALL be exactly one of release-candidate ready
(web/PWA only), conditional/near-complete, partial-blocked, or not ready, with
the justification naming the lanes that support and the lanes that limit it.

#### Scenario: Limitations are explicit

- **WHEN** a native, security or external lane is unresolved
- **THEN** the verdict names it as a limit
- **AND** a web/PWA-only claim is not presented as whole-application certification

### Requirement: The handoff is bounded, prioritized and executable

The handoff SHALL give the next session a prioritized, bounded repair list with,
for each item, the reproduction, the expected treatment, the acceptance test and
the exact command, and SHALL identify one imperative first action.

#### Scenario: A zero-context agent can start immediately

- **WHEN** the handoff is read without prior context
- **THEN** the highest-risk outstanding item names a file path and a runnable oracle
- **AND** no item requires re-auditing the whole application or redoing a completed wave
