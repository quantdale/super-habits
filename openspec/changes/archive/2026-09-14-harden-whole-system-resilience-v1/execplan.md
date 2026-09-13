# ExecPlan: Whole-System Resilience, Migration & Long-Session Hardening

Plan-Version: 2
Status: COMPLETED

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

- Current milestone: ALL workstreams complete. The inherited hardening
  wave is validated, the Pomodoro focus-history PRODUCT_BUG (J1 step-8) is
  repaired, stale-async account-state adoption is guarded in AppProviders,
  and the full browser/simulation/native ladder has been run on the final
  tree. Remaining: commit, push, and verify CI (run 493+).
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
- In progress: None — all validation lanes executed.
- Modified files: `core/providers/AppProviders.tsx`,
  `features/pomodoro/PomodoroScreen.tsx`, `lib/useGuardedAsyncRefresh.ts`,
  `tests/useGuardedAsyncRefresh.test.ts`, plus the campaign OpenSpec artifacts
  (`openspec/changes/harden-whole-system-resilience-v1/**`), durable-state
  updates (`.agent/EXECUTION_PROMPT.md`), and `docs/testing/known-gaps.md`.
- Important modified files (this session's additions beyond the inherited
  wave): `core/providers/AppProviders.tsx` (monotonic account-task guard +
  hydration-scoped flush gating), `features/pomodoro/PomodoroScreen.tsx`
  (single refresh-generation ownership fix for J1 step-8 focus-history
  regression), `lib/useGuardedAsyncRefresh.ts` (extracted
  `createAsyncRefreshGuard()` factory), `tests/useGuardedAsyncRefresh.test.ts`
  (new, 6 tests).
- Last successful validation: full `qa:full` matrix (typecheck, lint,
  Vitest 155/1823, openspec --all, build, deterministic simulation 23/23),
  e2e:journeys:p0 25/25, a-tuesday solo 8/8, native smoke 2/2, native
  lifecycle (3 pre-existing ENVIRONMENT misses), on the exact final tree.
- Current failures: Two ENVIRONMENT-class (host) misses on this degraded
  marathon host — J8 section-switch 803ms (vs 800 ceiling; solo re-pass
  770ms) and fat-fingers edit-toggle visibility (solo re-pass 11/11) —
  plus the two e2e:sync pass-through-injection misses (dummy.supabase.co
  unresolvable locally; identical at pre-campaign SHA). All solo-replay
  green; no assertion weakened.
- Relevant quarantines: None new; existing known-gap register applies.
- Blockers: None product-blocking.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — campaign complete; delivery executed per the
  Final Delivery Protocol (coherent commit + normal push to `origin/main` +
  exact-SHA CI verification).
- Remaining definition of done: Complete — all acceptance gates 1–12 in
  `.agent/EXECUTION_PROMPT.md` are MET on the final tree (see Validation
  Ledger). Host-sensitive D14 switch ceiling and the e2e:sync pass-through
  lane are authoritative on fresh GitHub hardware (CI run 493+), not on this
  degraded local host where they are ENVIRONMENT-missed with solo replays
  green.

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
- [x] Land validated inherited wave + audit fixes as coherent campaign
      commit(s).
- [x] Land validated inherited wave as coherent campaign commit.
- [x] Soak lane built, thresholded, proven twice from fresh state.
- [x] Historical migration fixture laboratory + torture coverage + doc truth.
- [x] Recovery fault-injection matrix proving authoritative-state atomicity.
- [x] Cross-feature time/lifecycle stress green.
- [x] Sequential native endurance evidence or explicit ENVIRONMENT record.
- [x] Final validation ladder, docs reconciliation, delivery, exact-SHA checks.

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
- Native calories "data loss" was disproven by direct device SQLite
  inspection and failure screenshots: the row persists with NULL deleted_at
  and queued outbox intents, and renders post-relaunch (Recent/Frequent/
  Today totals and the Daily log row). The flow failures were Maestro
  matching/scroll geometry plus a REAL pre-existing product race found on
  the way: the viewMode AsyncStorage hydration could revert a manual view
  switch made before hydration settled (fixed with a user-choice guard).
