## Why

The current app can commit user-visible local changes across multiple
independent failure boundaries: a linked action can be interrupted between its
effect and receipt, a sync snapshot can be persisted out of order, and a
remote-delete intent can be lost after a local tombstone. The paid AI endpoints
also need an explicit authenticated and quota-controlled boundary rather than
relying on browser CORS or an implicit gateway configuration.

This change turns those implicit assumptions into durable, testable product
guarantees while preserving the offline-first model and existing feature
semantics.

## What Changes

- Make linked-action executions recoverable after process interruption, with
  durable claims and exactly-once receipts for non-idempotent effects.
- Make synced local mutations commit their SQLite change and remote-sync intent
  atomically, using a revision-aware durable outbox that survives restart and
  protects newer mutations during an in-flight push.
- Make habit threshold transitions use the count returned by the mutating SQL
  statement, and reject stale/zero-row feature mutations without secondary
  writes or misleading sync records.
- Define calorie ledger versus saved-meal cache failure semantics and enforce
  workout active-parent integrity while preserving historical workout logs.
- Add a repository-owned Supabase schema/RLS contract and validation command,
  plus append-only backend support for authenticated per-user AI quotas.
- Require explicit function-level AI authentication before provider calls,
  bound request size/time, and return a clear 429 without invoking a provider
  when a user quota is exhausted.
- Harden persisted JSON settings, native-critical workflow coverage, React
  effect architecture, and local-midnight rollover scheduling.

## Capabilities

### New Capabilities

- `linked-action-recovery`: Durable linked-action execution claims, replay, and
  exactly-once effect receipts across crashes and concurrent re-entry.
- `durable-sync-outbox`: Atomic local mutation plus sync intent, ordered durable
  outbox persistence, revision-safe flush cleanup, and restart recovery.
- `ai-endpoint-security`: Authenticated, bounded, quota-controlled server-side
  AI requests with provider-call suppression on rejected requests.
- `runtime-state-hardening`: Safe normalization of persisted settings and
  deterministic local-day rollover behavior under clock/timezone changes.

### Modified Capabilities

- `ai-ask`: The existing Ask/command backend contract now requires an
  authenticated user and server-side abuse control before either model call.

## Impact

The change affects `core/linked-actions`, `core/sync`, SQLite migrations and
data-layer transaction boundaries, the Todos/Habits/Calories/Workout modules,
Supabase migrations and Edge Functions, app metadata validation, native QA
workflow configuration, and their unit/integration/E2E tests. It adds no
client-side secrets, does not reset production Supabase history, and does not
change the offline-first source-of-truth model.
