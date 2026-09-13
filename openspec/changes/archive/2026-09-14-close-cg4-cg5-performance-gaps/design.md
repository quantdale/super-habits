## Context

The existing J8 journey in `e2e/journeys/three-months-in.spec.ts` seeds the authoritative HEAVY fixture, mounts all six permanently-mounted sections, measures section-switch completion at the section opacity boundary, and measures diary search until the matching result is rendered. CG-4 and CG-5 are `test.fixme()` quarantines with strict `<= 800` and `<= 500` assertions still in the step bodies. The completed production-correctness hardening change records prior recurrence and local-search optimizations but leaves both gaps open.

The app uses a single SQLite connection and a permanently mounted React Native Web shell. Todo recurrence expansion is a data-layer responsibility; calorie diary and saved-meal filtering are UI/data orchestration paths. Existing fixture counts and timing definitions are part of the contract.

## Goals / Non-Goals

**Goals:**

- Establish repeated current-HEAD baselines before editing product code.
- Attribute elapsed time to navigation, refresh, database, JavaScript filtering/aggregation, state updates, and render/interactive completion wherever practical.
- Apply the smallest change supported by measured evidence and preserve all user-visible semantics.
- Prove both unchanged ceilings with repeated HEAVY journey runs and release only the corresponding quarantines.

**Non-Goals:**

- Raising thresholds, reducing fixtures, changing assertions, adding retries, or moving legitimate work outside the measured path.
- Rewriting the shell, replacing the list strategy wholesale, adding a general performance framework, or changing search/recurrence requirements.
- Adding schema changes without a demonstrated query-plan or write-path benefit.

## Decisions

1. **Use J8 as the benchmark authority.** The existing Playwright journey is the only acceptance harness for these gaps because it preserves the real fixture, browser project, continuity, and user-visible completion markers. Any extra instrumentation will be additive and temporary.

2. **Measure before selecting a layer.** First separate browser action overhead from app-boundary work, then instrument the relevant data and UI phases. A fast micro-operation is not evidence that the user path is fast.

3. **Prefer local, semantics-preserving changes.** Candidate fixes may include eliminating duplicate refresh work, batching or narrowing reads, stable derived data, memoizing only measured hot subtrees, or a justified index. The selected change must retain idempotency, search matching/order, and all row-level oracles.

4. **Treat variance explicitly.** Run a fixed number of sequential repetitions on the configured Chromium journeys project and report min/median/p90/max. A threshold passes only when the strict assertion passes on every acceptance run with useful headroom; a single pass cannot close a gap.

5. **Keep schema truth append-only.** If an index is proven necessary, add it in migration 12 and update the reference snapshot according to repository convention, with forward and idempotence coverage. Otherwise, leave the schema unchanged.

## Risks / Trade-offs

- [Risk] Timing is affected by browser/OPFS warmup, GC, or host contention → record project, fixture, clock/state, run order, build freshness, and distributions; preserve failures and classify them before interpreting variance.
- [Risk] Recurrence optimization can duplicate or omit a daily instance → retain the existing atomic/idempotency path and run recurrence integration and J8 row oracles.
- [Risk] Search optimization can alter case matching, order, empty state, or diary aggregation → retain behavioral assertions and add focused tests for the existing semantics.
- [Risk] The permanently mounted shell can make unrelated renders part of the latency → profile provider/state churn and optimize only measured subtrees, not by removing required mounted behavior.

## Migration Plan

No migration is expected. If query-plan evidence requires an index, add only the next append-only migration, verify fresh and upgraded databases plus rerun idempotence, then rerun real-SQLite integration tests before the browser acceptance run.

## Current Outcome

CG-4 is closed: stable task-list callbacks, mounted-screen memoization, and inactive-section accessibility suppression produced a reliable unchanged-threshold result without changing recurrence behavior. CG-5 remains open: the calorie filter and state commit are fast, but the full HEAVY continuity path still has intermittent misses after the 200+ task-list walk. No CG-5 product fix or schema/index change has been accepted, and its strict quarantine remains in place.

## Open Questions

None. The thresholds, fixture, assertions, and user-visible timing boundaries are already specified by the existing journey and gap register.
