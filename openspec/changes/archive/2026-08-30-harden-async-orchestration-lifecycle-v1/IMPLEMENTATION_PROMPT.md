# IMPLEMENTATION PROMPT V2 — Async/Lifecycle Closure After Green-CI Rollback Audit

You are the implementation agent for `quantdale/super-habits`.

Work autonomously on the existing ACTIVE OpenSpec change:

`openspec/changes/harden-async-orchestration-lifecycle-v1/`

Do **not** start an unrelated feature campaign. The planner baseline
`93c651b5b8510243440823d8ea3456c0eae28454` has green CI, but the planner
re-audit found that the fixes after the first async/lifecycle implementation
rolled back several production invariants while repairing the E2E harness.

Read first, in this order:

1. `AGENTS.md` and repository-local agent instructions.
2. this file;
3. `planner-reaudit-2026-08-27-v2.md`;
4. `proposal.md`, `design.md`, `tasks.md` and `execplan.md` in this change;
5. predecessor whole-system resilience evidence and `docs/testing/known-gaps.md`;
6. `qa/impact-map.json` and native/simulation runbooks relevant to changed files.

## Operating mode

Target one long autonomous execution campaign, up to roughly **12 hours of work
budget if useful**. The budget is not a reason to churn. Finish earlier when
the evidence gates are satisfied. If external infrastructure blocks one lane,
continue every non-blocked workstream and classify the blocked lane honestly.

Use subagents/parallelism only for independent read-only audits or isolated test
work. Serialize changes that touch bootstrap, sync, account, restore, migrations,
shared test harnesses, or the same source files. One owner must integrate and
validate the final tree.

Do not weaken product invariants or tests to obtain green CI. Do not replace a
real timeout with a generic HTTP error. Do not widen exact assertions merely to
tolerate duplicate side effects. Do not add arbitrary sleeps when a state-based
barrier or deterministic deferred promise can exist.

## Primary mission

Restore and prove the lifecycle contracts that current `main` no longer wires
into production, then close the existing OpenSpec honestly.

The campaign is not complete until:

- local-first startup cannot be wedged indefinitely by configured-but-hung
  remote auth/backup;
- durable sync hydration/revision ordering cannot lose or stale a write made
  during startup;
- older account/restore-preview work cannot overwrite newer state;
- interval/NetInfo/visibility/auth lifecycle fan-in has explicit, stable
  ownership and exact side-effect accounting;
- a real stalled-request timeout is tested;
- all current Critical/High findings have deterministic regressions;
- the existing OpenSpec task/ExecPlan truth matches the final implementation;
- exact pushed SHA CI is green.

## Phase 0 — synchronize and preserve evidence

- Fetch origin and fast-forward normally. Do not reset away other work.
- Confirm the planner handoff commit is present.
- Record exact starting HEAD and worktree.
- Run `git ls-files` and regenerate the exhaustive path ledger. The planner
  snapshot had 1,236 blobs; the executor count is authoritative for its tree.
