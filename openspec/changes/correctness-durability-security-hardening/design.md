## Context

The local app uses one SQLite connection and append-only migrations. Synced
entities are backed up by a queue, while linked actions persist events and
execution records separately from feature mutations. The first implementation
wave in this change adds a migration-14 SQLite outbox and transaction helpers;
the remaining design must keep those boundaries compatible with web SQLite,
native Expo SQLite, the existing restore scope, and the Supabase disposable
backend lane.

The two AI Edge Functions are plain Deno entrypoints with runtime-neutral
normalization helpers. Clients already send a Supabase session access token
when one exists, but the functions currently do not make authentication or
quota decisions visible in their own code. Existing remote schema history is
partly dashboard-created, so new repository migrations must be additive and
must not rewrite or reset production history.

## Goals / Non-Goals

**Goals:**

- Make local mutation, durable outbox intent, linked-action receipts, and
  restart/replay behavior explicit and testable.
- Keep latest-operation dedupe and partial sync retry semantics.
- Make the committed Supabase migration series and expected RLS/index contract
  inspectable without requiring a live project.
- Authenticate AI callers with Supabase Auth, atomically consume a per-user
  request-class quota, and reject before provider calls.
- Keep request bodies and upstream calls bounded, with generic external errors.
- Preserve current feature semantics, native flows, Windows tooling, and the
  anonymous/offline-first client model where a valid Supabase session exists.

**Non-Goals:**

- No user-id retrofit of the existing single-user backup tables in this
  campaign; changing ownership semantics would require a separate migration
  and restore design.
- No destructive `supabase db reset`, production drop, remote migration push,
  or dashboard reconciliation without credentials and explicit deployment
  authority.
- No redesign of linked-action effect types, full two-way sync, or native test
  infrastructure beyond stable current flows.

## Decisions

### Use a SQLite outbox table as the durable sync authority

The outbox is a first-class table with one row per entity/id, a monotonically
allocated revision, updated timestamp, and latest operation. Feature data
layers call one transaction helper that mutates the authoritative row and
conditionally upserts the outbox row; the in-memory `SyncEngine` is updated only
after commit. Row-level upsert and exact revision removal replace fire-and-
forget app metadata snapshots for the runtime path. The legacy snapshot methods
remain only as a compatibility surface for small test persistence doubles.

Alternative considered: serialize JSON snapshot writes with a promise chain.
That fixes save reordering but cannot make a tombstone and remote-delete intent
one transaction, so it was rejected as the long-term boundary.

### Use recoverable claims plus effect-specific receipts

Linked-action executions use planned, running, applied/skipped, and failed
states. A running claim has a lease; stale claims can be reclaimed, while a
fresh claim suppresses concurrent re-entry. Habit increment and ensure effects
receive the execution id and finalize the execution inside the same SQLite
transaction as the completion mutation. Todo completion and log effects use
existing idempotency/deterministic produced IDs and persisted-row checks.

Alternative considered: rerun every planned/running execution. That duplicates
numeric increments across a crash after mutation and before finalization, so it
was rejected.

### Capture threshold transitions with SQLite RETURNING

Manual habit increments use one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
statement and derive the previous count from that statement's post-mutation
count. Notification completion uses the same returned row inside its durable
action transaction. This avoids a separate read observing another writer's
count without introducing a process-global lock.

### Treat the calorie ledger as authoritative and saved meals as a cache

The calorie entry plus its sync intent commits first. Saved-meal maintenance is
best effort and logs a diagnostic failure; it cannot make a successful ledger
write look failed to the caller. Stale update/delete operations return an
explicit no-op result and do not touch the cache or outbox.

### Use additive Supabase migrations plus a static contract validator

The existing historical `profiles` and Habit V2 migration files remain
unchanged. A new idempotent baseline migration describes the four synced
tables, required columns, indexes, grants, and current permissive single-user
RLS expectations. A later migration adds a private AI quota table and a
security-definer atomic quota function. A Node validator checks the migration
series and contract documentation for required objects; live `supabase db
push`, remote policy inspection, and disposable backend execution remain
separate evidence lanes.

Alternative considered: promote the disposable backend's hand-maintained SQL
as the only authority. It would still leave `supabase db push` unable to
reproduce the project, so the migration series is the authority and the
disposable SQL is updated as a checked compatibility fixture.

### Authenticate with Supabase Auth REST and quota through a service-role RPC

The Edge Functions extract a bearer token and call the supported Supabase Auth
`/auth/v1/user` endpoint with the public anon key to verify the caller. They
then call the private `consume_ai_request_quota` RPC with the server-only
service-role key. The SQL function serializes the per-user/request-class row
and returns allow/deny plus retry information. Missing auth is 401, unavailable
security infrastructure is a fail-closed 503, and exhausted quota is 429;
none of these paths invoke a model provider.

Alternative considered: an in-memory map or IP-only limiter. Both fail across
Edge workers and are trivially bypassed by authenticated users changing IPs,
so they were rejected.

### Keep function-level auth visible even when gateway JWT verification is on

`supabase/config.toml` explicitly enables JWT verification for both functions,
while the function code repeats user verification and quota ordering. Gateway
verification protects deployment routing; function-level verification is the
unit-testable invariant and protects alternate invocation paths.

### Schedule rollover at the next local midnight

The provider computes the next local midnight with Date's local calendar
operations, schedules one bounded timeout, rechecks on foreground/visibility,
and clears the timeout on cleanup. It compares the actual date on every wake so
clock or timezone changes recover without a permanent one-second interval.

## Risks / Trade-offs

- [Risk] A legacy database may have an app-meta JSON outbox but no migration-14
  table. → Migration 14 imports valid legacy records before clearing the old
  key; migration integration tests cover fresh and upgrade paths.
- [Risk] Native and web Expo SQLite expose different transaction APIs. → The
  helper prefers native exclusive transactions, uses the web/portable
  transaction, and retains a narrow unit-double fallback; real integration
  tests exercise the SQLite path.
- [Risk] A stale linked-action lease can delay recovery for the lease duration.
  → The lease is bounded, stale replay is deterministic, and tests set an old
  timestamp rather than sleeping.
- [Risk] The current remote project may differ from the additive migration
  contract. → No production write is attempted without credentials; static
  validation passes locally and remaining live verification is classified
  `CREDENTIAL_REQUIRED` or `ENVIRONMENT`.
- [Risk] Fail-closed AI quota depends on a configured service-role secret and
  RPC. → Missing configuration returns a generic 503 before provider work;
  deployment checks and helper fault tests make the requirement visible.
- [Risk] Boundary timers can be delayed by a suspended browser. → Visibility
  and foreground handlers always reconcile the current local date.

## Migration Plan

1. Land local SQLite migration 14 and the feature transaction/outbox changes;
   fresh and upgrade integration tests must pass before release.
2. Apply the additive Supabase migrations only through the normal reviewed
   deployment path after inspecting the target project. Do not reset or rewrite
   historical migrations.
3. Configure Edge Function secrets (`SUPABASE_SERVICE_ROLE_KEY` and provider
   keys) server-side. Keep public Expo variables limited to URL/anon key.
4. Validate the static contract, Deno checks, AI fault tests, and disposable
   lane when credentials/isolated infrastructure are available.
5. Rollback of application code is safe before enabling the new functions. If
   the quota migration has been applied, leave the additive table/function in
   place; functions fail closed until correctly configured, and no data table
   is dropped.

## Open Questions

None that change the specified behavior or implementation approach. Live
remote policy/table comparison and cloud native execution are evidence steps
classified separately when credentials or infrastructure are unavailable.
