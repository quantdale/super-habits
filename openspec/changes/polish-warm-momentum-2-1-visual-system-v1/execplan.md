# ExecPlan: Warm Momentum 2.1 — Visual System Coherence

Plan-Version: 2
Status: ACTIVE

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

- Current milestone: Wave 0 — Baseline and Visual Audit.
- Completed: Startup checklist, quality gates (typecheck/lint/vitest/themes PASS), proposal created.
- In progress: Visual baseline capture.
- Important modified files: `openspec/changes/polish-warm-momentum-2-1-visual-system-v1/`.
- Last successful validation: `npm test && npm run validate:themes` (PASS).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Exact next action: Capture visual baseline screenshots (Web) and produce Visual Friction Matrix.
- Remaining definition of done: All surfaces polished, accessibility verified, QA green, screenshots documented, ExecPlan COMPLETED.

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
- [ ] Wave 12: Final QA + Documentation.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-02 — Create OpenSpec-backed change for Warm Momentum 2.1.
- 2026-09-02 — Preserve existing `core/ui/` primitives and 14-theme registry.

## Validation Ledger

- 2026-09-02 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-02 — `npm run lint` — PASS — 0 errors (fixed 12 formatting issues).
- 2026-09-02 — `npm test` — PASS — All vitest tests pass.
- 2026-09-02 — `npm run validate:themes` — PASS — 140 contrast checks pass.

## Changed Files / Areas

- `openspec/changes/polish-warm-momentum-2-1-visual-system-v1/` — Campaign artifacts.

## Recovery / Resume Instructions

1. Read `AGENTS.md`.
2. Read `openspec/changes/polish-warm-momentum-2-1-visual-system-v1/execplan.md`.
3. Run `git status --short`.
4. Run `npm run qa:fast`.
5. Resume from `Exact next action`.

## Outcomes & Retrospective

- Status: Active.
- Summary: Campaign initialized, baseline established.
- Follow-up: Visual audit and design system normalization.
