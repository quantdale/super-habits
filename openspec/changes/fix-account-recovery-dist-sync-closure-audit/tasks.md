# Tasks: Account Recovery Dist-Sync Closure Audit Remediation

Keep this checklist synchronized with `execplan.md`.

## 0. Fresh-session reconciliation

- [x] 0.1 Independent post-closure audit verified current GitHub `main` and the prior implementation diff.
- [x] 0.2 Audit proved the shared footprint helper hardcodes zero for the exact production `select=user_id` HEAD probe.
- [x] 0.3 Audit proved prior durable closure state disagrees with its own task checklist / final-SHA narrative.
- [x] 0.4 Proposal, design, normative spec, tasks, implementation prompt, and ACTIVE ExecPlan authored.
- [ ] 0.5 Fresh execution session fetches/prunes and verifies latest `origin/main` before editing.
- [ ] 0.6 Read `AGENTS.md`, `.agent/PLANS.md`, this entire OpenSpec change, the prior closure spec/plan/tasks, and affected helper/journey files.
- [ ] 0.7 Run OpenSpec + ExecPlan validators before source work; repair any authoring issue first.

## 1. Reproduce the missed contract

- [ ] 1.1 Add or run a focused failing test showing `entities.<entity>.count = 1` still produces footprint count zero for `HEAD ...?select=user_id&user_id=eq.<uid>`.
- [ ] 1.2 Confirm the failure is in the E2E helper, not production `AccountCoordinator`.
- [ ] 1.3 Record the actual PostgREST owner filter and `content-range` count contract used by the installed Supabase client.

## 2. Owner-scoped footprint modeling

- [ ] 2.1 Make production-shape `select=user_id` HEAD probes honor configured non-zero counts.
- [ ] 2.2 Add explicit owner scoping so a count configured for temporary account T cannot leak to source account A or wrong account B.
- [ ] 2.3 Preserve default zero behavior when no footprint is configured.
- [ ] 2.4 Preserve configured read rows/count behavior used by restore journeys.
- [ ] 2.5 Preserve POST capture/echo ownership assertions.
- [ ] 2.6 Preserve complete 15-endpoint backup-scope recognition and drift guard.
- [ ] 2.7 Preserve strict unknown-table failure/pass-through behavior; no permissive catch-all.

## 3. Focused helper tests

- [ ] 3.1 Default footprint probe => zero.
- [ ] 3.2 Configured entity footprint N => `content-range` exposes N for `select=user_id` HEAD.
- [ ] 3.3 Owner-specific T count is zero/different for A unless separately configured.
- [ ] 3.4 `weekly_reviews` can carry a non-zero temporary-account footprint.
- [ ] 3.5 Synthetic backup endpoints remain recognized.
- [ ] 3.6 Unknown table remains unhandled.
- [ ] 3.7 POST capture remains correct.

## 4. Dist-sync negative safety journey

- [ ] 4.1 Extend portable imported-owner recovery with a deterministic temporary-account-remote-data scenario.
- [ ] 4.2 Use source account A, temporary anonymous T, and an owner-backed imported dataset as in existing coverage.
- [ ] 4.3 Configure a non-zero remote footprint for T in `weekly_reviews` (preferred) or another justified current backup entity.
- [ ] 4.4 Attempt matching source-account recovery and prove production blocks replacement because T already has remote backup state.
- [ ] 4.5 Prove no unsafe local owner bind/transfer occurred.
- [ ] 4.6 Prove imported local data remains intact and the supported retry/recovery path is still available.
- [ ] 4.7 Prove the block comes from production account safety, not an accidental mocked 404.
- [ ] 4.8 Existing matching-account and wrong-account portable flows remain deterministic and green.

## 5. Production regressions

