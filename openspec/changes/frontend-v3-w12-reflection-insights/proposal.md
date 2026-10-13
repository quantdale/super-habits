---
schema: spec-driven
created: 2026-10-14
---

## Why

W11.5.1 closed Planning. Frontend V3 parent tasks §12 owns Weekly Review,
Progress and Activity (`tasks.md` 12.1 narrative-first review, 12.2 reduced
analytics-wall presentation; design.md D4 lists them as one reflection slice).
The live surfaces were built functionally before Calm Momentum and still carry
pre-V3 information architecture:

- `WeeklyReviewScreen.tsx` is a seven-dot wizard (Summary → Insights → Todos →
  Priorities → New Todos → Reflection → Preview → Done) whose Summary step is
  five saturated stat cards (`Todos`, `Habits`, `Focus`, `Workouts`, `Calories`)
  and whose Insights step repeats the same window under `Wins`/`Attention`.
  Five of seven steps are statistics; the user's actual decision work
  (priorities, commitments, reflection) sits behind them.
- `ProgressInsightsView.tsx` renders seven equal-weight metric cards plus a
  Planning card, each with a `•` placeholder instead of an icon and a
  red-down/neutral-flat trend colour applied to every metric regardless of
  meaning (a deliberate rest week renders danger-red).
- `ActivityTimelineView.tsx` stacks 7 source chips + 4 range chips + up to 14
  day chips (25 always-visible controls) above the first real event at 390px,
  and wraps each event in a bordered rounded card with an ornamental icon
  tile.

Ledger defects `SUR-12` (narrative-first rebuild) and `SUR-13`-adjacent
analytics density are open. These three screens are one mental model —
_What happened? What can I learn? What should I do next?_ — and must be rebuilt
together, not restyled independently.

## What Changes

- **Weekly Review** becomes narrative-first: orientation (week + status) →
  factual story → what mattered → decision/action → supporting details →
  history. The seven steps collapse to the decisions that actually persist
  (`Review → Decide → Plan → Reflect → Confirm`) while every existing domain
  count stays reachable behind a labelled details disclosure. No step loses a
  draft, and the canonical review mutation is unchanged.
- **Progress Insights** keeps `buildProgressSummary()`/`buildProgressNarrative()`
  semantics and replaces the seven-card wall with a small ordered set of
  headline comparisons plus one accessible "More details" disclosure holding
  the full metric set, with units/denominators stated and no invented
  percentages or colour-coded "bad" trends.
- **Activity Timeline** replaces the 25-chip default with one Filters
  disclosure (source/range/day) that is keyboard-accessible, persists while
  closed, signals a non-default state and offers reset — and renders flat
  chronological grouped rows instead of bordered per-event cards.
- Both new disclosures use the established V3 disclosure grammar
  (`accessibilityState.expanded` + web `aria-expanded`, as in
  `TodayBriefingView`/Planning Hub) so keyboard/screen-reader behaviour is not
  invented per screen.

## Capabilities

### New Capabilities

- `reflection-insights`: the observable contract of the W12 surfaces — the
  Weekly Review reflection hierarchy and step consolidation, the Progress
  headline-insight-then-details structure with truthful units and deltas, and
  the Activity filter disclosure plus flat timeline row grammar.

### Modified Capabilities

None. Weekly Review persistence, review idempotency, next-week application,
Progress aggregation and the bounded 90-day timeline query keep their
contracts; only presentation and disclosure structure change.

## Impact

- `features/weekly-review/*`, `features/progress/*`, `features/activity/*`
  (presentation only; `.data.ts`/`.domain.ts`/`.summary.ts` unchanged unless a
  reproduced defect requires a tested correction).
- `features/planning-hub/PlanningHubScreen.tsx` (the Progress view's Weekly
  Review entry card copy/hierarchy only).
- `e2e/weekly-review.spec.ts` (step-count change), a new W12 audit spec,
  new/updated unit + real-SQLite regressions.
- Docs: `docs/ui-ux/v3-audit/w12/*`, `docs/ui-ux/15-v3-defect-ledger.md`.
- No `core/db`, sync, backup/restore, portable, Supabase, migration or
  dependency change.
