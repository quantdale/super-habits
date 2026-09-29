## Purpose

Defines how the final certification successor records evidence, stays on main, and decides whether the predecessor campaign can be archived.

## ADDED Requirements

### Requirement: Successor certification does not restart or falsely close the predecessor

The successor MUST resume the residuals of `external-blocker-closure` from the current `main` tip and MUST NOT restart that change, uncheck or rewrite its completed tasks, or archive it merely because every task checkbox is checked. The successor MUST operate on `main` only. It MUST NOT force-push, rewrite history, or modify stash `pre-recovery-local-changes` or a historically completed campaign plan. A missing credential, owner authorization, paid service, or unavailable device MUST NOT be reported as `PASS`. When one lane reaches an owner or infrastructure gate, every independent executable lane MUST continue. Integration gates MUST use Node 22.23.2. Host Node 24 MUST NOT run those gates.

The predecessor MUST remain unarchived while production Scope-7 backup integrity is substantively red, current-source iOS still has an unresolved executable flow failure, or a reproducible product performance regression remains against an unchanged ceiling. Owner-only release paperwork, provider credentials, and store submission MUST stay external residuals and MUST NOT be used to claim a product gate passed. The successor MUST publish an evidence-backed closure report naming the final SHA, `origin/main`, tree state, CI run and job results, production schema and historical-manifest posture, incident-residue disposition, iOS source and executable identity, Android source and binary identity, J8 environment and measurement, OpenSpec and ExecPlan status, and the archive decision. Every residual MUST include `WHY`, `CLASSIFICATION`, `WHAT IS REQUIRED`, and `EXACT RESUME ACTION`. The only terminal labels are `COMPLETE`, `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED`, `BLOCKED`, and `NOT CERTIFIED`. A substantive unresolved product or recovery gate MUST keep the terminal state `NOT CERTIFIED`.

#### Scenario: Task checkboxes are already complete

- **WHEN** `external-blocker-closure` has every task checkbox checked and its report still says `NOT CERTIFIED`
- **THEN** the successor does not treat that checklist as release certification
- **AND** the predecessor stays unarchived until the archival predicate is met

#### Scenario: One lane needs owner approval

- **WHEN** production schema rollout lacks explicit owner approval
- **THEN** that write is recorded as owner-blocked
- **AND** iOS, J8, and Android work that does not need that approval continues

#### Scenario: Execution is attempted off main

- **WHEN** a later session would implement this change on a feature branch or rewrite `main`
- **THEN** that session stops and returns to `main` without force-push or history rewrite

#### Scenario: Docs-only CI is green

- **WHEN** GitHub CI succeeds on a documentation-only tip that does not contain a new iOS or production-schema result
- **THEN** that CI result is recorded exactly
- **AND** it is not reported as production, iOS, Android, or J8 certification

#### Scenario: Host Node is 24

- **WHEN** an integration gate runs for this successor
- **THEN** the process Node version is 22.23.2
