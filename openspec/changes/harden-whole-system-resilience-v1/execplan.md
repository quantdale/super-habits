# ExecPlan: Whole-System Resilience, Migration & Long-Session Hardening

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Prove the application survives sustained realistic use, repeated lifecycle
churn, historical SQLite upgrades, malformed/interrupted recovery operations,
and cross-feature time/lifecycle stress without silent data loss, duplicated
writes, resource runaway, or dishonest classification — and repair every
repository-caused Critical/High defect found.

## Context

- Active campaign prompt: `.agent/EXECUTION_PROMPT.md` (planned-from
  `d923cd0b4575bba3e5ead60bbf67430c5bc66e40`; planner commit pushed as
  `7a49647`).
- Predecessor: `openspec/changes/harden-momentum-garden-v1/` is COMPLETED and
  terminal; its evidence is baseline, not work to repeat.
- QA guidance: `docs/testing/autonomous-qa.md`, `docs/testing/native-e2e.md`,
  `simulation/README.md`, `qa/impact-map.json`.
- Targeted registered gaps: #4 load/stress, #5 migration-from-old-database,
  #6 pre-cutover date keys; iOS-on-Windows and live-Supabase remain external.
- SQLite is the source of truth; migrations are append-only; recovery
  boundaries must fail atomically; no second engines/caches/persistence silos.

## Scope

- Workstreams A–H of the execution prompt: system audit, soak lane,
  migration fixture laboratory, recovery fault injection, cross-feature
  time/lifecycle stress, sequential native endurance, QA infrastructure,
  documentation truth.
- Includes adopting and validating the inherited uncommitted read-path
  hardening wave (see D1 in design.md) rather than discarding it.

## Non-Goals

- New product features, event ledgers, speculative caches, durable preference
  silos, or reopening completed campaigns.
- Live Supabase mutation without an explicitly authorized disposable target.
- Weakening assertions, deleting failing tests, or arbitrary timeout growth.

## Current Checkpoint

- Current milestone: Audit-fix milestone complete — Groups DB/lifecycle/
  sync-recovery implemented, validated (typecheck, lint 0 errors, full
  Vitest 153 files / 1,814 tests), ready for commit; next is the soak lane
  (Workstream B).
- Completed:
  - Fetched `origin` and fast-forwarded local `main` from `d923cd0` to the
    planner commit `7a49647` (only `.agent/EXECUTION_PROMPT.md` changed;
    no overlap with dirty files). Local HEAD == `origin/main` == `7a49647`.
  - `npm run agent:plans`: all discovered plans COMPLETED; none supersedes
    this campaign.
  - Read AGENTS.md, `.agent/PLANS.md`, `.agent/PLANNER_HANDOFF.md`,
    execution prompt, `docs/testing/autonomous-qa.md`,
    `docs/testing/known-gaps.md`, native E2E guidance, impact map, and the
    predecessor OpenSpec artifacts.
  - Inventoried the inherited uncommitted change set: 35 modified files +
    untracked `tests/integration/hotPathIndexes.test.ts`. Theme: append-only
    migration 24 hot-path range indexes (`pomodoro_sessions.started_at`,
    `workout_logs.completed_at`, `habit_completions.date_key`, partial
    `idx_todos_pending_sort` with defensive column adds), concurrent
    Overview/Workout/calorie/backup reads, existence probe
    (`hasCalorieEntriesInRange`), single-round-trip restore entity meta,
    concurrent preview fetches, batched hard-delete push, captured-manifest
    gate skipping redundant restore-preview refreshes. Docs updated to
    schema v24.
  - Validated the inherited tree: `tsc --noEmit` clean; full Vitest
    **151 files / 1,798 tests passed** including the new hot-path index tests
    and the updated checkpoint test.
  - Created this OpenSpec change (proposal/design/tasks/spec) and this plan.
- In progress: Committing the audit-fix milestone; then Workstream B soak
  lane.
- Important modified files: see `git status --short`; core areas are
  `core/db/client.ts`, `core/backup/**`, `core/sync/**`,
  `core/providers/AppProviders.tsx`, `features/{calories,overview,workout}/`,
  their tests/docs, plus new campaign files under this OpenSpec directory.
- Last successful validation: typecheck + full Vitest on the current tree
  (this session).
- Current failures: None.
- Relevant quarantines: None new; existing known-gap register applies.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Commit the audit-fix milestone with a detailed body;
  then build the Workstream B long-session soak lane.
