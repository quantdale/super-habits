# ExecPlan: Account Recovery Dist-Sync Closure Audit Remediation

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close two post-audit gaps left after the original account-recovery dist-sync determinism closure: (1) production-shaped `select=user_id` HEAD footprint probes in the shared E2E Supabase boundary cannot currently represent configured non-zero remote state, and (2) the prior durable closure record/checklist does not match its own required QA/final-SHA evidence.

Observable success is both behavioral and procedural. The deterministic boundary must prove that an empty temporary account may be replaced during valid imported-owner recovery while a temporary account with remote backup data is blocked, using the same owner-scoped count semantics production executes. The repository must finish with task/plan evidence, Git state, and exact-final-SHA GitHub Actions all agreeing.

## Context

- Repository: `quantdale/super-habits`, Expo/React Native, offline-first SQLite with owner-scoped Supabase backup.
- Audit-time GitHub `main`: `684dae9f79d3f5fc68f3b2e98722246885e4c6fa`; only remote `main` was visible.
- Prior implementation commit: `8b1a1e382013e217a40d28bf9b4e4d0da7486c6a`.
- Verified GitHub Actions run for `8b1a1e3...`: `32108157251`; `quality` success, `e2e` success, dist-sync step success, nightly skipped.
- The prior implementation correctly centralized the complete 15-endpoint backup REST surface in `e2e/helpers/accountBackupEntities.ts` and added an exact drift guard against `BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES`.
- `e2e/helpers/accountSupabaseMock.ts` currently handles `select === 'user_id'` before generic HEAD behavior and hardcodes `content-range: 0-0/0`. Therefore configured `BackupEntityMockState.count` cannot affect the exact request shape used by `AccountCoordinator.getRemoteFingerprint()`.
- The prior normative spec requires a non-empty temporary account footprint to report remote data and block replacement.
- Prior `tasks.md` marks item 2.5 complete even though the helper cannot satisfy that production-shape case, and leaves multiple full-QA / exact-SHA tasks unchecked while the prior ExecPlan marks the corresponding groups complete.
- The prior ExecPlan describes `8b1a1e3...` as the final SHA, but current `main` later advanced to `684dae9...` to mark the plan completed.
- CI workflow runs on every push; final-SHA verification must therefore apply to the final completion commit itself.

Authoritative task artifacts:

- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/proposal.md`
- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/design.md`
- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/specs/account-recovery-ci/spec.md`
- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/tasks.md`
- this ExecPlan

Historical artifacts to inspect/reconcile, not use as active state:

- `openspec/changes/fix-account-recovery-dist-sync-determinism/`
- `.agent/execplans/account-recovery-dist-sync-determinism.md`

## Scope

1. Freshly reconcile to latest `origin/main` and validate this OpenSpec/ExecPlan handoff.
2. Reproduce the missed non-zero footprint behavior with a focused failing test.
3. Make `select=user_id` HEAD probes honor deterministic non-zero count state.
4. Make count configuration owner-scoped so T's footprint cannot leak to A/B.
5. Preserve full backup-scope drift protection, reads, POST capture, and strict unknown endpoints.
6. Add a real dist-sync negative safety journey using temporary account T remote `weekly_reviews` state.
7. Preserve all existing account/recovery journeys and production fail-closed semantics.
8. Reconcile the prior closure task checklist and historical ExecPlan honestly.
9. Execute the previously unchecked full-QA gates and the focused/broad current gates.
10. Commit/push main-only and obtain green GitHub Actions on the exact final completion SHA.

## Non-Goals

- No new product feature.
- No weakening/changing production account ownership safety unless a separately reproduced product defect proves it necessary.
- No account merge, ownership transfer, generic populated-device switching, RLS change, Supabase migration, backup schema change, portable format change, or auth-provider change.
- No timeout inflation, retries, skip/fixme/quarantine, or weakened assertions as a root solution.
- No permissive catch-all Supabase REST mock.
- No force push and no persistent temporary remote development branch.

