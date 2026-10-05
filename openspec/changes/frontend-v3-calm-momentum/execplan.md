# ExecPlan: Frontend V3 — Calm Momentum UI/UX reconstruction

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Reconstruct SuperHabits' frontend into a visually polished, coherent, fast,
accessible consumer productivity app ("Calm Momentum") while preserving proven
domain behavior. Implements the
[frontend-v3-calm-momentum OpenSpec change](proposal.md). The owner explicitly
rejected the current rendered experience; prior "visual QA complete" claims are
historical evidence only.

## Current Checkpoint

- **Date:** 2026-10-05
- **Phase:** W2 complete → W3 (foundation) next
- **Exact next action:** Implement design-token/derivation changes in
  `core/theme/designTokens.ts` + `core/theme/createTheme.ts` (tasks 3.1–3.2),
  then component restyles (3.3–3.9), validating with typecheck + lint +
  validate:themes + qa:fast; commit as "V3 foundation".
- **Decisions so far:** see design.md D1–D7; reference lock in
  `docs/ui-ux/14-v3-reference-ledger.md`; defect ledger
  `docs/ui-ux/15-v3-defect-ledger.md` (33 defects: 4×S1, 22×S2, 7×S3).
- **Validation evidence:**
  - `npm run typecheck` — 0 errors.
  - `npx eslint e2e/visual-audit.spec.ts --max-warnings 0` — clean.
  - `VISUAL_AUDIT=1 npx playwright test e2e/visual-audit.spec.ts` — 5 passed,
    47 captures in `docs/ui-ux/v3-audit/`.
- **Changed areas so far:** `e2e/visual-audit.spec.ts` (new harness),
  `docs/ui-ux/13…15` (design system, reference ledger, defect ledger),
  `openspec/changes/frontend-v3-calm-momentum/*`.
- **Blockers:** none. iOS remains DEFERRED_BY_OWNER; braces/node-forge audit
  reds remain upstream (out of scope).
- **Remaining definition of done:** tasks.md §3–§16 all checked with evidence;
  validation ladder green; visual regression baselines curated; final report
  with truthful verdict per campaign §48.

## Context

- Baseline HEAD `3a376374a643786ce70152ce2c427156e9f502df` (= `origin/main` at
  campaign start). One stash (`pre-recovery-local-changes`) and one untracked
  `.tmp-ios36423379932/` dir preserved untouched.
- Rendered-truth audit found systemic Pop-reflex damage (SYS-01…SYS-20 in the
  defect ledger): doc-copy subtitles push content below the fold, saturated
  slab headers dominate, five-hue stat strips, FAB overlaps content/forms on
  4 of 6 sections, dark-theme hero has white-on-light-lavender contrast
  failure, triple-duplicated counts on Todos, "Reset (not logged)" clipped,
  neutral progress rendered in danger-red on Habits.
- Refero research synthesized into reference lock: calm information-first
  primary (Perplexity/Todoist/ChatGPT neutrals, single-accent discipline);
  task/habit/workout/nutrition/capture screen patterns recorded with
  adopt/reject decisions per area.
- Design system doc `13` is the campaign authority; Pop doc `12` is
  superseded for visual rules.

## Implementation Notes

- Token derivation changes concentrate in `core/theme/createTheme.ts` +
  `designTokens.ts`; 14 theme files keep working unchanged.
- Navigation labels are an observability contract (`journey-label-parity`);
  any label change lands with its parity-test update in the same commit.
- The audit harness (`VISUAL_AUDIT=1` gate) is the per-wave verification
  instrument; the curated `toHaveScreenshot` suite (W15) is the persistent
  regression guard. Never loosen thresholds to pass.
- Domain invariants (soft delete, sync enqueue, DB singleton, createId,
  toDateKey, append-only migrations) are out of redesign scope; any defect
  traced to them gets repro + regression test + narrow fix.

## Key Decisions (log)

- D1: evolve existing token exports (no fork) — minimizes churn across ~20
  screens and keeps 14 themes derivable.
- D2: TactileButton → deprecated wrapper over Button `celebrate`.
- D3: five-destination phone nav with W10 evidence gate; six-tab fallback
  documented.
- D5: visual regression = curated baselines, not every state; baseline edits
  require ledger notes.
