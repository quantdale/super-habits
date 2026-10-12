# ExecPlan: W10 — Calories / Health reconstruction + D3 navigation gate

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Make calorie logging observably easier and the nutrition surface visually
coherent inside the Calm Momentum system: the remaining-kcal number leads,
macros are compact and legible, entries are meal-grouped with immediate
edit/delete, quick entry (recent/frequent/saved/manual/kcal) is one tap from
the summary, and history is disclosed rather than dominating the logging
surface. Close SYS-06, SYS-18 and SUR-07 on Calories. Decide the five-vs-six
destination navigation question with measured evidence and ship the winner.
Existing persistence behavior is a contract: no schema, sync, backup, or
nutrition-math change.

## Context

- Baseline HEAD `21a598ba5fbc03d5c1194c17048c1dac8e6c1a13` (= origin/main, W9.5
  closure). Stash `pre-recovery-local-changes` and `.tmp-ios36423379932/`
  preserved untouched. Branch `frontend-v3-w10-calories` cut from main.
- Parent change: `openspec/changes/frontend-v3-calm-momentum/` (design D3,
  tasks §10). Design authority `docs/ui-ux/13-calm-momentum-design-system.md`;
  reference decisions R5 (nutrition) in `docs/ui-ux/14-v3-reference-ledger.md`;
  defects in `docs/ui-ux/15-v3-defect-ledger.md`.
- Slice: `openspec/changes/frontend-v3-w10-calories/` (proposal, design D10.1–
  D10.5, specs `calories-logging-first` + `health-navigation-decision`).
- Calories surface: `features/calories/CaloriesScreen.tsx` (form + diary
  modes), `CaloriesFormView.tsx`, `CaloriesDiaryView.tsx`,
  `CaloriesEntryFields.tsx`, `QuickAddKcal.tsx`, `SavedMealChips.tsx`,
  `DiaryDayNavigator.tsx`, `MacroDonutChart.tsx`, `DailyCalorieChart.tsx`,
  `MacroTrendChart.tsx`, `CalorieGoalModal.tsx`, `MacroTargetsModal.tsx`,
  `SavedMealSearchModal.tsx`; persistence in `calories.data.ts`; math in
  `calories.domain.ts` (untouched).
- Shell: `app/index.tsx` `NAV_ITEMS`/`RAIL_*_ITEMS`, `HEALTH_CHILD_SECTIONS`,
  `navActiveSection`; helpers `e2e/helpers/navigation.ts` (routes
  workout/calories through Health) and `e2e/helpers/oracles.ts`
  (`SECTION_HEADINGS.calories` currently pins the SYS-06 doc subtitle).
- Inherited residuals (unchanged, recorded): braces GHSA-vfj7-8cjw-p6xm and
  node-forge GHSA-86w9-cpqp-85rv audit reds; Windows CRLF
  `agentDocConsistency` ENVIRONMENT failure; D14 host-load headroom residuals
  (diary search ~434ms vs 500ms ceiling; section switch ~702ms vs 800ms
  ceiling, reproduced on the unmodified baseline); Focus notification
  timestamp residual; Android API36 pending W16; iOS owner-deferred.

## Scope

- `features/calories/*` reconstruction per D10.1–D10.3.
- `app/index.tsx` navigation per the D3 decision (six-tab fallback if
  measured); `e2e/helpers/*` label maps updated in the same commit.
- W10 regressions + rendered audit harness; docs records.

## Non-Goals

- No `core/db`, sync engine, backup/restore, portable, Supabase, or
  notification change; no migration; no schema change.
- No dependency or security-policy change; no quarantine/threshold change.
- No native certification claim (Android W16, iOS owner-deferred stand).
- No W11+ waves.

## Current Checkpoint

- Current milestone: M9 — W10 is COMPLETE and MERGED (PR #70, merge commit
  `f7d313bdc9ae6b31c38ef0e738e58e965435f9f8`). M1–M8 are done.
