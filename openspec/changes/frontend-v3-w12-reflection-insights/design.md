## Design — W12 Weekly Review / Progress / Activity

Design authority: `docs/ui-ux/13-calm-momentum-design-system.md`.
Reference decisions: `docs/ui-ux/14-v3-reference-ledger.md`.
Defect evidence: `docs/ui-ux/15-v3-defect-ledger.md` (SUR-12).
Baseline evidence: `docs/ui-ux/v3-audit/w12/before/` + `baseline.md`.
Parent: `openspec/changes/frontend-v3-calm-momentum/design.md` (D4, D6).

### D12.1 Reflection hierarchy (all three surfaces)

One shared reading order, applied where it is honest to apply it:

`Date/window context → factual story → what mattered → decision/action →
supporting details → history`

This is a _reading order_, not a shared component. Weekly Review, Progress and
Activity have different primary questions, so they keep different anatomy; they
share the rule that the factual story precedes the supporting metric grid and
that supporting details are disclosed rather than front-loaded.

### D12.2 Weekly Review step model

The current sequence is
`summary → insights → todos → priorities → new_todos → reflection → preview`.

Replace it with the campaign's `Review → Decide → Plan → Reflect → Confirm`
model, which preserves every interaction and persistence guarantee while
removing the statistics-then-statistics opening:

| New step  | Absorbs                    | Why it is safe                                                                                                                                                                                                                                                                                                                                      |
| --------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review`  | `summary` + `insights`     | Both are read-only renders of the same `WeeklyReviewSummaryV1`; combining them removes a "Next" tap without touching any draft state. Narrative observations lead; the five domain groups move behind one `All numbers` disclosure (≤1 tap) so the SUR-12 requirement ("charts/numbers support the story") holds without deleting any domain count. |
| `decide`  | `todos`                    | Unchanged behaviour; renamed to the user's decision framing.                                                                                                                                                                                                                                                                                        |
| `plan`    | `priorities` + `new_todos` | Both write into the same draft and both are validated by `validateReviewDraft`; showing priorities first then commitments (each with its own existing affordance) keeps one obvious progression and no duplicated "Add". Secondary commitment fields (notes) stay behind a per-row disclosure.                                                      |
| `reflect` | `reflection`               | Unchanged; draft continuity across steps preserved by keeping it in the same component state.                                                                                                                                                                                                                                                       |
| `confirm` | `preview`                  | Unchanged mutation preview, now also listing the exact counts it will apply.                                                                                                                                                                                                                                                                        |

`done` remains a terminal state, not a step. The dot indicator is replaced by a
labelled progress line (`Step 2 of 5 · Decide`) so the user knows where they are
without counting dots; screen-reader users get the same count in the step
heading's accessible name.

**Rejected:** a single scrolling page with all 15 fields visible. The campaign
brief explicitly names this "a fake one-page form"; it also breaks the
`maxLength`/validation feedback locality the current steps provide.

### D12.3 No speculative coaching

`generateInsights()` is the existing insight authority and already avoids
invented percentages. Two corrections are required for the narrative-first
surface:

1. The `habit_consistency_high` win ("strong week") and `habit_consistency_low`
   attention ("room to improve") are evaluative. Keep the numeric fact
   (`"86% habit consistency"`) and drop the verdict, so a low-activity week is
   neutral rather than admonishing.
2. `calories_below_goal` currently reads "within range of X kcal goal" as a
   win; a large _under_-goal average is not automatically good. Report the
   arithmetic fact (`Average A kcal/day vs goal B`) under `Attention` when it
   is outside ±200 kcal on either side, and under neither list when inside.
   Rest days and reduced intake are context-dependent, so neither side is
   painted as success.

A zero denominator never becomes an implied 100%: `consistencyPercent` stays
`null` and renders as `Not tracked` (not `0%`) when nothing was scheduled.

### D12.4 Progress headline model

`buildProgressSummary()` and `buildProgressNarrative()` keep their outputs.
The view changes only:

- Period context becomes a real sentence with dates
  (`Last 30 days · 2026-09-15 → 2026-10-14 · compared with the prior 30 days`).
- The narrative card is the first content block (it already is).
- Headline metrics = the first three narrative-backed metrics, rendered as
  compact rows (`label · current + unit · signed delta vs prior`) rather than
  seven equal cards. `pctDelta() === null` renders `new this period` — never a
  fake percentage — and `trendOf()` colouring is dropped entirely because a
  down arrow is not inherently bad.
- One `More details` disclosure holds the remaining metric rows and the
  Planning group. Distinct units are stated per row (`min` vs `sessions`,
  `logged days` vs `kcal goal`, `sessions` vs `program`), so no two numbers
  are conflated.
- No new chart: the summary carries two aggregated windows, so two labelled
  values are the honest presentation (brief §W12.B.6).
- Empty (`EmptyStateCard`) vs error (retry card) vs zero-with-context stay
  distinct, as they already are.

### D12.5 Activity filter grammar

- One `Filters` button opens a disclosure containing sources, range and days.
  It carries `accessibilityState.expanded` + `aria-expanded`, and its label
  includes the active count when non-default (`Filters · 2 active`).
- The collapsed button shows the current selection summary
  (`All sources · Last 30 days`) so hiding the controls does not hide state.
- `Reset` restores `all / 30d / all-days`.
- Day chips render only inside the disclosure, capped at the existing 14 and
  ordered most-recent-first, so a phone viewport is never consumed by chips.
- The discrete day list comes from the _ranged_ set (existing
  `getTimelineDayKeys(typed)`), so changing the range cannot leave a selected
  day that no longer exists.
- Event rows become flat rows: 48–56pt, title + one metadata line
  (`Category · time`), hairline separator, no ornamental icon tile and no
  per-row border.
- Filtered-to-zero copy is `No matching activity` with a `Reset filters`
  action, distinct from the genuinely-empty `Nothing logged yet`.

### D12.6 Test and evidence contract

- Weekly Review step changes update `e2e/weekly-review.spec.ts` to the new tap
  sequence; the existing SQLite/outbox oracles in that spec stay byte-identical
  in meaning (one `weekly_reviews` row, `status='completed'`, `create` then
  coalesced `delete` intent).
- New unit tests pin the insight-wording corrections (no eval words, no
  under-goal "win").
- New real-SQLite oracles prove review persistence still writes exactly one row
  and that a rejected write surfaces a failure rather than a false success.
- New browser assertions pin: the `All numbers` disclosure contents, the
  Progress `More details` disclosure and `new this period` (never a `%` when
  prior is zero), and the Activity filter disclosure persistence + reset +
  filtered-empty copy.
- A new `e2e/planning-w12-audit.spec.ts` (opt-in `VISUAL_AUDIT=1`) captures
  before/after screenshots across 360/390/412/768/1280 light/dark into
  `docs/ui-ux/v3-audit/w12/`.
