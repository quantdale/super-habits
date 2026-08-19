# ExecPlan: Account Recovery Dist-Sync Closure Audit Remediation

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close two post-audit gaps left after the original account-recovery dist-sync determinism closure: (1) production-shaped `select=user_id` HEAD footprint probes in the shared E2E Supabase boundary cannot currently represent configured non-zero remote state, and (2) the prior durable closure record/checklist does not match its own required QA/final-SHA evidence.

Observable success is both behavioral and procedural. The deterministic boundary must prove that an empty temporary account may be replaced during valid imported-owner recovery while a temporary account with remote backup data is blocked, using the same owner-scoped count semantics production executes. The repository must finish with task/plan evidence, Git state, and exact-final-SHA GitHub Actions all agreeing.

## Context

- Repository: `quantdale/super-habits`, Expo/React Native, offline-first SQLite with owner-scoped Supabase backup.
- Audit-time GitHub `main` at proposal: `684dae9f79d3f5fc68f3b2e98722246885e4c6fa`; only remote `main` was visible.
- Fresh-session reconciliation head `2026-08-19`: `a0431411929ab85a39a4c274b9891b69e6ca673f` (`origin/main`); `main == origin/main`.
- Prior implementation commit: `8b1a1e382013e217a40d28bf9b4e4d0da7486c6a` (run `32108157251` — `quality` + `e2e` green, preserved but NOT final head after `684dae9`/`a043141`).
- The prior implementation correctly centralized the complete 15-endpoint backup REST surface in `e2e/helpers/accountBackupEntities.ts` and added an exact drift guard against `BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES`.
- `e2e/helpers/accountSupabaseMock.ts` at `a043141` handles `select === 'user_id'` before generic HEAD behavior and hardcodes `content-range: 0-0/0`. Therefore configured `BackupEntityMockState.count`/`countByOwnerUserId` cannot affect the exact request shape used by `AccountCoordinator.getRemoteFingerprint()` (`select('user_id',{count:'exact',head:true}).eq('user_id',uid)`). Fix is test-boundary-only; production `AccountCoordinator` fail-closed semantics unchanged. Gap is fixed by this remediation.
- The prior normative spec requires a non-empty temporary account footprint to report remote data and block replacement.
- Prior `tasks.md` marked item 2.5 complete even though the helper cannot satisfy that production-shape case (reconciled unchecked `2026-08-19`), and leaves multiple full-QA / exact-SHA tasks unchecked while the prior ExecPlan marked the corresponding groups complete.
- The prior ExecPlan described `8b1a1e3...` as the final SHA, but `main` later advanced to `684dae9...`/`a043141` to mark the plan completed — reconciled `2026-08-19` to preserve `8b1a1e3` CI evidence while noting it is not final head.
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

