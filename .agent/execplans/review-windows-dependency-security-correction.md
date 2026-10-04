# ExecPlan: Review the Windows dependency-security correction

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Independently review the correction to `resolve-windows-dependency-security`
against the preceding review findings and the existing OpenSpec contract. Verify
actual source, executing regressions and retained evidence rather than accepting
reports or checkboxes. Return an evidence-backed verdict; do not implement fixes
or push merely because a narrower correction appears sound. Goal mode is inactive.

## Context

- Repository/cwd: `quantdale/super-habits`, `D:/Documents/tryPython/superhabits`.
- Correction baseline: `eae3deeb1e5118e12c8956e7fec060746f2002af` (preceding
  reviewed apply). Correction HEAD: `0e0c8a8877d8eac852923de9d5ef5f1d06346e89`.
- Fetch confirms `origin/main` at `891ed228ffc39f002ac13cc62aad2ee0b69ef1fe`;
  local `main` has seven unpublished commits, three constituting the correction
  (`f354792`, `2edbcf5`, `0e0c8a8`). Tracked working tree and real index are clean.
- Correction changes five files: `scripts/audit-runtime-deps.mjs`,
  `tests/auditRuntimeDeps.test.ts`, and the change's `tasks.md`, `final-report.md`
  and `execplan.md` (805 insertions/127 deletions).
- Required behavior: original preserved brief, normative spec/design, and
  `simulation-output/security-review-2026-10-02/correction-prompt.md`.
  The original review plan remains completed and read-only historical evidence.
- Previous P1: seven malformed/incoherent reports false-green at seam + CLI.
  P2: inherited npm audit-level could false-red valid moderate reports; final
  source/CI identities and test accounting needed reconciliation.
- Correction claims 50 audit tests, seven crypto guards, pinned clean install,
  static/full-QA stages and exact-source receipt. These are claims to verify.
- Upstream forge remains a separate disclosed red audit blocker. Overall NOT
  CERTIFIED, canonical 17/22 and deferred iOS/production limitations remain intact.
- Preserve eight foreign untracked roots, earlier review plan, stash, refs,
  worktree/index and all prior ignored evidence. No broad cleanup or staging.

## Scope

Review the three correction commits and their blast radius, all five changed
files, prior finding closure, new regressions, evidence accounting/provenance,
standards and OpenSpec consistency. Two fresh read-only reviewers cover Standards
and Spec independently, per the applicable code-review skill. The parent owns
reproduction, disposition and final acceptance. Use pinned Node 22.23.2 / npm
10.9.8. New ignored evidence: `simulation-output/security-correction-review-2026-10-03/`.

## Non-Goals

No implementation edits, re-proposal/archive, advisory exception, forge repair,
production/Supabase access, native/iOS work, signing/secrets, broad validation
reruns that overwrite preserved evidence, weakening tests/budgets, reset/stash
mutation, unrelated process termination, commits or push during this review.
Read-only reviewers share the existing checkout; no writer branch/worktree is
created or substituted for the exact corrected source under judgment.

## Current Checkpoint

- Current milestone: COMPLETED — correction review BLOCK; evidence-backed report
  and second bounded correction prompt saved; no implementation fix or push.
- Completed: Startup/review/delegation guidance read; fetch/status/history inspected;
  correction baseline/HEAD/five paths pinned; full script and correction diff read;
  preceding correction prompt, current apply checkpoint and report read. Captured
  453 protected files/links (including the prior 368 and all correction/previous
  review evidence), 19 source-file hashes, refs/stash/worktree/index and patches.
  The final correction receipt's five hashes and exact local SHA match current files.
- In progress: None. Reports: `simulation-output/security-correction-review-2026-10-03/
{review-report,correction-prompt}.md`; final receipt binds preservation and review
  validation to the unchanged corrected source.
- Delegation: Workflow `0c6b190f-5638-4be1-973e-1b8f3665da29` terminal;
  Standards `db6d1774-7786-48ec-8e20-81119e0c4b32`, Spec
  `4fe7fa71-1a14-444e-b148-079d053f97af`, both fresh/read-only, initially OK with
  notes. Parent reproduced additional P1 issues not found by those reviewers;
  their original independent reports are preserved without rewriting verdicts.
