# ExecPlan: External blocker closure

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Apply the [external-blocker-closure OpenSpec](proposal.md) and its [tasks](tasks.md): exhaust authorized local work, certify external lanes only from direct evidence, preserve historical results, and publish a truthful terminal report with exact resume actions.

## Context

- Starting HEAD `23ded6e7676f94d6ddf9337ad02d526d85973fcb` on `main`; code-final Android ancestor `56259876418674f85e1ca42c87f248fcf12c7d75` is reachable from HEAD.
- Work executes on `codex/external-blocker-closure`. The completed `.agent/execplans/live-cloud-verification-production-integration-v1.md` and stash `pre-recovery-local-changes` (`c35e281d740df1e367c1be0f38383237ca080239`) are historical evidence, not edit targets.
- Source of requirements: this change's proposal, design, eight delta specs, and tasks. Source of QA policy: `docs/testing/autonomous-qa.md` and `qa/impact-map.json`.
- Integration gates use pinned Node `C:\Users\palac\AppData\Local\tools\node-v22.23.2-win-x64\node.exe`; the ordinary shell starts on Node v24.3.0.

## Scope

Seven workstreams: production incident residue, disposable Supabase certification, AI Command Center readiness, iOS/EAS runtime, store-release preparation, deferred architecture/dependencies, and adversarial certification with a terminal report.

## Non-Goals

No unapproved production deletion, paid project or EAS run, provider spend, signing change, store submission, release tag, degraded restore, or bidirectional sync. Do not alter the foreign stash or completed live-cloud plan.

## Current Checkpoint

- Milestone: guarded disposable certification, backup-precision repair, local AI/security and release preparation, iOS static review, and second adversarial review complete; 25/27 tasks checked. The exact-SHA iOS runtime attempt (5.3) and terminal report (8.3) remain.
- Completed: preflight and CI lookup; pinned Node verified; read-only production candidate classification for 482 records; transaction-aware proposal limited to 135 confirmed records; disposable identity/guard, DNS/route checks, and reference schema apply; hermetic and dummy-host builds with fake ambient credentials, leak scans, runtime server/browser probe, and three regression tests for a demonstrated pre-listen scan race and dummy/uppercase bypass.
- Completed since prior checkpoint: exact Gym V2 SQL applied only on the named disposable project after empty-table/identity verification; real cloud battery caught PostgreSQL `REAL` rounding `80.123456789` to `80.1235`. New CLI-generated, append-only `20260925125655_backup_numeric_precision.sql` converts 17 backup measurements to `NUMERIC`. The guarded disposable apply and 17/17 catalog check passed, followed by an app-source Scope-7 backup/Restore V2 battery with 21 entities, decimal comparisons, selected RLS write isolation, owner mismatch, outbox retry, workout hard deletes, and verified exact-owner cleanup. Disposable Edge auth/default-off probes returned 401/403 without provider calls. Release package and iOS opt-in workflow are drafted.
- In progress: the second AI/Auto and iOS read-only review found no safety bypass after route generation guards, accurate local-history/provider copy, and a supported Expo build command. The delayed-classification regression passed in the fresh 13/13 dummy-host Ask journey. Pinned `qa:full` passed typecheck, lint, 2,290 Vitest tests, and all 60 OpenSpec items; its 281-test browser E2E stage is running. EAS is not linked to GitHub and its Maestro validation stops at the paid-plan gate; a free public-GitHub iOS simulator route is prepared but has no exact-SHA run. Production rollout remains owner-gated.
- Important modified files: the active OpenSpec change, private ignored `simulation-output/incident-residue-2026-09-25.json`, AI Edge Functions/UI/tests/docs, release docs/hosted policy/guards, disposable certification/schema, and iOS workflow/script. Exact changed directories and files are reconciled under Changed Files / Areas below.
- Last successful validation: pinned Node 22.23.2 `qa:fast` PASS (154 unit files, 1916 tests), `qa:full` through typecheck/lint/Vitest/OpenSpec PASS (231 test files passed, 1 skipped; 2,290 tests passed, 2 skipped; 60 OpenSpec items), fresh dummy-host `build:sync` PASS with fake ambient production credentials and Ask/Auto journey 13/13 PASS, focused TypeScript/ESLint/Prettier PASS after Auto race fix, release/privacy focused Vitest 20/20 PASS, schema contract PASS (15 migrations), `expo-doctor` 20/20 PASS, iOS script syntax and 13/13 flow inventory PASS, and guarded disposable cloud battery PASS after precision repair.
- Current failures: Production schema certification is red: the live project lists 12 applied migrations versus 15 repository files and lacks four Gym V2 backup tables. Existing Scope-7 manifests may also include values already rounded by remote `REAL`; the new type migration cannot recover those digits. This is read-only evidence; no production DDL has run. A post-edit privacy test briefly failed on a Prettier line wrap and was corrected without changing its assertion. The first plan validation field-structure failure was corrected.
- Relevant quarantines: gap 21 remains owner-deferred; J8/D14 ceilings remain unchanged.
- Blockers: Production cleanup needs exact-target owner approval. Production schema rollout needs recovery-point proof, exact three-file dry run, and DDL authorization; historical manifests need owner-scoped checksum audit and source-device recapture where damaged. Disposable anonymous bootstrap is untested because the project disables anonymous sign-in; the tested email owners exercised the same authenticated RLS role. Authenticated provider evaluation needs per-provider secrets/budget/authorization. iOS runtime has a public GitHub Actions simulator route drafted but no exact-SHA run. Store release remains unauthorized.
- Exact next action: let `qa:full` finish and capture its E2E/simulation result; then commit a clean exact source SHA, run required Android native smoke/persistence and the opt-in public-GitHub iOS simulator lane at that SHA, reconcile evidence, and publish the terminal report.
- Remaining definition of done: execute or evidence-classify tasks 4.1–8.3; run impact-based validation and adversarial re-review; publish a final-SHA report with all four blocker fields on every residual; validate the completed plan.

