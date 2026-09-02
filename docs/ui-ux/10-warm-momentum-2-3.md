# Warm Momentum 2.3 — Data-Entry Ergonomics, Shared Input Primitives, Modal-State Determinism

Campaign: `openspec/changes/polish-warm-momentum-2-3-data-entry-modal-determinism-v1`
Predecessors: [WM2.0](07-warm-momentum.md) · [WM2.1](08-warm-momentum-2-1.md) · [WM2.2](09-warm-momentum-2-2.md)

WM2.3 turns the moment the user _enters data_ into one deterministic model:

1. **One numeric-input model** — `lib/numericInput.ts`.
2. **One submit-guard model** — `lib/submitGuard.ts`.
3. **A completed shared TextField** — `core/ui/TextField.tsx`.
4. **A deterministic modal transition contract** — `core/ui/Modal.tsx`.

No domain, data, sync, or Gym V2 semantic changes. Presentation-layer only.

## 1. Numeric input (`lib/numericInput.ts`)

| Function                                      | Role              | Key semantics                                                                                         |
| --------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `sanitizeNumericInput(raw, { allowDecimal })` | onChange filter   | strips invalid chars; preserves partials (`""`, `"."`, `"12."`); never reformats (no cursor jumps)    |
| `parseNumericInput(raw, { allowDecimal })`    | submit-time parse | blank → `null` (unset, distinct from `0`); non-numeric → `null`; `"12."` → 12, `".5"` → 0.5 leniently |

- Integer-only is the **default** (macros, reps); decimals are opt-in
  (weight, distance, pace, body weight, progression increment).
- The decimal point is the only accepted separator (en-US; no locale
  separator localization in this change).
- Blank-vs-zero is decided at the call site: `null` means unset, `0` means
  explicit zero.

### Adoption map

| Surface                                                              | Mode                            |
| -------------------------------------------------------------------- | ------------------------------- |
| Workout session set entry (weight / distance / pace)                 | decimal sanitize                |
| Routine detail + routine card progression (increment / min-max reps) | submit parse                    |
| Workout body weight + goal                                           | decimal sanitize                |
| Calories macros (form + quick capture)                               | submit parse (integer)          |
| Quick capture calorie field                                          | integer sanitize + submit parse |

All bespoke `value.replace(/[^0-9.]/g, '')` / `replace(/\D/g, '')` inline
parsing was removed; the shared module is the only numeric entry filter.

## 2. Submit guard (`lib/submitGuard.ts`)

`createSubmitGuard()` (moved verbatim from `features/todos/todos.domain.ts`)
is the single double-submit mechanism for every async create/edit flow:

```ts
const guard = useRef(createSubmitGuard());
const onSave = async () => {
  if (!guard.current.tryStart()) return; // second activation swallowed
  setIsSaving(true);
  try {
    /* validate → persist → close */
  } finally {
    guard.current.finish();
    setIsSaving(false);
  }
};
```

- Process-memory on purpose: durable exactly-once remains a sync/outbox
  concern; a form only serializes its own in-flight activation.
- The submit button reflects the in-flight state (`loading={isSaving}` on
  `core/ui/Button`, which already disables while loading).

| Surface                     | Before                                       | After                                     |
| --------------------------- | -------------------------------------------- | ----------------------------------------- |
| Todos save                  | `createSubmitGuard` (feature-local)          | shared guard, identical behavior          |
| Quick capture               | ad-hoc `submitting` state check              | shared guard + loading state              |
| Habits create/edit          | none                                         | shared guard + loading state              |
| Calories entry/edit         | **none — double-tap created duplicate rows** | shared guard + loading state              |
| Workout session save/finish | ad-hoc `isSaving`                            | shared guard (via existing confirm flows) |

## 3. TextField contract (`core/ui/TextField.tsx`)

The shared field now covers the states that used to force bespoke
`TextInput` blocks:

- `error?: string | null` — danger border + error text, exposed to
  assistive tech via `aria-describedby` + `aria-invalid` on web;
- `helperText?: string` — muted helper (hidden while an error shows);
- `multiline` — RN `multiline` with top-aligned text;
- pass-through: `keyboardType`, `autoCapitalize`, `autoCorrect`,
  `returnKeyType`, `submitBehavior`, `onSubmitEditing`, `disabled`.

`unsignedInteger` is preserved as a thin integer-mode wrapper (behavior
unchanged).

## 4. Modal transition determinism (`core/ui/Modal.tsx`)

Contract: **at most one modal layer is ever interactive.**

- While a modal is closing (`visible=false`, fade-out), its content layer
  gets `pointerEvents: 'none'`, `accessibilityElementsHidden`, and
  `importantForAccessibility: 'no-hide-descendants'` — no ghost taps, no
  ghost focus during the animation window.
- Overlay hosts that swap layers (Quick capture → Describe it → Command
  Center) keep their `setTimeout(0)` sequencing; with the closing layer
  non-interactive, the dual-mounted window has exactly one interactive
  layer. The E2E swap contract lives in `e2e/determinism.spec.ts`.
- Escape/back closes the topmost interactive layer only (RNModal
  `onRequestClose` per layer, unchanged).

No global modal coordinator — five hosts with a shared primitive is the
right amount of structure (design D4).

## 5. Determinism E2E (`e2e/determinism.spec.ts`)

- **Double-activating Add entry** creates exactly one row
  (`Today: 235 kcal`, one row label, no `470 kcal`) — pins the Calories
  submit guard against regressions.
- **Quick-capture → command swap** pins the one-interactive-layer
  contract: the sheet is fully unmounted before the command modal accepts
  input; after Close, no command layer remains.

## Validation summary

- `npm run typecheck` — 0 errors.
- `npm run lint` — clean.
- `npm test` (Vitest) — full suite green, including new
  `tests/numericInput.test.ts` (17 cases) and `tests/submitGuard.test.ts`.
- `npx playwright test e2e/determinism.spec.ts` — green, repeated.
- Full Chromium E2E + P0 journeys — run at closure (see ExecPlan evidence).
