# ExecPlan: Frontend V3 — Calm Momentum UI/UX reconstruction

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Reconstruct SuperHabits' frontend into a visually polished, coherent, fast,
accessible consumer productivity app ("Calm Momentum") while preserving proven
domain behavior. Implements the
[frontend-v3-calm-momentum OpenSpec change](proposal.md). The owner explicitly
rejected the current rendered experience; prior "visual QA complete" claims are
historical evidence only.

## Context

- Baseline HEAD `3a376374a643786ce70152ce2c427156e9f502df` (= `origin/main` at
  campaign start). One stash (`pre-recovery-local-changes`) and one untracked
  `.tmp-ios36423379932/` dir preserved untouched.
- Rendered-truth audit found systemic Pop-reflex damage (SYS-01…SYS-20 in the
  defect ledger): doc-copy subtitles push content below the fold, saturated
  slab headers dominate, five-hue stat strips, FAB overlaps content/forms on
  4 of 6 sections, dark-theme hero has white-on-light-lavender contrast
  failure, triple-duplicated counts on Todos, "Reset (not logged)" clipped,
  neutral progress rendered in danger-red on Habits.
- Refero research synthesized into reference lock: calm information-first
  primary (Perplexity/Todoist/ChatGPT neutrals, single-accent discipline);
  task/habit/workout/nutrition/capture screen patterns recorded with
  adopt/reject decisions per area.
- Design system doc `docs/ui-ux/13-calm-momentum-design-system.md` is the
  campaign authority; Pop doc `12` is superseded for visual rules.
- W4 shipped the five-destination phone model (Health parents
  Workout/Calories) with the capture slot replacing the floating FAB. A
  non-campaign Expo dev server (the owner's `brain-training` project) occupies
  host port 8081, so local render/audit lanes use `E2E_PORT=8083`.

## Scope

- `core/theme/*` token values + derivation; `core/ui/*` shared primitives;
  `app/index.tsx` shell/navigation; one screen wave per feature area
  (W5–W13); persistent visual-regression suite (W15); Android qualification
  (W16); final regression (W17).
- Correction pass W4.5 (current): bring this ExecPlan to the repository's
  canonical schema; enforce compact-button touch-target contracts; reconcile
  desktop-rail task truth; resolve Health IA duplication; implement the
  documented responsive Screen gutter contract; evidence-audit the Modal task
  claim; truth-check W3/W4 task claims; re-render representative captures.

## Non-Goals

- No domain/persistence/sync/backup semantics changes (`core/db`, `core/sync`,
  `core/backup`, `core/portable`, Supabase functions).
- No production Supabase mutations; no iOS certification (owner-deferred).
- No dependency-security work: braces/node-forge audit reds stay upstream.
- No broad redesign restart: Calm Momentum direction is preserved unless
  rendered evidence proves a decision wrong.
- No Android full certification before W16 (bounded native checks only if a
  W4.5 correction makes it necessary).
- No W5 screen work until W4.5 closes.

## Current Checkpoint

- Current milestone: W4.5 corrections implemented and locally verified — handoff
  to W5 pending exact-head hosted CI confirmation.
- Completed: W0–W4 implemented, subject to W4.5 corrections — W1 audit (47
  captures, 33-defect ledger), W2 reference lock + design system, W3
  foundation commit `8888084` (typecheck 0, lint 0/0, themes 140 checks,
  unit 2143/2143, re-render verified), W4 shell commit `282bfce` (five-tab
  rail + capture slot + Health screen; 68 chromium specs + 5 audit passes).
- In progress: publication — one coherent W4.5 commit, push, and hosted-CI
  inspection (must pass every quality step; dependency-audit reds are accepted).
- Important modified files: `openspec/changes/frontend-v3-calm-momentum/execplan.md`,
  `core/ui/Button.tsx`, `core/ui/Screen.tsx`, `core/theme/designTokens.ts`,
  `features/health/HealthScreen.tsx`, `app/index.tsx`,
  `openspec/changes/frontend-v3-calm-momentum/tasks.md`,
  `docs/ui-ux/15-v3-defect-ledger.md`, plus W4.5 regression tests.
- Last successful validation: W4 publication gate at commit `282bfce` —
  typecheck 0 errors; lint 0/0; `validate:themes` 140/140; unit 2143/2143;
  journey-label-parity OK; chromium todos/workout/calories (24) +
  habits/pomodoro/overview/boundary/theming (44) + visual-audit 5/5.
- Current failures: exact-head hosted run 37479209183 fails at "Validate
  versioned ExecPlans" — plan lacked the canonical sections (scope, non-goals,
  progress, discoveries, decisions, validation, changed files, recovery,
  outcomes) and structured checkpoint fields; local
  `npm run agent:plan:validate:all` reproduced it identically before this
  rewrite.
