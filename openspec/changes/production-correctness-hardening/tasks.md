## 1. Audit and durable state

- [x] 1.1 Reconcile HEAD, Git worktree, OpenSpec companion changes, `known-gaps.md`, quarantined markers, and current test inventory into the umbrella ExecPlan; classify each candidate gap and record dependencies.
- [x] 1.2 Run the initial focused reproductions for the first data-integrity gap and validate the ACTIVE ExecPlan before implementation.

## 2. Priority 0 — data integrity

- [x] 2.1 Apply `fix-todo-add-double-submit` and prove one-row-or-zero behavior for rapid create and edit submits, including pure guard coverage and J7 quarantine release.
- [x] 2.2 Apply `fix-restore-emptiness-counts-deleted-rows` and prove deleted-only devices block restore in real SQLite, including the in-transaction re-check and CG-2 release.
- [x] 2.3 Apply `fix-linked-action-habit-increment-reentry` and prove same-day source re-entry does not double-increment while next-day chains and existing todo-complete behavior remain valid.
- [x] 2.4 Apply `fix-recurring-todo-expansion-idempotency` and prove repeated same-day expansion creates one instance and one outbox create, without changing recurrence semantics; performance release remains pending under §4.1.

## 3. Priority 1 — state and boundary correctness

- [x] 3.1 Apply `fix-day-rollover-refresh` and release CG-1 only after the deterministic timezone journey proves active and inactive mounted sections are fresh.
- [x] 3.2 Verify and, if still required, apply `fix-pomodoro-defaults-propagation`; prove idle defaults update live while running/paused timer state is preserved.
- [x] 3.3 Apply `fix-restore-service-worker`; verify real cross-origin restore requests bypass the app-shell SW while same-origin cache behavior and remote-boundary tests remain intact; full sync/default-lane regression remains in §5.2.

## 4. Priority 2 — explicit performance contracts and boundary regressions

- [x] 4.1 Reproduce recurring-todo D14 switch latency after the idempotency fix and preserve CG-4's strict quarantine after repeated HEAVY runs reached 813ms against the unchanged 800ms ceiling.
- [x] 4.2 Profile and optimize HEAVY diary/saved-meal search without changing the 500ms D14 threshold; preserve CG-5's strict quarantine after the latest fresh run measured 513ms and repeated runs remained above the ceiling.
- [x] 4.3 Fix the newly discovered heatmap week-column boundary defect; cap calendar-padded output to the explicit `weeks` contract and prove the unchanged HEAVY 52-column assertion.

## 5. Final proof and handoff

- [x] 5.1 Run relevant deterministic personas/simulations and record findings/classifications; promote the heatmap boundary discovery to a pure regression and release it after the focused J8 proof.
- [x] 5.2 Run the strongest applicable deterministic QA matrix, validate impact map/OpenSpec/ExecPlan state, and reconcile the two remaining performance quarantines and native capability gaps.
- [x] 5.3 Complete the umbrella ExecPlan with outcomes, production-readiness assessment, remaining risks, and next product phase.
