# W14 — Whole-app UI/UX integrity sweep and convergence

Source: `frontend-v3-w12-w17-integration` at `b1569f0` (W13), which contains W12
`1d54b70` and descends from `1f23da4` = `origin/main`.

Hermetic build: `unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
&& npm run build:e2e` → PASS, 0 Supabase hosts in `dist/`.

## Run manifest

| Field      | Value                                              |
| ---------- | -------------------------------------------------- |
| Source SHA | `b1569f0` (+ the W14 fixes recorded below)         |
| Build      | `npm run build:e2e` (hermetic)                     |
| Server     | `scripts/serve-e2e.js` on `:8086`                  |
| Viewports  | 360, 390, 412, 768, 1024, 1280, 1440               |
| Timezone   | `Asia/Manila` (pinned by `playwright.config.ts`)   |
| Fixtures   | FIRST_RUN, EMPTY, SMALL, TYPICAL, HEAVY, LONG_TEXT |
| Captures   | **247** in `docs/ui-ux/v3-audit/w14/`              |

Instrument commands (all on the integrated build):

```bash
VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w14 \
  E2E_PORT=8086 npx playwright test e2e/visual-audit.spec.ts --project=chromium
VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w14 \
  E2E_PORT=8086 npx playwright test e2e/habits-w7-audit.spec.ts \
    e2e/pomodoro-w8-audit.spec.ts e2e/pomodoro-w85-audit.spec.ts \
    e2e/workout-w9-audit.spec.ts e2e/workout-w95-audit.spec.ts \
    e2e/calories-w10-audit.spec.ts e2e/planning-w11-audit.spec.ts \
    e2e/planning-w12-audit.spec.ts e2e/secondary-surface-w13-audit.spec.ts \
    --project=chromium
E2E_PORT=8086 npx playwright test e2e/a11y.spec.ts --project=chromium
E2E_PORT=8086 npx playwright test --project=chromium
```

## Surface × state coverage

Legend: **I** = inspected, **C** = captured (in the matrix, inspected as part of
a neighbouring class), **—** = not applicable for that surface, **N/R** = not run.

| Surface           | 360 L | 390 L | 412 L | 768 L | 1280 L | 390 D | 1280 D | HEAVY / LONG_TEXT    | ERROR / EMPTY                     | Notes                                    |
| ----------------- | ----- | ----- | ----- | ----- | ------ | ----- | ------ | -------------------- | --------------------------------- | ---------------------------------------- |
| Today / Overview  | I     | I     | C     | I     | I      | I     | C      | EMPTY I              | FIRST_RUN I                       | One hero, neutral glance strip confirmed |
| To Do             | I     | I     | C     | I     | I      | I     | I      | HEAVY I, LONG_TEXT I | EMPTY I                           | Filter/search row hierarchy confirmed    |
| Habits            | C     | I     | —     | I     | I      | I     | —      | —                    | EMPTY I                           | Trend sheet captured                     |
| Focus             | C     | I     | —     | C     | I      | I     | —      | large text **I**     | EMPTY I, RUNNING I, end-confirm I | Pre-existing W8 states intact            |
| Workout           | I     | I     | —     | I     | I      | I     | —      | —                    | EMPTY I                           | Landing/active-session captured          |
| Calories          | I     | I     | —     | I     | I      | I     | I      | over-goal I          | EMPTY I, add I, keyboard I        | Form + Diary modes                       |
| Quick Capture     | —     | I     | —     | —     | —      | —     | —      | Project/Goal chips I | —                                 |                                          |
| Planning Hub      | C     | I     | —     | C     | I      | C     | C      | —                    | EMPTY I (projects/goals)          | Today/Projects/Goals/Progress/Timeline   |
| Weekly Review     | —     | I     | —     | —     | —      | I     | —      | long reflection C    | —                                 | Steps 1–5 + preview                      |
| Progress Insights | I     | I     | C     | I     | I      | I     | —      | —                    | EMPTY I                           |                                          |
| Activity Timeline | I     | I     | C     | I     | I      | I     | —      | —                    | EMPTY I, filtered-empty I         |                                          |
| Settings          | I     | I     | C     | I     | I      | I     | —      | —                    | EMPTY I                           | Top/mid/backup/bottom                    |
| Command Center    | I     | I     | —     | I     | I      | I     | —      | typed I              | —                                 | empty + populated                        |
| Achievements      | I     | I     | —     | I     | I      | I     | —      | —                    | EMPTY I                           | earned + full collection                 |

**Not run / not covered in this wave (explicit):**

- Native Android/iOS rendering — W16 owns it; no device lane was executed here.
- Offline/rejected-write _rendered_ states are covered by the existing
  behavioural specs (`planning-w115-reliability`, `weekly-review` rejected
  write, `calories` failed target write) rather than by a W14 capture; no new
  offline capture was staged.
- The `settings-ripple` Calories-ripple step fails as recorded below; its
  surface was inspected directly through the Calories captures instead.
- Screen-reader announcement quality on a real device — web `aria` assertions
  only (the W13 `aria-pressed` fix); natural device behaviour is a W16 concern.

