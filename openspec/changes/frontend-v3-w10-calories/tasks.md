# W10 — Calories / Health reconstruction and D3 navigation validation

## 1. Preflight and planning

- [x] 1.1 Verify repository truth (HEAD `21a598ba…` = origin/main), preserve
      `stash@{0}` (`pre-recovery-local-changes`) and `.tmp-ios36423379932/`
- [x] 1.2 Baseline gates at the W9.5 head: typecheck, lint, `npm test`,
      `openspec validate --all`, `agent:plan:validate:all`
- [x] 1.3 Author this OpenSpec slice + `execplan.md` before any Calories edit

## 2. W10 baseline rendered evidence

- [x] 2.1 Capture the current Form + Diary surfaces (populated, empty, add
      flow, dark, 360/390/412/768/1280) into `docs/ui-ux/v3-audit/w10/before/`
- [x] 2.2 Inspect the captures; confirm the duplication inventory (remaining
      kcal ×4, consumed ×3, donut vs macro bars, dual entry anatomy, three
      always-visible history sections) and the open ledger defects
- [x] 2.3 Pin the duplication with a deliberately failing W10 geometry/order
      spec — `e2e/calories-w10.spec.ts` ("remaining kcal leads…",
      "no daily fact renders twice") failed on the baseline tree and passes
      on the reconstruction

## 3. D3 navigation validation gate

- [x] 3.1 Author the opt-in measurement instrument (three flows, equivalent
      starting states, tap depth + completion + section switch) —
      `e2e/health-nav-w10-measure.spec.ts`
- [x] 3.2 Measure the shipped five-destination model at the W9.5 baseline and
      record the numbers — `docs/ui-ux/v3-audit/w10/before/d3-five-destination.json`
- [x] 3.3 Decide from the recorded evidence (six-tab fallback if the parent
      adds a tap or drops task-switch success) and record the decision —
      `docs/ui-ux/v3-audit/w10/d3-six-tab.json` + README: six-tab shipped

## 4. Calories reconstruction

- [x] 4.1 Hero: remaining-kcal title + `CALORIES` eyebrow, no doc subtitle;
      pinned Form/Diary switch
- [x] 4.2 One hero summary card (consumed-of-goal + progress bar + factual
      over-goal caption); remove StatBlock trio, donut, consistency strip
- [x] 4.3 Compact macro summary with totals/targets + `Edit targets` quiet
      action
- [x] 4.4 Shared quick-log card: wrapping recent/frequent chips (SYS-18),
      kcal quick add, browse saved meals; Form mode adds the macro form,
      Diary mode adds search-first add
- [x] 4.5 One meal-grouped day log with visible Edit/Delete actions (with an
      explicit delete confirmation) in both modes; Diary keeps the day
      navigator + copy-day
- [x] 4.6 Collapsed `History & insights` disclosure (trend, macro trends,
      heatmap, days-logged/goal facts) with disclosure-scoped derivations
- [x] 4.7 Remove doc-copy (SYS-06) everywhere on the surface
- [x] 4.8 Verify no floating control overlaps any input at 360–412px (SUR-07)

## 5. D3 implementation (per §3 decision)

- [x] 5.1 Six-tab model shipped: `NAV_ITEMS` six destinations + capture slot,
      single rail group, 11px labels, 44pt target floor; `health` kept as a
      valid non-bar section
- [x] 5.2 Update `e2e/helpers/navigation.ts`, `oracles.ts` identity strings,
      and every journey label map in the same commit (parity guard)
- [x] 5.3 Preserve navigation contexts, linked actions, command routing and
      active-session state; verify with the section-switch/journey lanes

## 6. Data-integrity and functional coverage

- [x] 6.1 Unit: existing calories domain suites unchanged and green
- [x] 6.2 Real-SQLite integration: create/edit/delete, computed kcal,
      quick-add kcal-only (no phantom saved meal, no use_count inflation),
      goal + macro-target persistence, day correction, copy-day —
      `tests/integration/caloriesW10LoggingIntegrity.test.ts` 7/7
- [x] 6.3 E2E: label-dependent specs updated without weakening row oracles;
      W10 regressions (`e2e/calories-w10.spec.ts` 14/14,
      `e2e/health-nav-w10.spec.ts` 6/6)

## 7. Rendered certification

- [x] 7.1 W10 audit harness capturing into `docs/ui-ux/v3-audit/w10/`:
      empty, populated, form, diary, add, edit, saved-food select, macro
      targets, history, over-goal, keyboard, 360/390/412/768/1280, light + dark
- [x] 7.2 Inspect every capture; fix observable defects; re-render
      (dark-theme capture was stale once and was re-taken; diary-empty
      captured in diary mode after a harness fix)

## 8. Validation and publication

- [ ] 8.1 Ladder: `git diff --check`, typecheck, lint, `validate:themes`,
      `openspec validate --all`, `agent:plan:validate:all`, `npm test`
      (unit + integration), affected e2e lanes, `sim:validate`
- [ ] 8.2 Adversarial review: nutrition writes, dates, form state,
      navigation, a11y, responsiveness, performance (D14 unchanged)
- [ ] 8.3 Publish through the normal PR/merge workflow; verify exact-head
      hosted CI (only the two pre-existing audit advisories may be red)
- [ ] 8.4 Final records: defect-ledger W10 note, parent plan checkpoint,
      W11 handoff