## Current Checkpoint

- Current milestone: SPEC_READY_FOR_FRESH_SESSION_REMEDIATION
- Completed: Independent GitHub audit verified current main/branch state, inspected the prior implementation diff and shared helper, verified green run `32108157251` on `8b1a1e3...`, proved the configured-nonzero footprint contract is not actually implemented for `select=user_id`, identified the old tasks/ExecPlan evidence mismatch, and authored this remediation OpenSpec package.
- In progress: Source implementation has not begun; the fresh execution session must first fetch/prune latest `origin/main`, validate the handoff, and reproduce the helper defect with a focused failing test.
- Important modified files: `openspec/changes/fix-account-recovery-dist-sync-closure-audit/`
- Last successful validation: GitHub Actions run `32108157251` proves the prior `8b1a1e3...` source tree passed `quality` and `e2e` including dist-sync; independent source inspection on current main proves `select=user_id` still hardcodes zero and prior durable closure records disagree with their checklist/final-head narrative.
- Current failures: Shared account Supabase mock cannot model non-zero production-shaped footprint counts; prior closure checklist/ExecPlan completion evidence is internally inconsistent and must be reconciled.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Fetch/prune latest `origin/main`, read all required repository guidance and this change, run OpenSpec/ExecPlan validators, then add a focused failing helper test proving a configured non-zero count is ignored by `HEAD ...?select=user_id&user_id=eq.<uid>` before implementing the owner-scoped count fix.
- Remaining definition of done: All normative audit-remediation requirements implemented; helper and negative journey prove both empty/non-empty safety semantics; prior durable records reconciled; all named missing and current QA gates run/recorded; clean main-only Git state; exact final completion SHA has GitHub Actions `quality` and `e2e` PASS including dist-sync; no subsequent bookkeeping commit changes that accepted SHA.

## Progress

- [x] 0. Independent post-closure GitHub/source audit performed.
- [x] 1. Non-zero production-shape footprint modeling defect identified.
- [x] 2. Durable tasks/ExecPlan/final-SHA narrative mismatch identified.
- [x] 3. Remediation proposal/design/spec/tasks/prompt/ExecPlan authored.
- [ ] 4. Fresh session reconciles latest `origin/main` and validates artifacts.
- [ ] 5. Focused failing test reproduces configured-nonzero footprint defect.
- [ ] 6. Owner-scoped production-shape count modeling implemented.
- [ ] 7. Focused helper/drift test matrix fully green.
- [ ] 8. Dist-sync temporary-account-remote-data negative journey implemented and green.
- [ ] 9. Existing account/portable matching + wrong-account journeys remain green.
- [ ] 10. Production account/backup/portable regressions green; no safety weakening.
- [ ] 11. Prior closure task checklist + ExecPlan reconciled honestly.
- [ ] 12. Previously unchecked full-QA gates executed/reconciled.
- [ ] 13. Broad repository validation complete.
- [ ] 14. Coherent work committed/pushed to main; local/remote state clean/main-only.
- [ ] 15. Final completion commit created with this plan/tasks complete.
- [ ] 16. Exact final completion SHA GitHub Actions `quality` + `e2e` green; final report records SHA/run without another commit.

## Surprises & Discoveries

- The original 404/full-scope failure was genuinely fixed, but the abstraction introduced to fix it encoded an always-empty footprint special case. This made the happy-path journeys green while leaving the normative non-empty safety branch untestable through the same production request shape.
- The exact drift guard protects entity-name completeness but not behavioral completeness. Contract-aware helpers need state-semantics tests in addition to list-equality tests.
- The prior task checklist itself exposed the process mismatch: QA/final-SHA items remained unchecked while the ExecPlan summarized their groups as complete.
- CI runs on every push, including docs-only completion commits. Final run evidence belongs in the external final report; otherwise writing the run ID into Git after green creates a new unverified SHA and an infinite bookkeeping loop.

