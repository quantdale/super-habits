# ExecPlan: Warm Momentum 2.2 — Interaction Primitives, Tablet Density, Accessibility Order

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Warm Momentum 2.1 normalized the visual system; 2.2 makes interactions
consistent and dense surfaces tablet-ready. One shared `SegmentedControl`
replaces bespoke single-select implementations (Planning Hub tabs, Habits
status selection where single-select); Calories Diary and Workout
history/progress gain tablet multi-column composition that keeps primary
actions first; screen-reader order, keyboard traversal, and large-text
resilience are re-audited on touched surfaces. Presentation-layer only.

## Context

- Predecessor: Warm Momentum 2.1 completed at 9727abe; Phase A of this
  campaign (agent-safe web lifecycle) landed at dc3be75 on origin/main.
- 2.1 friction matrix deferred: shared SegmentedControl primitive; tablet
  multi-column layouts for dense diaries/workout history; deeper
  composition for Calories Diary and Workout history; screen-reader
  order re-audit after tokenization.
- Baseline: `main` @ dc3be75, clean worktree. Existing primitives:
  `core/ui/` (Button, Card, Screen, ScreenSection, EmptyStateCard,
  FeatureStatCard, PillChip, MenuSheet, Modal), `core/theme/designTokens.ts`
  tokens, 14-theme registry, 140 contrast checks.
- Product contracts to preserve: Today-first hierarchy, six direct
  sections, one global Add, Add → Describe it, current route architecture,
  SQLite/domain contracts, theme catalog, accessibility minimums.

## Scope

- `core/ui/SegmentedControl.tsx` (new shared primitive; typed options,
  selected/disabled, a11y role/state, web keyboard arrows, focus ring,
  ≥48dp targets, theme tokens, wrap/scroll).
- Planning Hub tabs migration (state model unchanged).
- Habits selection control clarification (segmented vs filter chip vs
  badge vs action chip).
- Calories Diary dense rows + tablet summary/diary panes (single
  responsive tree, no duplicated controls/reads, empty-pane rebalance).
- Workout start/resume-first + tablet history/analytics panes/grids
  (no Gym V2 semantic changes).
- Screen-reader order fixes (tree order only), keyboard traversal
  verification, large-text resilience.
- Internal density vocabulary (comfortable/compact) on touched surfaces;
  no user-facing density setting.
- OpenSpec artifacts: proposal.md, design.md, tasks.md,
  specs/ui-ux-interaction-density-a11y/spec.md, this execplan.
- Docs: docs/ui-ux/09-warm-momentum-2-2.md + UI/UX README map update.
- Visual evidence: before/after screenshot matrix + a11y hierarchy
  evidence, manifest with source SHA.

## Non-Goals

- New product features (habits, workout programming, nutrition, sync,
  navigation destinations, AI, analytics, gamification, subscriptions).
- Revisiting solved WM2.0/2.1 decisions without evidence of regression.
- Domain/data/sync/backup/account/migration changes.
- A user-facing density setting; pixel-perfect screenshot tests.
- Native iOS certification (Windows environment).

## Current Checkpoint

- Current milestone: Campaign closed — independent verification agent
  returned PASS on all 12 checks (git/typecheck/lint/tests/openspec/plans/
  themes/impact-map/web:verify-finiteness/code-audit/evidence/hygiene).
- Completed: Phase A pushed (dc3be75); WM2.2 OpenSpec artifacts validated;
  B1 control audit (SegmentedControl primitive existed but had ~37px touch
  target, no disabled/keyboard; zero adopters); B2 primitive upgraded
  (minHeight=touchTargetMin, disabled option, web arrow-key nav + focus
  ring, flex-wrap large-text) + pure navigation model + 8 unit tests; B3
  Planning Hub tabs migrated; B4 Habits status filter migrated (single-
  select) + moved ABOVE the list (was after the list + stats → SR
  contradiction) while sort/management stays a distinct chip group; B5
  Calories Diary tablet composition (summary pane + diary pane, single
  tree, controls once); B6 Workout tablet composition (history/analytics
  two-column grid under start/resume-first sections); B7 a11y re-audit +
  keyboard focus probe (hidden-focus=0, tab order matches hierarchy);
  B8 large-text (segmented flex-wrap, no clipping by design).
