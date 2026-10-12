# ExecPlan: W11 — Planning / Goals / Projects / Daily Plan

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Complete Frontend V3's W11 planning overhaul: easier scanning and editing
across Goals, Projects and Daily Plan, shared objective/status/next-action
grammar, progressive disclosure instead of dense permanent configuration,
and measurable preservation of SQLite-backed planning behaviors.

## Context

- Baseline main = `6e5fc86496a0f657549104a227a46200d4fdf472`;
  W10.5 PR #71 code + PR #72 records already merged.
- Parent authority: `openspec/changes/frontend-v3-calm-momentum/{tasks,design,execplan}.md`,
  `docs/ui-ux/13-calm-momentum-design-system.md`.
- The Planning Hub is an overlay with Today/Projects/Goals/Progress/Timeline;
  `PlanningHubScreen` owns the view switching. `DailyPlanView` and guided
  planning each use explicit-save semantics and draft-arbitrated loading.
- Baseline Project/Goal list filters and sort controls dominate the first
  viewport; the Daily Plan editor shows optional fields and up to 12
  priority choices on initial render.
- Read-only design references: Things (primary calm precision), Todoist
  project list (rows), Structured day timeline (task-first), Asana (quiet
  grouping). No new palette or imagery.
- W11 OpenSpec spec: `specs/planning-hierarchy/spec.md`.

## Scope

- `features/goals/*View.tsx`, `features/projects/*View.tsx`,
  `features/daily-plan/DailyPlanView.tsx`, presentation component under
  `features/planning-hub/`; required tests/evidence/records.
- Preserve all existing labels needed by tests and assistive tech.

## Non-Goals

- No domain logic changes, DB schema/queries/migrations, save semantics,
  sync/outbox/backup, Supabase, navigation-tab changes, dependencies,
  security allowlists, or W12 Progress/Activity redesign.
- Do not claim native device or full release certification. W16 Android
  pending; iOS owner-deferred.

## Current Checkpoint

