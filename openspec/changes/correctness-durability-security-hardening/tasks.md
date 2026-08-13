## 1. Runtime and repository contract

- [x] 1.1 Align `package.json`, lockfile, `.nvmrc`, developer doctor, docs, and all GitHub jobs on the supported Node 22 runtime.
- [x] 1.2 Replace the GitHub `node_modules` cache with setup-node npm caching and unconditional `npm ci`.
- [x] 1.3 Create and validate the campaign ExecPlan and reconcile current Git topology before implementation.

## 2. Linked Actions and habit correctness

- [x] 2.1 Add recoverable planned/running/applied/skipped/failed execution states with stale-claim recovery and concurrent durable creation.
- [x] 2.2 Make non-idempotent habit effects finalize their receipt in the same SQLite transaction as the completion mutation.
- [x] 2.3 Preserve deterministic produced identities and idempotent replay behavior for todo, calorie, workout, and Pomodoro effects.
- [x] 2.4 Add real-SQLite crash, restart, failure-retry, repeated-source, stable-identity, chain-guard, and concurrent-claim tests.
- [x] 2.5 Capture manual and notification habit threshold transitions from the mutating SQL result and add genuine concurrent threshold tests.

## 3. Durable sync and feature mutation boundaries

- [x] 3.1 Add append-only SQLite migration 14 for a revision-aware durable sync outbox, including legacy app-meta import and migration tests.
- [x] 3.2 Serialize legacy persistence, protect revision ordering, preserve enqueue-during-flush behavior, and remove only exact successful revisions.
- [x] 3.3 Commit synced feature mutations, required linked/config cleanup, and remote delete/update intent atomically.
- [x] 3.4 Harden calorie ledger/cache semantics, stale-row results, workout active-parent validation, child cleanup, and historical-log preservation.
- [x] 3.5 Add fault-injection, restart, stale-ID, partial-success, outbox-ordering, and parent/child integration tests.

## 4. Supabase schema and AI security

- [x] 4.1 Add an additive repository-managed Supabase baseline migration for synced tables, columns, indexes, grants, and documented RLS expectations.
- [x] 4.2 Add the private per-user AI quota table and atomic security-definer quota RPC without exposing it to client roles.
- [x] 4.3 Add a deterministic repository-side Supabase contract validator and update the disposable backend fixture/docs to identify migration ownership and drift.
- [x] 4.4 Add shared Edge Function authentication, bounded-body, quota, timeout, and generic-error helpers; enforce them before provider calls in both AI functions.
- [x] 4.5 Add auth, quota, parallel quota, request-limit, provider-suppression, and secret-non-leak tests; run Deno/static checks.

## 5. Runtime/UI/native hardening

- [x] 5.1 Normalize persisted Pomodoro and calorie JSON settings with field-level safe defaults and malformed-state tests.
- [x] 5.2 Replace permanent one-second day polling with next-local-midnight scheduling plus foreground/visibility reconciliation and fake-clock tests.
- [x] 5.3 Resolve safe React effect and Fast Refresh warnings without weakening navigation retention or performance contracts.
- [x] 5.4 Inventory stable native reminder/Insights flows and add current semantic flows to the reusable EAS workflow; preserve honest local/cloud capability classifications.

## 6. Final verification and handoff

- [x] 6.1 Complete the static trust-boundary and dependency audit, classify advisories and external blockers, and update stale QA/known-gap docs.
- [x] 6.2 Run focused, integration, full Vitest, typecheck, lint, theme, OpenSpec, ExecPlan, impact, timezone, web build, E2E, simulation, sync/restore, and practical native gates.
- [ ] 6.3 Commit coherent changes, validate every commit, fetch/reconcile `origin/main`, push normal `main`, inspect GitHub CI, and fix repository-caused failures.
- [ ] 6.4 Record final finding evidence, residual risk, exact QA ledger, outcomes, and ExecPlan completion status.
