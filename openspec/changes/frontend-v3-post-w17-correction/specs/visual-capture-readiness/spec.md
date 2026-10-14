## Purpose

Defines the fail-closed readiness contract for the curated visual-regression capture so an unsettled frame or a missing required font cannot pass as a golden.

## ADDED Requirements

### Requirement: Unsettled section transitions fail the capture

The curated visual capture SHALL compare a screenshot only after every inactive section that is hidden from assistive technology has reached full transparency. If that condition is not met before the bounded wait ends, the capture SHALL fail with a diagnostic that names the unmet condition and SHALL NOT record a passing golden comparison.

#### Scenario: A stuck inactive section fails closed

- **WHEN** a curated capture runs while an inactive hidden section remains visibly opaque through the bounded settle wait
- **THEN** the capture fails and names that section readiness failure
- **AND** the comparison is not reported as passed

#### Scenario: A settled capture still uses a strict comparison

- **WHEN** every inactive hidden section is fully transparent and the required font faces have loaded
- **THEN** the capture compares against the accepted golden with zero pixel tolerance
- **AND** a deliberate pixel perturbation still fails

### Requirement: A failed required font load fails the capture

The curated visual capture SHALL treat a failed load of a required application font face as a capture failure. It SHALL name the font family in the failure and SHALL NOT continue to a passing screenshot after swallowing that error.

#### Scenario: Missing required face is not a pass

- **WHEN** a required application font face rejects its load during curated capture setup
- **THEN** the capture fails and names that font family
- **AND** the golden comparison is not reported as passed
