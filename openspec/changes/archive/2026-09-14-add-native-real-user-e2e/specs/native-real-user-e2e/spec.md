## ADDED Requirements

### Requirement: Native smoke and critical-flow workspace

The repository SHALL provide a committed Maestro workspace containing independently runnable native flows for primary navigation, representative persistence, settings persistence, Pomodoro lifecycle, and the native notification path. Flows MUST use semantic user-facing selectors and MUST NOT depend on arbitrary sleeps, coordinate taps, or execution order shared with another flow.

#### Scenario: Native smoke proves the app is usable

- **WHEN** the smoke flow starts a clean native app
- **THEN** Overview is usable, all six sections can be reached by their visible labels, Settings opens and closes, and the flow reports a meaningful failure if any control is unavailable.

#### Scenario: Native persistence survives relaunch

- **WHEN** a persistence flow creates representative todo, habit, calorie, workout, or setting data and terminates and relaunches the app
- **THEN** the data is still visible through the user-facing screen, proving native SQLite/AsyncStorage persistence rather than only an in-memory success message.

### Requirement: Native lifecycle and Pomodoro coverage

The native suite SHALL distinguish background/foreground from termination/relaunch and SHALL exercise the documented Pomodoro behavior across a lifecycle transition without waiting for a production-length timer. It MUST NOT invent or require resume-after-process-death behavior that the product does not document.

#### Scenario: Running focus timer survives background and foreground

- **WHEN** a focus timer is started, the native app is backgrounded, and the app is foregrounded again
- **THEN** the running state and remaining-time surface remain coherent according to the implemented contract, and the flow can reset the timer without a second session.

#### Scenario: Settings survive native process restart

- **WHEN** a persistent setting is changed, the app is terminated, and the app is relaunched
- **THEN** the setting is visible with the saved value and the flow does not treat a clean launch as evidence of persistence.

### Requirement: Native notification-path evidence

The native suite SHALL exercise the actual native notification permission and timer-scheduling path where the platform permits it, and documentation SHALL distinguish scheduling evidence from notification-delivery evidence. A passing scheduling-path flow MUST NOT be reported as proof that a notification appeared in the system tray or notification center.

#### Scenario: Native timer enters notification scheduling path

- **WHEN** native notification permission is granted or handled and a focus timer is started
- **THEN** the app remains usable with the running timer and the native scheduling path executes without a web-only fallback, while any unavailable tray assertion is recorded as a capability gap.

### Requirement: Native prerequisite and failure reporting

Native QA commands SHALL check their prerequisites before running: Maestro, the requested platform's device/simulator tooling, a booted target, and an installed test build. A blocked run MUST return a non-success status, classify the blocker as `ENVIRONMENT`, and emit a focused report containing platform, target, flow/tag, app identifier, Git SHA when available, and a copyable replay command. A flow failure MUST preserve the command output and remain available for classification as `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`, `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY` after reproduction.

#### Scenario: Missing native tooling is actionable

- **WHEN** a developer runs a native QA command without Maestro, a booted target, or an installed build
- **THEN** the command identifies the missing prerequisite, reports `ENVIRONMENT`, gives the expected setup/replay command, and does not claim that the native suite passed.

#### Scenario: Native failure is reproducible

- **WHEN** a native flow fails after prerequisites pass
- **THEN** the output identifies the platform, flow, and replay command and preserves the native runner/flow artifacts needed for a later evidence-backed classification.

### Requirement: Native gate and impact integration

The autonomous QA documentation and machine-readable impact map SHALL identify native smoke and targeted native lifecycle gates, and SHALL state when native validation is mandatory: native UI/navigation changes require smoke, settings/native persistence changes require targeted persistence coverage, and Pomodoro/notification/lifecycle changes require the native lifecycle/notification lane on Android and iOS when available.

#### Scenario: Impact mapping selects native gates

- **WHEN** changed files include Pomodoro, notification, native lifecycle, EAS, or Maestro infrastructure paths
- **THEN** the impact command reports the corresponding native commands and does not reduce validation to web-only tests.

#### Scenario: Native platform absence is explicit

- **WHEN** iOS cannot run on the current host
- **THEN** the agent workflow reports iOS as `EXTERNAL BLOCKER` or `NOT RUN`, points to the EAS workflow path, and does not claim cross-platform native validation.
