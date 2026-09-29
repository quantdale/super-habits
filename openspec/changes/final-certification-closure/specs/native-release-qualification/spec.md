## ADDED Requirements

### Requirement: Current-source iOS and Android certification follows the latest failed evidence

The iOS result of 10 passing flows out of 13 on source `e9b42a3f31984f86dd50e0b337300df74898f422` MUST NOT be reported as iOS certification. Before any product or flow edit, the campaign MUST classify `native-smoke`, `workout-gym-v2-persistence`, and `workout-gym-v2-session-lifecycle` from the captured hierarchy, screenshots, and logs as a product defect, test defect, harness defect, timing flake, or platform difference. Product copy MUST NOT be changed merely to satisfy a brittle selector. A keyboard-dismissal failure MUST NOT remove the assertion that the entered measurement survives the intended lifecycle boundary.

A later iOS certification MUST name an exact source SHA whose Release build, executable hash, install, launch, and all 13 flows pass, with artifacts preserved. Twelve of 13 passing flows MUST NOT be called certified. Android certification MUST use a build produced from the source under test. The historical Android binary for `56259876418674f85e1ca42c87f248fcf12c7d75` MUST NOT certify later source. When no Android device or emulator can run, the lane MUST remain `ENVIRONMENT` and MUST NOT be inferred from iOS.

#### Scenario: Ten of thirteen iOS flows pass

- **WHEN** an exact-SHA iOS run finishes with three flows failed
- **THEN** iOS runtime is not certified

#### Scenario: A flow is edited before classification

- **WHEN** a failing iOS flow has no classification from its captured evidence
- **THEN** the product and the flow are not edited yet

#### Scenario: Keyboard dismissal is the only new failure

- **WHEN** a Gym V2 lifecycle flow reaches the entered weight and then fails while dismissing the keyboard
- **THEN** dismissal uses a platform-safe action instead of the failing keyboard command
- **AND** the test still proves the value survives the lifecycle boundary

#### Scenario: An older Android APK is available

- **WHEN** the only Android binary was built from an ancestor that is not the source under test
- **THEN** that binary is not current-source Android certification

#### Scenario: No Android target can start

- **WHEN** the canonical emulator cannot be started safely
- **THEN** Android is recorded as `ENVIRONMENT` with the missing target named
- **AND** iOS evidence is not substituted for it
