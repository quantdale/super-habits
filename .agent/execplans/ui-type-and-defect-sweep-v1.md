# ExecPlan: Pop Type Completion + UI Defect Sweep V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

The product owner reports the UI "still sucks and has defects". The confirmed
root defect: ~15 feature surfaces render their text with raw React Native
`Text` plus NativeWind size classes, which set size/weight but **no font
family** — so Workout, Command, Planning, Goals, Projects, Daily Plan, Pomodoro
management and linked-action surfaces fall back to the platform font (Roboto /
Helvetica) while the rest of the app renders Nunito. Pop's contract says every
screen imports `Text` from `@/core/ui/Text` and never from `react-native`.

Observable success: no raw RN `Text` remains in `features/` or `core/` outside
the design-system primitive and non-theme error UI; the affected screens render
Nunito at their existing sizes; a programmatic audit of the web export finds no
new truncation/overflow/tap-target/contrast defects; typecheck, lint, tests,
build, and the Chromium battery stay green; the web export is deployed to
Vercel production.

## Context

- Baseline: `main == 575c3d8` after Native Persistence Lane Closure V1
  (`.agent/execplans/native-lane-closure-v1.md`, COMPLETED; lane 11/11).
- `tailwind.config.js` defines **no** `fontFamily` map and `global.css` sets no
  global family, so a `className`-styled raw `Text` cannot inherit Nunito.
- `core/ui/Text.tsx` maps `font-*` utilities and role variants onto the five
  shipped Nunito families; 425 existing core-`Text` usages already pass
  `className` sizes, so the conversion pattern is proven in production.
- Raw RN `Text` files (import list, 2026-09-13 scan): `features/workout/
WorkoutSessionScreen.tsx` (49 usages), `WorkoutScreen.tsx` (19),
  `RoutineDetailScreen.tsx` (23), `CustomExerciseManager.tsx` (4),
  `core/linked-actions/LinkedActionsEditorSection.tsx` (30),
  `features/daily-plan/DailyPlanView.tsx` (16), `goals/GoalDetailView.tsx`
  (19), `projects/ProjectDetailView.tsx` (15), `planning-hub/
GuidedPlanningFlow.tsx` (21), `command/{DraftPreview,CommandInputCard,
AutoModeView,AskConversationView}.tsx`, `pomodoro/{PomodoroPresetManager,
SessionMetaEditModal}.tsx`. Gamification files import raw `Text` but pass
  `typography` tokens (family present); they are cosmetic migrations only.
- Non-theme raw-`Text` usages to keep: `core/ui/Text.tsx` itself, and
  `core/providers/AppProviders.tsx` / `app/_layout.tsx` if their text renders
  before/outside the theme provider (verify before touching).
- Deployment target: `.vercel/project.json` → project `super-habits`, team
  `team_C7uY1o3XWm9zZBRgaXD2IVVm`. `vercel` CLI is installed globally; auth is
  via `vercel login` device flow (user-approved) because `auth.json` is empty
  and the repo OIDC token expired 2026-04-27.

## Scope

1. Empirically confirm the defect and the migration's precedence behaviour on
   the web export (computed `font-family` on a known raw-`Text` surface vs a
   core-`Text` surface).
2. Convert the affected files to `@/core/ui/Text`, preserving className sizes,
   weights, colors, `numberOfLines`, and accessibility labels verbatim.
3. Sweep the web export programmatically for concrete defects (horizontal
   overflow, clipped/truncated text, sub-44px touch targets, overlapping
   floating controls) and fix what is real, evidence-backed, and in scope.
4. Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:web`,
   Chromium Playwright battery (`npx playwright test --project=chromium`),
   `npm run web:verify`.
5. Deploy the verified export to Vercel production once auth completes.

## Non-Goals

- No redesign, no copy changes, no accessibility-label changes (journeys and
  native flows depend on the vocabulary).
- No data-layer, migration, or sync changes.
- No new dependencies; no `data-testid`.
- No weakening or deletion of tests; no visual changes that contradict
  `docs/ui-ux/12-pop-design-system.md`.
- No touch to `core/ui/Text.tsx`'s public API unless the empirical check proves
  a necessary, minimal fix.

## Current Checkpoint

- Current milestone: COMPLETE — type defects fixed, gates green, production
  deployment verified.
- Completed: `core/ui/Text` class-size precedence; 15 raw-`Text` conversions;
  chart axis families; two touch-target lifts; chromium+pwa battery (140
  passed / 7 skipped / 1 pre-existing gap-16 failure reproduced on baseline);
  2055 tests; theme contrast 140/140; production deploy
  https://super-habits.vercel.app (HTTP 200, COOP/COEP, crossOriginIsolated,
  0 non-Nunito text).
- In progress: none.
- Important modified files: `core/ui/*`, `features/**` (see Changed Areas),
  this plan.
- Last successful validation: production probe; font probes per section;
  sweeps (mobile+desktop) clean; baseline comparison for the three journeys.
- Current failures: none from this campaign. Pre-existing failures found and
  classified (see Surprises) — they become the next campaign.
- Relevant quarantines: known-gap 15/16 (15 unchanged; 16 now reproduced
  standalone at baseline → product bug per its own escalation rule).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: none for this plan. Next campaign: repair the
  pre-existing habit target-edit bug (gap 16) and the three baseline journey
  failures (P2 section activation, P3 settings calorie ripple, P5 offline
  writes), then OpenSpec lifecycle reconciliation.
- Remaining definition of done: none for this plan.

## Progress

- [x] WS1 — empirical type-defect confirmation on the web export
- [x] WS2 — raw-`Text` → core-`Text` conversions (15 files) + `Text` size fix
- [x] WS3 — programmatic UI defect sweep and fixes (charts, touch targets)
- [x] WS4 — gates: typecheck, lint, 2055 tests, 140 contrast checks, chromium
  - pwa (140 passed / 7 skipped / 1 pre-existing gap-16), sweeps clean
- [x] WS5 — Vercel production deployment verified (https://super-habits.vercel.app)

## Surprises & Discoveries

- 2026-09-13 — The defect was two-layered: `core/ui/Text` silently overrode
  every NativeWind `text-*` size with the role's inline `fontSize`, so all
  425 class-sized call sites rendered at 15px (measured `text-3xl`/`text-sm`/
  `text-xs` → 15px before the fix, 30/14/12px after). Fixing the primitive
  was a prerequisite for converting the raw-`Text` stragglers.
- 2026-09-13 — 15 feature surfaces never imported the Pop `Text` at all
  (workout, command, daily-plan, goals, projects, planning-hub, pomodoro,
  linked-actions editor), so they rendered the platform font entirely;
  `tailwind.config.js` has no `fontFamily` map and `global.css` sets none.
- 2026-09-13 — `react-native-gifted-charts` axis labels inherited the browser
  default until `fontFamily` was passed explicitly (Calories was the only
  section with non-Nunito text, 70 nodes).
- 2026-09-13 — Two controls sat below the documented chip minimum: the
  `SegmentedControl` segments (42px) and the Momentum Garden link (40px).
- 2026-09-13 — The full Vitest run's two failures during the first pass were
  build-contention timeouts in git-fixture tests; they pass isolated and in
  the next full run (196 files / 2055 tests).

## Decision Log

- 2026-09-13 — Treat the raw-`Text` system-font fallback as the primary UI
  defect for this campaign: it is broad, objective, contract-backed, and
  user-visible on every affected screen.
- 2026-09-13 — Convert with minimal diffs (import swap first; only add explicit
  `variant`/`tone` where the className did not already express size/weight),
  preserving strings and labels exactly, because the E2E/journey/native suites
  assert on them.
- 2026-09-13 — Keep `AppProviders`/`_layout` raw `Text` if the empirical check
  shows they render outside the theme provider; they are error/loading
  fallbacks, not themed surfaces.

## Validation Ledger

- 2026-09-13 — read-only: raw-`Text` import scan (26 matches), Tailwind theme
  (`extend: colors` only, no `fontFamily`), `global.css` (no family),
  `core/ui/Text.tsx` family mapping, `designTokens.typography` families,
  Vercel project/credential inspection, native lane 11/11 report.
- 2026-09-13 — computed-style probe (Playwright on `dist/`): before the fix,
  `text-3xl`/`text-sm`/`text-xs` all rendered 15px; after, 30/14/12px. Section
  scan: 0 non-Nunito text nodes on all six sections (Calories was 70 chart
  axis labels).
- 2026-09-13 — sweeps at 390×844 and 1440×1000: `docOverflowX=0`, 0 clipped
  text, 0 small targets after the SegmentedControl/MomentumCard lifts.
- 2026-09-13 — `npm test`: 196 files / 2055 tests pass (two earlier timeouts
  were build contention, confirmed by isolated re-run).
- 2026-09-13 — `npx playwright test --project=chromium --project=pwa`: 140
  passed / 7 skipped / 1 failed (gap-16 habit target edit).
- 2026-09-13 — baseline classification: `dist-base` built from `575c3d8`;
  the gap-16 test, P2, P3, and P5 all fail identically against it.
- 2026-09-13 — `vercel --prod --yes --archive=tgz`: production
  https://super-habits.vercel.app (build completed remotely); probe returns
  HTTP 200 with COOP/COEP and 0 non-Nunito text.

## Changed Files / Areas

- `.agent/execplans/ui-type-and-defect-sweep-v1.md` — this plan.
- `features/workout/*`, `features/command/*`, `features/daily-plan/*`,
  `features/goals/*`, `features/projects/*`, `features/planning-hub/*`,
  `features/pomodoro/*`, `core/linked-actions/*` — import conversions.
- `features/gamification/*`, `features/overview/cards/GamificationCard.tsx` —
  cosmetic conversion (family already correct).
- `dist/` (gitignored) — deployment artifact.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; reconcile with the checkpoint (Git wins).
3. Re-run the scan: `node -e` script from the Validation Ledger to list
   remaining raw-`Text` files.
4. Reload `dist/` and re-measure computed fonts before continuing.
5. Continue from the exact next action.

## Outcomes & Retrospective

- Status: Completed (2026-09-13).
- Summary: the "UI still sucks" complaint traced to two measurable defects:
  `core/ui/Text` overrode every class-declared size with the role default
  (all 425 class-sized call sites rendered 15px), and 15 feature surfaces
  never used the Pop `Text`, rendering the platform font. Both are repaired,
  calorie chart labels now use Nunito, and two controls were lifted to the
  documented chip minimum. The web export is deployed to production.
- Proof: per-section font probes → 0 non-Nunito text nodes (Calories was 70);
  size classes resolve to 14/16/12px; sweeps 0 clipped/0 small targets/0
  overflow at 390 and 1440; `npm test` 2055/2055; chromium+pwa 140 passed,
  7 skipped, 1 pre-existing gap-16 failure; `npm run validate:themes` 140/140;
  production probe HTTP 200 + COOP/COEP + crossOriginIsolated=true.
- Pre-existing failures found while gating (all reproduce on the baseline
  build, none caused by this campaign): habit target-edit completion loss
  (gap 16, now a confirmed product bug by its own escalation rule), P2
  six-section activation, P3 settings→calorie-goal ripple, P5 offline
  writes. They are the next campaign's scope.
- Follow-up: repair the four pre-existing failures above; then OpenSpec
  lifecycle reconciliation; native lane re-run after the UI change (the
  Text/segment/target changes touch Android surfaces).
