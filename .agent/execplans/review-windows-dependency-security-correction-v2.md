# ExecPlan: Review the second Windows dependency-security correction

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Independently review the second correction on the owner's request, “reveiw it
now.” Verify the prior review's concrete failures, producer-faithful controls,
new edge cases and corrected-source validation/provenance. Deliver an evidenced
acceptance verdict and a bounded correction handoff if needed. Do not change or
publish the reviewed implementation.

## Context

- Repository: `D:/Documents/tryPython/superhabits`, `quantdale/super-habits`.
- Fetched local main/HEAD: `c62c68911a0195d629ebde5bc727d9f632455415`;
  origin/main: `891ed228ffc39f002ac13cc62aad2ee0b69ef1fe`.
- Fixed review base: `0e0c8a8877d8eac852923de9d5ef5f1d06346e89`.
  Two correction commits (`3d4eab8`, `c62c689`), five files, nine unpublished
  commits total; tracked working tree/index clean at startup.
- Contract: `openspec/changes/resolve-windows-dependency-security/` brief,
  spec/design/tasks, apply ExecPlan and final report. Prior review/prompt:
  `simulation-output/security-correction-review-2026-10-03/`.
- Use pinned Node 22.23.2 / npm 10.9.8. Goal mode is inactive.
- New evidence: `simulation-output/security-correction-rereview-2026-10-03/`.
- Preserve prior completed independent review plans, all foreign roots,
  evidence, stash, refs/history, worktree and real index. Overall NOT CERTIFIED,
  canonical 17/22, historical Android/J8 and deferred iOS/production remain.

## Scope

`git diff 0e0c8a8877d8eac852923de9d5ef5f1d06346e89...HEAD`: the audit script,
audit tests and change `tasks.md`, `final-report.md`, `execplan.md`. Read supporting
npm producer and historical evidence as necessary. Parent owns reproductions,
receipt assessment and final disposition; two fresh read-only reviewers assess
Standards and Spec separately. Bind their durable reports through one async
workflow; no implementation writes or independent child orchestration.

## Non-Goals

No implementation fix, dependency change, allowlist/policy weakening, staging,
commit, push, branch/worktree replacement, history rewrite, foreign-state cleanup,
Supabase access, native/iOS work, signing/secrets or unsupported certification.
No broad QA ceremony after a decisive reproducible blocker. Retained validation
is assessed at its own source, not fabricated as fresh reviewer execution.

## Current Checkpoint

- Current milestone: Complete — source-bound review and bounded handoff delivered.
- Completed: preflight/preservation and complete correction reads; fresh reviewers
  both returned OK with notes (two P2 each, one shared receipt issue); parent
  independently replayed 25 inherited/adjacent cases at both seams, all PASS;
  current focused 101/101 PASS; actual pinned npm offline replay proves baseline
  false green 0 → corrected truthful forge red 1 (lower/upper-case env); live audit
  red remains; retained QA bodies inspected. Parent producer-backed two-hop probe
  now proves a separate false green at current seam AND actual CLI.
- In progress: None. The exact retained Spec reviewer accepted the producer-backed
  P1 in a separate supplement and revised its merge verdict to BLOCK. Three P2s
  accepted; detailed review report and bounded correction handoff written.
- Important modified files: this new independent review plan and new ignored
  rereview evidence only. All reviewed implementation/apply/history untouched.
- Last successful validation: focused 101/101, 25-case boundary replay, expected
  actual-npm offline/live controls; OpenSpec 70/70, versioned plans, reviewed-source
  format/whitespace and hygiene PASS; final fetch unchanged and tracked/index
  diffs empty. Review report/handoff formatted. Retained full QA reports success,
  but source-receipt overclaim remains; this is not a fresh parent broad-QA pass.
- Current failures: P1 AUDIT_POLICY_BUG — invalid high parent via a moderate
  intermediary passes 0 at main() and CLI because transitive evidenceRank ignores
  the intermediary's reported bound. Valid high → moderate → moderate producer
  control passes 0; changing only parent to high plus matching counts still passes 0. Evidence: meta-bounds-replay.{json,log} and source-bound receipt.
  P2: universal source-hash receipt overclaim; three-phase QA chronology says twice;
  replay compares eae3dee while described as the second review's 0e0c8a8 base.
