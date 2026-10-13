# W12 baseline — Weekly Review / Progress / Activity

Source SHA: `1f23da4defd7fa45c679261e0db5fade1374bbd5` (= `origin/main`,
W11.5.1 closure). Tracked tree clean; foreign untracked
`.tmp-ios36423379932/` and `stash@{0}` preserved untouched.

Build: `npm run build:e2e` (unset `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY`) → hermetic export, Supabase leak guard
reports 0 hosts in `dist/`.

Harness: `VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w12/before
E2E_PORT=8085 npx playwright test e2e/planning-w12-audit.spec.ts
--project=chromium` → 3/3 PASS, 20 captures, TYPICAL fixture (12 todos,
5 habits, 14 completions, 40 calorie entries, 8 pomodoro sessions, 2 routines,
3 workout logs) with the browser clock at the repository-pinned
`Asia/Manila` timezone.

## Entry paths

| Surface           | Route                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| Weekly Review     | Today → `Plan today` → Planning Hub `Progress` tab → `Open weekly review` (overlay) |
| Progress Insights | Today → `Plan today` → Planning Hub `Progress` tab (below `Momentum Garden`)        |
| Activity Timeline | Today → `Plan today` → Planning Hub `Timeline` tab                                  |

## Measured baseline observations (360/390/412/768/1280, light + dark)

### Timeline (`390-timeline-top.png`) — the clearest defect

- **25 always-visible filter controls** render before the first event: 7 source
  chips (All, Todos, Habits, Focus, Workout, Calories, Planning) + 4 range chips
  (7d, 30d, 90d, All) + `All days` + **13 date chips**. The first event row is
  entirely below a 844px viewport; `Today` (the first group header) is the last
  visible line at y≈830.
- Date chips are exhausted down to `2026-09-30` while the screen has not yet
  shown a single activity. The date-chip row is the single largest consumer of
  first-fold space.
- All 25 controls are visually identical pill chips at three different hues
  (blue/purple/green), so the chip wall also carries no hierarchy.

### Progress (`390-progress-top.png`, `390-progress-bottom.png`)

- First fold is consumed by the Weekly Review entry card (a `header` variant
  Card with a subtitle documenting the feature) and the Momentum Garden
  section; `Progress Insights` itself begins below the fold.
- Progress renders the narrative card, then **7 equal-weight metric cards**
  (`Tasks completed`, `Habit completions`, `Focus minutes`, `Focus sessions`,
  `Workouts`, `Calorie days`, `Weekly reviews`) each with a literal `•` glyph
  in place of an icon, then a separate `Planning` card with 4 more lines.
- `trendOf()` colours every decrease `tokens.dangerSolid` and every increase
  the Habits green — calorie days, focus minutes and reviews all share the
  same "down is red" reading, which is wrong for a deliberate rest week.
- Seven cards at `flex-1` inside a wrapping row mean the card widths are
  uneven at 390 and the grid reads as a wall rather than a ranked set.

### Weekly Review (`390-review-step-1.png` … `390-review-step-6.png`)

- Modal chrome title `Weekly Review` and the content header `Weekly Review`
  render the same string twice within ~100px.
- `Past reviews` is rendered as a chip directly under the duplicate title and
  is present on every step.
- The step indicator is **7 unlabelled dots**; nothing states which step or how
  many remain.
- Step 1 (`Summary`) is five statistic cards — `Todos`, `Habits`, `Focus`,
  `Workouts`, `Calories` — and the first content is a number, not the week's
  story. `Consistency 0%` renders for the TYPICAL fixture where only some
  habits are scheduled.
- Step 2 (`Insights`) repeats the same window: `Wins` (2 rows) and `Attention`
  (**6 rows**, 5 of them the same `Habit N: No completions this week`
  sentence). `0% habit consistency — room to improve` is evaluative copy, and
  the five per-habit repeats are the same fact five times.
- Seven steps require seven `Next` taps before the user reaches a decision
  (`Todos`, `Priorities`, `New Todos`) — four of the seven are read-only
  statistics/information.

## Defect register (baseline)

| ID     | Surface  | Class        | Sev | Evidence                      | Problem                                                               | Correction                                                        |
| ------ | -------- | ------------ | --- | ----------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| W12-01 | Timeline | DENSITY      | S2  | `390-timeline-top.png`        | 25 filter controls before the first event; first event below the fold | One collapsed `Filters` disclosure with a selection summary       |
| W12-02 | Timeline | HIERARCHY    | S2  | `390-timeline-top.png`        | Source/range/day chips share one visual weight and three hues         | Filter disclosure + flat chronological rows                       |
| W12-03 | Progress | DENSITY      | S2  | `390-progress-top/bottom.png` | 7 equal-weight metric cards + a 4-line Planning card                  | Ranked headline rows + one `More details` disclosure              |
| W12-04 | Progress | VISUAL_TASTE | S3  | `390-progress-bottom.png`     | Every metric card leads with a literal `•` glyph                      | Icon removed; label leads the row                                 |
| W12-05 | Progress | PRODUCT_UX   | S2  | `390-progress-bottom.png`     | Every decrease is danger-red (calorie days, reviews, focus)           | Numeric statement only, no danger colouring                       |
| W12-06 | Review   | HIERARCHY    | S2  | `390-review-step-1.png`       | Title duplicated in chrome + content; 7 unlabelled dots               | Single header; labelled `Step n of 5 · Name`                      |
| W12-07 | Review   | DENSITY      | S2  | `390-review-step-1/2.png`     | 4 of 7 steps are read-only statistics before any decision             | `review` step leads with narrative; numbers behind one disclosure |
| W12-08 | Review   | PRODUCT_UX   | S2  | `390-review-step-2.png`       | `0% habit consistency — room to improve` is evaluative                | Numeric fact only; `Not tracked` when nothing was scheduled       |
| W12-09 | Review   | DENSITY      | S3  | `390-review-step-2.png`       | 5 identical `Habit N: No completions this week` attention rows        | One aggregated line naming the count                              |

## Preserved expectations (must not change)

- `saveWeeklyReview` writes exactly one row per `week_key`; `status`
  `completed`; one coalesced `sync_outbox` intent per entity/id.
- `executeWeeklyReview` idempotency (commitment receipts, soft-deleted receipt
  re-creation, reschedule idempotency).
- `applyNextWeekPlanSuggestions` remains a separate explicit action with
  added/skipped/truncated/failed reporting.
- `deleteWeeklyReview` soft-deletes only the review; source todos/habits/
  workouts/calorie entries are untouched.
- `buildProgressSummary()`/`buildProgressNarrative()` derivation and
  `PROGRESS_WINDOW_OPTIONS` (7/30/90).
- The bounded 90-day `buildActivityTimeline({ days: 90 })` query and every
  `SOURCE_FILTER_SOURCES` mapping.
- `getReviewWeek()` Monday-start local-calendar weeks and `toDateKey()`.
