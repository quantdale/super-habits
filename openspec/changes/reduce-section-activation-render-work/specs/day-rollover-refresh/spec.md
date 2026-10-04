## Purpose

Adds the two obligations that keep the heavy-state section-activation path from accumulating app-owned work: exactly one refresh per foreground transition per consumer, and derived screen state memoized against its data rather than recomputed per render.

## ADDED Requirements

### Requirement: One foreground transition triggers exactly one refresh per consumer

A single transition of the application to the foreground SHALL cause each mounted consumer of the foreground-refresh hook to run its refresh callback exactly once, on every platform. On web, where the platform's application-state notification is itself derived from the document visibility event, the hook SHALL NOT register a second listener for the same underlying event.

#### Scenario: A web foreground occurs

- **WHEN** a web application becomes visible after being hidden
- **THEN** each mounted consumer's refresh callback runs exactly once

#### Scenario: A native foreground occurs

- **WHEN** a native application returns to the active state
- **THEN** each mounted consumer's refresh callback runs exactly once

#### Scenario: The day rolls over

- **WHEN** the local calendar day changes and the watcher bumps the day generation
- **THEN** mounted sections refresh their day-scoped data exactly as the rollover contract requires, with no additional or duplicated refresh

### Requirement: Derived screen state is memoized against its data

A mounted section SHALL derive its screen-level aggregates from a dependency that changes only when the underlying data changes. A re-render caused by unrelated state — a keystroke, a modal opening, a toggle, or a section activation — SHALL NOT recompute a section's derived aggregates, and a per-item derived value SHALL NOT be recomputed once per consumer of it.

#### Scenario: A Habits re-render with unchanged data

- **WHEN** the Habits screen re-renders while its habit list and completion counts are unchanged
- **THEN** the derived active-habit list and its scheduled/completed counts are not recomputed

#### Scenario: Derived per-item values are computed once

- **WHEN** a section derives a per-item value that several aggregates consume
- **THEN** that value is computed once per item per data change rather than once per aggregate per render
