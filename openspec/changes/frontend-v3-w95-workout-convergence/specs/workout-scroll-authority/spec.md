## Purpose

Defines the single scrolling authority of the Workout landing so exactly one
page-level scroll container owns the surface.

## ADDED Requirements

### Requirement: The Workout landing has exactly one page-level scroll authority

The Workout landing SHALL render exactly one scroll-enabled `Screen` that owns
the page. A second scroll-enabled `Screen` SHALL NOT be nested inside it, and
the landing SHALL NOT compose its own ad hoc page ScrollView in place of the
shared primitive. Section order, responsive gutters (16/24/32), safe-area
clearance, bottom-navigation clearance, the History & insights disclosure,
Quick Start, week planning, routine editor controls, modal ownership, and
keyboard interactions SHALL be preserved after the redundant shell is
removed.

#### Scenario: One scroll container owns the landing

- **GIVEN** the Workout landing renders with routines, a weekly strip, and history
- **WHEN** the component tree mounts
- **THEN** exactly one scroll-enabled `Screen` is present
- **AND** no nested scroll shell duplicates safe-area, gutter, or keyboard behavior
- **AND** the desktop content-width cap still applies