- Completed:
  - M1 preflight (HEAD `21a598ba…` = origin/main; stash + `.tmp-ios36423379932/` preserved;
    baseline typecheck/lint PASS) + W10 slice + this plan authored.
  - M2 baseline evidence: 17 `before/` captures + `d3-five-destination.json`; inspected
    (duplication inventory, SYS-06/SYS-18/SUR-07 confirmed open).
  - M3 D3 instrument (`e2e/health-nav-w10-measure.spec.ts`) measured both models.
  - M4 Calories reconstruction: `CaloriesDailyHero`, `CaloriesMacroSummary`,
    `CalorieQuickLogCard`, `MealGroupedDayLog`, `CaloriesHistorySection`,
    `caloriesFormat`; `CaloriesScreen`/`CaloriesFormView`/`CaloriesDiaryView` rewritten;
    `MacroDonutChart`, `EntryMacroShareLine`, `CalorieStaggerItem` deleted; `PillChip`
    wrap-safe; `CaloriesEntryFields` doc-copy removed.
  - M5 six-tab fallback shipped (`NAV_ITEMS` six destinations, `RAIL_ITEMS`, 11px labels,
    `BAR_TAB_MIN_WIDTH` 44, `health` kept as a valid non-bar section); parity consumers
    updated (`e2e/helpers/navigation.ts`, `oracles.ts` identity, `calories.spec.ts`,
    `boundary.spec.ts`, `calories-day-navigation.spec.ts`, `a-tuesday.spec.ts`,
    `past-midnight-freshness.spec.ts`, `visual-audit.spec.ts`,
    `tests/journeyLabelParity.test.ts`).
  - M6 coverage: `e2e/calories-w10.spec.ts` 14/14, `e2e/health-nav-w10.spec.ts` 6/6,
    `tests/integration/caloriesW10LoggingIntegrity.test.ts` 7/7,
    `tests/healthNavigationW10.test.ts` (structural), D3 measurement records.
  - M7 rendered certification: 20 after captures opened/inspected at 360/390/412/768/1280
    light + dark; `docs/ui-ux/v3-audit/w10/README.md` records the before/after findings and
    the D3 decision.
- In progress: none — final records only.
- M8/M9 completed: full ladder green (see the Validation Ledger) and PR #70 merged as
  `f7d313b` (6 commits). Exact-head hosted CI run 38259047679: quality green through
  unit/integration (2,676 passed / 3 skipped; 262 files), openspec 79/79, plan validation
  and parity guards PASS; the only red is `Audit runtime dependencies` on the two
  pre-existing UNDOCUMENTED advisories (braces GHSA-vfj7-8cjw-p6xm, node-forge
  GHSA-86w9-cpqp-85rv); hosted e2e/nightly SKIPPED behind that gate; Vercel production
  deployment 7015956226 for the exact head succeeded.
- Important modified files: `app/index.tsx`, `features/calories/*` (see Changed Files),
  `core/ui/PillChip.tsx`, `e2e/**`, `tests/**`, `docs/ui-ux/13…15`,
  `docs/testing/known-gaps.md`, `openspec/changes/frontend-v3-calm-momentum/{tasks,execplan}.md`,
  `openspec/changes/frontend-v3-w10-calories/*`.
- Last successful validation: typecheck 0 errors; lint 0/0; themes 140/140; openspec
  79/79; plan validation PASS; parity guards OK; `npm test` 2,666 passed / 2 skipped +
  the inherited Windows-CRLF `agentDocConsistency` failure; chromium 218 passed / 35
  skipped; journeys 76 passed / 42 skipped; simulation 8/8 + deterministic 23/23; pwa 5/5.
- Current failures: None new. Inherited residuals only: braces/node-forge audit reds
  (hosted `quality` step), Windows-CRLF `agentDocConsistency` ENVIRONMENT failure,
  D14 host-load headroom residuals, Focus notification timestamp, Android API36
  pending W16, iOS owner-deferred, `format:check` 134 pre-existing files.
- Relevant quarantines: none added.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — W10 is complete; W11 (Planning / Goals / Projects / Daily
  Plan) is the next wave and starts with its own OpenSpec slice.
