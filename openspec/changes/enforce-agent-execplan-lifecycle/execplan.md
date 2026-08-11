# ExecPlan: Enforce Agent ExecPlan Lifecycle

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Make SuperHabits long-running Codex work recoverable and lightly enforceable
from repository state alone. A fresh or compacted session must be able to
discover a task, validate its lifecycle, reconcile it against Git, see the
existing QA impact, and continue from an exact next action without a second
task-state system.

## Context

- OpenSpec artifacts in this directory define required behavior; this file is
  the implementation waypoint and recovery state.
- `.agent/PLANS.md` is the canonical ExecPlan protocol.
- Git is authoritative for actual files and `qa/impact-map.json` plus
  `scripts/qa-impact.mjs` are authoritative for changed-file QA escalation.
- Existing historical plans predate the versioned lifecycle and must remain
  discoverable without breaking CI.

## Scope

- Add read-only validator, discovery, and resume commands in `scripts/`.
- Reuse the existing QA impact implementation from resume.
- Add lifecycle/checkpoint documentation, one template, focused tests, and a
  narrow CI validation step for versioned plans.
- Dogfood this plan through active, blocked/completed fixture, recovery, and
  final-validation states.

## Non-Goals

- No SQLite, JSON, task database, daemon, agent memory service, or global
  current-task file.
- No product runtime, feature, sync, or user-data behavior changes.
- No replacement or duplicate of autonomous-QA impact rules.
- No automatic plan/worktree modification by resume or reconciliation.
- No cryptographic proof that a Validation Ledger command ran.

## Current Checkpoint

- Current milestone: COMPLETE — validator, discovery, resume, lifecycle,
  reconciliation, QA integration, documentation, tests, and CI enforcement
  are implemented and validated.
- Completed: Recovered repository instructions and clean baseline at
  `714819ab00191f90fee1550c3e919ade3bdae054`; reviewed prior durable work,
  QA infrastructure, workstation evidence, OpenSpec schema, and CI; created
  this change; implemented and dogfooded all requested capabilities.
- In progress: None.
- Important modified files: `.agent/PLANS.md`,
  `.agent/EXECPLAN_TEMPLATE.md`, `AGENTS.md`, `scripts/agent-execplan.mjs`,
  `scripts/qa-impact.mjs`, `qa/impact-map.json`, `tests/agent-execplan.test.ts`,
  `package.json`, `.github/workflows/ci.yml`, and this OpenSpec change;
  `git status` remains authoritative for the complete diff.
- Last validation: Completed-plan validation, all-plan validation, discovery,
  and JSON resume all passed with no warnings; `npm run qa:fast` passed; final
  `npm test` passed 642 tests across 58 files; OpenSpec passed 15/15; the
  impact map passed 12 rules; task-owned formatting and `git diff --check`
  passed.
- Current failures: None.
- Relevant quarantines: Existing QA/native-E2E quarantines only; no new
  quarantine introduced.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — all definition-of-done conditions are
  validated and the completed-plan validator passes.

## Progress

- [x] 2026-08-09 — Recovered repository rules, Git baseline, prior durable
      work, QA impact map, workstation evidence, and OpenSpec workflow.
- [x] 2026-08-09 — Created `enforce-agent-execplan-lifecycle` proposal/design/
      spec/tasks scaffold and this versioned ACTIVE ExecPlan.
- [x] 2026-08-09 — Implemented reusable QA impact exports, the agent plan CLI,
      package commands, and versioned-plan CI enforcement.
- [x] 2026-08-09 — Added 9 focused tests, lifecycle/template documentation,
      package commands, and narrow CI enforcement.
- [x] 2026-08-09 — Dogfooded validation, resume, discovery, and affected-QA
      commands against this plan; the output is sufficient for a fresh session.
- [x] 2026-08-09 — Dogfooded zero-context, compaction, parallel-plan, BLOCKED,
      COMPLETED, discovery, resume, and completion-enforcement scenarios.
- [x] 2026-08-09 — Ran final impact, typecheck, lint, unit/integration,
      OpenSpec, formatting, and diff validation; completed this retrospective.

## Surprises & Discoveries