## Progress

- [x] Preflight and new ExecPlan (tasks 1.1–1.4).
- [x] Production incident residue (tasks 2.1–2.4; execution requires separate owner approval).
- [x] Disposable Supabase certification (tasks 3.1–3.3; anonymous bootstrap and provider work remain distinct external gates).
- [x] AI Command Center local readiness (tasks 4.1–4.4; provider-backed evaluation remains blocked without credentials/budget/authorization).
- [ ] iOS/EAS runtime evidence (tasks 5.1–5.2 static complete; task 5.3 exact-SHA runtime pending).
- [x] Store-release preparation (tasks 6.1–6.3; owner-supplied release inputs remain open).
- [x] Deferred architecture and dependency risk (tasks 7.1–7.3; gap-21 choice remains owner deferred).
- [ ] Adversarial review and terminal report (tasks 8.1–8.2 complete; task 8.3 final-SHA report pending).

## Surprises & Discoveries

- The active change was created untracked on `main`, with no pre-existing task ExecPlan. A dedicated branch was created without modifying the historical stash.
- The two cited CI run IDs refer to different SHAs, and both were independently verified successful; neither is current-change QA.
- AI source audit found raw upstream error-body/model-output logging in both Edge Functions, which can include user content. A scoped security fix and regression tests were delegated to the AI worker; release disclosure wording is being reconciled with that finding.
- Read-only production `information_schema` and migration history show no `custom_exercises`, `workout_weekly_plan`, `workout_schedule_overrides`, or `body_weight_entries`; repository migrations `20260824010000` and `20260824020000` are unapplied. Treat this as a current release/data-recovery gate, not a prior-campaign pass.
- The existing disposable project is ACTIVE_HEALTHY, marker-named `superhabits-disposable-202609240546-tqp3`, and its URL differs from production. The pure guard passes with no ambient production client credentials. The original guarded reuse command fails before schema apply because direct `psql` cannot resolve/reach its AAAA-only database host; it leaves the project in place.
- Public GitHub Actions provides a possible non-billable iOS simulator path; the iOS worker is implementing an opt-in workflow, with runtime evidence still `NOT RUN` until an exact-SHA job passes.
- The named disposable project was empty (zero public tables and migrations), then the exact `simulation/backend/schema.sql` reference payload applied successfully via Supabase MCP after guard verification. It now has 23 public tables, including all four Gym V2 tables. The repo's `roundTripScenarios.ts` is descriptive only and CI's disposable step ends after provisioning/build, so a real executable battery needs implementation; a worker owns this gap.
- Production read-only classification produced 482 candidate records: 135 confirmed synthetic in five exact J8 cohorts, 96 probable, 251 ambiguous. Exact IDs live only in a gitignored snapshot; cleanup is `OWNER_APPROVAL_REQUIRED` and remains unexecuted.
- Four workers stopped on a model usage limit before handoff. Their partial edits are in Git's working tree, so all claims and tests must be independently reconciled before checkboxes 3.3–6.3 or 8.2 are marked.
- The runtime E2E server started listening before its async embedded-host scan completed and allowed a case-variant live host or the dummy host outside `dist-sync`. A focused regression now requires refusal before listening; the server waits for the scan, restricts the dummy exception to `dist-sync`, and scans case-insensitively. Both build and runtime scanners fail on read errors.
- The first direct `journeys-sync` invocation accidentally served ordinary `dist/` because it omitted `E2E_DIST_DIR`; seven steps skipped and one failed at the absent Create toggle. A corrected dedicated `dist-sync` invocation passed all nine Ask steps. The failed invocation is retained as harness-use evidence, not a product failure.
- Auto routing initially exposed a stale async callback that could replace text typed after a mode switch, while Create parsing already persisted raw text in local recent-command history. The mode now has synchronous and generation guards, and the notice accurately names local history and a possible second remote parser; a delayed-classification journey tests the race.
- Release draft claimed an in-app recovery-email removal action and 30-day full-erasure promise, neither supported by current code or an approved anonymous-owner verification process. The policy, hosted copy, Play draft, and owner package now state the required procedure and decision rather than promising it.
- Gap 21 decision record leaves fail-closed Restore V2 unchanged and presents owner choices A/B/C with implementation and regression obligations; the choice remains pending.
- Read-only EAS GraphQL shows project `@dale16/superhabits` (`2cfd0e33-45ee-4c75-933a-8b466b817af9`) has no linked GitHub repository; non-billable workflow validation exited at the paid Maestro-plan gate without starting a job. The new GitHub Actions workflow is a separate opt-in route on this public repo. GitHub's current runner-image inventory lists the named macOS Intel runner, Xcode 26.2, and iOS 26.2 iPhone 17 Pro; a live run is still required.

