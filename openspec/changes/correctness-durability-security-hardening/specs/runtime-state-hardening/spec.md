## Purpose

Prevent malformed persisted settings and inefficient calendar polling from
causing invalid behavior, crashes, or missed local-day transitions.

## ADDED Requirements

### Requirement: Persisted JSON settings are normalized at runtime

Persisted JSON settings that affect user behavior MUST be parsed as unknown
data and normalized or replaced with safe defaults before use. Missing,
wrong-type, non-finite, negative, and out-of-range values MUST NOT propagate
into timers, nutrition calculations, or command behavior.

#### Scenario: Corrupted JSON is loaded

- **WHEN** a settings key contains invalid JSON
- **THEN** the caller receives safe defaults and the app remains usable

#### Scenario: Partially valid settings are loaded

- **WHEN** a JSON object contains valid fields plus missing or invalid fields
- **THEN** valid fields are preserved and invalid fields receive field-level
  safe defaults

#### Scenario: Extra fields are loaded

- **WHEN** persisted settings contain unknown extra properties
- **THEN** the normalized settings remain valid and unknown properties do not
  alter behavior

### Requirement: Local-day rollover is scheduled at the calendar boundary

The app MUST re-evaluate the local date on foreground/visibility changes and
MUST schedule a bounded check near the next local midnight rather than polling
every second indefinitely. The scheduler MUST clean up timers on unmount and
remain correct across DST, timezone, and system-clock changes.

#### Scenario: Midnight boundary is reached

- **WHEN** the next local midnight occurs while the provider is mounted
- **THEN** the provider refreshes the day generation and schedules the next
  boundary without creating duplicate timers

#### Scenario: App resumes after a missed boundary

- **WHEN** the app is backgrounded across local midnight and becomes visible
- **THEN** the current local date is re-evaluated immediately

#### Scenario: Timezone or clock changes

- **WHEN** the local timezone or system clock changes before the scheduled timer
- **THEN** foreground or timer reconciliation compares the actual current date
  and does not permanently miss rollover
