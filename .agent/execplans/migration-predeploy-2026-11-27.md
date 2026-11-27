# ExecPlan for the Supabase migration pre-deploy audit

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Audit the pending Supabase chain on a populated database and review its compatibility with current and older clients. Reproduce and fix safe defects, and document deployment decisions for the owner.

## Context

The brief is at `/workspace/pi-sessions/cx/cx1-migaudit.brief`. This worktree is `/workspace/wt-cx-migaudit`, branch `rv/migration-predeploy`, starting at `acf859f2`. Git identifies five pending migrations ending in `20261123140000_add_reward_snapshot_scope.sql`.

## Scope

Review migration execution and populated upgrades, owner boundaries, RPC compatibility, pre-deploy client behavior, and validator/type parity. Test each fix before changing production code. Commit each defect group locally.

## Non-Goals

Hosted access, remote Git actions, and data-destructive decisions are outside scope.

## Current Checkpoint

- Current milestone: Complete. The local pre-deploy audit, forward-only SQL fix and quality gates are verified.
- Completed: Restored all merged SQL files, verified the new forward verifier on an existing staged capture and the full 24-file chain, committed the client, SQL and validator fixes, and prepared the owner report.
- In progress: None.
- Important modified files: Backup restore logic and tests, generation qualification and schema validator, the single new SQL migration, this plan, and the audit report.
- Last successful validation: 92 local PostgreSQL checks, populated ordered upgrade, provenance qualification, schema validator, typecheck, lint, and 5,578 Vitest tests.
- Current failures: None in final gates.
- Relevant quarantines: Two existing Vitest skips.
- Blockers: None for the local audit. The report records the owner's deployment, retention, indexing and erasure decisions.
- Exact next action: None. Task complete.
- Remaining definition of done: Complete.

## Progress

- [x] Verify worktree and version boundary.
- [x] Reproduce migration and client findings.
- [x] Implement and verify safe fixes under the forward-only policy.
- [x] Write report, validate, and commit.

## Surprises & Discoveries

- Git shows the reward migration from #278 after the four explicitly named files.
- Extracted the free PostgreSQL 17.12 server package beneath the ignored worktree scratch directory. Qualification uses throwaway data and a local Auth/role shim.
- Exact capability matching blocks a current client on the predecessor and older generation clients on the final Scope 10 server. Preserving that fence avoids losing newer snapshot data.

## Decision Log

- 2026-11-27 — Use the brief's deployment boundary. Earlier migrations may already be deployed.
- 2026-11-27 — Driver correction requires every merged SQL file to remain byte-identical. The forward migration can change future publication but cannot restore data deleted by an earlier migration.

## Validation Ledger

- 2026-11-27 — `git status --short --branch` and `git log --oneline -- supabase/migrations` — PASS — confirmed branch, baseline, and pending inventory.

- 2026-11-27 — `node scripts/qualify-backup-generations.mjs` — Baseline PASS, then expected RED for both added cases, preserved in `.tmp-migration-predeploy/sql-*-red.log`.
- 2026-11-27 — `bash .tmp-migration-predeploy/populated-upgrade.sh` — PASS — all migrations executed, legacy Todo rows and head verified, final RPC signatures and isolation verified.
- 2026-11-27 — Focused Vitest run — RED — four assertions reproduced the two restore behaviors and two guard omissions.

- 2026-11-27 — Superseded in-place prototype — PostgreSQL GREEN — 90 checks. The driver correction discarded those SQL edits. The original chain still loses pre-journal history.
- 2026-11-27 — Focused Vitest — GREEN — 178 tests across eight files after the legacy V1 fixture used the PostgREST response shape.
- 2026-11-27 — `npm run supabase:schema:validate` and `npm run web:hygiene` — PASS.

- 2026-11-27 — Restored original chain — RED — `forward-sql-red.log` reproduces the Scope 10 publication rejection, and `sql-history-red.log` captures the prior-history loss.
- 2026-11-27 — `npm run backup:provenance:qualify` — PASS — existing journaled history, provenance fences and obsolete RPC expectations.

- 2026-11-27 — Local PostgreSQL forward qualification — GREEN — 92 checks, covering publication of the same previously rejected bytes and unchanged private RPC ACLs.
- 2026-11-27 — Populated ordered qualification — PASS — all 24 migrations executed and retained the active recovery head and predecessor Todo rows.

- 2026-11-27 — `npm run typecheck`, `npm run lint`, and `TZ=Asia/Manila npm test -- --maxWorkers=4` — PASS — 5,578 tests passed, two skipped. Moved a scratch reproduction out of ESLint's source glob and reran the affected gates.

## Changed Files / Areas

- `.agent/execplans/migration-predeploy-2026-11-27.md` records audit progress.
- `docs/audit/migration-predeploy-2026-11-27.md` records evidence and owner decisions.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, the brief, and this plan.
2. Inspect Git changes, run `npm run agent:resume -- --plan .agent/execplans/migration-predeploy-2026-11-27.md`, and reconcile QA evidence.
3. Continue at the checkpoint's exact next action.

## Outcomes & Retrospective

- Status: Completed.
- Summary: The audit verified three local defect groups and documented confirmed findings needing owner decisions. The only SQL change is an additive forward migration. Existing SQL files match `origin/main`.
- Follow-up: The report records the deployment sequence, prior-snapshot preservation decision, client cutoff, mutable saved-meal index policy, and account-erasure procedure.
