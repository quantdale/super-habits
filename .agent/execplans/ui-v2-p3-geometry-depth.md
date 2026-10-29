# ExecPlan: UI v2 P3 — Geometry + Depth Tokens

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Implement phase **P3 "Geometry + depth tokens"** of brief v2 "Playful Momentum"
(`docs/ui-ux/16-playful-momentum.md` §5.6, §5.7, §10 P3 row) on branch
`ui/v2-p03-geometry`, stacked on P2 (`origin/ui/v2-p02-typography`, PR #145,
head `e9f10f96` after the driver rebase) which itself stacks on P1 (PR #139,
`f47813a9`).

The user-visible outcome: every surface shares one playful but systematic
geometry — cards 20, buttons/option rows 16, inputs and chips 12, sheets and
dialogs 28, pills round — with depth carried by a 2px border or a solid lip
instead of a blur shadow, desktop content in a phone-like 640 column, and
keyboard focus that is obvious for keyboard users while a mouse/touch click
leaves **no** ring behind.

Presentation-only. No colour values (P1), no typography (P2), no Pressable3D or
Button restyle (P5), no test id / role / label / asserted-copy edits, no new
dependencies.

## Context

- Repo `quantdale/super-habits`; worktree `/workspace/wt-ui-v2-p3`; branch
  `ui/v2-p03-geometry`, stacked on P2 (#145) which stacks on P1 (#139).
- Delivered as draft PR **#148** (https://github.com/quantdale/super-habits/pull/148)
  with `@codex review` requested. Two feature commits plus one goldens commit
  at the original head; the driver then rebased the branch onto the new P2 head
  `e9f10f96` (P2 now carries `display` 40/48 and `metricLg` 56/68) and pushed
  `cecb21ff`.
- Design brief v2 keeps the v3 "Calm Momentum" token _shape_ but changes the
  values: §5.6 radii and content width, §5.7 depth and the single allowed
  elevation, §10 P3 acceptance ("Radii §5.6; no blur shadow on cards; pointer
  click shows no ring").
- Pre-existing repo facts this plan relies on: `core/ui/useKeyboardFocusRing.ts`
  is the shared focus-ring hook used by Button, IconButton, Modal, MenuSheet,
  SegmentedControl, the habits widgets and `app/index.tsx`; its pre-P3
  implementation keyed off `onFocus` alone, so RN-Web focused the node on click
  and painted the ring after every tap. `layout.contentMaxWidth` was 760 and
  `HabitsScreen` overrode the column with a raw `720`.
- CI now enforces the versioned ExecPlan template (`npm run
agent:plan:validate:all` in the `quality` job); this file was restructured
  into the template after that gate went red.

## Scope

1. `core/theme/designTokens.ts`
   - `radius`: xs 8, sm **12**, md **16**, lg **20**, xl **28**, full 9999 (§5.6).
   - `elevation`: keep levels 0–2 for genuinely floating surfaces only; retune
     `level3` to the §5.7 sheet/dialog spec (`0 12 32`, opacity 0.18) and
     document that cards never take a blur shadow.
   - NEW `depth` tokens: `lip.lg|md|sm` = 4/3/2, `card` = 2px ring + 4px
     `borderStrong` bottom, `flat` = 2px ring with no lip. Plus the
     appearance-aware compositors `cardDepth()`, `flatDepth()`, `pressDepth()`
     and `sheetDepth()` (dark sheets = `surfaceElevated` + 2px border, per
     §5.7) so the token module never reads the active theme.
   - `layout.contentMaxWidth` 760 → **640**; NEW `layout.dashboardMaxWidth`
     1040 so the §5.6 ≥1280 dashboard grid keeps its documented cap instead of
     inheriting the narrowed column.
2. `core/ui/useKeyboardFocusRing.ts` — real `:focus-visible` semantics:
   keyboard focus shows the 2px `accent` ring, a pointer click/tap shows
   **no** ring, and the ring is drawn outside the control (`outlineOffset: 3`)
   so focus indication never changes geometry.
3. Token-swap-only wiring, no restyling: `Card` (`depth.flat` border width and
   doc truth), `Screen` (640 column), `SwipeRightActions` (raw 16 →
   `radius.lg`), `ValidationError` (raw 8 → `radius.xs`), `app/index.tsx` tab
   rail (drop the inline ring copy in favour of the shared hook).
4. Call sites that pinned a raw column move with the token: the Overview
   dashboard cap (now `dashboardMaxWidth` on wide layouts), `HabitsScreen`'s
   `contentMaxWidth={720}` override removed, and `e2e/workout-w95.spec.ts`'s
   `760` literal retargeted to `640` (assertion tightened with the token, not
   weakened).
5. Regenerate the linux visual goldens and inspect every diff: radii, borders
   and content width only — no clipping, overflow or layout shift.

## Non-Goals

- Pressable3D, the Button/IconButton lip restyle and the OptionRow/CheckNode
  primitives (P5/P6).
- Colour values (`themes/*`, `tokens.ts`, section/reward hues) — P1.
- Typography roles and `Text.tsx` — P2.
- Inputs/selection redesign (P6), surfaces rework (P7), overlays and the
  celebration card (P8).
- Any test id, role, label or asserted-copy edit; any assertion weakened,
  skipped or deleted.
- `.github/`, `vercel.json`, `supabase/`, `package*.json`, `core/db/schema.sql`,
  `node_modules`; new dependencies; `npm install`/`npm ci`.
- Pushing to `main`, force-pushing, or merging PR #148.

## Current Checkpoint

- Current milestone: P3 implementation DONE and shipped as draft PR #148; the
  branch has been rebased onto P2 head `e9f10f96` (driver push `cecb21ff`) and
  this plan has been restructured into the versioned template so CI's
  "Validate versioned ExecPlans" gate passes. One follow-up repair remains.
- Completed: designTokens radius/depth/elevation/contentMaxWidth/
  dashboardMaxWidth; `:focus-visible` hook rewrite; token-swap wiring in Card,
  Screen, SwipeRightActions, ValidationError and the app tab rail; Overview/
  Habits/workout-w95 column call sites; all gates (typecheck, lint, unit 2183,
  themes 168/168, hermetic `build:e2e`, `visual:update` 29 goldens inspected,
  targeted a11y/health-nav/settings 27/27); draft PR #148 + `@codex review`.
- In progress: none — the remaining `habits-w7` repair is queued, not started.
- Important modified files: `core/theme/designTokens.ts`,
  `core/ui/useKeyboardFocusRing.ts`, `core/ui/Card.tsx`, `core/ui/Screen.tsx`,
  `core/ui/SwipeRightActions.tsx`, `core/ui/ValidationError.tsx`,
  `app/index.tsx`, `features/overview/OverviewScreen.tsx`,
  `features/habits/HabitsScreen.tsx`, `e2e/workout-w95.spec.ts`,
  `e2e/__screenshots__/visual-regression.spec.ts/*`, this plan.
- Last successful validation: `npm run typecheck` (0 errors), `npm run lint`
  (0/0), `npm run test:unit` 2183/2183 (156 files) `PASS`,
  `npm run validate:themes` 168/168, hermetic `build:e2e` (0 Supabase hosts),
  `visual:update` 32 pass / 2 opt-in skip, targeted chromium
  `a11y.spec` + `a11y-audit-contract` + `health-nav-w10` + `settings.spec`
  27/27 `PASS` on :8087.
- Current failures: `e2e/habits-w7.spec.ts` 2 of 11 red (`48pt row actions…
keyboard focus` at :301, `editor choices … keyboard focus` at :365), 9 pass.
  Both call Playwright `.focus()` after pointer input, so Chromium reports
  `:focus-visible` false and the ring is correctly absent.
- Relevant quarantines: none new. Pre-existing and unrelated: driver note on
  `RewardCelebrationOverlay` `+N XP` contrast (P1 follow-up) and the
  `Card variant='header'` 6%-alpha surface vs Workout headerRight icon tokens
  (flagged for P15/P16).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: in `core/ui/useKeyboardFocusRing.ts`, make ring visibility
  `isFocusVisible() || !pointerPressActive`, where `pointerPressActive` is set
  on `pointerdown`/`mousedown`/`touchstart` and cleared ~100 ms after
  `pointerup`, then rerun `e2e/habits-w7.spec.ts` and a **no-update** visual
  pass (inspect any golden that moves rather than blind-refreshing), commit and
  plain-push, and comment the result on #148.
- Remaining definition of done: `habits-w7` green without weakening its
  focus assertions; the no-update visual project green with every moved golden
  inspected; the ExecPlan gate green (`agent:plan:validate:all`); @codex review
  addressed; then, after #139 and #145 squash-merge, `git rebase --onto
origin/main 7f23746b` and mark #148 ready.

## Progress

- [x] WS1 — `designTokens`: radii, `depth` tokens + compositors, `level3`
      retune, `contentMaxWidth` 640, `dashboardMaxWidth` 1040
- [x] WS2 — `useKeyboardFocusRing`: real `:focus-visible` + `outlineOffset`
- [x] WS3 — token-swap wiring in core/ui, the app tab rail and the column
      call sites (no restyling)
- [x] WS4 — gates: typecheck, lint, unit 2183, themes 168/168
- [x] WS5 — hermetic `build:e2e` → serve :8087 → `visual:update` 29 goldens,
      every diff inspected (identical canvas sizes, no clipping)
- [x] WS6 — targeted chromium 27/27 (a11y, a11y-audit-contract,
      health-nav-w10, settings); draft PR #148 + `@codex review`
- [x] WS7 — driver rebase onto P2 `e9f10f96` reconciled; this plan
      restructured into the versioned template
- [ ] WS8 — `habits-w7` programmatic-focus regression: pointer-press fallback,
      then habits-w7 + no-update visual verification

## Surprises & Discoveries

- 2026-10-29 — A focus ring keyed on `onFocus` alone cannot satisfy §10-P3's
  "pointer click shows no ring": RN-Web focuses the Pressable during mousedown,
  so every tap painted the ring. The fix is to delegate modality to the
  platform (`document.activeElement.matches(':focus-visible')`) instead of
  tracking keydown state by hand.
- 2026-10-29 — Pressing an _already focused_ element emits no new focus event
  but does change `:focus-visible`, so the hook also needs a document-level
  pointer listener that re-evaluates the active control.
- 2026-10-29 — Drawing the ring with `outline` (not `border`/`boxShadow`) plus
  `outlineOffset: 3` keeps every golden's box geometry identical; all 29
  regenerated goldens share their previous canvas size, which is what makes the
  "radii/borders only" claim checkable rather than asserted.
- 2026-10-29 — `HabitsScreen` carried a raw `contentMaxWidth={720}` override
  that would have silently defeated the narrowed §5.6 column; the token change
  alone was not enough.
- 2026-10-29 — Chromium's `:focus-visible` heuristic answers **false** for a
  programmatic `element.focus()` that follows pointer input. The pre-P3 hook
  showed a ring there, which `e2e/habits-w7.spec.ts` asserts (2 tests). This is
  the one place where the P3 acceptance criterion and an existing assertion
  disagree, and it was found only by running the wider suite after the
  time-boxed ship — the targeted set did not include habits-w7.
- 2026-10-29 — CI enforces the ExecPlan template on every versioned plan
  (`agent:plan:validate:all`); a plan that is otherwise complete but written in
  free-form sections fails the `quality` job outright.

## Decision Log

- 2026-10-29 — Keep `elevation` levels 1–2 declared (capture affordance, sticky
  banners already use them) while documenting them as "not for cards"; deleting
  them would have forced unrelated restyling into P3.
- 2026-10-29 — Split the dashboard cap out as `layout.dashboardMaxWidth` (1040)
  instead of letting the 640 column govern the ≥1280 grid, because §5.6 asks
  for both a 640 reading column and a 2-column dashboard.
- 2026-10-29 — Retarget `e2e/workout-w95.spec.ts`'s `760` literal to `640`
  alongside the token rather than editing the product to keep 760; the
  assertion still pins a ceiling, so it tightens with the design change.
- 2026-10-29 — Ship draft PR #148 at the deadline with the `habits-w7` red
  disclosed in a PR comment instead of applying an unverified focus fallback:
  the fallback can legitimately re-add a ring where a component autofocuses
  after a click, which needs a full no-update visual pass to confirm.
- 2026-10-29 — Solve `habits-w7` with `isFocusVisible() || !pointerPressActive`
  (a pointer-press window) rather than by relaxing the spec: the product
  behaviour stays `:focus-visible`-correct, and keyboard/script focus keeps its
  ring.
- 2026-10-29 — Restructure this plan into the versioned template without
  dropping any prior content (scope, constraints, close-out notes are folded
  into Scope / Non-Goals / Checkpoint / Discoveries / Decisions / Validation /
  Changed Files / Recovery / Outcomes).

## Validation Ledger

- 2026-10-29 20:48 — `flock /tmp/sh-heavy.lock npm run typecheck` → pass, 0 errors.
- 2026-10-29 20:49 — `flock /tmp/sh-heavy.lock npm run lint` → pass, 0 errors,
  0 warnings (`--max-warnings 0`).
- 2026-10-29 20:51 — `flock /tmp/sh-heavy.lock npm run test:unit` →
  `PASS` 2183/2183 across 156 files.
- 2026-10-29 20:52 — `flock /tmp/sh-heavy.lock npm run validate:themes` →
  `PASS` 168/168 contrast checks.
- 2026-10-29 20:52 — hermetic `npm run build:e2e` (with
  `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` unset) → OK, 0 Supabase hosts in
  `dist/`.
- 2026-10-29 20:56 — `node scripts/serve-e2e.js --port 8087 --dist dist` then
  `E2E_PORT=8087 E2E_REUSE_SERVER=1 npm run visual:update` →
  `PASS` 32 passed / 2 opt-in skips, 29 linux goldens regenerated; every diff
  inspected with identical canvas sizes (390×844, 360×740, 768×1024, 1280×800)
  and diff regions confined to card corners, borders, the 640 column and the
  removed pointer focus ring.
- 2026-10-29 21:00 — targeted chromium `a11y.spec.ts` +
  `a11y-audit-contract.spec.ts` + `health-nav-w10.spec.ts` + `settings.spec.ts`
  → `PASS` 27/27 on :8087.
- 2026-10-29 21:11 — `e2e/habits-w7.spec.ts` → 9 passed / 2 failed
  (`:301`, `:365`); classified `TEST_BUG`-adjacent: the hook must keep a ring
  for programmatic focus after a pointer press.
- 2026-10-29 21:13 — `npm run web:hygiene` → `PASS`, ports 8081/8082 free, the
  :8087 server PID killed (only the owned PID).
- 2026-10-29 — `node scripts/agent-execplan.mjs validate --plan
.agent/execplans/ui-v2-p3-geometry-depth.md` before the restructure → 12
  missing sections and 11 missing checkpoint fields; the restructure below is
  validated against the same command until it reports `PASS`.

## Changed Files / Areas

- `core/theme/designTokens.ts` — radii, `depth` + compositors, `level3`,
  `contentMaxWidth` 640, `dashboardMaxWidth` 1040.
- `core/ui/useKeyboardFocusRing.ts` — real `:focus-visible`, `outlineOffset`.
- `core/ui/Card.tsx` — `depth.flat` border width, documented depth truth.
- `core/ui/Screen.tsx` — 640 column documentation.
- `core/ui/SwipeRightActions.tsx`, `core/ui/ValidationError.tsx` — raw radius
  literals replaced by tokens.
- `app/index.tsx` — tab rail uses the shared focus-ring hook.
- `features/overview/OverviewScreen.tsx` — dashboard cap token.
- `features/habits/HabitsScreen.tsx` — raw 720 column override removed.
- `e2e/workout-w95.spec.ts` — content-cap assertion retargeted 760 → 640.
- `e2e/__screenshots__/visual-regression.spec.ts/` — 29 linux goldens
  regenerated for P3 geometry.
- `.agent/execplans/ui-v2-p3-geometry-depth.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`, `git diff --stat`, `git log --oneline -5`; reconcile
   with the checkpoint (Git wins over any summary).
3. `npm run agent:resume -- --plan .agent/execplans/ui-v2-p3-geometry-depth.md`
   for read-only orientation, including its Git discrepancy warnings.
4. Re-run the failing gate directly: `npx playwright test --project=chromium
e2e/habits-w7.spec.ts` against a hermetic build served on **:8087**
   (`E2E_PORT=8087 E2E_REUSE_SERVER=1`); kill only the owned server PID.
5. Continue from the exact next action; keep heavy commands one-at-a-time under
   `flock /tmp/sh-heavy.lock`.

## Outcomes & Retrospective

- Status: In progress (ACTIVE) — P3 implementation is shipped and CI-visible as
  draft PR #148; one focus-modality regression (`habits-w7`, 2 tests) and the
  ExecPlan gate are the remaining work items.
- Summary: v2 geometry and depth landed as tokens plus token-swap-only wiring.
  Radii moved to 8/12/16/20/28, depth became explicit (`lip` 4/3/2, card
  2+4 `borderStrong`, flat 2), `elevation.level3` was retuned to the sheet/
  dialog spec with cards explicitly shadow-free, desktop content narrowed to a
  640 column with a separate 1040 dashboard cap, and the focus ring became
  genuinely `:focus-visible` so a pointer click leaves no ring. Colour (P1) and
  typography (P2) were untouched, and no test id/label/copy changed.
- Proof: typecheck, lint, unit 2183/2183, themes 168/168, hermetic build, 29
  inspected goldens with identical canvas sizes, targeted chromium 27/27.
- Follow-up: the pointer-press fallback for programmatic focus (WS8), then the
  no-update visual pass, then post-merge rebase and P4 (motion foundation).
