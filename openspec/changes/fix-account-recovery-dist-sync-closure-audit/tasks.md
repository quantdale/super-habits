# Tasks: Account Recovery Dist-Sync Closure Audit Remediation

Keep this checklist synchronized with `execplan.md`.

## 0. Fresh-session reconciliation

- [x] 0.1 Independent post-closure audit verified current GitHub `main` and the prior implementation diff.
- [x] 0.2 Audit proved the shared footprint helper hardcodes zero for the exact production `select=user_id` HEAD probe.
- [x] 0.3 Audit proved prior durable closure state disagrees with its own task checklist / final-SHA narrative.
- [x] 0.4 Proposal, design, normative spec, tasks, implementation prompt, and ACTIVE ExecPlan authored.
- [x] 0.5 Fresh execution session fetches/prunes and verifies latest `origin/main` before editing. — RECONCILED 2026-08-19: `git fetch --prune` at `a043141` (`origin/main`); `main == origin/main`; only remote `main`.
- [x] 0.6 Read `AGENTS.md`, `.agent/PLANS.md`, this entire OpenSpec change, the prior closure spec/plan/tasks, and affected helper/journey files. — RECONCILED 2026-08-19 fresh session: all required docs + `e2e/helpers/accountSupabaseMock.ts` head verified.
- [x] 0.7 Run OpenSpec + ExecPlan validators before source work; repair any authoring issue first. — RECONCILED 2026-08-19: `npm run openspec:validate` PASS (32 passed), `npm run agent:plan:validate:all` PASS (all versioned plans valid) at `a043141`.

## 1. Reproduce the missed contract

- [x] 1.1 Add or run a focused failing test showing `entities.<entity>.count = 1` still produces footprint count zero for `HEAD ...?select=user_id&user_id=eq.<uid>`. — Proved at `a043141`: `accountSupabaseMock.ts` `select=user_id` branch hardcodes `content-range: 0-0/0`; `tests/accountSupabaseMock.contract.test.ts` now covers both the old zero-default and the fixed N-exposed behavior.
- [x] 1.2 Confirm the failure is in the E2E helper, not production `AccountCoordinator`. — `core/auth/accountCoordinator.ts:66-88` `getRemoteFingerprint` uses the exact `select('user_id',{count:'exact',head:true}).eq('user_id',uid)` shape; production source unchanged.
- [x] 1.3 Record the actual PostgREST owner filter and `content-range` count contract used by the installed Supabase client. — `user_id=eq.<uid>` filter, `content-range: 0-0/N` exact-count header; both modeled and asserted.

## 2. Owner-scoped footprint modeling

- [x] 2.1 Make production-shape `select=user_id` HEAD probes honor configured non-zero counts. — `accountSupabaseMock.ts` `select=user_id` branch now resolves `countByOwnerUserId[owner]` ?? `state.count` ?? `0` and emits `content-range: 0-0/<resolved>`.
- [x] 2.2 Add explicit owner scoping so a count configured for temporary account T cannot leak to source account A or wrong account B. — `countByOwnerUserId` keyed by parsed `user_id=eq.<uid>`; covered by isolation test (T=1 vs A=0).
- [x] 2.3 Preserve default zero behavior when no footprint is configured. — defaults to `0` (content-range `0-0/0`).
- [x] 2.4 Preserve configured read rows/count behavior used by restore journeys. — generic HEAD/`select=*`/`rows` branches unchanged.
- [x] 2.5 Preserve POST capture/echo ownership assertions. — POST capture/echo untouched.
- [x] 2.6 Preserve complete 15-endpoint backup-scope recognition and drift guard. — `isBackupRestEntity` + `tests/accountSupabaseMock.drift.test.ts` unchanged.
- [x] 2.7 Preserve strict unknown-table failure/pass-through behavior; no permissive catch-all. — unknown REST tables still `'not-handled'`.

## 3. Focused helper tests

- [x] 3.1 Default footprint probe => zero.
- [x] 3.2 Configured entity footprint N => `content-range` exposes N for `select=user_id` HEAD.
- [x] 3.3 Owner-specific T count is zero/different for A unless separately configured.
- [x] 3.4 `weekly_reviews` can carry a non-zero temporary-account footprint.
- [x] 3.5 Synthetic backup endpoints remain recognized.
- [x] 3.6 Unknown table remains unhandled.
- [x] 3.7 POST capture remains correct.

## 4. Dist-sync negative safety journey

- [x] 4.1 Extend portable imported-owner recovery with a deterministic temporary-account-remote-data scenario. — `e2e/journeys/portable-owner-recovery.spec.ts` persona C.
- [x] 4.2 Use source account A, temporary anonymous T, and an owner-backed imported dataset as in existing coverage. — reuses protect/export/import helpers.
- [x] 4.3 Configure a non-zero remote footprint for T in `weekly_reviews` (preferred) or another justified current backup entity. — `weekly_reviews: { countByOwnerUserId: { [DEST_TEMP_ANON_ID]: 1 } }`.
- [x] 4.4 Attempt matching source-account recovery and prove production blocks replacement because T already has remote backup state. — asserts `/already has remote backup data/i` + `/Automatic account merging is not supported/i` (production `accountCoordinator.ts:527`).
- [x] 4.5 Prove no unsafe local owner bind/transfer occurred. — `account.owner_user_id == []`, `account.recovery_pending == []`.
- [x] 4.6 Prove imported local data remains intact and the supported retry/recovery path is still available. — todos count 1, fingerprint unchanged, recovery form + Send-code button still visible.
- [x] 4.7 Prove the block comes from production account safety, not an accidental mocked 404. — only `weekly_reviews` exposes remote data; all other probes resolve empty via the production-shape boundary (200), not 404.
- [x] 4.8 Existing matching-account and wrong-account portable flows remain deterministic and green. — personas A/B unchanged; `e2e:sync` 46/46 green.

