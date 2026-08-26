# Implementation Prompt — Async/Lifecycle Closure & Remote-Boundary Recovery

You are the autonomous executor for `quantdale/super-habits`.

Your mission is to **finish, repair, certify, and close**
`openspec/changes/harden-async-orchestration-lifecycle-v1`.
Do not start a parallel feature campaign while this change is ACTIVE.

Target work budget: approximately one long autonomous session (about 12 hours
when needed). Evidence, not elapsed time, controls completion. Do not create
churn to fill the window, and do not stop at the first green local run.

## First command-level objective

Pull `main`, confirm the planner commit containing this prompt, read:

1. `AGENTS.md`
2. `.agent/PLANS.md`
3. `.agent/EXECUTION_PROMPT.md`
4. every file under
   `openspec/changes/harden-async-orchestration-lifecycle-v1/`
5. `docs/testing/known-gaps.md`
6. `qa/impact-map.json`
7. `.github/workflows/ci.yml`

Then run the plan resume/validation commands and reconcile Git truth before
editing product code.

## Non-negotiable starting facts

- Planner baseline before this handoff: `79bf46821714094d8767a1fff5c7c43227da66f4`.
- CI run #495 on that SHA is red.
- Quality, full ordinary browser E2E, and full deterministic scenario library
  passed.
- The failing lane is `journeys-sync` against `dist-sync/`.
- P5 expected only `habits` in outbox after partial success; actual retained
  `habits` + `todos`.
- Recoverable Account V1 expected restore eligibility `Allowed`; it never
  appeared on three attempts.
- Push CI #491 on `7a496479fcf3831ba635c687c8b9247267900cfd`
  passed the same remote-boundary lane.
- Push runs #493 and #495 reproduce the same two dist-sync failures.
- The current plan is ACTIVE and not eligible for archival.

Treat these as evidence to reproduce, not as permission to assume a root cause.

## Phase 1 — Reconcile final-tree inventory and active plan

- Run `git fetch origin`, fast-forward normally, record exact HEAD and status.
- Run `git ls-files`; regenerate counts by top-level area.
- Explain the planner's 1,233-blob remote tree versus the old 1,226-file
  ExecPlan ledger using local Git as authority.
- Reconcile `tasks.md` checkboxes against actual implemented evidence. Do not
  mass-check tasks just because the ExecPlan prose says they happened.
- Run baseline:
  - `npm ci`
  - `npm run typecheck`
  - `npm run lint`
  - focused/current Vitest
  - `npm run openspec:validate`
  - `npm run agent:plan:validate:all`
  - `npm run qa:impact:validate`
- Record every command/result in the ExecPlan.

## Phase 2 — Reproduce and bisect the authoritative CI failures

Reproduce the two failing `journeys-sync` scenarios locally when the host can
run the dist-sync assumptions. If local DNS/network prevents the lane, use the
GitHub Actions evidence and a deterministic lower-level harness; do not call the
CI failure an environment problem.

Use the known-good `7a49647` and known-bad history to bisect the relevant
changes. The commits between the green baseline and the planner stage include
whole-system resilience, migration/soak work, Calories/native hardening,
Pomodoro/account stale-async fixes, and the async-orchestration plan. Narrow
the first bad behavioral commit for each failing invariant.

Prefer a targeted command that runs only the two failing journeys during the
bisect, after a fresh `dist-sync/` build. Once the first bad commit is known,
inspect its exact diff and dependency effects.

Do not:
- increase Playwright timeouts;
- add sleeps;
- weaken expected outbox contents;
- skip either failing test;
- make the failure injector less strict;
- serialize everything as a blanket race fix.

## Phase 3 — Fix P5 partial-success durable-outbox semantics

Trace the full write lifecycle:

`enqueue -> owner binding -> flush coalescing -> adapter preflight -> per-record
remote result -> durable acknowledgement/delete -> retry/backoff -> post-flush
maintenance`.

Prove these invariants with narrow deterministic tests:

1. two entities queued, one remote success + one remote failure;
2. successful row is removed exactly once;
3. failed row remains exactly once;
4. retry pushes only the failed row;
5. concurrent flush callers coalesce and cannot resurrect acknowledged rows;
6. reconnect/visibility/interval fan-in cannot create a second logical push;
7. post-flush backup maintenance cannot alter outbox acknowledgement semantics;
8. owner transition cannot acknowledge a row under the wrong owner.

Then keep the unchanged P5 E2E oracle green.

## Phase 4 — Fix Recoverable Account V1 convergence

Trace the exact state machine from a protected/recoverable owner through an
empty-device recovery and restore eligibility.

Add deterministic tests for:

- successful recovery followed by a late older account bootstrap/refresh;
- auth-state callback racing the explicit recovery refresh;
- restore preview started before recovery settling after recovery;
- restore preview started after recovery winning over any older preview;
- local owner binding and pending-outbox state after recovery;
- empty-device eligibility becoming Allowed without reload;
- no duplicate user creation (the existing `requestShouldCreateUser === false`
  assertion stays unchanged);
- retry/reconnect not regressing the recovered state.

Repair the narrowest ownership/ordering defect. Do not special-case the UI text
or hard-code `Allowed` in the view.

## Phase 5 — Finish the active async-precedence contract

