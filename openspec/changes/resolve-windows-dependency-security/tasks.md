## 1. Exact-main preflight and durable campaign state

- [x] 1.1 Read the preserved current brief and repository instructions, fetch first, and record actual status, branch, HEAD, origin/main, 20-commit history, stash/worktree lists and any newer security work before edits.
- [x] 1.2 Select and verify Node 22.23.2 and the intended npm tooling, record the versions, and use that toolchain for every campaign gate.
- [x] 1.3 Inspect the named publication/closure/reconciliation plans and artifacts, package/lockfile, audit script/tests and CI; distinguish historical source evidence from current required behavior.
- [x] 1.4 Capture a preservation baseline for foreign files/links, relevant ignored evidence, stash object, worktrees and canonical task-file hashes; define explicit task-owned edit/staging roots.
- [x] 1.5 Inspect the latest exact-head Actions run and step/job outcomes, reconciling any change from planning-time run 36965502815 without reusing ancestor success.
- [x] 1.6 Activate this change's ExecPlan for apply with exact next action, evidence paths, scope and remaining definition of done; validate it and update it at each meaningful milestone.

## 2. Reproduce the security red and complete exposure evidence

- [x] 2.1 Run the exact audit gate before changes plus full and production-only npm audit JSON; retain raw reports, exit statuses and the precise advisory symptom.
- [x] 2.2 Run installed-path inspection and semantic lockfile/parent-manifest traversal; record every distinct forge path/copy/version, required ranges and production/dev/peer lineage.
- [x] 2.3 Query current advisory and registry metadata, including individual versus aggregate range, severity, patched version, offered fix/major risk and upstream patch/release state; retain dated observations.
- [x] 2.4 Trace every parent's entrypoint, configuration branch and affected verifier call, including certificate/CSR/manifest inputs and low-exponent-key applicability; classify actual execution without inspecting real signing material.
- [x] 2.5 Finish source-bound hermetic web and Android JS module-graph/byte-scan investigation, verify all map sections/output identities and distinguish static-rendering tooling from shipped files; preserve any non-pass rather than claiming absence.
- [x] 2.6 Verify available APK provenance/hash and readable/inflated JS entries with existing scanners, and record edge/server import/output evidence or explicit access limits; do not relabel an unmatched historical APK as current qualification.
- [x] 2.7 Write the complete path/exposure assessment and classify each red result with WHY, CLASSIFICATION, EVIDENCE, WHAT IS REQUIRED and EXACT NEXT ACTION; retain the incomplete planning export as history.

## 3. Compare safe options and select the legitimate branch

- [x] 3.1 Evaluate compatible direct-parent updates against both affected paths, supported framework requirements and release/source evidence; record viable targets or why none exist.
- [x] 3.2 Evaluate a published fixed forge override, verifying all parent ranges, actual API uses, release/advisory provenance and the exact nested-DigestAlgorithm defect; do not invent an unreleased target.
- [x] 3.3 Evaluate the smallest compatible family adjustment and supported unused-path removal/substitution, proving functionality/provenance rather than accepting a framework downgrade or random fork.
- [x] 3.4 Evaluate every narrow-exception predicate explicitly; reject any exception while affected API use, shipped reachability or another predicate is unproven/failed, and preserve the existing new-high/critical policy.
- [x] 3.5 Record the ranked options ledger, selected safe repair and compatibility tests, or evidence that no safe executable vulnerability repair exists; no forced audit fix, broad modernization or product behavior change for CI.
- [x] 3.6 If no safe repair exists after complete investigation, route to the precisely-blocked evidence/report tasks in sections 8–9 with exact upstream condition/resume action; leave unfulfilled repair/publication tasks unchecked and do not claim parser-only success resolves forge.

## 4. Non-vacuous regression and selected dependency repair

Unfulfilled by design: no safe executable vulnerability repair exists (options-ledger.md). These conditional tasks stay unchecked; the dependency-resolution and cryptographic tripwires added under section 5/Phase-F guard the documented state instead.