## Decision Log

- Preserve the completed live-cloud plan as historical evidence; this OpenSpec owns the new execution plan.
- Apply this change on `codex/external-blocker-closure`; do not modify `main` directly.
- Treat absent external prerequisites as blockers with runbooks while continuing independent local work.
- Preserve safe operational error diagnostics while removing logs that can capture provider-echoed prompts or model output; AI worker owns the isolated fix and tests.
- Prepare production migration review and exact rollback/validation evidence before any deployment action; no production schema mutation is authorized by the incident read-only task.
- Close demonstrated E2E server recurrence bypasses with a narrowly scoped regression and leave custom-domain detection as a separate unproven hypothesis.

## Validation Ledger

| Date       | Command / source                                                                                                                                    | Outcome                                                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-25 | `openspec list --json`; `openspec instructions apply --change external-blocker-closure --json`                                                      | Only active change; spec-driven; 0/27; ready.                                                                                                                                       |
| 2026-09-25 | `git rev-parse HEAD`; `git merge-base --is-ancestor 5625987 HEAD`; `git status --short --branch`; `git stash list`; `git worktree list --porcelain` | Expected starting HEAD and ancestor; only change directory untracked; one worktree; named stash preserved.                                                                          |
| 2026-09-25 | `gh run view 36024910286` and `36017723458`                                                                                                         | Both completed success; head SHAs `23ded6e` and `5625987`, respectively.                                                                                                            |
| 2026-09-25 | Pinned `node --version` and command source                                                                                                          | `v22.23.2` from `%LOCALAPPDATA%\tools\node-v22.23.2-win-x64`.                                                                                                                       |
| 2026-09-25 | `npm run agent:plan:validate` (first pass)                                                                                                          | FAIL: checkpoint quarantines needed their own field; corrected in this revision.                                                                                                    |
| 2026-09-25 | `npm run agent:plan:validate` (second pass)                                                                                                         | PASS on pinned Node 22.23.2.                                                                                                                                                        |
| 2026-09-25 | `openspec validate external-blocker-closure --strict`                                                                                               | PASS, reported by read-only OpenSpec audit.                                                                                                                                         |
| 2026-09-25 | Supabase project metadata, `information_schema` SELECT, migration-list read                                                                         | Production `superhabits`/`kruubbynsmxzxfdunaal` ACTIVE_HEALTHY; 12 migrations applied, 14 repository files; four Gym V2 backup tables absent. No write.                             |
| 2026-09-25 | Disposable project metadata/URL, env presence, DNS/IPv6 route, pure `checkDisposableBackend`                                                        | Marker and non-production host verified; guard PASS; token and ambient production client env absent; direct DB AAAA with no IPv6 default route. No write.                           |
| 2026-09-25 | Pinned Node 22.23.2 `npx tsx simulation/backend/provision.ts run --with-parser --no-teardown --reuse=... --production-hosts ...`                    | ABORT before schema apply: direct `psql` host resolution failed; reused project left in place, no certification.                                                                    |
| 2026-09-25 | `npm run supabase:schema:validate`; focused guard/provision tests                                                                                   | PASS: 14 migration files; 26/26 focused tests.                                                                                                                                      |
| 2026-09-25 | Supabase MCP `apply_migration` on `slvctfwphtpeymzghyoc` using exact `simulation/backend/schema.sql`, then read-only table count                    | PASS: disposable schema applied; 23 public tables, four Gym V2 tables. This is a disposable write only, not full round-trip certification.                                          |
| 2026-09-25 | Read-only production candidate queries; ignored evidence JSON hash `22E543A860A0CF75A686A73663242538D290AF6F062783FD91B4EDD0F9D52207`               | 482 classified per-record: 135 confirmed, 96 probable, 251 ambiguous, 0 unrelated. Proposal has no production delete.                                                               |
| 2026-09-25 | Fake ambient Supabase URL/key → `npm run build:e2e`; byte scan of `dist/`; `npm run web:verify -- --skip-build`                                     | PASS: export has 0 Supabase-host files and 0 fixture-key files; server/browser HTTP 200, isolation and app shell; port released.                                                    |
| 2026-09-25 | Fake ambient live URL/key → `npm run build:sync`; scan of `dist-sync/`                                                                              | PASS: 0 fixture live-host/key files; one dummy-host file.                                                                                                                           |
| 2026-09-25 | `npx vitest run` focused AI/privacy/release/serve guard files; correct `journeys-sync` Ask spec                                                     | PASS: 28/28 focused unit tests, 9/9 Ask journey steps against `dist-sync`. Initial command without sync env failed/skipped against `dist/`, then corrected.                         |
| 2026-09-25 | `npm run agent:resume`, `npm run qa:affected` after compaction                                                                                      | PASS; impact map requests fast/full/integration/journeys/simulation. Resume warnings are working-tree files pending ledger reconciliation.                                          |
| 2026-09-25 | Pinned `npm run qa:full` through typecheck/lint/`npm test`/`openspec:validate`                                                                      | PASS to this checkpoint: 231 Vitest files passed, 1 skipped; 2,290 tests passed, 2 skipped; all 60 OpenSpec items passed. Browser E2E stage still running; no whole-gate claim yet. |
| 2026-09-25 | Pinned `npm run build:sync` with fake ambient production URL/key; `npm run e2e:sync -- e2e/journeys/command-center-v2-ask.spec.ts`                  | PASS: only dummy host in `dist-sync/`; 13/13 Ask/Auto journey steps, including delayed classification after a mode change.                                                          |
| 2026-09-25 | EAS project read-only lookup; `eas workflow:validate .eas/workflows/native-e2e.yml --non-interactive`                                               | Project linked locally but `githubRepository: null`; validation exit 1 solely on paid Maestro-plan gate, no job.                                                                    |
| 2026-09-25 | Pinned `npx expo-doctor`; `node --check scripts/qa-ios-github-actions.mjs`; YAML/flow inventory; `npx eslint` and Prettier on final Auto files      | PASS: 20/20 doctor, script syntax, 10 GitHub workflow steps, 13/13 EAS iOS flow files, focused lint and format. iOS runtime not run.                                                |

