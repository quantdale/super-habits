---
schema: spec-driven
created: 2026-10-12
---

## Why

W9/W9.5 closed Workout. W10 owns the two remaining Frontend V3 deliverables
named by the campaign plan: the Calories/Health screen reconstruction
(`tasks.md` §10.1–10.2) and the D3 navigation validation gate that decides
between the five-destination phone model shipped in W4 and the six-tab fallback
(`tasks.md` §10.3, `design.md` D3).

Three ledger defects are still open on the Calories surface:

- **SYS-06 (doc-copy as user copy).** The Calories screen narrates
  implementation detail: "Switch between manual entry and a diary grouped by
  meal.", "Keep the current macro form and reuse foods when they repeat.",
  "Year trend with your current goal overlaid.", "Rolling 7/30-day intake
  averages. Informational only.", "Live totals, goal progress, and macro
  split.", "Auto-calculated from protein, carbs, fat, and fiber.",
  "Entries are grouped by stored meal type and default to expanded."
- **SYS-18 (truncated chips).** Recent-food chips truncate inside a
  horizontal scroller ("Chicken b…") with no affordance cue at 390px.
- **SUR-07 (FAB over the calorie form).** The floating FAB overlapped form
  fields at W1. The shell FAB was removed in W4, but the W10 rebuild must
  re-verify the form surface and keep in-form actions non-overlapping.

A rendered inspection of the current Form and Diary modes at the W9.5 baseline
also shows structural duplication that W10 must remove rather than restyle:

1. The remaining-kcal fact renders four times (hero title, "Remaining"
   StatBlock, "Goal progress" FeatureStatCard note, consistency caption) and
   the consumed total three times ("Today: N kcal" line, "Consumed"
   StatBlock, donut centre).
2. Three always-visible history sections (365-day trend, macro trends,
   53-week heatmap) plus two FeatureStatCards sit above/below the logging
   surface, so a first-time logger scrolls past analytics to reach the food
   list. Their rolling derivations also run on every refresh even while the
   user is logging.
3. The macro donut repeats the three macro bars it renders beside.
4. Form mode renders entries as flat SwipeableCard rows while Diary renders
   meal-grouped cards: two anatomies for one dataset.
5. Phone tab labels render at 10.5px, below the V3 §9 ≥11px contract.

D3 is decided by measurement, not preference: the parent design's own gate says
that if the Health parent adds a tap on the most common health flows, the
six-tab fallback ships with the visual restyle only.

## What Changes

- **Logging-first Calories hierarchy.** The remaining-calories number becomes
  the single dominant daily indicator; a compact macro summary carries totals
  and targets; meal-grouped entries with immediately accessible edit/delete
  actions replace the flat swipe list and the duplicate diary anatomy; quick
  entry (recent foods, frequent foods, saved meals, manual logging, kcal
  quick-add) sits directly under the summary; all historical trends move
  behind one collapsed "History & insights" disclosure.
- **Duplicate-UI elimination.** One shared hero + macro summary + quick-add +
  meal-grouped log + history disclosure across Form and Diary modes. StatBlock
  trio, macro donut, consistency strip, and the two FeatureStatCards are
  removed from this surface. Doc-copy subtitles are deleted (SYS-06). Rolling
  history derivations are gated on the disclosure being open.
- **Adaptive chips (SYS-18).** Recent/frequent food chips hug their content
  and wrap instead of truncating inside a horizontal scroller.
- **Form-surface verification (SUR-07).** No floating control overlaps any
  input at 360–412px; the form's own primary action stays inside the form.
- **D3 navigation validation gate.** Measure tap depth, discoverability,
  task completion, accessibility and section-switch behavior for "start a
  workout", "log a meal" and "view remaining calories" from equivalent
  starting states, on the shipped five-destination model and on the six-tab
  fallback. Ship whichever model the evidence supports and record the
  comparison, decision and evidence.
- **Records.** W10 gets its own bounded slice plan; the parent campaign plan
  and defect ledger are reconciled with the measured outcome.

## Impact

- `features/calories/*` (screen, form/diary views, entry row anatomy, chips,
  quick add, summary/macro components, history disclosure).
- `app/index.tsx` + `e2e/helpers/*` if the D3 gate ships the six-tab fallback
  (rail labels are a journey-label-parity contract, updated in the same
  commit).
- `e2e/calories*.spec.ts`, `e2e/boundary.spec.ts`, `e2e/a11y*.spec.ts`,
  journey specs whose labels change, and the new W10 regression/audit specs.
- Docs: `docs/ui-ux/15-v3-defect-ledger.md` (W10 verification note),
  `docs/ui-ux/v3-audit/w10/` evidence.
- No `core/db`, sync, backup, portable, Supabase, or notification changes; no
  schema migration; no dependency or security-policy change.