## W14 defect register

| ID     | Surface                  | Category      | Sev | SHA       | Viewport/theme/state                 | Repro                                                                                                                                      | Capture                                                             | Root cause                                                                                                                                                                                                      | Owner          | Fix                                                                                                                                                               | Test                                                                                               | Status                      |
| ------ | ------------------------ | ------------- | --- | --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------- |
| W14-01 | Settings / Weekly Review | ACCESSIBILITY | P1  | `b1569f0` | 360–1280, both themes, default state | Open Settings; measure the `Details +` control → 32pt. Open Weekly Review → Plan; measure `Options +` → 36pt and the due-date field → 40pt | `w13/after/390-settings-top.png`, `w12/after/390-review-step-3.png` | The W12/W13 disclosure controls were authored with label-sized heights instead of the repo's 44pt interactive contract                                                                                          | W14            | `features/settings/SettingsSharedUi.tsx` (44), `features/weekly-review/WeeklyReviewScreen.tsx` (44/44)                                                            | `tests/uiTouchTargetContract.test.ts` "W14 disclosure controls keep the 44pt touch contract" (8/8) | **VERIFIED-FIXED**          |
| W14-02 | To Do                    | RESPONSIVE    | P2  | `b1569f0` | 360/1280, LONG_TEXT                  | Seed the HEAVY fixture (whose first todo title is 200 `B`s plus one 201-char title) and open To Do                                         | `w14/390-todos-heavy.png`, `w14/1280-todos-heavy.png`               | A 200+ char title legitimately wraps rather than clipping (the W6.5 contract asserts `scrollHeight <= clientHeight`, i.e. wrap-not-clip). At 360 the row grows to ~9 lines and pushes real tasks below the fold | W14 (assessed) | **No change** — wrapping is the deliberate contract; clamping would hide user text and the W6.5 oracle forbids clipping                                           | `e2e/todos-convergence.spec.ts` (unchanged, passing)                                               | **ASSESSED — NOT A DEFECT** |
| W14-03 | Cross-wave               | CONSISTENCY   | —   | `b1569f0` | all                                  | Run every per-wave audit instrument on the integrated build                                                                                | `w14/` (247 captures)                                               | —                                                                                                                                                                                                               | W14            | No defect found: W12 and W13 both render on one build, and the W1-era `390-health.png` reference is historical only (the W10 D3 gate confirmed the six-tab model) | per-wave audits 21/21 + W12 3/3 + W13 5/5                                                          | **NO DEFECT**               |
| W14-04 | Overview                 | HIERARCHY     | P2  | `b1569f0` | 360/390/1280, TYPICAL                | Open Today with the TYPICAL fixture                                                                                                        | `w14/390-overview-populated.png`, `w14/1280-overview.png`           | The `UP NEXT` hero carries `Task 7` with an `Overdue` reason and an `Open To-Do` action; the glance strip is neutral with hue on values only; hierarchy is one hero → glance → plan → rewards                   | W14 (assessed) | **No change** — meets the SYS-11/SYS-03/W5 contract                                                                                                               | `e2e/overview.spec.ts` (passing)                                                                   | **ASSESSED — NOT A DEFECT** |

No untriaged P0/P1 remains.

## Convergence verdict

- The six primary destinations and every secondary surface render correctly on
  the integrated W12+W13 build, in light and dark, at 360/390/412/768/1280.
- One real accessibility defect (W14-01) was reproduced, fixed and pinned with a
  source-contract regression; three further candidates were assessed against the
  existing contracts and found not to be defects (documented with evidence
  rather than silently dropped).
- The pre-existing `settings-ripple` Calories-ripple failure and the documented
  Windows-CRLF ENVIRONMENT failure remain, both reproduced on the pre-W14
  baseline; neither is a W14 regression.
- Screen-reader/native rendering remain out of scope for this wave (W16).

## Verification executed

| Command                                                                      | Result                     |
| ---------------------------------------------------------------------------- | -------------------------- |
| `npx tsc --noEmit`                                                           | 0 errors                   |
| `npx eslint <changed files> --max-warnings 0`                                | 0 errors / 0 warnings      |
| `npx vitest run tests/uiTouchTargetContract.test.ts`                         | 8/8 PASS (2 new W14 cases) |
| `npm run qa:integration`                                                     | 419 passed / 2 skipped     |
| `VISUAL_AUDIT=1 e2e/visual-audit.spec.ts`                                    | 7/7 PASS, 60 captures      |
| per-wave audits (habits-w7 … planning-w11)                                   | 21/21 PASS                 |
| `planning-w12-audit` + `secondary-surface-w13-audit`                         | 8/8 PASS                   |
| `e2e/a11y.spec.ts`                                                           | 10/10 PASS                 |
| **full `--project=chromium` battery**                                        | **245 passed / 0 failed**  |
| `e2e/secondary-surface-w13.spec.ts` + `e2e/weekly-review.spec.ts` (post-fix) | 7/7 PASS                   |
| `npm run openspec:validate`                                                  | PASS                       |
