# Tasks: Account Recovery Dist-Sync Determinism Closure

Keep this checklist synchronized with `.agent/execplans/account-recovery-dist-sync-determinism.md`.

## 0. Specification handoff

- [x] 0.1 Root cause independently verified from exact final GitHub Actions run `32024054019`.
- [x] 0.2 Proposal, design, normative spec, implementation entry point, and ExecPlan authored in the repository.
- [x] 0.3 Fresh implementation session fetches latest `origin/main` and verifies the actual current SHA before editing.
- [x] 0.4 Run `npm run openspec:validate` and `npm run agent:plan:validate:all`; repair any authoring/schema issue before source work.

## 1. Reproduce the exact failure

- [x] 1.1 Inspect CI #412 / run `32024054019` and record the failing `journeys-sync` assertions.
- [x] 1.2 Run the focused current dist-sync account/recovery journey(s) locally and reproduce the failure before changing the mock.
- [x] 1.3 Confirm the failure is caused by known backup-table probes receiving 404 from the journey-local mock.
- [x] 1.4 Record request method, query parameters, and PostgREST count/header behavior emitted by the installed Supabase client.

## 2. Shared backup-aware E2E boundary

- [x] 2.1 Create one shared account/recovery Supabase backup REST helper in `e2e/helpers/` or another justified shared test location.
- [x] 2.2 Derive recognized remote entities directly from `BACKUP_ENTITIES` + `BACKUP_SYNTHETIC_ENTITIES` if the test environment permits it.
- [x] 2.3 If direct derivation is not viable, centralize one E2E list and add an exact drift guard against production constants.
- [x] 2.4 Support deterministic owner-scoped empty count/head responses for every known backup entity.
- [x] 2.5 Support configured per-entity non-zero counts/rows when a journey requires them.
- [x] 2.6 Support configured POST capture/echo behavior where ownership assertions require it.
- [x] 2.7 Preserve strict failure for unknown/unmodeled Supabase REST tables.
- [x] 2.8 Keep auth endpoints owned by journey-specific handlers or a clean layered abstraction; do not create opaque cross-test global state.

## 3. Full contract drift protection

- [x] 3.1 Add a test proving every current `BACKUP_ENTITIES` entry is recognized.
- [x] 3.2 Explicitly prove `weekly_reviews` is recognized.
- [x] 3.3 Prove `user_backup_settings` is recognized.
- [x] 3.4 Prove `backup_manifest` is recognized.
- [x] 3.5 Add a negative test proving an arbitrary unknown REST table is not silently accepted.
- [x] 3.6 Ensure a future production backup-scope addition cannot silently fall through to a 404 in account/recovery E2E.

## 4. Recoverable Account V1 journey refactor

- [x] 4.1 Replace the journey-local historical four-table regex with the shared backup-aware helper.
- [x] 4.2 Preserve anonymous session creation and account identity reset semantics.
- [x] 4.3 Preserve email-protection OTP flow and UUID-preservation assertion.
- [x] 4.4 Preserve unknown-email recovery behavior and `shouldCreateUser=false` assertion.
- [x] 4.5 Preserve scenario-specific Todo remote backup row behavior used by restore.
- [x] 4.6 Preserve POST owner capture proving synced rows carry the correct anonymous/permanent owner.
- [x] 4.7 Verify session-loss recovery, wrong-owner blocking, first-write ownership, concurrent writes during protection, and populated-device switch protection still pass.

## 5. Portable owner recovery journey refactor

- [x] 5.1 Replace the journey-local historical four-table regex with the shared backup-aware helper.
- [x] 5.2 Preserve source owner A, destination temporary anonymous T, and wrong account B identities.
- [x] 5.3 Preserve owner-backed portable file export and fingerprint assertions.
- [x] 5.4 Preserve matching-account OTP recovery and durable owner binding assertions.
- [x] 5.5 Preserve wrong-account sign-out/fail-closed assertions.
- [x] 5.6 Preserve correct no-false-cloud-completeness behavior after matching bind (verified via local owner binding + deterministic backup, not a racy internal dirty-flag value).
- [x] 5.7 Verify the temporary-account remote-footprint gate sees every production backup entity through the mock.

## 6. Determinism proof

