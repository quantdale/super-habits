# Warm Momentum 2.4 — Tasks

## 1. Baseline

- [x] 1.1 Re-qualify baseline at WM2.3 HEAD (`7a0983b`): typecheck, lint, vitest, openspec validate, plan validate.
- [x] 1.2 Known-gaps triage list drafted (CLOSED/DEFERRED/EXTERNAL per item). Verdict: CG-1..6 already CLOSED; capability gaps 1–11 carry honest rationale; this campaign adds CG-7/CG-8 (both closed by it).

## 2. Service-worker registration hardening

- [x] 2.1 Guard `wb.register()` boundary: falsy registration → log-and-noop; `.catch()` on the chain; update flow untouched.
- [x] 2.2 Focused E2E: reload-during-registration produces no unhandled crash (and pwa-update spec still green — 5/5, three consecutive runs).

## 3. Journey-label parity guard

- [x] 3.1 `scripts/journey-label-parity.mjs` — parse rail labels from `app/index.tsx` + all journey/helper label maps; diff-fail with named sides.
- [x] 3.2 Unit test for the parser (`tests/journeyLabelParity.test.ts`); wire script into `qa:fast`.
- [x] 3.3 Negative check: temporarily rename a label in a scratch run and confirm the guard fails (then revert). Result: 8 named failures, exit 1.

## 4. Heavy-state headroom reporting

- [x] 4.1 Extend P2 journey step metadata with ceiling/measured/headroomPct for cold start, max switch, diary search.
- [x] 4.2 Assert ≥15% headroom floor; verify journey runs green with headroom reported (adoption run: coldOverview 554ms/88.9%, maxSwitch 595ms/25.6%, diarySearch 357ms/28.6%, pickerSearch 107ms/78.6%).

## 5. Completion sweep

- [x] 5.1 Close the cheap presentation-layer known gaps (per triage): CG-7 (SW race), CG-8 (label parity), and CG-9 (full-parallel Vitest load sensitivity — proportional bounds + bind-race retry with child-watching probes, two mechanisms proven with captured stacks, 8/8 clean battery) closed by this campaign.
- [x] 5.2 Mark DEFERRED/EXTERNAL items with explicit rationale in `docs/testing/known-gaps.md` (capability gaps 1–11 retained with rationale; no silent shrinking).

## 6. Validation and closure

- [x] 6.1 Full gates: typecheck, lint, vitest, openspec validate, plan validate, sim validate, impact map.
- [x] 6.2 Full Chromium E2E + 3 consecutive P0 passes.
- [x] 6.3 `build:web` + `web:verify` + web:hygiene.
- [x] 6.4 `docs/ui-ux/11-warm-momentum-2-4.md`; ExecPlan COMPLETED; coherent commits; push; clean tree.
