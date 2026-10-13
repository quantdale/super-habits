# ExecPlan: W11 — Planning / Goals / Projects / Daily Plan

Plan-Version: 2
Status: COMPLETED

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

- Current milestone: M5 COMPLETE — W11 published through PR #73 on branch `frontend-v3-w11-planning` (implementation `da14d03` + adversarial-review correction `74d4aaf`). Shared planning grammar, progressive disclosure and the failure-surface corrections are merged-side; the parent campaign checkpoint and W12 handoff are recorded in `openspec/changes/frontend-v3-calm-momentum/execplan.md`.
- Completed: plan-first design/reference lock and OpenSpec slice; shared `PlanningSummaryRow` objective/status/context/progress grammar for Goals and Projects; one collapsed `Filters & sort` disclosure per list with persisted selection and an honest active-filter signal; detail editors foreground objective/progress with description, target date, horizon, status, color and associations behind labeled disclosures forwarding both `accessibilityState.expanded` and `aria-expanded`; Daily Plan foregrounds date/status, intention, selected priorities and Save Plan with the candidate picker, planning options, reflection/energy and history behind disclosures; Today's five-stat briefing collapsed behind one disclosure; stale goal percent field after +/- controls fixed; adversarial-review correction added visible failure surfaces for Daily Plan save/complete, Goal/Project delete and Project lifecycle transitions, and reordered project lifecycle to persist-before-refresh so no optimistic status survives a rejected write. Temporary W11-only CI workflows removed after their hosted evidence was recorded.
- In progress: None — W11 is complete; only the publication record (this plan, parent checkpoint, audit register) was finalized in the closing commits.
- Important modified files: `features/planning-hub/{PlanningHubScreen,PlanningSummaryRow}.tsx`, `features/goals/{GoalListView,GoalDetailView}.tsx`, `features/projects/{ProjectListView,ProjectDetailView}.tsx`, `features/daily-plan/DailyPlanView.tsx`, `e2e/planning-w11.spec.ts`, `e2e/planning-w11-audit.spec.ts`, `docs/ui-ux/v3-audit/w11/` (82 captures), `docs/testing/known-gaps.md`, W11 OpenSpec slice and this plan.
- Last successful validation: local exact-head `74d4aaf` (Windows workstation, Node v24.3.0/npm 11.4.2) — `tsc --noEmit` 0 errors; `eslint . --max-warnings 0` 0 errors/0 warnings; Vitest 2,675 passed / 3 skipped with exactly one failure — `tests/agentDocConsistency.test.ts` register-label consistency, proven to fail identically on pristine `main` (`core.autocrlf=true`, no `.gitattributes`, the documented Windows-CRLF environment residual, AGENTS.md §9) and NOT a W11 defect; integration project separately 416 passed / 2 skipped (real better-sqlite3); `validate:themes` 140/140; `openspec validate --all` 80/80; `agent:plan:validate:all` PASS; journey-label-parity OK; quarantine-register-parity OK; release-profile-guard OK; hermetic `build:e2e` OK (0 Supabase hosts); `npx playwright test --project=chromium e2e/planning-w11.spec.ts e2e/planning-hub.spec.ts` 7/7 PASS; `e2e:journeys:p0` 25/25 PASS; `qa:simulation` deterministic PASS. Hosted evidence from the prior W11 sessions: independent Planning browser lanes `38285465187` and `38287180079` 7/7 PASS on real SQLite; visual recapture `38287180103`; push-run CI `38288163819`/`38288169951` showed every quality step PASS before the first failing step `Audit runtime dependencies` on the two inherited advisories.
- Current failures: inherited `braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv keep the standard hosted audit red with e2e/nightly skipped behind it; local Windows-CRLF register-parse residual (fails on main too); pull_request-triggered hosted runs on this branch sat at `action_required` (bot-triggered run approval), so the final exact-head hosted evidence comes from the push-event run at the merged head. No new functional failure is known.
- Relevant quarantines: existing only; the opt-in `planning-w11-audit` gate stays registered in `docs/testing/known-gaps.md`; no new quarantine, no gate change.
- Blockers: None for the W11 browser scope. Native Android API36 qualification is W16 and iOS is owner-deferred; both remain OUTSIDE W11 and are not claimed from browser evidence. Full application certification is not claimed.
- Exact next action: none — W11 is complete. Recovery/resume: read AGENTS.md, `.agent/PLANS.md`, the parent campaign plan and this plan; reconcile with `git log`/`git status`; W12 (Weekly Review / Progress / Activity) starts from the parent campaign checkpoint.
- Remaining definition of done: None — grammar, disclosures, persistence preservation, focused and real-SQLite tests, hosted browser evidence, rendered visual matrix, adversarial review and publication are all recorded with executed-versus-skipped distinctions; inherited security residuals remain visible and are not waived.

## Progress

- [x] M1 — repository/source/ref preflight + design-locked OpenSpec slice
- [x] M2 — Goals/Projects compact rows, progressive filters and detail options
- [x] M3 — Daily Plan intention/priority first, optional planning/reflection
- [x] M4 — independent browser 7/7 and 82 matched captures produced and representative states inspected
- [x] M5 — adversarial-review failure-surface corrections, temporary workflows removed, exact-head local gates re-run, publication and parent/W12 handoff

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
- 2026-10-13 — Adversarial review: rejected-write visibility is added as
  UI-only catch surfaces (no data-layer or semantics change), matching the
  calibrated W9.5/W10 failure-surface pattern; project lifecycle was
  reordered to persist-before-refresh so the optimistic status that the
  baseline shipped could not survive a failed write.

## Validation Ledger

- 2026-10-13 — Connected GitHub read-only source review — PASS for
  baseline inventory, not a runtime certification.
- 2026-10-13 — Refero styles and screens research — PASS for reference lock.
- 2026-10-13 — Local exact-head gates at `74d4aaf` (final W11 head):
  typecheck 0; lint 0/0; Vitest 2,675 passed / 3 skipped with the single
  failure proven to be the documented Windows-CRLF environment residual
  (identical failure on pristine main); integration 416 passed / 2 skipped;
  themes 140/140; OpenSpec 80/80; plans PASS; parity guards OK; hermetic
  export OK; planning browser 7/7; journeys P0 25/25; deterministic
  simulation PASS.
- 2026-10-13 — GitHub Actions standalone Planning E2E `38285465187` and `38287180079` — PASS 7/7 each, real SQLite; no retry-gated failure reported.
- 2026-10-13 — GitHub Actions W11 visual capture `38286186313` and final recapture `38287180103` — PASS; 39 baseline and 43 after images versioned in repo.
- 2026-10-13 — W11 quality through unit/integration `38285465071` — PASS before inherited audit-only red; later parity and JSX-lint setbacks corrected by registered opt-in gate and escaped JSX copy.
- 2026-10-13 — push-run CI `38288163819` and `38288169951` — every quality step PASS; first failing step `Audit runtime dependencies (gates on new high/critical)` on the two inherited advisories; hosted e2e/nightly skipped behind it. No dependency, lockfile or patch change in W11.
- Native W16 Android and iOS owner-deferred qualification are NOT RUN for W11 and are not claimed.

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

- Status: COMPLETED and published through PR #73 on branch
  `frontend-v3-w11-planning`; exact-head local and hosted evidence recorded
  above with executed-versus-skipped distinctions. W11 is not a native or
  full-release certification.
- Summary: W11 shipped the shared planning grammar, progressive
  disclosure across Goals/Projects/Daily Plan, and adversarial-review
  failure surfaces; persistence, relationships, ordering, carry-forward and
  accessible identities are preserved and browser-proven.
- Follow-up: W12 Weekly Review / Progress / Activity is the next wave, per
  the parent campaign checkpoint. Standard hosted E2E/nightly remain blocked
  by the inherited braces/node-forge advisories until separately remediated.