- Remaining definition of done: All acceptance gates 1–12 in
  `.agent/EXECUTION_PROMPT.md`.

## Progress

- [x] Reconcile Git with `origin/main` (fast-forward only; no discarded work).
- [x] Confirm no superseding ACTIVE plan.
- [x] Complete mandatory startup reads.
- [x] Inventory + first-level validation of the inherited working-tree wave.
- [x] Create OpenSpec change + Version-2 ExecPlan.
- [x] Resolve impact-selected gate set (`qa:affected --base d923cd0`).
- [x] Whole-codebase system audit with severity-classified ledger.
- [x] Audit fixes: DB group (DB-1..DB-6), lifecycle group (LF-1/LF-2/LF-5/
      LF-8/LF-9 + LF-3 guards), recovery group (RC-1..RC-6), V2 fault-injection
      matrix seed.
- [ ] Land validated inherited wave + audit fixes as coherent campaign
      commit(s).
- [ ] Land validated inherited wave as coherent campaign commit.
- [ ] Soak lane built, thresholded, proven twice from fresh state.
- [ ] Historical migration fixture laboratory + torture coverage + doc truth.
- [ ] Recovery fault-injection matrix proving authoritative-state atomicity.
- [ ] Cross-feature time/lifecycle stress green.
- [ ] Sequential native endurance evidence or explicit ENVIRONMENT record.
- [ ] Final validation ladder, docs reconciliation, delivery, exact-SHA checks.

## Audit Ledger

(Workstream A findings — severity, root cause, resolution. Append-only.)

### core/db (subagent audit, verified)

- DB-1 [Low] Opened handle never closed when bootstrap/migration fails
  (`core/db/client.ts:934-951`) — retry opens a second connection. FIX:
  closeAsync on failure + extend existing failure test.
- DB-2 [Low] Unparsable `db_schema_version` parses to NaN and silently skips
  ALL migrations (`client.ts:136-137`). FIX: treat non-finite as 0.
- DB-3 [Low] Migration 24 defensive repair restores column existence but not
  migration-6 `sort_order` backfill for the skipped-block-6 cohort
  (`client.ts:916-918`). FIX: conditionally rerun backfill when the column
  was just added.
- DB-4 [Medium] No regression test exercises the migration-24 defensive
  repair path. FIX: legacy-fixture integration test (also seeds Workstream C).
- DB-5 [Low] Stale "23" version claims: `core/db/schema.sql:6`,
  `core/db/migrations/README.md:8`, stale test title
  `tests/db.client.test.ts:155`. FIX: doc/text updates.
- DB-6 [Low] Dead type field `WorkoutLog.session_kind` has no DDL column
  (`core/db/types.ts:150`). FIX: remove the phantom field.
- Clean: monotonic/idempotent/transactional migrations (rollback proven),
  fresh-install shape, singleton/WAL, migration-24 index/query alignment,
  soft-delete filters, date-key handling.

### backup/sync/portable/account (subagent audit, verified)

- RC-1 [Medium] Independent hardcoded inventories (`ACCOUNT_USER_TABLES`,
  `TABLES_WITH_DELETED_AT`, duplicated import sequences) can silently diverge
  from `BACKUP_ENTITIES`; `importedCounts` computed from payload not DB could
  mask a missed importer. FIX: coherence unit test partitioning/inclusion
  assertions + derive counts from post-import DB state.
- RC-2 [Low] Sync engine can leave duplicate `(entity,id)` entries in the
  in-memory queue when the persistence tail fails mid-flush
  (`sync.engine.ts:236-243`). FIX: dedupe by dedupeKey on snapshot restore.
- RC-3 [Low] Settings push falls back to an uncertified live read when the
  certified snapshot is missing (`supabase.adapter.ts:230-233`); next restore
  then fails integrity_mismatch. FIX: mirror manifest behavior — drop/log.
- RC-4 [Low] `resolveBackupScope` mislabels explicitly-stamped low scope
  numbers (`backup.types.ts:844-848`). FIX: prefer explicit stamp labeling.
- RC-5 [INFO] `parseManifestRow` casts unknown entity keys
  (`backupRestore.ts:139-151`). FIX: filter against BACKUP_ENTITIES.
- RC-6 [Low] Post-flush maintenance discards `capturedManifest`
  (`AppProviders.tsx:251-252`). FIX: conditional preview refresh like the
  bootstrap path.