## Changed Files / Areas

- `openspec/changes/external-blocker-closure/execplan.md`: living task checkpoint and evidence ledger.
- `openspec/changes/external-blocker-closure/tasks.md`: task completion markers as each requirement is proven.
- `scripts/serve-e2e.js`, `scripts/build-dist-e2e.mjs`, `tests/serveE2eGuard.test.ts`: pre-listen and host-scan recurrence fix with regression.
- `openspec/changes/external-blocker-closure/gap-21-decision.md`: owner decision record, no runtime behavior change.
- AI function/UI/tests/docs, release policy/docs/tests, iOS workflow/script: partial worker work and primary integration; see Git for exact diff.
- Working-tree reconciliation roots: `.agent/execplans/`, `.github/workflows/`, `docs/analysis/`, `docs/release/`, `docs/testing/`, `e2e/`, `features/command/`, `public/privacy.html`, `scripts/`, `simulation/backend/`, `supabase/functions/`, `supabase/migrations/`, and `tests/`.

## Recovery / Resume Instructions

Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the OpenSpec apply context. Run `npm run agent:resume -- --plan openspec/changes/external-blocker-closure/execplan.md` using pinned Node, inspect Git status/diff and QA impact, reconcile the checkpoint, and continue from `Exact next action`. Preserve stash `pre-recovery-local-changes` and the completed live-cloud plan.

## Outcomes & Retrospective

Pending final validation and terminal report.
