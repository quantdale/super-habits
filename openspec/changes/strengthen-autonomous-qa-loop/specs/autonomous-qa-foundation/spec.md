## Purpose

This capability gives coding agents a repeatable path from changed files to focused validation and from a browser failure to actionable, reproducible evidence and an explicit triage decision.

## ADDED Requirements

### Requirement: Unexpected browser failures preserve actionable evidence

The E2E system SHALL preserve, on an unexpected test failure, the test identity, Playwright project, retry, browser context metadata, timezone, viewport, console errors and warnings, page errors, failed or non-success network responses, and references to the screenshot and trace artifacts. Captured diagnostics SHALL exclude credentials, request bodies, and environment secrets.

#### Scenario: A feature E2E test fails

- **WHEN** a test fails unexpectedly after the page has emitted a console error and a failed network request
- **THEN** the test result contains a focused diagnostics artifact with the test/project metadata and both failures, while Playwright retains the screenshot and trace for the failed attempt

#### Scenario: A known skipped gap is encountered

- **WHEN** a test is intentionally skipped or quarantined with a documented known-gap annotation
- **THEN** the diagnostics layer does not classify the skip as a new product failure or hide the existing gap registration

### Requirement: Failure triage uses an explicit classification contract

The QA tooling SHALL represent failure triage with exactly one of `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`, `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY`, together with a rationale and evidence references. An untriaged failure SHALL remain visibly untriaged and SHALL NOT be labeled flaky merely because it passed on a retry.

#### Scenario: A seeded simulation fails

- **WHEN** a seeded scenario fails and its report includes a seed, persona, scenario, action log, and replay command
- **THEN** the failure can be assigned one classification without losing the original reproduction evidence or seed

#### Scenario: A failure is caused by an intentional quarantine

- **WHEN** the failure matches a registered known gap
- **THEN** the report and digest identify `EXPECTED_KNOWN_GAP` and link the companion change or known-gap entry

### Requirement: Agents can select validation from changed files

The repository SHALL provide a machine-readable impact map that maps changed-file patterns to required validation gates, feature tests, journey tags or scenarios, and broader-regression triggers. A command SHALL accept a diff base or explicit changed files and print the resolved impact plan without modifying the worktree.

#### Scenario: A habits data-layer change is inspected

- **WHEN** the impact command receives a changed path under `features/habits/`
- **THEN** it includes habit unit and integration checks, habits E2E, relevant Overview/linked-action journeys, and the broader regression trigger for shared data-layer changes

#### Scenario: A time helper changes

- **WHEN** the impact command receives `lib/time.ts`
- **THEN** it includes all date-sensitive checks, rollover journeys, the timezone matrix, and full regression

### Requirement: QA gates are memorable and escalation-based

The repository SHALL expose concise commands for static/fast validation, integration validation, focused journeys, deterministic simulation, timezone validation, impact inspection, and full regression. Gating modes SHALL remain deterministic; seeded and exploratory modes SHALL remain report-only or explicitly opt-in.

#### Scenario: An agent makes a small domain change

- **WHEN** the agent runs the fast gate and then the affected impact plan
- **THEN** it receives the static checks and relevant unit tests before being directed to higher-cost browser lanes

#### Scenario: A shared E2E or simulation infrastructure change is made

- **WHEN** the impact plan marks broad regression as required
- **THEN** the documented workflow directs the agent to run deterministic journeys and the full regression before completion

### Requirement: Date-sensitive validation covers representative local timezones

The repository SHALL provide a deterministic command that runs the date-key unit and real-SQLite integration coverage under at least `Asia/Manila`, `UTC`, `America/New_York`, `Pacific/Honolulu`, and `Pacific/Kiritimati`, reporting the zone associated with every result. The command SHALL not alter application expectations to accommodate a failing timezone.

#### Scenario: Date-key behavior is checked across zones

- **WHEN** the timezone matrix command runs
- **THEN** each required zone executes the targeted tests sequentially and a failure identifies the exact zone and test command

### Requirement: Fixed waits are either observable or justified

Deterministic E2E helpers SHALL prefer Playwright assertions, polling, app readiness markers, persisted-row conditions, or network/state transitions over arbitrary sleeps. Any remaining elapsed-time wait SHALL be scoped to a real timing, animation, lock, backoff, or pacing contract and SHALL state that reason next to the wait.

#### Scenario: The database harness hands control back to the app

- **WHEN** an E2E helper waits for SQLite bootstrap
- **THEN** it waits for the app readiness marker and not for a fixed number of milliseconds

#### Scenario: A sync backoff is tested

- **WHEN** a journey verifies that a 30-second retry interval does not fire early
- **THEN** the elapsed wait remains explicit and documented as modeling the interval contract rather than being treated as generic synchronization
