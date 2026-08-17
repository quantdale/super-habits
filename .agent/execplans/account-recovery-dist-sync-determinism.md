# ExecPlan: Account Recovery Dist-Sync Determinism Closure

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Restore a genuinely green `main` by fixing the deterministic Supabase account/recovery E2E boundary that currently lags the complete production backup contract.

The current product account logic correctly probes every `BACKUP_ENTITIES` and `BACKUP_SYNTHETIC_ENTITIES` record before allowing safety-critical ownership transitions. Two `journeys-sync` mocks still recognize only four historical V1 remote tables, causing valid production probes to receive test-generated 404 responses. Production then correctly fails closed, and account protection/recovery UI states never reach their expected deterministic outcomes.

The user outcome is a repository where Recoverable Account V1 and Portable imported-owner recovery are accurately exercised against the current backup surface, future backup-scope drift is automatically detected, and the exact final `main` SHA has fully green GitHub Actions.

## Context

- Repository: `quantdale/super-habits`.
- Reviewed head before this closure specification: `36f01f881248252d1b675714d9c963eafe4f1303` on `main`, remote main-only.
- Final GitHub Actions run for that SHA: `32024054019` / CI #412.
- `quality` passed.
- Full main E2E passed.
- Full deterministic scenario library passed.
- Dist-sync remote-boundary journey lane failed.
- Failing flows are in `e2e/journeys/portable-owner-recovery.spec.ts` and `e2e/journeys/recoverable-account-v1.spec.ts`.
- Both journey-local Supabase mocks currently recognize only `todos`, `habits`, `calorie_entries`, and `workout_routines` under `/rest/v1/`.
- Production `core/auth/accountCoordinator.ts` derives its remote backup footprint from `BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES` and uses exact owner-scoped count/head queries.
- Current `BACKUP_ENTITIES` contains 13 table-backed entities including `weekly_reviews`.
- Current synthetic entities are `user_backup_settings` and `backup_manifest`.
- The mismatch is a deterministic test-contract defect. It is not accepted as a timing flake.
- `.agent/execplans/weekly-review-planning-v1.md` currently records exact-final-SHA CI as green despite run `32024054019` being red; this closure must reconcile that record honestly.

Before source edits, read:

- `AGENTS.md`
- `.agent/PLANS.md`
- `openspec/changes/fix-account-recovery-dist-sync-determinism/README.md`
- this change's proposal, design, tasks, and normative spec
- completed account/portable closure specs and plans relevant to ownership invariants
- the affected journey files
- `core/auth/accountCoordinator.ts`
- `core/auth/account.domain.ts`
- `core/backup/backup.types.ts`

## Scope

1. Reproduce the exact current `journeys-sync` account/recovery failure.
2. Inspect the actual Supabase JS request shape for remote-footprint probes.
3. Add one shared, typed, backup-aware deterministic REST boundary for account/recovery E2E.
4. Derive recognized backup entities from production constants when feasible; otherwise enforce exact drift detection.
5. Model empty and configured non-empty owner-scoped count/head responses correctly.
6. Preserve strict failure for unknown/unmodeled REST endpoints.
7. Preserve journey-specific auth identities, OTP behavior, restore rows, and POST ownership capture.
8. Refactor Recoverable Account V1 and Portable owner-recovery journeys to use the shared boundary.
9. Prove all current table-backed and synthetic backup entities are recognized, including `weekly_reviews`.
10. Prove the affected flows pass deterministically without relying on retry recovery.
11. Preserve production fail-closed account safety and all owner/fingerprint invariants.
12. Reconcile the Weekly Review ExecPlan's inaccurate exact-final-SHA green claim.
13. Run complete focused and broad repository QA.
14. Commit/push main-only and verify exact-final-SHA GitHub Actions fully green.

## Non-Goals

- No new product feature.
- No weakening of Account Coordinator fail-closed remote evidence behavior.
- No account merging or generic populated-device account switching.
- No RLS or production Supabase policy change.
- No production data mutation.
- No portable file-format change.
- No reduction of backup scope.
- No timeout inflation, retry increase, skip, fixme, quarantine, or weakened assertion as the root solution.
- No catch-all Supabase mock that silently accepts arbitrary unknown tables.
- No force push or temporary remote development branch.

## Current Checkpoint

