## Why

Momentum Garden V1 qualification is complete, but the repository's remaining
registered gaps are systemic: load/stress and memory profiling are not covered
by the HEAVY fixture (capability gap #4), migration-from-old-database journeys
have no durable fixture laboratory (gap #5), pre-cutover date-key corpora
remain unavailable (gap #6), and recovery boundaries have never been exercised
as hostile input at the depth this campaign requires. Normal feature QA does
not adequately exercise long-running resource growth, repeated lifecycle
churn, historical SQLite upgrade paths, transactional recovery under failure,
or cross-feature date/time disagreement.

## What Changes

- Audit the system as one connected whole: DB bootstrap/migrations/indexes,
  backup/sync/portable/account boundaries, feature data writers, providers and
  lifecycle hooks, simulation/E2E harnesses, and stale documentation claims;
  severity-classify findings in the campaign ExecPlan audit ledger.
- Build a repeatable, bounded long-session soak lane driven through product
  behavior with machine-readable resource/report output and trend-based
  assertions derived from existing contracts (no invented thresholds).
- Create a historical SQLite migration fixture laboratory covering
  representative historical schema boundaries with row/default/idempotency
  oracles plus failure-torture seams where safely supported.
- Fault-inject recovery boundaries (backup manifest/checksum, portable import,
  restore, owner binding, outbox interactions) and prove authoritative-state
  atomicity after every representative failure.
- Stress cross-feature local-date/timezone/lifecycle boundaries and add
  regression proof at the narrowest stable layer for any discovered invariant.
- Run the supported Android lanes sequentially when the environment provides
  them, including repeated kill/relaunch endurance as far as the harness
  reliably supports; keep iOS/Windows an explicit ENVIRONMENT result.
- Adopt, validate, and finish the coherent inherited uncommitted read-path
  hardening wave found in the working tree at campaign start (migration-24
  hot-path indexes, concurrent Overview/Workout/backup reads, batched sync
  deletes) rather than discarding or duplicating it.
- Update known gaps, QA mapping, docs, OpenSpec tasks/spec, and a Version-2
  ExecPlan with exact commands, artifact paths, classifications, and final
  Git delivery evidence.

## Capabilities

### New Capabilities

- `whole-system-resilience`: Durable evidence that sustained realistic use,
  repeated restart/foreground cycles, representative old-database upgrades,
  malformed/interrupted recovery operations, and broad cross-feature state
  transitions preserve correctness, bounded resources, and recoverable state
  without silent data loss or dishonest classification.

### Modified Capabilities

- None. Product requirements shipped by prior campaigns remain unchanged.

## Impact

- New test infrastructure lives under `tests/integration/`, `simulation/`,
  and/or dedicated harness helpers; product source changes only where the
  audit demonstrates a real defect.
- The inherited working-tree change set (migration 24 + read concurrency +
  sync batching) is validated and either landed as campaign work or repaired;
  its affected areas are `core/db/client.ts`, `core/backup/**`,
  `core/sync/**`, `core/providers/AppProviders.tsx`, `features/calories/`,
  `features/workout/`, `features/overview/`, and their tests/docs.
- `docs/testing/known-gaps.md` narrows only gaps actually proven closed;
  synthetic migration coverage is documented as synthetic, never as real
  corpus proof.
- No live Supabase mutation is performed; remote-boundary work uses existing
  mock/disposable lanes and keeps capability gaps honest.
