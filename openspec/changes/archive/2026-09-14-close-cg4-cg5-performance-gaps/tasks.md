## 1. Recovery and baseline

- [x] 1.1 Create and validate the versioned ExecPlan; run `agent:resume` and reconcile the pre-existing dirty worktree before implementation.
- [x] 1.2 Build a fresh web export and reproduce the current J8 HEAVY journey with both strict quarantines temporarily observed as expected gaps; capture at least 10 sequential timing samples for CG-4 and CG-5 using the existing harness without changing its contract.
- [x] 1.3 Add temporary phase instrumentation or browser profiling at the smallest useful boundaries, record the measured bottleneck and classify host/test variance, then remove temporary instrumentation unless it is durable and justified.

## 2. CG-4 recurring-todo switch

- [x] 2.1 Implement the smallest evidence-backed CG-4 optimization while preserving recurrence semantics, idempotency, sync behavior, list ordering, mounted sections, and the HEAVY fixture.
- [x] 2.2 Run recurring-todo unit/domain/integration regressions, affected QA, and repeated strict J8 CG-4 measurements; retain the quarantine if the unchanged 800ms ceiling is not reliable.
- [x] 2.3 Remove the CG-4 quarantine and close its known-gap entry only after repeated strict runs pass with margin and relevant journey/simulation evidence is recorded.

## 3. CG-5 calorie diary search

- [x] 3.1 Implement the smallest evidence-backed CG-5 optimization while preserving case behavior, matching semantics, ordering, diary/saved-meal results, empty-search behavior, and macro/calorie correctness.
- [x] 3.2 Add only justified query/index changes after inspecting real query plans; if schema changes, use the next append-only migration and verify forward/idempotent real-SQLite behavior.
- [x] 3.3 Run calorie unit/data/integration regressions, affected QA, and repeated strict J8 CG-5 measurements; retain the quarantine if the unchanged 500ms ceiling is not reliable.
- [x] 3.4 Remove the CG-5 quarantine and close its known-gap entry only after repeated strict runs pass with margin and relevant journey/simulation evidence is recorded.

## 4. Final proof and handoff

- [x] 4.1 Run recurrence and calorie behavioral regressions, relevant Chromium journeys, deterministic personas, and a bounded seeded exploration with recorded seed(s).
- [x] 4.2 Run the impact-directed broad QA matrix, sync lane where applicable, impact/OpenSpec/plan validators, and classify every failure honestly.
- [x] 4.3 Complete the ExecPlan with before/after distributions, profiling findings, changed areas, validation ledger, risks, and an explicit CG-4/CG-5 verdict.
