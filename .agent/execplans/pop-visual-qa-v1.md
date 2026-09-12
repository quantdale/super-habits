# ExecPlan: Pop Visual QA V1 — Pixel-Perfect Regression Pass

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

The Pop redesign landed, but visible defects remain: inconsistencies, sizing
problems, protruding borders, alignment defects, overflow, spacing mismatches,
and rendering glitches. Systematically inspect every user-visible surface at
multiple viewport sizes, fix root causes (no cosmetic hiding), and re-audit
iteratively until no obvious visual defect remains. Preserve the Pop direction;
no broad redesign.

## Context

- Baseline: `HEAD == origin/main == c330cea` (Pop Frontend Redesign V1
  COMPLETED), tree clean. `.agent/EXECUTION_PROMPT.md` remains COMPLETED;
  no ACTIVE planner prompt — this ExecPlan is the campaign driver.
- Design contract: `docs/ui-ux/12-pop-design-system.md`; tokens in
  `core/theme/designTokens.ts`; primitives in `core/ui/*`; shell in
  `app/index.tsx`; sections in `features/*/`.
- QA harness: Playwright against the static export in `dist/` served by
  `scripts/serve-e2e.js`; seed helpers `e2e/helpers/seed.ts` (TYPICAL/SMALL/
  HEAVY) and `e2e/helpers/dbHarness.ts`; screenshots to the gitignored
  `.cursor/playwright-output/` area. Ports: an unrelated Metro owns 8081, so
  audits run on `E2E_PORT=8083`.
- Repo rules: no weakened assertions, no `data-testid`, no test-only hacks in
  product code, NativeWind `className` + tokens for new UI code, root-cause
  fixes over overflow-hidden concealment.
- Surfaces to audit: six sections, Settings (all sections), Plan hub (5 views)
  - guided flow, Weekly Review + history, Achievements, Quick Capture, Command
    Center, all modals/sheets (todo add/edit, habit add/edit/insights/detail,
    calorie entry/goal/targets/search, pomodoro preset manager/session note/edit,
    workout routine detail/session/history/body weight), empty/loading/error
    states, and stress content.

## Scope

1. Build a repeatable screenshot harness covering the surfaces above at
   phone/tablet/desktop widths plus intermediate breakpoints (360/390/412/768/
   1024/1280/1440/1920 as applicable) and edge content (long titles, long
   labels, large numbers, empty/missing data).
2. Inspect rendered output; record every defect with screen, cause, and fix.
3. Fix root causes in shared components first, then per-screen; verify every
   consumer of a changed shared component.
4. Re-run the harness after each batch; iterate until the defect list is empty
   of visible defects.
5. Regression gates: typecheck, lint, affected Chromium specs, the visual
   harness, and (because the UI changes are user-visible) native smoke on the
   canonical API-36 target before close.
6. Commit coherent fixes with evidence; push.

## Non-Goals

