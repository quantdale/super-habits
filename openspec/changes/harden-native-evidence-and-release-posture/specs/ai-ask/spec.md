## Purpose

Adds the missing default-off obligation to the Ask capability so that hiding Ask and Auto behind a build-time flag is a specified requirement with executing coverage, rather than a property that happens to hold in the current source.

## ADDED Requirements

### Requirement: Ask and Auto are default-off

The Ask and Auto command modes SHALL be hidden in an ordinary build. They SHALL become reachable only when a build-time rollout flag is set, and no build SHALL enable that flag by default. Reachability SHALL be enforced at the render boundary so that a build without the flag cannot expose the mode selector, the Ask result view, or the Auto result view.

#### Scenario: An ordinary build is run

- **WHEN** the application is built without the rollout flag
- **THEN** the mode selector offers no Ask or Auto option and no Ask or Auto view can be rendered

#### Scenario: A rollout build is run

- **WHEN** the application is built with the rollout flag set
- **THEN** Ask and Auto become reachable through the same selector with no additional configuration

#### Scenario: The flag constant is preserved but the render boundary regresses

- **WHEN** a refactor keeps the flag constant false but renders the mode selector unconditionally
- **THEN** the executing coverage fails, because the assertion is on the rendered surface rather than only on the constant's value

### Requirement: No paid provider call is reachable without the rollout flag

A build without the rollout flag SHALL NOT issue a request to a paid model provider, and no paid provider credential SHALL be present in a client bundle.

#### Scenario: A default build attempts an Ask

- **WHEN** a user of a build without the rollout flag submits input through the command center
- **THEN** no paid provider request is issued and the Create path behaves exactly as it does today
