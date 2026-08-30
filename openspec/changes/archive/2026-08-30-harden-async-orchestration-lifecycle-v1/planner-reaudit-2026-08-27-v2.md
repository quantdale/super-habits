# Planner Re-Audit V2 — Exact-HEAD Repository Audit

Date: 2026-08-27
Planner baseline commit: `93c651b5b8510243440823d8ea3456c0eae28454`
Default branch: `main`
Repository: `quantdale/super-habits`
Disposition: **CURRENT ACTIVE CAMPAIGN MUST CONTINUE**

## Executive finding

The exact planner baseline is green in GitHub Actions, including quality, full E2E,
full deterministic simulation, `dist-sync`, and `journeys-sync`. That green result
does **not** close `harden-async-orchestration-lifecycle-v1`.

The post-campaign repair commit `2f81e1ce8a` fixed the P5 partial-outbox and
recoverable-account CI failures, but it also rolled back several protections that
the async/lifecycle campaign had just introduced in `AppProviders`. The latest
tree therefore contains a dangerous class of "green helper, dead production
wiring" regressions: tests for `withRemoteTimeout()` and
`createPreviewAdoptionGuard()` pass, while production no longer calls those
helpers.

This is the next campaign. Do not start an unrelated feature campaign before
these invariants are repaired and proven on the exact pushed SHA.

## Repository coverage ledger

The recursive GitHub tree at the planner baseline returned `truncated: false`:

- 1,559 total tree entries.
- 1,236 tracked blobs/files.
- 323 directories.
- 741 code/config/script/SQL/JSON/YAML-class files.
- 405 Markdown/text documentation-class files.
- 650 paths classified as tests/E2E/simulation/native/QA by path.
- 276 paths below `openspec/`.
- 23 migration-class paths.
- 2 GitHub workflow files.

Top-level tracked-file counts:

| Area                                                 | Files |
| ---------------------------------------------------- | ----: |
| openspec                                             |   276 |
| features                                             |   193 |
| tests                                                |   165 |
| core                                                 |   138 |
| .agent                                               |    94 |
| e2e                                                  |    59 |
| simulation                                           |    51 |
| .cursor                                              |    30 |
| docs                                                 |    28 |
| .maestro                                             |    27 |
| root files                                           |    25 |
| supabase                                             |    24 |
| .github                                              |    16 |
| scripts                                              |    16 |
| lib                                                  |    14 |
| remaining agent/editor/app/assets/public/patch areas |    80 |

Every tracked path is accounted for by the tree inventory. Semantic review was
concentrated on executable/runtime/configuration/test contracts; lockfiles,
binary assets, logs, patches, and generated/evidence artifacts were reviewed
structurally for role, provenance, unexpected placement, and repository truth
rather than pretending binary bytes have application semantics.

High-risk systems explicitly traced in this re-audit include:

- app bootstrap and provider lifecycle;
- SQLite initialization/migrations/transactions;
- durable sync outbox revisions, persistence, partial failure, backoff and flush fan-in;
- account bootstrap/protection/recovery/owner binding;
- backup completeness, restore preview/import and portable restore;
- AsyncStorage/user-intent precedence helpers and call sites;
- timers, AppState, NetInfo, visibility and service-worker ownership;
- feature data layers for todos/habits/calories/workout/projects/goals/daily plan/weekly review;
- Playwright feature/journey/dist-sync infrastructure;
- deterministic simulation and disposable-backend infrastructure;
- Android/iOS Maestro/EAS workflow coverage;
- Supabase schema/migrations/RLS static validator and edge-function deployment;
- CI gates and exact-SHA Actions state;
- active OpenSpec/ExecPlan lifecycle and stale-plan sprawl.

A fresh local `git ls-files` ledger remains mandatory for the executor because
the tree will change as this campaign is implemented.

## Exact-head CI truth

GitHub Actions run `33048704704` for
`93c651b5b8510243440823d8ea3456c0eae28454` is green.

Green lanes include:

- typecheck;
- Deno check for both Supabase functions;
- lint with `--max-warnings 0`;
- theme contracts;
- strict OpenSpec contracts;
- versioned ExecPlan validation;
- unit + real-SQLite integration tests;
- web build;
- full E2E;
- full deterministic scenario library;
- `dist-sync` build;
- remote-boundary `journeys-sync`.

This is valuable evidence, but the findings below demonstrate that the current
test matrix does not fully encode the intended lifecycle invariants.

## Findings

### SH-AUD-001 — HIGH — remote bootstrap can wedge an offline-first app

Current `core/providers/AppProviders.tsx` awaits
`accountCoordinator.bootstrap()` directly before setting
`authBootstrapReady=true`. With Supabase configured, that path can wait on
remote auth evidence. The previously introduced `withRemoteTimeout()` helper
exists and has tests, but production no longer imports or calls it.