- Relevant quarantines: Existing opt-in cloud and E2E skips unchanged.
- Blockers: None for this completed review. Multi-hop validation false green
  prevents implementation acceptance; forge separately prevents publication.
- Condition required to unblock: Correct the bounded multi-hop validation/tests
  and reporting/evidence gaps in another authorized session; no repair in review.
- Exact resume action after unblock: Independent re-review of corrected source.
- Exact next action: None — review complete. Another authorized correction is a
  separate implementation task, not an action hidden in this completed plan.
- Remaining definition of done: Complete — both axes/supplement consumed, inherited
  and producer-backed edge replay, focused/finite gates and impact, retained-QA
  assessment, concrete findings, report/handoff and preservation checks retained.
  Completion validators/receipts bind final artifacts; no acceptance or push.

## Progress

- [x] Pin review scope and reconcile actual source/toolchain/constraints.
- [x] Capture preservation/source evidence and assess the complete correction.
- [x] Consume both independent review axes and parent reproduction evidence.
- [x] Run focused review gates and assess required corrected-source QA receipts.
- [x] Deliver verdict/handoff, verify preservation/hygiene and validate completion.

## Surprises & Discoveries

- The second correction contains two commits and five files; no tracked delta
  remains outside the committed review range.
- Host measured 1239 MiB free / CPU 85%; no unrelated process touched. Resume
  warnings refer to already-protected foreign files and ignored new evidence,
  not newly owned implementation changes.
- All old blockers close, including actual npm offline suppression. Passing focused
  tests still miss a multi-hop evidence-bound defect: the current propagation can
  import high evidence through a moderate intermediary into an impossible high
  parent. This probe uses actual pinned Advisory/Vuln/AuditReport serialization
  with synthetic version-specific advisories; no real registry severity claim.
- Fresh reviewer originals remain OK with notes. The resumed exact Spec reviewer
  independently accepted the parent P1 and revised its verdict to BLOCK in a
  separate supplement. Initial reports remain copied byte-for-byte; managed
  resume output routing reused the original Spec output path, so the supplement
  is saved separately in spec-challenge.md.

## Decision Log

- 2026-10-03 — Review at the original cwd without branch/worktree mutation; the
  owner requested a review, not a writer lane. Parallel reviewers are read-only.
- 2026-10-03 — Keep the implementation/apply and completed review plans historical;
  this review owns a new plan and ignored evidence directory only.
- 2026-10-03 — Delegate two fresh read-only review axes through one workflow,
  bound to standards.md and spec.md outputs. They inspect the five-file correction
  and supporting standards/contract/receipts, report concrete findings under 400
  words each, label smells as heuristic, and do not run broad gates or write source.
  Parent retains reproduction, disposition and publication authority.
- 2026-10-03 — Bound the new finding to intermediary severity leakage, not blind
  equality/max propagation across all meta references. The valid producer-generated
  subset control must continue passing; retain existing global cycle/evidence checks.
- 2026-10-03 — Do not rerun broad/static/build/native acceptance after a decisive
  policy blocker; assess retained QA honestly and run finite review-only gates.
  No budget relaxation, arbitrary retry or unrelated-process termination.
- 2026-10-03 — Resume exact retained Spec run for serious counterexample challenge,
  not a replacement reviewer. Accept its semantic confirmation; preserve both
  initial axes and supplement separately. Parent accepts one P1 and three unique
  P2s; optional duplication smell deferred. Third correction handoff stays bounded
  to intermediate contribution validation/tests and necessary record provenance.

## Validation Ledger

- 2026-10-03 — `git fetch origin`, status/refs/log/diffs/stash/worktree — PASS;
  local `c62c689`, remote `891ed228`, tracked/index clean, original stash/worktree.
- 2026-10-03 — pinned `node --version` / `npm --version` — PASS v22.23.2 / 10.9.8.
- 2026-10-03 — baseline capture — PASS 553 protected entries / 19 source hashes;
  all five correcting-agent receipt hashes match; prior 453 entries unchanged.
- 2026-10-03 — initial resume/plan and explicit five-file qa:affected — PASS;
  warnings reconciled to protected foreign/ignored paths; qa:fast → qa:full and
  focused ExecPlan test selected.