- The current shell does not expose Node/npm on `PATH`, although Node 22 is
  installed at `C:\Program Files\nodejs`; repository-local commands can be
  invoked through that installation while preserving the repository baseline.
- Historical OpenSpec changes remain listed as in-progress even though the
  current task must not mutate them; plan discovery must be independent of
  OpenSpec status.
- The first focused test run exposed that COMPLETED plans must require a PASS
  result rather than merely a ledger entry marked `NOT RUN`; the validator and
  fixture now express that completion rule.
- OpenSpec validation requires delta headers in capability specs; the initial
  `## Requirements` heading was a `SPEC_AMBIGUITY`/authoring error and was
  corrected to `## ADDED Requirements`.
- A parser hardening change initially treated the `# ExecPlan` title as the
  first heading and caused five lifecycle tests to regress; this is recorded as
  `PRODUCT_BUG` and fixed by locating the first `##` section heading.
- Documentation and agent-tooling paths now have an explicit QA impact rule,
  so docs-only impact resolves to `qa:fast` plus the focused plan test instead
  of inheriting every E2E lane; truly unmatched paths retain the conservative
  default.

## Decision Log

- 2026-08-09 — Use one Node CLI with subcommands — keeps the public command
  surface small while allowing shared parsing and read-only behavior.
- 2026-08-09 — Version new plans with `Plan-Version: 2` — allows narrow CI
  enforcement and preserves historical plans without a mass migration.
- 2026-08-09 — Reuse `scripts/qa-impact.mjs` through exports — prevents a
  second changed-file dependency map and keeps `qa:affected` behavior aligned.
- 2026-08-09 — Treat Git discrepancies as warnings, not ownership claims — a
  plan cannot prove which agent created a pre-existing working-tree change.
- 2026-08-09 — Keep resume conservative for a dirty multi-file worktree — QA
  impact is derived from actual Git paths, so unrelated changes remain visible
  and truly unmatched paths retain the existing default gates.

## Validation Ledger

- 2026-08-09 — Repository startup reads and `git status`/baseline inspection —
  PASS — clean `main` at expected migrated HEAD; no unrelated edits present.
- 2026-08-09 — OpenSpec scaffold/status inspection — PASS — new change is
  schema `spec-driven` and artifacts are being authored in dependency order.
- 2026-08-09 — `node scripts/agent-execplan.mjs validate --plan <this-plan>` —
  PASS — versioned ACTIVE plan accepted.
- 2026-08-09 — `node scripts/agent-execplan.mjs list` — PASS — discovered three
  legacy COMPLETED plans and this independent ACTIVE plan.
- 2026-08-09 — `node scripts/agent-execplan.mjs resume --plan <this-plan>` —
  PASS — read-only orientation included Git status, changed files, default QA
  impact, and a neutral missing-test-file warning.
- 2026-08-09 — `npm run agent:plan:validate`, `npm run agent:resume`,
  `npm run agent:plans`, `npm run qa:affected -- --json` — PASS — real package
  commands recover this task and derive conservative default gates from all
  current changed paths.
- 2026-08-09 — `npm run openspec:validate` — SPEC_AMBIGUITY (resolved) — the
  new delta spec used a generic Requirements heading; OpenSpec reported the
  exact required delta syntax, which was repaired before rerun.
- 2026-08-09 — `npm run typecheck` — PASS — no TypeScript errors.
- 2026-08-09 — `npm run lint` — PASS — 0 errors and 17 existing warnings,
  within the configured 25-warning budget.
- 2026-08-09 — Targeted Prettier write on task-owned files — PASS — new test
  formatting errors were repaired without normalizing unrelated AGENTS.md.
- 2026-08-09 — Full `npm test` — PASS — 58 test files and 641 tests passed;
  this was before the final impact-map refinement and will be rerun.
- 2026-08-09 — `npm run test:unit -- tests/agent-execplan.test.ts` — PRODUCT_BUG
  (resolved) — metadata hardening caused 5/8 fixture failures; fixed the
  heading boundary before rerunning.
- 2026-08-09 — `npm run test:unit -- tests/agent-execplan.test.ts` — TEST_BUG
  (resolved) — 7/8 fixtures passed; corrected the fixture assertion and kept
  the stricter COMPLETED final-validation requirement.