Add new implementation discoveries here only when repository/test evidence changes the approach.

## Decision Log

- 2026-08-19 — Create a new OpenSpec remediation rather than silently editing the historical completed plan back to ACTIVE. This keeps one unambiguous current task while preserving the audit trail.
- 2026-08-19 — Expected fix is test-boundary-only. Production Account Coordinator already has the desired fail-closed behavior.
- 2026-08-19 — Require owner-scoped count state, not merely a global per-entity count, because the temporary owner and recovered source owner coexist in the same deterministic journey.
- 2026-08-19 — Prefer `weekly_reviews` for the negative remote-footprint journey to prove newer backup entities participate in account replacement safety.
- 2026-08-19 — Execute the previously unchecked QA commands rather than treating the checklist mismatch as cosmetic.
- 2026-08-19 — Final report, not a post-green Git commit, records the accepted final SHA/run ID.

## Validation Ledger

Authoring/audit evidence:

- GitHub `main` audit: `684dae9f79d3f5fc68f3b2e98722246885e4c6fa`.
- Remote branch audit: only `main` visible.
- Compare `a82bbe4...` -> `684dae9...`: two commits; shared helpers/drift test/journey refactor plus plan completion/reconciliation.
- GitHub Actions run `32108157251` for implementation SHA `8b1a1e382013e217a40d28bf9b4e4d0da7486c6a`: `quality` PASS, `e2e` PASS, remote-boundary dist-sync step PASS.
- Source audit: `accountBackupEntities.ts` contains all 13 table entities plus two synthetics and drift test compares exact production constants.
- Source audit: `accountSupabaseMock.ts` `select=user_id` branch returns `content-range: 0-0/0` unconditionally before generic HEAD handling.
- Spec audit: prior normative `Non-empty temporary account footprint` scenario requires configured nonzero remote data to block account switch.
- Checklist audit: prior task 2.5 is checked while nonzero production-shape behavior is absent; several required QA/exact-SHA items remain unchecked while prior ExecPlan marks their groups complete.

Required implementation evidence is enumerated in `tasks.md`; record command + concise result here as it runs.

## Changed Files / Areas

Specification authoring:

- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/proposal.md`
- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/design.md`
- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/specs/account-recovery-ci/spec.md`
- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/tasks.md`
- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/README.md`
- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/IMPLEMENTATION_PROMPT.md`
- `openspec/changes/fix-account-recovery-dist-sync-closure-audit/execplan.md`

Expected implementation/reconciliation areas:

- `e2e/helpers/accountSupabaseMock.ts`
- `tests/accountSupabaseMock.drift.test.ts` or a dedicated helper test
- `e2e/journeys/portable-owner-recovery.spec.ts`
- `openspec/changes/fix-account-recovery-dist-sync-determinism/tasks.md`
- `.agent/execplans/account-recovery-dist-sync-determinism.md`

Production account code is not expected to change.

## Recovery / Resume Instructions

1. Read `AGENTS.md` completely enough to apply task-specific startup rules.
2. Read `.agent/PLANS.md`.
3. Read this ExecPlan completely.
4. Read this change's proposal/design/spec/tasks/README.
5. Read the prior closure spec/tasks/ExecPlan and the current helper/drift/journey source.
6. `git fetch --prune`; inspect `git status --short`, `git diff --stat`, `git diff --name-only`, recent commits, and actual `origin/main` SHA.
7. Reconcile this checkpoint if Git moved.
8. Run `npm run agent:resume -- --plan openspec/changes/fix-account-recovery-dist-sync-closure-audit/execplan.md`.
9. Run OpenSpec and ExecPlan validators.
10. Continue from `Exact next action`; do not jump directly to broad QA before reproducing the focused defect.

## Outcomes & Retrospective

Active. No completion outcome is claimed. The remediation is accepted only after the exact final completion SHA is green in GitHub Actions and the final report records that external evidence without creating another SHA.
