## Purpose

Defines the evidence rules for the post-W17 correction so current release statements stay tied to the revision that was actually tested.

## ADDED Requirements

### Requirement: Current statements name the tested revision

A current-status correction or release statement SHALL name the Git revision it describes. A test, screenshot, native install, or CI result SHALL NOT be described as evidence for a different revision.

#### Scenario: An earlier run stays on its own revision

- **WHEN** a document records a lane that ran at an earlier revision
- **THEN** that result remains attributed to the revision that produced it
- **AND** a later current-status summary does not reuse it as a pass for the later revision

### Requirement: Unearned platform and security claims stay unearned

The correction SHALL NOT mark iOS certified without an exact-source iOS run. It SHALL NOT mark Android certified for a revision whose user-facing feature source differs from the installed build's source revision. It SHALL NOT mark the dependency audit passed, waived, or allowlisted while the audit command still reports an undocumented high or critical finding.

#### Scenario: Security gate stays red

- **WHEN** the dependency audit still reports an undocumented high finding and no upstream or dependency-graph fix has removed it
- **THEN** the audit result is recorded as failed
- **AND** hosted lanes skipped because of that failure are recorded as skipped or not run, not passed

#### Scenario: Android evidence does not leap a feature edit

- **WHEN** the last Android qualification built an earlier revision and a later revision changed user-facing feature source
- **THEN** the later revision is not described as Android-certified unless a new exact-source qualification ran

### Requirement: Recovery does not restart finished waves

The parent Frontend V3 plan's current next action SHALL NOT tell an agent to author or start W12–W17 while those waves are already published. The parent plan SHALL remain active while hosted security, iOS, or exact-source Android certification required by its definition of done is still unearned.

#### Scenario: A new agent does not reopen W12

- **WHEN** an agent resumes the parent Frontend V3 plan after this correction
- **THEN** the current next action is a real remaining correction or certification action
- **AND** it does not instruct the agent to begin the already published W12 wave

### Requirement: The correction verdict matches the evidence taxonomy

The correction's final assessment SHALL be exactly one of release-ready, conditional/near-complete, partial-blocked, or not closed. It SHALL NOT use release-ready while a required security, iOS, or exact-source Android gate remains failed, skipped, or not run.

#### Scenario: Conditional is allowed

- **WHEN** in-scope reproduced defects are fixed or disproven and the dependency audit or iOS lane remains externally unresolved
- **THEN** the verdict is conditional/near-complete or partial-blocked
- **AND** it names each unresolved lane and its revision limit