The helper's own contract says a hung remote phase must never wedge startup.
The current production wiring violates that contract and the product's
offline-first/local-use promise.

Required proof:

1. configured remote + permanently pending auth request;
2. local database initializes;
3. durable sync state hydrates safely;
4. local UI becomes usable within a bounded deterministic deadline;
5. a late remote settlement cannot overwrite newer account state.

### SH-AUD-002 — CRITICAL/HIGH — durable outbox revision allocation can race hydration

`SyncEngine.hydrate()` explicitly says it must run once during bootstrap before
the first flush. It also restores the persisted maximum revision into
`nextRevision`. `runBackupMutation()` and settings backup code allocate durable
revisions through `syncEngine.prepare()`.

Current `AppProviders` sets `authBootstrapReady` and can render the application
**before** awaiting `syncEngine.hydrate()`. A fast user mutation can therefore
call `prepare()` while `nextRevision` is still at its process default. If the
persistent outbox already contains a higher revision, the new local row can
commit while `upsertSyncOutboxRecord()` rejects the lower revision via its
`excluded.revision > sync_outbox.revision` guard. Hydration may then re-adopt
the older durable intent.

This can become a local-success / remote-backup-omission failure.

Required deterministic regression:

- preseed durable outbox revision N (large enough to distinguish process default);
- delay hydration at a controlled barrier;
- attempt the earliest user-visible write the architecture permits;
- prove either writes are gated until hydration or the newly allocated revision
  is strictly greater than N;
- kill/reopen/hydrate and prove the newest intent is the one that survives and
  is pushed.

No sleep-based race test is acceptable.

### SH-AUD-003 — HIGH — monotonic account-state adoption was removed

The earlier campaign added account-task sequencing so an older bootstrap or
refresh settlement could not overwrite a newer protection/recovery result.
Commit `2f81e1ce8a` removed that sequencing. Current `refreshAccountState()`
simply awaits and calls `setAccountState()`.

Restore a single monotonic account-adoption authority and deterministically
cover overlapping bootstrap, auth callback refresh, protect/recover/verify, and
late timeout settlement.

### SH-AUD-004 — HIGH — restore-preview adoption guard is dead production code

`core/providers/previewAdoption.ts` and its tests still exist. Current
`AppProviders` no longer uses the guard. Bootstrap preview, maintenance preview,
restore completion and other preview producers can therefore settle out of
order.

Rewire one monotonic preview-adoption authority across all producers. Do not
duplicate a second guard framework.

### SH-AUD-005 — HIGH/MEDIUM — lifecycle flush ownership is again tied to account-state effect churn

The current flush effect depends on `accountState.status` and
`authBootstrapReady`. Account state transitions tear down and re-register the
interval, visibility listener and NetInfo subscription.

The preceding implementation intentionally moved readiness into stable refs to
avoid exactly this re-subscription behavior. The current bad-backend E2E test
now explicitly allows one **or two** failure-count increments after a reconnect,
acknowledging duplicate trigger behavior instead of proving one logical attempt.

Required invariant:

- interval/listener/subscription owners are stable across account-state changes;
- concurrent signals coalesce;
- one logical test trigger produces one accountable attempt;
- mount → unmount → remount leaves exactly one intended owner;
- account transition does not generate hidden extra flush attempts.

### SH-AUD-006 — HIGH QA GAP — the timeout journey no longer tests a timeout

`injectRestTimeout(page, 2500)` is documented as a stalled request but now
returns an immediate 503. That is backend-failure coverage, not stalled-request
coverage.

The same file added `page.waitForTimeout(500)` before partial failure and widened
backoff assertions to tolerate duplicate increments. These changes made CI
greener by weakening timing/orchestration oracles.

Repair the harness:

- provide an actual controlled pending request / timeout path;
- drain or cancel held requests before changing failure modes;
- replace arbitrary route-install sleeps with explicit readiness/barrier state;
- restore exact failure-accounting assertions after fixing fan-in;
- keep page/context Worker interception deterministic without double ownership.

### SH-AUD-007 — MEDIUM — bootstrap recovery UI regressed

The previous bootstrap retry state/button was removed. A database bootstrap
error now leaves an "Unable to start" screen with no in-app retry path.

Restore a deterministic retry path unless the product contract explicitly
chooses a fatal restart-only state. Test failure → retry → successful local
bootstrap without page/process restart.

### SH-AUD-008 — MEDIUM — active OpenSpec truth is stale after green CI

`harden-async-orchestration-lifecycle-v1/execplan.md` is still ACTIVE and its
older addendum describes failed CI run #495. `tasks.md` remains broadly
unchecked even where implementation/evidence exists. The current exact-head run
is green, yet the production rollback findings above keep the campaign open.

