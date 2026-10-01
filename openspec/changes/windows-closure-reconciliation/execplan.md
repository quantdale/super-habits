# ExecPlan: Windows closure reconciliation campaign

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Execute the apply campaign for OpenSpec change `windows-closure-reconciliation`:
reconcile the canonical 22-task `final-certification-closure` ledger with real
evidence, resolve or precisely classify the Android smoke residual, complete the
ten-surface adversarial review, keep production/IOS safety gates intact, publish
an evidence-backed closure report, and prove the final pushed tip with exact-head
CI.

The planning phase of this same change (2026-10-01) produced the proposal, three
delta specs, design, exploration notes, the 42-task apply checklist, and this
durable plan. This plan now tracks campaign execution. The planning history is
retained below and is not rewritten.

## Context

- Input brief: `D:\Downloads\superhabits.md`, SHA-256 `2bdfd5f1a5f745943b20dfb86b8950d474d06c1a6f102a849bc7d9a463c4471a`.
- Planning-time baseline: `210afd39a99e2b2dbf5026b58a1191182e05f368` == `origin/main`.
- Canonical change: `openspec/changes/final-certification-closure` (14/22 checked).
  Its J8 delta, checkpoint, approval packet, and closure report are reconciled here.
- Native hardening change: `openspec/changes/harden-native-evidence-and-release-posture`
  (25/26; task 5.3 is the Android smoke residual reconciled by this campaign).
- Predecessor evidence: native artifacts at source `68db684`, full-QA record at
  `c2ec475`, CI run `36824132137` at `210afd3`.
- Planning artifacts for this change: [exploration.md](exploration.md),
  [proposal.md](proposal.md), [design.md](design.md), [tasks.md](tasks.md).

## Scope

Execute all 42 apply tasks: preflight, canonical CI/QA/J8 reconciliation, Android
smoke diagnosis and scoped repair with current-source qualification, the ten-surface
adversarial review with executable fixes, read-only production posture, all-task
reconciliation, closure report, proportional validation, logical commits, fast-forward
publication, exact-head CI on the final pushed tip, and the final owner report.

## Non-Goals

No product feature expansion, dependency addition, breaking API change, speculative
refactor, iOS execution or iOS semantics change, production DDL/data mutation,
signing, submission, release tag, paid AI activation, destructive Git operation,
foreign-evidence deletion, or archive of a change whose predicates are unmet.

## Current Checkpoint

