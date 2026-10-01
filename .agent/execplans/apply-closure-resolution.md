# ExecPlan: Apply-closure resolution (land, reconcile, finish the seven-change wave)

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Land the already-validated seven-change OpenSpec apply wave (117 changed paths sitting
uncommitted on `main` at `c1bc380`), reconcile the one unreconciled cross-change conflict
(the fourth Supabase migration versus `final-certification-closure`'s three-migration
production contract), attempt the deferred native device leg that still blocks change 6's
tasks 5.3/5.4, close the four remaining evidence/reporting gaps, and re-run the full
validation matrix. Outcome: `HEAD` advanced past `c1bc380` with a clean tree, a
self-consistent OpenSpec board, honestly classified residuals, and a production statement
proving no production object was touched.

## Context

- Repo `D:\Documents\tryPython\superhabits`, branch `main`, starting HEAD
  `c1bc380ce330cda1e089fd79b49a12029defbb72` (== `origin/main`).
- The apply session is complete in content but uncommitted: 88 modified tracked files and
  38 untracked entries; 117 paths excluding `openspec/changes/*` and `HANDOFF.md`.
- Pinned Node `v22.23.2` at `/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64`;
  ambient `v24.3.0` must never run an integration/E2E gate.
- `npm run build:e2e` refuses to run while `EXPO_PUBLIC_SUPABASE_URL` /
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` are exported (hermetic guard). Unset before any build,
  E2E, or native lane.
- Host is memory-loaded; use `--maxWorkers=4` (unit) and `--maxWorkers=2` (integration).
- Never force-push, never rewrite history, never touch `stash@{0}`
  (`pre-recovery-local-changes`), never delete `.tmp-ios36423379932/`, never kill a
  foreign process, never `npm audit fix`.
- iOS is deferred by the owner: `.maestro/` must stay byte-identical to `HEAD`.
- No production mutation: Supabase inspection is read-only.

## Scope

- PHASE A: commit the 117-path wave as seven logical, individually-green commits.
- PHASE B: reconcile the fourth Supabase migration with `final-certification-closure`
  (spec, approval packet, ExecPlan), correct its superseded J8 evidence status, record the
  proven-absent production recovery point.
- PHASE C: native device leg for change 6 tasks 5.3/5.4, or an exact `ENVIRONMENT` record.
- PHASE D: restore-prompt runtime evidence (`e2e:sync`), Playwright count correction,
  distinct-owner probe sampling bound, gap-15 label check.
- PHASE E: full validation matrix with exact numbers and run identities.
- PHASE F: evidence-dense report + residual table.

## Non-Goals

- No archiving of any OpenSpec change; `external-blocker-closure` stays unarchived.
- No re-derivation of the apply work, no rewriting completed tasks.
- No modification of the fourth migration SQL, no production DDL/DDL grant execution.
- No threshold, ceiling, checksum, assertion, or quarantine weakening.
- No iOS work: no `.maestro/` edit, no iOS workflow rerun.

## Current Checkpoint

- Current milestone: PHASES A-F complete. All seven wave commits landed, each verified
  typecheck- and lint-clean in its own worktree; Phase B reconciliation committed; the native
  device leg executed on the current source; the full validation matrix re-run.
- Completed:
  - PHASE A: commits `194c626`, `8bb3fdc`, `af29d43`, `9ba91a7`, `f5de4bb`, `b899a87`, `68db684`
    (117 paths), plus `550513d` (Phase B record) and `1e40ce7` (this plan + the AGENTS.md
    environment constraints). Each of the seven wave commits passed `npx tsc --noEmit` and
    `npx eslint . --max-warnings 0` in its own worktree (log `/tmp/percommit-verify.log`).
  - PHASE B: dry-run contract moved to four migrations with the fourth last and justified;
    approval packet updated in §0/§0.1/§2/§3/§4/§5/§6/§8; the proven-absent recovery point
    recorded from a direct read-only `supabase backups list --project-ref
