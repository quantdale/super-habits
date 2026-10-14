# ExecPlan: W12 — Weekly Review / Progress / Activity (narrative-led reflection)

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Make the three reflection surfaces answer their own question before they show
numbers: Weekly Review becomes _what happened → what mattered → what I decide_,
Progress becomes _what changed and by how much_, Activity becomes _what actually
happened, when_. Implemented and evidenced, not restyled. Closes parent tasks
`12.1` (narrative-first review, SUR-12) and `12.2` (reduced analytics wall).

## Context

- Baseline HEAD `1f23da4defd7fa45c679261e0db5fade1374bbd5` = `origin/main`
  (W11.5.1 closure). Branch `frontend-v3-w12-w17-integration`.
- Parent change `openspec/changes/frontend-v3-calm-momentum/` (D4 ownership,
  tasks §12). Design authority `docs/ui-ux/13-calm-momentum-design-system.md`;
  references `docs/ui-ux/14-v3-reference-ledger.md`; defect `SUR-12` in
  `docs/ui-ux/15-v3-defect-ledger.md`.
- Slice: `openspec/changes/frontend-v3-w12-reflection-insights/`
  (proposal, design D12.1–D12.6, spec `reflection-insights`, tasks).
- Owned modules (read in full during discovery):
  `features/weekly-review/{WeeklyReviewScreen.tsx, ReviewHistoryView.tsx,
weeklyReview.domain.ts, weeklyReview.summary.ts, weeklyReview.executor.ts,
weeklyReview.data.ts, weeklyReview.applyNextWeek.ts, weeklyReview.types.ts}`,
  `features/progress/{ProgressInsightsView.tsx, progress.domain.ts,
progress.summary.ts, progress.types.ts, progress.narrative.ts, progress.data.ts}`,
  `features/activity/{ActivityTimelineView.tsx, activityTimeline.domain.ts,
activityTimeline.data.ts, activityTimeline.types.ts}`.
- Entry points: `features/planning-hub/PlanningHubScreen.tsx` renders
  `ProgressInsightsView` + `MomentumDetailView` under the `progress` tab and
  `ActivityTimelineView` under the `timeline` tab; `app/index.tsx` renders
  `WeeklyReviewScreen` as the `weeklyReview` overlay opened by
  `openWeeklyReview` from the hub's Progress card and from Today.
- Existing coverage: `e2e/weekly-review.spec.ts` (1 journey with SQLite +
  outbox oracles), `tests/weeklyReview.domain.test.ts`,
  `tests/progress.test.ts`, `tests/activityTimeline.test.ts`,
  `tests/integration/{weeklyReviewSummary,weeklyReviewExecutor,progressData,
activityTimelineData}.test.ts`.
- Inherited residuals: two dependency advisories (hosted audit red only),
  Windows-CRLF ENVIRONMENT failure, D14 host-load headroom, Focus notification
  timestamp. Not addressed here.

## Scope

- Presentation + disclosure structure + narrative wording of the three surfaces.
- Regression updates needed by the changed step count and new disclosures.
- New rendered evidence under `docs/ui-ux/v3-audit/w12/`.

## Non-Goals

- No change to `weeklyReview.data.ts` semantics, `executeWeeklyReview`
  idempotency, `applyNextWeekPlanSuggestions`, `progress.data.ts` aggregation,
  `activityTimeline.data.ts` 90-day bounded query, or any `core/*` module.
- No migration, schema, dependency, security-policy or Supabase change.
- No new chart library and no invented chart for two aggregated windows.
- No W13+ work in this slice.

## Current Checkpoint