Audit every current `AsyncStorage.getItem` caller. For each, record:

- persisted source;
- state adopter;
- whether an explicit user action can happen before hydration settles;
- restore/remote authority if any;
- precedence rule;
- test evidence.

Where a real competing source exists, use the existing
`createPreferencePrecedenceGuard` or a justified narrower equivalent and add
paired tests:

- untouched state hydrates persisted value;
- explicit user action after read start wins over late hydration.

Do not wrap pure storage helpers or read-only caches without a race.

## Phase 6 — Finish timer/listener/subscription runtime proof

Build a finite ownership table for all intervals, timeouts, AppState/NetInfo/
visibility listeners, service-worker hooks, notification responses, and
theme/motion listeners.

For high-risk owners, add deterministic mount -> unmount -> remount/lifecycle
tests proving:

- exactly one active owner;
- cleanup always removes old owner;
- no stale closure updates a new target;
- no duplicated Pomodoro/Workout completion;
- no duplicate sync flush/domain write/navigation;
- unmounted views reject late results.

Finish M7 from the active ExecPlan rather than creating a new lifecycle system.

## Phase 7 — Cross-feature race and target-change proof

Close M8 with state-based tests/journeys for at least:

- rapid section switching during in-flight reads;
- day rollover + foreground + in-flight refresh;
- Habit detail A -> B while A history is pending;
- preference edit during hydration;
- account recovery/restore-preview overlap;
- reconnect/visibility/interval overlap.

Use deferred promises/fake clocks/injected adapters where possible. No timing
lottery.

## Phase 8 — Make zero-warning enforcement durable

The current project claims lint 0/0 but `package.json` allows 25 warnings.

After confirming the final source really produces zero warnings, change the
lint gate to fail on any warning (for example `--max-warnings 0`). Keep CI
calling the same canonical script. Do not add blanket `eslint-disable`
comments.

Audit existing targeted suppressions. Remove only unjustified ones with proof;
document legitimate framework/test harness exceptions.

## Phase 9 — Reconcile skips, known gaps, and plan truth

- Inventory every active `test.fixme`, `test.skip`, `describe.skip`,
  `it.skip`.
- Resolve the two previously `UNKNOWN` E2E skip classifications.
- Ensure every remaining skip maps to a named environment/capability gap.
- Update known-gaps only when proof changes.
- Update the tracked-file audit ledger to the final tree.
- Reconcile `tasks.md`, Finding Ledger, Validation Ledger, Current Checkpoint,
  Progress, and Outcomes.
- Do not mark COMPLETED while any Critical/High finding or authoritative CI
  failure remains open.

## Phase 10 — Broad exact-tree qualification

Run cheapest-to-broadest and record exact results:

- `npm run typecheck`
- `npm run lint` — **0 errors / 0 warnings and warning budget = 0**
- focused tests for every changed subsystem
- `npm test`
- `npm run test:integration`
- `npm run validate:themes`
- `npm run supabase:schema:validate`
- strict validation of this OpenSpec change
- `npm run openspec:validate`
- `npm run qa:impact:validate`
- plan validators
- `npm run format:check`
- `npm run build:web`
- `npm run qa:affected`
- `npm run e2e:journeys:p0`
- focused changed journeys
- `npm run e2e:full`
- `npm run e2e:sync`
- `npm run qa:simulation -- --all --mode deterministic`
- `npm run qa:full`
- `git diff --check`

For race-sensitive and formerly failing tests, require **two clean fresh-state
runs** after the final fix.

Run Android native lanes sequentially when a verified device/emulator is
available. iOS remains environment-classified unless actual macOS/EAS evidence
exists. Never label unavailable native proof as PASS.

## Phase 11 — Push and exact-SHA CI closure

Commit coherent waves with useful messages. Final delivery commit must contain a
detailed session report: audit coverage, root causes, fixes, tests, remaining
capability gaps, and any justified deferrals.

Push normally to `origin/main`, then:

- fetch origin;
- verify clean worktree;
- verify local HEAD == fetched `origin/main`;
- inspect the GitHub Actions run for the exact pushed SHA;
- require `quality` and `e2e` green, including `journeys-sync`;
- if CI is red, inspect artifacts/logs, fix, push, and repeat.

Only after exact-SHA CI is green and all completion gates are met may you set:

- `Status: COMPLETED`
- every genuinely completed task checkbox to `[x]`
- `Exact next action: None — task complete.`

Then archive/sync OpenSpec only if repository conventions call for it.

## Phase 12 — Decide whether a successor campaign exists

After closure, re-run a whole-repo risk scan. If no Critical/High/meaningful
Medium implementation work remains, stop and say no new implementation
campaign is justified.

If meaningful residual work remains, create a **new** OpenSpec proposal only
then. Strong successor candidates, if still evidenced, are:

- real historical SQLite corpus qualification;
- guarded disposable real-Supabase/RLS round-trip certification;
- heap/memory-leak and native sustained-load instrumentation;
- remaining native/iOS platform proof.

Do not invent a feature merely to keep the agent busy.

## Final instruction

Work autonomously from evidence until the active change is genuinely terminal.
Critical/High defects must be fixed and regression-tested. Never trade
correctness for a green dashboard. Keep the ExecPlan resumable after every
meaningful milestone so another agent can pull the repo and continue without
chat history.
