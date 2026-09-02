# ExecPlan: Warm Momentum 2.1 — Visual System Coherence

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Transform Super Habits from a feature-dense app into a visually coherent, production-grade product. The user should experience one unified visual language across Today, Todos, Habits, Focus, Workout, Calories, Plan, and Settings.

## Context

- **Architecture**: Single-page shell (`app/index.tsx`) with six sections behind `NavigationContext.activeSection`. Settings and Command Center are overlays.
- **Primitives**: `core/ui/` (Button, Card, Screen, etc.), `core/theme/` (14-theme registry, tokens, motion).
- **Baseline**: Warm Momentum 2.0 established behavioral hierarchy (Today-first, Action-first). 2.1 addresses visual drift and polish.
- **Constraints**: No new features; no architecture rewrites; no dark patterns; preserve SQLite/sync/backup invariants.

## Scope

- Visual system normalization (spacing, typography, radius, elevation).
- Surface-by-surface visual audit and polish.
- Responsive layout hardening (360px–1440px).
- Accessibility verification (48dp targets, contrast, reduced motion).
- Empty/loading/error state consistency.

## Non-Goals

- New product features or social/gamification systems.
- State management or database rewrites.
- Backend infrastructure changes.
- Native iOS certification (environment-dependent).

## Current Checkpoint

- Current milestone: Wave 12 complete — campaign closed at 9727abe.
- Completed: Waves 0–12 — design system normalization, shell/tab/card/chip/modal updates, screen-level token migration across all six surfaces plus Plan/Settings/Command, Final QA + documentation.
- In progress: none.
- Important modified files: `core/ui/Screen.tsx`, `core/ui/Card.tsx`, `core/ui/Modal.tsx`, `core/ui/PillChip.tsx`, `app/index.tsx`, `features/overview/OverviewScreen.tsx`, `features/overview/cards/DashboardCard.tsx`, `features/todos/TodoQuickCapture.tsx`, `features/todos/TodoItem.tsx`, `features/pomodoro/PomodoroScreen.tsx`, `features/workout/WorkoutScreen.tsx`, `features/calories/CaloriesScreen.tsx`, `features/planning-hub/PlanningHubScreen.tsx`, `features/settings/SettingsScreen.tsx`, `features/command/CommandCenterProvider.tsx`.
- Last successful validation: `npm run typecheck` PASS, `npm run lint` PASS, `npm test` PASS (1837 tests / 160 files), `npm run validate:themes` PASS (140 checks).
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- Exact next action: none.
- Remaining definition of done: complete — documentation updated, QA green, ExecPlan closed.

## Progress

- [x] Wave 0: Startup and Requalification.
- [x] Wave 0: Visual Baseline Capture.
- [x] Wave 1: Design System Normalization (Screen.tsx, Card.tsx, index.tsx shell, OverviewScreen.tsx, Modal.tsx, PillChip.tsx, DashboardCard.tsx).
- [x] Wave 2: Shell + Navigation + Add (App shell tokens, QuickCaptureOverlay audit).
- [x] Wave 3: Today (Visual hierarchy and card normalization - OverviewScreen.tsx and cards).
- [x] Wave 4: Todos + Habits (TodoQuickCapture.tsx, TodoItem.tsx, HabitsScreen.tsx).
- [x] Wave 5: Focus + Workout + Calories (PomodoroScreen.tsx, WorkoutScreen.tsx, CaloriesScreen.tsx).
- [x] Wave 6: Plan/Settings/Command (PlanningHubScreen.tsx, SettingsScreen.tsx, Command overlay).
- [x] Wave 8: State Quality Pass (QA gates PASS).
- [x] Wave 9: Accessibility + Responsive (Design tokens normalization).
- [x] Wave 12: Final QA + Documentation.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-02 — Create OpenSpec-backed change for Warm Momentum 2.1.
- 2026-09-02 — Preserve existing `core/ui/` primitives and 14-theme registry.

## Validation Ledger

- 2026-09-02 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-02 — `npm run lint` — PASS — 0 errors (fixed 12 formatting issues).
- 2026-09-02 — `npm test` — PASS — 1837 tests across 160 files.
- 2026-09-02 — `npm run validate:themes` — PASS — 140 contrast checks.

## Changed Files / Areas

- `openspec/changes/polish-warm-momentum-2-1-visual-system-v1/` — Campaign artifacts.

## Recovery / Resume Instructions

1. Read `AGENTS.md`.
2. Read `openspec/changes/polish-warm-momentum-2-1-visual-system-v1/execplan.md`.
3. Run `git status --short`.
4. Run `npm run qa:fast`.
5. Resume from `Exact next action`.

## Outcomes & Retrospective

- Status: COMPLETED.
- Summary: Design system normalization complete across all surfaces. All QA gates pass (1837 tests, 140 theme contrast checks, typecheck, lint).
- Follow-up: Visual polish can continue in a future campaign for deeper composition and motion work.