- Current milestone: tasks 1–7 are complete through validation and publication; task 8's hygiene/audit is done. The only remaining steps are post-publication: inspect the hosted exact-head CI run and publish the commit-linked attestation (tasks 7.4/7.5), whose outcomes live in the attestation rather than a further repository edit.
- Completed: verified preflight; canonical CI/QA/J8/iOS reconciliation; Android triage, platform-conditional repair, non-vacuous guard and full device qualification (smoke 2/2, persistence 11/11, lifecycle 6/6); the ten-surface adversarial review; the production posture; the 22-task audit and rewritten closure report; **fresh `qa:full`** on the final tree; logical commits; fast-forward publication; the final-tip native re-qualification from a clean checkout of the published commit; and `web:hygiene`.
- In progress: nothing in the repository. Post-publication verification (hosted CI inspection and the commit-linked attestation) is the only outstanding work, and it intentionally adds no commit.
- Important modified files: `openspec/changes/windows-closure-reconciliation/**` (proposal, specs, design, tasks, execplan, exploration, triage, adversarial review); `openspec/changes/final-certification-closure/{tasks,execplan,closure-report,production-approval-packet}.md` and its J8 delta; `.maestro/flows/command-center-v2.yaml`; `tests/maestroCommandCenterFlowGuards.test.ts`. The sibling `harden-native-evidence-and-release-posture` was reconciled locally but stays an untracked prior-work directory by the preservation rule, so it is not part of any campaign commit. No `app/`, `features/`, `core/`, `lib/`, or `supabase/` file changed, so local schema stays 25.
- Last successful validation: final tree, 2026-10-02, pinned Node 22.23.2 — `npm run qa:full` green — `npm test` 250 files passed / 1 skipped (2457 tests passed / 2 skipped), OpenSpec 69/69, E2E 235 passed / 49 skipped / 0 failed (28.3 m), deterministic simulation 23/23; plus strict `openspec validate --all --strict` 69/69, `agent:plan:validate:all` PASS, `supabase:schema:validate` PASS, prettier and `git diff --check` clean. Native: final-tip battery green (smoke 2/2, persistence 11/11, lifecycle 6/6) from a clean checkout of the published commit.
- Current failures: none in the campaign. The five open canonical tasks are deliberate non-passes (production credential/DDL, owner-deferred iOS, conditional J8), not failures introduced here.
- Relevant quarantines: none added, widened, or removed. The 800 ms J8 ceiling, 15 % floor, D14 500 ms diary ceiling, gap-21 fail-closed posture, default-off Ask/Auto and disabled production anonymous auth are all unchanged.
- Blockers: production SQL credential and a proven-restorable `public`+`auth` recovery point (canonical 2.1/2.4), and the owner reopening iOS (3.2/3.3). None blocks tasks 7–8.
- Condition required to unblock: an owner-provided authorized read-only SQL credential plus a proven-restorable `public`+`auth` recovery point and a complete four-migration approval for production; owner reopening iOS on a macOS host.
- Exact resume action after unblock: run the bounded read-only query set in design §7 against `kruubbynsmxzxfdunaal`, then re-evaluate the four-file DDL prerequisites before any write; separately, dispatch the iOS native workflow only if the owner reopens iOS.
- Exact next action: inspect the hosted CI run for the published final SHA (require `quality`/`e2e` success with the strict retry gate and the expected `nightly` skip), then publish the immutable commit-linked attestation with the final SHA/run/jobs, the report permalink, the native final-tip evidence and the residual list. No further repository edit.
- Remaining definition of done: the post-publication verification record (tasks 7.4/7.5). Every repository deliverable exists and is validated; the remaining steps are deliberately not representable as a repository commit because they describe the commit that would carry them.

## Progress

Planning phase (complete, retained):

- [x] Read the brief, instructions, and OpenSpec skills.
- [x] Explore current Git, OpenSpec, CI, QA history, Android evidence, J8, and safety boundaries.
- [x] Select a bounded successor and create the proposal/change scaffold.
- [x] Create complete normative delta specs and implementation design.
- [x] Create individually verifiable implementation tasks and input traceability.
- [x] Validate artifacts, affected QA, formatting, and preserved Git scope.
- [x] Complete the planning checkpoint and hand off the apply-ready change.

Campaign execution:

- [x] Task 1 — verified preflight and durable execution state (1.1–1.4).
- [x] Task 2 — canonical CI, QA and J8 reconciliation (2.1–2.5).
- [x] Task 3 — Android smoke diagnosis and scoped repair (3.1–3.5).
- [x] Task 4 — focused adversarial review and repairs (4.1–4.12).
- [x] Task 5 — independent production read-only and approval posture (5.1–5.5).
- [x] Task 6 — all-task reconciliation and closure report preparation (6.1–6.4).
- [x] Task 7 — validation, publication and exact-final-candidate proof (7.1–7.3); 7.4/7.5 are the post-publication CI inspection and attestation, recorded there rather than in another commit.
- [x] Task 8 — final handoff and safety audit (8.1–8.2).

## Surprises & Discoveries

Planning phase (retained):

