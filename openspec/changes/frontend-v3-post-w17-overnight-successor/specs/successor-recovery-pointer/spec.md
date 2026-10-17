## Purpose

Defines how a zero-context agent is directed after the post-W17 correction is complete.

## ADDED Requirements

### Requirement: Recovery does not resume a completed correction

Present-tense recovery instructions in the Calm Momentum ExecPlan SHALL NOT tell an agent to implement further work from `frontend-v3-post-w17-correction` after that plan's Status is COMPLETED and its Exact next action is None. While a successor plan is ACTIVE, recovery SHALL name that plan as the living next action.

#### Scenario: A new agent reads the parent plan

- **WHEN** the post-W17 correction plan is COMPLETED and the overnight successor plan is ACTIVE
- **THEN** the parent recovery text points at the successor plan
- **AND** it does not instruct the agent to continue the completed correction's implementation
