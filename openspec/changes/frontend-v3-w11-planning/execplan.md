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

- Current milestone: M1 — preflight, research and plan-first slice authored.
- Completed: verified main SHA; read design authority, baseline Planning,
  Goals, Projects and Daily Plan surfaces and existing E2E navigation contracts;
  Refero style/screens research performed and decisions locked.
- In progress: first source implementation of list-first grammar/disclosures.
- Important modified files: this W11 OpenSpec slice only.
- Last successful validation: W10.5 prior-merge typecheck, lint, plans,
  OpenSpec, parity, 2,676 unit/integration PASS / 3 skip (CI 38277711157);
  standalone Calories E2E 26/26 PASS (38277711149).
- Current failures: inherited `braces` GHSA-vfj7-8cjw-p6xm and `node-forge`
  GHSA-86w9-cpqp-85rv cause security audit red and standard hosted E2E/
  nightly skip; no W11-specific failure yet.
- Relevant quarantines: existing only; no new gate changes.
- Blockers: Local repo and emulator not connected to this GitHub-only
  session; browser rendered/Android evidence cannot be asserted from
  source inspection. CI and independent hosted Playwright may be available.
- Condition required to unblock: A runtime test environment for rendered
  checks and native devices for later W16.
- Exact resume action after unblock: Capture honest before/after visual
  matrix and verify accessibility, browser journeys and negative states.
- Exact next action: Implement shared planning list grammar and disclosure
  across Goals, Projects and Daily Plan, then add regression tests and
  inspect hosted CI.
- Remaining definition of done: all W11 tasks and design/spec contracts
  implemented and E2E-validated, runtime evidence audited, reviews resolved,
  PR merged, parent checkpoint reconciled; inherited security residuals
  visible and not waived.

## Progress

- [x] M1 — repository/source/ref preflight + design-locked OpenSpec slice
- [ ] M2 — Goals/Projects compact rows, progressive filters and detail options
- [ ] M3 — Daily Plan intention/priority first, optional planning/reflection
- [ ] M4 — behavioral E2E, visual/a11y QA, adversarial review
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
- 2026-10-13 — Local tests/visual captures — NOT RUN (GitHub-only session).

## Changed Files / Areas

- `openspec/changes/frontend-v3-w11-planning/` — spec-driven slice.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan and W11 specs.
2. Reconcile `git status --short`, branch, diff against base main and
   `npm run agent:resume -- --plan openspec/changes/frontend-v3-w11-planning/execplan.md`.
3. Run affected QA, continue from Exact next action, and record honest
   executed versus skipped gates.

## Outcomes & Retrospective

- Status: ACTIVE.
- Summary: W11 not yet implemented.
- Follow-up: W12 Weekly Review/Progress/Activity after W11 certification.
