## Design — W10 Calories / Health reconstruction

Parent authority: `docs/ui-ux/13-calm-momentum-design-system.md` and
`docs/ui-ux/14-v3-reference-ledger.md` (R5 synthesis: "logging-first
hierarchy: remaining state → macro summary → meals → quick-add → history
elsewhere"). This file records only W10-specific decisions.

### D10.1 — One logging-first surface, two entry modes

Form and Diary modes keep their product identity (Form = manual macro entry
for today; Diary = day navigation, search-first add, copy-day) but share one
rendered stack, top to bottom:

1. **Hero (pinned):** `PageHeader` eyebrow `CALORIES` (also the section's
   stable identity string for observability), title = the remaining-kcal
   number (`1,853 kcal left` / `213 kcal over`), no subtitle (SYS-06). Below
   it the Form/Diary `SegmentedControl` (compact 36).
2. **Daily summary (one hero card, `variant="hero"`):** consumed-of-goal
   context line, one progress bar, and — only when over goal — a factual
   neutral-caution caption. No StatBlock trio, no donut, no consistency strip.
3. **Macro summary (compact card):** protein/carbs/fat rows with
   `actual / target` and a slim bar each; `Edit targets` as a quiet action in
   the card's title row. Over-target stays informational, never shame copy.
4. **Log food card:** recent-food chips, frequent-food chips, kcal quick-add
   (presets + numeric + Add), `Browse saved meals (N)` secondary.
   Form mode extends this card with the full macro form (food, P/C/F/Fi,
   computed-kcal readout, meal chips, `Add entry` primary).
   Diary mode extends it with search-first add (query, matches, `Manual add`
   primary).
5. **Day log (meal-grouped):** one shared meal-group component in both modes —
   meal header (icon, label, item count, kcal total, expand chevron) over
   compact entry rows with visible Edit/Delete actions. Form mode logs today;
   Diary mode renders the day navigator (prev/next, week strip with logged
   dots, copy-day) above it.
6. **History & insights (collapsed disclosure):** year trend, macro trends,
   53-week heatmap and the days-logged/goal-progress facts, matching the W9
   Workout disclosure pattern. Heavy rolling derivations (365-day activity,
   heatmap, daily trend) only run while the disclosure is open.

One primary action per surface: the form's `Add entry` in Form mode, the
diary's `Manual add` in Diary mode, and the empty state's single action.
Quick-add chips and presets are affordances, not competing primaries.

### D10.2 — Chip adaptivity (SYS-18)

Recent/frequent chips are content-hugging and **wrap** into rows instead of
rendering inside a horizontal scroller with fixed widths. A chip is never
truncated: at 360px a long food name wraps the chip row rather than the
label. Chips keep 40pt visual height with the existing hit slop, and their
accessible names stay `Log <food>, <kcal> kcal` (test contract).

### D10.3 — History derivations become disclosure-scoped

`buildCalorieActivityDays`, `buildCalorieHeatmapDays`, `buildDailyTrend` and
`buildMacroTrendPoints` currently run on every refresh. In W10 they are gated
on the disclosure being open, so the logging surface's refresh cost drops to
the day's entries + goal + saved-meal catalog + 30-day frequent rollup. This
is a performance correction, not a behavior change: the numbers are identical
when the disclosure opens, and the D14 diary-search ceiling is unchanged.

### D10.4 — D3 navigation validation gate (measured, then shipped)

Measurement protocol (run as an opt-in Playwright instrument so it is
re-runnable evidence, not a one-off note):

- Equivalent starting state: Overview active, seeded TYPICAL fixture, 390×844.
- Flows: (a) start a workout, (b) log a meal, (c) view remaining calories.
- Recorded per flow: tap count to first meaningful action (five-destination
  model vs six-tab model), completion success, and the section-switch
  behavior (active-section identity + task-switch success rate).
- Decision rule (from the parent design): if the parent adds a tap or drops
  task-switch success on these flows, ship the six-tab fallback with the V3
  visual restyle only. Evidence for both models is recorded before the
  decision is written.

Five-destination model measured first at the W9.5 baseline; the six-tab
fallback is then implemented and the same instrument re-run. Rail labels
(`NAV_ITEMS`) remain the single source of truth for the
`journey-label-parity` guard; any label change updates `e2e/helpers` maps in
the same commit. `health` stays a valid `AppSection` (deep links, linked
actions, command-center routing keep working) even when it stops being a bar
destination; active-session state (running Focus timer, workout draft) is
preserved because sections stay mounted.

### D10.5 — What W10 does not touch

`core/db/*`, sync engine, backup/restore, portable export, Supabase edge
functions, notification scheduling, the `calorie_entries` schema, the
kcal-from-macros math, saved-meal catalog maintenance (no phantom rows, no
`use_count` inflation), goal/target persistence, and the day-correction
contract (`calories-entry-correction`).