- Important modified files: This new review ExecPlan only; new ignored evidence.
- Last successful validation: Focused 77/77 across two runs (50 audit + 7 guards,
  then 9 ExecPlan + 11 doc consistency); original seven negatives corrected at
  seam/CLI, valid controls preserved and configured audit-level fixed using the
  actual pinned npm reporter. OpenSpec 70/70, all-plan validation, whitespace and
  hygiene PASS (8081/8082 free). Preservation/source recheck: 453 protected entries
  and 19 source hashes, zero mismatches. Correction receipt matches HEAD/five
  hashes; retained pre-install lockfile bytes match. Explicit five-path impact PASS.
- Current failures: P1 AUDIT_POLICY_BUG — five further incoherent/malformed report
  cases still exit 0 at both seams (severity evidence, malformed advisory URL,
  contradictory package identity). P1 AUDIT_POLICY_BUG — actual npm offline mode
  skips the registry audit and the corrected CLI reports clean/exit 0 on the
  current vulnerable tree, versus online exit 1. P2 evidence/reporting gaps:
  missing claimed correction qa-affected receipt and green-wrapper overclaim.
  An evidence-tail diagnostic hit Windows cp1252 UnicodeEncodeError; original
  file unchanged, source/log inspection continued through read tools.
- Relevant quarantines: None changed.
- Blockers: None for review; forge remediation/publication remains separately blocked.
- Condition required to unblock: None for review.
- Exact resume action after unblock: None for review.
- Exact next action: None — review task complete.
- Remaining definition of done: None for review. Another authorized agent must
  correct the remaining P1 report-coherence/advisory-identity and offline-skipped
  audit false greens, reconcile P2 report/receipt truth, validate corrected source
  and return for independent re-review without pushing. Upstream remediation is
  separate; neither a clean parser review nor historical QA qualifies security
  resolution or overall certification.

## Progress

- [x] Read guidance and pin baseline, corrected HEAD, scope and authority.
- [x] Capture preservation/source baseline and independent reviewer handoffs.
- [x] Review all five files and validate closure of preceding findings.
- [x] Inspect evidence claims and reproduce any concrete new defects.
- [x] Consume Standards/Spec reviews and disposition findings.
- [x] Verify preservation/hygiene, close checkpoint and deliver verdict.

## Surprises & Discoveries

- The correction normalizes audit status with `--audit-level=info` and validates
  version, enum/count/path/reference shapes. Policy extraction still skips string
  `via` references; severity/advisory coherence requires direct investigation.
- The final correction receipt matches the current local and remote SHAs; there
  is still no hosted CI run for the unpublished corrected tip.
- Metadata-to-outer-count coherence is insufficient: a moderate outer finding
  carrying an explicit high advisory is accepted and hidden; critical string-via
  findings reaching only lower/documented evidence are similarly false-green.
  Malformed URLs and contradictory package names can also pass the allowlist.
- Pinned npm's Arborist returns without querying the registry when offline is
  true, serializing a clean-shaped report. Actual corrected CLI inherits this
  config and exits 0 on the known affected dependency tree. This is a remaining
  completion-integrity defect, not a new registry vulnerability or claim that
  the three correction commits introduced offline behavior.
- Both reviewers independently found the green-wrapper prose inconsistency;
  Spec also confirmed the cited correction qa-affected.log is absent. The
  duplicate moderate fixture is a non-blocking heuristic, not a hard rule.

## Decision Log

- 2026-10-03 — Use the preceding reviewed apply SHA as the correction baseline;
  it is known from the explicit prior finding/handoff, not a guessed base.
- 2026-10-03 — Keep this independent review separate from the completed apply
  and original review plans; neither is rewritten to masquerade as acceptance.
- 2026-10-03 — No push in this review. Audit remediation/publication remains
  conditional and the latest request is to review the correction.
- 2026-10-03 — Fresh read-only Standards/Spec axes are authorized by the
  applicable code-review skill; direct parent reproduction remains mandatory.
- 2026-10-03 — Reject correction acceptance on reproduced remaining false
  greens, notwithstanding both initial reviewer OK-with-notes verdicts and
  passing focused tests. Do not implement fixes or push in this review.
- 2026-10-03 — Stop short of repeating broad qa:fast/qa:full: decisive defects
  already block acceptance; host shows 705 MiB free / CPU 99%. Retain earlier
  correction QA as its own chronology, not a fresh review pass.

## Validation Ledger

- 2026-10-03 — `git fetch origin`, status/refs/log/stash/worktree: PASS; correction
  HEAD `0e0c8a8`, remote `891ed228`, no tracked changes, preservation scope pinned.
