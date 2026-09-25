## ADDED Requirements

### Requirement: iOS runtime certification is independent and non-billable

An iOS runtime result MUST come from an authorized non-billable iOS simulator or macOS execution of the applicable source SHA. Android certification and static validation of workflow or project files MUST NOT be reported as iOS runtime success. The campaign MUST NOT upgrade an EAS plan, start a billable workflow, change signing credentials, or submit an app without authorization. When the only available iOS path is paid, the report MUST record the plan requirement and the owner action, and the iOS runtime state MUST be `NOT RUN` or an external blocker.

#### Scenario: Android passes on a Windows host

- **WHEN** Android certification passes and no authorized iOS runtime is available
- **THEN** iOS runtime is not marked successful

#### Scenario: The cloud path requires a paid plan

- **WHEN** the only iOS execution path requires a paid EAS plan and no upgrade is authorized
- **THEN** no billable workflow starts
- **AND** the owner action names that plan requirement
