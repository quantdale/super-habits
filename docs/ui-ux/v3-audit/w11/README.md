# W11 rendered evidence — Planning / Goals / Projects / Daily Plan

Branch: `frontend-v3-w11-planning`, compared against unchanged W10.5 source
`6e5fc86496a0f657549104a227a46200d4fdf472`.
W11 OpenSpec: `openspec/changes/frontend-v3-w11-planning/`.
Capture instrument: `e2e/planning-w11-audit.spec.ts` (opt-in
`VISUAL_AUDIT=1`). Capture runs: initial `38286186313`, final after-code
recapture `38287180103`.

## Contents

- **39 baseline screenshots:** `before/`, rendering the original W10.5
  Goals/Projects/Daily Plan sources using identical UI-created fixtures.
- **43 after screenshots:** root of this directory; final after images
  recaptured after the W11 Goal progress-field synchronization and condensed
  Today briefing revision (same input fixtures).
- Phone width matrix 360, 390, 412; tablet 768; desktop 1280;
  both light and dark; Projects/Goals/Today states, plus 390 creation/detail,
  empty/populated, expanded optional fields and plan options.
- These are rendered web PWA captures, not baselines approved for W15
  visual-regression comparison. No native Android/iOS assertion.

## Inspected differences

1. **Projects list:** baseline shows two exposed rows of filter/sort chips,
   with truncated item title and ornamental bullets; W11 shows a compact
   `Filters & sort` disclosure and complete two-line-capable objective text,
   status/context, percent and an unambiguous single progress bar. Manual
   order arrows are still visible and operable.
2. **Goals list:** baseline exposes three rows of status/horizon/sort chips,
   pushes the objective to the bottom of the 390 screenshot and repeats
   progress in metadata; W11 makes the objective/status/progress immediately
   scannable behind one quiet disclosure.
3. **Goal detail:** objective and progress precede optional metadata. The
   W11 visual review caught a stale typed-percent field after +/- controls
   changed the bar; the two now agree (10% / 10 in the final capture).
   Secondary options and linked tasks remain reachable.
4. **Project detail:** progress is directly beneath the name, with status,
   colors and dates behind `More options`, and associated habits/goals
   behind another disclosure. Next-up tasks, lifecycle and delete remain.
5. **Today:** the initial wizard remains for users who want guidance, but the
   five-stat briefing is collapsed so the intention, priorities and Save Plan
   enter the 390px viewport earlier. The editor's optional candidate picker,
   planning settings, reflection/energy and history remain discoverable.
6. **Responsive and dark:** representative 360, 390, 412, 768 and 1280
   captures were opened and checked for accessible row labels, item
   truncation, logical order and dark foreground contrast. No new competing
   color system was introduced.

## Functional authorities

- `e2e/planning-w11.spec.ts` (3 W11 tests), plus
  `e2e/planning-hub.spec.ts` (4 existing journeys), independently passed
  7/7 Chromium in run `38285465187` and final post-review run
  `38287180079`.
- SQLite oracles preserve project manual ordering, goal percent progress,
  day-plan status/notes/reflection, and durable linked/intention state.
- Existing `braces` and `node-forge` audit advisories block standard
  E2E/nightly by CI dependency; this opt-in evidence job did not bypass,
  mute or modify the security audit itself.
- Native W16 Android and owner-deferred iOS testing remain outstanding.

## Reproduction

Run `VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w11
npx playwright test e2e/planning-w11-audit.spec.ts --project=chromium`
against a locally built web export in an isolated environment. Do not
overwrite the historic `before/` captures when recording a new W11 version.
