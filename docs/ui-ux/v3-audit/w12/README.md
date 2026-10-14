# W12 — Weekly Review / Progress / Activity: rendered evidence and defect register

Source: branch `frontend-v3-w12-w17-integration` (descends from
`1f23da4defd7fa45c679261e0db5fade1374bbd5` = `origin/main` = W11.5.1 closure).

Hermetic build: `unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
&& npm run build:e2e` → PASS, Supabase leak guard reports 0 hosts in `dist/`.

Capture command (both states):

```bash
VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w12/before \
  E2E_PORT=8086 npx playwright test e2e/planning-w12-audit.spec.ts --project=chromium
VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w12/after \
  E2E_PORT=8086 npx playwright test e2e/planning-w12-audit.spec.ts --project=chromium
```

Fixture: `TYPICAL` (12 todos, 5 habits, 14 completions, 40 calorie entries,
8 pomodoro sessions, 2 routines, 3 workout logs). Browser clock pinned to
`Asia/Manila` by `playwright.config.ts`.

## Captures

`before/` and `after/` each hold 20 images: `390-{progress-top,progress-bottom,
timeline-top,review-step-1..6,review-preview}`, `390-dark-{progress,timeline,
review}`, `390-{progress,timeline}-empty`, and `{360,412,768,1280}-{progress,
timeline}`.

## Measured change

| Metric                                                         | Before                                                        | After                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Always-visible Timeline filter controls before the first event | **25** (7 source + 4 range + 14 day chips)                    | **1** (`Filters +`)                                                  |
| Timeline events visible in a 390×844 first fold                | **0** (first event below fold; `Today` group header at y≈830) | **6** across two day groups                                          |
| Weekly Review steps before a decision can be made              | **4 of 7** (Summary, Insights read-only)                      | **1 of 5** (`Review`, read-only; `Decide` is next)                   |
| Weekly Review unlabelled step dots                             | **7**                                                         | **0** (`Step n of 5 · Name`)                                         |
| Progress metric cards visible by default                       | **7 + 4 planning lines**                                      | **3 headlines**; 4 metrics + planning behind `More details`          |
| Time-to-first-Progress-content in the hub                      | below `Momentum Garden` + Weekly Review entry                 | Progress leads the view                                              |
| Duplicate `Weekly Review` heading in one viewport              | **2** (modal chrome + content)                                | **1** (modal chrome)                                                 |
| Duplicate per-habit `No completions this week` attention rows  | **5**                                                         | **0** (one aggregated line: `4 habits had no completions this week`) |

Before-state observations and the full initial defect register are in
`baseline.md`. All numbers above were read from
`before/390-timeline-top.png`, `before/390-review-step-1.png`,
`before/390-review-step-2.png` and their `after/` counterparts.

## Defect register (W12)

| ID     | Surface  | Class        | Sev | Cause                                                                                               | Fix                                                                                          | Retest                                                                                                         | Screenshot                      |
| ------ | -------- | ------------ | --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| W12-01 | Timeline | DENSITY      | S2  | Source/range/day chips rendered unconditionally above the feed                                      | One collapsed `Filters` disclosure; selection summarised in text                             | `e2e/planning-w12.spec.ts` "shows events before a collapsed Filters control"                                   | `after/390-timeline-top.png`    |
| W12-02 | Timeline | HIERARCHY    | S2  | Three chip rows at three hues carried equal weight                                                  | Disclosure + flat rows + `SectionLabel`-style day headers                                    | same spec                                                                                                      | `after/390-timeline-top.png`    |
| W12-03 | Progress | DENSITY      | S2  | Seven equal-weight cards + a 4-line Planning card always visible                                    | 3 headline rows + one `More details` disclosure                                              | `e2e/planning-w12.spec.ts` "leads with headline observations and discloses the rest"                           | `after/390-progress-top.png`    |
| W12-04 | Progress | VISUAL_TASTE | S3  | Literal `•` glyph rendered in place of every card icon                                              | Icon removed; label leads the row                                                            | same spec (row grammar)                                                                                        | `after/390-progress-top.png`    |
| W12-05 | Progress | PRODUCT_UX   | S2  | `trendOf()` painted every decrease danger-red (calories, reviews, focus alike)                      | Colour removed; change stated numerically                                                    | existing `tests/progress.test.ts` (domain unchanged) + inspected after-capture                                 | `after/390-progress-top.png`    |
| W12-06 | Review   | HIERARCHY    | S2  | Modal chrome title + content header both said `Weekly Review`; 7 unlabelled dots                    | Single header; labelled `Step n of 5 · Name`                                                 | `e2e/weekly-review.spec.ts` (guided flow asserts `Step 1..5 of 5`)                                             | `after/390-review-step-1.png`   |
| W12-07 | Review   | DENSITY      | S2  | 4 of 7 steps were read-only statistics before any decision                                          | `review` step leads with narrative; all counts behind `All numbers`                          | `e2e/weekly-review.spec.ts` (`Show all numbers` → `aria-expanded`)                                             | `after/390-review-step-1.png`   |
| W12-08 | Review   | PRODUCT_UX   | S2  | `0% habit consistency — room to improve` graded a deliberate rest week                              | Numeric fact only; `Not tracked` when nothing was scheduled                                  | `tests/weeklyReview.domain.test.ts` "states habit consistency as a fact with no evaluative verdict"            | `after/390-review-step-1.png`   |
| W12-09 | Review   | DENSITY      | S3  | Five identical per-habit `No completions this week` rows                                            | One aggregated line naming the count                                                         | `tests/weeklyReview.domain.test.ts` "aggregates per-habit no-completion attention"                             | `after/390-review-step-1.png`   |
| W12-10 | Review   | PRODUCT_UX   | S2  | An under-goal calorie average was reported as a win ("within range of…")                            | Off-goal on either side reads as an arithmetic fact under Attention; silent inside ±200 kcal | `tests/weeklyReview.domain.test.ts` "reports an off-goal calorie average on either side"                       | `after/390-review-step-1.png`   |
| W12-11 | Progress | PRODUCT_UX   | P1  | A rejected review write could not be distinguished from a saved one (no failure path in the screen) | `saveError` state; completion step is only reached after `executeWeeklyReview` resolves      | `e2e/weekly-review.spec.ts` rejected-write regression + `tests/integration/weeklyReviewW12Persistence.test.ts` | n/a (no success state rendered) |

