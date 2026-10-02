# Resolve the Windows closure apply review findings

Implement only the two P2 documentation corrections from the review of
`windows-closure-reconciliation`. Do not restart the closure campaign or treat
this task as authorization to execute its remaining certification work.

## 1. Read instructions and establish current state

Follow `AGENTS.md` and the repository's canonical read order, including
`.agent/PLANS.md`, `docs/testing/autonomous-qa.md` and `qa/impact-map.json`.

Read these files completely before editing:

- `openspec/changes/final-certification-closure/execplan.md`
- `openspec/changes/final-certification-closure/closure-report.md`
- `openspec/changes/final-certification-closure/tasks.md`
- `openspec/changes/windows-closure-reconciliation/execplan.md`
- `openspec/changes/windows-closure-reconciliation/tasks.md`
- `openspec/changes/windows-closure-reconciliation/design.md`
- `openspec/changes/windows-closure-reconciliation/specs/windows-local-closure/spec.md`
- `openspec/changes/windows-closure-reconciliation/specs/release-candidate-closure/spec.md`
- `.agent/execplans/windows-closure-apply-review.md`
- `simulation-output/reviews/windows-closure-apply/review.md`, if available.

Inspect Git status, tracked/staged diffs, HEAD/current branch, `main`,
`origin/main`, stashes and worktrees. The reviewed range was
`210afd39a99e2b2dbf5026b58a1191182e05f368...7a6aeb22b31d6d70935c77d5ff6c4cacff2a7e94`;
these are historical review anchors, not an assumption that today's HEAD is
unchanged. Reconcile any subsequent changes before applying the findings. If a
finding is already resolved, verify and report it rather than reapplying the fix.

Use `.agent/execplans/windows-closure-review-resolution.md` if this work needs a
new ExecPlan. Do not repurpose the completed independent review plan as execution
state or replace any historical campaign plan wholesale.

## 2. Scope and safety boundaries

Implementation targets are the canonical `execplan.md` and `closure-report.md`
listed above, plus a task-specific resolution ExecPlan if needed.

- Do not modify application code, Maestro flows, tests, migrations, dependencies,
  CI configuration, OpenSpec requirements or checkboxes in any `tasks.md`.
- Preserve foreign/untracked work, `.tmp-ios36423379932/`, ignored QA/native
  artifacts, the seven prior change directories and the
  `pre-recovery-local-changes` stash. Never stage, overwrite or delete them.
- No production SQL/access, credential inspection, DDL/data mutation, native/iOS
  runs, AI activation, signing, release tagging, archive, commit/push or external
  attestation publication is authorized by this prompt. Read-only inspection of
  existing hosted CI and the existing public attestation is allowed.
- Preserve `NOT CERTIFIED`, the canonical plan's `BLOCKED` posture, the five
  deliberate open canonical tasks, and their actual classifications:
  `2.1` credential/external, `2.4` blocked production prerequisites,
  `3.2`/`3.3` owner-deferred iOS/environment, `4.3` conditional `NOT_TRIGGERED`.
- Do not change J8's 800 ms ceiling, 15% floor, historical 878 ms excursion,
  accepted 622/800 result, gap-21 fail-closed posture or default-off AI behavior.

## 3. Resolve Standards P2: stale canonical checkpoint

**Finding:** At reviewed lines 30–40 of
`openspec/changes/final-certification-closure/execplan.md`, the Current Checkpoint
still directs validation, commits, publication and final-tip native qualification
that the successor already records as completed. This violates the repository's
authoritative-NOW/resume contract and can cause redundant execution.

Verify completed work from Git and direct evidence, then synchronize the current
checkpoint, relevant current Progress entries and Outcomes. Preserve historical
validation/decision chronology rather than rewriting it as always complete.

The corrected plan must:

1. Distinguish completed Windows engineering/publication from unfulfilled
   production and owner-deferred iOS certification prerequisites.
2. Remove instructions to repeat completed campaign validation, publication or
   native qualification solely because its old checkpoint says they are pending.
3. Link the existing post-CI attestation and source-bound qualification evidence;
   do not describe observed completed external steps as unperformed.
4. Keep a single truthful Exact next action while blocked and retain bounded
   post-unblock actions for production/iOS. Do not authorize those actions now.
5. Keep canonical ledger count/classifications aligned with the actual task file
   (17/22 at review time), without changing its checkboxes or expanding scope.

## 4. Resolve Spec P2: omitted refreshed final-validation evidence