- [ ] 4.1 For a selected safe candidate, add semantic resolution guards covering every parent/nested copy and demonstrate failure against the reconstructed vulnerable graph or equivalent bad fixture before applying the repair.
- [ ] 4.2 Add vetted synthetic nested-DigestAlgorithm rejection coverage and legitimate RSA/certificate/CSR controls for the selected fixed API or supported replacement; retain red-before/green-after and compatibility evidence without real keys.
- [ ] 4.3 Implement only the selected targeted manifest/lockfile or supported-path repair, retaining before/after versions and paths; do not edit node_modules manually or absorb unrelated lockfile upgrades.
- [ ] 4.4 Run clean dependency reconstruction with `npm ci`, rerun the exact audit and `npm ls node-forge --all`, and verify every installed/locked path is fixed/removed for a legitimate reason.
- [ ] 4.5 Rerun the regression/API compatibility controls against the clean installed candidate, review the complete resolution diff and document rejected alternatives and rollback semantics.

## 5. Fail-closed audit execution boundary

- [x] 5.1 Turn the reproduced registry-error JSON and empty-failed-output false greens into executing tests at the real command/report seam; show that the original gate wrongly passes those equivalent fixtures.
- [x] 5.2 Implement the smallest audit command-result/schema validation seam, rejecting error/empty/malformed/unsupported/signalled/incoherent results while still evaluating valid advisory reports with npm's advisory-related nonzero status. — Reconciled after the independent review proved the first boundary still passed seven invalid/incoherent report shapes; tasks 10.1–10.2 close that gap with explicit schema/coherence validation. — Re-reconciled after the SECOND review proved the schema still accepted five incoherent identity/severity/URL shapes and an offline-skipped audit; tasks 11.1–11.2 close those gaps.
- [x] 5.3 Extend behavioral coverage for valid clean/documented reports, undocumented forge/future critical findings, uncovered paths and new advisory IDs, malformed/transport/termination errors and CLI output/exit semantics; preserve meaningful existing tests and visible documented findings. — Reconciled after the review proved coverage gaps at the same seams; task 10.2 adds the missing executing regressions. — Re-reconciled after the SECOND review proved further coverage gaps; task 11.3 adds the missing seam + CLI regressions with producer-faithful fixtures.
- [x] 5.4 Prove the new tests are red-capable and the repaired seam passes controls/fails errors; rerun the actual live audit, which must remain red if forge is still vulnerable and green only after legitimate complete-path remediation. — Re-earned in the corrective phase: red-before 17 failing tests / green-after 50/50, `repro-replay.json` before/after at seam + CLI, live audit re-run exit 1 (retained red). — Re-earned again (2026-10-03): red-before 16 failing / green-after 74/74 + guards 7/7, `boundary-replay-fixed.json` before/after at seam + CLI for all review payloads, live audit exit 1 (retained red).

## 6. Required local and artifact validation

- [x] 6.1 Resolve `npm run qa:affected -- --files <actual owned paths>`, inspect its current gates and focused suites, and record impact without absorbing foreign untracked evidence.
- [x] 6.2 Run current typecheck, zero-warning lint, exact runtime audit and all unit/integration tests on the pinned toolchain, recording commands actually run, counts and expected skips. — Reconciled: the review found no standalone typecheck/lint receipts; the corrective phase re-ran all of these with retained receipts (E′).
- [x] 6.3 Run `tests/auditRuntimeDeps.test.ts`, the selected semantic/crypto guards and required focused suites; validate all OpenSpec artifacts and versioned plans with the repository commands.
- [x] 6.4 Run required `qa:fast` and broad-resolution/runtime/shared-QA `qa:full` gates, including hermetic build/E2E/deterministic simulations as selected; do not reuse historical QA solely to avoid a long gate.
- [x] 6.5 Recheck current-source web/native/edge/server output/API reachability after the candidate repair using complete module graphs and existing hermetic/ZIP scans; record provenance, coverage and security results.
- [x] 6.6 If actual runtime/native impact requires Android, qualify the committed candidate through the existing clean-checkout hermetic `Nitro_API_36` path and required lanes with source/APK identities; otherwise document retained Android applicability without rerunning it for ceremony, and do not touch iOS.
- [x] 6.7 For every failed gate, preserve/reproduce/classify first, measure resources when relevant, use only supported worker controls and rerun after a justified correction without weakened assertions/timeouts/thresholds or unrelated process termination.