- Fault-injection gaps (validating code exists, no end-to-end test):
  manifest_malformed; future/older backup_schema_version through V2;
  unrecognized scope through V2; auth_changed pre/post transaction;
  V2 owner_mismatch; V2 remote_disabled; duplicate IDs via cloud pipeline;
  scope 5/6 column-freeze regressions through restore.
- Clean: V2/portable atomicity (validation-before-write, single transaction,
  in-transaction emptiness/owner rechecks, tested rollback), outbox loss/dup
  safety, triple-gated owner pushes, tombstone-counting emptiness gate,
  strictly read-only portable export.

### providers/lifecycle (subagent audit, verified)

- LF-1 [High] Bootstrap gate hangs indefinitely when account-coordinator
  network calls never settle (no fetch timeout; `AppProviders.tsx:87-101`,
  `accountCoordinator.ts:235-259`) — contradicts offline-first local-use
  guarantee. FIX: race remote phase against timeout → degrade to error status
  with local-first continuation; Vitest regression with never-resolving stub.
- LF-2 [Medium] DB-init failure is a dead-end screen with no retry
  (`AppProviders.tsx:73-84`, gate :371-406). FIX: Retry control re-running
  bootstrap effect.
- LF-3 [Medium] Stale async refreshes can overwrite newer day-keyed state at
  rollover on Habits/Todos/Workout/Calories/Pomodoro/Planning views (only
  Overview/MomentumDetail/Command are guarded). FIX: shared guarded-refresh
  hook applied to section refresh paths + overlap regression test.
- LF-4 [Medium] Hand-maintained `sw.js` CACHE_VERSION risks stranding PWA
  users on a stale shell when bundles change without a bump (`public/sw.js`).
  FIX (chosen): post-export build check that dist/index.html's hashed assets
  are covered by the served SW precache/version, failing the build otherwise.
- LF-5 [Low] Flush effect can run before hydrate completes
  (`AppProviders.tsx:99-107`). FIX: hydrate gate flag.
- LF-6 [Low] Web foreground double-fires refreshes via AppState +
  visibilitychange (`useForegroundRefresh.ts`). FIX: single channel on web.
- LF-7 [INFO] registerServiceWorker module listeners are lifetime singletons
  — documented semantics, no action.
- LF-8 [Low] Account-status transitions rebuild flush subscriptions and
  bypass backoff once per transition (`AppProviders.tsx:236-286`). FIX:
  stable subscriptions reading gating flags from refs.
- LF-9 [INFO] Planning-hub Today views ignore day rollover while open across
  midnight (`PlanningHubScreen.tsx:80-85`). FIX: key by dayGeneration.
- Clean: timer/listener hygiene across all enumerated surfaces, DayRollover
  provider, sync-engine flush reentrancy/durability, notification response
  replay safety, section-mount memory behavior, SW harness isolation.

## Surprises & Discoveries

- The working tree contained a coherent, fully-typed, fully-tested but never
  committed read-path hardening wave on top of the completed Momentum
  campaign. Its content matches this campaign's index/query-shape and
  long-session goals; per the "never discard unrelated work" rule it is being
  audited and adopted rather than reset. Provenance is unknown (no matching
  ExecPlan); treated as orphaned prior-session work.
- The full Vitest suite passes on that tree unchanged (1,798/1,798),
  including two new hot-path index integration tests — strong evidence the
  wave was finished but interrupted before commit/validation.

## Decision Log

- 2026-08-26 — Adopt the inherited wave after validation instead of
  reverting: it serves campaign goals directly, discarding would violate the
  no-reset rule, and re-deriving it would duplicate finished work.
- 2026-08-26 — Validate before landing: the wave rides migration code and
  sync/restore boundaries, so the broader ladder runs before its commit.
- 2026-08-26 — Use slug `harden-whole-system-resilience-v1` exactly as the
  planner suggested; no conflict exists.
- 2026-08-26 — resolveBackupScope rejects explicit scope stamps < 2 but must
  exempt the -1 "no stamp" sentinel: historical manifests that predate scope
  versioning rely on entity-set matching (caught by the scope-3 integration
  test).
- 2026-08-26 — Cloud-pipeline duplicate IDs are caught by per-entity checksum
  integrity before row validation; the duplicate-id validator rule stays
  unit-covered at the portable/validator layer where checksums were
  recomputed over duplicates. Test asserts the honest integrity_mismatch.
