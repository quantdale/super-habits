# ExecPlan: web-lifecycle terminateOwnedTree ENVIRONMENT assertion fix

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Fix the pre-existing `tests/web-lifecycle.test.ts` failure in
`terminateOwnedTree > cleans up after a failing probe (server never ready) and
releases the port` without weakening assertions, so the unit lane is green on
POSIX hosts while still proving owned-tree cleanup, process death, and port
release.

## Context

- Test file: `tests/web-lifecycle.test.ts` (unit project, `vitest.config.ts`).
- Library under test: `scripts/web-lifecycle.mjs`
  (`spawnOwnedServer`, `waitForHttp`, `terminateOwnedTree`,
  `waitForPortRelease`). No Metro involvement.
- Failing assertion (line 160): `expect(owned.child.exitCode !== null).toBe(true)`
  after terminating a `NEVER_LISTEN_SCRIPT`
  (`setInterval(() => {}, 1000);`) child that never listens.
- Proven root cause (2026-09-19, Linux): a Node child with no SIGTERM handler
  that is killed via `process.kill(-pid, 'SIGTERM')` dies by signal —
  `exitCode === null`, `signalCode === 'SIGTERM'` (reproduced with a minimal
  spawn/kill probe). The sibling passing test uses `SERVER_SCRIPT`, which
  installs `process.on('SIGTERM', () => process.exit(0))` and therefore yields
  `exitCode === 0`. The assertion only accepts the exit-code path, so it is a
  POSIX-signal-semantics `TEST_BUG`/`ENVIRONMENT` class failure, not a product
  cleanup failure. `waitForChildExit` in the library already treats
  `signalCode !== null` as exited, and termination itself succeeds.
- Known-gap context: `docs/testing/known-gaps.md` CG-9 covers the
  `web-lifecycle` bind-race/timeout class (closed); this failure is the same
  file but a distinct assertion-vs-signal-semantics mechanism, not the CG-9
  bind race.
- Option choice: task option (a) — reproduced 1 failed / 18 passed on a clean
  tree (`git status --short` clean), feasible without fixture/threshold
  changes, so (b) J8 headroom and (c) polish are deferred.

## Scope

- Fix the `terminateOwnedTree` failing-probe test assertion to accept either
  POSIX termination outcome (`exitCode !== null || signalCode !== null`)
  while keeping the port-release assertion unchanged.
- Add a concise comment naming the POSIX signal semantics so the intent
  survives.
- Verify with the focused spec, then `qa:fast` as applicable.

## Non-Goals

- No changes to `scripts/web-lifecycle.mjs` termination logic (it already
  handles signal death correctly).
- No threshold/fixture changes, no J8 section-switch work (option b).
- No new product polish (option c), no App Store paperwork.
- No tag, no push, no EAS submit, no owner PII.

## Current Checkpoint

- Current milestone: verify via qa:fast, then validate plan and commit.
- Completed: read AGENTS.md + .agent/PLANS.md + known-gaps; reproduced the
  fail (`npx vitest run tests/web-lifecycle.test.ts --project unit` → 1
  failed / 18 passed, line 160 `expected false to be true`); proved signal
  semantics with a minimal spawn/SIGTERM probe
  (`exit event code null sig SIGTERM`); created this ExecPlan.
- In progress: running qa:fast.
- Important modified files: `tests/web-lifecycle.test.ts` (assertion + comment); this plan.
- Last successful validation: focused spec 19/19 green ×3 consecutive runs (2026-09-19).
- Current failures: `terminateOwnedTree > cleans up after a failing probe`
  (assertion only; cleanup + port release logic sound).
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Run `npm run qa:fast`, then `npm run qa:affected`, then plan-validate and commit locally.
- Remaining definition of done: focused spec green; `qa:fast` green (or
  scoped equivalent + parity); plan validated; local conventional commit (no
  tag/push).

## Progress

- [x] Read AGENTS.md, .agent/PLANS.md, known-gaps/CG-9.
- [x] Reproduce the focused failure on a clean tree.
- [x] Prove POSIX signal-death root cause with a minimal probe.
- [x] Create this ExecPlan.
- [x] Implement the assertion fix (no weakening).
- [x] Focused spec green.
- [x] `qa:fast` (typecheck + lint + unit + label parity) green.
- [ ] Validate plan, commit locally (no tag/push).

## Surprises & Discoveries

- The failing test ran in ~518ms (500ms probe + ~18ms SIGTERM kill),
  consistent with instant signal death rather than a hung cleanup — the
  process died correctly; only the `exitCode`-only check was wrong.
- `waitForChildExit` already handles `signalCode`, so no library change is
  needed; the defect is isolated to the test oracle.

## Decision Log

- 2026-09-19 — Choose option (a): the fail reproduces deterministically on
  this Linux host, root cause is proven, and the fix is a small
  assertion-correctness change with no threshold/fixture risk. Why: highest
  feasibility per the task order; (b)/(c) deferred.
- 2026-09-19 — Fix the oracle, not the library: accept `signalCode` as proof
  of death alongside `exitCode`. Why: Node reports signal kills with
  `exitCode === null`; requiring only `exitCode` is incorrect on POSIX, while
  requiring death-by-either plus port release keeps the assertion strong.
- 2026-09-19 — Do not touch `NEVER_LISTEN_SCRIPT` to add a SIGTERM handler.
  Why: that would mask the real-world no-handler server case that the test is
  meant to cover (cleanup must work even when the child ignores nothing and
  dies by signal).

## Validation Ledger

- 2026-09-19 — `npx vitest run tests/web-lifecycle.test.ts --project unit` — FAIL (1 failed / 18 passed; line 160 `expected false to be true`) — reproduction of the pre-existing fail on a clean tree.
- 2026-09-19 — `npx vitest run tests/web-lifecycle.test.ts --project unit` — PASS 19/19 ×3 consecutive runs — after the oracle fix.
- 2026-09-19 — `npm run qa:fast` — PASS (typecheck + lint + 140 files / 1791 unit tests + journey-label-parity OK).
- 2026-09-19 — `npx vitest run tests/agent-execplan.test.ts --project unit` — PASS 9/9 (impact-map named focused test).
- 2026-09-19 — `npm run web:hygiene` — PASS (8081/8082 free).
- 2026-09-19 — minimal `node -e` spawn/SIGTERM probe — PASS (evidence:
  `exit event code null sig SIGTERM`) — proves POSIX signal-death semantics.

## Changed Files / Areas

- `tests/web-lifecycle.test.ts` — failing-probe isolation assertion (pending).
- `.agent/execplans/web-lifecycle-terminate-assertion-env-fix.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md`.
2. Read this plan (`.agent/execplans/web-lifecycle-terminate-assertion-env-fix.md`).
3. Run `git status --short` and `git diff --stat`; Git wins over stale notes.
4. Reproduce if needed:
   `npx vitest run tests/web-lifecycle.test.ts --project unit`.
5. Continue from `Exact next action` above; update this checkpoint at each
   milestone/failure/validation; run `npm run qa:affected` for changed files.
6. Before completing: `npm run agent:plan:validate -- --plan <path>`,
   focused spec + `qa:fast`, local commit only (no tag/push).

## Outcomes & Retrospective

- Status: Active.
- Summary: pending implementation and verification.
- Follow-up: record final test evidence, commit hash, remaining gaps, and
  `git status --short` in the user report.
