# W12 — Weekly Review / Progress / Activity (narrative-led reflection)

## 1. Preflight and planning

- [ ] 1.1 Verify repository truth (HEAD `1f23da4` = origin/main), preserve
      `stash@{0}` (`pre-recovery-local-changes`) and `.tmp-ios36423379932/`
- [ ] 1.2 Baseline gates at the W11.5.1 head: typecheck, lint, `npm test`,
      `openspec validate --all`, `agent:plan:validate:all`
- [ ] 1.3 Author this OpenSpec slice + `execplan.md` before any W12 edit

## 2. W12 baseline rendered evidence

- [ ] 2.1 Capture the current Weekly Review, Progress and Timeline surfaces
      (populated, empty, dark, 360/390/412/768/1280) into
      `docs/ui-ux/v3-audit/w12/before/`
- [ ] 2.2 Inspect the captures and write `baseline.md` with the observed
      hierarchy/density defects and measured first-fold positions
- [ ] 2.3 Record the reference decisions (adopt/reject) used by the design lock

## 3. Design lock

- [ ] 3.1 Write `design.md` D12.1–D12.6 (reflection hierarchy, step model,
      insight wording, Progress headline model, Activity filter grammar, test contract)

## 4. Weekly Review reconstruction

- [ ] 4.1 Collapse Summary+Insights into one `review` step: narrative first,
      all domain counts behind one `All numbers` disclosure
- [ ] 4.2 Replace the dot indicator with a labelled `Step n of 5 · Name` progress line
- [ ] 4.3 Merge Priorities + New Commitments into one `plan` step with a single
      add affordance each and per-row commitment notes disclosure
- [ ] 4.4 Rename remaining steps to `decide`, `reflect`, `confirm`; keep the
      `done` terminal state and the next-week apply action separate
- [ ] 4.5 Remove evaluative insight wording (`generateInsights`) and the
      under-goal "win"; keep numeric facts
- [ ] 4.6 Verify draft continuity backwards/forwards and the existing-week
      edit path

## 5. Progress Insights reconstruction

- [ ] 5.1 Explicit period sentence with both window dates
- [ ] 5.2 Headline rows for the narrative-backed metrics; no percentage from a
      zero prior window; no danger colouring of decreases
- [ ] 5.3 One `More details` disclosure holding the remaining metrics and the
      planning group with distinct units
- [ ] 5.4 Preserve empty vs error vs zero-with-context distinctions

## 6. Activity Timeline reconstruction

- [ ] 6.1 One `Filters` disclosure carrying sources, range and day chips plus a
      current-selection summary and an active-count signal
- [ ] 6.2 Reset action restoring defaults; selection persists while closed;
      day list derived from the ranged set
- [ ] 6.3 Flat chronological event rows with title + category/time metadata;
      remove the per-row card and ornamental icon tile
- [ ] 6.4 `No matching activity` + reset for a filtered-empty result, distinct
      from the genuinely-empty state

## 7. Regressions and oracles

- [ ] 7.1 Update `e2e/weekly-review.spec.ts` to the new step sequence without
      weakening its SQLite/outbox oracles
- [ ] 7.2 Unit tests for the insight-wording corrections
- [ ] 7.3 Real-SQLite oracle: one review row written; a rejected write surfaces
      a failure instead of a false success
- [ ] 7.4 Browser assertions for the three new disclosures, the
      `new this period` rule, filter persistence/reset and filtered-empty copy
- [ ] 7.5 W12 audit spec `e2e/planning-w12-audit.spec.ts` capturing
      before/after at 360/390/412/768/1280 light/dark

## 8. Validation, review and closure

- [ ] 8.1 `qa:fast`, `qa:affected`, `qa:integration`, focused Chromium E2E,
      P0 journeys, deterministic simulation, `qa:timezones`
- [ ] 8.2 Adversarial review of review-domain fidelity, action labels,
      screen-reader affordances and screenshot quality; fix findings
- [ ] 8.3 Inspect every new capture and write `docs/ui-ux/v3-audit/w12/README.md`
      with the defect register (severity, cause, fix, retest, screenshot)
- [ ] 8.4 Publish through the normal workflow; update this plan, the parent
      ExecPlan checkpoint and the defect ledger (`SUR-12`)