- Remaining definition of done: all satisfied — logging-first surface shipped and
  inspected; SYS-06/SYS-18/SUR-07 verified fixed; D3 measured, decided and implemented;
  data-integrity oracles green; full ladder green except the recorded inherited
  residuals; published through the normal PR workflow with exact-head hosted CI
  inspected. All conditions are satisfied; nothing remains.
- Remaining definition of done (final): NONE — every item above is complete and
  evidenced in the Validation Ledger.

## Progress

- [x] M1 — preflight + W10 OpenSpec slice + this plan (2026-10-12)
- [x] M2 — W10 baseline rendered evidence + inspection
- [x] M3 — D3 measurement instrument + five-destination measurement
- [x] M4 — Calories reconstruction (hero, macro summary, quick log, meal
      groups, history disclosure, SYS-06/SYS-18/SUR-07)
- [x] M5 — D3 implementation (six-tab) + parity-consumer updates
- [x] M6 — data-integrity coverage (unit / real-SQLite / e2e)
- [x] M7 — rendered certification + defect inspection + correction loop
- [x] M8 — full validation ladder + adversarial review
- [x] M9 — publication + exact-head hosted CI + final records

## Surprises & Discoveries

- The D3 instrument surfaced a defect neither the W4 records nor the W1 ledger
  carried: both navigation models rendered phone-bar labels at **10.5px**,
  below the V3 §9 >=11px contract. Corrected with the six-tab model (11px).
- `goToTab`-style helpers reload the page, so a "section switch" probe built on
  them measures reload recovery, not navigation. The instrument uses in-app
  rail clicks for the task-switch measurement (a running Focus session does
  survive a real switch).
- `resetAll` wipes every `superhabits.*` localStorage key, so a theme set before
  a seed/reset is erased; the W10 audit harness sets the theme after seeding
  (the W7 `addInitScript` pattern is the alternative).
- The DB-harness row oracle destroys the live app page: W10 specs assert UI
  facts first and query rows last.
- A minimum flex width was silently overridden by a later `minWidth: 0` in the
  same style object — the 44pt floor only took effect after removing it.

## Decision Log

- 2026-10-12 — W10 gets its own OpenSpec slice + plan before any Calories
  edit — parent AGENTS.md requires the plan before implementation and the
  W9/W9.5 slices establish the pattern.
- 2026-10-12 — Hero eyebrow `CALORIES` doubles as the section's stable
  identity string for `e2e/helpers/oracles.ts` — the previous identity string
  was the SYS-06 doc subtitle being deleted, so the observability contract
  needs a stable replacement in the same commit.
- 2026-10-12 — D3 gate: ship the six-tab fallback — measured evidence
  (`docs/ui-ux/v3-audit/w10/d3-*.json`) shows the Health parent adds a tap to
  start-workout (3→2) and log-meal (3→2) and a tap to Workout/Calories section
  switches (2→1); view-remaining stays 1 tap in both models; active-session
  preservation and task completion are equal; the parent's label size was
  below the V3 contract and is corrected at 11px.
- 2026-10-12 — Keep `health` as a valid non-bar section — deep links,
  linked-action targets and command routing keep rendering the Health
  surface; the parent indirection is what the gate rejected, not the surface.
- 2026-10-12 — Delete `MacroDonutChart`/`EntryMacroShareLine`/
  `CalorieStaggerItem` — each repeated a fact the new hierarchy already
  carries (donut vs macro bars, per-entry share vs grams), and V3 §12 rejects
  staggered list entrances.

## Validation Ledger

- 2026-10-12 — `npm run typecheck` — PASS — 0 errors at `21a598ba…` (baseline).
- 2026-10-12 — `npm run lint` — PASS — 0 errors / 0 warnings at `21a598ba…` (baseline).
- 2026-10-12 — `npx openspec validate frontend-v3-w10-calories --strict` — PASS.
- 2026-10-12 — `npm run agent:plan:validate -- --plan …w10-calories/execplan.md` — PASS.
- 2026-10-12 — `npm run typecheck` — PASS — 0 errors after the reconstruction.
- 2026-10-12 — `npx eslint . --max-warnings 0` — PASS.
- 2026-10-12 — `e2e/calories-w10-audit.spec.ts` (VISUAL_AUDIT=1) — PASS — 17 before + 20
  after captures; all after captures inspected.