## 7. Scoped fast-forward publication and exact-head hosted gates

Unfulfilled by design: publication requires a proven repaired candidate with green exact-head CI, and the audit gate truthfully remains red while no fixed `node-forge` is published (options-ledger.md). Commits stay local; nothing is pushed.

- [ ] 7.1 After local repair acceptance, review logical commit boundaries, explicit owned staging, status and whitespace before each commit; preserve foreign state and all prohibited-action boundaries.
- [ ] 7.2 Freeze the source-stable repaired candidate, fetch/recheck divergence, publish by normal fast-forward to main only and verify the exact pushed/local/remote SHA without force push or history rewrite.
- [ ] 7.3 Inspect completed Actions quality/audit/unit-integration/E2E results at that exact SHA, expected nightly/PR skips and enforced strict retry-report gates; do not accept skipped E2E after quality failure or cancelled/ancestor success.
- [ ] 7.4 Diagnose any same-lineage security failure exposed by CI and continue only within the narrow scope, preserving failures and stop conditions rather than starting general dependency modernization.
- [ ] 7.5 If later closure-document commits change the publishing tip, validate/publish them normally and require their own final exact-head quality/audit/E2E success; preserve the prior candidate's actual source identity.
- [ ] 7.6 Publish an immutable final commit-linked evidence receipt with full SHA/run/jobs/audit/retry verdict, report permalink and residuals without another needless repository mutation; any subsequent commit requires fresh exact-head proof.

## 8. Canonical reconciliation or precise blocked evidence

- [x] 8.1 Reconcile only necessary security evidence/checkpoint and canonical closure-report/ExecPlan records after actual outcomes, leaving completed historical plans and unrelated change directories untouched.
- [x] 8.2 Preserve overall NOT CERTIFIED, the actual canonical 17/22 ledger/open predicates, source-bound Android results, J8 878 ms history/622-of-800 evidence/800 ms ceiling/15% floor/4.3 NOT_TRIGGERED, and historical full-QA chronology without passing off old counts as current evidence.
- [x] 8.3 Preserve owner-deferred iOS, credential-dependent catalog, originally observed absent recovery inventory, stopped production DDL, default-off AI/account/restore/gap-21 invariants and explicit zero Supabase access/mutation in this campaign.
- [x] 8.4 If precisely blocked, finish the complete paths/exposure/reachability/options proof, explain why audit cannot truthfully pass, name the exact upstream release/parent/substitution condition and exact resume sequence, and retain unfulfilled conditional tasks as non-passes.

## 9. Requirement audit, owner report and final hygiene