- In progress: rebuild dist with the final habits reorder; re-capture the
  WM2.2 evidence matrix; write docs/ui-ux/09-warm-momentum-2-2.md + README
  map; then run the full gate set, independent verification, git closure.
- Modified files: core/ui/SegmentedControl.tsx,
  core/ui/segmentedControl.model.ts, tests/segmented-control.model.test.ts,
  features/planning-hub/PlanningHubScreen.tsx, features/habits/HabitsScreen.tsx,
  features/calories/CaloriesScreen.tsx, features/calories/CaloriesDiaryView.tsx,
  features/pomodoro/PomodoroScreen.tsx, features/workout/WorkoutScreen.tsx,
  scripts/capture-wm22-evidence.js, scripts/a11y-focus-probe.mjs,
  docs/ui-ux/warm-momentum-2-2-screenshots/ (evidence),
  openspec/changes/polish-warm-momentum-2-2-interaction-density-a11y-v1/.
- Last successful validation: typecheck 0 errors; lint 0 errors; Vitest
  unit 1637/1637 + model 8/8; build:web exit 0 (with calories/workout
  tablet changes; pending rebuild with habits reorder).
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- Exact next action: none.
- Remaining definition of done: complete — all gates green, verification
  agent PASS, ExecPlan COMPLETED, commits pushed to origin/main.

## Progress

- [x] Wave A0–A5 — Phase A agent-safe web lifecycle (committed dc3be75, pushed).
- [x] Wave B0 — WM2.2 OpenSpec artifacts drafted (proposal/design/tasks/spec/execplan) + validated.
- [x] Wave B0b — openspec validate PASS; plan validate PASS; HEAD re-qualified.
- [x] Wave B1 — selection/control semantic audit ledger (SegmentedControl had gaps + zero adopters; target sizes audited).
- [x] Wave B2 — SegmentedControl upgraded (disabled, 44dp target, web arrow-nav + focus ring, flex-wrap) + pure model + 8 unit tests.
- [x] Wave B3 — Planning Hub tabs migrated.
- [x] Wave B4 — Habits status filter migrated + moved above the list; sort stays distinct chip group.
- [x] Wave B5 — Calories Diary tablet/dense composition (summary pane + content pane).
- [x] Wave B6 — Workout history/progress tablet composition (analytics two-column grid).
- [x] Wave B7 — screen-reader + keyboard re-audit (focus probe HIDDEN_FOCUS_COUNT=0; tab order verified).
- [x] Wave B8 — responsive/large-text refinement (segmented flex-wrap; tablet collapse behavior).
- [x] Wave B9 — performance check (single responsive tree; no duplicated reads confirmed structurally).
- [x] Wave B10 — full visual walkthrough + 18-file evidence matrix + manifest.json.
- [x] Wave B11 — full validation, documentation, Git closure (independent verification agent: PASS on all 12 checks incl. adversarial probes; ExecPlan COMPLETED; pushed).

## Surprises & Discoveries

- A **pre-existing E2E selector break** was discovered during final gates: the
  primary nav was renamed Overview → Today in 0ef426c (2026-09-01, before
  this campaign), but `e2e/helpers/dbHarness.ts` `waitForAppReady` and two
  spec assertions (boundary, fat-fingers) still waited for an "Overview"
  button, so every harness-based journey failed at step 1. Classified
  TEST_BUG (stale selector, not a product bug); fixed by updating the
  selectors to "Today" (labels only, no assertion weakening). The full E2E
  suite had apparently not been run locally since the rename.
- The `SegmentedControl` primitive already existed from 2.1 but had zero
  adopters, a ~37px touch target, no disabled state, and no keyboard
  handling — the audit-first approach prevented building a duplicate.
- Keyboard focus never lands in `aria-hidden` inactive shell sections
  (probe-verified, HIDDEN_FOCUS_COUNT=0) — the 2.1 shell contract holds; no
  shell change needed.
- The predecessor WM2.1 ExecPlan was marked COMPLETED but retained an open
  Wave-12 checkpoint and unchecked progress, failing `agent:plan:validate:all`;
  closed properly during this campaign (content preserved).

## Decision Log

