Plan-Version: 2
Status: COMPLETED

# Weekly Review focus return (CG-13 slice)

## Purpose / User Outcome

A keyboard-only user who opens the Weekly Review from the Planning Hub
(Progress → `Open weekly review`) and dismisses it with `Escape` must land back
on a real control (§5.7 / WCAG 2.4.7). Measured before the fix:
`document.activeElement === BODY`.

## Context

- Gate: `e2e/v2-keyboard-focus.spec.ts`, case "the Weekly Review returns focus to
  a control when it is dismissed", previously `test.fixme`.
- Register: `docs/testing/known-gaps.md` CG-13, "Weekly Review focus return" row.
- Mechanism the other overlays use: React Native Web's `Modal` focus trap
  (`node_modules/react-native-web/dist/exports/Modal/ModalFocusTrap.js`)
  snapshots `document.activeElement` at mount and refocuses that same node on
  unmount while it is still `document.contains(...)`.
- Root cause: `openWeeklyReview` (`core/providers/NavigationProvider.tsx`)
  dismisses the Planning Hub in the same commit, so the review's invoker
  (`Open weekly review`) is unmounted and RN-Web's restore finds nothing.
- Measured with a throwaway probe: the hub-opening control (`Plan today`) is
  focused during the click that opens the hub, stays connected and focusable,
  and the review's dialog is gone ~20ms after `Escape` while `activeElement` is
  already `BODY`.

## Scope

`core/providers/NavigationProvider.tsx`, new
`core/providers/weeklyReviewFocusReturn.ts`, `e2e/v2-keyboard-focus.spec.ts`
(un-fixme only), `docs/testing/known-gaps.md` (row + one sentence), new
`tests/weeklyReviewFocusReturn.test.ts`.

## Non-Goals

Not touching the other CG-13 rows (Space activation, offscreen tab stops, To Do
checkbox), `app/index.tsx`, the review's own focus trap / Escape / routes /
strings, or any golden.

## Current Checkpoint

- Current milestone: implementation, register/doc edit, and every required gate
  are complete.
- Completed: reproduced the defect by un-quarantining the case on the pre-fix
  source; measured the opener with a throwaway probe; implemented the record /
  restore path; extracted the pure helpers; added unit coverage; un-fixme'd the
  case; removed the CG-13 table row and noted the release.
- In progress: none.
- Modified files: `core/providers/NavigationProvider.tsx`,
  `core/providers/weeklyReviewFocusReturn.ts` (new),
  `e2e/v2-keyboard-focus.spec.ts` (un-fixme only),
  `docs/testing/known-gaps.md` (CG-13 row + one sentence),
  `tests/weeklyReviewFocusReturn.test.ts` (new).