- Current milestone: C2 — W12 implemented, tested, evidenced and reviewed; pending commit/publication.
- Completed: master ExecPlan; W12 slice (proposal/design/spec/tasks); live baseline audit + `baseline.md`; design lock; Activity Timeline filter disclosure + flat rows; Progress headline/disclosure model; Weekly Review five-step narrative-first model; insight-wording corrections; all W12 regressions and real-SQLite oracles; before/after rendered evidence inspected.
- In progress: final plan/ledger reconciliation and the W12 commit.
- Important modified files: `features/weekly-review/WeeklyReviewScreen.tsx`, `features/weekly-review/weeklyReview.domain.ts`, `features/progress/ProgressInsightsView.tsx`, `features/activity/ActivityTimelineView.tsx`, `features/planning-hub/PlanningHubScreen.tsx`, `e2e/weekly-review.spec.ts`, `e2e/planning-hub.spec.ts`, new `e2e/planning-w12.spec.ts`, new `e2e/planning-w12-audit.spec.ts`, new `tests/integration/weeklyReviewW12Persistence.test.ts`, `tests/weeklyReview.domain.test.ts`, `docs/ui-ux/v3-audit/w12/**`, `docs/testing/known-gaps.md`, `docs/ui-ux/15-v3-defect-ledger.md`.
- Last successful validation: typecheck 0; eslint 0/0 on changed files; `qa:fast` 2,269 pass / 1 (documented CRLF residual, identical on pristine HEAD); `qa:integration` 419 pass / 2 skip; `qa:timezones` 105 pass; new Vitest +7 cases; `e2e/planning-w12` 5/5; `e2e/weekly-review` 2/2; `e2e/planning-hub` 4/4; adjacent planning/momentum 19/19; P0 journeys 25/25; audit 3/3 before + 3/3 after; OpenSpec 81/81; plans PASS.
- Current failures: the inherited Windows-CRLF `agentDocConsistency` ENVIRONMENT residual only (proven identical on pristine `HEAD`).
- Relevant quarantines: None added; new audit spec registered as known-gap entry 24 sibling.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete. Commit the W12 slice and begin W13 (Settings / Command Center / Achievements design lock + reconstruction).
- Remaining definition of done: W12 commit/publication; then W13–W17.

## Progress

- [x] 1.3 Slice authored (proposal, design, spec, tasks, this plan)
- [x] 3.1 Design lock written (design.md D12.1–D12.6)
- [x] 2.1/2.2 Before-capture + `baseline.md`
- [x] 4.x Weekly Review reconstruction
- [x] 5.x Progress Insights reconstruction
- [x] 6.x Activity Timeline reconstruction
- [x] 7.x Regressions and oracles
- [x] 8.x Validation, review, evidence, publication

## Surprises & Discoveries

- 2026-10-14 — `ProgressInsightsView` renders a literal `•` glyph where an icon
  belongs (`<Text style={{ fontSize: 18 }}>•</Text>` inside `cards.map`), so
  every one of the seven cards leads with the same placeholder dot. The
  `MaterialIcons` import is only used for the trend arrow.
- 2026-10-14 — `WeeklyReviewScreen`'s Insights step re-derives the same counts
  the Summary step already rendered as cards; combining them removes a tap
  without removing information.
- 2026-10-14 — `generateInsights()` is pure and unit-tested; the evaluative
  wording lives there, not in the screen, so the wording correction is a
  domain-level change with its own unit coverage.

## Decision Log

- 2026-10-14 — Five steps (`review/decide/plan/reflect/confirm`) rather than
  the five-step-per-campaign-wording `Review → Decide → Plan → Reflect →
Confirm`; the campaign's own wording is the target model and the current
  seven steps compress into it without losing a draft or a guarantee.
- 2026-10-14 — Keep `generateInsights()` as the insight authority and correct
  its wording rather than building a second narrative source.
- 2026-10-14 — No chart for Progress: two aggregated windows compare as two
  labelled values (brief §W12.B.6).

## Validation Ledger