kruubbynsmxzxfdunaal` (`pitr_enabled: false`, `backups: []`, `physical_backup_data: {}`);
    task 2.2 closed as an explicit `FAIL`; J8 status corrected to CLOSED-ENVIRONMENT with every
    number preserved.
  - PHASE C: the orphaned hung `emulator-5554` was reclaimed by explicit decision; the AVD was
    booted from its saved snapshot (≈50 s to `sys.boot_completed=1`, API 36 / x86_64); the
    device leg ran from a clean detached worktree of `68db684` (the in-tree run is refused by
    `requireCleanGitTree`). Provisioning green; smoke 1/2 (`command-center-v2` red, `TEST_BUG`,
    frozen-`.maestro/` fix); persistence 11/11; lifecycle 6/6. Artifacts preserved under
    `simulation-output/native/apply-closure-2026-10-01/`.
  - PHASE D: `build:sync` + `e2e:sync` run (44 passed / 1 failed / 7 skipped; the failure and
    every skip are the documented `dummy.supabase.co` NXDOMAIN host gap); the Playwright count
    corrected to "334 → 336" in all three places it was recorded; the distinct-owner probe's
    bound stated in the spec and design; gap 15's numbers verified byte-identical to `HEAD`.
  - PHASE E: `typecheck` 0, `eslint` 0/0, unit 169/2052, integration 80 files (397 passed + 2
    skipped), `qa:fast` PASS on re-run (one host-load flake recorded), `supabase:schema:validate`
    PASS (16 migrations), `openspec:validate --all` 68/68, `agent:plan:validate:all` 103 PASS / 0
    FAIL, `build:e2e` hermetic with 0 Supabase hosts in `dist/`, `playwright --list` 336/32 with
    every journey step count diffed against `HEAD` (102 → 104 journey steps, all of it the
    fat-fingers journey's two new steps).
- In progress: none.
- Important modified files: the nine commits above; `AGENTS.md`; this plan.
- Last successful validation: the Phase E matrix above (2026-10-01, pinned Node v22.23.2).
- Current failures: none in tracked code. `npm run qa:fast` flaked once on
  `tests/restore.coordinator.test.ts` (`beforeAll` hook timed out in 10000ms under full-suite
  parallelism); the file passes standalone in 1.2s and `qa:fast` passed on re-run, so it is a
  host-load `FLAKY_TEST` in a file the wave did not touch. The Android smoke lane's
  `command-center-v2` failure is a recorded `TEST_BUG` with a frozen-`.maestro/` fix.
- Relevant quarantines: none added or changed by this campaign. The 13 gate files / 14
  structured register entries stay exactly as change 5 left them (`quarantine-register-parity`
  OK, none stale); no ceiling, threshold, checksum, or assertion was weakened.
- Blockers: none.
- Exact next action: None — campaign complete; the only remaining work is the recorded
  owner-gated residual (the `.maestro/` flow edit) and the deferred iOS lane.
- Remaining definition of done: complete. §7.4 resolves to "24/26 with a precise blocker":
  task 5.3 is unchecked because the smoke lane is 1/2, with the classification, evidence, and
  exact resume action recorded in the change's ExecPlan.

## Progress

- [x] Reconnaissance and ExecPlan creation
- [x] PHASE A — 7 commits, each verified green in isolation (tsc + eslint, 7/7)
- [x] PHASE A.1 — fast-forward push to `origin/main`
- [x] PHASE B — migration reconciliation + J8 status correction (commit `550513d`)
- [x] PHASE C — native device leg executed on `68db684` from a clean worktree
- [x] PHASE D — runtime evidence + minor corrections
- [x] PHASE E — final validation matrix
- [x] PHASE F — report

## Surprises & Discoveries

- The AVD was never the blocker: cold boots never finish on this host, but the saved
  `default_boot` snapshot boots in ~50 s.
- `requireCleanGitTree` requires an EMPTY porcelain including untracked files, so the
  preserved iOS extract and the active `openspec/changes/*` directories block the native
  certification path even after everything is committed.
- The native leg found a real cross-change conflict: the Android smoke flow taps a mode
  chip that this wave's own render boundary removes in an ordinary build.
- `npm run qa:fast` flaked once on an untouched file (`tests/restore.coordinator.test.ts`,
  `beforeAll` hook timeout) and passed on re-run.

## Decision Log

- Commit the wave as seven logical commits in dependency order and verify each commit in
  its own worktree rather than trusting the cumulative tree.
- `docs/testing/known-gaps.md` ships in commit 1 because the guidance change owns the
  file's register rewrite; the change-5 guard that consumes its `**Gate site:**` entries
  lands in its own commit.
- Do not modify the fourth migration. Fix the record: four migrations, the fourth last and
  justified, plus the un-authorized-grant and proven-absent-recovery facts.
- Correct the J8 status without moving a number, and correct the Playwright count wherever
  it is recorded.
- Reclaim the orphaned hung emulator by exact PID after recording its ownership and state,
  then boot the AVD from its saved snapshot.
- Run the native certification from a clean detached worktree of the same commit rather
  than deleting preserved evidence or changing the repository's ignore policy.
- Do NOT edit `.maestro/` (owner freeze) or the D14/J8/floor assertions; record the
  smoke failure as a classified residual instead.
- Move `HANDOFF.md` into the change it documents rather than leaving a stray root file.

## Validation Ledger

| Date       | Command                                                                            | Outcome                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | 7 per-commit worktrees: `npx tsc --noEmit` + `npx eslint . --max-warnings 0`       | PASS 7/7 — every wave commit clean in isolation (log `/tmp/percommit-verify.log`)                                                                                                 |
| 2026-10-01 | `npm run typecheck`                                                                | PASS — 0 errors                                                                                                                                                                   |
| 2026-10-01 | `npx eslint . --max-warnings 0`                                                    | PASS — 0 errors, 0 warnings                                                                                                                                                       |
| 2026-10-01 | `npx vitest run --project unit --maxWorkers=4`                                     | PASS — 169 files / 2052 tests                                                                                                                                                     |
| 2026-10-01 | `npx vitest run --project integration --maxWorkers=2`                              | PASS — 80 files (397 passed, 2 skipped pre-existing) + 1 skipped file                                                                                                             |
| 2026-10-01 | `npm run qa:fast` (first attempt)                                                  | FAIL — `tests/restore.coordinator.test.ts` `beforeAll` hook timed out in 10000ms under full-suite parallelism; 168/169 files, 2034 passed / 18 skipped                            |
| 2026-10-01 | `npx vitest run tests/restore.coordinator.test.ts --project unit`                  | PASS — 18/18 in 1.2 s; the file the wave did not touch, so the qa:fast miss is a host-load `FLAKY_TEST`                                                                           |
| 2026-10-01 | `npm run qa:fast` (re-run)                                                         | PASS — 169 files / 2052 tests; journey-label parity OK; quarantine-register parity OK (13 gate files / 14 entries, none stale); release-profile guard OK                          |
| 2026-10-01 | `npm run supabase:schema:validate`                                                 | PASS — 16 migration files; 4 owner-scoped sync tables; 14 owner-scoped backup tables; scope-V5 + Gym V2 V6/7 closure                                                              |
| 2026-10-01 | `npm run openspec:validate --all`                                                  | PASS — 68 passed / 0 failed                                                                                                                                                       |
| 2026-10-01 | `npm run agent:plan:validate:all`                                                  | PASS — 103 plans, 0 FAIL                                                                                                                                                          |
| 2026-10-01 | `npm run build:e2e` + `grep -rl 'supabase.co\|EXPO_PUBLIC_SUPABASE' dist/`         | PASS — hermetic export, 0 Supabase hosts in `dist/` (independent grep also 0)                                                                                                     |
| 2026-10-01 | `npx playwright test --list`                                                       | 336 tests / 32 files; `c1bc380` measured 334 / 32 in a worktree; every `e2e/journeys/*.spec.ts` step count diffed (102 → 104, all of it the fat-fingers journey's two new steps)  |
| 2026-10-01 | `npm run build:sync` + `npm run e2e:sync`                                          | 44 passed / 1 failed / 7 skipped (4.3 m) — the failure and every skip are the documented `dummy.supabase.co` NXDOMAIN host gap (verified: `nslookup` non-existent, `curl` exit 6) |
| 2026-10-01 | Native leg on `68db684` (clean worktree): provision, smoke, persistence, lifecycle | Provision PASS; smoke 1/2; persistence 11/11; lifecycle 6/6 — see `harden-native-evidence-and-release-posture/execplan.md`                                                        |
| 2026-10-01 | `grep -o 'if (version < [0-9]*)' core/db/client.ts`                                | Local schema still **25** — no new local migration                                                                                                                                |
| 2026-10-01 | `git diff c1bc380 HEAD -- e2e/journeys/three-months-in.spec.ts .maestro`           | Empty — the J8 800 ms ceiling, 15 % floor, D14 500 ms diary ceiling, and every `.maestro/` flow are byte-identical to `HEAD`                                                      |
| 2026-10-01 | `git status --short`                                                               | Only `.tmp-ios36423379932/` and the seven active `openspec/changes/*` directories                                                                                                 |
| ---------- | -------                                                                            | -------                                                                                                                                                                           |
| (live log) | —                                                                                  | —                                                                                                                                                                                 |

## Changed Files / Areas

- All 117 paths from the apply wave (see `git status --short`).
- `openspec/changes/final-certification-closure/` (spec, production approval packet,
  execplan) — Phase B record correction.
- `.agent/execplans/apply-closure-resolution.md` — this plan.
- AGENTS.md / docs/testing/known-gaps.md — durable ambient-`EXPO_PUBLIC_*` constraint.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, `docs/PROJECT_STRUCTURE_MAP.md`.
2. Read this plan completely.
3. `git status --short`, `git log --oneline -10`, `git diff --stat`.
4. `npm run agent:resume -- --plan .agent/execplans/apply-closure-resolution.md`.
5. Resume from `Exact next action`.

## Outcomes & Retrospective

**Outcome: COMPLETE for the land/reconcile/finish objective; one residual is owner-gated.**

- The 117-path apply wave is committed as seven independently-green commits and HEAD is at
  `1e40ce7` (nine commits past `c1bc380`); the tree carries only the preserved iOS extract and the
  active `openspec/changes/*` directories.
- `final-certification-closure` now names four migrations, records the proven-absent recovery
  point, and reports J8 as closed with the `ENVIRONMENT` residual preserved and every number
  intact.
- The native device leg was executed on the current source and produced real evidence:
  provisioning green, persistence 11/11, lifecycle 6/6, smoke 1/2. Task 5.3 stays unchecked on
  the one red flow (`command-center-v2`, `TEST_BUG`, fix frozen in `.maestro/`).
- The ambient-`EXPO_PUBLIC_*` build refusal and the clean-tree certification precondition are
  recorded in `AGENTS.md` and in the change-6 ExecPlan.
- Lessons: (1) "commit your work" is not sufficient for the native certification gate — untracked
  evidence counts, and a clean checkout of the same commit is the honest way through; (2) an
  emulator that "will not boot" may just be a cold boot on a memory-starved host — try the
  snapshot path before concluding the device leg is impossible; (3) a lane that is only opt-in
  (the sync lane) can hide a real cross-change conflict for a long time, and running it is worth
  the wall-clock cost even when its authoritative green lives on CI.
- Follow-ups left in place, each with WHY / CLASSIFICATION / WHAT IS REQUIRED / EXACT RESUME
  ACTION in the owning change's ExecPlan: the `.maestro/flows/command-center-v2.yaml` step edit
  (owner freeze), the CI sync lane for the restore-prompt runtime evidence (host DNS), the
  production recovery point and amended four-migration grant (owner/infrastructure), and the
  deferred iOS lane.