- 2026-10-12 — `D3_MEASURE=1 e2e/health-nav-w10-measure.spec.ts` — PASS — five-destination
  3/3/1 taps vs six-tab 2/2/1; a11y geometry recorded; decision: six-tab.
- 2026-10-12 — `e2e/calories.spec.ts` — PASS — 10/10.
- 2026-10-12 — `e2e/calories-day-navigation.spec.ts` — PASS — 6/6.
- 2026-10-12 — `e2e/boundary.spec.ts` — PASS — 27/27 (one failure re-run green).
- 2026-10-12 — `e2e/calories-w10.spec.ts` — PASS — 14/14.
- 2026-10-12 — `e2e/health-nav-w10.spec.ts` — PASS — 6/6.
- 2026-10-12 — `e2e/a11y.spec.ts` + `a11y-audit-contract.spec.ts` + `theming.spec.ts` —
  PASS — 17/17.
- 2026-10-12 — `playwright --project=journeys --grep @p0` — PASS — 25/25.
- 2026-10-12 — `npx vitest run tests/healthNavigationW10.test.ts` —
  PASS — 4/4.
- 2026-10-12 — `npx vitest run tests/journeyLabelParity.test.ts` — PASS — 3/3.
- 2026-10-12 — `npx vitest run tests/integration/caloriesW10LoggingIntegrity.test.ts` —
  PASS — 7/7.
- 2026-10-12 — `npm run validate:themes` — PASS — 140/140.
- 2026-10-12 — `npx openspec validate --all` — PASS — 79/79.
- 2026-10-12 — `npm run agent:plan:validate:all` — PASS.
- 2026-10-12 — `node scripts/journey-label-parity.mjs` — PASS.
- 2026-10-12 — `node scripts/quarantine-register-parity.mjs` — PASS — 21 gate
  files registered, none stale.
- 2026-10-12 — `npm test` (unit + integration) — 2,666 passed / 2 skipped;
  1 pre-existing Windows-CRLF `agentDocConsistency` ENVIRONMENT failure.
- 2026-10-12 — `playwright --project=chromium` — 217 passed / 35 skipped,
  1 W10 lane failure (shell-mount timing) fixed by waiting for the rail, then
  218 passed on the re-run; final run in progress.
- 2026-10-12 — `playwright --project=journeys` — 76 passed / 42 skipped
  (a-tuesday, past-midnight-freshness, settings-ripple, three-months-in
  all green after the W10 label updates).
- 2026-10-12 — `playwright --project=simulation --project=pwa` — 8 passed.
- 2026-10-12 — `npm run qa:simulation -- --all --mode deterministic` —
  PASS — 23/23 scenarios; `sim:validate` 23/23.
- 2026-10-12 — adversarial-review fixes: delete confirmation + delete-failure
  surface, `aria-expanded` on both disclosures; W10 lanes re-run 30/30.
- 2026-10-12 — `playwright --project=chromium` (final run) — PASS — 218
  passed / 35 skipped (23.5m).
- 2026-10-12 — hosted CI run 38259047679 at the exact merged head `f7d313b` —
  quality green through unit/integration (2,676 passed / 3 skipped; 262 files),
  openspec 79/79, plans, parity; red only on `Audit runtime dependencies`
  (braces GHSA-vfj7-8cjw-p6xm, node-forge GHSA-86w9-cpqp-85rv — pre-existing,
  UNDOCUMENTED at baseline); hosted e2e/nightly SKIPPED behind that gate.
- 2026-10-12 — Vercel deployment 7015956226 (Production – superhabits) for
  `f7d313b` — success.

## Changed Files / Areas

- `app/index.tsx` — six-destination NAV_ITEMS/RAIL_ITEMS, 44pt bar target floor,
  11px bar labels, Health-parent indirection removed.
- `features/calories/CaloriesScreen.tsx` — logging-first composition, hero
  remaining-kcal title, disclosure-scoped history derivations.
