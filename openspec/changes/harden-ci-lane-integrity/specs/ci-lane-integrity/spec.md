## Purpose

Makes the CI gate honest: every guard that protects a lane CI does not run is executed by the job that gates merges, a lane that cannot run says so instead of passing by omission, and reduced coverage is always registered in a register that can detect its own rot.

## ADDED Requirements

### Requirement: The pull-request gate executes every lane-protection guard

The CI `quality` job SHALL execute every guard script that the repository's fast gate runs, including the journey-label parity guard and the quarantine-register parity guard. A guard that protects a lane the `quality` job does not itself execute SHALL still run in that job.

#### Scenario: A label rename breaks a nightly-only lane

- **WHEN** a navigation label changes so a journey step title no longer matches the tab rail
- **THEN** the journey-label parity guard fails in the `quality` job and the pull request is red

#### Scenario: A new quarantine is unregistered

- **WHEN** a journey adds a `test.fixme` gate without a register entry
- **THEN** the quarantine-register parity guard fails in the `quality` job

### Requirement: A lane that cannot run reports that it cannot run

A CI step that requires a credential SHALL evaluate its run condition against the `secrets` context and SHALL map the credential into the step environment before the step body uses it. A lane whose credential is absent SHALL either be skipped with a visible "not configured" outcome or fail loudly; it SHALL NOT be skipped silently while its documentation claims a guarded run occurred.

#### Scenario: The credential is configured

- **WHEN** the required access token is present as a repository secret
- **THEN** the lane step runs and the token reaches the process that needs it

#### Scenario: The credential is absent

- **WHEN** the required access token is absent
- **THEN** the lane is visibly reported as not configured, and the job outcome is not a pass for that lane

### Requirement: A non-gating step cannot fail a gating job

Every step in a job whose documentation declares it report-only SHALL carry `continue-on-error: true`, and every step that hard-fails a gating job SHALL belong to a lane that the lane table declares gating. A lane the lane table declares `gates: false` SHALL NOT be executed as a hard step inside a gating job.

#### Scenario: A report-only step fails

- **WHEN** a step in the report-only nightly job fails
- **THEN** the gating jobs are unaffected and the failure is still reported

#### Scenario: A non-gating lane is wired into a gating job

- **WHEN** the lane table declares a lane `gates: false` but a workflow runs it as a hard step in a gating job
- **THEN** the drift is a defect and the step is moved or marked non-gating

### Requirement: Advisory checks do not read as gates

A dependency-audit step that documents a severity policy of "must be zero" SHALL NOT declare `continue-on-error: true` for that severity. If the step is intentionally advisory for that severity, its name, comment, and the surrounding job documentation SHALL say so.

#### Scenario: A new high-severity advisory appears

- **WHEN** the production dependency audit reports a new high or critical advisory
- **THEN** the outcome matches the documented policy rather than being absorbed silently

### Requirement: Repeated workflow runs are cancelled, not left to race

Every workflow that can be triggered more than once for the same ref by different events SHALL declare a concurrency group with `cancel-in-progress: true`, matching the repository's existing per-ref concurrency pattern.

#### Scenario: Two triggers fire on one ref

- **WHEN** a label event and a synchronize event both satisfy a workflow's trigger within minutes
- **THEN** the later run cancels the earlier one instead of both consuming a long macOS job

### Requirement: A retry is evidence to inspect, not a pass

When the test runner is configured with retries, a test that fails its first attempt and passes a retry SHALL be reported distinctly from a test that passes on its first attempt. A timing-ceiling or row-oracle assertion that only passes on a retry SHALL NOT be recorded as a clean pass for that run.

#### Scenario: A strict assertion fails then passes on retry

- **WHEN** a performance-ceiling or row-oracle assertion fails its first attempt and passes a retry
- **THEN** the run reports the retried test as retried, and the lane is not recorded as a clean pass

### Requirement: Browser date and locale context is pinned

The Playwright browser context SHALL pin its timezone and locale, so that date-key assertions and weekday-conditional skips are evaluated against a declared calendar rather than the host operating system's.

#### Scenario: The host timezone differs from the declared one

- **WHEN** the suite runs on a host whose OS timezone differs from the declared timezone
- **THEN** date-key assertions and weekday-conditional skips still evaluate against the declared timezone

### Requirement: Every skipped test is registered with a reason and a lane

Every skip or quarantine mechanism in the repository — Playwright `test.fixme`, Playwright `test.skip`, and Vitest `describe.skipIf` / `it.skipIf` / `it.fails` — SHALL be discoverable by the register check. A gate stem counts as registered only when the register carries a structured entry naming the gate site and its reason. The check SHALL also fail when a register entry names a file that contains no gate.

#### Scenario: A Vitest skip is unregistered

- **WHEN** an integration file carries `describe.skipIf` with no register entry
- **THEN** the register parity guard fails

#### Scenario: A register entry names a removed gate

- **WHEN** a register entry names a spec file that no longer contains a gate call
- **THEN** the reverse register check fails

#### Scenario: A gate stem is only incidentally mentioned

- **WHEN** a gate's file stem appears in the register only inside an unrelated caveat sentence
- **THEN** the gate is reported as unregistered

### Requirement: The per-step quarantine mechanism is real or absent

The journey runner's per-step quarantine field SHALL either be used by at least one journey, or be removed together with its branch. A documented quarantine protocol that no gate implements SHALL NOT remain in the code.

#### Scenario: The field is unused

- **WHEN** no journey declares a per-step quarantine
- **THEN** the field and its runner branch are removed rather than documented as available
