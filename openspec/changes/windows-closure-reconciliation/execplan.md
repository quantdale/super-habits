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

- Current milestone: Task 1 complete (verified preflight and durable execution state); starting canonical CI/QA reconciliation.
- Completed: 1.1 preflight (refs/CI/stash/worktree/inventory), 1.2 foreign-state classification and task-owned path list, 1.3 main-only execution start, and 1.4 pinned Node 22.23.2 plus host/tooling readiness with hermetic/process-ownership rules recorded.
- In progress: Task 2 — canonical CI, QA, and J8 reconciliation; next edit is the canonical 6.2 close against CI `36824132137`.
- Important modified files: `openspec/changes/windows-closure-reconciliation/{execplan,tasks}.md` for campaign state; later `openspec/changes/final-certification-closure/**`, `.maestro/flows/command-center-v2.yaml`, a flow regression test, and the review/report artifacts.
- Last successful validation: planning gates recorded on 2026-10-01 (qa:fast, 249-file npm test, strict OpenSpec 69/69, schema, plan validation, formatting, hygiene). Campaign validation restarts with task 7.1.
- Current failures: None in campaign execution. The inherited Android smoke residual is smoke 1/2 (`command-center-v2` failed at `tapOn: 'Create'` because the ordinary build does not mount the rollout-gated mode selector).
- Relevant quarantines: Existing J8/gap-21 history and contracts preserved; no quarantine added or weakened. `command-center-v2` is registered as a quarantined _web_ journey, unrelated to this flow file.
- Blockers: Production SQL credential and recovery point remain external/owner gates (tasks 2.1/2.4/5.x); iOS tasks 3.2/3.3 remain owner-deferred. Neither blocks Windows work.
- Condition required to unblock: Owner-provided authorized read-only SQL credential plus a proven-restorable `public`+`auth` recovery point and complete four-migration approval for production; owner reopening iOS for 3.2/3.3.
- Exact resume action after unblock: Run the bounded read-only query set in design §7 against `superhabits` / `kruubbynsmxzxfdunaal` and re-evaluate the four-file DDL prerequisites; separately, dispatch the iOS native workflow only if the owner reopens iOS.
- Exact next action: Task 2.1 — re-verify CI `36824132137` headSha/jobs (already confirmed for preflight) and close canonical task 6.2 with the verified candidate and the final-tip re-attestation requirement.
- Remaining definition of done: tasks 2 through 8 of `tasks.md` (42 checkboxes), ending with final exact-head CI on the pushed tip, the commit-linked attestation, the owner report, and `npm run web:hygiene`.

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
- [ ] Task 2 — canonical CI, QA and J8 reconciliation (2.1–2.5).
- [ ] Task 3 — Android smoke diagnosis and scoped repair (3.1–3.5).
- [ ] Task 4 — focused adversarial review and repairs (4.1–4.12).
- [ ] Task 5 — independent production read-only and approval posture (5.1–5.5).
- [ ] Task 6 — all-task reconciliation and closure report preparation (6.1–6.4).
- [ ] Task 7 — validation, publication and exact-final-candidate proof (7.1–7.5).
- [ ] Task 8 — final handoff and safety audit (8.1–8.2).

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

| Date       | Command / evidence                                                                                                                                                       | Outcome                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | `git fetch origin`; `git rev-parse HEAD main origin/main`; `git status --porcelain=v1 -uall`; `git worktree list`                                                        | PASS — all three refs `210afd39a99e2b2dbf5026b58a1191182e05f368`; one worktree; 134 untracked foreign/evidence entries; no tracked or staged change. |
| 2026-10-01 | `git stash list`; `git rev-parse stash@{0}`                                                                                                                              | PASS — single foreign stash `pre-recovery-local-changes` at `c35e281d740df1e367c1be0f38383237ca080239`, left in place.                               |
| 2026-10-01 | `openspec list --json`; per-change task counts                                                                                                                           | PASS — three in-progress changes; `windows-closure-reconciliation` 0/42, native hardening 25/26, canonical closure 14/22.                            |
| 2026-10-01 | `gh run view 36824132137 --json …`; `gh run list --limit 8`                                                                                                              | PASS — newest run for `main`, `headSha` exactly `210afd3`, `quality` success, `e2e` success with expected main-lane steps, `nightly` skipped.        |
| 2026-10-01 | Host/tooling readiness: `node --version` on pinned path, `npm --version`, `java -version`, `adb version`, `maestro --version`, `emulator -list-avds`, `nproc`, disk free | PASS — Node `v22.23.2`/npm 10.9.8, Temurin 17, ADB 1.0.41 (37.0.0), Maestro 2.9.0, `Nitro_API_36` available, 20 CPUs, 707 GB free on D:.             |
| 2026-10-01 | Privileged task-owned impact: `node scripts/qa-impact.mjs --files <owned paths>`                                                                                         | PASS — `agent-workflow-and-documentation` only, gates `qa:fast`, focused `tests/agent-execplan.test.ts`, no broad regression.                        |
| 2026-10-01 | `git checkout main` from empty-label planning branch                                                                                                                     | PASS — clean switch, no history rewrite, no tracked file change.                                                                                     |

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

- Status: ACTIVE — campaign execution started 2026-10-01 from `210afd3`.
- Summary (planning): Evidence-grounded exploration produced a complete proposal,
  three delta specifications, design, a 42-task apply checklist, and this durable
  plan. The full brief is preserved, including Android/profile/iOS boundaries,
  independent adversarial review, canonical CI/QA/J8 reconciliation, exact-head
  publication and fail-closed production prerequisites.
- Summary (campaign): preflight is verified and recorded; canonical, Android,
  review, production, report, and publication tasks follow.
- Proof (planning): four OpenSpec artifacts ready; strict workspace 69/69, affected
  qa:fast, full unit/integration npm test, schema, plan, formatting and preservation
  audits passed. Raw QA evidence is retained locally.
- Remaining work: tasks 2.1–8.2 of `tasks.md`.
- Lesson (planning): a valid planning artifact, a checked investigation and a
  certified runtime gate are different outcomes; preserve that distinction and
  avoid the final-report self-referential SHA trap.
