## Purpose

Extends the planning calendar contract so that every inclusive "last N local days" window in the product is computed by local-calendar arithmetic and is proven at a daylight-saving boundary, rather than only Progress periods carrying that guarantee.

## ADDED Requirements

### Requirement: Inclusive day windows use local-calendar arithmetic

Every inclusive "last N local days" window used to bound a query SHALL be computed by local-calendar arithmetic that walks calendar days, not by subtracting a fixed number of milliseconds from the current instant. This SHALL apply to goal rollups, daily-plan listing windows, and project habit windows, and not only to Progress periods.

#### Scenario: A spring-forward boundary is crossed

- **GIVEN** America/New_York crosses the spring-forward boundary and the local day is 23 hours long,
- **WHEN** an inclusive N-day window is computed for a local morning shortly after local midnight
- **THEN** the window begins at local midnight of the (N−1)-th preceding calendar day and spans exactly N local days

#### Scenario: A fall-back boundary is crossed

- **GIVEN** America/New_York crosses the fall-back boundary and the local day is 25 hours long,
- **WHEN** an inclusive N-day window is computed
- **THEN** the window spans exactly N local days

#### Scenario: Outside a DST boundary

- **WHEN** an inclusive N-day window is computed on a day of ordinary length
- **THEN** the window begins on the same calendar day the fixed-millisecond arithmetic would have produced

### Requirement: Day-window boundaries are covered at the DST boundary

Each affected read path SHALL have executing coverage that pins its window start at a spring-forward and a fall-back boundary, so a regression to fixed-millisecond arithmetic fails a test rather than only producing a one-day rollup error once a year.

#### Scenario: A site regresses to fixed-millisecond arithmetic

- **WHEN** one of the affected read paths is changed back to subtracting a fixed millisecond count
- **THEN** the DST-boundary coverage for that path fails

### Requirement: Day-window reads are deterministic under seeded fixtures

A day-window read path SHALL derive its "today" from an injectable clock rather than reading the wall clock directly, so a seeded corpus's window is evaluated against the seeded day.

#### Scenario: A seeded corpus is queried

- **WHEN** an integration fixture seeds a corpus ending on a seeded date and then reads a day window
- **THEN** the window is computed relative to the seeded date, not the machine's current date