**Finding:** At reviewed line 126 and lines 209–211 of
`openspec/changes/final-certification-closure/closure-report.md`, the report only
presents historical `c2ec475` full QA, with applicability corroborated through
`210afd3`. Successor task 7.1 records a fresh campaign run after the Maestro/test
change. Brief section 13, available in `D:/Downloads/superhabits.md`, requires a
Final validation section containing actual gate evidence.

Add a clearly labeled **Final validation** section. For each relevant gate record
the actual command, result, source/commit or working-tree applicability, runtime,
execution date and durable evidence reference:

- typecheck and zero-warning lint;
- unit and integration coverage (distinguish combined `npm test` from standalone
  invocations; do not invent a command that was not run);
- `qa:fast` and `qa:full`;
- strict OpenSpec validation;
- repository Supabase schema-contract validation, explicitly not a live
  production catalog verification;
- deterministic simulation.

Verify raw logs/hosted evidence where available. If a claim can only be traced to
a written ledger, label that evidence level honestly. If a required result is
unavailable, report the exact gap instead of filling in an assumed PASS.

Retain the earlier resource deferral → `c2ec475` successful run → fresh campaign
validation chronology. Update current summaries and R8 so they no longer imply
that the ancestor is the only/latest validation after the native-flow change.
Do not erase old failures, skip counts or source identities.

Useful evidence to inspect, not copy blindly:

- Successor task 7.1/validation ledger records Node 22.23.2 fresh `qa:full`,
  250 passing files / 1 skipped, 2457 passing tests / 2 skipped, OpenSpec 69/69,
  E2E 235 passed / 49 skipped / 0 failed, deterministic simulation 23/23.
- Exact-tip push CI run `36895560974` targets
  `7a6aeb22b31d6d70935c77d5ff6c4cacff2a7e94`; quality/e2e succeeded, nightly
  was expected skipped, and strict retry-dependent passes were zero. Its test
  counts differ from the local run; preserve each run's actual counts.
- The existing [commit-linked attestation](https://github.com/quantdale/super-habits/commit/7a6aeb22b31d6d70935c77d5ff6c4cacff2a7e94#commitcomment-202986711)
  records final-tip CI/native evidence. Saved snapshots and the CI log are under
  `simulation-output/reviews/windows-closure-apply/`.
- The independent review's `qa-fast-sequential.log` records a separate fresh
  `qa:fast` pass: 170 unit files / 2060 tests. Do not relabel review-time checks as
  campaign-time checks or integration/native qualification.

A documentation correction does not retroactively change the tested SHA.
Differentiate the qualified `7a6aeb2` candidate, historical `80b0b33` Android
qualification and the current edited tree. Do not claim that ancestor CI/native
artifacts certify a future commit, or create another self-referential report-SHA
cycle. Any future publication needs separately authorized exact-head evidence.

## 5. Validate proportionately

Use pinned Node 22.23.2. Compute task-owned impact explicitly so unrelated
untracked evidence does not get absorbed into this task:

```bash
npm run qa:impact -- --files openspec/changes/final-certification-closure/execplan.md openspec/changes/final-certification-closure/closure-report.md
```

Include a new resolution-plan path in that command if one was created. Follow the
resolved documentation gates, including `qa:fast` and focused
`tests/agent-execplan.test.ts` / `tests/agentDocConsistency.test.ts`; check Prettier
on changed files, strict validation of relevant OpenSpec changes and all
versioned plans. Validate a new resolution plan before completion.

Reverify each reported result against its evidence and check cross-document
source identities, counts, current/historical labels, blockers and next actions.
Structural Markdown/ExecPlan validation alone does not prove these corrections.
Do not rerun full QA, E2E, simulation or native qualification solely for a
source-inert documentation correction; escalate only when actual impact requires
it. Preserve and classify failures, never weaken assertions or raise test budgets.

Run `git diff --check` and `npm run web:hygiene`; confirm no task-owned listeners
remain on 8081/8082. Inspect the final diff and preserve all foreign state. Do not
commit or push.

## 6. Definition of done and handoff

- Both P2 findings are addressed in the two target documents, with evidence-backed
  current sections and preserved historical chronology.
- The canonical checkpoint no longer tells a resumed agent to redo completed
  Windows publication/qualification work.
- Final validation includes all required gates with honest provenance; R8 and
  current summaries agree with it.
- Existing certification residuals, task checkboxes, safety boundaries and
  source-bound CI/native proof remain unchanged.
- Proportionate checks pass, or exact blockers/limitations are explicitly reported.

Report each finding's disposition, changed files, the evidence verified, commands
and outcomes, any remaining gap and the current Git state. Keep Standards and Spec
dispositions separate. Do not claim overall release certification.