- Nine existing changes, not two; seven are foreign untracked directories and must not be absorbed into this task.
- The canonical J8 delta conflicts with its own proposal/task chronology. Apply must reconcile the normative wording, not only a report.
- The raw Android smoke JSON says `PRODUCT_BUG`, while later reviewed triage says `TEST_BUG`; preserve and explain both.
- Android fails before subsequent parse/review assertions execute, so a one-line selector correction alone is not proof that the full flow will pass.
- The canonical checkpoint's SQL dependency is broader than its spec, which requires independent executable lanes to continue.
- No affected runtime/config source differs between the earlier Android/QA run sources and current HEAD, but final-source certification is still a separate gate.

Campaign execution:

- 2026-10-01 preflight: `main`, `origin/main`, and `HEAD` are all `210afd3`; the planning branch `docs/windows-closure-proposal` had no commits of its own, so returning to `main` rewrites nothing.
- Only one worktree exists (the main tree). Stash `pre-recovery-local-changes` resolves to object `c35e281d740df1e367c1be0f38383237ca080239` and stays untouched.
- Untracked foreign state: `.tmp-ios36423379932/` (33 MB iOS extract) and seven prior OpenSpec change directories. `simulation-output/` is git-ignored, so native evidence survives without being committed.
- `openspec list --json` reports ten changes when complete ones are counted; only three are in progress (`windows-closure-reconciliation` 0/42, `harden-native-evidence-and-release-posture` 25/26, `final-certification-closure` 14/22).
- `command-center-v2.yaml` is not in either EAS native flow list; it is selected only by the Android runner's `smoke` tag, so the Android repair does not touch the iOS campaign's flow set.
- The failure hierarchy at `step-014-tapOnElement-Create` contains no `Create`, `Ask`, or `Auto` element at all, which matches `CommandScreen`'s `if (!AI_ASK_EXPERIMENT_ENABLED) return commandContent` branch: an ordinary build never mounts `ModeToggle`.
- Working-tree `qa:affected` is inflated to `qa:full` by the foreign unmapped iOS/prior-change paths; the explicit task-owned file set maps only to `agent-workflow-and-documentation` (`qa:fast` + `tests/agent-execplan.test.ts`).
- The repaired step exposed the real test of the flow: with the stale `tapOn: 'Create'` replaced, `command-center-v2` passed in 37 s on the hermetic APK, so every later example/parse/review/confirm assertion is now proven on Android rather than assumed from an aborted run.
- The Android qualification could not run in the main worktree at all: `requireCleanGitTree` rejects it because the preserved foreign evidence is untracked, not gitignored (the false `gitignored` claim was finding AR-1). A clean detached `git worktree` of the committed candidate is the correct lane, and it produced a byte-stable APK identity across all three batteries.
- The ten-surface review found no executable product defect. Four plausible concerns were withdrawn after evidence review (app.json headers, migration gap, permission transcription, blocked-outbox checkpoint), which is recorded so they are not re-investigated as if unresolved.
- Fresh recovery re-observation (2026-10-01T15:08Z) reproduced the empty inventory exactly, so the "proven absent" classification is not a single-observation artefact.
- `.tmp-ios36423379932/` is 33 MB of iOS evidence that `git status --untracked-files=all` reports as untracked; every commit must therefore stage explicit paths only, which this campaign did.
- The sibling change `harden-native-evidence-and-release-posture` is an **untracked prior-work directory**, so its reconciled task 5.3 / `COMPLETED` checkpoint is local-only by the preservation rule. The published record of the green Android battery is therefore the canonical closure report plus this change's artifacts; no foreign directory was absorbed into a campaign commit.

## Decision Log

Planning phase (retained):

- 2026-10-01 — Explore first, then propose; treat the downloaded campaign as future requirements, not an instruction to execute it during planning.
- 2026-10-01 — Create `windows-closure-reconciliation` instead of rewriting the canonical historical change; preserve its ledger for later evidence-driven reconciliation.
- 2026-10-01 — Scope flow correction to Android/profile behavior; keep default-off AI and shared iOS semantics unchanged.
- 2026-10-01 — Preserve substantive recovery red status as `NOT CERTIFIED` even if Windows work is exhausted.
- 2026-10-01 — Use the project branch-per-planning-task convention; the future main-only campaign rule remains intact.

