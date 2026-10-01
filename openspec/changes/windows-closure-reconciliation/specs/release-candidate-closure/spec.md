## MODIFIED Requirements

### Requirement: Fresh exact-HEAD baseline supersedes historical evidence

Release-candidate certification SHALL be grounded in the inspected current tree and exact pushed candidate, not in unchecked historical completion claims. Existing gate evidence SHALL retain its original command, runtime, source SHA, scope, result, and artifacts. Prior full-QA evidence SHALL remain applicable only when the result is corroborated and the current tree has no relevant source, configuration, fixture, test, dependency, or runner change invalidating its scope. A meaningful affected change or an uncorroborated required result MUST trigger sufficient fresh validation. Historical source-applicable evidence MUST be labeled reused, not executed at the final tip; final exact-head CI and current-source native evidence remain separately required.

#### Scenario: Committed evidence conflicts with current tree

- **WHEN** committed logs or completion claims conflict with the current tree or new gate execution
- **THEN** authoritative current evidence decides certification and the discrepancy is investigated/classified rather than ignored

#### Scenario: A required gate cannot run

- **WHEN** a gate requires unavailable infrastructure or credentials
- **THEN** certification records NOT RUN and the exact missing dependency without reporting an environment-gated result as passing

#### Scenario: Full QA passed after an earlier deferral

- **WHEN** a corroborated full run passed on an ancestor and affected-source inspection establishes continued applicability
- **THEN** the report preserves the earlier deferral followed by the later pass, names the run's actual source/runtime, and does not rerun solely for ceremony

#### Scenario: A later repair changes the validated boundary

- **WHEN** a repair changes code, configuration, tests or shared runner behavior covered by prior QA
- **THEN** affected validation is refreshed and the old run does not certify the changed behavior

### Requirement: Certification is bound to the exact pushed SHA

The release-candidate declaration SHALL name the final pushed commit SHA and require GitHub `quality` and `e2e` success on that exact SHA. Any later repository commit, including documentation or ledger bookkeeping, MUST require a new exact-tip CI result before a final certification declaration. Cancelled runs, failed required jobs, and expected skipped jobs MUST be recorded accurately; nightly skipped on push MUST NOT be treated as nightly PASS or failure. Final post-CI SHA/run attestation MUST be publishable without an additional repository commit that invalidates the attested tip.

#### Scenario: Post-green edit occurs

- **WHEN** any further repository mutation lands after CI was observed green on a SHA
- **THEN** certification moves to the newer SHA and CI is verified again there

#### Scenario: A report follow-up is committed

- **WHEN** recording closure evidence creates a new documentation-only tip
- **THEN** final exact-head CI is obtained for that tip rather than reusing its parent's green run

#### Scenario: The final CI run completes

- **WHEN** required jobs finish successfully on the actual final pushed tip
- **THEN** the final publication binds that SHA, run ID, job results and expected skips without requiring another repository bookkeeping commit

## ADDED Requirements

### Requirement: Windows J8 closure preserves failure and resolution chronology

Windows closure SHALL preserve the historical 878 ms result against the unchanged 800 ms ceiling as a failed sample with its evidenced classification, and SHALL separately report accepted post-correction 622/800 ms evidence and its source/applicability. Historical failure MUST NOT be erased or relabeled PASS. The measurement-start defect and its correction SHALL be distinguished from remaining host-load excursions. The current conditional remediation task SHALL be `NOT_TRIGGERED` when accepted applicable evidence establishes no current credible regression; contradictory active task/spec/report language MUST be reconciled. The 800 ms ceiling, 15% headroom floor, fixtures, meaningful assertions, and 500 ms diary budget MUST NOT be relaxed.

#### Scenario: Only the historical excursion exceeds the ceiling

- **WHEN** the record preserves 878 ms and accepted applicable post-correction evidence is 622/800 ms with no credible new regression
- **THEN** historical failure stays visible while the conditional product-remediation task is explicitly `NOT_TRIGGERED`, not a live optimization defect

#### Scenario: New credible evidence exceeds the ceiling

- **WHEN** controlled current-source measurement establishes a reproducible app-owned regression above 800 ms
- **THEN** the task is triggered, the app-owned cause is fixed and qualified without raising the ceiling, changing fixtures or weakening assertions

#### Scenario: Evidence is not sufficient to close the current posture

- **WHEN** source applicability or measurement credibility cannot be established
- **THEN** the report records that uncertainty and obtains the missing evidence rather than inferring closure from a historical number