- [x] 9.1 Audit the brief, proposal and each normative requirement against direct source/command/artifact/Git/CI evidence, fixing omissions before choosing either terminal branch; no Markdown/status/checkbox-only completion proof. — Reconciled: the review proved two blocking defects this audit had missed; tasks 10.1–10.4 correct them and the requirement table is updated. — Re-reconciled: the SECOND review proved five more false greens plus a skipped-audit false green this audit had missed; tasks 11.1–11.3 correct them and the requirement table is re-updated.
- [x] 9.2 Produce all final report sections A–J with exact repository, root-cause, remediation, security, validation, hosted-CI, regression and existing-closure evidence; distinguish commands not run and all expected/non-pass skips. — Reconciled: the review proved the test-count accounting and CI-identity claims wrong; corrected in C/G/F and §E′. — Re-reconciled: the SECOND review proved the `qa:affected` receipt claim unverifiable and the `qa:fast`/`qa:full` wrapper overclaimed green; corrected in §E′/§E″ and the appendix (task 11.4).
- [x] 9.3 Separate actionable Windows/local, owner, credential/external and deliberately deferred residuals with exact resumes; determine Windows exhaustion from executable work, not overall certification or a parser-only fix. — Re-reconciled (2026-10-03): the second review disproved the earlier local-exhaustion claim while boundary P1s persisted; §I now records that reconciliation and re-earns exhaustion only after the 11.x closure.
- [x] 9.4 Verify foreign content/link hashes, stash/worktree/ref identities, task-owned final diff/status and absence of unrelated changes; retain all failure evidence and do not archive for tidiness.
- [x] 9.5 Run `npm run web:hygiene`, verify no owned server/process tree remains and ports 8081/8082 are free or have unrelated owners; clean up only exact owned processes.
- [x] 9.6 Record exactly one earned campaign verdict, WINDOWS SECURITY FOLLOW-UP COMPLETE or PRECISELY BLOCKED, preserve overall NOT CERTIFIED, and update/validate the durable checkpoint without inventing CI or publication results.

## 10. Independent-review corrections (2026-10-02 corrective phase)

Reconciliation of this change's checked audit/validation/report tasks against
the independent review's proven gaps
(`simulation-output/security-review-2026-10-02/review-report.md` and
`correction-prompt.md`). Conditional dependency-repair (4.x) and publication
(7.x) tasks remain genuinely unchecked.

- [x] 10.1 P1 — make the supported npm report schema explicit and fail closed on invalid/incoherent reports: auditReportVersion 2 only, known severity enums, non-empty via (advisory or resolved reference), usable non-empty dependency paths, non-negative integer metadata counts coherent with the reported findings, via references resolving to usable advisory evidence (dangling references and evidence-free cycles rejected), plus vacuous empty-path protection in `isDocumented`.
- [x] 10.2 P1 — permanent executing seam AND real-CLI regressions for all seven review false-green fixtures plus the reference-cycle case, with valid grouped-meta and multi-advisory controls preserved; red-before/green-after demonstrated (17 tests red on the pre-correction seam; per-fixture before/after at both seams in `simulation-output/security-correction-2026-10-02/repro-replay.json`).
- [x] 10.3 P2 — normalize the npm audit exit threshold explicitly (`--audit-level=info` + matching `npm_config` override) so inherited npm configuration cannot flip valid lower-severity reports into false reds; keep the any-finding/status-1 invariant and keep refusing exit 0 with findings; CLI regression with inherited `audit-level=critical` proves the report-only verdict end to end.
- [x] 10.4 P2 — reconcile final evidence identity: run 36965502815 relabeled remote-baseline historical CI (never CI at the unpublished local tip), immutable post-commit final-state receipt (final local SHA, remote SHA, dirty status, commit list), corrected test accounting (27 = 4 policy-text + 23 executing at apply; 50 = 4 + 46 after correction), and re-attested pinned-toolchain / clean-install / parent-query / source-identity receipts.
- [x] 10.5 Validate corrected source on the pinned toolchain: focused audit + guard suites, typecheck 0, zero-warning lint, full unit/integration, OpenSpec 70/70, versioned-plan validation, `qa:affected` → `qa:fast` → `qa:full` with preserved non-passes and reruns recorded, final web hygiene. — Re-reconciled (2026-10-03): the second review found the cited correction `qa-affected.log` receipt absent and the standalone typecheck/lint receipts incomplete; those claims are narrowed/handled in task 11.4 and re-earned with full receipts in 11.6.
- [x] 10.6 Preserve foreign state (125 files/8 roots + review evidence + pre-existing formatting delta), commit only task-owned paths locally, and hand the corrected work back for independent re-review without pushing.

## 11. Second independent-review corrections (2026-10-03 corrective phase)

