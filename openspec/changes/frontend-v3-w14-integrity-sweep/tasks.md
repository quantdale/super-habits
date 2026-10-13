# W14 — Full UI/UX integrity sweep and convergence

## 1. Preflight and planning

- [x] 1.1 Confirm W12 (`1d54b70`) and W13 (`b1569f0`) are integrated on the campaign branch
- [ ] 1.2 Author this slice + `execplan.md` before any W14 edit

## 2. Whole-app matrix execution

- [ ] 2.1 Re-run the existing whole-app instrument (`e2e/visual-audit.spec.ts`) and every per-wave audit on the integrated build
- [ ] 2.2 Re-run the W12 and W13 audit instruments to confirm both waves coexist in one build
- [ ] 2.3 Capture the six primary destinations at 360/390/412/768/1280 in light and dark
- [ ] 2.4 Capture the secondary surfaces (Quick Capture, Planning Hub, Weekly Review, Settings, Command Center, Achievements)
- [ ] 2.5 Cover FIRST_RUN, EMPTY, TYPICAL, HEAVY, LONG_TEXT and ERROR fixtures where the surface supports them
- [ ] 2.6 Run the accessibility instrument and record manual caveats

## 3. Defect ledger

- [ ] 3.1 Write `docs/ui-ux/v3-audit/w14/README.md` with the run manifest and the inspected/not-run matrix
- [ ] 3.2 Register every defect with ID, surface, category, severity, SHA, viewport/theme/state, repro, capture, root cause, owner, fix, verification
- [ ] 3.3 Reconcile with the existing `docs/ui-ux/15-v3-defect-ledger.md` statuses

## 4. Bounded convergence fixes

- [ ] 4.1 Reproduce each P0/P1 on the integrated source before fixing
- [ ] 4.2 Add a failing regression or visual assertion for behavioural fixes
- [ ] 4.3 Fix the smallest owning surface; shared-primitive fixes get an explicit broad impact map
- [ ] 4.4 Rebuild, re-run the affected journey and adjacent surfaces, inspect before/after captures
- [ ] 4.5 Move ledger entries OPEN → FIXED → VERIFIED-FIXED only with that proof

## 5. Validation and closure

- [ ] 5.1 `qa:fast`, `qa:affected`, `qa:integration`, focused Chromium, P0 journeys, deterministic simulation, timezones
- [ ] 5.2 Adversarial review of the ledger's truthfulness; correct overclaims
- [ ] 5.3 Publish W14 and advance the parent checkpoint to W15