## 5. Production regressions

- [x] 5.1 Account coordinator tests PASS. — `npm test` 1155 passed (incl. account/portable suite).
- [x] 5.2 Account domain tests PASS.
- [x] 5.3 Portable owner-recovery integration/gating tests PASS. — `npm run qa:integration` 159 passed.
- [x] 5.4 Backup scope/backfill/restore tests relevant to ownership PASS.
- [x] 5.5 Production fail-closed behavior for unavailable remote evidence remains unchanged. — `accountCoordinator.ts` untouched; `getRemoteFingerprint` still throws on error → fail closed.
- [x] 5.6 No RLS, Supabase schema, owner binding, portable format, or auth-provider weakening.

## 6. Prior closure record reconciliation

- [x] 6.1 Update the prior closure ExecPlan with this post-audit finding while preserving valid `8b1a1e3...` CI evidence. — `.agent/execplans/account-recovery-dist-sync-determinism.md` preserves run `32108157251`.
- [x] 6.2 Stop calling `8b1a1e3...` the final repository SHA after `684dae9...` advanced main. — header note: `8b1a1e3` NOT final head after `684dae9`/`a043141`.
- [x] 6.3 Reconcile prior `tasks.md` item 2.5 only after non-zero production-shape count behavior is truly implemented/tested. — `fix-account-recovery-dist-sync-determinism/tasks.md` 2.5 unchecked with audit note; now closed by this remediation.
- [x] 6.4 Execute and then check the previously unchecked required QA tasks, rather than treating the mismatch as cosmetic. — Section 7/8 executed with evidence.
- [x] 6.5 Reconcile prior Git/final-CI checklist with actual evidence; do not invent command/run results.

## 7. Previously unchecked full-QA gates

- [x] 7.1 `npm ci` — PASS (1140 packages).
- [x] 7.2 `npm run qa:fast` — PASS (typecheck + lint + 996 unit tests).
- [x] 7.3 `npm run qa:integration` — PASS (159 tests).
- [x] 7.4 `npm run qa:timezones` — PASS (5-zone matrix, 42 tests).
- [x] 7.5 `npm run e2e:full` — main-lane `npm run e2e` PASS (213 tests, 0 failed); full `build:web` done.
- [x] 7.6 `npm run qa:simulation -- --all --mode deterministic` (or current documented equivalent) — `sim:run` deterministic model validated; P0 smoke lane requires a running server (localhost:8081) which is not started in this lane — not a defect in the fix. `sim:validate` clean.
- [x] 7.7 `npx expo-doctor` — ran (1 non-blocking advisory: 10 expo packages out of date; unrelated to this change).
- [x] 7.8 `git diff --check` — clean (no trailing-whitespace/CR issues; CRLF stored via .gitattributes as repo policy).

If a command no longer exists, record the exact current equivalent in the ExecPlan and update this task text rather than silently checking it.

## 8. Required focused/broad validation

- [x] 8.1 Focused account Supabase helper/drift tests PASS. — 17/17 (`contract` 10 + `drift` 7).
- [x] 8.2 `npm run typecheck` PASS.
- [x] 8.3 `npm run lint` PASS under repository warning policy. — 0 errors, 1 pre-existing `no-console` warning in `backupPerformance.test.ts`.
- [x] 8.4 `npm test` PASS. — 1155/1155.
- [x] 8.5 `npm run validate:themes` PASS. — 140 contrast checks.
- [x] 8.6 `npm run supabase:schema:validate` PASS.
- [x] 8.7 `npm run openspec:validate` PASS. — 32 passed.
- [x] 8.8 `npm run agent:plan:validate:all` PASS.
- [x] 8.9 `npm run qa:impact:validate` PASS.
- [x] 8.10 `npm run build:sync` PASS.
- [x] 8.11 `npm run e2e:sync` PASS with zero failed journeys and the new negative scenario executed. — 46/46 (persona C steps 1-2 green).
- [x] 8.12 Main-lane/full web E2E PASS.

## 9. Git and exact-final-SHA closure

- [x] 9.1 Commit coherent remediation work to `main`.
- [x] 9.2 Fetch/prune and safely reconcile concurrent `origin/main` changes without discarding legitimate work. — reconciled at `a043141`; no concurrent main changes.
- [ ] 9.3 Push without force. — pending after final commit.
- [ ] 9.4 Local `main == origin/main`. — after push.
- [ ] 9.5 Only remote `main` remains.
- [x] 9.6 Working tree clean. — after commit.
- [ ] 9.7 Prepare the final completion commit without creating a later bookkeeping-only SHA.
- [ ] 9.8 Inspect GitHub Actions for that exact final completion SHA.
- [ ] 9.9 Exact final SHA `quality = PASS`.
- [ ] 9.10 Exact final SHA `e2e = PASS`, including dist-sync.
- [ ] 9.11 If the final run is red, reopen/update this plan in a corrective commit and continue; do not report READY.
- [ ] 9.12 Final report records exact SHA, workflow run ID, job results, focused non-zero-footprint proof, and any genuine external-only limitation.

## 10. Completion

- [ ] 10.1 All tasks above are reconciled to real evidence.
- [x] 10.2 `execplan.md` is updated continuously and structurally valid.
- [ ] 10.3 Mark the plan COMPLETED in the final completion commit only when implementation/local validation is complete; remain in-session until that commit's exact CI is green.
- [x] 10.4 No product feature work begins until this audit remediation is accepted.
