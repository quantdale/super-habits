## ADDED Requirements

### Requirement: A provider-level day-key watcher detects local-day rollover

The app SHALL mount a single provider-level watcher (in `AppProviders`) that tracks the last-seen local calendar day via `toDateKey()` from `lib/time.ts` and detects a rollover by comparing against the current key on an interval and on `visibilitychange`. On detecting a new day, the watcher SHALL bump a context value the sections already consume for refresh (for example a monotonically increasing "day generation"), without adding per-section listeners.

#### Scenario: Rollover is detected while the app is open

- **WHEN** the local calendar day changes while the app is open (detected on the watcher's interval or on the next `visibilitychange`)
- **THEN** the watcher's context value bumps, signalling all mounted sections that the day has changed.

### Requirement: The active section refreshes its day-scoped data on rollover

When the day rolls over, the currently active section SHALL refresh its day-scoped data (date-keyed lists, streaks, Overview day aggregates) immediately, so no mounted surface labels a stale day "Today".

#### Scenario: "Today" panel reflects the new day after midnight

- **WHEN** the app is left open past midnight on a section that renders "Today"
- **THEN** the section re-reads its day-scoped data and displays the new day's values without a reload.

### Requirement: Inactive mounted sections refresh on activation, not from captured state

Inactive mounted sections SHALL be marked stale on rollover, so they re-read their day-scoped data the next time they are activated rather than rendering values captured before the boundary. No section SHALL be unmounted to achieve this.

#### Scenario: Switching to a stale section after rollover shows the new day

- **WHEN** the day rolls over while a section is inactive, and the user later activates that section
- **THEN** the section re-reads its day-scoped data and shows the new day's values instead of the previously captured state.

### Requirement: Write-side day-key behaviour is unchanged

Writes SHALL continue to derive their day key from `toDateKey()` at call time (contract D9a, asserted by J2a), and rows written before the boundary SHALL keep their original keys. This change is presentation-only and introduces no data-layer or schema changes.

#### Scenario: A write after midnight lands on the new day as before

- **WHEN** a habit is ticked after midnight while the app has been open since the previous day
- **THEN** the completion row is written with the new day's key exactly as today, and the UI now renders a "Today" consistent with that key.