Campaign execution:

- 2026-10-01 — Start execution on `main` at `210afd3` without history rewrite; the planning branch was an empty label, so no merge is required.
- 2026-10-01 — Treat the seven foreign OpenSpec directories, `.tmp-ios36423379932/`, and stash `pre-recovery-local-changes` as read-only foreign state; never stage them.
- 2026-10-01 — Task-owned paths for campaign commits: `openspec/changes/windows-closure-reconciliation/**`, `openspec/changes/final-certification-closure/**`, `openspec/changes/harden-native-evidence-and-release-posture/**`, `openspec/changes/external-blocker-closure/**` (archive-predicate documentation only), `.maestro/flows/command-center-v2.yaml`, and task-owned regression tests under `tests/`.
- 2026-10-01 — Classify the Android residual as `TEST_BUG` (stale flow step against the intentional default-off render boundary) unless device evidence proves a product defect; repair the flow, not the product.
- 2026-10-01 — Preserve the iOS path inside the shared command-center flow exactly as it is today by making the correction platform-conditional, so no iOS command sequence or assertion changes.
- 2026-10-01 — Treat "committed and device-qualified at `80b0b33`" as source-applicable evidence, not final-tip qualification: the design's task 7.3 requires the actual final committed tip to be re-qualified once repository content is stable, and any later content commit is a new tip.
- 2026-10-01 — Keep the canonical change `BLOCKED` and both predecessors unarchived. Closing Windows lanes does not satisfy the production-recovery predicate, and checked-task counts are not archive predicates.
- 2026-10-01 — Record the credential check once (no passwordless retry loop) and treat the management-API recovery read as the read-only lane it is, without letting it stand in for the SQL catalog read.
- 2026-10-01 — Publish the report and the _attestation_ separately: the report is a committed artifact that cannot contain its own hash, so the final SHA/run/jobs live in a commit-linked post-CI attestation instead of another repository edit that would invalidate CI.

## Validation Ledger

Planning phase (retained):

| Date       | Command / evidence                                                                                  | Outcome                                                                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | `git fetch origin`; ref/status/stash/worktree inventory                                             | PASS — exact initial refs match at `210afd3`, tracked files unchanged, foreign state present and preserved.                                                                                                 |
| 2026-10-01 | `openspec list --json`; status of both canonical changes                                            | PASS — nine changes, final closure 14/22; planning artifacts complete is distinct from implementation certification.                                                                                        |
| 2026-10-01 | `gh run view 36824132137` and run log                                                               | PASS — exact `210afd3`, quality/e2e success, nightly expected skipped; 0 strict retry-dependent passes, deterministic 23/23.                                                                                |
| 2026-10-01 | Native preserved build/tag/command artifacts and current source                                     | READ — smoke failure, persistence 11/11, lifecycle 6/6, exact source/APK identities; no new device run claimed.                                                                                             |
| 2026-10-01 | `git diff 68db684 HEAD` and `git diff c2ec475 HEAD` on runtime/config/flow areas                    | PASS — empty affected-source diffs; historical applicability recorded without claiming new final-tip execution.                                                                                             |
| 2026-10-01 | `openspec new change windows-closure-reconciliation`; proposal instructions/status                  | PASS — CLI-resolved repo-local paths; spec-driven scaffold created.                                                                                                                                         |
| 2026-10-01 | `openspec validate windows-closure-reconciliation --type change --strict`; status                   | PASS — all four artifacts done/apply-ready; implementation checklist remains unchecked.                                                                                                                     |
| 2026-10-01 | `openspec validate --all --strict`                                                                  | PASS — 69 items, 0 failures.                                                                                                                                                                                |
| 2026-10-01 | `npm run agent:plan:validate -- --plan openspec/changes/windows-closure-reconciliation/execplan.md` | PASS — ACTIVE plan valid.                                                                                                                                                                                   |
| 2026-10-01 | `npm run qa:affected`                                                                               | READ — includes unchanged foreign iOS extract/prior directories; conservative qa:full comes from those unmapped paths, not this documentation-only change. Resolve explicit owned-file impact before gates. |
| 2026-10-01 | `npx prettier --check openspec/changes/windows-closure-reconciliation`; `git diff --check`          | Prettier FAIL on three new Markdown files; diff check PASS. Formatting-only correction required.                                                                                                            |