Reconciliation of this change's checked audit/validation/report tasks against
the second independent review's proven gaps
(`simulation-output/security-correction-review-2026-10-03/{review-report,correction-prompt}.md`).
Conditional dependency-repair (4.x) and publication (7.x) tasks remain
genuinely unchecked. — Re-reconciled (2026-10-03 third review): the re-review
disproved local exhaustion once more with a producer-backed multi-hop severity
false green plus three P2 record gaps; section 12 closes them, and local
exhaustion is re-earned only after independent re-review of that correction.

- [x] 11.1 P1 — validate report identity/severity/URL coherence against the supported producer schema before any clean or documented verdict: finding key == body name == advisory `name`/`dependency` (direct advisories only; meta references stay strings), usable http(s) advisory URLs with a non-empty final path segment as the advisory id, explicit advisory severity enums, outer severity never below its explicit advisory severities, and meta-reference severities bounded by the advisory evidence their chains actually reach (fixed-point over references; legitimate meta parents BELOW their referenced findings' aggregate severity stay valid, evidenced cycles stay supported). No allowlist expansion, no meta-parent reclassification as a new direct advisory, no provider-policy invention.
- [x] 11.2 P1 — normalize inherited npm offline suppression so a skipped audit can never become a successful clean verdict: `--offline=false` plus the matching `npm_config_offline` override on the command boundary (npm config precedence validated against the pinned npm for CLI/env and project/user `.npmrc` channels; case-variant env dedupe); genuine registry failures still fail visibly through the existing transport/error path; lower-severity report-only behavior and `--audit-level=info` normalization preserved.
- [x] 11.3 Permanent red-capable seam AND real-CLI regressions: the five remaining review false-green shapes plus the severity-laundering cycle at both seams, inherited-offline CLI regressions (env + npmrc channels) with a pinned-producer shim model (skip shape + config precedence, not the fix), an un-normalized false-green demonstration, and producer-model self-tests; grouped-meta/documented-meta/evidenced-cycle/meta-below-leaf/scoped-name controls preserved; producer-unfaithful synthetic fixtures corrected (advisory `name`/`dependency` identity, aggregate/advisory severity consistency) with their original assertions intact; red-before 16 failing / green-after 74/74 + guards 7/7 (`simulation-output/security-correction-2026-10-03/`).
- [x] 11.4 P2 — reconcile report/receipt truth: the correction-time `qa:affected.log` claim marked unverified (receipt absent) and replaced by a truthful receipted rerun at the second-correction source; the `qa:fast`/`qa:full` wrapper/stage/rerun chronology described exactly (correction-time wrapper non-pass preserved, simulation rerun 23/23 separate — never relabeled green); standalone typecheck/lint claims narrowed to their retained log bodies with new full command/exit/toolchain/source receipts at the second-correction source.
- [x] 11.5 P2 — recompute test accounting at corrected source (audit file 74 = 5 policy-text + 69 executing (42 seam + 27 CLI); focused parent 81 = 74 + 7 guards; plan/docs 20 separate) and reconcile the checked 5.x/9.x/10.x and terminal local-exhaustion claims with the review's proven remaining gaps, preserving the genuinely conditional unchecked 4.x/7.x. — Re-reconciled (2026-10-03 third review): recomputed again at the third-corrected source — audit file **80 = 5 policy-text + 75 executing (45 seam + 30 CLI)**, focused parent **87 = 80 + 7 guards**; plan/docs 20 separate.
- [x] 11.6 Validate corrected source on the pinned toolchain: focused seam/CLI/crypto + plan/docs suites, typecheck 0, zero-warning lint, full unit/integration, OpenSpec and versioned-plan validation, owned-path `qa:affected` → `qa:fast` → `qa:full` with preserved non-passes recorded, actual-npm offline/online receipts, boundary replay of every review payload at both seams, final preservation re-verification and `web:hygiene`.
- [x] 11.7 Preserve foreign state and all prior evidence (no overwrite of previous repro/QA logs or the review's artifacts), commit only task-owned paths locally, and hand the corrected work back for independent re-review without pushing.

## 12. Third independent-review corrections (2026-10-03 corrective phase)

Reconciliation of this change's checked audit/validation/report tasks against
the third independent review's proven gaps
(`simulation-output/security-correction-rereview-2026-10-03/{review-report,correction-prompt}.md`).
Conditional dependency-repair (4.x) and publication (7.x) tasks remain
genuinely unchecked.

- [x] 12.1 P1 — bound the evidence propagated through every `via` reference hop at the referenced finding's own reported severity over an evidence-anchored least fixed point (`min(anchoredEvidence, referencedFinding.severity)`), so a high advisory reachable only through a moderate intermediary can never justify an impossible high meta-parent and self-supporting reference cycles cannot bootstrap severity from claimed severities alone; legitimate subset shapes (parents below referenced aggregates), evidenced cycles, multiple contributors, explicit advisory minimums, aliases/scoped names and the documented group leaf all stay supported; no allowlist expansion, no meta-parent reclassification, no parent/child equality requirement.
- [x] 12.2 P1 — permanent red-capable main/seam AND CLI negatives for the producer-faithful two-hop impossible-parent payload and the high-through-lower-intermediary self-supporting cycle, each requiring audit-execution failure and the absence of clean/documented-success verdicts (not exit 1 from an unrelated leaf), with the producer-faithful two-hop subset control retained at both seams; the meta-parent-below-leaf control reworked to the producer's genuine mixed-advisory/version subset shape with its assertions' purpose preserved; red-before 4 failing against `c62c689` / green-after 80/80 + guards 7/7; producer and inherited payloads replayed at both seams for pre-fix and corrected sources (`security-correction-third-2026-10-03/replay-third.json`, 26/26 expected outcomes).
- [x] 12.3 P2 — receipt-completeness truth: the universal "command + exit + source-hash + HEAD per gate" claim narrowed in final-report §E″ and the ExecPlan ledger (the qa-full/qa-fast/qa-affected receipts have no tested-source hash and HEAD ≠ candidate identity; the npm-test receipt hashes dirty `git status` output; the focused/typecheck-lint digest scope is unrecoverable), with the recoverable binding identified (post-commit `final-state-receipt.json` + Git history) and every third-correction gate earning complete command/exit/toolchain/content receipts (before/after owned-file hashes + dirty-state context).
- [x] 12.4 P2 — replay-baseline truth: `boundary-replay-fixed.{json,log}` relabeled to its actual pre-first-correction `eae3dee` base (where the original seven were still false greens) in final-report §E″/§G/appendix and ExecPlan checkpoint/ledger, with the actual `0e0c8a8`-base replay attributed to the re-review's own later artifacts; the old artifact is preserved, not overwritten.
- [x] 12.5 P2 — qa:full chronology truth: final-report §H records three attempts (apply green; first-correction wrapper non-pass + separate simulation-only rerun; second-correction end-to-end success) with their source/receipt limits, and the requirement table/tasks/checkpoint/local-exhaustion claims are reconciled with the new P1 and evidence gaps; conditional 4.x/7.x remain genuinely unchecked.
- [x] 12.6 Validate corrected source on the pinned toolchain with complete receipts (focused audit/crypto/plan/docs suites 87/87 + 20/20, typecheck 0, zero-warning lint 0/0, scoped Prettier, full unit/integration 2540 passed / 2 pre-existing opt-in skips, OpenSpec 70/70 and versioned-plan validation PASS, owned-path `qa:affected` → `qa:fast` PASS → `qa:full` PASS end-to-end with hermetic build:e2e, E2E 235 passed / 49 skipped / 0 failed and simulation 23/23), retain the live audit red (`gate-live-third.log`), re-verify preservation (553/553 + 19/19)/whitespace/hygiene (8081/8082 free), commit only task-owned paths locally, and hand the corrected work back for independent re-review without pushing.