- Run baseline:
  - `npm ci`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run openspec:validate`
  - `npm run agent:plan:validate:all`
  - `npm test`
- Inspect current GitHub Actions state for the starting SHA when available.
- Update the ExecPlan checkpoint before implementation.

## Phase 1 — prove and fix hydration-before-revision/write readiness (SH-AUD-002)

Treat this as the highest-risk item.

Trace all paths to:

- `syncEngine.hydrate()`;
- `syncEngine.prepare()`;
- `runBackupMutation()` / `runSyncedMutation()`;
- settings synthetic outbox enqueue;
- first render and first user-mutating control;
- interval/visibility/NetInfo flush registration.

Establish one explicit invariant:

> No durable sync revision may be allocated, and no remote flush may start,
> before persisted sync state has been hydrated enough to establish the
> monotonic revision floor.

Implement the narrowest architecture that enforces it. A dedicated local
bootstrap/readiness state is acceptable; silently relying on remote auth timing
is not.

Add a deterministic real-SQLite regression:

1. preseed an outbox row with a high durable revision;
2. hold hydration at a controlled barrier;
3. exercise the earliest mutation boundary;
4. release hydration;
5. assert the newest mutation has a revision greater than the persisted floor;
6. close/reopen/hydrate and assert the new intent survives;
7. flush through a deterministic adapter and assert the new payload is the one
   delivered.

If product UI is intentionally gated until hydration, prove the mutating control
cannot become available before hydration and that local startup still remains
fast/offline-safe.

## Phase 2 — restore bounded offline-first bootstrap (SH-AUD-001, SH-AUD-007)

Current production no longer calls `withRemoteTimeout()`.

Design bootstrap as explicit phases with ownership:

- local DB initialization/migrations;
- durable sync hydration;
- local ownership/account facts necessary for safe writes;
- remote auth/account reconciliation;
- restore preview/backup maintenance.

Remote calls must not hold the local application hostage forever. Preserve
remote late-settlement adoption only when it is still current.

Deterministically cover:

- permanently pending remote account bootstrap;
- rejected remote account bootstrap;
- late success after timeout;
- retry after a local DB/bootstrap failure;
- unmount during each pending phase;
- bootstrap retry invalidating older tasks.

Restore an in-app retry action for recoverable bootstrap failure, or document and
test a stronger explicitly approved alternative.

## Phase 3 — reinstate monotonic account-state adoption (SH-AUD-003)

Reintroduce one framework-free monotonic account task/adoption primitive or
equivalent. Cover:

- old bootstrap settles after newer manual refresh;
- old refresh settles after protect/recover verification;
- auth callback refresh overlaps explicit account action;
- bootstrap retry invalidates old task;
- rejected/stale task cannot change visible state or owner-sensitive behavior.

Do not serialize all reads unnecessarily; sequence adoption, not harmless
parallel I/O.

## Phase 4 — reinstate restore-preview adoption authority (SH-AUD-004)

`createPreviewAdoptionGuard()` exists and is tested but is currently dead in
production.

Route every competing preview producer through one authority:

- initial bootstrap preview;
- maintenance recalc;
- post-flush recalc;
- account recovery/protection transition when it changes eligibility;
- restore completion;
- dismissal/retry interactions where relevant.

Prove older preview settlement cannot re-open a dismissed prompt, hide a newer
eligible prompt, or regress ownership/freshness state.

Delete the helper only if a better single authority replaces it and equivalent
tests prove the contract.

## Phase 5 — make flush/listener lifecycle ownership stable (SH-AUD-005)

Audit `AppProviders` plus every timer/listener/subscription owner identified by
the existing OpenSpec.

For sync flush specifically:

- subscriptions should not churn merely because account status changes;
- readiness may be read through stable state/refs or another explicit owner;
- NetInfo immediate emission must be understood and tested;
- visibility + online + NetInfo + fixed interval must coalesce correctly;
- concurrent trigger calls must share the engine's in-flight flush;
- failure accounting increments exactly once per actual adapter attempt;
- mount → unmount → remount leaves one owner;
- no post-unmount backup/preview adoption.

Restore exact E2E or lower-level failure-count oracles after the product/harness
is deterministic.

## Phase 6 — repair the remote-boundary harness instead of weakening it (SH-AUD-006)

Keep the useful Worker-fetch lesson from the recent fix, but remove nondeterminism.

Required work:

- centralize Supabase request interception so page and Worker traffic are both
  covered without double logical ownership;
- add correct CORS preflight and Content-Range behavior;
- replace `page.waitForTimeout(500)` route stabilization with an explicit
  readiness/barrier;
- implement a genuine stalled-request injector for the timeout scenario;
- provide deterministic teardown/drain/cancellation of held requests before
  switching injector modes;
- change widened "one or two failures" assertions back to the exact intended
  number after fixing duplicate trigger semantics;
- remove temporary PA-02 debug logging once no longer needed;
- keep partial success strict: succeeded rows disappear exactly once, failed
  rows remain exactly once.

Do not make CI pass by converting timeout to 503.

## Phase 7 — finish the original async/preference/lifecycle matrix

Re-run the original tasks, not just this addendum:

- AsyncStorage user-intent precedence for every actual competing hydration
  surface;
- Daily Plan editable field precedence;
- Calories mode precedence;
- target-change race (e.g. Habit A → B while A load is pending);
- day rollover + foreground + pending read;
- Pomodoro/Workout timer lifecycle;
- notification response/action replay idempotency;
- service worker/theme/motion/listener cleanup;
- all current skip/fixme classifications;
- targeted eslint suppressions: each must have a narrow reason; no blanket
  suppression.

Use deferred promises, controlled clocks, explicit latches, and state oracles.

## Phase 8 — repository truth and dead-code cleanup

Reconcile:

- `tasks.md` checkboxes from actual evidence;
- `execplan.md` status/checkpoint/outcomes;
- `docs/testing/known-gaps.md`;
- structure/schema docs;
- QA impact map;
- comments that still describe superseded architecture.

Specifically inspect `core/db/localMutation.ts`. It currently describes
projects/goals/daily plans as local-only even though current data layers use
`runBackupMutation()` and remote migrations exist. If it is truly unused, delete
it with search/test proof; otherwise correct its contract.

Do not mass-archive OpenSpec changes inside this campaign unless the archive
operation is mechanically safe and validated. Record archive debt for the
successor if broad cleanup would add risk.

## Phase 9 — exact-tree validation ladder

Run on the final implementation tree, not an earlier checkpoint:

1. `npm run typecheck`
2. `npm run lint` — 0 errors, 0 warnings
3. `npm test`
4. focused new startup/hydration/account/preview/sync tests twice from fresh state
5. `npm run validate:themes`
6. `npm run supabase:schema:validate`
7. `npm run openspec:validate`
8. `npm run agent:plan:validate:all`
9. `npm run qa:impact:validate`
10. `npm run format:check`; if the repository-wide historical formatting gap
    remains, distinguish pre-existing files from changed-file violations and do
    not claim global cleanliness
11. `npm run build:web`
12. `npm run e2e:journeys:p0`
13. `npm run e2e`
14. `npm run e2e:sync`
15. `npm run sim:validate`
16. full deterministic simulation
17. `npm run qa:full`

For native-sensitive changed paths, also run the appropriate Maestro/EAS lanes
sequentially when a verified target is available. If unavailable, record
ENVIRONMENT with exact prerequisite; never call it PASS.

Any race-sensitive suite fixed during this campaign must pass twice from fresh
state after the final code change.

## Phase 10 — push and exact-SHA CI gate

- Run `git diff --check`.
- Ensure no credentials, generated `dist*` output, disposable-backend state, or
  unrelated formatting churn are staged.
- Write a detailed commit message containing:
  - starting and final SHA;
  - path-ledger count;
  - finding IDs closed;
  - root causes;
  - regression tests;
  - local validation results;
  - environment-classified gaps.
- Push normally to `origin/main`.
- Fetch origin and prove local HEAD == fetched origin/main.
- Inspect GitHub Actions for that exact SHA.
- Require quality + full E2E + deterministic scenarios + dist-sync/journeys-sync
  green before completion.

A green CI result is necessary, not sufficient: verify the new deterministic
startup/hydration/account/preview tests were actually included in the quality
test run.

## Phase 11 — close the OpenSpec honestly

Only after all Critical/High in-scope findings are resolved:

- check tasks that have actual evidence;
- keep genuine unavailable external gaps open/classified;
- set ExecPlan `Status: COMPLETED`;
- fill outcomes/retrospective;
- set exact next action to none;
- validate OpenSpec + plans again;
- commit/push any final documentation reconciliation and verify exact-SHA CI.

## Phase 12 — conditional successor, only after this change is COMPLETED

If meaningful repo-controlled production-certification work remains, create a
new OpenSpec change named:

`certify-production-backend-and-release-boundaries-v1`

Its minimum scope should be:

- make `simulation/backend/roundTripScenarios.ts` executable rather than
  note-driven;
- add first-class remote Supabase oracles;
- provision disposable project → apply authoritative repository migrations →
  configure required auth behavior → build `dist-live` → execute sync/restore/
  partial failure/RLS/edge-function scenarios → teardown in `finally`;
- add cross-user RLS negative tests and auth/quota edge-function tests;
- prove disposable schema and production migrations cannot drift;
- pin `tsx`/Supabase CLI or otherwise make the lane reproducible;
- correct stale deploy-workflow linked-project instructions;
- keep production-host/credential/disposable-marker guard fail-closed;
- add a credentialed read-only live schema/RLS comparison only when explicitly
  authorized;
- evaluate native sustained-use and heap/memory profiling as separate
  evidence-driven tasks;
- preserve real historical DB corpus gaps as CREDENTIAL/ARTIFACT_REQUIRED until
  an anonymized corpus actually exists;
- reconcile/archive completed OpenSpec changes only after mechanical validation.

Do not activate this successor before the current async/lifecycle change is
COMPLETED.

## Completion rule

The user asked for a long autonomous campaign. Treat approximately 12 hours as
a maximum useful work budget, **not** as an instruction to keep working after
the repository is proven complete.

Never fill time with speculative features. Stop when the evidence says stop.
