## MODIFIED Requirements

### Requirement: Performance-oriented user journeys

The suite SHALL assert user-perceptible responsiveness at realistic data volume. Against the unchanged HEAVY fixture, the user-visible recurring-todo section-switch path SHALL complete within 800ms after all six sections have been activated, and the calorie-diary saved-meal search path SHALL reveal the matching result within 500ms after input. The timing boundaries SHALL include legitimate initialization, refresh, filtering, state-update, and rendering work experienced by the user. Formal load and stress testing SHALL be recorded as out of scope rather than implied.

#### Scenario: Cold start at heavy volume stays usable

- **WHEN** the app is opened cold against the HEAVY fixture
- **THEN** Overview reaches an interactive, populated state within the agreed threshold and does not render a partially-populated state that later jumps.

#### Scenario: Recurring-todo section switching stays within the D14 ceiling

- **WHEN** all six sections have been activated against the unchanged HEAVY fixture and the user switches from Overview to Todos through the normal tab rail
- **THEN** the section reaches its interactive populated state within 800ms, including recurring-todo refresh/expansion and legitimate rendering work, without duplicate daily instances or changed recurrence results.

#### Scenario: Section switching stays responsive after long use

- **WHEN** all six sections have been activated and the session has run through many interactions
- **THEN** switching sections stays within the agreed threshold, with no progressive slowdown across repeated switches.

#### Scenario: Calorie-diary saved-meal search stays within the D14 ceiling

- **WHEN** the user enters a query in the HEAVY calorie diary saved-meal search
- **THEN** the matching saved meal is revealed within 500ms with the existing case behavior, matching semantics, ordering, diary results, and calorie/macro values unchanged.

#### Scenario: Large lists remain interactive

- **WHEN** a list of 200+ todos or 600+ calorie entries is scrolled and filtered
- **THEN** input remains responsive and the correct rows are rendered throughout.

#### Scenario: Performance evidence is repeatable

- **WHEN** the fixed HEAVY performance journey is run repeatedly in its configured Chromium journeys project
- **THEN** the unchanged thresholds and assertions are evaluated on every run, timing distributions are recorded, and a quarantine is removed only after the applicable contract passes reliably rather than on a single favorable sample.
