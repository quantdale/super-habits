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

## W11 defect register

| #   | Defect found                                                                                                                  | Where                                 | Disposition                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Goal `+/-` progress buttons updated the bar but not the typed percent field (stale disagreement)                              | `GoalDetailView`                      | FIXED in `35926e7`; both now agree in the final capture                                                                                                                                                                       |
| D2  | Daily Plan briefing stats pushed intention/priorities/Save below the 390px fold on Today                                      | `PlanningHubScreen`                   | FIXED in `6467721` — briefing behind one accessible disclosure                                                                                                                                                                |
| D3  | Progress percent/bar were not part of the row's detail press target                                                           | `PlanningSummaryRow`                  | FIXED in `0e51c18` — whole card is one target                                                                                                                                                                                 |
| D4  | List filter disclosures could leave expanded state ambiguous to assistive tech                                                | list views                            | FIXED in `18b8b2c` + `accessibilityState`/`aria-expanded` forwarding                                                                                                                                                          |
| D5  | Daily Plan Save/Complete leaked an unhandled rejection on a rejected write with no visible failure and no retry affordance    | `DailyPlanView.persist`               | FIXED in `74d4aaf` — visible error surface, draft stays dirty                                                                                                                                                                 |
| D6  | Goal/Project delete failures silently did nothing (row stayed, no message)                                                    | `Goal/ProjectDetailView.handleDelete` | FIXED in `74d4aaf` — visible error beside the Delete action                                                                                                                                                                   |
| D7  | Project lifecycle transition set an optimistic status BEFORE the durable write; a rejected write left a false state on screen | `ProjectDetailView`                   | FIXED in `74d4aaf` — persist first, refresh from DB, visible failure                                                                                                                                                          |
| D8  | Goal/Project status+horizon (and project status) fully exposed on first view                                                  | detail views                          | BY DESIGN (spec: secondary controls behind disclosures)                                                                                                                                                                       |
| D9  | Native Android/iOS rendered evidence                                                                                          | —                                     | NOT RUN for W11 — W16 Android and owner-deferred iOS, explicitly out of scope                                                                                                                                                 |
| D10 | Failed-write E2E injection                                                                                                    | —                                     | NOT STAGEABLE in the current browser harness (SQLite/OPFS write failure cannot be forced without a product hook); data-layer rejection oracles live in the unit/integration suites, matching the calibrated W9.5/W10 approach |

## Evidence-to-acceptance map

| Acceptance criterion (W11 spec)                                                                                         | Evidence                                                                                                                                                                | Result                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Shared list-first grammar (objective/status/context/progress, wrap-safe)                                                | `PlanningSummaryRow.tsx`; before/after captures 360–1280 light/dark; `e2e/planning-w11.spec.ts` (3 tests)                                                               | MET                                                       |
| Filtering discoverable, not front-loaded; state survives collapse; active signal                                        | `ProjectListView`/`GoalListView` disclosures; spec scenario test in `planning-w11.spec.ts`                                                                              | MET                                                       |
| Advanced editor fields behind labeled expanded-state-aware disclosures; every previously supported field still editable | detail views with `aria-expanded`; `390-*-options`/`-detail` captures; save-journey E2E                                                                                 | MET                                                       |
| Daily Plan begins with date/status, intention, priorities, Save; picker not rendered while closed                       | `DailyPlanView`; `before/390-today-plan.png` vs `390-today-plan*.png`; E2E draft/commit/complete test                                                                   | MET                                                       |
| Reflection/energy/history behind disclosures; collapse never clears drafts or commits                                   | `DailyPlanView` draft-owner guards; E2E retains-drafts step                                                                                                             | MET                                                       |
| Persistence, ordering, carry-forward, snapshot titles, sync intents unchanged                                           | no `.data.ts`/`.domain.ts`/`core/` diff (`git diff --name-only 6e5fc86..HEAD`); 7/7 planning E2E incl. manual-order and history-delete journeys; integration 416 passed | MET                                                       |
| Async save/delete/rejected-write visibility                                                                             | `74d4aaf` surfaces; typecheck/lint clean; lanes re-run 7/7                                                                                                              | MET (browser-injectable failure path not stageable — D10) |
| Light/dark + 360/390/412/768/1280 responsive                                                                            | 82 captures versioned in this directory and `before/`                                                                                                                   | MET (inspected)                                           |
| Native rendered evidence                                                                                                | —                                                                                                                                                                       | NOT RUN (out of W11 scope)                                |

## Functional authorities

- `e2e/planning-w11.spec.ts` (3 W11 tests), plus
  `e2e/planning-hub.spec.ts` (4 existing journeys), independently passed
  7/7 Chromium in run `38285465187` and final post-review run
  `38287180079`.
- Local exact-head gates at final W11 head `74d4aaf` (Windows workstation):
  typecheck 0; lint 0/0; Vitest 2,675 passed / 3 skipped (the single
  `agentDocConsistency` failure is the documented Windows-CRLF residual and
  fails identically on pristine `main`); integration project 416 passed /
  2 skipped; themes 140/140; OpenSpec 80/80; versioned plans PASS;
  journey-label and quarantine parity OK; hermetic `build:e2e` OK; planning
  7/7, journeys P0 25/25, deterministic simulation PASS.
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