- D1: Shared `SegmentedControl` in `core/ui/` for exactly-one-of-N
  selection; filter chips stay `PillChip`; badges/action chips stay
  distinct (see design.md).
- D2: Planning Hub tabs migrate; state model untouched.
- D3: Habits: single-select status → segmented; multi-select filters,
  sort/manage, day strip, badges stay distinct.
- D4: Tablet composition via one responsive tree (no duplicated reads);
  Calories = summary + diary panes; Workout = start/resume first +
  secondary history/analytics.
- D5: Density discipline internal only (comfortable/compact), no setting.
- D6: A11y fixes via tree order only; no invisible duplicates.
- D7: Presentation-only; E2E selectors updated without weakening.

## Validation Ledger

- Phase A (dc3be75): `npm run typecheck` PASS, `npm run lint` PASS,
  vitest 1856/1856 PASS, `npm run build:web` PASS, `npm run web:verify`
  PASS ×2 (58.7s / 1.9s, port released), `npm run qa:impact:validate`
  PASS (13 rules), `npm run web:hygiene` PASS.
- Phase B (80cf09f / 94ffb9a): typecheck PASS, lint PASS (0 warnings),
  vitest 1864/1864 PASS (162 files, incl. 8 new segmented-model tests +
  19 web-lifecycle tests), validate:themes PASS (140 checks),
  supabase:schema:validate PASS, openspec:validate PASS (47 checks),
  qa:impact:validate PASS, sim:validate PASS, agent:plan:validate:all PASS
  (after closing WM2.1 markers), build:web PASS, web:verify PASS (56.6s,
  shell + crossOriginIsolated + Add, port released).
- Playwright: chromium feature suite 111 passed / 7 skipped (10.3m);
  journeys P0 24/25 passed (1 flake passes in isolation, 5.6s — artifact
  preserved, classified FLAKY_TEST); full journeys lane deferred to CI
  main gate after push.
- Simulation: deterministic smoke @p0 PASS ×2 after the runner race fix
  (c66ba18); sim definitions 23 PASS.
- A11y: focus probe HIDDEN_FOCUS_COUNT=0; tab order matches product
  hierarchy; segmented groups announce group/option/selected.
- Native: NOT RUN / ENVIRONMENT — no Android/macOS infrastructure in this
  session (truthful classification, not a pass).

## Changed Files / Areas

- `openspec/changes/polish-warm-momentum-2-2-interaction-density-a11y-v1/`
  — proposal.md, design.md, tasks.md, specs/ui-ux-interaction-density-a11y/spec.md, execplan.md (new).
- (Planned) `core/ui/SegmentedControl.tsx` + tests; Planning Hub screen;
  Habits screen; Calories screen/diary components; Workout screen/history
  components; docs/ui-ux/09-warm-momentum-2-2.md; UI/UX README map;
  screenshot evidence manifest.

## Recovery / Resume Instructions

- Reread this plan, AGENTS.md, and `git status --short`; reconcile with
  `git log --oneline -3`.
- Resume from the Exact next action. If openspec validate fails, fix the
  missing artifacts (design/tasks/spec delta) before implementing.
- Run `npm run qa:affected` before choosing QA gates for each wave.
- Never await `npm run web`; use `npm run build:web` + `npm run web:verify`
  - Playwright (Phase A rule).

## Outcomes & Retrospective

- Shared `SegmentedControl` (upgraded primitive) adopted by Planning Hub,
  Habits status filter, Calories Form/Diary, and Pomodoro mode; filter
  chips / badges / action chips keep distinct treatments; workout weekly
  plan chips deliberately remain PillChip.
- Habits filter moved above the list (SR-order fix); Calories Diary and
  Workout compose two-column tablets layouts inside the 720px content
  shell; phone layouts unchanged.
- Evidence: 18-screenshot matrix + manifest (docs/ui-ux/warm-momentum-2-2-screenshots/),
  focus probe (HIDDEN_FOCUS_COUNT=0), 140 theme contrast checks.
- Pre-existing journey-suite selector break (Overview→Today rename) found
  and fixed during final gates; see Surprises & Discoveries.
- Native lanes: NOT RUN / ENVIRONMENT — no Android/macOS infrastructure in
  this session (truthful classification, not a pass).
