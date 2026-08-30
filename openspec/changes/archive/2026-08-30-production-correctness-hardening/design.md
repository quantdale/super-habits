## Context

The repository has seven active companion changes created from the production-readiness TODO manifest, plus two explicit D14 performance contracts in `docs/testing/known-gaps.md`. The companion changes already contain the product requirements and regression locations; this umbrella owns sequencing, evidence, and recovery. Existing worktree changes concern the agent/QA lifecycle and are preserved as unrelated work.

## Goals / Non-Goals

**Goals:**

- Establish the current gap queue from HEAD rather than historical counts.
- Serialize overlapping fixes by risk and dependency: data integrity, state correctness, then performance.
- Reproduce each gap, preserve its strict regression, implement the smallest root-cause change, run impact-directed QA, and reconcile the companion OpenSpec, quarantine register, and ExecPlan.
- Finish with deterministic broad QA and an explicit status for every remaining capability gap or environment-dependent lane.

**Non-Goals:**

- No new sync-v2 merge policy, weekly scheduling, AI functionality, native notification redesign, product redesign, or unrelated refactor.
- No changes to assertions, retries, timeouts, or quarantines except when the named companion fix proves the unchanged contract.
- No concurrent edits to overlapping feature, provider, database, service-worker, or shared test files.

## Decisions

1. **Use existing companion changes as normative units.** The umbrella does not duplicate their product specs. Each fix is implemented and marked complete in its own change; this change records the queue and cross-change proof.
2. **Prioritize correctness over state and performance.** Initial waves are todo submission, restore tombstones, linked-action re-entry, and recurrence duplication; rollover, Pomodoro propagation, and service-worker boundary follow; recurrence and diary latency are measured/optimized only after their behavior remains covered.
3. **Prefer data-layer idempotency for duplicate records.** Where an operation can race, the guard belongs at the write boundary and must control sync enqueue, with real-SQLite coverage. UI guards remain appropriate for modal submit re-entry but do not replace persistence checks where the contract requires them.
4. **Use the existing impact map and lane matrix.** `npm run qa:affected` selects the cheapest sufficient gates. Standard `dist/` and dummy-Supabase `dist-sync/` are distinct: remote-boundary fixmes remain lane-gated, while product quarantines are released only by their companion changes.
5. **Treat failures with the repository taxonomy.** Product bugs are fixed; test/environment/known-gap classifications are recorded with evidence in this plan and are not hidden by suite edits.

## Risks / Trade-offs

- [Risk] Shared test fixtures and the permanently-mounted shell make apparently isolated fixes interact. → Serialize changes, checkpoint before broad runs, and rerun the affected journeys after each fix.
- [Risk] Restore and linked-action changes can silently corrupt or duplicate data. → Use real-SQLite integration tests and row/outbox/execution oracles before E2E release.
- [Risk] Performance measurements vary by host. → Keep D14 ceilings unchanged, record repeated baselines, and classify host limitations as environment rather than raising thresholds.
- [Risk] Service-worker behavior is outside Vitest. → Verify the real SW on `journeys-sync`, keep standard-lane boundary gates, and preserve shell-cache assertions.
