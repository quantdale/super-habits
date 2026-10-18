## Purpose

Ensure automated validation and application delivery prove their declared behavior through real execution paths, isolated environments and revision-specific evidence without converting unavailable checks into successful qualification.

## ADDED Requirements

### Requirement: Exported shell content determines update identity

A changed boot-critical exported shell MUST produce a changed service-worker/cache revision through every supported export path. Identical content MUST produce a deterministic revision. Existing installed clients MUST be able to discover, explicitly apply and boot the new shell offline without losing local user data.

#### Scenario: Previously installed client receives a new shell

- **WHEN** build A is installed and the same origin serves a different real build B
- **THEN** the client MUST discover and apply B through the established update flow
- **AND** B MUST boot from its complete cached shell when the network is unavailable

### Requirement: Oracle expectations are mandatory executable assertions

Every declared correctness expectation MUST affect the scenario's result. Failed state inspection MUST fail the relevant oracle/step. Diagnostic reads without an expectation MUST NOT be presented as proof of enqueue, retention or other asserted state.

#### Scenario: Expected pending work is absent

- **WHEN** an attached or standalone oracle expects pending work but the result is empty
- **THEN** the scenario MUST fail with the violated expectation

#### Scenario: Oracle query fails

- **WHEN** a required correctness oracle cannot inspect state
- **THEN** the scenario MUST fail rather than report successful validation

### Requirement: Simulation API mutations use production behavior

Simulation API legs MUST invoke the production data-layer mutation behavior, preserving its validation, IDs, local dates, backup intents and relevant side effects. Handwritten mutation SQL MUST be confined to explicitly labeled fixture setup or fault injection. Any test invocation bridge MUST reject arbitrary operations and MUST NOT be callable in ordinary/release builds.

#### Scenario: Headless Todo creation matches the application

- **WHEN** a simulation API leg creates a Todo without notes
- **THEN** its canonical row, null notes and applicable backup intent MUST match production creation semantics

#### Scenario: Ordinary build is probed for test mutation access

- **WHEN** an ordinary or release build is loaded and test mutation access is attempted
- **THEN** no callable test mutation bridge MUST be available

### Requirement: Native test builds enforce backend isolation

Credential-free native test build paths MUST enforce isolation independently of inherited environment defaults or dotenv files. Unexpected live backend/remote-AI configuration MUST be refused or neutralized before test execution, without printing secrets. Android and iOS artifact provenance MUST identify the source/configuration actually tested.

#### Scenario: Hosted environment supplies live-looking variables

- **WHEN** a native test build inherits backend variables from a hosted or ambient environment
- **THEN** the credential-free test path MUST prevent those values from enabling live service contact
- **AND** a failed isolation check MUST block test execution

### Requirement: Security gates retain their policy meaning

Unresolved required dependency advisories MUST retain a failing release disposition unless resolved through supported remediation or a separately authorized policy decision. This campaign MUST NOT weaken thresholds, broaden allowlists, skip scanning or infer downstream success from skipped jobs.

#### Scenario: No compatible advisory remediation exists

- **WHEN** a required advisory remains unresolved on the supported dependency graph
- **THEN** the blocker and exact unblock condition MUST remain explicit
- **AND** unrelated engineering work MUST be distinguishable from release qualification

### Requirement: Finding closure has revision-specific adversarial evidence

Every audit finding MUST receive a disposition supported by its actual source revision, regression assertions, commands/results and residual limitations. An inherited fix MUST identify its provenance. Missing external/native/backend evidence MUST NOT be labeled passed. An independent review MUST remain separate from implementation self-checks.

#### Scenario: Source changes after a prior successful test run

- **WHEN** a candidate changes behavior affected by earlier evidence
- **THEN** its closure claim MUST cite new applicable validation or explicitly retain the qualification gap

#### Scenario: Required native or backend infrastructure is unavailable

- **WHEN** a required qualification cannot run on the candidate source
- **THEN** the result MUST remain an explicit external/environment blocker with a resumable next action
- **AND** the final packet MUST NOT claim complete qualification or independent review acceptance