`SUR-12` ("narrative-first rebuild") in `docs/ui-ux/15-v3-defect-ledger.md` is
marked **VERIFIED-FIXED (W12)**.

## Verification executed

| Command                                                                                                                                                            | Result                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                                                                 | 0 errors                                                                                                                                                             |
| `npx eslint <changed files> --max-warnings 0`                                                                                                                      | 0 errors / 0 warnings                                                                                                                                                |
| `npm run qa:fast`                                                                                                                                                  | 2,269 passed / 1 failed — the documented Windows-CRLF `agentDocConsistency` ENVIRONMENT residual, reproduced identically on pristine `HEAD` with all changes stashed |
| `npm run qa:integration`                                                                                                                                           | 419 passed / 2 skipped (includes the new 3/3 `weeklyReviewW12Persistence`)                                                                                           |
| `npm run qa:timezones`                                                                                                                                             | 105 passed across Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati                                                                           |
| `npx vitest run tests/weeklyReview.domain.test.ts tests/progress.test.ts tests/activityTimeline.test.ts`                                                           | 89 passed (incl. 7 new W12 insight-wording cases)                                                                                                                    |
| `E2E_PORT=8086 npx playwright test e2e/planning-w12.spec.ts`                                                                                                       | 5/5 PASS                                                                                                                                                             |
| `E2E_PORT=8086 npx playwright test e2e/weekly-review.spec.ts`                                                                                                      | 2/2 PASS (guided flow + rejected write)                                                                                                                              |
| `E2E_PORT=8086 npx playwright test e2e/planning-hub.spec.ts`                                                                                                       | 4/4 PASS                                                                                                                                                             |
| `E2E_PORT=8086 npx playwright test e2e/planning-w11.spec.ts e2e/momentum-garden.spec.ts e2e/planning-w115-reliability.spec.ts e2e/planning-w1151-timezone.spec.ts` | 19/19 PASS                                                                                                                                                           |
| `E2E_PORT=8086 npm run e2e:journeys:p0`                                                                                                                            | 25/25 PASS                                                                                                                                                           |
| `VISUAL_AUDIT=1 … e2e/planning-w12-audit.spec.ts`                                                                                                                  | 3/3 before PASS, 3/3 after PASS                                                                                                                                      |
| `npm run openspec:validate`                                                                                                                                        | 81/81 PASS                                                                                                                                                           |
| `npm run agent:plan:validate:all`                                                                                                                                  | PASS (incl. the new W12 slice and master plan)                                                                                                                       |

## Preserved contracts (verified unchanged)

- `saveWeeklyReview` writes exactly one row per `week_key`; `status`
  `completed`; the outbox intent coalesces per entity/id
  (`create` → `update` → `delete`).
- `executeWeeklyReview` idempotency and `applyNextWeekPlanSuggestions`
  structured outcomes: `tests/integration/weeklyReviewExecutor.test.ts` 8/8
  unchanged and still passing.
- `deleteWeeklyReview` soft-deletes only the review; source todos, habits,
  workouts and calorie entries are untouched (asserted in the guided-flow
  spec).
- `buildProgressSummary`/`buildProgressNarrative` semantics and
  `PROGRESS_WINDOW_OPTIONS` (7/30/90) unchanged; `progress.data.ts` untouched.
- The bounded 90-day `buildActivityTimeline({ days: 90 })` query and every
  `SOURCE_FILTER_SOURCES` mapping unchanged; `activityTimeline.domain.ts`
  untouched.

## Not covered / limitations

- The review screen's `All numbers` disclosure is asserted through the
  Playwright DOM `aria-expanded` attribute; no native screen-reader pass was
  run (that is W16's scope).
- The visual instrument never asserts pixels; W15 owns persistent snapshot
  baselines.
- No performance budget was re-measured for the Timeline at HEAVY scale in
  this wave; the bounded query is unchanged and W14 covers the HEAVY matrix.
