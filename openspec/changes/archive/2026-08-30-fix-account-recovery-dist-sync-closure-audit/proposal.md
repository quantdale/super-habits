# Proposal: Account Recovery Dist-Sync Closure Audit Remediation

## Summary

A post-closure audit of `fix-account-recovery-dist-sync-determinism` found that the original CI failure was fixed, but two parts of the persisted closure contract are still not actually satisfied.

First, the new shared `e2e/helpers/accountSupabaseMock.ts` recognizes the complete backup surface, but its `select=user_id` owner-footprint branch always returns `content-range: 0-0/0`. This ignores the helper's configured per-entity `count`, so the deterministic boundary cannot model the normative non-empty temporary-account footprint scenario. The old task `2.5` is checked even though the request shape used by `AccountCoordinator.getRemoteFingerprint()` cannot return a configured non-zero count.

Second, durable completion state is inconsistent. `.agent/execplans/account-recovery-dist-sync-determinism.md` calls `8b1a1e3...` the final SHA and marks the task completed using GitHub Actions run `32108157251`, while GitHub `main` later advanced to `684dae9...` solely to mark that plan completed. The old `tasks.md` also leaves multiple required full-QA and exact-SHA closure items unchecked while its ExecPlan claims `10.x`, `11.x`, and `12.x` are complete. Regardless of whether the docs-only head later received a green run, the persisted statement that `8b1a1e3...` is the final pushed SHA is false.

This remediation closes those gaps without changing production account ownership semantics.

## Goals

1. Make the shared account/recovery Supabase E2E boundary model owner-scoped non-zero footprint counts correctly for the exact `select=user_id` HEAD request used by production.
2. Add focused unit coverage proving configured non-zero footprint counts are honored.
3. Add a dist-sync E2E negative safety scenario proving a temporary anonymous account with remote data in any current backup entity blocks imported-owner recovery.
4. Prefer a recently added entity such as `weekly_reviews` in that negative scenario so the safety proof covers the full backup contract rather than only historical V1 tables.
5. Preserve strict unknown-endpoint behavior and all production fail-closed account semantics.
6. Reconcile the prior closure's ExecPlan and task checklist honestly with the audit findings and actual commands run.
7. Execute the previously unchecked repository QA gates rather than declaring them implicitly satisfied.
8. Finish on the true current `main` SHA with exact-SHA GitHub Actions `quality` and `e2e` green.

## Non-Goals

- No new user-facing feature.
- No production `AccountCoordinator` behavior change unless a real product defect is independently proven; the expected fix is test-boundary-only.
- No account merging, ownership transfer, or generic populated-device account switching.
- No RLS, Supabase migration, backup schema, portable format, or auth-provider change.
- No timeout inflation, retry increase, skip, fixme, quarantine, or weakened assertion as a substitute for correct deterministic modeling.
- No broad rewrite of the Playwright mock architecture beyond what is necessary to make owner-scoped footprint state explicit and reusable.

## Verified Audit Evidence

- GitHub `main` is `684dae9f79d3f5fc68f3b2e98722246885e4c6fa`; only remote `main` exists at audit time.
- Implementation commit `8b1a1e382013e217a40d28bf9b4e4d0da7486c6a` introduced the shared full-scope boundary and drift guard.
- GitHub Actions run `32108157251` for `8b1a1e3...` is green: `quality` success and `e2e` success, including the dist-sync remote-boundary step.
- `BACKUP_REST_ENTITIES` correctly matches 13 table-backed entities plus `user_backup_settings` and `backup_manifest`.
- `handleBackupRestRequest()` currently checks `select === 'user_id'` before generic `HEAD` handling and always returns zero for that branch, so configured `state.count` is unreachable for production footprint probes.
- The normative prior spec explicitly requires a configured non-zero temporary-account footprint to report remote data and block account switching.
- The prior `tasks.md` marks `2.5` complete despite the behavior above and leaves several full-QA / exact-SHA tasks unchecked.
- The prior ExecPlan marks all corresponding milestones complete and calls `8b1a1e3...` the final SHA even though `main` later advanced to `684dae9...`.

## Product/Safety Outcome

After this remediation, the deterministic E2E boundary must prove both sides of the account safety contract:

- empty remote footprint -> matching imported-owner recovery may proceed;
- non-empty remote footprint in any production backup entity -> temporary account replacement is blocked and local imported data remains untouched.

The repository must also have one honest, resumable completion story: task checklists, ExecPlan evidence, Git state, and exact final GitHub Actions status agree.

## Definition of Done

The change is done only when all of the following are true:

- configured non-zero `select=user_id` footprint counts are modeled correctly;
- focused helper tests cover zero, non-zero, owner-scoped behavior, synthetics, and strict unknown endpoints;
- a `journeys-sync` negative scenario proves remote data on the temporary account blocks imported-owner recovery without mutating/binding the imported dataset;
- the existing matching and wrong-account account/recovery journeys remain deterministic and green;
- production account fail-closed semantics and backup ownership gates are unchanged;
- the previously unchecked closure QA commands are actually executed and recorded, or a command is explicitly replaced only when the repository itself proves an equivalent wrapper already ran the identical gate;
- the old closure plan/checklist are reconciled to this audit without falsifying history;
- OpenSpec and ExecPlan validators pass;
- `npm run e2e:sync`, full main E2E, deterministic simulation, and applicable repository QA pass;
- final work is committed and pushed to `main` without force, working tree is clean, local `main == origin/main`, and only remote `main` exists;
- the exact final pushed SHA—not merely its parent—has GitHub Actions `quality = PASS` and `e2e = PASS` including dist-sync.
