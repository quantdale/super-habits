# Warm Momentum 2.1 — Tasks

## 1. Baseline and campaign setup

- [x] 1.1 Read `AGENTS.md`, `.agent/PLANS.md`, `docs/PROJECT_STRUCTURE_MAP.md`, `.cursorrules`, `.cursor/rules/superhabits-rules.mdc`, UI skills, and the UI/UX doc set (README, design DNA, warm-momentum-2, IA, friction inventory, disposition ledger, mobbin ledger).
- [x] 1.2 Read the predecessor ExecPlan and QA/impact/simulation/native docs; run `git status`, fetch/prune, branch/ref inspection, `npm run agent:plans`.
- [x] 1.3 Create the OpenSpec change `polish-warm-momentum-2-1-visual-system-v1` with proposal and Version-2 ExecPlan (`Status: ACTIVE`).
- [x] 1.4 Re-qualify current HEAD: typecheck, lint, vitest, theme contrast, impact-map validation, OpenSpec validation.

## 2. Visual baseline

- [x] 2.1 Build the web export and capture a current-state screenshot baseline across phone (360/390/412), tablet, and desktop viewports for the six sections.
- [x] 2.2 Persist the baseline under `docs/ui-ux/baseline-screenshots/` and record the source SHA.

## 3. Design system normalization

- [x] 3.1 Normalize `core/ui/Screen.tsx` onto `spacing`/`layout` tokens.
- [x] 3.2 Normalize `core/ui/Card.tsx` default padding onto `spacing.lg`.
- [x] 3.3 Normalize `core/ui/PillChip.tsx` onto `radius.full`/`spacing`/`size.touchTargetMin`.
- [x] 3.4 Rename `Modal` layout prop to `modalLayout` and thread through all call sites; normalize its spacing/radius/layout tokens.
- [x] 3.5 Tokenize the shell tab rail in `app/index.tsx` (spacing, radius, touch target).
- [x] 3.6 Tokenize `OverviewScreen` content shell and rename local `layout` state to `cardLayout`.
- [x] 3.7 Tokenize `DashboardCard` (icon tile, padding, radius).

## 4. Feature surfaces

- [x] 4.1 Todos: tokenize `TodoQuickCapture` input/button and `TodoItem` list row spacing.
- [x] 4.2 Habits: token alignment verified on `HabitsScreen` (no visual regression).
- [x] 4.3 Focus: `PomodoroScreen` token alignment verified.
- [x] 4.4 Workout: `WorkoutScreen` token alignment verified.
- [x] 4.5 Calories: `CaloriesScreen` token alignment verified.
- [x] 4.6 Plan: tokenize `PlanningHubScreen` tab pills (radius/spacing/touch target).
- [x] 4.7 Settings: tokenize the Back control (spacing/radius/touch target).
- [x] 4.8 Command: `CommandCenterProvider` uses `modalLayout` for drawer/bottom-sheet.

## 5. State and accessibility hardening

- [x] 5.1 Verify empty/loading/error/success states remain truthful (no empty-masquerading-as-loading).
- [x] 5.2 Verify 48dp touch targets, semantic labels, and theme contrast (140 checks).

## 6. Documentation and validation

- [x] 6.1 Add `design.md`, `tasks.md`, and `specs/ui-ux-visual-coherence/spec.md` to the OpenSpec change.
- [x] 6.2 Add `docs/ui-ux/08-warm-momentum-2-1.md` and update the UI/UX README doc map.
- [x] 6.3 Add the visual friction matrix / screenshot manifest under `docs/ui-ux/`.
- [x] 6.4 Run the final gate set: typecheck, lint, vitest, theme contrast, impact-map validation, simulation validation, OpenSpec validation.
- [x] 6.5 Independent verification agent: PASS (typecheck, lint, 1837 tests, 140 contrast, web bundle, token/prop probes).
- [x] 6.6 Mark ExecPlan `Status: COMPLETED`, commit, push to `origin/main`, verify clean tree and local/remote SHA parity.
