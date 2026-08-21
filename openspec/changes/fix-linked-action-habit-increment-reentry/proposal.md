## Why

The linked-action engine's re-entry guards (observed while writing **J6 — "Chain reaction"**, risk **R4**) are keyed on an identity the UI **regenerates per completion**, so a `todo.completed → habit.increment` chain can re-fire and increment again on untick→tick.

In `core/linked-actions/linkedActions.engine.ts`, each `processSourceAction` call generates a fresh `eventId` / `chainId` via `createId` (lines 103–106) when the caller does not supply one. The dedup guards — `source_event_already_executed` (a prior execution exists for the same `eventId`) and `chain_guard_duplicate` (same `chainId` + rule + effect fingerprint) — therefore never match across two separate completions of the same todo, because each completion gets a brand-new event/chain id. A `todo.complete` effect is safe only because completing an already-completed target is idempotent. A `habit.increment` effect is **not** idempotent:
untick → tick re-fires the chain and increments the target habit again, producing an extra completion tick the user never intended.

This is latent today (no shipped journey wires a `habit.increment` rule; J6 covers `todo.complete` only), but it is a genuine correctness defect in the engine's re-entry contract, and the J6 author observed it while writing that journey.

## What Changes

- **Key the re-entry guards on a stable semantic identity** instead of the per-call regenerated `eventId`/`chainId`: e.g. the source entity + trigger + the local day key (or the source row's `updated_at`/completion timestamp), so a second completion of the same source todo on the same day is recognized as a duplicate of the first, regardless of the fresh event/chain ids.
- **Make the offending effect idempotent as a second line of defence**: `habit.increment` should not double-increment a target habit for the same (source, day); if the guard identity is not stable everywhere, the increment path itself should be a no-op (or a single increment) when the same sourced completion already applied.
- **Keep `todo.complete` behaviour unchanged** (idempotent; J6 asserts `applied` then `skipped` on re-fire) and keep the `target_missing` skip (J6's third step) and the execution-row recording intact.
- **Verify with a J6-style journey** that wires a `todo.completed → habit.increment` rule and asserts untick→tick does not increment the target twice (row-level `habit_completions` count).

## Capabilities

### New Capabilities

- `linked-action-habit-increment-reentry`: a `todo.completed → habit.increment` chain fires exactly once per sourced completion; untick→tick of the source does not double-increment the target habit.

### Modified Capabilities

- None. The `todo.complete` chain (idempotent, asserted by J6) and the `target_missing` / execution-recording behaviour are unchanged; only the dedup identity and the non-idempotent increment effect are corrected.

## Impact

- **Modified files**: `core/linked-actions/linkedActions.engine.ts` (stable re-entry identity), `core/linked-actions` effect definitions for `habit.increment` (idempotency), and a new/extended J6-style journey or unit test asserting the single-increment contract.
- **Behaviour change**: a habit-increment linked action no longer double-applies on re-fire. No change for the `todo.complete` case or for existing single-fire flows.
- **No schema/migration impact**: no SQLite or `app_meta` changes.
- **Testing**: a regression journey/test asserting one increment per sourced completion; `todo.complete` re-fire (J6) and `target_missing` continue to pass.
- **Follow-up changes**: none anticipated; this closes the J6 habit.increment finding.