- `features/calories/CaloriesDailyHero.tsx` (new) — one daily summary card.
- `features/calories/CaloriesMacroSummary.tsx` (new) — compact macro totals/targets.
- `features/calories/CalorieQuickLogCard.tsx` (new) — chips + quick kcal + browse +
  `DiaryQuickAddSearch`.
- `features/calories/MealGroupedDayLog.tsx` (new) — shared meal groups + entry rows
  with visible edit/delete.
- `features/calories/CaloriesHistorySection.tsx` (new) — collapsed history disclosure.
- `features/calories/caloriesFormat.ts` (new) — locale kcal/day formatters.
- `features/calories/CaloriesFormView.tsx`, `CaloriesDiaryView.tsx` — rewritten as thin
  mode compositions over the shared pieces.
- `features/calories/SavedMealChips.tsx` — wrapping chips (SYS-18).
- `features/calories/CaloriesEntryFields.tsx` — doc-copy removed.
- `core/ui/PillChip.tsx` — content-hugging, container-capped chips.
- Deleted: `features/calories/MacroDonutChart.tsx`, `EntryMacroShareLine.tsx`,
  `CalorieStaggerItem.tsx`.
- `e2e/` — new `calories-w10.spec.ts`, `health-nav-w10.spec.ts`,
  `health-nav-w10-measure.spec.ts`, `calories-w10-audit.spec.ts`; updated
  `helpers/navigation.ts`, `helpers/oracles.ts`, `calories*.spec.ts`,
  `boundary.spec.ts`, `visual-audit.spec.ts`, journey specs.
- `tests/` — `journeyLabelParity.test.ts` (six labels),
  `healthNavigationW10.test.ts` (new),
  `integration/caloriesW10LoggingIntegrity.test.ts` (new).
- `docs/ui-ux/v3-audit/w10/**`, `docs/ui-ux/15-v3-defect-ledger.md` (W10 note),
  `openspec/changes/frontend-v3-calm-momentum/{tasks,execplan}.md`.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, then
   `openspec/changes/frontend-v3-w10-calories/proposal.md` + `design.md`.
2. `git status --short`; inspect the diff for calories/nav files; the plan's
   Current Checkpoint is authoritative for state, Git for files.
3. Run `npm run agent:resume -- --plan openspec/changes/frontend-v3-w10-calories/execplan.md`
   and follow its discrepancy warnings.
4. Continue from `Exact next action` only.
5. Never weaken a meaningful test; classify failures with the repository's
   QA taxonomy; keep the inherited residuals visible.

## Outcomes & Retrospective

- Status: Complete (merged as `f7d313b`, PR #70).
- Summary: W10 shipped the logging-first Calories reconstruction and the
  six-destination navigation decided by the D3 measurement gate. Evidence:
  `docs/ui-ux/v3-audit/w10/` (17 before + 20 inspected after captures,
  `d3-five-destination.json` vs `d3-six-tab.json`), `e2e/calories-w10.spec.ts`
  14/14, `e2e/health-nav-w10.spec.ts` 6/6,
  `tests/integration/caloriesW10LoggingIntegrity.test.ts` 7/7,
  `tests/healthNavigationW10.test.ts` 4/4, plus the full local ladder
  (chromium 218 passed / 35 skipped, journeys 76 / 42, simulation 8/8 and
  23/23 deterministic, pwa 5/5, vitest 2,666 passed / 2 skipped with the
  inherited CRLF failure) and the exact-head hosted run 38259047679 (quality
  green through unit/integration at 2,676 passed / 3 skipped; audit-only red
  on the two pre-existing braces/node-forge advisories; hosted e2e/nightly
  skipped; Vercel production deployment 7015956226 success).
- Two pre-existing defects were found and corrected during W10 validation
  (the W9 date-dependent week-strip oracle; the sub-pixel 44pt measurement);
  both reproduced on the untouched W9.5 baseline and neither was caused by
  W10.
- Follow-up: W11 (Planning / Goals / Projects / Daily Plan). Advertised
  a11y follow-up: RN Web does not map `accessibilityState.expanded` for
  role=button; W10 forwards `aria-expanded` on its two disclosures, and the
  same correction is available for the W9 Workout disclosure.