- [x] 6.1 Run the affected matching-account portable flow repeatedly; obtain first-attempt passes without relying on Playwright retry recovery.
- [x] 6.2 Run the wrong-account portable flow repeatedly with the same criterion.
- [x] 6.3 Run the Recoverable Account V1 protection/recovery flow repeatedly with the same criterion.
- [x] 6.4 Do not use additional timeout, skip, fixme, quarantine, or retry policy as the root fix.
- [x] 6.5 Record any genuine residual nondeterminism with evidence and fix it before closure.

## 7. Production regression

- [x] 7.1 Run account coordinator tests.
- [x] 7.2 Run account domain tests.
- [x] 7.3 Run Portable owner-recovery integration/gating tests.
- [x] 7.4 Run Backup scope/backfill/restore tests relevant to the remote-footprint contract.
- [x] 7.5 Verify production `AccountCoordinator` still fails closed when remote evidence is unavailable.
- [x] 7.6 Verify no RLS, Supabase schema, owner-binding, or portable-format weakening was introduced.

## 8. Dist-sync closure gate

- [x] 8.1 Run `npm run build:sync` successfully.
- [x] 8.2 Run `npm run e2e:sync`.
- [x] 8.3 Require zero failed `journeys-sync` tests; 33/36 is not acceptable closure.
- [x] 8.4 Verify account/recovery tests pass on their first attempt rather than only on retry.
- [x] 8.5 Inspect test output for unexpected 404s or unmodeled backup endpoints.

## 9. Weekly Review record reconciliation

- [x] 9.1 Update `.agent/execplans/weekly-review-planning-v1.md` so it no longer claims exact-final-SHA CI green for `36f01f8...`.
- [x] 9.2 Preserve the valid evidence: Weekly Review implementation, quality, main E2E, and deterministic scenarios passed.
- [x] 9.3 Record exact final run `32024054019` as red in dist-sync and link this closure change as the repository-level follow-up.
- [x] 9.4 Choose lifecycle/status wording consistent with `.agent/PLANS.md` and the v2 ExecPlan validator; do not falsify completion state.

## 10. Full repository QA

- [ ] 10.1 `npm ci`
- [x] 10.2 `npm run typecheck`
- [x] 10.3 `npm run lint`
- [x] 10.4 `npm test`
- [ ] 10.5 `npm run qa:fast`
- [ ] 10.6 `npm run qa:integration`
- [ ] 10.7 `npm run qa:timezones`
- [x] 10.8 `npm run validate:themes`
- [x] 10.9 `npm run supabase:schema:validate`
- [x] 10.10 `npm run openspec:validate`
- [x] 10.11 `npm run qa:impact:validate`
- [x] 10.12 `npm run agent:plan:validate:all`
- [x] 10.13 `npm run build:web`
- [x] 10.14 `npm run build:sync`
- [x] 10.15 `npm run e2e:sync`
- [ ] 10.16 `npm run e2e:full`
- [ ] 10.17 `npm run qa:simulation -- --all --mode deterministic` (or current equivalent if package scripts changed)
- [ ] 10.18 `npx expo-doctor`
- [ ] 10.19 `git diff --check`

## 11. Documentation and plan closure

- [x] 11.1 Update this OpenSpec/tasks if implementation discoveries require a contract clarification.
- [x] 11.2 Update `.agent/execplans/account-recovery-dist-sync-determinism.md` continuously with discoveries and validation evidence.
- [x] 11.3 Ensure all newly authored prose and final report are English only.
- [ ] 11.4 Mark this ExecPlan `COMPLETED` only after all required implementation/QA conditions are actually satisfied.

## 12. Git and exact-SHA CI closure

- [ ] 12.1 Commit all completed work coherently to `main`.
- [ ] 12.2 Fetch/prune and safely reconcile any concurrent `origin/main` changes without discarding legitimate work.
- [ ] 12.3 Push `main` without force.
- [ ] 12.4 Verify local `main == origin/main`.
- [ ] 12.5 Verify only remote `main` exists.
- [ ] 12.6 Verify working tree clean.
- [ ] 12.7 Inspect GitHub Actions for the exact final SHA.
- [ ] 12.8 Require `quality = PASS`.
- [ ] 12.9 Require `e2e = PASS`, including the remote-boundary dist-sync step.
- [ ] 12.10 If final CI is pending or red, keep working; do not report READY.
- [ ] 12.11 Final report records exact SHA, run ID, job results, focused determinism evidence, and any genuine external-only limitation.