Reconcile tasks only from evidence. Never mark the change COMPLETED merely
because the current CI is green.

### SH-AUD-009 — MEDIUM — disposable backend has authored scenarios but no live runner

`simulation/backend/roundTripScenarios.ts` contains real-backend scenarios and
remote-verification notes. Nightly currently provisions a disposable Supabase
project and builds `dist-live/`, but the workflow comment explicitly says
round-trip execution is pending.

Once this async/lifecycle campaign is genuinely closed, the next OpenSpec should
turn those notes into executable remote oracles and run them against a guarded
throwaway backend.

### SH-AUD-010 — MEDIUM — remote test/toolchain reproducibility is weaker than the main app toolchain

Examples:

- disposable provisioning invokes `npx tsx` without a repo-pinned `tsx` dependency;
- Supabase function deployment uses `supabase/setup-cli@v1` with
  `version: latest`;
- deploy workflow text still suggests committing
  `supabase/.temp/linked-project.json` even though the same file explains the
  directory is gitignored.

Pin or otherwise make CI/deployment tool versions reproducible in the successor
production-certification campaign.

### SH-AUD-011 — MEDIUM — native confidence is opt-in, not implied by green web CI

The EAS workflow has meaningful Android/iOS Maestro coverage, but it runs only
by manual dispatch or the `native-e2e` PR label. A green ordinary GitHub Actions
run must not be described as native-qualified.

For native-sensitive changes in this campaign, run the native lanes where a
verified target/credential path exists; otherwise classify ENVIRONMENT, never
PASS.

### SH-AUD-012 — MEDIUM/LOW — residual production-certification gaps remain honest and open

The known-gap register correctly still identifies:

- no anonymized captured real historical SQLite corpus;
- no real pre-cutover corpus proof for UTC/local date-key history;
- no Chrome heap/memory-leak profiling;
- no native-device sustained-load profiling;
- no authenticated read-only comparison of intended live Supabase schema/RLS
  against repository migrations.

Do not fake these closed. The disposable-backend successor can close the
repo-controlled portions; real-corpus/live-production checks require the
appropriate external inputs/authorization.

### SH-AUD-013 — LOW/MEDIUM — planning/archive sprawl obscures repository truth

The tree contains many non-archived OpenSpec change directories whose ExecPlans
already contain `Status: COMPLETED`, while only a small number of changes are
under `openspec/changes/archive/`. This makes "active change" discovery noisy.

After the current campaign is completed, run an OpenSpec lifecycle reconciliation
that archives only changes proven complete and preserves historical evidence.

### SH-AUD-014 — LOW — stale dead compatibility source/documentation exists

`core/db/localMutation.ts` still describes projects/goals/daily plans as
local-only and claims no Supabase table exists, while current data layers use
`runBackupMutation()` and production migrations contain those remote tables.
The helper appears to have no production callers in current code search.

Either delete it with proof or update/repurpose it; do not leave obsolete
architecture guidance in runtime source.

## Security sweep

Repository code search at this baseline did not surface obvious committed
service-role credentials, GitHub tokens, private-key blocks, DeepSeek API keys,
or literal Supabase access tokens. This is a targeted repository sweep, not a
replacement for a dedicated secret-scanning product or Git history scan.

## Mandatory campaign order

1. Re-establish exact baseline and fresh tracked-file ledger.
2. Fix SH-AUD-002 first: hydration/revision ordering.
3. Fix bounded offline-first bootstrap and retry behavior.
4. Restore monotonic account and preview adoption.
5. Stabilize lifecycle flush ownership and exact accounting.
6. Repair the E2E failure/timeout harness without sleeps or weakened assertions.
7. Complete remaining AsyncStorage/editable-state/timer/target-change work from
   the existing OpenSpec.
8. Reconcile all tasks/docs/known gaps.
9. Run exact-tree full regression, remote-boundary, simulation, and native lanes
   as available.
10. Push and require exact-SHA GitHub Actions green.
11. Only then mark this OpenSpec COMPLETED.
12. Only after completion, create/activate the successor
    `certify-production-backend-and-release-boundaries-v1` OpenSpec if meaningful
    repo-controlled work remains.

## Stop conditions

Do not add product features merely to fill time. The user requested a long
autonomous campaign; use a target work budget of up to roughly 12 hours, but
completion is evidence-based rather than clock-based.

Stop when either:

- all in-scope Critical/High findings are fixed, all required gates and exact-SHA
  CI are green, the OpenSpec is honestly COMPLETED, and no meaningful
  repo-controlled successor work remains; or
- an external credential/device/service prerequisite is the only blocker. In
  that case classify it precisely, preserve evidence, finish all non-blocked
  work, and do not fabricate success.
