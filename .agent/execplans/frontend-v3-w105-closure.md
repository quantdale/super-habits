# ExecPlan: W10.5 — Calories closure, truthful saves, and records

Plan-Version: 2
Status: COMPLETED

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

- Current milestone: M4 — W10.5 code changes COMPLETE and MERGED through PR #71 at `10cff42707a223bf12f59515d57beefe848c50b6` (2026-10-13 Manila). This docs-only closure record finalizes the task; W11 is the next unstarted wave.
- Completed: plan-first branch setup; duplicated goal edit text removed; macro-target modal awaits local persistence and guards double submit, keeps the draft on rejected writes; partial local-write/backup-outbox failure re-reads SQLite and displays a truthful warning; regression coverage added; D3 source fingerprints and W10 completion records reconciled; temporary standalone E2E workflow created, verified and removed before merge; PR #71 merged, both Codex P2 review threads on that PR replied/resolved; original PR #70 duplicate-goal thread replied/resolved.
- In progress: None; W11 is a separate future campaign.
- Important modified files: `features/calories/CaloriesDailyHero.tsx`, `MacroTargetsModal.tsx`, `CaloriesScreen.tsx`; `e2e/calories-w10.spec.ts`, `e2e/calories.spec.ts`; D3 measurement harness and README; W10 tasks, parent campaign ExecPlan; this plan.
- Last successful validation: W10.5 branch exact-source hosted CI `38277711157` at `15b859a`: TypeScript, Deno/Supabase, lint, theme tokens, OpenSpec, versioned ExecPlans and parity checks PASS; unit/integration 2,676 passed / 3 skipped (262 files passed / 1 skipped); first failing step remains inherited production audit (`braces`, `node-forge`), so standard hosted E2E/nightly SKIPPED. Independent dedicated Chromium workflow run `38277711149` at the same source SHA: 26/26 targeted Calories tests PASS, including real-SQLite hard-write and partial backup-intent failures. Earlier independent run `38277398558` at `d7814cc` also 26/26 PASS. Temporary workflow file removed before final code merge; only its run evidence remains. W10.5 merged PR #71 as `10cff427`.
- Current failures: No new W10.5 regression observed in verified targeted scope. Inherited `braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv keep standard CI red; hosted E2E/nightly skipped behind audit. Historical Windows CRLF, D14/Focus timestamp, Android API36 (W16) and owner-deferred iOS residuals remain.
- Relevant quarantines: None new.
- Blockers: None for scoped W10.5 closure. Full standard hosted E2E and native release certification remain unavailable due to inherited audit and deferred native lanes; independent browser coverage is explicitly bounded.
- Condition required to unblock: For global release certification, remediate the inherited audit advisories and separately qualify native targets; not a W10.5 blocker.
- Exact resume action after unblock: For full product certification, rerun the standard E2E/nightly lanes after the security gate is fixed. No W10.5 implementation resume remains.
- Exact next action: None — W10.5 task complete. W11 requires a new OpenSpec slice and plan.
- Remaining definition of done: None — review findings corrected, targeted SQLite-failure browser tests 26/26, hosted frontend gates through unit/integration passed, documentation reconciled, and code merged via PR #71. The inherited audit and native certification are separately documented residuals.

## Progress

- [x] M1 — preflight and plan
- [x] M2 — source correction, double-submit guard, partial-save reconciliation and SQLite failure-injection regressions verified (26/26)
- [x] M3 — provenance and historical completion records reconciled
- [x] M4 — hosted validation through 2,676 unit/integration tests, independent browser 26/26, reviews resolved, temporary test workflow removed, PR #71 merged

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
- 2026-10-13 — `CI` run `38277711157` — PASS through 2,676 unit/integration tests / 3 skipped, typecheck/lint/OpenSpec/plan/parity/theme/Deno gates PASS; dependency audit FAILED on two inherited HIGH advisories; standard hosted E2E/nightly SKIPPED.
- 2026-10-13 — `W10.5 Targeted Browser Validation` run `38277711149` — PASS: independent Playwright Chromium 26/26, zero retry dependency; standalone workflow removed from branch before merge.
- 2026-10-13 — PR #71 — MERGED at `10cff427`, including replies/resolutions for both new Codex P2 threads; W10 PR #70 P2 duplicate-goal thread also resolved.

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

- Status: COMPLETED — code merged via PR #71 (`10cff427`), final record filed as post-merge documentation.
- Summary: Removed duplicate daily-goal copy, restored truthful durable/partial nutrition-target save messaging, guarded repeat submits, strengthened real-SQLite error-path tests, retained original D3 measurement records with accurate provenance caveat, and reconciled W10 completion truth. Independent Chromium 26/26 PASS; hosted unit/integration 2,676/3 skipped PASS prior to unchanged inherited audit failure; no data/schema/dependency/security-policy changes. Archived temporary E2E run evidence without leaving a permanent workflow.
- Follow-up: W11 Planning / Goals / Projects / Daily Plan in its own OpenSpec slice. Existing audit and native residuals remain separately owned.