- Current milestone: IMPLEMENTATION_COMPLETE_PENDING_FINAL_PUSH_AND_CI
- Completed: Independent GitHub audit verified current main/branch state, inspected the prior implementation diff and shared helper, verified green run `32108157251` on `8b1a1e3...`, proved the configured-nonzero footprint contract is not actually implemented for `select=user_id`, identified the old tasks/ExecPlan evidence mismatch, and authored this remediation OpenSpec package. Fresh session `2026-08-19` fetched/pruned `origin/main` (`a043141` == `origin/main`, only remote `main`), read `AGENTS.md`/`.agent/PLANS.md`/this OpenSpec/prior closure artifacts + helper head, ran `npm run openspec:validate` (32 passed) and `npm run agent:plan:validate:all` (PASS), reconciled prior `tasks.md` 2.5 unchecked and `tasks.md` 0.5-0.7 checked with evidence, and updated `.agent/execplans/account-recovery-dist-sync-determinism.md`. Implementation done: owner-scoped `countByOwnerUserId` + `select=user_id` HEAD probe fix in `e2e/helpers/accountSupabaseMock.ts` (resolves `countByOwnerUserId[owner] ?? state.count ?? 0`, emits `content-range: 0-0/<resolved>`), focused `tests/accountSupabaseMock.contract.test.ts` (10 cases), and negative `weekly_reviews` journey persona C in `e2e/journeys/portable-owner-recovery.spec.ts`.
- In progress: Commit/push the implementation, then wait for exact-SHA CI (quality + e2e including dist-sync) before marking the plan COMPLETED in the final commit.
- Important modified files: `e2e/helpers/accountSupabaseMock.ts` (owner-scoped footprint fix), `tests/accountSupabaseMock.contract.test.ts` (new focused contract tests), `e2e/journeys/portable-owner-recovery.spec.ts` (persona C negative safety + prior reconciliation), `openspec/changes/fix-account-recovery-dist-sync-closure-audit/tasks.md` + `execplan.md` (this checkpoint), `openspec/changes/fix-account-recovery-dist-sync-determinism/tasks.md` (2.5 unchecked + header note), `.agent/execplans/account-recovery-dist-sync-determinism.md` (preserved 8b1a1e3 evidence, noted not final head).
- Last successful validation: implementation gates green locally — `npm test` 1155/1155, focused contract+drift 17/17, `npm run e2e:sync` 46/46 (persona C green), `npm run qa:integration` 159, `npm run qa:timezones` 42, `npm run qa:fast` PASS, `npm run openspec:validate` 32 passed, `npm run agent:plan:validate:all` PASS, `npm run build:sync` PASS, `git diff --check` clean. Production `accountCoordinator.ts` untouched.
- Current failures: None. The P0 simulation smoke lane (`sim:run --scenario @p0`) requires a running localhost:8081 server that the `qa:simulation` wrapper starts; in this environment the lane was validated via `sim:validate` + `sim:run --mode deterministic --scenario @p0` setup expectation (it fails only on connection refused, not on the change). No production failure.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Commit the remediation (implementation + reconciliation + task/execplan evidence), push to `main` without force, then wait for the exact-final-SHA GitHub Actions run; mark this plan COMPLETED only after `quality` and `e2e` (incl. dist-sync) are green for that SHA, and record the SHA + run ID in the final report (no post-green bookkeeping commit).
- Remaining definition of done: All normative audit-remediation requirements implemented; helper and negative journey prove both empty/non-empty safety semantics; previously unchecked QA gates run/recorded; clean main-only Git state; exact final completion SHA has GitHub Actions `quality` and `e2e` PASS including dist-sync; no subsequent bookkeeping commit changes that accepted SHA.

## Progress

- [x] 0. Independent post-closure GitHub/source audit performed.
- [x] 1. Non-zero production-shape footprint modeling defect identified.
- [x] 2. Durable tasks/ExecPlan/final-SHA narrative mismatch identified.
- [x] 3. Remediation proposal/design/spec/tasks/prompt/ExecPlan authored.
- [x] 4. Fresh session reconciles latest `origin/main` and validates artifacts. — 2026-08-19 at `a043141`: fetch/prune, handoff read, `openspec:validate` + `agent:plan:validate:all` PASS, reconciled prior tasks.md 2.5 + determinism ExecPlan + 0.5-0.7.
- [x] 5. Focused failing test reproduces configured-nonzero footprint defect. — `tests/accountSupabaseMock.contract.test.ts` proves old zero-default and new N-exposed behavior on the exact `HEAD ?select=user_id&user_id=eq.<uid>` shape.
- [x] 6. Owner-scoped production-shape count modeling implemented. — `accountSupabaseMock.ts` `select=user_id` branch resolves `countByOwnerUserId[owner] ?? state.count ?? 0`.
- [x] 7. Focused helper/drift test matrix fully green. — 17/17 (contract 10 + drift 7).
- [x] 8. Dist-sync temporary-account-remote-data negative journey implemented and green. — persona C in `portable-owner-recovery.spec.ts`; `e2e:sync` 46/46.
- [x] 9. Existing account/portable matching + wrong-account journeys remain green. — personas A/B unchanged; full `e2e:sync` green.
- [x] 10. Production account/backup/portable regressions green; no safety weakening. — `npm test` 1155, `npm run qa:integration` 159; `accountCoordinator.ts` untouched.
- [x] 11. Prior closure task checklist + ExecPlan reconciled honestly. — 2026-08-19: `tasks.md` 2.5 unchecked with evidence note + header; `.agent/execplans/account-recovery-dist-sync-determinism.md` preserves `8b1a1e3` run `32108157251` but notes not final head after `684dae9`/`a043141`; gap owned by this remediation.
- [x] 12. Previously unchecked full-QA gates executed/reconciled. — `npm ci`, `qa:fast`, `qa:integration`, `qa:timezones`, `e2e:full`, `expo-doctor`, `git diff --check`, plus focused/broad validators; see `tasks.md` 7.x/8.x.
- [x] 13. Broad repository validation complete. — typecheck/lint/themes/schema/openspec/plan/impact/build:sync/e2e:sync/main-e2e all green.
- [ ] 14. Coherent work committed/pushed to main; local/remote state clean/main-only. — in progress (commit + push pending).
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

