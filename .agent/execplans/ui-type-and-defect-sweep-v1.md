# ExecPlan: Pop Type Completion + UI Defect Sweep V1

Plan-Version: 2
Status: ACTIVE

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

- Current milestone: WS1 — plan authored; web export building for the empirical
  type check.
- Completed: successor-campaign audit (raw-`Text` violation found; tailwind/
  global CSS confirmed family-free; core `Text` mapping read; Vercel auth path
  confirmed with the user).
- In progress: `npm run build:web` (background) → computed-font audit.
- Important modified files: this plan (new).
- Last successful validation: native lane 11/11 (`be1fb2d`, pushed).
- Current failures: none open; this campaign addresses the UI defect class.
- Relevant quarantines: known-gap 15/16 (unchanged).
- Blockers: none local; Vercel auth pending the user's device approval.
- Condition required to unblock: user approves the Vercel device login.
- Exact resume action after unblock: `vercel deploy --prod` from the built
  `dist/` (or `vercel --prod` which rebuilds) and report the deployment URL.
- Exact next action: when the web build finishes, serve `dist/` and measure
  computed `font-family` on a raw-`Text` screen and a core-`Text` screen with
  Playwright.
- Remaining definition of done: conversions landed and verified; audit findings
  fixed or documented; gates green; production deployment verified.

## Progress

- [ ] WS1 — empirical type-defect confirmation on the web export
- [ ] WS2 — raw-`Text` → core-`Text` conversions (features + linked actions)
- [ ] WS3 — programmatic UI defect sweep and fixes
- [ ] WS4 — gates green (typecheck/lint/test/e2e/build/web:verify)
- [ ] WS5 — Vercel production deployment verified

## Surprises & Discoveries

- 2026-09-13 — Pop's typeface contract is enforced only where screens import
  `@/core/ui/Text`; raw RN `Text` + NativeWind classes silently render the
  platform font because Tailwind has no `fontFamily` map and `global.css` sets
  none. ~220 raw usages remain across the surfaces listed above.
- 2026-09-13 — 425 existing core-`Text` usages pass `className` size classes,
  so the primitive demonstrably composes className sizing with the role family;
  the conversion is a drop-in import swap, not a redesign.
- 2026-09-13 — the native persistence lane's residual "environment" flake was
  three deterministic flow defects (previous campaign); the same rigor applies
  here: measure before assuming.

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

- Status: Active.
- Summary: Pending.
- Follow-up: Pending.