- Last successful validation: `npx vitest run` 5043 passed / 2 skipped;
  `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `prettier --check` on all
  touched files clean; `node scripts/quarantine-register-parity.mjs` OK;
  `v2-keyboard-focus.spec.ts` 7 passed / 3 skipped (the other CG-13 fixmes);
  a11y + navigation-history 20 passed; planning/weekly-review/overlay/v2 surface
  specs 69 + 8 passed; journeys 13 passed.
- Current failures: none.
- Relevant quarantines: the other three CG-13 cases (offscreen tab stops, Space
  on tab-shaped controls, To Do completion checkbox) remain `test.fixme` by
  design — this slice releases only the Weekly Review focus-return case.
- Blockers: none.
- Exact next action: None — task complete; the parent reviews, commits, pushes,
  opens the draft PR and requests Codex.
- Remaining definition of done: complete — focus returns to a real control at
  390x844 in light and dark, no golden changes, and every other overlay's focus
  return is unchanged.

## Progress

- [x] Read AGENTS.md, the CG-13 entry, and the quarantined case.
- [x] Reproduce the failure on the pre-fix source (un-fixme temporarily).
- [x] Find and reuse the overlays' existing focus-return mechanism.
- [x] Implement record/restore in the NavigationProvider + helper module.
- [x] Unit-test the opener/fallback/stray-focus logic.
- [x] Un-fixme the case (body/thresholds/surface set untouched).
- [x] Edit only the CG-13 table row + one sentence in known-gaps.
- [x] Run the required E2E, unit/integration, tsc, lint, prettier, parity gates.

## Surprises & Discoveries

- The other overlays need no code: React Native Web's `Modal` focus trap already
  snapshots and restores the opening node — but only while that node is still in
  the document, which is exactly what the hub-opened review breaks.
- Measured with a throwaway probe: `Plan today` is focused during the click that
  opens the hub, and the review's dialog is gone ~20ms after `Escape` while
  `document.activeElement` has already fallen to `BODY`. RN-Web's restore had
  nothing to focus because the hub (and its `Open weekly review` control)
  unmounted in the same commit.
- `react-refresh/only-export-components` forbids exporting plain functions from
  the provider module, so the helpers live in
  `core/providers/weeklyReviewFocusReturn.ts` — the same shape as its sibling
  `core/providers/historyMirror.ts`.
- No golden can change: every golden that involves the Weekly Review is captured
  while the review is open, never after a dismissal.

## Decision Log

- Reuse RN-Web's node-identity restore instead of a parallel focus system: record
  the control that opened the hub chain, re-assert it once the review's dialog
  is gone. Precedent for the sibling helper module: `core/providers/historyMirror.ts`
  (also required by `react-refresh/only-export-components`).
- Return target: `Plan today` (the control that opened the hub chain); fallback
  when the opener is gone: the selected section rail destination; never `<body>`,
  never a removed node, never a throw (`weeklyReviewFocusTarget` returns `null`).
- The restore only competes while focus is strayed (page root or a removed
  node), so it can never steal focus the user has reached since. Paths with no
  recorded opener (Overview's wide-layout `Open weekly review`) are left entirely
  to RN-Web's existing restore, which already worked.
- `weeklyReviewOpenerRef` is cleared by `closePlanningHub` and by
  `openAchievements` (both dismiss the hub) so an independently opened review can
  never return focus to a stale control.

## Validation Ledger

- Failing-before (un-quarantined case on the pre-fix source): `toBeFocused` on
  `Plan today` reported "Received: inactive" — 1 failed, so the case reproduced.
- `npx playwright test --project=chromium e2e/v2-keyboard-focus.spec.ts` —
  pass: 7 passed, 3 skipped (the other CG-13 fixmes), 0 failed. The un-fixme'd
  case passes at 390x844 in light and dark.
- `npx playwright test --project=chromium e2e/planning-hub.spec.ts
e2e/weekly-review.spec.ts e2e/weekly-review-carry-forward-cap.spec.ts
e2e/planning-w11-audit.spec.ts e2e/planning-w12-audit.spec.ts` — pass:
  8 passed, 4 skipped (opt-in `VISUAL_AUDIT=1` evidence specs).
- `npx playwright test --project=chromium e2e/a11y.spec.ts
e2e/navigation-history.spec.ts` — pass: 20 passed.
- `npx playwright test --project=chromium` over `v2-responsive-sweep`,
  `planning-v2-surfaces`, `v2-surfaces-aa`, `secondary-surfaces-p21b`,
  `planning-w11`, `planning-w12`, `planning-w115-reliability`,
  `planning-write-failure`, `dailyplan-read-failure`,
  `goals-projects-write-failure`, `projects-goals-lifecycle`,
  `projects-status-back-race` — pass: 69 passed, 2 skipped.
- `npx playwright test --project=journeys e2e/journeys/settings-ripple.spec.ts
e2e/journeys/three-months-in.spec.ts` — pass: 13 passed.
- `npx vitest run` — pass: 5043 passed, 2 skipped across 303 files.
- `npx tsc --noEmit` — pass: exit 0, no errors.
- `npm run lint` — pass: exit 0 with `--max-warnings 0`.
- `npx prettier --check` on every touched file — pass, all clean.
- `node scripts/quarantine-register-parity.mjs` — pass: OK, 28 gate files, none
  stale.

## Changed Files / Areas

- `core/providers/NavigationProvider.tsx` — record/restore wiring.
- `core/providers/weeklyReviewFocusReturn.ts` — new pure helpers + bounded schedule.
- `e2e/v2-keyboard-focus.spec.ts` — `test.fixme(` → `test(`, body untouched.
- `docs/testing/known-gaps.md` — CG-13 row removed, one sentence added.
- `tests/weeklyReviewFocusReturn.test.ts` — opener/fallback/stray-focus logic.

## Recovery / Resume Instructions

This plan is complete; no resume is expected. If it must be re-verified: read
`AGENTS.md` and this plan, run `git status --short`, rebuild the hermetic bundle
with `npm run build:e2e` after unsetting `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, then run
`flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh env E2E_PORT=8113 npx playwright test --project=chromium e2e/v2-keyboard-focus.spec.ts`
and `npx vitest run tests/weeklyReviewFocusReturn.test.ts`.

## Outcomes & Retrospective

Focus now returns to `Plan today` (the hub chain's opener) at 390x844 in light
and dark; if that control is gone, the selected section rail destination is used;
if neither is usable, focus is left alone rather than forced onto `<body>`.
Native is a no-op (`isWebDocumentAvailable`). No goldens change: every golden
that involves the Weekly Review is captured while the review is open.
