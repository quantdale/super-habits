## ADDED Requirements

### Requirement: The preserved J8 miss is not closed by moving the ceiling

The preserved section-switch measurement of 878 ms against the 800 ms ceiling MUST remain a failed result until a resource-credible rerun measures at or below 800 ms, or an app-owned defect is fixed and a later credible rerun passes. A rerun under inadequate free memory MUST NOT be recorded as a pass and MUST NOT erase the preserved failure. The campaign MUST NOT raise the 800 ms ceiling, including by treating an older headroom allowance as permission to move this threshold, and MUST NOT terminate unrelated user processes to manufacture a pass. If a credible-resource rerun still exceeds 800 ms, the campaign MUST treat that as a product performance defect, fix the app-owned contribution, and rerun without changing the ceiling. A previously deferred full quality gate MUST NOT be recorded as `PASS` merely because narrower tests passed.

#### Scenario: Memory is too low for a meaningful timing run

- **WHEN** host resources are not credible for the HEAVY section-switch measurement
- **THEN** the 878 ms failure stays unresolved
- **AND** the 800 ms ceiling is unchanged

#### Scenario: A credible rerun still misses

- **WHEN** a resource-credible rerun measures above 800 ms
- **THEN** the miss is a product performance defect to fix
- **AND** the ceiling stays 800 ms

#### Scenario: A full gate was deferred

- **WHEN** `qa:full` was skipped because memory was inadequate and only narrower gates later pass
- **THEN** the deferred full gate is not reported as `PASS`