- Relevant quarantines: only the standing `VISUAL_AUDIT=1` opt-in lane for
  `e2e/visual-audit.spec.ts`, registered in `docs/testing/known-gaps.md`
  entry 24; no failure quarantines registered for this campaign.
- Blockers: none blocking W4.5 work; the braces/node-forge dependency-audit
  reds remain known upstream failures after the quality gate (accepted,
  campaign §36/§12 of this plan's proposal).
- Exact next action: finish W4.5 corrections (Button hitSlop contract +
  regression test, desktop-rail decision evidence, Health IA removal of the
  Focus duplicate, Screen responsive gutters, Modal audit evidence, task
  truth pass), re-render representative captures, run the full local gate,
  commit once, push, and verify exact-head hosted CI reaches the known
  dependency-audit step with no new campaign failure.
- Remaining definition of done: every W4.5 condition in the correction-pass
  brief holds (validator green, Button contract tested, rail claim true,
  Health IA resolved, gutter docs == code, Modal claim evidenced, task
  checkboxes truthful, captures re-reviewed, hosted CI clean before the
  known audit reds); then checkpoint flips to W5 with exact next action
  "5.1 orientation-first Today layout".

## Progress

- [x] W0 — repository truth reconciled (HEAD `3a37637` = origin, stash/tmp
      evidence preserved)
- [x] W1 — 47-image rendered audit + 33-defect ledger (`docs/ui-ux/15`)
- [x] W2 — Refero research + reference lock + design system (`docs/ui-ux/13`,
      `docs/ui-ux/14`)
- [x] W3 — foundation shipped (`8888084`): tokens, theme derivation, Screen,
      Button (+celebrate), Card, PageHeader, StatBlock, PillChip,
      SegmentedControl, EmptyStateCard, SectionLabel; TactileButton absorbed
- [x] W4 — five-destination shell + capture slot + Health parent (`282bfce`)
- [ ] W4.5 — foundation/shell correction pass (this campaign; in progress)
- [ ] W5 — Today reconstruction
- [ ] W6 — To Do + Quick Capture
- [ ] W7 — Habits
- [ ] W8 — Focus
- [ ] W9 — Workout
- [ ] W10 — Calories / Health validation gate
- [ ] W11 — Planning / Goals / Projects / Daily Plan
- [ ] W12 — Weekly Review / Progress / Activity
- [ ] W13 — Settings / secondary surfaces
- [ ] W14 — full visual integrity sweep
- [ ] W15 — persistent visual regression suite
- [ ] W16 — Android current-source qualification
- [ ] W17 — final regression + adversarial review

## Surprises & Discoveries

- The W1 audit showed the damage was systemic (Pop reflexes), not isolated
  bugs: every primary screen reproduced the same five defects patterns.
- `canvasTint` rendered as a stray quarter-disc arc at the 900px rail
  breakpoint — removed entirely rather than patched.
- The host port 8081 is occupied by the owner's unrelated Expo dev server
  (brain-training, PID 42924); audit lanes must use `E2E_PORT=8083` and must
  never kill that process.
- The repository enforces ExecPlan schema as a hosted quality gate
  (`Validate versioned ExecPlans`), so plan drift is a build failure, not
  paperwork — discovered when run 37479209183 failed before the known
  dependency-audit step.
- Overview's stat strip is screen-local (not `StatBlock`), which is why W3's
  neutral-stat fix did not change the rendered glance cards; that belongs to
  W5's Today rebuild.

## Decision Log

- D1: evolve existing token exports (no fork) — minimizes churn across ~20
  screens and keeps 14 themes derivable.
- D2: TactileButton deleted; `Button variant="celebrate"` carries the retired
  Pop 3D lip (single press-physics implementation).
- D3: five-destination phone navigation with a W10 evidence gate; six-tab
  fallback documented. Health parents Workout/Calories; both remain
  first-class AppSections so deep links and linked actions keep working.
- D4: screen waves W5–W13 may parallelize across disjoint feature dirs only
  after foundation stabilizes; shared primitives stay single-owner.
- D5: visual regression = curated `toHaveScreenshot` baselines, not every
  state; baseline edits require defect-ledger notes.
- D6: capture affordance = raised center slot in the phone bar / rail header
  action on desktop; floating FAB removed everywhere (SYS-04).
- D7: W4.5 is a convergence pass — Calm Momentum stands unless rendered
  evidence disproves a specific decision.

## Validation Ledger

- W1: `VISUAL_AUDIT=1 npx playwright test e2e/visual-audit.spec.ts` — 5/5
  passes, 47 captures; manual inspection of 12+ key captures.
- W3 (commit `8888084`): typecheck 0 errors; lint 0 errors/0 warnings;
  `validate:themes` all 140 contrast checks pass; `test:unit` 2143/2143;
  quarantine-register-parity OK (entry 24 added); audit re-run 5/5.
- W4 (commit `282bfce`): typecheck 0; lint 0/0; themes 140/140 (incl. new
  health accent); unit 2143/2143; journey-label-parity OK (5-label rail);
  chromium: todos+workout+calories 24 passed, habits+pomodoro+overview+
  boundary+theming 44 passed; visual-audit 5/5 with new Health captures.
- W4.5 (full local gate, post-corrections): typecheck 0 errors; lint 0/0;
  validate:themes 140/140; openspec:validate 73/73; agent:plan:validate:all
  120 PASS / 0 FAIL (frontend-v3-calm-momentum PASS); npm test (unit +
  integration) 2546/2546 across 252 files; chromium suites todos/workout/
  calories/habits/pomodoro/overview/theming/boundary 77 passed; visual-audit
  5/5 with re-inspected captures (1280 rail groups, 390 Health without Focus,
  768 24px gutter); new touch-target contract suite 6/6.

## Changed Files / Areas

- `docs/ui-ux/13-calm-momentum-design-system.md` — V3 design authority (new)
- `docs/ui-ux/14-v3-reference-ledger.md` — Refero decisions + lock (new)
- `docs/ui-ux/15-v3-defect-ledger.md` — 33 defects with status tracking (new)
- `docs/ui-ux/v3-audit/` — 47+ audit captures (evidence, committed)
- `docs/testing/known-gaps.md` — entry 24 registers the VISUAL_AUDIT lane
- `e2e/visual-audit.spec.ts` — permanent rendered-truth harness (new)
- `core/theme/designTokens.ts`, `core/theme/tokens.ts`,
  `core/theme/createTheme.ts` — V3 values; canvasTint removed
- `core/ui/Screen.tsx`, `core/ui/Button.tsx`, `core/ui/Card.tsx`,
  `core/ui/PageHeader.tsx`, `core/ui/StatBlock.tsx`, `core/ui/PillChip.tsx`,
  `core/ui/SegmentedControl.tsx`, `core/ui/EmptyStateCard.tsx` — V3 rebuilds
- `core/ui/SectionLabel.tsx` — new primitive; `core/ui/TactileButton.tsx`
  deleted (absorbed by Button celebrate)
- `features/overview/OverviewScreen.tsx` — wash removal
- `features/gamification/RewardCelebrationOverlay.tsx` — Button celebrate
- `app/index.tsx` — five-destination shell + capture slot
- `features/health/HealthScreen.tsx` — new Health parent surface
- `core/providers/navigationContext.ts`, `core/providers/NavigationProvider.tsx`
  — `health` AppSection wiring
- `constants/sectionColors.ts` — health accent (all 14 themes derive)
- `features/command/commandCenterConfig.ts` — health launch context
- `e2e/helpers/navigation.ts`, `e2e/helpers/oracles.ts` — Health routing
- `tests/journeyLabelParity.test.ts` — 5-label rail pin
- `openspec/changes/frontend-v3-calm-momentum/*` — campaign plan artifacts

## Recovery / Resume Instructions

- Fresh session: run `npm run agent:resume -- --plan
openspec/changes/frontend-v3-calm-momentum/execplan.md`, then
  `git status --short` / `git log --oneline -5` and reconcile against the
  checkpoint above before editing anything.
- If hosted CI fails at "Validate versioned ExecPlans": run
  `npm run agent:plan:validate:all` locally, fix the named plan sections
  against `scripts/agent-execplan.mjs` aliases, re-run until PASS.
- Local render/audit lanes: `npm run build:e2e` then
  `E2E_PORT=8083 VISUAL_AUDIT=1 npx playwright test e2e/visual-audit.spec.ts`
  (8081 is the owner's unrelated dev server — never kill PID-tree 42924).
- Resume point after W4.5: checkpoint flips to W5; exact next action
  "5.1 orientation-first Today layout" in `features/overview/`.

## Outcomes & Retrospective

- Campaign is mid-flight (W4.5). Outcome so far: the rendered product no
  longer shows slab headers, FAB-over-content collisions, the desktop wash
  arc, or cramped six-tab navigation; verification is screenshot-backed at
  every wave instead of assertion-only.
- What worked: rendered-truth-first auditing (W1) before any redesign; a
  single-owner foundation wave; committing per wave with green gates.
- What to keep doing: inspect screenshots visually at every wave; record
  defects with evidence; never loosen a gate to pass.
