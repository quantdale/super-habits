## Purpose

Extends the heavy-state reliability contract so that the section-activation and foreground-refresh paths do not accumulate app-owned work: a mounted section's derived aggregates are memoized against their data, and per-item derived values are not recomputed once per aggregate per render.

## ADDED Requirements

### Requirement: Section activation does not recompute derived aggregates

A permanently mounted section's screen-level aggregates — active-item filtering and the counts derived from it — SHALL be computed once per data change. Activating a section, or re-rendering it for an unrelated reason, SHALL NOT recompute them.

#### Scenario: A section is activated

- **WHEN** the user switches to a permanently mounted section whose underlying data has not changed
- **THEN** that section's derived aggregates are not recomputed on activation

#### Scenario: Unrelated state changes

- **WHEN** a modal opens, a toggle fires, or the user types on a permanently mounted section
- **THEN** that section's derived aggregates are not recomputed

### Requirement: Heavy-state derived work stays bounded by data, not by render count

The number of times a per-item derived value is computed SHALL be bounded by the number of items times the number of data changes, not by the number of renders. A section whose aggregate loop reads a per-item derived value SHALL read a value computed once per item per data change.

#### Scenario: A per-item value is read by several aggregates

- **WHEN** a section's aggregate loop reads a parsed per-item rule for several days
- **THEN** the parse happens once per item per data change and the several day aggregates reuse it
