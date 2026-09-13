# ui-ux-data-entry-determinism Specification

## Purpose

Define the Warm Momentum 2.3 contract: shared numeric-input parsing,
deterministic submit ownership, a completed shared text-field contract,
and deterministic modal transitions — presentation-layer only, preserving
Warm Momentum 2.0–2.2 product contracts and all domain/data/sync behavior.

## ADDED Requirements

### Requirement: Shared numeric input model

The repository SHALL provide `lib/numericInput.ts` with
`sanitizeNumericInput(raw, { allowDecimal })` and
`parseNumericInput(raw, { allowDecimal })` such that: sanitizing never
reformats valid partial input (`""`, `"."`, `"12."` remain stable while
typing, preventing cursor jumps); parsing returns `null` for blank or
invalid input and a finite number otherwise; blank and zero remain
distinguishable at submit time; decimal support is opt-in per field.
Surfaces SHALL NOT implement bespoke character-stripping regexes for
numeric entry.

#### Scenario: Partial decimal typing is stable

- **GIVEN** a decimal-allowed numeric field holding `"12."`
- **WHEN** the user types another character or the field re-renders
- **THEN** the displayed text remains `"12."` with the cursor position preserved, and no value is coerced until submit

#### Scenario: Blank stays distinct from zero at submit

- **GIVEN** a workout weight field left empty and a fiber field containing `"0"`
- **WHEN** both are parsed at submit time
- **THEN** the empty field parses to `null` (unset) and the `"0"` field parses to `0`

#### Scenario: Integer-only fields reject decimal separators

- **GIVEN** a calorie macro field configured as integer-only
- **WHEN** the user types `"12.5"`
- **THEN** the field displays `"125"` per the documented integer sanitization and submit parses `125`

### Requirement: Deterministic submit ownership

Every async create/edit flow (Calories entry/edit, Quick Capture, Habits
save, Workout save/finish, Todo save, Command confirm) SHALL own
submission through the shared guard (`lib/submitGuard.ts`): a second
activation while a submission is in flight SHALL NOT produce a second
write; the submit control SHALL reflect the in-flight state (disabled
and/or loading); failures SHALL preserve typed input and surface an
inline or form-level error; the guard SHALL release in a `finally` block.

#### Scenario: Double-tap on Add entry creates one row

- **GIVEN** the Calories entry form with valid values
- **WHEN** the user activates "Add entry" twice in rapid succession before persistence resolves
- **THEN** exactly one `calorie_entries` row is created and the second activation is ignored

#### Scenario: Failed save preserves input

- **GIVEN** a form whose persistence call rejects
- **WHEN** the submission fails
- **THEN** the typed values remain in the form, an error is visible near the form, and the submit control is re-enabled

### Requirement: Shared TextField contract

`core/ui/TextField.tsx` SHALL support label, value, placeholder, helper
text, error text (with error styling and programmatic association to the
input on web), disabled state, multiline mode, and numeric keyboard
pass-through, without requiring surfaces to compose bespoke `TextInput`
blocks for these states. Placeholder-only fields SHALL NOT be used where
a label is required for comprehension.

#### Scenario: Error and helper text are announced with the field

- **GIVEN** a TextField with `helperText` and a non-null `error`
- **WHEN** the field renders on web
- **THEN** the input exposes both texts through described-by relationships, the error styling is visible, and no bespoke TextInput wrapper is needed

### Requirement: Deterministic modal transition

The shared `core/ui/Modal.tsx` SHALL guarantee that at most one modal
layer is interactive at any moment: while a modal is closing it SHALL
not accept pointer input and SHALL be hidden from the accessibility tree;
an overlay host swapping layers (Quick Capture → Describe it → Command
Center, Settings flows) SHALL NOT leave two simultaneously interactive
layers; Escape/back activation SHALL close the topmost interactive layer
only.

#### Scenario: Closing modal is non-interactive

- **GIVEN** the quick-capture sheet fading out while the command modal mounts
- **WHEN** a tap or keyboard Tab lands during the transition window
- **THEN** the outgoing sheet ignores the interaction and only the command modal responds

#### Scenario: Repeated rapid open/close keeps one interactive layer

- **GIVEN** the command modal opened and closed repeatedly in quick succession
- **WHEN** the sequence settles
- **THEN** exactly one modal layer (or none) is interactive and focusable, with no orphaned focus trap

## MOVED Requirements

None.

## REMOVED Requirements

None.
