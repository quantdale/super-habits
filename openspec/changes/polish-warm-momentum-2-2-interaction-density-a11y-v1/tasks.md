# Warm Momentum 2.2 — Tasks

## 1. Baseline and campaign setup

- [ ] 1.1 Re-qualify current HEAD (typecheck, lint, vitest, openspec, impact map, themes, build) after Phase A.
- [ ] 1.2 Audit all mutually-exclusive selection controls (Planning Hub tabs, Habits status chips, Calories Form/Diary selector, Command mode selector, Workout subview selector, Pomodoro/Focus sub-controls) and classify each as segmented / filter chip / status badge / action chip.
- [ ] 1.3 Capture current-state screenshot baseline (phone 360/390/412, tablet 600/768/820, desktop 1024/1440) for Planning Hub, Habits, Calories Diary, Workout; persist manifest with source SHA.
- [ ] 1.4 Create the OpenSpec change `polish-warm-momentum-2-2-interaction-density-a11y-v1` with proposal.md, design.md, tasks.md, `specs/ui-ux-interaction-density-a11y/spec.md`, and a Version-2 ExecPlan (Status: ACTIVE); run `openspec validate` before implementation.

## 2. Shared segmented-control primitive

- [ ] 2.1 Implement `core/ui/SegmentedControl.tsx` (typed options, selected/disabled, accessible role/state, keyboard arrows on web, focus ring, ≥48dp targets, theme tokens, wrap/scroll behavior).
- [ ] 2.2 Add component/behavior tests for SegmentedControl (selected semantics, disabled option, keyboard activation, large-label wrapping).
- [ ] 2.3 Confirm semantic boundary: filter chips stay `PillChip`, status badges stay informational, action chips stay explicit actions.

## 3. Planning Hub migration

- [ ] 3.1 Migrate Planning Hub tabs (Today, Projects, Goals, Progress, Timeline) onto SegmentedControl; state model unchanged.
- [ ] 3.2 Validate Planning Hub: selected semantics, keyboard nav, screen-reader announcement, large-text/tablet behavior; run planning E2E.

## 4. Habits control migration

- [ ] 4.1 Classify Habits status selector (Active/Paused/Archived/All); migrate to SegmentedControl only if single-select; otherwise keep distinct chip group.
- [ ] 4.2 Keep sort/manage, day-strip date selection, and status badges visually distinct from the filter.
- [ ] 4.3 Run Habits filter/state/schedule/completion E2E; validate large text.

## 5. Calories Diary dense / tablet composition

- [ ] 5.1 Deep-audit Calories Diary: date navigation, totals, meal groups, entry cards, saved/recent meals, search, copy-day, edit/delete, empty state, dense multi-meal days, long food names, macro metadata.
- [ ] 5.2 Implement tablet+ composition: summary/context pane + diary content pane; controls live once; empty days rebalance.
- [ ] 5.3 Apply compact row spacing across diary rows (no touch-target shrinkage, no info loss).
- [ ] 5.4 Preserve Form/Diary state, selected date, meal grouping, calculations, persistence, edit/delete, date-key behavior; run calories E2E incl. heavy diary search.

## 6. Workout history / progress dense / tablet composition

- [ ] 6.1 Deep-audit Workout: recent sessions, history, totals, progress, exercise history, body-area summaries, routine cards, PRs, charts; confirm start/resume stays first.
- [ ] 6.2 Implement tablet+ composition: history/analytics secondary panes/grids; keep active workout sequential and focused.
- [ ] 6.3 Apply compact spacing to history rows; no Gym V2 persistence/progression changes.
- [ ] 6.4 Run workout routine/history/session/progress E2E.

## 7. Accessibility / keyboard / large-text re-audit

- [ ] 7.1 Re-audit screen-reader order on touched surfaces (shell, Add, Today, segmented groups, Habits, Focus, Workout, Calories, Settings) and fix tree order to match product hierarchy.
- [ ] 7.2 Verify web keyboard traversal: Tab, Shift+Tab, Enter, Space, arrows for segmented controls, focus visibility, modal focus, reachable close controls.
- [ ] 7.3 Verify large-text resilience (segmented labels, nav, statuses, view selectors) — no clipping, no font-shrink.

## 8. Responsive / density / performance

- [ ] 8.1 Verify viewport matrix (360–1440) for touched surfaces; tablet layouts collapse/rebalance when a pane has no data.
- [ ] 8.2 Performance check: no duplicated SQLite reads/charts/history lists; heavy Calories Diary and Workout history renders; Planning switch and Habits filter change. Profile only if a regression appears.

## 9. Visual evidence

- [ ] 9.1 Persist before/after screenshots: Planning Hub, Habits controls, Calories Diary (empty/typical/heavy × phone/tablet/desktop), Workout (empty/active/history × phone/tablet/desktop), a11y semantic hierarchy evidence for SegmentedControl; manifest with source SHA.

## 10. Documentation and validation

- [ ] 10.1 Add `docs/ui-ux/09-warm-momentum-2-2.md`; update the UI/UX README doc map; update the ExecPlan Checkpoint after each wave.
- [ ] 10.2 Run final gate set: `git diff --check`, typecheck, lint, vitest, `openspec:validate`, `qa:impact:validate`, `validate:themes`, `supabase:schema:validate`, `agent:plan:validate:all`, `sim:validate`, `build:web`, `web:verify` (exits by itself, port released), applicable Playwright suite, deterministic simulation if impacted, responsive screenshot matrix, accessibility/focus walkthrough, native lanes if available (classify truthfully otherwise).
- [ ] 10.3 Independent verification agent: PASS on the campaign's definition of done.
- [ ] 10.4 Mark ExecPlan `Status: COMPLETED`, commit, push to `origin/main`, verify clean tree and local/remote SHA parity, `npm run web:hygiene` PASS.
