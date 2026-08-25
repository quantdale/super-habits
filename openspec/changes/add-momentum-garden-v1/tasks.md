## 1. Durable setup and source audit

- [x] 1.1 Create the `features/momentum/` module boundary and record the exact source tables, caps, local-date windows, and no-persistence decision in the implementation ExecPlan.
- [x] 1.2 Validate the proposal, delta spec, design, and task checklist with strict OpenSpec validation before implementation.

## 2. Pure Momentum domain

- [x] 2.1 Define typed source facts, per-area contributions, day/history models, milestone facts, accessibility summaries, and explicit query/visual caps.
- [x] 2.2 Implement bounded local-calendar date-window helpers using sanctioned time utilities and injected `todayKey` support.
- [x] 2.3 Implement deterministic contribution mapping for Tasks, Habits, Focus, Workout, Nutrition, Planning, Review, and factual Goal/Project milestones, including canonical habit schedule/lifecycle semantics and anti-farming caps.
- [x] 2.4 Add pure domain tests for empty, one-domain, multi-domain, soft-deleted/invalid facts, habit off-days and quantitative targets, completed versus incomplete sessions, nutrition neutrality, planning/review, milestones, caps, inactivity/returning, seven-day boundaries, and timezone-sensitive timestamps.

## 3. Read-only SQLite model

- [x] 3.1 Implement bulk, bounded source SELECTs in `momentum.data.ts` using the singleton database and UTC bounds derived from local date keys.
- [x] 3.2 Ensure the collector filters active/deleted state correctly, limits high-volume reads, never writes/enqueues sync, and feeds the pure domain model without feature-specific N+1 queries.
- [x] 3.3 Add real-SQLite integration coverage that seeds representative source rows, compares the read model with authoritative facts, verifies soft-delete and boundary behavior, and proves viewing leaves the outbox unchanged.

## 4. Native-safe Garden visuals and accessibility

- [x] 4.1 Implement original compact SVG garden geometry with independently colored source beds, level-based growth, light/dark semantic tokens, and bounded layout suitable for native and web.
- [x] 4.2 Add reduced-motion parity and brief causal feedback only where useful; keep static rendering fully understandable and do not modify FocusSprout timer behavior.
- [x] 4.3 Implement accessible textual summaries, decorative-SVG exclusion, semantic roles/labels, visible keyboard focus, and touch-sized detail controls.

## 5. Overview Today integration

- [x] 5.1 Implement the compact `MomentumCard` using the Today model, factual contribution/neutral empty copy, and a `View garden` action into the existing Progress Planning Hub view.
- [x] 5.2 Integrate the compact card into Overview’s existing refresh/error/loading hierarchy without removing pinned Today content, customization, metrics, Quick Capture, or Planning access.
- [x] 5.3 Refresh the compact Garden on foreground/day-rollover paths and verify it remains restrained for zero-data and one-domain users.

## 6. Progress/detail integration

- [x] 6.1 Implement the deferred `MomentumDetailView` with Today context, seven-day history, optional bounded 28-day context, source explanations, milestones, and returning-user copy.
- [x] 6.2 Mount the detail view inside the existing Planning Hub Progress view without adding a primary navigation destination or duplicating Progress charts.
- [x] 6.3 Verify detail loading, refresh/error/empty states, keyboard operation, assistive labels, reduced-motion parity, and no source mutation.

## 7. Documentation and targeted journey proof

- [x] 7.1 Update the Warm Momentum roadmap/acceptance documentation to mark Phase 4.4 implemented and document the exact derived contribution semantics and non-goals.
- [x] 7.2 Add targeted Playwright coverage for empty state, meaningful action growth, multi-domain rendering, reload determinism, deeper-view navigation, read-only viewing, reduced motion, and keyboard/accessibility affordances.
- [x] 7.3 Update QA impact metadata if required and preserve any pre-existing or environmental failures using the repository taxonomy.

## 8. Focused validation and delivery

- [x] 8.1 Run focused Momentum unit/integration tests, relevant feature tests, timezone coverage, typecheck, lint, and `git diff --check`; fix implementation regressions without weakening assertions.
- [x] 8.2 Build the web export and run the targeted E2E journey against the current export; classify any failures and rerun after fixes.
- [x] 8.3 Attempt the applicable native smoke/targeted lane and record native evidence or an explicit ENVIRONMENT blocker.
- [x] 8.4 Run strict OpenSpec validation, ExecPlan validation, and the current `qa:affected` escalation before finalizing.
- [ ] 8.5 Re-fetch/reconcile `main`, commit the complete campaign with a detailed session-report body, push to `origin/main` without force, and verify clean-tree and local/remote SHA parity.
