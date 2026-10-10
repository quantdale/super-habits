## MODIFIED Requirements

### Requirement: Section accents remain accents, not surface paint

Feature accent colors SHALL be used for selection, progress, small emphasis,
and key icons. The page surface, typography, cards, and default controls SHALL
use the neutral semantic tokens so no section reads as a separate mini-brand.
Workout landing groups (training state, quick start, weekly strip, routine
management, history) and live-session surfaces SHALL use quiet group labels
and flat rows on the surface ladder, with the Workout accent reserved for
primary actions, today markers, and the current set. Small Workout labels
SHALL meet WCAG AA contrast in light and dark themes.

#### Scenario: Today cards keep neutral surfaces with accent details

- **GIVEN** the Today/Overview dashboard with multiple section cards
- **WHEN** it renders in light or dark theme
- **THEN** card surfaces use the neutral surface tokens and section colors
  appear only as accents (icon tile, top bar, progress)

#### Scenario: Workout landing uses quiet group labels

- **GIVEN** the Workout landing with routines, a weekly strip, and history
- **WHEN** the section renders
- **THEN** group headers are quiet labels rather than saturated header bands
- **AND** routine rows and week cells are flat rows with hairline separators rather than nested tinted cards

#### Scenario: Workout accent text stays AA-readable

- **GIVEN** the Workout landing or live session rendered in light or dark theme
- **WHEN** quick-start rows, week strip cells, and set rows display accent-colored text or markers
- **THEN** every text element meets WCAG AA contrast for its size
- **AND** state is never communicated by color alone
