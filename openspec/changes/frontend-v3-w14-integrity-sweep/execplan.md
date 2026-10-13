# ExecPlan: W14 — Full UI/UX integrity sweep and convergence

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Reconcile the whole integrated product against Calm Momentum design authority
on one build, register reproducible defects with severity, make bounded
high-impact repairs, and produce an honest convergence verdict — so W15 can
curate baselines from a verified-stable render, not a moving target.

## Context

- Integrated source: `frontend-v3-w12-w17-integration` at `b1569f0` (W13),
  which contains W12 `1d54b70` and descends from `1f23da4` = `origin/main`.
- Parent change `openspec/changes/frontend-v3-calm-momentum/` (tasks §14).
  Design authority `docs/ui-ux/13-calm-momentum-design-system.md`; defect
  ledger `docs/ui-ux/15-v3-defect-ledger.md`; QA taxonomy
  `docs/testing/autonomous-qa.md`.
- Slice: `openspec/changes/frontend-v3-w14-integrity-sweep/`.
- Instruments reused (not rebuilt): `e2e/visual-audit.spec.ts`,
  `e2e/a11y.spec.ts` + `e2e/helpers/a11yAudit.ts`, and every per-wave audit
  (`habits-w7`, `pomodoro-w8*`, `workout-w9*`, `calories-w10*`,
  `planning-w11*`, `planning-w12*`, `secondary-surface-w13*`).
- Inherited residuals: two dependency advisories (hosted audit red only),
  Windows-CRLF ENVIRONMENT failure, D14 host-load headroom, Focus notification
  timestamp, the pre-existing `settings-ripple` Calories-ripple failure.
  Android API36 pending W16; iOS owner-deferred.

## Scope

- Whole-app rendered matrix execution + inspection.
- W14 defect ledger.
- Bounded convergence fixes for reproduced P0/P1 and coherent P2 defects.

## Non-Goals

- No reopening of W0–W13 implementation campaigns.
- No design-direction change; Calm Momentum stands.
- No `core/db`/`core/sync`/`core/backup`/`core/portable` semantics change; no
  schema, migration, dependency or security-policy change.
- No native certification claim (W16 owns native).

## Current Checkpoint

- Current milestone: C5 complete — W14 matrix executed, defects triaged, one P1
  fixed and pinned; pending commit.
- Completed: slice; whole-app matrix (247 captures across 360/390/412/768/1024/
  1280/1440, light/dark, FIRST_RUN/EMPTY/SMALL/TYPICAL/HEAVY/LONG_TEXT); every
  per-wave audit re-run on the integrated build; `e2e/a11y.spec.ts` 10/10; full
  Chromium battery 245/245; W14 defect register; the W14-01 P1 touch-target fix
  with a new source-contract regression.
- In progress: final records and the W14 commit.
- Important modified files: `features/settings/SettingsSharedUi.tsx`,
  `features/weekly-review/WeeklyReviewScreen.tsx`,
  `tests/uiTouchTargetContract.test.ts`, `docs/ui-ux/v3-audit/w14/**`.
- Last successful validation: typecheck 0; eslint 0/0; touch-target contract
  8/8; `qa:integration` 419 pass / 2 skip; `qa:fast` 2,271 pass / 1 (documented
  Windows-CRLF ENVIRONMENT residual); visual-audit 7/7; per-wave audits 21/21;
  W12/W13 audits 8/8; a11y 10/10; full Chromium 245/245; P0 journeys 25/25.
- Current failures: the documented Windows-CRLF ENVIRONMENT residual and the
  pre-existing `settings-ripple` Calories-ripple step (both reproduce on the
  pre-W14 baseline).
- Relevant quarantines: None added.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Commit W14, then begin W15 — author
  `openspec/changes/frontend-v3-w15-visual-regression/` and build the curated
  deterministic `toHaveScreenshot` suite with two-run stability.
- Remaining definition of done: W14 commit/publication; then W15–W17.

## Progress

- [x] 1.1 W12 + W13 confirmed on one branch
- [x] 1.2 Slice authored (proposal, design, spec, tasks, this plan)
- [ ] 2.x Matrix execution
- [ ] 3.x Defect ledger
- [ ] 4.x Bounded convergence fixes
- [ ] 5.x Validation and closure

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-10-14 — Reuse the existing instruments rather than building a W14-only
  harness: the campaign requires a whole-app reconciliation, and the existing
  audit specs already cover their own waves at the required widths/themes.
- 2026-10-14 — Risk-weighted matrix, not a full Cartesian product, with every
  cell recorded as inspected or explicitly not-run.

## Validation Ledger

- 2026-10-14 — `npx tsc --noEmit` — PASS — 0 errors.
- 2026-10-14 — `npx eslint <changed files> --max-warnings 0` — PASS — 0/0.
- 2026-10-14 — `npx vitest run tests/uiTouchTargetContract.test.ts` — PASS — 8/8 (2 new W14 cases).
- 2026-10-14 — `npm run qa:integration` — PASS — 419 passed / 2 skipped.
- 2026-10-14 — `npm run qa:fast` — FAIL — 2,271 passed / 1 failed; only `tests/agentDocConsistency.test.ts` (Windows-CRLF), the documented ENVIRONMENT residual.
- 2026-10-14 — `VISUAL_AUDIT=1 e2e/visual-audit.spec.ts` — PASS — 7/7, 60 captures.
- 2026-10-14 — per-wave audits — PASS — 21/21.
- 2026-10-14 — `planning-w12-audit` + `secondary-surface-w13-audit` — PASS — 8/8.
- 2026-10-14 — `e2e/a11y.spec.ts` — PASS — 10/10.
- 2026-10-14 — `npx playwright test --project=chromium` — PASS — 245 passed / 0 failed.
- 2026-10-14 — `e2e/secondary-surface-w13.spec.ts e2e/weekly-review.spec.ts` (post-fix) — PASS — 7/7.
- 2026-10-14 — `E2E_PORT=8086 npm run e2e:journeys:p0` — PASS — 25/25.

## Changed Files / Areas

- `openspec/changes/frontend-v3-w14-integrity-sweep/*` — this slice.
- `docs/ui-ux/v3-audit/w14/*` — matrix evidence and ledger.
- `docs/ui-ux/15-v3-defect-ledger.md` — status reconciliation.
- Any surface a reproduced defect traces to (recorded as fixes land).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, the master plan, then this file.
2. `git status --short`, `git diff --stat`, `git diff --name-only`.
3. `npm run agent:resume -- --plan openspec/changes/frontend-v3-w14-integrity-sweep/execplan.md`.
4. `npm run qa:affected`.
5. Reconcile with Git and the rendered state, update the checkpoint, resume from
   `Exact next action`.

## Outcomes & Retrospective

- Status: Active.
- Summary: Slice authored; matrix execution next.
- Follow-up: W15–W17.