- 2026-08-09 — `npm run test:unit -- tests/agent-execplan.test.ts` — PASS — 9
  focused lifecycle, path, discovery, reconciliation, and QA tests passed.
- 2026-08-09 — `npm run qa:fast` — PASS — typecheck, lint, and 598 unit tests;
  0 errors and 17 existing lint warnings within budget.
- 2026-08-09 — `npm test` — PASS — 58 test files and 642 unit/integration tests.
- 2026-08-09 — `npm run qa:impact:validate` — PASS — 12 rules.
- 2026-08-09 — `npm run qa:affected -- --json` — PASS — the agent workflow
  rule matched; `package.json` remained unmatched, so the existing conservative
  `qa:full` default stayed visible for this mixed working tree.
- 2026-08-09 — Explicit QA impact probes — PASS — docs-only paths resolved to
  `qa:fast` plus the focused test; `lib/time.ts` retained timezone,
  integration, journey, and full-regression gates.
- 2026-08-09 — `npm run openspec:validate` — PASS — 15/15 repository items.
- 2026-08-09 — Targeted `npx prettier --check` — PASS — all task-owned files
  matched; unrelated whole-file AGENTS.md normalization was not performed.
- 2026-08-09 — `git diff --check` — PASS — no whitespace errors.
- 2026-08-09 — `npm run agent:plan:validate:all` — PASS — this completed
  versioned plan is structurally valid; historical plans remain excluded.
- 2026-08-09 — `npm run agent:plans` — PASS — discovery reports this plan as
  COMPLETED alongside independent historical plans.
- 2026-08-09 — `npm run agent:resume -- --plan <this-plan>` — PASS — completed
  resume retains evidence, Git paths, QA impact, and `None — task complete.`
  without a fake implementation action.
- 2026-08-09 — `openspec status --change enforce-agent-execplan-lifecycle` —
  PASS — proposal, specs, design, and tasks are complete (4/4 artifacts).

## Changed Files / Areas

- `openspec/changes/enforce-agent-execplan-lifecycle/` — requirements,
  design, tasks, and living implementation state.
- `.agent/PLANS.md`, `.agent/EXECPLAN_TEMPLATE.md`, `AGENTS.md` — canonical
  lifecycle and recovery guidance.
- `scripts/agent-execplan.mjs`, `scripts/qa-impact.mjs` — read-only tooling and
  shared impact-plan implementation.
- `qa/impact-map.json` — explicit lightweight coverage for docs and
  agent-tooling paths while retaining conservative defaults for unmatched files.
- `tests/agent-execplan.test.ts` — structural, discovery, reconciliation, and
  QA integration coverage.
- `package.json`, `.github/workflows/ci.yml` — command surface and narrow CI
  enforcement.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this ExecPlan completely.
2. Run `npm run agent:resume -- --plan
openspec/changes/enforce-agent-execplan-lifecycle/execplan.md`.
3. Inspect every Git discrepancy reported by resume; Git wins over stale plan
   narrative, and resume is read-only.
4. Reread relevant changed files, update this checkpoint, and continue only
   from `Exact next action`.
5. Run `npm run qa:affected` after meaningful changes and record the result
   before crossing a context-heavy phase or declaring completion.

## Outcomes & Retrospective

- Status: Complete.
- Summary: Added a read-only Node CLI for structural validation, independent
  plan discovery, fresh-session resume orientation, Git reconciliation, and
  shared QA-impact reporting. Added ACTIVE/BLOCKED/COMPLETED enforcement,
  canonical recovery/long-running-loop guidance, a template, focused tests,
  and narrow CI validation for versioned plans.
- Evidence: 9 focused tests and 642 full unit/integration tests pass;
  typecheck/lint/qa:fast, OpenSpec, impact-map, formatting, diff checks, and
  completed-plan validation pass. Zero-context output identifies the objective,
  milestone, work, Git state, QA gates, warnings, and exact next action.
- Remaining: None for the requested repository foundation. `qa:full` was not
  run because the change has no product/web/native behavior; its conservative
  recommendation remains visible for the mixed working tree in `qa:affected`.
- Follow-up: New substantial tasks should use `Plan-Version: 2`; historical
  plans remain discoverable and can opt in when next maintained.
