# ExecPlan: Integration Tinypool IPC Channel Closed V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Root-cause and fix (or evidence-document as ENVIRONMENT) the
`npm run test:integration` tinypool `ERR_IPC_CHANNEL_CLOSED` failure on this
host, where zero integration tests execute because the worker pool dies at
spawn.

## Context

- Repo `/home/box/Desktop/super-habits`, branch `main`, HEAD `6db9b0f`
  (clean, ahead of origin/main by 6 — do not reset/rebase/push beyond a
  verified local commit).
- Toolchain: Node v20.19.2, npm 9.2.0, vitest 3.2.7, tinypool 1.1.1,
  vite-node 3.2.4. Engines require Node >=22.22.1 <23 (repo runs 20.19.2 —
  note as context, not yet a finding).
- `vitest.config.ts` integration project: `environment: node`,
  `include: tests/integration/**/*.test.ts` (64 files),
  `setupFiles: tests/integration/setup.ts`, `testTimeout: 15_000`; no
  explicit `pool`, `maxWorkers`, `fileParallelism`, or `poolOptions`.
  `tests/integration/setup.ts` mocks react-native/expo-crypto/
  expo-notifications and routes expo-sqlite to real better-sqlite3 via
  `tests/integration/helpers/db.ts`.
- Prior evidence (store-declaration-drift-guard-v1.md Decision Log +
  Validation Ledger, 2026-09-19): `npm run test:integration` fails with
  `ERR_IPC_CHANNEL_CLOSED` at worker-pool spawn, zero tests executed,
  identically on the pristine stashed tree → pre-existing host/harness
  issue, not caused by store-declaration work.
- Host snapshot at plan creation: 8 CPUs, load avg ~13–14 (saturated),
  15 GiB RAM with ~13 GiB available, swap 15 GiB (2 used). CPU saturation
  is a leading ENVIRONMENT hypothesis; memory exhaustion is not currently
  indicated.
- Rules: AGENTS.md + .agent/PLANS.md; do not weaken meaningful tests; do
  not invent secrets/owner PII; prefer evidence over claims; no model
  switch; no v1.0.0 tag; no EAS submit; no push (local commit only when
  verified); do not reopen J8 product changes; no store-console owner work.

## Scope

- Reproduce `npm run test:integration` and capture exact command, stderr,
  versions, pool settings, memory/load.
- Isolate with `npx vitest run --project integration` and single tiny
  integration files; sweep `--pool=forks|threads|vmThreads`,
  `--maxWorkers`, `--fileParallelism`, `poolOptions` only as diagnostics.
- Classify PRODUCT/TEST_BUG (harness/config) vs ENVIRONMENT (host OOM,
  orphan workers, sandbox IPC limits, cgroup) with reproduction evidence.
- If a durable product-safe harness/config fix exists (strict tests stay
  strict and green under normal load): implement, verify, update known-gaps
  if needed.
- If purely ENVIRONMENT with no safe durable fix: document in
  `docs/testing/known-gaps.md` + close plan as COMPLETED/BLOCKED with
  reproduction evidence; leave tests strict.

## Non-Goals

- No J8 product changes or re-measurement (unless a quiet-host remeasure
  shows a clear app hotspot — out of scope for this gap).
- No store-console owner work; no owner PII.
- No weakening/disabling/skipping of the integration suite to get green.
- No model switch, tag, EAS submit, or push.
- No broad product refactors beyond a minimal harness/config fix.

## Current Checkpoint

- Current milestone: ROOT-CAUSED + VERIFIED — ENVIRONMENT (wrong Node
  major in shell), full integration suite green under pinned Node.
- Completed: startup; reproduction (exit 1, 21-line log, zero tests);
  single-file isolation (identical failure); unit-project control (green,
  pool healthy); native-module probe (better-sqlite3 segfaults under Node
  20, loads OK under Node 22.23.2); full-suite verification under Node 22
  (64/64 files, 309/309 tests PASS).
- In progress: None — task complete.
- Important modified files: `.agent/execplans/integration-tinypool-ipc-channel-closed-v1.md`
  (this plan, new).
- Last successful validation: None yet for this task.
- Current failures: None remaining. Original failure re-proven under Node
  v20.19.2, then resolved by using pinned Node v22.23.2 (no code change).
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — every condition is complete
  (root cause proven, full integration green under pinned Node,
  ENVIRONMENT noted in known-gaps, qa:fast green, plan validated,
  committed locally).

## Progress

- [x] Startup: AGENTS.md, PLANS.md, agent:plans, git HEAD/status, prior
  plan evidence skim.
- [x] ExecPlan created (this file).
- [x] Reproduce `npm run test:integration` with full evidence.
- [x] Single-file / pool-option isolation sweep (pool sweep mooted: crash
  is below the pool layer — plain `node -e require('better-sqlite3')`
  segfaults under Node 20).
- [x] Classification (PRODUCT/TEST_BUG vs ENVIRONMENT).
- [x] ENVIRONMENT documentation in known-gaps (note E1; no safe code
  fix exists or is needed).
- [x] Relevant QA + plan validation + local commit (if changed) + handoff.

