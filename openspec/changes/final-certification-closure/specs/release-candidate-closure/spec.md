## ADDED Requirements

### Requirement: The preserved J8 miss is not closed by moving the ceiling

The preserved section-switch measurement of 878 ms against the 800 ms ceiling MUST stay recorded as a failed sample. It MUST NOT be rewritten as a pass, MUST NOT be erased by a rerun taken under inadequate free memory, and MUST NOT be closed by raising the 800 ms ceiling — including by treating an older headroom allowance as permission to move this threshold — or by terminating unrelated user processes to manufacture a pass.

The historical sample MAY be closed **as a product gate** when the register records a root-cause fix for the app-owned/measurement contribution together with post-fix credible evidence at or below the ceiling while every ceiling, floor, fixture, and assertion is unchanged. The recorded 2026-09-24 fix (`waitForSectionTransitionsSettled` before the measured round) with post-fix `maxSwitch=622/800`, persona 7/7, per-switch `619/407/395/500/622/457`, `diarySearch=396/500` and `pickerSearch=186/500` is that accepted evidence, and it classifies the 878 ms sample as an `ENVIRONMENT` host-load excursion. Closing the product gate this way MUST NOT reclassify the 878 ms number itself, and it MUST NOT be presented as a waiver of a live regression.

If a credible rerun still exceeds 800 ms, the campaign MUST treat that as a product performance defect, fix the app-owned contribution, and rerun without changing the ceiling. A previously deferred full quality gate MUST NOT be recorded as `PASS` merely because narrower tests passed; it becomes `PASS` only when the gate itself runs green on credible resources with its runtime and counts recorded.

#### Scenario: Memory is too low for a meaningful timing run

- **WHEN** host resources are not credible for the HEAVY section-switch measurement
- **THEN** the 878 ms sample stays recorded as a failure and is never recorded as a pass
- **AND** the 800 ms ceiling is unchanged
- **AND** the register's recorded root-cause fix plus post-fix evidence may still close the product gate independently of that host

#### Scenario: The recorded root-cause fix closes the product gate

- **WHEN** the register carries a root-cause fix with post-fix credible evidence at or below the 800 ms ceiling
- **THEN** the product gate is CLOSED while the 878 ms sample remains preserved as an `ENVIRONMENT` excursion
- **AND** `CG-4`/`CG-5`/gap 15 stay CLOSED with every ceiling, floor, fixture, and assertion unchanged

#### Scenario: A credible rerun still misses

- **WHEN** a resource-credible rerun measures above 800 ms
- **THEN** the miss is a product performance defect to fix
- **AND** the ceiling stays 800 ms

#### Scenario: A full gate was deferred

- **WHEN** `qa:full` was skipped because memory was inadequate and only narrower gates later pass
- **THEN** the deferred full gate is not reported as `PASS` until the full gate itself runs green on credible resources
