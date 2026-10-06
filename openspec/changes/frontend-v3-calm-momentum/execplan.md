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
- **Phase:** W4 (shell/navigation) implemented + verified → W5 (Today) next
- **Exact next action:** W5 — rebuild Today orientation-first (tasks 5.1–5.3): one hero, neutral glance strip (OverviewScreen renders its own tinted stat cards — replace with neutral StatBlock), garden card sized-to-content, doc-subtitle removal.
- **Decisions so far:** see design.md D1–D7; reference lock in
  `docs/ui-ux/14-v3-reference-ledger.md`; defect ledger
  `docs/ui-ux/15-v3-defect-ledger.md` (33 defects; SYS-02/SYS-15 VERIFIED-FIXED,
  SYS-17 token-level FIXED).
- **Validation evidence (W4):** typecheck 0 errors; lint 0/0; validate:themes 140 checks (incl. new health accent); unit 2143/2143; journey-label-parity OK (5-label rail); e2e chromium: todos+workout+calories (24), habits+pomodoro+overview+boundary+theming (44), visual-audit 5/5 with new Health captures. Non-campaign Expo server (user brain-training, PID 42924) holds :8081 — audits use E2E_PORT=8083.
- **W4 changed areas:** app/index.tsx (five-destination rail + capture slot, FAB removed), features/health/HealthScreen.tsx (new), core/providers/navigationContext+NavigationProvider (health section), constants/sectionColors (health accent), features/command/commandCenterConfig (health launch context), e2e/helpers/navigation+oracles (Health routing), tests/journeyLabelParity (5-label pin).
- **Validation evidence (W3):**
  - `npm run typecheck` — 0 errors.
  - `npm run lint` — 0 errors/0 warnings.
  - `npm run validate:themes` — All 140 contrast checks pass.
  - `npm run test:unit` — 2143/2143 passed.
  - `scripts/quarantine-register-parity.mjs` — OK (visual-audit registered in
    known-gaps entry 24).
  - `npm run build:e2e` + audit re-run (E2E_PORT=8083): 5/5 passed; re-rendered
    captures confirm compact headers, no slab bands, calm radii. Note: a
    NON-campaign Expo dev server (user's brain-training project, PID 42924)
    occupies :8081 — audits must use E2E_PORT=8083; do not kill that process.
- **Changed areas (W3):** `core/theme/designTokens.ts`, `core/theme/tokens.ts`,
  `core/theme/createTheme.ts` (canvasTint removed), `core/ui/{Screen,Button,
Card,PageHeader,StatBlock,PillChip,SegmentedControl,EmptyStateCard}.tsx`,
  new `core/ui/SectionLabel.tsx`, `core/ui/TactileButton.tsx` deleted (Button
  `celebrate` variant absorbs it), `features/overview/OverviewScreen.tsx` (wash
  removal), `features/gamification/RewardCelebrationOverlay.tsx` (Button
  celebrate), `docs/testing/known-gaps.md` (entry 24).
- **Blockers:** none. iOS DEFERRED_BY_OWNER; braces/node-forge upstream.
- **Remaining definition of done:** tasks.md §4–§16 all checked with evidence;
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