- Current milestone: M4 — W11 UI implementation and 82-image before/after evidence are committed on PR #73; core and browser regressions under exact-head validation. M5 merge/handoff is pending.
- Completed: plan-first design/reference lock and OpenSpec; shared Goals/Projects objective/status/context/progress rows and hidden filter controls with persisted selection; details prioritize objective/progress, optional metadata/associations remain accessible; Daily Plan prioritizes intention/top tasks/Save with picker, planning extras and reflection behind disclosures. Today's five-stat briefing moved behind one accessible control after rendered review. Fixed Goal +/- buttons displaying stale manual percentage. All seven targeted browser tests PASS; 39 baseline and 43 after screenshots checked into PR branch.
- In progress: final exact-head quality gates (one JSX apostrophe lint fix added) and close visual review / publication.
- Important modified files: `features/planning-hub/{PlanningHubScreen,PlanningSummaryRow}.tsx`, `features/goals/{GoalListView,GoalDetailView}.tsx`, `features/projects/{ProjectListView,ProjectDetailView}.tsx`, `features/daily-plan/DailyPlanView.tsx`, `e2e/planning-w11.spec.ts`, opt-in visual audit and its 82 captures, `docs/testing/known-gaps.md`, W11 OpenSpec/ExecPlan.
- Last successful validation: W11 independent hosted Chromium `38287180079` — 7/7 Planning+W11 journeys PASS, including real-SQLite create/goal-progress/save/complete and disclosure regression. Visual workflow `38287180103` — PASS: recaptured final 43 W11 after images while preserving 39 earlier baseline images. Prior standard W11 CI `38285465071` — frontend quality through unit/integration PASS, then inherited dependency audit red. Latest `38287180469` found one JSX-unescaped-apostrophe lint failure; corrected in the current change and awaits new CI run.
- Current failures: inherited `braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv keep the standard CI audit red / E2E-nightly skipped. JSX lint apostrophe fixed after run `38287180469`, awaiting rerun. Prior parity registration failure for the opt-in `planning-w11-audit` was fixed via `docs/testing/known-gaps.md`. No known E2E functional failures.
- Relevant quarantines: existing only; no new gate changes.
- Blockers: None for the browser W11 scope: targeted hosted Chromium and rendered-before/after evidence executed independently of audit gating. Native Android API36 and iOS remain outside W11 scope. Broad standard hosted E2E/nightly still blocked by inherited dependency audit.
- Condition required to unblock: Dependency advisories must be separately remediated before standard hosted E2E/nightly; native-device certification is W16/owner-deferred.
- Exact resume action after unblock: Run standard full E2E/nightly when inherited audit is green, and W16 Android qualification when the device target is ready.
- Exact next action: Run and inspect final hosted CI for the current W11 branch, inspect the finished visual matrix, remove the three temporary GitHub workflows, review PR #73, and merge only if W11 contracts remain green.
- Remaining definition of done: all W11 tasks and design/spec contracts
  implemented and E2E-validated, runtime evidence audited, reviews resolved,
  PR merged, parent checkpoint reconciled; inherited security residuals
  visible and not waived.

## Progress

- [x] M1 — repository/source/ref preflight + design-locked OpenSpec slice
- [x] M2 — Goals/Projects compact rows, progressive filters and detail options
- [x] M3 — Daily Plan intention/priority first, optional planning/reflection
- [x] M4 — independent browser 7/7 and 82 matched captures produced and representative states inspected; review/CI closure still pending
- [ ] M5 — publication, parent checkpoint and W12 handoff

## Surprises & Discoveries

- W11 sits inside a Planning Hub overlay rather than a primary tab, so
  overlay scroll height and form density are more important than new tabs.
- The existing Goals and Projects list accessible names are relied on by
  `e2e/planning-hub.spec.ts`; preserve them during UI reconstruction.
- `DailyPlanView` protects in-flight edits with `createEditableFieldOwner`.
  Disclosure toggles must never reset the draft.

## Decision Log

- 2026-10-13 — Keep existing V3 tokens and Nunito; borrow Things'
  readability and Todoist's content hierarchy, not marketing chrome.
- 2026-10-13 — Use collapsible secondary controls while preserving
  underlying data contracts, accessible names and non-default selection state.

## Validation Ledger

- 2026-10-13 — Connected GitHub read-only source review — PASS for
  baseline inventory, not a runtime certification.
- 2026-10-13 — Refero styles and screens research — PASS for reference lock.
- 2026-10-13 — Local checkout tests — NOT RUN; hosted validation used instead.
- 2026-10-13 — GitHub Actions standalone Planning E2E `38285465187` and `38287180079` — PASS 7/7 each, real SQLite; no retry-gated failure reported.
- 2026-10-13 — GitHub Actions W11 visual capture `38286186313` and final recapture `38287180103` — PASS; 39 baseline and 43 after images versioned in repo.
- 2026-10-13 — W11 quality through unit/integration `38285465071` — PASS before inherited audit-only red; later parity and JSX-lint setbacks corrected by registered opt-in gate and escaped JSX copy, fresh CI pending.

## Changed Files / Areas

- `openspec/changes/frontend-v3-w11-planning/` — spec-driven slice and records.
- `features/planning-hub/`, `features/goals/`, `features/projects/`, `features/daily-plan/DailyPlanView.tsx` — W11 hierarchy, shared rows and editor disclosure.
- `e2e/planning-w11.spec.ts`, `e2e/planning-w11-audit.spec.ts` and `docs/ui-ux/v3-audit/w11/` — real SQLite/Playwright and visual evidence.
- `docs/testing/known-gaps.md` — structured opt-in visual gate registration.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan and W11 specs.
2. Reconcile `git status --short`, branch, diff against base main and
   `npm run agent:resume -- --plan openspec/changes/frontend-v3-w11-planning/execplan.md`.
3. Run affected QA, continue from Exact next action, and record honest
   executed versus skipped gates.

## Outcomes & Retrospective

- Status: ACTIVE.
- Summary: W11 implementation landed on isolated branch and passed dedicated 7/7 browser journeys. Awaiting exact-head CI review and PR merge; not yet certified complete.
- Follow-up: W12 Weekly Review/Progress/Activity after W11 certification.
