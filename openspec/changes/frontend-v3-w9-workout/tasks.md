## 1. Bookkeeping

- [x] 1.1 Author `openspec/changes/frontend-v3-w9-workout/execplan.md` as the only living W9 plan, and point the parent checkpoint at it
- [x] 1.2 Record the W9 baseline (`1502ad3f6b188b5c4bc6548f4bed00261e0e9664`) and preserve the stash, the iOS temp dir, and W1–W8.5 captures
- [x] 1.3 Record fresh Refero workout research in `docs/ui-ux/14-v3-reference-ledger.md` (R12)

## 2. W9.1 — Landing hierarchy

- [x] 2.1 Compact training-state header: no doc subtitle; one primary action (resume > scheduled > quick start)
- [x] 2.2 Quick-start routine rows: name, exercise/set counts, last performed, one Start per row
- [x] 2.3 Single resume authority: one dominant Resume, truthful progress copy, secondary confirmed discard, stale/missing routine re-validation
- [x] 2.4 Collapsed weekly strip (SUR-06): readable assignments, Rest vs unplanned distinct, today marked, day-tap assignment sheet with explicit template-vs-override choice, Edit plan retained, reschedule retained
- [x] 2.5 History & insights disclosure (collapsed default): recent sessions, totals, progress/PRs, body weight, volume, heatmap, streak/days; heavy derivations gated on open
- [x] 2.6 Preserve routine management: add/validate, swipe delete, detail modal, quick-complete, one-row guards

## 3. W9.2 — Live session

- [x] 3.1 Session top bar: routine, accurate set progress, elapsed, End
- [x] 3.2 Exercise block with flat set table: previous context, modality-correct inputs, done per set, completed/skipped/upcoming states not color-only
- [x] 3.3 Modality coverage: weighted, bodyweight (+additional load), timed, cardio (duration/distance/pace), unilateral, legacy free-text, effort scale
- [x] 3.4 Rest dock: contextual countdown, skip, adjust; never overlays inputs; zero-rest and superset rest semantics unchanged
- [x] 3.5 Session-local Add set: `withAddedSet` pure transform + remap, draft persistence, resume, correct numbering/rest, log persistence
- [x] 3.6 Performance posture: memoized rows, isolated rest tick, debounced draft, responsive typing under an active timer

## 4. W9.3 — Finish, PR, cancel truth

- [x] 4.1 Finish: exactly-once preserved, save-failure error + retry, XP only after durable commit, calm summary (duration/sets/skipped/volume/PRs/Done)
- [x] 4.2 PR notice: brief, exercise-linked, nonblocking, dismissible, reduced-motion aware, no rerender duplicates, skipped never a PR
- [x] 4.3 Cancel: truthful draft-preserving leave vs confirmed discard; web + native confirmation parity

## 5. Regression coverage

- [x] 5.1 Unit: landing view model (training state, quick start, week strip), session view model (progress, rows), `withAddedSet` remap contract
- [x] 5.2 Unit: draft normalize accepts the additive `addedSets` field and rejects malformed payloads
- [x] 5.3 Integration: real-SQLite add-set session logs prescribed + added sets with correct numbering, rest, and completion disposition; resume reconstructs
- [x] 5.4 E2E: landing quick start/resume/week, session set entry + rest dock + add set + finish + PR + cancel on the updated anatomy
- [x] 5.5 Update existing workout specs to the new anatomy without weakening oracles; keep double-submit and exactly-one-row SQL oracles

## 6. Evidence and gates

- [x] 6.1 Capture and inspect W9 rendered evidence under `docs/ui-ux/v3-audit/w9/` (populated, rest, scheduled, resume, empty, quick start, week, editor, detail, strength, bodyweight, cardio, completed, skipped, rest dock, zero rest, long name, PR, finish, history, dark, large text, HEAVY, 360/390/768/1280)
- [x] 6.2 Defect ledger: SYS-20 and SUR-06 dispositions; audit SYS-01/02/07/17 posture
- [x] 6.3 Validation ladder: diff --check, typecheck, lint, themes, openspec, plans, unit+integration, workout/boundary/a11y/fat-fingers/navigation/theming/command journeys, deterministic simulation, qa:affected/qa:fast (qa:full per policy), D14 baseline comparison without threshold changes
- [x] 6.4 Publish via branch/PR; verify exact-head hosted CI; record advisory inventory and hosted-E2E skip honestly