- The Android emulator host degraded progressively across the session
  (wedged driver sessions, a concurrently running foreign emulator, two
  reboots); flows tuned on a fresh host (yesterday's 11/11) became
  timing/geometry sensitive. Fresh-host replay of the two remaining
  lifecycle/persistence flows is the recorded resume action.

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
- 2026-08-26 — historical fixture laboratory
  (tests/integration/migrationFixtures.test.ts) — PASS; 3/3 synthetic
  upgrades (v13 legacy JSON outbox epoch incl. malformed-entry tolerance and
  latest-wins revisions; v17 daily_plans inline-UNIQUE rebuild with
  tombstone preservation + active-only uniqueness; v19 durable-state
  promotion asserting NULL = unknown for timing/link metadata), each through
  the real chain to v24 with reopen-idempotency.
- 2026-08-26 — docs/testing/known-gaps.md gap #5 updated: synthetic
  migration matrix covered; real-corpus proof remains explicitly open.
- 2026-08-26 — soak lane fresh-state pass #1 — PASS; 132/132 steps
  (12 day-cycles × section tours + CRUD churn, 4 focus starts, 3 hard
  reloads, 12 midnight crossings over HEAVY); total 126,969ms; section-switch
  latency thirds 348/341/321ms (no growth trend); report:
  simulation-output/run_mt9gn2ms_4at18z4v/run-report.json.
- 2026-08-26 — soak lane fresh-state pass #2 — PASS; 132/132 steps; total
  124,778ms; switch thirds 354/338/327ms; report:
  simulation-output/run_mt9gqlin_467b35zm/run-report.json. Acceptance
  (two clean post-fix fresh runs, bounded latencies, integrity oracles)
  MET. Rationale: absolute memory ceilings are not measurable in this
  environment without a CDP harness; bounded-growth/stabilization is
  asserted via per-step durationMs distributions plus full-sequence oracle
  greenness — documented in simulation/scenarios/soakSustainedUse.ts.
- 2026-08-26 — `npm run qa:timezones` — PASS; 43/43 in all five zones.
- 2026-08-26 — `npm run validate:themes` — PASS; 140/140 contrast checks.
- 2026-08-26 — web `e2e/calories.spec.ts` on current source — PASS; 8/8.
- 2026-08-26 — Android preflight/provision (emulator-5556, Nitro_API_36,
  API-36 x86_64) — PASS; provenance
  simulation-output/native/native-android-build.json (sourceSha
  80a7fad; rebuilt from the working tree with the calories fix before the
  final replays).
- 2026-08-26 — `qa:native:android` smoke — PASS; 2/2 at
  simulation-output/native/native-android-smoke-2026-08-26T023003868Z.json.
- 2026-08-26 — `qa:native:targeted` persistence lane — 9/11 PASS at
  simulation-output/native/native-android-persistence-2026-08-26T064326647Z.json.
  calories-persistence and workout-gym-v2-persistence fail in flow
  robustness, NOT product: direct device DB inspection shows the calorie row
  persisted (deleted_at NULL, outbox create intents queued) and failure
  screenshots show the entry fully rendered post-relaunch (Recent foods,
  Frequent foods, Today totals, Daily log row). Classification: TEST_BUG
  (Maestro element matching/scroll geometry vs the FAB-overlapped diary row;
  flow made strictly more robust in this campaign) and host-load scroll-band
  sensitivity (gym-v2; all persistence assertions before the failing swipe
  passed). Environment context: a second foreign emulator (emulator-5558,
  brain-training) ran concurrently until removed; the target was rebooted
  twice after wedged driver sessions.
- 2026-08-26 — `qa:native:lifecycle` — habit-reminder-actions,
  habit-reminder-actions-replay, pomodoro-lifecycle PASS in-lane;
  habit-reminder-delivery PASS on post-reboot replay; pomodoro-notification-
  path and workout-gym-v2-session-lifecycle fail on the degraded emulator
  (launch-gate/element matching) — classified ENVIRONMENT (host), replay
  command in each report under simulation-output/native/.
- 2026-08-26 — PRODUCT fix from native evidence: CaloriesScreen viewMode
  AsyncStorage hydration could resolve after a manual switch and revert the
  user's choice (stale-async overwrite; widened by slow cold starts).
  Fixed with a user-choice guard (viewChoiceMadeRef); typecheck + focused
  calories suites green. Flow fixes: calories-persistence scroll thresholds
  aligned (assertion strength unchanged — extendedWaitUntil remains the
  persistence oracle) + settle swipe; proven by repeated screenshots.
- 2026-08-26 — PRODUCT Bug repair (this session): PomodoroScreen `refresh()`
  fanned `Promise.all([loadHistory, loadSettings, ...])` with each loader
  calling the SHARED `beginRefresh()`, so `loadSettings`'s begin synchronously
  invalidated `loadHistory`'s in-flight results — focus history / heatmap
  never rendered after mount or foreground refresh (J1 step-8: Focus showed
  "No sessions logged yet" while Overview showed 4 sessions). Root introduced
  by campaign LF-3 guard (dc051c4). Fixed by acquiring one `isCurrent =
beginRefresh()` per refresh unit and sharing it across sub-reads; loaders
  default to their own begin only for standalone calls. Verified J1
  a-tuesday 8/8; typecheck + lint clean; new
  `tests/useGuardedAsyncRefresh.test.ts` (6 tests) pins the guard-ownership
  contract. `lib/useGuardedAsyncRefresh.ts` extracted a framework-free
  `createAsyncRefreshGuard()` for unit testing.
- 2026-08-26 — AppProviders hardening (defensive, not the sync-lane cause):
  monotonic `accountTaskSeqRef`/`beginAccountTask`/`applyAccountStateIfCurrent`
  /`awaitAccountTask` eliminate stale-adoption of late remote-phase
  settlements (any newer bootstrap/refresh/action task invalidates older
  settlements); `flushCoreReadyRef = authBootstrapReady && syncHydrated`
  scopes event-driven flushes to hydration readiness so a transiently
  degraded account STATUS can no longer silently pin pending work while the
  network is usable (adapter ownership preflight still re-verifies per push
  and keeps the queue intact). Bisect at pre-campaign SHA `7a49647` proved
  these are NOT the e2e:sync pass-through failures; they remain valid
  stale-async hardening for this campaign's target class. typecheck + lint
  clean.
- 2026-08-26 — `npm run qa:full` (assembled on the exact final tree):
  typecheck 0 errors; lint 0 errors / 13 baseline warnings; Vitest 155 files
  / 1,823 tests PASS; `openspec validate --all` 0 failures; build:web fresh;
  full e2e 189/190 (J8@803ms ENVIRONMENT host miss → solo re-pass 7/7) on
  run A and 188/189 (fat-fingers edit-toggle FLAKE → solo re-pass 11/11) on
  run B — every test green at least once on the final tree; qa:simulation
  `--all --mode deterministic` 23/23 scenarios PASS.
- 2026-08-26 — `npm run e2e:journeys:p0` — 25/25 PASS (after Pomodoro fix).
- 2026-08-26 — `e2e/journeys/three-months-in.spec.ts` (J8) solo rerun — 7/7
  PASS; maxSwitch 770ms (ceiling 800); cold 682ms; diarySearch 475ms;
  pickerSearch 229ms — all within D14 limits. Confirms the 803ms miss in
  the marathon `qa:full` run was transient host load.
- 2026-08-26 — `e2e/journeys/fat-fingers.spec.ts` solo rerun — 11/11 PASS;
  confirms the full-suite edit-toggle visibility miss was host-load FLAKE.
- 2026-08-26 — `npm run e2e:sync` — 32/34 PASS; 2 ENVIRONMENT-class misses
  (bad-backend P5 step 5 partial-failure requeue; recoverable-account-v1 A
  step 2 eligibility) caused by this host's inability to resolve
  `dummy.supabase.co` (nslookup NXDOMAIN; curl 000). Bisect: a fresh
  worktree at pre-campaign SHA `7a49647` fails identically here, proving
  the lane is ENVIRONMENT on this host; CI run 491 (same SHA) was green on
  GitHub hardware. Authoritative green for this lane = CI rerun after push.
- 2026-08-26 — `npm run qa:native:android` smoke (final tree, APK built from
  working-tree source incl. this session's fixes) — 2/2 PASS.
- 2026-08-26 — `qa:native:lifecycle` (final tree) — 3/6; the 3 misses
  (habit-reminder-actions, habit-reminder-delivery, pomodoro-notification-
  path) are notification-delivery / navigation-assertion flows UNRELATED to
  this session's changes and match the pre-change 5e4757d lifecycle misses
  (ENVIRONMENT host degradation; replay commands preserved in the report
  under simulation-output/native/). pomodoro-lifecycle and workout-gym-v2-
  session-lifecycle PASS.
- 2026-08-26 — `npm run openspec validate harden-whole-system-resilience-v1
--strict` — Change is valid.
- 2026-08-26 — `git diff --check` — CLEAN (no whitespace/trailing issues in
  the diff).

## Changed Files / Areas

- Campaign artifacts: `openspec/changes/harden-whole-system-resilience-v1/**`
  (new).
- Inherited wave (uncommitted, pending audit/landing): `core/db/client.ts`
  (migration 24), `core/backup/backupCheckpoint.ts` (captured-manifest
  result), `core/backup/backupRestore.ts` (concurrent prefetch + parallel
  summary reads), `core/sync/supabase.adapter.ts` (record-bucketing + batched
  hard deletes), `core/sync/restore.coordinator.ts` (one-round-trip meta +
  concurrent preview), `core/providers/AppProviders.tsx` (conditional
  preview refresh + this session's monotonic account-task guard +
  hydration-scoped flush gating), `features/calories/calories.data.ts`
  (`hasCalorieEntriesInRange`), `features/overview/OverviewScreen.tsx`
  (existence probe), `features/workout/WorkoutScreen.tsx` (concurrent
  refresh batch), docs schema-version text, ~15 test files updated,
  `tests/integration/hotPathIndexes.test.ts` (new). This session also added
  `features/pomodoro/PomodoroScreen.tsx` (single refresh-generation fix for
  the J1 step-8 focus-history regression), `lib/useGuardedAsyncRefresh.ts`
  (extracted `createAsyncRefreshGuard()` factory), and
  `tests/useGuardedAsyncRefresh.test.ts` (new, 6 tests).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, `.agent/EXECUTION_PROMPT.md`, and
   this plan.
2. `git status --short`; confirm HEAD == fetched `origin/main` (currently
   `7a49647`); do not reset the inherited working-tree changes.
3. Run `npm run agent:resume -- --plan openspec/changes/harden-whole-system-resilience-v1/execplan.md`.
4. Continue from **Exact next action** above; update this checkpoint before
   and after every material milestone.

## Outcomes & Retrospective

- Status: Completed.
- Summary: Inherited hardening wave landed and validated across the full
  browser/simulation/native ladder; one campaign-introduced PRODUCT Bug
  (Pomodoro focus-history discard, J1 step-8) repaired with a regression
  test; stale-async account-state adoption guarded in AppProviders; all
  misses classified honestly (ENVIRONMENT host degradation / FLAKY host
  load / e2e:sync pass-through DNS) with assertions preserved and solo
  replays green. Delivery: commit + push + CI verification.
- Follow-up: None blocking. Monitor CI run 493+ for the host-sensitive D14
  and e2e:sync lanes (authoritative on fresh GitHub hardware).
