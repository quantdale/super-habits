# ExecPlan: W10.5 — Calories closure, truthful saves, and records

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close bounded findings from W10 review without reopening the nutrition redesign: remove the duplicate goal display; make macro-target writes truthfully reflect durable success/failure; capture more actionable D3 measurement provenance; reconcile W10's publication records and parent checkpoint. Add focused regression coverage and preserve W10's confirmed behavior.

## Context

- Base: `29486760c0c449b9807f34d6725bce5133d6f25d` (W10 final main). W10 PR #70 merged as `f7d313b`.
- W10 source: `features/calories/CaloriesDailyHero.tsx`, `MacroTargetsModal.tsx`, `CaloriesScreen.tsx`, `e2e/calories-w10.spec.ts`; persistence via `saveMacroTargetsData` in `calories.data.ts`, which writes `app_meta` and enqueues backup settings.
- W10 measurement files in `docs/ui-ux/v3-audit/w10/`; parent plan `openspec/changes/frontend-v3-calm-momentum/execplan.md`.
- Previous review: W10 PR #70 open Codex P2 thread on duplicate goal, source-level silent macro-target error, W10 tasks 8.1–8.4 unchecked despite COMPLETED plan, stale parent Current Checkpoint, and D3 JSON commit field representing baseline HEAD even when testing modified tree.
- Existing audit failure `braces`/`node-forge` is inherited and out of scope. Hosted E2E/nightly are skipped behind that gate.

## Scope

- UI-only goal summary label and macro-target save semantics; prevent duplicate submission.
- Focused E2E save-success and save-failure assertions where feasible, including mutation failure injection.
- Reconcile W10 completion records without rewriting historical validation.
- D3 provenance explanation and future measurement source fingerprint.

## Non-Goals

- No nutrition data-layer, domain, schema, migration, sync, backup, security-policy, dependency, Workout, W11, or unrelated UI redesign.
- Do not claim full native or hosted E2E certification, and do not weaken audit gates.

## Current Checkpoint

- Current milestone: M3 — implementation and provenance committed on isolated W10.5 branch; PR and hosted verification next.
- Completed: plan-first branch setup; no duplicated goal in the hero action; macro-target modal waits for persistence, guards double submit and keeps draft on failure; regression coverage added; D3 source fingerprint and W10 document reconciliations authored.
- In progress: PR creation, CI validation and review.
- Important modified files: `features/calories/CaloriesDailyHero.tsx`, `MacroTargetsModal.tsx`, `CaloriesScreen.tsx`; `e2e/calories-w10.spec.ts`, `e2e/calories.spec.ts`; D3 measurement harness and README; W10 tasks, parent campaign ExecPlan; this plan.
- Last successful validation: historical W10 latest exact-main CI `38264376415`: typecheck, lint, Deno, themes, OpenSpec, plans, unit/integration 2,676 passed / 3 skipped; security audit failed on two inherited advisories.
- Current failures: inherited security audit red; Windows CRLF environment residual and other existing known gaps.
- Relevant quarantines: None new.
- Blockers: Unable to run a full local repository checkout in the current environment; use hosted PR checks for typecheck and unit/integration. E2E remains blocked by inherited audit.
- Condition required to unblock: A test environment capable of running the Playwright E2E suite independent of the security gate.
- Exact resume action after unblock: Run targeted Calories W10/W10.5 browser regressions and inspect screenshots before marking any unverified gates complete.
- Exact next action: open W10.5 PR, review targeted source and hosted CI, correct any new failures, then publish only if validation supports it.
- Remaining definition of done: review findings fixed and tests strengthened; code committed on isolated branch; hosted typecheck/lint/unit/integration verified; plan/provenance/checklist reconciled; PR reviewed and merged only if verification supports it.

## Progress

- [x] M1 — preflight and plan
- [x] M2 — source correction and regression tests committed, execution pending
- [x] M3 — provenance and historical completion records reconciled
- [ ] M4 — hosted validation, review, and publication

## Surprises & Discoveries

- W10's `MacroTargetsModal` calls `onClose()` immediately after `onSave()` (void contract) while `CaloriesScreen` performs an optimistic `setMacroTargets` and suppresses rejection.
- W10 screenshot baseline contains a duplicate goal fact in a second pressable.
- D3 JSON `commit` is captured with `git rev-parse HEAD`, not a working-tree/build identity; existing measurements were taken with modified uncommitted sources.

## Decision Log

- 2026-10-13 — Fix the screen-level save contract and modal async state without modifying data-layer persistence.
- 2026-10-13 — Retain raw historical D3 JSON values and annotate limitations rather than falsifying original provenance.

## Validation Ledger

- 2026-10-13 — Source/static inspection via connected GitHub — PASS for issue reproduction, NOT a runtime test.
- 2026-10-13 — Local tests — NOT RUN (complete repo checkout unavailable).

## Changed Files / Areas

- `.agent/execplans/frontend-v3-w105-closure.md` — durable checkpoint.
- W10 UI code and E2E specs — truthful goal/save behavior.
- D3 instrument and W10 evidence README — provenance and limitations.
- W10 tasks and parent ExecPlan — accurate closure/handoff checkpoint.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan and the W10 slice.
2. Check `git status --short`, current branch and diff against `2948676`.
3. Continue from Exact next action, verify targeted behavior and do not soften tests.

## Outcomes & Retrospective

- Status: ACTIVE.
- Summary: in progress.
- Follow-up: W11 after bounded closure and recorded residuals.