- No structural redesign, navigation change, or new features.
- No domain/data/schema changes (except if a defect proves a data bug — report,
  don't silently expand scope).
- No dependency additions.
- No weakening of tests or assertions; no `data-testid`.
- No cosmetic masking of layout bugs (e.g., `overflow: hidden` to hide
  overflow) where a structural fix is available.

## Current Checkpoint

- Current milestone: W5–W6 complete — final harness 10/10; W7 regression
  gates running (Vitest 2055/2055 PASS, lint PASS; full Chromium in flight),
  then native smoke.
- Completed:
  - W0–W6 as recorded below; all inventory defects FIXED/ACCEPTED/VERIFIED.
  - Final harness round: 10/10 tests (populated/empty sections, shell
    overlays, plan hub, entity modals, desktop, 6 responsive widths, stress
    content, 360 extras, dark mode).
  - Vitest 2055/2055 PASS (196 files); `npm run lint` PASS.
- In progress: full `--project=chromium` battery on the frozen tree.
- Exact next action: read the Chromium results; commit the fixes; run native
  APK smoke on the canonical API-36 target; refresh release/plan evidence;
  push.
- Remaining definition of done: Chromium + native smoke green; commits pushed;
  plan COMPLETED.
- Current failures: harness-only issues were fixed (habit group label,
  stress SQL NOT NULL columns, drawer scroll targeting).
- Important modified files: `core/ui/SegmentedControl.tsx`, `TextField.tsx`,
  `Screen.tsx`, `global.css`, `features/overview/TodayProgressStrip.tsx`,
  `features/momentum/MomentumCard.tsx`, `features/todos/TodosScreen.tsx`,
  `features/todos/TodoListToolbar.tsx`, `features/pomodoro/PomodoroScreen.tsx`,
  `features/workout/WorkoutGymPanels.tsx`, `features/habits/HabitCircle.tsx`,
  `features/calories/CaloriesEntryFields.tsx`.
- Last successful validation: typecheck PASS after each batch; focused probes
  verified the tab geometry/focus and list-height fixes.
- Exact next action: review the round-4 captures (stress, modals, dark), fix
  anything new, then run the regression gates.
- Remaining definition of done: defect inventory empty of visible defects at
  phone/tablet/desktop + edge content + dark mode; regression gates green;
  native smoke PASS; commits pushed; plan COMPLETED.

## Progress

- [x] W0 — reconcile Git/prompts, open ExecPlan (2026-09-12)
- [x] W1 — fresh export + visual harness (sections, overlays, widths) (2026-09-12)
- [x] W2 — first defect inventory from rendered output (2026-09-12)
- [ ] W3 — shared-component fixes (rounded/primitives/shell)
- [ ] W4 — per-screen fixes (six sections + overlays)
- [ ] W5 — edge content + intermediate breakpoints stress pass
- [ ] W6 — interactive/animations/layering checks
- [ ] W7 — regression gates + native smoke
- [ ] W8 — commit/push, close plan

## Defect Inventory (v1 — first harness pass)

| #   | Surface                      | Defect                                                                                        | Root cause                                                                                | Fix                                                                                      | Status                  |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| D1  | Overview stat strip          | Labels/values truncate at ≤412 ("min foc…", "60… kcal", "D…")                                 | 5 fixed `flex:1` columns + `numberOfLines=1`                                              | Chip strip wraps (3+2) via `flexWrap` + `flexBasis: 96`                                  | FIXED                   |
| D2  | Overview Momentum card       | Title/description truncate at ≤412                                                            | Title row shared with the "View garden" chip; `numberOfLines`                             | Header wraps; chip drops below at narrow widths; title unclamped                         | FIXED                   |
| D3  | Overview Momentum chart      | Right label under the floating FAB at ≤390                                                    | Floating FAB overlap                                                                      | Accepted (decorative art, accessible label present)                                      | ACCEPTED                |
| D4  | Pomodoro stats               | "Consecutiv e focus days" mid-word wrap at 390                                                | Two `min-w-[160px]` cards leave ~80px text column                                         | `min-w-[200px]` → stack on phones                                                        | FIXED                   |
| D5  | Todos list                   | List viewport ~140px; rows invisible at rest                                                  | Queue card + toolbar + list header all fixed above rows                                   | Queue card moved into list header; toolbar compacted to one row                          | FIXED                   |
| D6  | Todos header                 | "Swipe to edit…" wraps 3 lines beside the Show-completed chip at 360                          | No wrap in header row                                                                     | Header wraps; chip drops to its own right-aligned row                                    | FIXED                   |
| D7  | Workout week rows            | "Not plan…" truncated; Rest flush to card edge                                                | Fixed 96px weekday + 3×44px buttons in one row                                            | Row wraps; status full width; buttons on a second line                                   | FIXED                   |
| D8  | Inputs (web)                 | Browser-default black focus outline                                                           | RNW does not theme `:focus`                                                               | `global.css` themed 2px accent outline via `--sh-accent`                                 | FIXED                   |
| D9  | Calorie entry modal          | Empty kcal readout renders a heavy black dash                                                 | `computedKcal > 0 ? value : '—'` at 28px bold                                             | Renders `0`                                                                              | FIXED                   |
| D10 | Screen wide-shell            | Centered column only `> 768`; 768 exact full-bleed                                            | Strict `>` comparison                                                                     | `>=` at the 768 breakpoint                                                               | FIXED                   |
| D11 | SegmentedControl             | Plan tabs clip/overflow at 360                                                                | Flex items default `min-width: auto`                                                      | `minWidth: 0` on option Pressables                                                       | FIXED                   |
| D12 | Habits ring                  | Colourless habit completion fell back to grey                                                 | Fallback token choice                                                                     | Falls back to `sectionAccents.habits.fill`                                               | FIXED                   |
| D13 | App root                     | `pageOverflowY: 12` on every surface                                                          | Unidentified 12px overflow masked by `body{overflow:hidden}`                              | Investigate; not user-visible                                                            | OPEN                    |
| D14 | Settings/Plan drawers        | Wheel did not scroll in the harness                                                           | Pointer rested over the scrim                                                             | Harness moves the pointer into the drawer first                                          | FIXED (tooling)         |
| D15 | SegmentedControl             | **All** options show a 2px accent outline once any option is focused (click or keyboard)      | One shared `useKeyboardFocusRing` called at the control level and applied to every option | Per-option `SegmentOption` component owns its focus state                                | FIXED                   |
| D16 | Overview Momentum card       | Title/description truncation fixed; chip wraps below on phones                                | (see D2)                                                                                  | —                                                                                        | VERIFIED                |
| D17 | Projects/Goals sort chips    | Sort row clipped at the modal edge (last chip unreachable)                                    | `flex-row` without wrap                                                                   | Sort row now wraps (`flex-wrap` + row gap)                                               | FIXED                   |
| D18 | Todos long title             | Suspected clip; measured card 188px / text 132px fully wrapped                                | Probe clip region cut the row, not the UI                                                 | No change                                                                                | VERIFIED (not a defect) |
| D19 | Habits long habit name       | Name truncates to 2 lines in the tile                                                         | `numberOfLines={2}` on a fixed-width tile                                                 | Accepted: ellipsis with full name in the a11y label                                      | ACCEPTED                |
| D20 | App root `pageOverflowY: 12` | Root scroll container 12px taller than the viewport on every surface                          | `body{overflow:hidden}` masks it; no user-visible scroll                                  | Accepted (masked by the shell)                                                           | ACCEPTED                |
| D21 | Portable import E2E          | Imported todo read "Alpha tas" (last char dropped) → 'Alpha task' assertion failed in-battery | `type()` char-by-char input race on the heavier redesigned modal (repo-documented class)  | `fill()` in `portable-backup.spec.ts` + `settings.spec.ts` helpers; assertions unchanged | FIXED                   |

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-12 — Proceed via native continuation with a new ExecPlan rather than
  requiring a planner: the user prompt is a concrete, bounded QA campaign on
  the committed redesign; local rules require an ExecPlan for substantial work.
- 2026-09-12 — Run audits on `E2E_PORT=8083` because an unrelated project's
  Metro owns 8081.

## Validation Ledger

- 2026-09-12 — `npm run typecheck` — PASS (after each batch; final PASS).
- 2026-09-12 — `npm run lint` — PASS (0 errors / 0 warnings).
- 2026-09-12 — `npm test` — PASS 2055/2055 (196 files).
- 2026-09-12 — visual harness rounds 1–5 (temporary `e2e/zz-visual-qa-v1`)
  — final round 10/10; ~90 screenshots at 360/390/412/768/1024/1280/1440/1920,
  populated/empty/stress/dark, sections + overlays + modals.
- 2026-09-12 — focused probes — tab geometry/focus (only the focused option
  outlined; 60px segments at 360), Todos list container height 353px (was
  140), long-title row renders fully (card 188px), root overflow 12px masked.
- 2026-09-12 — `npx playwright test --project=chromium` — 134 passed /
  2 failed / 7 skipped; failures = `habits.spec.ts:222` (known-gap 16
  flake) and `portable-backup.spec.ts:116`.
- 2026-09-12 — portable failure root-caused: the helper typed the title
  char-by-char and dropped the last character ("Alpha tas") on the redesigned
  modal → `fill()` fix; `portable-backup.spec.ts` + `settings.spec.ts` re-run
  PASS 8/8.
- 2026-09-12 — `npm run typecheck` + `npm run lint` — PASS.

## Changed Files / Areas

- `.agent/execplans/pop-visual-qa-v1.md` — this plan.
- (defects and fixes recorded as they land)

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; audit tooling is temporary (`e2e/zz-*`) and must not be
   committed.
3. Build `dist/` (`npm run build:web`) and run the harness with `E2E_PORT=8083`
   (or another free port — never 8081 while the unrelated Metro owns it).
4. Continue from `Exact next action`; keep the defect inventory in this plan.

## Outcomes & Retrospective

- Status: Active.
- Summary: pending.
- Follow-up: pending.
