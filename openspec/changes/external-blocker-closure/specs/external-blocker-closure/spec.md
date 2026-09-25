## Purpose

Defines how the external-blocker closure campaign records evidence, preserves the completed live-cloud result, and ends in one honest terminal state.

## ADDED Requirements

### Requirement: Closure evidence and terminal state are honest

The closure campaign MUST record, for each of the seven workstreams (production incident residue, disposable Supabase certification, AI Command Center readiness, iOS/EAS runtime, store-release preparation, deferred architecture, and adversarial certification), the starting evidence, current state, work performed, tests executed, exact results, remaining blockers, and unblock procedure. A missing credential, paid service, legal decision, or owner authorization MUST NOT be reported as `PASS`. The campaign MUST preserve commit `23ded6e7676f94d6ddf9337ad02d526d85973fcb`, the completed live-cloud ExecPlan, and stash `pre-recovery-local-changes` without modification. It MUST create a new Plan-Version 2 ExecPlan. Integration gates MUST use Node 22.23.2. Host Node 24 MUST NOT run those gates. After executable work, the campaign MUST perform an adversarial review and MUST end only in `COMPLETE`, `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED`, `BLOCKED`, or `NOT CERTIFIED`. The final report MUST name the starting SHA and the final SHA separately, and MUST give every remaining blocker as `WHY`, `CLASSIFICATION`, `WHAT IS REQUIRED`, and `EXACT RESUME ACTION`. The report MUST NOT claim a production cleanup, paid EAS run, provider deployment, or store submission without direct evidence that it occurred.

#### Scenario: Missing provider secret

- **WHEN** authenticated AI evaluation cannot run because the provider secret is absent
- **THEN** that workstream is not `PASS`
- **AND** the terminal report lists why, the classification, what is required, and the exact resume action

#### Scenario: Historical result stays intact

- **WHEN** the successor campaign starts
- **THEN** `23ded6e7676f94d6ddf9337ad02d526d85973fcb` and its completed ExecPlan remain historically completed
- **AND** stash `pre-recovery-local-changes` is unchanged

#### Scenario: Host Node is 24

- **WHEN** an integration gate runs for this campaign
- **THEN** the process Node version is 22.23.2

#### Scenario: A release gate stays failed

- **WHEN** a substantive release gate fails and stays unresolved
- **THEN** the terminal state is `NOT CERTIFIED`

#### Scenario: Only external actions remain

- **WHEN** every authorized local task is done and owner approval, credentials, or a paid plan is still required
- **THEN** the terminal state is `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED`

#### Scenario: Adversarial finding is executable

- **WHEN** adversarial review finds a safely executable defect
- **THEN** the campaign fixes it with regression coverage and reviews again
- **AND** the finding is not left only as a future recommendation