- 2026-10-01 — Recovery: reread AGENTS/protocol/plan, ran `agent:resume`, and inspected its warnings. They name only the unchanged foreign iOS extract and seven prior changes; no task ownership was inferred. Explicit nine-file `qa:impact` selects `agent-workflow-and-documentation`, qa:fast and `tests/agent-execplan.test.ts`, with no broad regression.
- 2026-10-01 — `npx prettier --write` followed by changed-file `--check` — PASS; initial formatting failure fixed without touching foreign files.
- 2026-10-01 — `npm run qa:fast` on Node 22.23.2 — PASS; typecheck/lint, 169 unit files / 2052 tests, journey/quarantine parity and release-profile guard.
- 2026-10-01 — `npm test -- --maxWorkers=4` on Node 22.23.2 — PASS; 249 files and 2449 tests passed; 1 disposable-cloud file / 2 tests skipped, 0 failures. This is fresh planning QA, not a new qa:full or native claim.
- 2026-10-01 — `npm run supabase:schema:validate`; `npm run agent:plan:validate:all`; `npm run web:hygiene` — PASS; 16-file schema contract, all versioned plans, ports 8081/8082 free.
- 2026-10-01 — Input SHA-256; full artifact/brief read; strict per-change and `openspec validate --all --strict` after formatting — PASS; source matches design pin; every numbered brief section is traced; workspace 69/69, 0 failures; CLI apply ready with 0/42 campaign tasks complete.
- 2026-10-01 — Final reference/task/preservation audit — PASS; nine nonempty artifacts, 16 requirements / 35 scenarios, four valid local links and all representative design anchors exist; 0/42 campaign tasks checked; main/HEAD/origin remain `210afd3`, planning branch selected, no tracked/staged diff, exact stash object and foreign directories retained.
- 2026-10-01 — Raw QA log copied to `simulation-output/planning/windows-closure-reconciliation/qa-2026-10-01.log` (ignored) — PASS; source/copy SHA-256 both `04369a6f19d1f1de1a2c76416ab6955ce49c877acfd4af25a889a553c31d43c9`. No fresh qa:full, Android/iOS, production SQL/write, commit/push or archive was performed.
- 2026-10-01 — Final sweep — strict change/all OpenSpec 69/69, formatting, COMPLETED/all-plan validation and focused `agent-execplan` / `agentDocConsistency` 20/20 PASS. New-file `git diff --no-index --check` wrapper exited 1 on an added-file difference; classified TEST_BUG in the wrapper, preserving `simulation-output/planning/windows-closure-reconciliation/final-validation-2026-10-01.log`. Correct the check using an isolated temporary index; do not weaken assertions or ignore a whitespace diagnostic.
- 2026-10-01 — Checkpoint edit reported a partial apply because a bare status replacement also matched Outcomes. Inspected the actual file, retained the five applied edits, and targeted the unique schema header for the lifecycle correction; no edits were blindly replayed.
- 2026-10-01 — Corrected final gates — PASS; isolated temporary index + `git diff --check` verified all nine new files without altering the real index (byte-identical SHA-256); tracked/staged diffs empty; original main/remote/stash identities unchanged; hygiene 8081/8082 free. Durable replay output: `simulation-output/planning/windows-closure-reconciliation/final-validation-retry-2026-10-01.log`. The prior non-index exit-code failure is resolved, not ignored.