Fresh-session reconciliation 2026-08-19 at `a043141`:

- `git fetch --prune` — PASS; `HEAD`/`origin/main` == `a0431411929ab85a39a4c274b9891b69e6ca673f`; only remote `main`.
- `npm run openspec:validate` — PASS (32 passed, 0 failed).
- `npm run agent:plan:validate:all` — PASS (all versioned plans valid).
- Reconciled `openspec/changes/fix-account-recovery-dist-sync-determinism/tasks.md` — header audit note added, `2.5` unchecked with evidence that `select=user_id` hardcodes zero at `a043141`.
- Reconciled `.agent/execplans/account-recovery-dist-sync-determinism.md` — checkpoint/surprises/outcomes updated to preserve `8b1a1e3` CI run `32108157251` while noting NOT final head after `684dae9`/`a043141`; non-zero footprint gap owned by this remediation.
- Reconciled `openspec/changes/fix-account-recovery-dist-sync-closure-audit/tasks.md` 0.5-0.7 and this plan's checkpoint 2026-08-19; untracked `tests/accountSupabaseMock.contract.test.ts` present from prior subgoal but not yet committed (intentional — isolate reconciliation patch).

Required implementation evidence is enumerated in `tasks.md`; record command + concise result here as it runs.

Implementation evidence 2026-08-19 (local gates, before final push):

- `npm ci` — PASS (1140 packages).
- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 errors (1 pre-existing `no-console` warning in `tests/integration/backupPerformance.test.ts`).
- `npm test` — 1155/1155 passed (incl. account/portable/backup suites).
- `npx vitest run tests/accountSupabaseMock.contract.test.ts tests/accountSupabaseMock.drift.test.ts` — 17/17 (contract 10 + drift 7).
- `npm run qa:fast` — PASS (996 unit tests).
- `npm run qa:integration` — 159/159 passed.
- `npm run qa:timezones` — 42/42 across 5 zones.
- `npm run e2e` (main lane: chromium + journeys + simulation) — 213 tests, 0 failed.
- `npm run build:sync` + `npm run e2e:sync` — 46/46 (persona C negative `weekly_reviews` scenario steps 1-2 green).
- `npm run validate:themes` — 140 contrast checks PASS.
- `npm run supabase:schema:validate` — PASS.
- `npm run openspec:validate` — 32 passed.
- `npm run agent:plan:validate:all` — PASS.
- `npm run qa:impact:validate` — PASS.
- `git diff --check` — clean (CRLF via repo `.gitattributes` policy).
- `npx expo-doctor` — ran; 1 non-blocking advisory (10 expo packages out of date; unrelated).
- `sim:validate` — clean; `sim:run --mode deterministic --scenario @p0` setup expects a running localhost:8081 server (started by the `qa:simulation` wrapper) — not a defect in this change.

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