- [ ] 5.1 Account coordinator tests PASS.
- [ ] 5.2 Account domain tests PASS.
- [ ] 5.3 Portable owner-recovery integration/gating tests PASS.
- [ ] 5.4 Backup scope/backfill/restore tests relevant to ownership PASS.
- [ ] 5.5 Production fail-closed behavior for unavailable remote evidence remains unchanged.
- [ ] 5.6 No RLS, Supabase schema, owner binding, portable format, or auth-provider weakening.

## 6. Prior closure record reconciliation

- [ ] 6.1 Update the prior closure ExecPlan with this post-audit finding while preserving valid `8b1a1e3...` CI evidence.
- [ ] 6.2 Stop calling `8b1a1e3...` the final repository SHA after `684dae9...` advanced main.
- [ ] 6.3 Reconcile prior `tasks.md` item 2.5 only after non-zero production-shape count behavior is truly implemented/tested.
- [ ] 6.4 Execute and then check the previously unchecked required QA tasks, rather than treating the mismatch as cosmetic.
- [ ] 6.5 Reconcile prior Git/final-CI checklist with actual evidence; do not invent command/run results.

## 7. Previously unchecked full-QA gates

- [ ] 7.1 `npm ci`
- [ ] 7.2 `npm run qa:fast`
- [ ] 7.3 `npm run qa:integration`
- [ ] 7.4 `npm run qa:timezones`
- [ ] 7.5 `npm run e2e:full`
- [ ] 7.6 `npm run qa:simulation -- --all --mode deterministic` (or current documented equivalent)
- [ ] 7.7 `npx expo-doctor`
- [ ] 7.8 `git diff --check`

If a command no longer exists, record the exact current equivalent in the ExecPlan and update this task text rather than silently checking it.

## 8. Required focused/broad validation

- [ ] 8.1 Focused account Supabase helper/drift tests PASS.
- [ ] 8.2 `npm run typecheck` PASS.
- [ ] 8.3 `npm run lint` PASS under repository warning policy.
- [ ] 8.4 `npm test` PASS.
- [ ] 8.5 `npm run validate:themes` PASS.
- [ ] 8.6 `npm run supabase:schema:validate` PASS.
- [ ] 8.7 `npm run openspec:validate` PASS.
- [ ] 8.8 `npm run agent:plan:validate:all` PASS.
- [ ] 8.9 `npm run qa:impact:validate` PASS.
- [ ] 8.10 `npm run build:sync` PASS.
- [ ] 8.11 `npm run e2e:sync` PASS with zero failed journeys and the new negative scenario executed.
- [ ] 8.12 Main-lane/full web E2E PASS.

## 9. Git and exact-final-SHA closure

- [ ] 9.1 Commit coherent remediation work to `main`.
- [ ] 9.2 Fetch/prune and safely reconcile concurrent `origin/main` changes without discarding legitimate work.
- [ ] 9.3 Push without force.
- [ ] 9.4 Local `main == origin/main`.
- [ ] 9.5 Only remote `main` remains.
- [ ] 9.6 Working tree clean.
- [ ] 9.7 Prepare the final completion commit without creating a later bookkeeping-only SHA.
- [ ] 9.8 Inspect GitHub Actions for that exact final completion SHA.
- [ ] 9.9 Exact final SHA `quality = PASS`.
- [ ] 9.10 Exact final SHA `e2e = PASS`, including dist-sync.
- [ ] 9.11 If the final run is red, reopen/update this plan in a corrective commit and continue; do not report READY.
- [ ] 9.12 Final report records exact SHA, workflow run ID, job results, focused non-zero-footprint proof, and any genuine external-only limitation.

## 10. Completion

- [ ] 10.1 All tasks above are reconciled to real evidence.
- [ ] 10.2 `execplan.md` is updated continuously and structurally valid.
- [ ] 10.3 Mark the plan COMPLETED in the final completion commit only when implementation/local validation is complete; remain in-session until that commit's exact CI is green.
- [ ] 10.4 No product feature work begins until this audit remediation is accepted.