- Current milestone: SPEC_READY_AND_RED_CI_REPRO_REQUIRED
- Completed: Independent GitHub review verified the exact final workflow failure, isolated the stale deterministic Supabase boundary as the root cause, and authored the repository-persisted closure specification package.
- In progress: Source implementation has not begun; the fresh execution session must reproduce the remote-boundary failure before changing the shared test architecture.
- Important modified files: `openspec/changes/fix-account-recovery-dist-sync-determinism/`, `.agent/execplans/account-recovery-dist-sync-determinism.md`
- Last successful validation: GitHub run `32024054019` proves quality, full main E2E, and deterministic scenarios pass while the dist-sync remote-boundary step fails; repository-side source inspection confirmed the production/test backup-scope mismatch.
- Current failures: Exact final `main` SHA `36f01f881248252d1b675714d9c963eafe4f1303` is red because account/recovery dist-sync mocks return unexpected 404 responses for valid backup-scope probes.
- Relevant quarantines: None.
- Blockers: None; the defect is reproducible from repository code and CI evidence.
- Condition required to unblock: Not blocked; no external condition is required.
- Exact resume action after unblock: Not blocked; execute the Exact next action below.
- Exact next action: Fetch latest `origin/main`, validate this persisted OpenSpec and ExecPlan, reproduce the failing account/recovery remote-boundary journey, then replace duplicated historical mock table matching with one complete backup-aware boundary plus drift protection.
- Remaining definition of done: Fully green focused account/recovery runs and `e2e:sync`, preserved production ownership safety, honest Weekly Review plan reconciliation, complete repository QA, clean main-only Git state, and exact-final-SHA GitHub `quality` plus `e2e` PASS.

## Progress

- [x] 0. Independent exact-SHA GitHub review performed.
- [x] 1. Root cause isolated to stale duplicated account/recovery Supabase mocks.
- [x] 2. Closure proposal/design/tasks/spec/entry point authored.
- [x] 3. Versioned ACTIVE ExecPlan authored with exact red-CI evidence.
- [ ] 4. Fresh execution session reconciles latest `origin/main` and validates persisted artifacts.
- [ ] 5. Current dist-sync failure reproduced locally with request evidence.
- [ ] 6. Shared backup-aware deterministic Supabase E2E boundary implemented.
- [ ] 7. Complete backup-scope drift guard implemented.
- [ ] 8. Recoverable Account V1 journey migrated and deterministic.
- [ ] 9. Portable matching/wrong-account recovery journeys migrated and deterministic.
- [ ] 10. Production account/backup/portable regressions verified.
- [ ] 11. `build:sync` and `e2e:sync` fully green with zero failed account/recovery journeys.
- [ ] 12. Weekly Review ExecPlan reconciled with actual red final CI history.
- [ ] 13. Full repository QA, broad E2E, simulation, and validators green.
- [ ] 14. All work committed/pushed to main; local/remote state reconciled and clean.
- [ ] 15. Exact final SHA GitHub Actions `quality` PASS and `e2e` PASS.
- [ ] 16. This ExecPlan marked COMPLETED only after the final gate is satisfied.

## Surprises & Discoveries

- The failure labeled as three inherited "flakes" is structurally explained by a stale four-table REST matcher. The production coordinator now asks for the complete backup surface, so retries cannot correct missing endpoints.
- Weekly Review V1 itself expands the backup scope with `weekly_reviews`, demonstrating why duplicated copied table lists are unsafe.
- Production fail-closed behavior is functioning correctly: unavailable remote ownership evidence blocks unsafe transitions. The deterministic test harness is the component that must catch up.
- The two affected journeys duplicate very similar Supabase auth/REST mock logic, making a shared backup REST boundary both a correctness fix and a future drift-prevention measure.

Add implementation discoveries here as they are proven. Do not replace evidence with assumptions.

## Decision Log

- 2026-08-17 — Treat CI #412 as a real repository failure, not an acceptable pre-existing flake, because the project's completion contract requires exact-final-SHA green CI.
- 2026-08-17 — Fix the deterministic test boundary rather than production fail-closed account logic.
- 2026-08-17 — Prefer production-derived backup entity coverage. If direct imports are unsuitable in Playwright helpers, require a mechanical exact drift guard.
- 2026-08-17 — Keep unknown Supabase REST endpoints strict; shared mocks must model known contracts, not hide new dependencies.
- 2026-08-17 — Reconcile the Weekly Review plan's exact-SHA CI statement as part of closure rather than preserving inaccurate project history.

