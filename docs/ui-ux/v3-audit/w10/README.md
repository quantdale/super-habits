# W10 rendered-truth evidence — Calories / Health

Campaign wave: Frontend V3 "Calm Momentum" W10 (Calories reconstruction + D3
navigation validation gate).
Slice: `openspec/changes/frontend-v3-w10-calories/` (specs
`calories-logging-first`, `health-navigation-decision`).

## What is here

| Directory / file                           | Contents                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `before/`                                  | 17 captures of the pre-W10 surface (Form, Diary, empty, over-goal, dark, widths, add, search, targets, history, keyboard) + `d3-five-destination.json` |
| `390-calories-form-populated.png`          | Reconstructed Form mode (hero → daily summary → macros → quick log)                                                                                    |
| `390-calories-form-over-goal.png`          | Over-goal state: factual "N kcal over" caption, neutral caution tone                                                                                   |
| `390-calories-form-empty.png`              | Empty day: hero shows the whole goal remaining, one quiet empty state                                                                                  |
| `390-calories-diary-populated.png`         | Diary mode: quick log + day navigator + meal-grouped log                                                                                               |
| `390-calories-diary-empty.png`             | Diary empty: one sentence + one action                                                                                                                 |
| `390-calories-manual-add.png`              | Manual-add modal (single primary, close, meal chips, computed kcal)                                                                                    |
| `390-calories-saved-meal-search.png`       | Saved-meal search modal                                                                                                                                |
| `390-calories-saved-meal-search-query.png` | Search with a query and matches                                                                                                                        |
| `390-calories-targets-modal.png`           | Daily macro targets modal                                                                                                                              |
| `390-calories-history.png`                 | History & insights disclosure expanded (year trend + 53-week heatmap)                                                                                  |
| `390-calories-keyboard.png`                | Manual-add modal with keyboard open                                                                                                                    |
| `360-calories-form.png`                    | Narrow phone layout (chips wrap, no truncation)                                                                                                        |
| `412-calories-form.png`                    | Wide phone layout                                                                                                                                      |
| `768-calories-form.png`                    | Tablet: summary + macro cards compose side by side                                                                                                     |
| `1280-calories-form.png`                   | Desktop: centered content-max column, side-rail shell                                                                                                  |
| `390-dark-calories-form.png`               | Dark theme                                                                                                                                             |
| `390-dark-calories-diary.png`              | Dark theme, diary mode                                                                                                                                 |
| `d3-five-destination.json`                 | D3 measurement of the shipped five-destination model                                                                                                   |
| `d3-six-tab.json`                          | D3 measurement of the six-tab fallback                                                                                                                 |

All 20 post-W10 captures were opened and inspected (not merely generated).
Captures are evidence, never assertions; the contract lives in
`e2e/calories-w10.spec.ts` and `e2e/health-nav-w10.spec.ts`.

## Before → after (inspected)

1. **Hierarchy.** Before: four renderings of the remaining-kcal fact (hero
   title, "Remaining" StatBlock, "Goal progress" feature-stat note, consistency
   strip), three of the consumed total, three of the goal, a donut repeating
   the macro bars, and two feature-stat cards. After: one screen title
   ("700 kcal left"), one daily summary ("Today · 1,300 of 2,000 kcal logged" +
   progress bar + goal control), one compact macro summary. Verified by
   `e2e/calories-w10.spec.ts` ("no daily fact renders twice").
2. **History.** Before: the 365-day trend, macro trends and 53-week heatmap
   always rendered (and always derived) on the logging surface. After: one
   collapsed "History & insights" disclosure below the day log; the rolling
   derivations only run while it is open.
3. **Meal grouping.** Before: Form mode rendered flat SwipeableCard rows under
   "Logged today" while Diary rendered meal-grouped cards — two anatomies for
   one dataset. After: one shared meal-grouped log in both modes with visible
   Edit/Delete actions (no swipe required).
4. **SYS-18 (truncated chips).** Before: "Grilled chicken and quinoa power
   bowl with avoc…" truncated inside a horizontal scroller at 390px. After:
   content-hugging chips wrap (see `360-calories-form.png`,
   `390-calories-form-populated.png`); the long chip's label is fully visible
   and never clipped (asserted in the regression spec).
5. **SYS-06 (doc-copy).** Before: eight documented strings on the surface
   ("Switch between manual entry and a diary grouped by meal.", "Keep the
   current macro form and reuse foods when they repeat.", "Auto-calculated
   from protein, carbs, fat, and fiber.", …). After: removed; the regression
   spec asserts each string's absence.
6. **SUR-07 (FAB over the form).** The floating FAB was removed at the shell
   level in W4; W10 re-verifies that nothing absolutely/fixed positioned
   overlaps any entry-form field at 360–412px and that the form's primary
   action lives inside the form.
7. **Bar labels.** Before: 10.5px labels (below the V3 §9 ≥11px contract) in
   both navigation models — found by the D3 instrument, corrected with the
   six-tab model (11px, no truncation, ≥44pt targets at 360/390/412).

## D3 navigation validation gate

Instrument: `e2e/health-nav-w10-measure.spec.ts` (opt-in, `D3_MEASURE=1`),
equivalent starting state (Overview active, seeded routine/entries, 390×844),
model-aware so the same probe measures both builds.

| Measurement (tap depth from Overview) | five-destination (`before/`)                | six-tab (shipped)                               |
| ------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| Start a workout                       | 3 taps (Health → Open Workout → Start)      | **2 taps** (Workout → Start)                    |
| Log a meal                            | 3 taps (Health → Open Calories → quick add) | **2 taps** (Calories → quick add)               |
| View remaining calories               | 1 tap (Health parent summary)               | 1 tap (Calories hero, with the logging surface) |
| Section switch (all six sections)     | 1 tap ×4, **2 taps ×2** (workout/calories)  | **1 tap ×6**                                    |
| Active Focus session survives switch  | yes                                         | yes                                             |
| Bar label font size                   | **10.5px (< 11px contract)**                | 11px                                            |
| Minimum target at 360px               | 52×48px                                     | 44×48px                                         |
| Truncated labels                      | none                                        | none                                            |

**Decision: ship the six-tab fallback** (Today, To Do, Habits, Focus, Workout,
Calories + capture slot). The Health parent added a tap to the two most common
health flows (starting a workout, logging a meal) and a tap to switching to
Workout/Calories, which is exactly the condition the parent design's gate
names for rejecting the merge. The one flow the parent won (viewing remaining
calories in one tap) is equally one tap in the six-tab model — and that same
tap also lands on the logging surface. The gate evidence is preserved in both
JSON records so the decision can be re-examined.

`health` remains a valid `AppSection` (deep links, linked-action targets,
command-center launch context, `SECTION_SCREENS`): the Health surface and its
Workout/Calories entries still render and route. It is no longer a bar
destination. `e2e/helpers/navigation.ts` no longer routes workout/calories
through Health, and `tests/healthNavigationW10.test.ts` pins the structure.

## Notes / limits

- Web (Chromium, static export) evidence only. Native Android/iOS rendering,
  OS largest-text scaling, and screen-reader qualification are NOT certified
  by these captures (Android W16 pending, iOS owner-deferred).
- The seeded audit day (5 entries, realistic macros) is deterministic; the
  fixture's own 9999-kcal stress entry is intentionally excluded so the hero
  and bars stay legible.
