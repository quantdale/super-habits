## Why

`openspec/specs/local-reward-ledger` requires that "an action identified by kind and source key
MUST award at most once", but it never defines what makes two real-world events the _same_ action.
That gap became a shipped defect: `actionSourceKey` keyed a `todo` award by the bare todo id, so the
first completion of a task owned the key for the ledger's whole lifetime. Re-opening that task and
completing it again on a later local day is a second real action — the user did the work twice — but
it minted no XP, gave no reward feedback, and left no `xp > 0` row for that day, so the week strip
showed a miss and a live reward streak broke.

Per-day keying (`<dateKey>:<todoId>`) is the fix, but it raises a spec question the text does not
answer: is a todo completion on a new day a new action? It also needs an upgrade contract, because
the old bare-id rows survive an app update and must not be re-paid.

## What Changes

- State explicitly that a completion of the same todo on a **new local calendar day is a new
  action**, and that a completion of the same todo within one local day is the **same** action
  (a 0→1→0→1 toggle pays once) — satisfying the existing "at most once" requirement, not exempting
  it.
- State the upgrade contract: an award stored by an earlier build under a legacy key form (bare
  `todo` id) MUST be treated as covering the local day recorded on that row, so the first pass after
  an update cannot re-pay it, while a later-day re-completion still earns.
- Note that habit (`<dateKey>:<habitId>`), nutrition (day key), and the single-use entity kinds
  (`focus`/`workout`/`plan`/`review`, bare id) keep their existing key shapes — one durable row is
  one action for those kinds.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-reward-ledger`: clarify what identifies one action for a repeated-completion entity, and
  add the legacy-key compatibility requirement.

## Impact

One production function (`actionSourceKey`) plus a small legacy-key check in the award transaction,
and regression coverage at the domain, real-SQLite integration, and browser levels. No schema
change, no migration, and no data rewrite: legacy rows are read, never mutated. No change to the
local-only posture, to quest/badge/streak math, or to any non-todo action key.