Record any architecture deviation and its repository evidence here.

## Validation Ledger

Authoring / pre-implementation evidence:

- GitHub branches: only `main` at reviewed head before spec publication.
- GitHub run `32024054019`: `quality` PASS; `e2e` FAIL.
- E2E job evidence: full main E2E PASS; deterministic scenario library PASS; dist-sync remote-boundary step FAIL.
- CI logs: affected account/recovery assertions fail before expected `Protected` / `Sign-in pending` states.
- Source inspection: affected journey mocks recognize only four historical REST tables; production coordinator probes `BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES`.

Required implementation validation:

- focused helper/drift tests: must PASS;
- affected account/recovery journeys: must PASS on first attempt and not rely on retries;
- account coordinator/domain suites: must PASS;
- portable ownership suites: must PASS;
- backup scope/backfill/restore suites: must PASS;
- `npm run typecheck`: PASS;
- `npm run lint`: PASS under repository warning policy;
- `npm test`: PASS;
- `npm run openspec:validate`: PASS;
- `npm run agent:plan:validate:all`: PASS;
- `npm run qa:impact:validate`: PASS;
- `npm run build:sync`: PASS;
- `npm run e2e:sync`: zero failed tests;
- `npm run build:web`: PASS;
- `npm run e2e:full`: PASS;
- `npm run qa:simulation -- --all --mode deterministic` or current equivalent: PASS;
- `npx expo-doctor`: record exact result;
- `git diff --check`: PASS;
- exact final GitHub Actions `quality`: PASS;
- exact final GitHub Actions `e2e`: PASS, including remote-boundary dist-sync step.

Do not mark this plan COMPLETED until final validation evidence is recorded here with exact SHA and GitHub run ID.

## Changed Files / Areas

Specification-authoring commit:

- `openspec/changes/fix-account-recovery-dist-sync-determinism/proposal.md`
- `openspec/changes/fix-account-recovery-dist-sync-determinism/design.md`
- `openspec/changes/fix-account-recovery-dist-sync-determinism/tasks.md`
- `openspec/changes/fix-account-recovery-dist-sync-determinism/README.md`
- `openspec/changes/fix-account-recovery-dist-sync-determinism/IMPLEMENTATION_PROMPT.md`
- `openspec/changes/fix-account-recovery-dist-sync-determinism/specs/account-recovery-ci/spec.md`
- `.agent/execplans/account-recovery-dist-sync-determinism.md`

Expected implementation areas to inspect/change as required:

- `e2e/helpers/`
- `e2e/journeys/recoverable-account-v1.spec.ts`
- `e2e/journeys/portable-owner-recovery.spec.ts`
- account/backup-focused tests under `tests/`
- `.agent/execplans/weekly-review-planning-v1.md`

If production source is modified, record the exact file and reason here; production semantics should not be weakened.

## Recovery / Resume Instructions

For a fresh session:

1. Fetch/prune `origin` and reconcile to latest `origin/main` without destructive reset over legitimate work.
2. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan, and every authoritative OpenSpec file in this change.
3. Run `npm run agent:resume -- --plan .agent/execplans/account-recovery-dist-sync-determinism.md` if available.
4. Inspect current GitHub/working-tree state and any commits newer than the reviewed starting head.
5. Validate OpenSpec and all versioned ExecPlans before source edits.
6. Reproduce the dist-sync failure and capture the exact unexpected endpoint/request shape.
7. Continue from the first unchecked Progress/Tasks item; update this plan before and after meaningful milestones.
8. Never bypass the exact-final-SHA CI gate.

If interrupted after implementation but before GitHub CI completion, leave Status ACTIVE and set Current Checkpoint to the exact pushed SHA/run state with a concrete next action.

## Outcomes & Retrospective

Implementation execution is pending. The desired outcome is a shared backup-contract-aware account/recovery E2E boundary, mechanical drift prevention, fully deterministic account protection/recovery tests, truthful Weekly Review project-state documentation, and an exact-final-SHA green `main`.

At completion, replace this section with the actual root fix, validation results, final SHA/run ID, and any remaining external-only limitations.