- 2026-10-14 — `npm run build:e2e` — PASS — hermetic export, 0 Supabase hosts.
- 2026-10-14 — `npx tsc --noEmit` — PASS — 0 errors.
- 2026-10-14 — `npx eslint <changed files> --max-warnings 0` — PASS — 0/0.
- 2026-10-14 — `npx vitest run tests/weeklyReview.domain.test.ts tests/progress.test.ts tests/activityTimeline.test.ts` — PASS — 89 tests (7 new W12 insight-wording cases).
- 2026-10-14 — `npm run qa:integration` — PASS — 419 passed / 2 skipped; new `tests/integration/weeklyReviewW12Persistence.test.ts` 3/3.
- 2026-10-14 — `npm run qa:timezones` — PASS — 105 tests across 5 zones.
- 2026-10-14 — `npm run qa:fast` — FAIL — 2,269 passed / 1 failed; the only failure is `tests/agentDocConsistency.test.ts` (Windows-CRLF register parsing), reproduced identically on pristine `HEAD` with all W12 changes stashed → ENVIRONMENT residual, not a W12 regression.
- 2026-10-14 — `E2E_PORT=8086 npx playwright test e2e/planning-w12.spec.ts --project=chromium` — PASS — 5/5.
- 2026-10-14 — `E2E_PORT=8086 npx playwright test e2e/weekly-review.spec.ts --project=chromium` — PASS — 2/2 (guided flow with SQLite/outbox oracles + rejected-write regression).
- 2026-10-14 — `E2E_PORT=8086 npx playwright test e2e/planning-hub.spec.ts --project=chromium` — PASS — 4/4.
- 2026-10-14 — `E2E_PORT=8086 npx playwright test e2e/planning-w11.spec.ts e2e/momentum-garden.spec.ts e2e/planning-w115-reliability.spec.ts e2e/planning-w1151-timezone.spec.ts --project=chromium` — PASS — 19/19.
- 2026-10-14 — `E2E_PORT=8086 npm run e2e:journeys:p0` — PASS — 25/25.
- 2026-10-14 — `VISUAL_AUDIT=1 … e2e/planning-w12-audit.spec.ts` — PASS — 3/3 before (20 captures) and 3/3 after (20 captures).
- 2026-10-14 — `npm run openspec:validate` — PASS — 81/81.
- 2026-10-14 — `npm run agent:plan:validate:all` — PASS.

## Changed Files / Areas

- `features/weekly-review/WeeklyReviewScreen.tsx` — step model, narrative-first
  review step, labelled indicator.
- `features/weekly-review/weeklyReview.domain.ts` — insight wording.
- `features/progress/ProgressInsightsView.tsx` — headline + details model.
- `features/activity/ActivityTimelineView.tsx` — filter disclosure + flat rows.
- `e2e/weekly-review.spec.ts`, `e2e/planning-w12-audit.spec.ts`,
  `tests/weeklyReview.domain.test.ts` (+ new focused specs).
- `docs/ui-ux/v3-audit/w12/`, `docs/ui-ux/15-v3-defect-ledger.md`.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, the master plan, then this file.
2. `git status --short`, `git diff --stat`, `git diff --name-only`.
3. `npm run agent:resume -- --plan openspec/changes/frontend-v3-w12-reflection-insights/execplan.md`.
4. `npm run qa:affected`.
5. Reconcile with Git and the rendered state, update the checkpoint, resume from
   `Exact next action`.

## Outcomes & Retrospective

- Status: Completed.
- Summary: W12 reconstructed Weekly Review, Progress and Activity as narrative-first surfaces: the seven-step wizard became `Review → Decide → Plan → Reflect → Confirm` with a labelled step indicator and every domain count behind one `All numbers` disclosure, evaluative insight wording was replaced by numeric facts, Progress moved to ranked headlines behind one `More details` disclosure, and the Activity timeline replaced 25 always-visible chips with one `Filters` control and flat chronological rows.
- Follow-up: None. SUR-12 VERIFIED-FIXED; evidence in docs/ui-ux/v3-audit/w12/.