- 2026-10-03 — async two-axis workflow b8b720a6-13c2-495b-81ba-8e959163b55c
  completed; Standards bd09d6b1-0aa9-43d2-acaf-0af97cbebdf7 and Spec
  0b3929ee-cddf-4c69-8c8e-849bab930d4f both OK with notes; original reports retained.
- 2026-10-03 — current focused audit/crypto/plan/docs — PASS 101/101; source/exit
  receipt. Parent boundary replay — PASS 25/25 cases at both seams, prior seven
  stay closed and prior five flip 0 → 1 at the actual 0e0c8a8 review base.
- 2026-10-03 — actual pinned npm offline/live — expected exits 0 (old gate/raw
  skipped audit), 1 (current gate normalized lower/upper-case offline and online).
- 2026-10-03 — producer-generated two-hop meta probe — FAIL as required to expose
  product defect: valid control 0/0; inconsistent high parent 0/0 FALSE GREEN.
  No implementation file changed; complete payloads/producer hashes/receipts saved.
- 2026-10-03 — exact Spec continuation 062f463e-5951-4d45-9c26-52e8417e97d9 —
  complete; accepts producer-backed P1 and BLOCK, read-only supplement saved.
- 2026-10-03 — OpenSpec 70/70, versioned plans, scoped reviewed-file Prettier,
  whitespace and web hygiene — PASS with source-bound command receipts.
- 2026-10-03 — retained correction gates — inspected, NOT freshly executed;
  bodies show 2534 passes/2 skips, E2E 235/49/0, simulation 23/23, newer wrapper
  exit 0; missing tested-source hashes limit binding, not command-execution proof.
- 2026-10-03 — final fetch and tracked/staged diff checks — PASS, source/ref tips
  unchanged; review report/handoff written and review-only formatting PASS.
- 2026-10-03 — preservation-precompletion.json — PASS: 553 protected entries /
  19 source hashes, zero mismatches; branch/HEAD/remote/refs/stash/worktree, exact
  real-index bytes/entries and empty tracked/staged deltas all preserved.
- 2026-10-03 — final resume — PASS; same protected foreign/ignored-path warnings,
  unchanged tracked/index state and source. Final gate receipts bind review files
  as well as eight campaign files. final-review-acceptance.json contains terminal
  validation and final comparison outcomes; broad acceptance remains NOT RUN.

## Changed Files / Areas

- `.agent/execplans/review-windows-dependency-security-correction-v2.md` — review
  state and recovery instructions, separate from implementation history.
- `simulation-output/security-correction-rereview-2026-10-03/` — new ignored
  review evidence, reports and receipts only.

## Recovery / Resume Instructions

1. Read AGENTS.md, required startup guidance, .agent/PLANS.md and this plan fully.
2. Run `npm run agent:resume -- --plan
.agent/execplans/review-windows-dependency-security-correction-v2.md` under the
   pinned toolchain; inspect Git discrepancy warnings and QA impact.
3. Inspect status, diff stat/names and this fixed correction range. Compare source,
   refs/index and protected entries against the rereview preservation baseline.
4. Read latest rereview receipts plus the prior review prompt and change contract;
   reconcile the checkpoint before proceeding from Exact next action.
5. Do not edit reviewed source or old evidence; resume eligible intended reviewers
   if necessary using their exact retained run identities, never replace silently.

## Outcomes & Retrospective

- Status: COMPLETED review; implementation verdict BLOCK, not accepted/published.
- Summary: Previous failures close; producer-backed multi-hop false green remains,
  exact retained reviewer confirms it; three P2 provenance/chronology/identity
  findings accepted. Report and bounded third-correction prompt delivered.
- Proof: Fresh focused 101/101 and boundary 25/25, actual offline/live controls,
  producer subset positive plus false-green negative, finite OpenSpec/plan/format/
  whitespace/hygiene and exact preservation checks. Terminal gate outputs/hashes
  are retained in final-review-acceptance.json; broad/static/build/native not
  rerun after the decisive P1. Historical success is not future-source acceptance.
- Lesson: Bounds must survive each intermediate contribution; reachable aggregate
  severity alone is insufficient, while blind equality breaks genuine subsets.
- Follow-up: Separate authorized session fixes only this boundary and necessary
  records, validates new source and returns for independent re-review without
  pushing. Forge red and certification/foreign-state constraints remain.
