# W17 — Final cross-wave integration, regression and release readiness

## 1. Preflight and planning

- [x] 1.1 Author this slice + `execplan.md` before W17 work
- [x] 1.2 Verify the integrated source, wave commits and tree state
- [x] 1.3 Confirm no merge-conflict markers, stale temp workflows or abandoned bypasses

## 2. Release-candidate provenance

- [x] 2.1 Record the exact RC SHA, base, wave commits and tree state
- [x] 2.2 Inventory artifacts and their identities (web export, goldens, APK)
- [x] 2.3 Write `docs/ui-ux/v3-audit/w17/rc-manifest.md` with the candidate's known limits

## 3. Full verification ladder

- [x] 3.1 Lane 1 — static/contract: typecheck, lint, themes, OpenSpec, plans, profile guard
- [x] 3.2 Lane 2 — unit + real-SQLite integration with precise counts
- [x] 3.3 Lane 3 — web/PWA: P0 journeys + full Chromium battery
- [x] 3.4 Lane 4 — timezone/clock/lifecycle across five zones
- [x] 3.5 Lane 5 — deterministic simulation
- [x] 3.6 Lane 6 — visual goldens + accessibility instrument
- [x] 3.7 Lane 7 — Android (consume W16) + security audit
- [x] 3.8 Write `verification-matrix.md` with per-lane real counts and explicit not-run rows

## 4. Security reconciliation

- [x] 4.1 Run the exact CI audit gate at current head
- [x] 4.2 Record each finding's package chain, advisory, installed/latest versions, range, fix availability
- [x] 4.3 Verify bundle exposure rather than assuming it
- [x] 4.4 Leave the gate red; add no waiver, allowlist or threshold change

## 5. Cross-wave corrections

- [x] 5.1 Reproduce each newly found defect on the integrated source
- [x] 5.2 R-1: fix the `agentDocConsistency` CRLF test defect and re-run the full suite
- [x] 5.3 R-2: repair the W13-broken command-center flow guard
- [x] 5.4 Write `defect-register.md` with resolved defects and carried residuals

## 6. Handoff and closure

- [x] 6.1 Write `correction-handoff.md` with one imperative first action and acceptance gates
- [x] 6.2 Write this wave's `README.md` with the consolidated verdict
- [x] 6.3 Update the master plan, parent OpenSpec tasks and `known-gaps.md`
- [ ] 6.4 Commit and publish W17; reconcile review threads
- [ ] 6.5 Remove the W16 certification worktree; confirm development ports are free
