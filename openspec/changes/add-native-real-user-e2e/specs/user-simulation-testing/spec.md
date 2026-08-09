## ADDED Requirements

### Requirement: Native execution is a distinct autonomous QA gate

The autonomous QA model SHALL place focused native smoke and targeted native lifecycle testing after web regression, SHALL keep native flows smaller than the Playwright feature suite, and SHALL preserve the existing simulation and failure-classification model rather than duplicating it.

#### Scenario: Native-sensitive change escalates to native testing

- **WHEN** a change affects React Native navigation/UI, native persistence, Pomodoro lifecycle, notifications, or app lifecycle handling
- **THEN** the recommended QA sequence includes the appropriate Android native gate and an iOS/EAS gate when available.

#### Scenario: Pure domain change remains cost-conscious

- **WHEN** a change affects only pure domain logic and its deterministic tests
- **THEN** the impact map does not require a full native matrix unless another changed path is native-sensitive.