Campaign execution:

| Date       | Command / evidence                                                                                                                                                       | Outcome                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-01 | `git fetch origin`; `git rev-parse HEAD main origin/main`; `git status --porcelain=v1 -uall`; `git worktree list`                                                        | PASS — all three refs `210afd39a99e2b2dbf5026b58a1191182e05f368`; one worktree; 134 untracked foreign/evidence entries; no tracked or staged change.                                                   |
| 2026-10-01 | `git stash list`; `git rev-parse stash@{0}`                                                                                                                              | PASS — single foreign stash `pre-recovery-local-changes` at `c35e281d740df1e367c1be0f38383237ca080239`, left in place.                                                                                 |
| 2026-10-01 | `openspec list --json`; per-change task counts                                                                                                                           | PASS — three in-progress changes; `windows-closure-reconciliation` 0/42, native hardening 25/26, canonical closure 14/22.                                                                              |
| 2026-10-01 | `gh run view 36824132137 --json …`; `gh run list --limit 8`                                                                                                              | PASS — newest run for `main`, `headSha` exactly `210afd3`, `quality` success, `e2e` success with expected main-lane steps, `nightly` skipped.                                                          |
| 2026-10-01 | Host/tooling readiness: `node --version` on pinned path, `npm --version`, `java -version`, `adb version`, `maestro --version`, `emulator -list-avds`, `nproc`, disk free | PASS — Node `v22.23.2`/npm 10.9.8, Temurin 17, ADB 1.0.41 (37.0.0), Maestro 2.9.0, `Nitro_API_36` available, 20 CPUs, 707 GB free on D:.                                                               |
| 2026-10-01 | Privileged task-owned impact: `node scripts/qa-impact.mjs --files <owned paths>`                                                                                         | PASS — `agent-workflow-and-documentation` only, gates `qa:fast`, focused `tests/agent-execplan.test.ts`, no broad regression.                                                                          |
| 2026-10-01 | `git checkout main` from empty-label planning branch                                                                                                                     | PASS — clean switch, no history rewrite, no tracked file change.                                                                                                                                       |
| 2026-10-02 | `node scripts/qa-impact.mjs --files <13 task-owned paths>`                                                                                                               | READ — matched `native-e2e-infrastructure` + `agent-workflow-and-documentation`; required gates `qa:fast` → `qa:full` → `qa:native:smoke` → `qa:native:lifecycle`; broad regression required.          |
| 2026-10-02 | `npm run qa:full` (pinned Node 22.23.2, ambient Supabase unset)                                                                                                          | **PASS** — `npm test` 250 files passed / 1 skipped (2457 tests passed / 2 skipped); OpenSpec 69/69; E2E 235 passed / 49 skipped / 0 failed (28.3 m); deterministic simulation all 23 scenarios passed. |
| 2026-10-02 | `npx openspec validate --all --strict`; `npm run agent:plan:validate:all`; `npm run supabase:schema:validate`                                                            | PASS — 69/69 items; every versioned plan valid (the sibling is now COMPLETED); schema contract PASS (16 migration files).                                                                              |
| 2026-10-02 | `npx prettier --check` on every campaign file; `git diff --check` (worktree + index)                                                                                     | PASS — all matched files use Prettier style; no whitespace or conflict-marker diagnostics.                                                                                                             |
| 2026-10-02 | Store-declaration drift, migration chain, sync push verification, backup restore/validator/manifest/owner-stamping                                                       | PASS — 17/17 against the real merged release manifest, 6/6, 3/3 and 63/63 respectively.                                                                                                                |
| 2026-10-02 | Logical commits `223a783`, `80b0b33` and the closure commit; fast-forward publication on `main`                                                                          | PASS — explicit-path staging only (foreign evidence never staged); ordinary fast-forward push, no force push, no history rewrite.                                                                      |
| 2026-10-02 | Final committed tip re-qualified from a clean detached checkout (hermetic provisioning + smoke/persistence/lifecycle)                                                    | PASS — provisioning PASS, smoke 2/2, persistence 11/11, lifecycle 6/6, one APK identity; evidence attached via the commit-linked attestation.                                                          |
| 2026-10-02 | `npm run web:hygiene`                                                                                                                                                    | PASS — 8081/8082 free; no campaign-owned listener or process tree (emulator stopped after qualification).                                                                                              |