- 2026-08-26 — LF-3 stale-refresh guards reuse OverviewScreen's proven
  request-id/mounted pattern via shared lib/useGuardedAsyncRefresh; no hook
  render-test harness is installed, so coverage rides the screens' E2E
  journeys rather than a synthetic renderHook test.

## Resolved Gate Set (qa:affected --base d923cd0)

Matched rules: calories, workout-gym-v2, sync-and-restore,
database-and-migrations, native-ui-and-persistence,
native-pomodoro-notifications, agent-workflow-and-documentation.
Required gates: qa:fast, qa:integration, e2e:journeys:p0, qa:timezones,
qa:journeys, qa:simulation, qa:native:smoke/targeted/lifecycle/android/ios,
e2e:sync, e2e:journeys; broad regression required.

## Validation Ledger

- 2026-08-26 — `git fetch origin --prune` + `git merge --ff-only origin/main`
  — PASS; `d923cd0..7a49647`, only `.agent/EXECUTION_PROMPT.md` advanced.
- 2026-08-26 — `npm run agent:plans` — PASS; zero ACTIVE plans besides this
  new campaign.
- 2026-08-26 — `npm run typecheck` — PASS on the inherited tree.
- 2026-08-26 — `npm test` — PASS; 151 files / 1,798 tests (unit +
  integration projects).
- 2026-08-26 — `npm run qa:affected -- --base d923cd0` — PASS; broad gate
  set resolved (see Resolved Gate Set section); campaign artifacts matched
  agent-workflow-and-documentation.
- 2026-08-26 — focused Vitest after Group 1 (db.client, migrations,
  hotPathIndexes) — PASS; 33 tests incl. new close-on-failure, garbage-
  version, and m24 defensive-repair fixture cases; rollback test rewritten
  for file-backed inspection after the handle-close fix.
- 2026-08-26 — `npm run lint` after Groups 1–3 — PASS; 0 errors (13
  pre-existing warnings).
- 2026-08-26 — fault-injection matrix (backupRestore.test.ts) — PASS;
  25/25 including six new V2 hostile-input cases (manifest_malformed,
  unsupported future schema version, unrecognized scope fail-closed,
  duplicate-id/integrity refusal, owner_mismatch binding preservation,
  remote_disabled).
- 2026-08-26 — inventory coherence (tests/backupInventoryCoherence.test.ts)
  — PASS after it caught real drift: workout_logs, workout_session_exercises,
  workout_session_sets, pomodoro_sessions had no registered delete semantic;
  BACKUP_NEVER_DELETED_ENTITIES added and adapter now rejects illegal delete
  intents loudly.
- 2026-08-26 — full `npm run typecheck` + `npm test` on the combined tree —
  PASS; 153 files / 1,814 tests.

## Changed Files / Areas

- Campaign artifacts: `openspec/changes/harden-whole-system-resilience-v1/**`
  (new).
- Inherited wave (uncommitted, pending audit/landing): `core/db/client.ts`
  (migration 24), `core/backup/backupCheckpoint.ts` (captured-manifest
  result), `core/backup/backupRestore.ts` (concurrent prefetch + parallel
  summary reads), `core/sync/supabase.adapter.ts` (record-bucketing + batched
  hard deletes), `core/sync/restore.coordinator.ts` (one-round-trip meta +
  concurrent preview), `core/providers/AppProviders.tsx` (conditional
  preview refresh), `features/calories/calories.data.ts`
  (`hasCalorieEntriesInRange`), `features/overview/OverviewScreen.tsx`
  (existence probe), `features/workout/WorkoutScreen.tsx` (concurrent
  refresh batch), docs schema-version text, ~15 test files updated,
  `tests/integration/hotPathIndexes.test.ts` (new).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, `.agent/EXECUTION_PROMPT.md`, and
   this plan.
2. `git status --short`; confirm HEAD == fetched `origin/main` (currently
   `7a49647`); do not reset the inherited working-tree changes.
3. Run `npm run agent:resume -- --plan openspec/changes/harden-whole-system-resilience-v1/execplan.md`.
4. Continue from **Exact next action** above; update this checkpoint before
   and after every material milestone.

## Outcomes & Retrospective

- Status: Active.
- Summary: Campaign scaffolded on reconciled `main`; inherited hardening wave
  discovered, inventoried, and validated at gate level one.
- Follow-up: Execute workstreams A→H per the execution prompt until all
  acceptance gates hold.