- 2026-10-03 — Pinned `node --version` / `npm --version`: v22.23.2 / 10.9.8.
- 2026-10-03 — Preservation capture: 453 protected entries, 19 source hashes;
  correction receipt HEAD and all five recorded source hashes match.
- 2026-10-03 — Range whitespace, initial plan validator, resume and explicit
  five-file `qa:affected`: PASS; logs in the new review evidence directory.
- 2026-10-03 — Focused Vitest, pinned/maxWorkers=1: PASS 57/57, standalone
  exit/source/toolchain receipt retained; approximately 30 seconds.
- 2026-10-03 — Independent boundary replay: prior seven cases corrected,
  clean/high/grouped/cycle controls correct, actual pinned npm reporter confirms
  configured P2 closure. Five new report cases false-green at seam + actual CLI.
- 2026-10-03 — Actual offline npm/gate: exit 0, clean-shaped JSON and clean
  verdict; same current source/tree online: exit 1 on forge high. Pinned
  Arborist/command source proves registry query is skipped in offline mode.
- 2026-10-03 — Raw correction evidence inspected: 2510/2 Vitest, qa:fast 2113,
  wrapper non-pass/Chromium launch crash and separate 23/23 simulation rerun.
  Corrected-copy/current script differ only by one space in for-loop formatting;
  clean-install lockfile byte identity holds. Standalone static log bodies do not
  contain exit/source receipts; distinguish evidence limits from command failure.
- 2026-10-03 — Windows evidence-tail diagnostic: UnicodeEncodeError (cp1252
  cannot encode U+2713); no input/source mutation. Used read for remaining logs.
- 2026-10-03 — Fresh Standards/Spec review workflow completed; both original
  reports and actual output references/receipt consumed, notes dispositioned.
- 2026-10-03 — Focused plan/docs run: PASS 20/20 (9 + 11), source/toolchain/exit
  receipt retained. OpenSpec 70/70, all-plan validator and active review-plan
  validator PASS; web hygiene PASS (8081/8082 free).
- 2026-10-03 — Preservation/source recheck: PASS 453 protected entries and
  19 reviewed source hashes, zero mismatches; no implementation changes/push.
- 2026-10-03 — Detailed review report and second bounded correction prompt saved;
  scoped Prettier, COMPLETED review-plan/all-plan validation, final hygiene and
  whitespace PASS. Final preservation/acceptance receipt is captured afterward
  without changing the reviewed implementation or the original correction record.

## Changed Files / Areas

- `.agent/execplans/review-windows-dependency-security-correction.md`: new
  independent review checkpoint.
- `simulation-output/security-correction-review-2026-10-03/`: new ignored
  review evidence only; original correction/source/evidence is read-only.

## Recovery / Resume Instructions

Read AGENTS.md, .agent/PLANS.md and this plan completely. Inspect current Git
status, correction range/worktree diffs and fresh evidence. Prepend pinned Node
22.23.2 to PATH and run `npm run agent:resume -- --plan
.agent/execplans/review-windows-dependency-security-correction.md`. Reconcile the
checkpoint with actual files, inspect exact live/terminal reviewer IDs if present,
and continue only from Exact next action; do not relaunch active reviewers.

## Outcomes & Retrospective

- Status: COMPLETED — review BLOCK, no push; bounded second correction handoff.
- Summary: Specific prior seven cases and configured npm audit-level false red
  are fixed, but parent reproduces five further malformed/incoherent report false
  greens and an actual offline-skipped audit false green on the vulnerable tree.
  Both fresh axes initially OK with notes; their independent reports are preserved
  and parent disposition records the additional verified blockers. P2 reporting/
  missing-receipt gaps accepted; duplicate fixture heuristic deferred.
- Evidence: 77 focused tests, OpenSpec 70/70, plans/whitespace/hygiene PASS;
  original controls and failures replayed at real seam/CLI, actual npm reporter
  and offline/online controls exercised; source/preservation bound by final receipt.
- Follow-up: Another authorized agent corrects the remaining boundary/completion
  gaps and necessary evidence claims, validates new source, returns for independent
  re-review without pushing. Forge's truthful online red and NOT CERTIFIED remain
  separate; do not label local actionable audit work exhausted while P1 persists.
- No source/test/config/apply artifact or foreign file changed in this review;
  only this independent review plan and new ignored evidence were written.