## Changed Files / Areas

Planning phase (retained): `openspec/changes/windows-closure-reconciliation/` only.
No existing canonical files or foreign evidence were edited.

Campaign execution (in progress): this change's `execplan.md` and `tasks.md` for campaign state; canonical
reconciliation targets listed in the Decision Log; the
Android flow and its regression test; the review and closure artifacts.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan completely.
2. Inspect `git status --short`, `git diff --stat`, `git diff --name-only`, the
   change files, and preserved foreign state.
3. Run `npm run agent:resume -- --plan openspec/changes/windows-closure-reconciliation/execplan.md`
   on pinned Node 22.23.2; reconcile warnings and QA impact.
4. Read `openspec instructions apply --change windows-closure-reconciliation --json`
   and continue only from `Exact next action` in Current Checkpoint.
5. Campaign execution runs on `main` and publishes by ordinary fast-forward only.
   Native qualification uses a clean checkout of the exact committed candidate.
   Never delete or stage foreign evidence.

## Outcomes & Retrospective

- Status: ACTIVE (all repository work complete) — campaign execution ran 2026-10-01/02
  from `210afd3`; the only outstanding steps are the post-publication CI inspection
  and the commit-linked attestation (tasks 7.4/7.5), which by design add no commit.
- Summary (campaign): the canonical ledger was reconciled against real evidence
  (exact-head CI, deferral-then-pass QA, conditional J8, deferred iOS, credential
  boundaries); the Android smoke residual was classified `TEST_BUG`, repaired
  platform-conditionally with a non-vacuous guard, and qualified green on the
  current-source hermetic APK; the ten-surface adversarial review produced two
  findings (one documentation claim fixed, one flow defect fixed and device-verified)
  and four explicitly withdrawn candidates; production stayed read-only with DDL
  stopped and no mutation; and the canonical closure report was rewritten with all
  ten sections, a 22-task audit and four-field residuals.
- Summary (planning): Evidence-grounded exploration produced a complete proposal,
  three delta specifications, design, a 42-task apply checklist, and this durable
  plan. The full brief is preserved, including Android/profile/iOS boundaries,
  independent adversarial review, canonical CI/QA/J8 reconciliation, exact-head
  publication and fail-closed production prerequisites.
- Proof: fresh `qa:full` on the final tree (250 files passed / 1 skipped; 2457 tests
  passed / 2 skipped; E2E 235/49/0; simulation 23/23), strict OpenSpec 69/69, all
  plans, schema contract, formatting/diff checks, three green Android batteries at
  one APK identity, and `web:hygiene` clean with no campaign-owned listener.
- Remaining work: tasks 7.4/7.5 only — inspect hosted CI on the final pushed SHA and
  publish the immutable attestation. Five canonical tasks stay open by design
  (production credential/DDL, owner-deferred iOS, conditional J8).
- Lesson (planning): a valid planning artifact, a checked investigation and a
  certified runtime gate are different outcomes; preserve that distinction and
  avoid the final-report self-referential SHA trap.
- Lesson (campaign): a machine failure label is not a classification. The raw
  Android report said `PRODUCT_BUG`; the hierarchy, the render boundary and the
  product spec agreed it was a stale test step. Classify from artifacts, then make
  the fix as narrow as the evidence — and re-run the whole battery rather than
  trusting the steps an aborted run never reached.