## Surprises & Discoveries

- Host load avg ~13–14 on 8 CPUs at plan creation suggested CPU/IPC
  starvation, but the true cause is cruder: the shell's default `node` is
  v20.19.2 while the repo pins 22.23.2 (`.nvmrc`, `engines >=22.22.1 <23`)
  and better-sqlite3@13 requires Node >=22. Under Node 20 the native
  module segfaults on import (exit 139, no binding build dir — prebuilds
  only), killing each tinypool worker at setup import →
  `ERR_IPC_CHANNEL_CLOSED` with zero tests executed. Unit project is
  unaffected (no native import) — the passing unit control exonerated the
  pool itself.
- No pool-option sweep was needed: identical failure on a 34-line single
  file under Node 20, and a full 64-file green run under Node 22, prove
  the crash sits below the pool layer (native module load), where
  `--pool`/`maxWorkers`/`fileParallelism` cannot matter.

## Decision Log

- 2026-09-19 — Open dedicated single-gap ExecPlan for tinypool IPC
  instead of reopening store-declaration plan: the failure was recorded
  there as pre-existing ENVIRONMENT follow-up needing independent
  root-cause.
- 2026-09-19 — Classify ENVIRONMENT, no code/config change: repo already
  declares the requirement (`.nvmrc` 22.23.2, `engines`, better-sqlite3
  `engines: node >=22`); the failure is a wrong-interpreter shell, not a
  harness defect. Rejected `engine-strict`/pool tweaks: they would change
  behavior for all contributors (e.g. unit suite currently passes under
  Node 20) for a problem already covered by declared prerequisites.
  Document as a dated environment note in known-gaps; leave tests strict.

## Validation Ledger

- 2026-09-19 — `npm run agent:plans` — PASS (plan inventory listed).
- 2026-09-19 — `git status --short` / branch / log — PASS (clean main,
  HEAD 6db9b0f, ahead of origin by 6, behind 0).
- 2026-09-19 — `npm run test:integration` (Node v20.19.2) — ENVIRONMENT
  FAIL (exit 1, 21 lines, zero tests; `ERR_IPC_CHANNEL_CLOSED`).
- 2026-09-19 — `npx vitest run --project integration
  tests/integration/recurringExpansion.test.ts` (Node 20) — ENVIRONMENT
  FAIL (identical crash on 34-line single file).
- 2026-09-19 — `npx vitest run --project unit
  tests/store-declaration-drift.test.ts` (Node 20) — PASS 8/8 (pool
  healthy; control).
- 2026-09-19 — `node -e require('better-sqlite3')` — Node 20: SEGFAULT
  (exit 139); Node v22.23.2: OK (`better-sqlite3 OK under v22.23.2`).
- 2026-09-19 — `npm run test:integration` (Node v22.23.2) — PASS (64/64
  files, 309/309 tests, 32s).
- 2026-09-19 — `npm run qa:affected` — PASS (rule
  `agent-workflow-and-documentation`, gates qa:fast, broad regression not
  required).
- 2026-09-19 — `npm run qa:fast` (Node v22.23.2) — PASS (typecheck 0
  errors, lint 0/0, 1799 unit passed / 141 files, label parity OK).
- 2026-09-19 — `npm run agent:plan:validate` — PASS (ExecPlan valid).

## Changed Files / Areas

- `.agent/execplans/integration-tinypool-ipc-channel-closed-v1.md` — this
  plan.
- `docs/testing/known-gaps.md` — dated ENVIRONMENT note E1 (pinned-Node
  requirement + `ERR_IPC_CHANNEL_CLOSED` triage rule); no test semantics
  touched.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. Run `git status --short` and `git log --oneline -5`; reconcile with the
   Current Checkpoint (Git wins over narrative; do not reset/rebase).
3. Run `npm run agent:resume -- --plan .agent/execplans/integration-tinypool-ipc-channel-closed-v1.md`
   for orientation.
4. Continue from `Exact next action`; keep this checkpoint current at every
   milestone/failure/decision/validation.
5. Before complex-task completion, run
   `npm run agent:plan:validate -- --plan .agent/execplans/integration-tinypool-ipc-channel-closed-v1.md`.

## Outcomes & Retrospective

- Status: Complete.
- Summary: `npm run test:integration`'s `ERR_IPC_CHANNEL_CLOSED`
  (zero tests executed) is an ENVIRONMENT wrong-interpreter failure, not
  a product or harness defect: the shell ran Node v20.19.2 while the repo
  pins 22.23.2 and better-sqlite3@13 requires Node >= 22 (segfault on
  import under Node 20, clean load under Node 22). No code, config, or
  test change was needed or made; the suite passes unchanged under the
  pinned Node (64/64 files, 309/309 tests), and the triage rule is
  recorded as known-gaps note E1. All applicable gates green; local
  commit only, no push.
- Follow-up: none for this gap. Successor work is a new gap (see final
  handoff).
- Lessons: when tinypool dies with zero tests executed but the unit
  project is green, probe native-module import in plain `node` before
  touching pool options — and check `node --version` against `.nvmrc`
  first.
