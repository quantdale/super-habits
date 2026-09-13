# Design: Warm Momentum 2.3 — Data-Entry Ergonomics, Shared Input Primitives, Modal-State Determinism

## Context

- Predecessors: WM2.0 (product simplification), WM2.1 (visual tokens),
  WM2.2 (SegmentedControl, tablet density, a11y order). Phase A of this
  campaign closed the last P0 journey flake by synchronizing on semantic
  state (`toBeEnabled`) after reproducing a forced-click-during-transition
  race in `e2e/helpers/commandObservation.ts`.
- Existing primitives: `core/ui/TextField.tsx` (label/value/placeholder/
  nativeID/accessibilityLabel/unsignedInteger), `core/ui/NumberStepperField.tsx`
  (min/max/step stepper), `core/ui/ValidationError.tsx`, `core/ui/Modal.tsx`
  (RNModal fade + onRequestClose), `core/ui/Button.tsx` (disabled/loading).
- Existing guard: `createSubmitGuard()` in `features/todos/todos.domain.ts`
  (process-memory `tryStart/finish`), used only by TodosScreen; Workout uses
  ad-hoc `isSaving`, Quick Capture ad-hoc `submitting`, Calories none.
- Duplicated numeric parsing: `value.replace(/[^0-9.]/g, '')` (weight,
  distance, pace, progression increment), `value.replace(/\D/g, '')`
  (progression min/max reps), `unsignedInteger` TextField prop (calorie
  macros), `Number(x) || 0` submit coercions.

## Goals / Non-Goals

- Goals: one numeric parsing model; one submit-guard model; a completed
  TextField contract; a deterministic modal transition model; adoption on
  the five highest-frequency entry surfaces; focused tests.
- Non-Goals: no global modal framework, no form-state-management library,
  no redesign of domain validation rules, no new routes/launchers, no
  theme changes, no native-module additions.

## Decisions

### D1 — Numeric model is pure and lives in `lib/numericInput.ts`

Two functions, no React:

- `sanitizeNumericInput(raw: string, opts?: { allowDecimal?: boolean }): string`
  — strips invalid characters, preserves partial states (`"12."`, `"."`,
  `""`), never reformats what the user typed (no cursor jumps);
- `parseNumericInput(raw: string, opts?: { allowDecimal?: boolean }): number | null`
  — canonical parse for submit time: trimmed; `""` → `null` (blank is
  distinct from zero); non-numeric text → `null`; unambiguous partial
  states parse leniently (`"12."` → 12, `".5"` → 0.5) because submit-time
  coercion of a trailing dot is what the user meant; otherwise the number.

Blank-vs-zero is explicit at the call site: fields that mean "unset" use
`null`; fields that mean "zero" pass `0`. Locale: the app is en-US today;
decimal point only (documented; no separator localization in this change).

Rationale: Workout already needs decimals (`[^0-9.]`), Calories macros are
integers, and every surface re-implements the same three lines with
different edge cases. A pure module is unit-testable and reusable by the
command executor's draft validation.

### D2 — Submit guard generalizes to `lib/submitGuard.ts`

Move `createSubmitGuard` verbatim to `lib/submitGuard.ts`; keep the
`tryStart/finish` shape (proven in Todos). Adoption pattern per form:

```ts
const submitGuard = useRef(createSubmitGuard());
const [isSubmitting, setIsSubmitting] = useState(false);
const onSave = async () => {
  if (!submitGuard.current.tryStart()) return;
  setIsSubmitting(true);
  try {
    /* validate → persist → close */
  } finally {
    submitGuard.current.finish();
    setIsSubmitting(false);
  }
};
```

The submit `Button` receives `disabled={isSubmitting}` (Button already
renders loading/disabled states). This closes the double-tap window in
Calories (currently unguarded) and standardizes Workout/Quick Capture.
The guard is deliberately process-memory: durable exactly-once is a sync
concern, not a form concern (matches the existing command-executor guard
comment).

### D3 — TextField completes its contract; no mega-component

Add to the existing TextField: `error?: string | null` (border + message
slot, associated via `aria-describedby` on web), `helperText?: string`,
`multiline?: boolean`, and pass-through of `keyboardType`,
`autoCapitalize`, `autoCorrect`, `returnKeyType`, `submitBehavior`,
`onSubmitEditing`. No prefix/suffix slots, no read-only variant — no
current surface needs them (YAGNI). `unsignedInteger` becomes a thin
wrapper over `sanitizeNumericInput` (behavior preserved).

### D4 — Modal transition: minimal deterministic contract inside Modal.tsx

RNModal already owns the open/close animation; the gap is that a closing
modal stays interactive and focusable during fade-out. Contract:

- `Modal` tracks phase internally: `open` → (visible=false) → `closing`
  (pointer-events none, `aria-hidden`, focus released) → unmounted.
- Overlay hosts that swap layers (Quick Capture → Describe it → Command
  Center) keep the existing `setTimeout(0)` sequencing, but the outgoing
  layer is non-interactive immediately, so the dual-mounted window has
  exactly one interactive layer.
- No global coordinator: the app has five modal hosts; a coordinator
  would be abstraction for its own sake. Each host's swap pattern is
  covered by the contract above and by E2E.

### D5 — Adoption order is dependency-ordered

1. `lib/numericInput.ts` + tests (no UI change).
2. `lib/submitGuard.ts` + Todos re-point (behavior identical).
3. TextField contract + tests.
4. Modal transition contract.
5. Surface adoption: Calories (guard + numeric), Workout session +
   routine card (numeric + TextField), Quick Capture (guard + focus),
   Habits editor (guard), Todos quick-add (focus/submit-once).
6. E2E: double-submit prevention (Calories), transition determinism
   (quick-capture → command), regression P0.

## Risks / Trade-offs

- [Numeric behavior change] Calories macros were integer-only
  (`unsignedInteger`); keeping them integer-preserving is required —
  `sanitizeNumericInput` default is integer-only, decimals opt-in.
  → Mitigation: unit tests pin integer rejection of `.` for macros and
  decimal acceptance for weight/distance/pace.
- [Modal contract vs RNModal internals] RNModal owns animation timing;
  we layer state on `onShow`/unmount rather than fighting it.
  → Mitigation: no custom animation timers; contract verified by E2E
  transition spec.
- [Guard adoption churn] Moving `createSubmitGuard` touches imports.
  → Mitigation: keep the function signature identical; Todos imports the
  shared module; no competing guard is introduced.

## Migration Plan

Additive first (lib modules, TextField props, Modal internals), then
per-surface adoption in separate commits, then test/E2E wave. Each wave
keeps `npm run typecheck && npm run lint && npm test` green.

## Open Questions

- None blocking. Stepper adoption beyond existing NumberStepperField uses
  is deliberately deferred (no surface demonstrated a need that text
  entry doesn't already serve better).
