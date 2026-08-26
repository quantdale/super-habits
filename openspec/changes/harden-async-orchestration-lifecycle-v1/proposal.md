## Why

The completed whole-system resilience campaign closed broad migration, recovery,
soak, and cross-feature durability work, but its final qualification exposed a
more specific systemic risk: **stale async state adoption**. Two real product
bugs found on 2026-08-26 had the same root class despite living in different
features. Calories could let delayed AsyncStorage hydration overwrite a newer
manual view choice. Pomodoro could let sibling loaders inside one parallel
refresh invalidate one another through incorrect shared refresh-generation
ownership, silently discarding Focus history.

The repository now has `createAsyncRefreshGuard()` / `useGuardedAsyncRefresh()`
and monotonic account-task sequencing in `AppProviders`, but the contract is
not consistently applied or mechanically obvious across every async UI,
hydration, remote-phase, timer/listener, and foreground/day-rollover surface.
The current 13-warning lint baseline is also concentrated in effect-driven
state loaders, making lifecycle debt materially relevant to correctness rather
than mere style.

## What Changes

- Audit every tracked repository path and build a durable coverage ledger so no
  source/config/test/doc/harness area is silently skipped.
- Build an async state-adoption inventory covering effect-started loads,
  `Promise.all` fan-out, delayed `.then()` settlements, AsyncStorage hydration,
  remote timeout phases, foreground/day-rollover refresh, timers, event
  listeners, notification responses, sync/backup post-processing, and
  unmount/target-change behavior.
- Standardize latest-only ownership around the existing refresh-guard primitive
  where a stale-result hazard exists, while preserving safe read parallelism
  and avoiding a second state/refresh framework.
- Prove and repair user-intent precedence when editable or preference state is
  touched while initial hydration/refresh is still pending, with Daily Plan and
  AsyncStorage-backed UI as priority surfaces.
- Deterministically test the restore-preview late-settlement candidate in
  `AppProviders`: timed-out underlying remote promises may continue running,
  while newer maintenance/post-flush previews can also update restore state.
- Audit timer/listener/subscription ownership and repeated mount/background/
  foreground/reconnect paths for duplicate registration, stale closures, and
  post-unmount adoption.
- Eliminate the 13-warning lint baseline without disabling rules or adding
  blanket suppressions; treat lifecycle warnings as correctness audit leads.
- Add deterministic race seams/tests plus realistic browser/simulation/native
  replay where stable, then run full exact-tree qualification.
- Reconcile repository truth, including stale schema-version wording,
  load/stress known-gap wording after the new soak lane, and all active
  `test.fixme`/skip classifications.

## Capabilities

### New Capabilities

- `async-orchestration-determinism`: Every high-risk asynchronous operation that
  can update user-visible or cross-cutting state has explicit ownership,
  latest-result/user-intent precedence, cleanup, and deterministic regression
  proof so older work cannot overwrite newer state or duplicate side effects.

### Modified Capabilities

- None. Existing feature, backup, restore, account, sync, notification, timer,
  and local-date behavior remains the governing product contract; this change
  hardens how asynchronous work is orchestrated around those contracts.

## Impact

- Expected product-source changes are concentrated in `lib/` async lifecycle
  helpers; effect-driven views under `features/`; `core/providers/AppProviders.tsx`;
  and any timer/listener/storage caller where deterministic proof finds a real
  ownership defect.
- New/expanded unit and integration tests should prefer deferred promises,
  controlled clocks, and framework-free primitives over sleep-based race tests.
- Playwright/simulation/native additions are limited to stable end-to-end proof
  of state-adoption/lifecycle invariants; test assertions must not be weakened.
- No product feature expansion, no new global state framework, no live Supabase
  mutation without an authorized disposable target, and no schema migration
  unless the audit proves one is genuinely required for data correctness.
- Documentation updates are surgical: structure/schema truth, capability gaps,
  QA impact mapping, and this OpenSpec/ExecPlan evidence.
