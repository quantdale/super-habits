# ExecPlan: Apply the Windows dependency-security follow-up

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Apply the OpenSpec change `resolve-windows-dependency-security`: implement the
campaign described by the preserved brief
(`source-brief.txt`, SHA-256 `0bf3df7b16a78e205d56913c1caca9c60bc9680e31da550ae7ff869d3cba4df4`)
against current `main`, working all 51 tasks of [tasks.md](tasks.md) to a
truthful terminal state: either the dependency-security blocker is legitimately
resolved and exact-head CI is green, or no safe executable repair exists and the
campaign ends `PRECISELY BLOCKED` with complete proof and an exact upstream
resume condition. Either way the audit gate is never faked green and overall
certification stays **NOT CERTIFIED**.

This plan previously (2026-10-02) completed its planning-only lifecycle; that
history is preserved below. It is now re-activated for **apply** on the owner's
explicit request (`D:\Downloads\superhabits.md`).

2026-10-02: re-activated again for the **independent-review corrective
phase** (`simulation-output/security-review-2026-10-02/{review-report,correction-prompt}.md`):
correct only the audit boundary/tests and the necessary evidence/report/
checkpoint claims, then hand the corrected work back for independent
re-review without pushing.

2026-10-03: re-activated again for the **second independent-review
corrective phase**
(`simulation-output/security-correction-review-2026-10-03/{review-report,correction-prompt}.md`):
correct the remaining fail-closed boundary/completion gaps (report
identity/severity coherence and inherited-offline skipped-audit false
greens) plus the necessary report/receipt claims, then hand the corrected
work back for independent re-review without pushing.

## Context

- Change artifacts: [exploration](exploration.md), [proposal](proposal.md),
  [design](design.md), [spec](specs/dependency-security-closure/spec.md),
  [tasks](tasks.md), verbatim [brief](source-brief.txt).
- Apply start: `main == origin/main == HEAD == 891ed228ffc39f002ac13cc62aad2ee0b69ef1fe`
  after fetch (re-verified 2026-10-02). Working branch
  `docs/windows-dependency-security-proposal` is at the same commit; the
  proposal files were untracked planning artifacts (now committed with the
  campaign work).
- Live red: `node scripts/audit-runtime-deps.mjs` exits 1 on
  `[UNDOCUMENTED] high node-forge GHSA-86w9-cpqp-85rv [node_modules/node-forge]`.
- Dependency graph (re-verified at apply): one installed/locked
  `node-forge@1.4.0` at `node_modules/node-forge` (lock entry has no `dev:true`),
  two parent paths through `expo@55.0.31 -> @expo/cli@55.0.36`:
  direct `node-forge@^1.3.3` and `@expo/code-signing-certificates@0.0.6 ->
node-forge@^1.3.3`.
- Upstream state (re-queried 2026-10-02): npm `node-forge` latest is **1.4.0**
  (still vulnerable); GitHub advisory `GHSA-86w9-cpqp-85rv` = CVE-2026-85393,
  HIGH, range `<= 1.4.0`, `first_patched_version: null`; npm aggregate range `*`;
  upstream fix PR `digitalbazaar/forge#1152` remains **open/unmerged** (head
  `ceba34402e329f0365134f23fe19898756527d65`); every `@expo/cli` release from
  55.x through 58.1.1 still requires `node-forge@^1.3.3` +
  `@expo/code-signing-certificates@^0.0.6`; helper 0.0.7 requires `^1.4.0`.
- Toolchain: Node `v22.23.2`, npm `10.9.8` from
  `/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64` (prepend to PATH for
  every campaign gate; ambient Node 24 is not gate evidence).
- CI: run `36965502815` at exact HEAD `891ed228` is the latest main run —
  `quality` FAILED at `Audit runtime dependencies`, `e2e` skipped (because
  quality failed), `nightly` skipped. Re-verified at apply; no newer run.
- Raw apply evidence: `simulation-output/security-apply-2026-10-02/` (ignored).
  Planning evidence preserved in `simulation-output/security-explore-2026-10-02/`.
- Foreign-state baseline: 125 files across eight untracked roots (iOS extract +
  seven earlier change directories), captured with per-file SHA-256 in
  `preservation-baseline-apply.json`; stash `pre-recovery-local-changes`
  (`c35e281d740df1e367c1be0f38383237ca080239`) untouched; one worktree.

## Scope

Tasks 1–9 of this change: preflight/evidence, complete exposure proof, options
ledger and branch selection, conditional dependency repair (only if a safe
published fix exists), the fail-closed audit execution seam with behavioral
tests, required local/artifact validation, conditional fast-forward publication
with exact-head CI, canonical reconciliation or precise-blocked evidence, and
the final A–J owner report with hygiene. Task-owned edit roots:
`scripts/audit-runtime-deps.mjs`, `tests/auditRuntimeDeps.test.ts`,
`package.json`/`package-lock.json` (only for an evidenced dependency repair),
security-audit documentation, this change's artifacts,
`openspec/changes/final-certification-closure/{closure-report,execplan}.md` and
this plan. Evidence tooling lives under
`simulation-output/security-apply-2026-10-02/` (ignored).

## Non-Goals

No Supabase access or mutation, production DDL, iOS action, secrets/signing
changes, forced `npm audit fix`, broad security exemptions, broad dependency
modernization, framework migration, product behavior change for CI, weakened
tests/budgets/timeouts, foreign-state cleanup, stash mutation, force push or
history rewrite, or archiving for tidiness. Android is requalified only when
actual impact requires it.

## Current Checkpoint

- Current milestone: COMPLETED — second corrective phase (2026-10-03 review)
  finished: both remaining P1 mechanisms fail closed with red-capable
  regressions at the real seam and the actual CLI, P2 report/receipt truth is
  reconciled, all corrected-source gates pass on the pinned toolchain, and the
  corrected work is handed back for independent re-review. Nothing was pushed.
- Completed: startup docs, the second review's report/correction prompt and
  this plan reconciled against actual git state (`0e0c8a8` local main,
  `891ed228` origin/main, seven unpublished commits); pinned Node 22.23.2 /
  npm 10.9.8; actual-npm reproduction of the inherited-offline false green
  plus CLI/env/project-npmrc config-precedence probes; permanent seam + CLI
  regressions written FIRST and proven red (16 failing of 74) against the
  pre-fix source; identity/severity/URL coherence validation and offline
  transport normalization implemented with no allowlist/policy change;
  producer-unfaithful synthetic fixtures corrected (advisory `name`/
  `dependency` identity, aggregate/advisory severity) with original
  assertions intact; green-after 74/74 + guards 7/7; independent boundary
  replay of all 17 review payloads at baseline AND corrected source (the five
  new false greens exit 0 → 1 at both seams, the original seven stay closed,
  documented/grouped-meta/evidenced-cycle/meta-below-leaf/scoped-name controls
  preserved, P2 control decided by the actual pinned npm reporter);
  actual-npm end-to-end receipts (normalized offline exits 1 on the real
  report, case-variant env covered, live red retained); typecheck 0,
  lint 0/0, full unit+integration 2534 passed / 2 pre-existing skips,
  focused 81/81 + plan/docs 20/20, OpenSpec 70/70, versioned-plan validation,
  owned-path `qa:affected` receipt (`qa:fast → qa:full` + focused plan test),
  `qa:fast` PASS, `qa:full` **PASS end-to-end** (typecheck/lint/tests 2534-2/
  OpenSpec 70/70 → hermetic `build:e2e` → `e2e:full` 235 passed / 49 skipped /
  0 failed (29.4 m) → deterministic simulation all 23 scenarios passed), and
  the P2 reconciliation of §E′/§E″/appendix/task/checkpoint claims.
- In progress: None.
- Important modified files: `scripts/audit-runtime-deps.mjs` (advisory/
  package/URL identity + severity coherence validation; offline transport
  normalization with case-variant env dedupe), `tests/auditRuntimeDeps.test.ts`
  (+24 regressions, +2 fixture-fidelity corrections with assertions intact),
  this change's `tasks.md` (11.1–11.7 + reconciliations), `final-report.md`
  (§E″ + corrected claims) and this plan. No product/UI/schema/dependency
  changes; allowlist and advisory policy byte-unchanged.
- Last successful validation: the complete second-correction battery —
  `qa:full` PASS end-to-end at corrected source (receipt in
  `simulation-output/security-correction-2026-10-03/gates-receipt-qa-full.log`),
  focused 81/81, plan/docs 20/20, OpenSpec 70/70, plan validation PASS,
  boundary replay 17/17 (`boundary-replay-fixed.json`), full unit+integration
  2534 passed / 2 skips, typecheck 0, lint 0/0.
- Current failures: the live audit gate remains exit 1
  (`DEPENDENCY_VULNERABILITY` — the upstream blocker itself, expected and
  retained; `gate-live-postfix.log`).
- Relevant quarantines: None changed; the two opt-in cloud skips remain.
- Blockers: unchanged upstream — no published fixed `node-forge` (latest 1.4.0
  affected, `first_patched_version: null`, CLI 55.0.36/57.0.27 keep
  `node-forge@^1.3.3`, helper 0.0.7 keeps `^1.4.0`, PR 1152 open/unmerged).
- Condition required to unblock: (upstream, unchanged) a published,
  independently verified compatible fixed `node-forge` release, or a supported
  parent release removing both vulnerable paths, or a proven safe supported
  substitution.
- Exact resume action after unblock: (upstream resume, unchanged) follow
  final-report.md section I; re-query state before any repair attempt.
- Exact next action: None — task complete.
- Remaining definition of done: None for the second correction itself. The
  close-out task-owned commits land immediately after this checkpoint and the
  post-commit `simulation-output/security-correction-2026-10-03/final-state-receipt.json`
  records the final local/remote SHA, dirty status, commit list and the final
  preservation/hygiene recheck as the immutable handoff identity. Conditional
  tasks 4.x and 7.x remain unchecked by design; overall NOT CERTIFIED,
  canonical 17/22, historical Android/J8, deferred iOS and production limits
  are intact.

## First-correction checkpoint (2026-10-02, preserved)

- Current milestone: COMPLETED — corrective phase finished: the independent
  review's P1 (invalid/incoherent reports producing false security greens) and
  P2 (npm exit-threshold semantics producing a false red) are corrected with
  permanent executing regressions, evidence identity is reconciled, and the
  corrected work is handed back for independent re-review. Nothing was pushed.
- Completed: everything in the prior corrective checkpoint, plus the
  deterministic-simulation rerun (**23/23** including `soak-sustained-use` —
  the first-attempt crash classified ENVIRONMENT: chromium launch under
  measured memory pressure), scoped Prettier, final lint 0/0, focused suites
  68/68 (50 audit + 7 guards + 11 doc-consistency), OpenSpec 70/70,
  versioned-plan validation, foreign-state re-verification (368 entries,
  0 mismatches) and `web:hygiene` PASS (8081/8082 free).
- In progress: None.
- Important modified files: `scripts/audit-runtime-deps.mjs` (corrected
  boundary; the pre-existing formatting-only delta is folded in,
  behavior-identical per the review), `tests/auditRuntimeDeps.test.ts`
  (+23 regressions), this change's `tasks.md` / `final-report.md` / this
  plan. No product/UI/schema/dependency changes; the allowlist and advisory
  policy are untouched.
- Last successful validation: the full battery in the Validation Ledger below
  — red-before 17 failing / green-after 50/50, `repro-replay.json` closing all
  seven review false greens at seam + real CLI, live audit retained red,
  `npm ci` clean with byte-identical lockfile, `qa:fast` PASS, `qa:full`
  stages green with the one preserved ENVIRONMENT non-pass rerun 23/23.
- Current failures: the live audit gate remains exit 1
  (`DEPENDENCY_VULNERABILITY` — the upstream blocker itself, expected and
  retained). That is the precise blocker, not a broken gate.
- Relevant quarantines: None changed; the two opt-in cloud skips remain.
- Blockers: unchanged upstream — no published fixed `node-forge` (latest 1.4.0
  affected, `first_patched_version: null`, CLI 55.0.36/57.0.27 keep
  `node-forge@^1.3.3`, helper 0.0.7 keeps `^1.4.0`, PR 1152 open/unmerged).
- Condition required to unblock: (upstream, unchanged) a published,
  independently verified compatible fixed `node-forge` release, or a supported
  parent release removing both vulnerable paths, or a proven safe supported
  substitution.
- Exact resume action after unblock: (upstream resume, unchanged) follow
  final-report.md section I; re-query state before any repair attempt.
- Exact next action: None — task complete.
- Remaining definition of done: None for the correction itself. The close-out
  task-owned commits land immediately after this checkpoint and the post-commit
  `simulation-output/security-correction-2026-10-02/final-state-receipt.json`
  records final local/remote SHA, dirty status, commit list and the final
  preservation/hygiene check as the immutable handoff identity. Conditional
  tasks 4.x and 7.x remain unchecked by design.

Apply-phase terminal state (preserved): the campaign finished on the earned
`PRECISELY BLOCKED` branch at `eae3dee` — see Progress, the Validation Ledger
and Outcomes below for the complete apply record.

## Progress

Apply milestones:

- [x] 1. Preflight, toolchain, preservation baseline, CI reconciliation, plan activation (1.1–1.6)
- [x] 2. Reproduce red + complete exposure evidence (2.1–2.7)
- [x] 3. Options ledger and branch selection (3.1–3.6) — no safe repair; routed to precise-blocked
- [x] 4. Dependency-repair disposition (tasks 4.1–4.5) — no safe candidate exists; the conditional tasks.md items remain unchecked by design
- [x] 5. Fail-closed audit execution seam + behavioral tests (5.1–5.4)
- [x] 6. Required local and artifact validation (6.1–6.7)
- [x] 7. Publication disposition (tasks 7.1–7.6) — withheld: audit red, no push; the conditional tasks.md items remain unchecked by design
- [x] 8. Canonical reconciliation + precise-blocked evidence (8.1–8.4)
- [x] 9. Requirement audit, A–J report, residuals, hygiene, verdict (9.1–9.6)

Corrective phase (2026-10-02 independent review):

- [x] C1. Reactivate from the correction prompt; pin git state and the correction preservation baseline.
- [x] C2. P1 — explicit supported report schema/coherence validation + vacuous empty-path guard (tasks 10.1).
- [x] C3. P2 — normalize the npm audit exit threshold (tasks 10.3).
- [x] C4. Permanent seam + real-CLI regressions; red-before/green-after and the replay artifact (tasks 10.2).
- [x] C5. Evidence-identity reconciliation plus report/task checkpoint corrections (tasks 10.4).
- [x] C6. Finish validation (deterministic-simulation rerun 23/23, plan validation) and hand back for re-review (tasks 10.5–10.6).

Second corrective phase (2026-10-03 independent review):

- [x] D1. Reactivate from the second correction prompt; reconcile git state/toolchain and reproduce the inherited-offline false green + config precedence with the actual pinned npm.
- [x] D2. Write permanent seam/CLI regressions first and prove red (16 failing of 74) against the pre-fix source.
- [x] D3. P1 — advisory/package/URL identity + severity coherence validation (fixed-point meta bounds; legitimate subset semantics preserved).
- [x] D4. P1 — normalize inherited npm offline suppression on the transport (`--offline=false` + `npm_config_offline`, case-variant dedupe).
- [x] D5. Boundary replay of every review payload at both seams + actual-npm end-to-end receipts (tasks 11.1–11.3).
- [x] D6. P2 report/receipt truth reconciliation + recomputed test accounting (tasks 11.4–11.5).
- [x] D7. Full corrected-source validation (`qa:fast`, `qa:full` PASS end-to-end, OpenSpec/plans) and hand back for re-review without pushing (tasks 11.6–11.7).

Planning history (2026-10-02, completed planning-only request — preserved):

- [x] Read instructions, skills and the complete current brief.
- [x] Explore repository, exact-head CI, audit, dependencies and applicability.
- [x] Establish evidence-backed options, safety predicates and research gaps.
- [x] Create the CLI-resolved change scaffold on a dedicated planning branch.
- [x] Capture exploration/source and create the proposal.
- [x] Create normative specs, implementation design and unchecked apply tasks.
- [x] Validate coverage, artifacts and affected planning QA.
- [x] Audit preservation/hygiene and close the planning checkpoint.

## Surprises & Discoveries

- The downloaded file has changed since the earlier reconciliation campaign;
  its previous hash is not authority for this security brief.
- Latest published forge is already installed and vulnerable. Advisory API
  reports `<= 1.4.0`, no patched version; npm's grouped range is `*` and its
  offered `expo@44.0.6` is a breaking downgrade, not a safe fix.
- Certificate helper 0.0.7 still requires vulnerable forge; all inspected
  stable CLI 55 releases and latest CLI 57/58 retain the forge dependency.
- Tooling executes certificate/public-key verification. "Not imported by app"
  cannot satisfy the brief's affected-API-unused exemption predicate.
- Existing web/native scans are byte-needle scanners, not dependency module
  graphs. The APK found on disk has a different hash from the retained green
  Android build record; do not transfer that record's source identity to it.
- Fresh optional export did not finish under measured host contention at
  planning time. Its incomplete output must not be used as absence/reachability
  proof. (Apply-time: the fresh web export DID complete and is now analyzed;
  the Android JS export is running.)
- Executing the unchanged audit CLI with controlled command-result fixtures
  proved a separate false-green defect: parseable npm error JSON and empty
  failed output exit 0. The live forge report still correctly exits 1. Propose
  a narrow fail-closed boundary with semantic tests; this is not a forge fix.
- Apply-time re-query (2026-10-02): registry/advisory/parent/upstream state is
  unchanged from planning — no published fix exists anywhere in the chain.
- 2026-10-02 independent review: seven malformed/incoherent report shapes
  produced false security greens and a valid configured-npm moderate report
  produced a false red — the report schema/coherence and the audit exit
  threshold were the missing pieces, not the advisory policy. The review's
  "23 seam + 5 CLI / 28 executing" claim was an accounting miscount
  (27 = 4 policy-text + 23 executing).
- 2026-10-02 host state: severe memory pressure (137 MiB free of 32 GiB,
  CPU 68 %) crashed chromium at launch inside the deterministic-simulation
  lane (exit `0xC0000142`) — the same ENVIRONMENT class as the review's
  lint timeout; unrelated consumers were not touched.

## Decision Log

- 2026-10-02 — Treat the file as future campaign requirements, not permission
  to skip the explicitly requested explore/propose sequence and apply now.
- 2026-10-02 — Use a bounded new security successor; leave the canonical
  17/22 ledger and old reports unchanged during planning.
- 2026-10-02 — Prefer compatible dependency/parent remediation; reject a
  build-only waiver while the affected API remains used. Define an honest
  blocked outcome if current upstream evidence still offers no safe repair.
- 2026-10-02 — Run direct investigation; optional parallel lanes were not
  needed and no subagents were launched.
- 2026-10-02 — Record the export timeout and measured resources, do not raise
  test budgets or kill unrelated consumers to manufacture artifact proof.
- 2026-10-02 — Re-activate this plan for apply on the owner's explicit request;
  re-verify every planning-time fact before relying on it (all held).
- 2026-10-02 — Corrective phase: normalize the npm audit exit threshold with
  `--audit-level=info` (plus the `npm_config` override) instead of trusting
  exit 0 with findings; keep the any-finding/status-1 invariant fail-closed.
- 2026-10-02 — Validate the report schema explicitly (version 2, severity
  enums, count coherence, reference resolution) rather than adding ad-hoc
  shape checks; reject dangling references and evidence-free cycles.
- 2026-10-02 — Keep every review repro fixture as a permanent seam AND
  real-CLI regression; prove red-before against the pre-correction seam
  instead of asserting coverage in prose.
- 2026-10-02 — Label run 36965502815 remote-baseline historical CI and
  record final identity in a post-commit receipt instead of embedding
  hashes before the commits exist.
- 2026-10-02 — Do not push; hand the corrected work back for independent
  re-review per the correction prompt.
- 2026-10-03 — Validate producer identity/severity coherence with BOUNDS
  (explicit-advisory minimum, evidence-backed maximum over the reference
  graph) instead of exact equality: npm legitimately reports meta parents
  below their referenced findings' aggregate severity when only some child
  advisories apply, and blind equality would reject those real reports.
- 2026-10-03 — Normalize npm `offline` on the transport (`--offline=false` +
  the `npm_config_offline` override, case-variant env dedupe) rather than
  trying to detect a skipped audit from its clean-shaped report: the pinned
  producer serializes the same shape either way, so completion must be
  enforced at the command boundary, with genuine request failures still
  failing visibly through the transport/error path.
- 2026-10-03 — Keep the permanent offline tests network-free with a shim that
  models the pinned producer's skip shape and npm's verified config precedence
  (flag > env > project/user config) — proven by self-tests and actual-npm
  probes — instead of copying the gate's own normalization into the shim.
- 2026-10-03 — Correct producer-unfaithful synthetic fixtures (advisory
  `name`/`dependency` identity, aggregate/advisory severity) in place with
  their original assertions and purpose intact; keep intentionally invalid
  identity/severity fixtures negative.
- 2026-10-03 — Reconcile the P2 claims to the retained evidence: mark the
  missing correction `qa:affected` receipt unverified (with a truthful
  receipted rerun), never relabel the correction-time `qa:full` wrapper green
  from its stage results or its separate simulation rerun, and narrow the
  standalone typecheck/lint claims while re-running both with full receipts.
- 2026-10-03 — Do not push; return for independent re-review per the second
  correction prompt.

## Validation Ledger

Apply (2026-10-02):

- `git fetch origin` + status/ref/history/stash/worktree inventory — PASS;
  `891ed228` everywhere, no newer remote commit, 8 foreign roots unchanged.
- `node --version` / `npm --version` (pinned PATH) — PASS; v22.23.2 / 10.9.8.
- `gh run view 36965502815` + `gh run list --branch main` — READ; audit-only
  failure at exact HEAD is still the latest main run; no rerun/newer commit.
- `node scripts/audit-runtime-deps.mjs` — REPRODUCED exit 1;
  `npm audit --json` / `--omit=dev --json` — exit 1; raw reports retained.
- `npm ls node-forge --all`, `npm explain node-forge`, semantic lockfile
  traversal — PASS; one copy (`node_modules/node-forge@1.4.0`, no dev marker),
  two parent paths (`@expo/cli@55.0.36` direct + via helper 0.0.6), root
  production dependency `expo@~55.0.31`.
- Registry/advisory/upstream re-query (`npm view`, GitHub advisory API, forge
  tags/releases, PR 1152, `@expo/cli` 55→58 manifests) — READ; no published
  fixed version; `first_patched_version: null`; PR open/unmerged; parents
  unchanged.
- Installed-source API trace (helper `build/main.js`, CLI `utils/codesigning.js`,
  `ExpoGoManifestHandlerMiddleware`, `run/ios/codeSigning/Security.js`, forge
  `lib/rsa.js` 1142–1200 + `digestInfoValidator`) — READ; affected
  RSASSA-PKCS1-v1_5 verification reachable from tooling; nested DigestAlgorithm
  element count not validated at installed 1.4.0.
- Fresh hermetic web export with external source maps (pinned toolchain, no
  ambient `EXPO_PUBLIC_*`, `--max-workers 2`) — PASS; 3 map sections
  (entry 1969 + worker 22 + todoNotificationActions 1 module sources), zero
  `node-forge`/`code-signing-certificates` modules, only
  `@expo/cli/build/metro-require/require.js`; zero byte needles across 74
  files; `export-web-analysis.json` + identities retained. Static-rendering
  graph (router-server `render.js`) is transient build tooling and is absent
  from shipped output.
- Historical APK rescan with entry-completeness proof
  (`apk-forge-scan.json`, `apk-all-entry-scan.json`) — PASS-as-supplementary;
  1630/1630 entries inflated, zero forge signatures; provenance mismatch
  preserved (on-disk `F3D9A63C…` vs certified `E6E55ED5…` at source
  `7a6aeb22`), so no qualification is transferred.
- Preservation baseline (125 files, 8 roots, per-file SHA-256) — PASS;
  `preservation-baseline-apply.json`.
- Product source + `supabase/functions` forge search — clean (no imports).

Correction (2026-10-02 independent review):

- `git fetch` + status/stash/worktree + 368-entry preservation baseline —
  PASS, 0 hash mismatches (`preservation-baseline-correction.json`).
- `npx vitest run tests/auditRuntimeDeps.test.ts` on the pre-correction
  seam — FAIL as required (`red-before-vitest.log`, 17 failing); corrected
  seam — PASS 50/50 (`green-after-vitest.log`); guards 7/7.
- `node repro-replay.mjs` (real seam + real CLI, review fixtures) — PASS;
  `repro-replay.json`: all 7 false greens exit 0 to 1 at both seams,
  controls unchanged, P2 report-only delivered end-to-end under inherited
  `audit-level=critical`.
- `node scripts/audit-runtime-deps.mjs` (live) — exit 1 retained red
  (`audit-gate-corrected.log`); `npm audit --audit-level=...` sweeps show
  identical 23-entry reports with exits 1/1/1/0 (info/moderate/high/critical).
- `npm ci` (pinned npm) — PASS, lockfile byte-unchanged (`npm-ci.log`);
  `npm ls node-forge --all` — one copy, same parents.
- Registry/advisory/parent re-query (`view-*.json`, `advisory-current.json`,
  `upstream-pr-1152-current.json`) — READ; forge latest 1.4.0 affected,
  `first_patched_version: null`, parents unchanged, PR 1152 open/unmerged.
- `npm run typecheck` — PASS exit 0 (`typecheck.log`); `npm run lint` —
  PASS 0/0 (`lint-after-prettier.log`); scoped Prettier — PASS.
- `npm test` — PASS 2510 / 2 pre-existing opt-in skips (`npm-test.log`).
- `npm run qa:affected -- --files <owned>` — `qa:fast -> qa:full`
  (`qa-affected.log`); `npm run qa:fast` — PASS (`qa-fast.log`).
- `npm run qa:full` — PARTIAL at the 3600 s tool window (`qa-full.log`):
  typecheck/lint/tests 2510-2/OpenSpec 70/70 PASS, `e2e:full` 235 passed /
  49 skipped / 0 failed (30.9 m), deterministic simulation 27 scenario
  runs PASSED then `soak-sustained-use` ENVIRONMENT failure at chromium
  launch (exit `0xC0000142`; `host-resources-post-timeout.txt`).
- `npm run qa:simulation -- --all --mode deterministic` (rerun of the
  failed lane, pinned toolchain) — PASS 23/23 (`qa-simulation-rerun.log`)
  including `soak-sustained-use`; the first-attempt crash is classified
  ENVIRONMENT (chromium launch exit `0xC0000142` under measured memory
  pressure — 137 MiB free of 32 GiB, CPU 68 %).
- scoped Prettier + `npm run lint` — PASS 0 errors / 0 warnings
  (`lint-final.log`); focused audit + guards + doc-consistency — 68/68.
- `npm run openspec:validate` — PASS 70/70 (`openspec-validation.log`);
  `npm run agent:plan:validate` + `:all` — PASS (`plan-validation.log`).
- foreign-state re-verification (368 entries) + `web:hygiene` — PASS,
  0 mismatches, ports 8081/8082 free (`preservation-precommit.json`).

Second correction (2026-10-03 independent review):

- `git fetch` + status/refs/stash/worktree inventory — PASS; local `0e0c8a8`,
  remote `891ed228`, 10 untracked roots (2 review plans + 8 foreign), no
  tracked changes; review preservation baseline (453 protected entries) and
  all prior evidence treated read-only.
- Pinned `node --version` / `npm --version` — v22.23.2 / 10.9.8; every gate
  receipt records command + exit + toolchain + source hash (`gates-receipt-*.log`).
- Actual pinned npm offline reproduction + config-precedence probes —
  `npm-precedence-probe.log`, `npm-audit-offline-actual.json` (clean-shaped
  empty report, exit 0), `npm-audit-offline-flag-normalized.json` (real
  23-entry report with `--offline=false`),
  `npm-audit-audit-config-false.json` (`audit=false` does NOT skip the audit
  command) — offline is the only request-skipping channel and is normalized.
- `npx vitest run tests/auditRuntimeDeps.test.ts` on the pre-fix source —
  FAIL as required (`red-before-vitest.log`, **16 failing** / 58 passed of 74,
  exactly the new red-capable set); corrected source — PASS 74/74 + guards
  7/7 (`green-after-vitest.log`).
- `node replay-boundary-fixed.mjs` (real seam + real CLI, all 17 review
  payloads) — PASS (`boundary-replay-fixed.json`): the five new false greens
  flip exit 0 → 1 at both seams, the original seven stay closed, valid
  documented/grouped-meta/evidenced-cycle controls unchanged, P2 report-only
  delivered under inherited `audit-level=critical` via the actual pinned npm
  reporter (the review's identity-less P2 fixture adapted in memory, recorded).
- `node scripts/audit-runtime-deps.mjs` with inherited/case-variant offline —
  exit 1 (`gate-offline-postfix.log`, `gate-offline-casevariant.log`); live
  online — exit 1 retained red with documented findings visible
  (`gate-live-postfix.log`, `gate-postfix-receipts.log`).
- `npm run typecheck` — PASS exit 0; `npm run lint` — PASS 0 errors /
  0 warnings; scoped Prettier — PASS (`gates-receipt-typecheck-lint.log`).
- `npm test` — PASS **2534 passed / 2 pre-existing opt-in skips** (252 files)
  (`npm-test.log`, `gates-receipt-npm-test.log`).
- focused audit + guards — **81/81** (`gates-receipt-focused.log`); plan/docs
  — **20/20** (9 ExecPlan + 11 doc-consistency); `npm run openspec:validate` —
  PASS 70/70; `npm run agent:plan:validate` + `:all` — PASS
  (`plan-validation.log`).
- `npm run qa:affected -- --files <owned 5 paths>` — `qa:fast → qa:full` +
  focused `tests/agent-execplan.test.ts` (`qa-affected.log` — the truthful
  receipted rerun that replaces the missing first-correction receipt).
- `npm run qa:fast` — PASS (`qa-fast.log`, `gates-receipt-qa-fast.log`).
- `npm run qa:full` — **PASS end-to-end, exit 0** (`qa-full.log`,
  `gates-receipt-qa-full.log`): typecheck/lint/tests 2534-2/OpenSpec 70/70 →
  hermetic `build:e2e` → `e2e:full` **235 passed / 49 skipped / 0 failed
  (29.4 m)** → deterministic simulation **all 23 scenarios passed**. This is
  the second-correction run at its own source; the correction-time wrapper
  non-pass (E′) is preserved and not relabeled by it.

Planning-era ledger (2026-10-02, preserved verbatim in spirit; see git history
of this file for the full planning record):

- Preflight/CI/audit/dependency/advisory investigation, exploration → proposal →
  design/spec/tasks, strict OpenSpec 70/70, `qa:fast` PASS (2060 unit),
  combined tests 2457 passed / 2 opt-in skips, focused 24/24, formatting,
  preservation 125 foreign files/links, `web:hygiene` PASS. Live forge audit
  remained exit 1 throughout. The one-off inventory-checker defect was
  `TEST_BUG` in the diagnostic (fixed, not waived).

## Changed Files / Areas

- `openspec/changes/resolve-windows-dependency-security/execplan.md` — this
  plan, re-activated for apply.
- `simulation-output/security-apply-2026-10-02/` — task-owned ignored evidence
  (audit reports, lockfile traversal, advisory/registry captures, web/android
  exports + analyses, APK scans, preservation baseline). No existing evidence
  overwritten.
- `scripts/audit-runtime-deps.mjs` — corrective boundary: explicit supported
  report schema/coherence validation, via-reference resolution, pinned npm
  audit exit threshold (the pre-existing formatting-only delta is preserved).
- `tests/auditRuntimeDeps.test.ts` — +23 correction regressions (13 seam +
  10 CLI); all prior tests preserved unchanged.
- `openspec/changes/resolve-windows-dependency-security/{tasks.md,final-report.md,execplan.md}` —
  task reconciliation (10.1–10.6), corrected report claims/identity
  (section E-prime), and this corrective-phase record.
- `simulation-output/security-correction-2026-10-02/` — ignored correction
  evidence (replay artifact, red/green logs, receipts, rerun logs).
- `scripts/audit-runtime-deps.mjs` — second-correction boundary: advisory/
  package/URL identity + severity coherence validation (evidence-bounded meta
  severities) and npm `offline` transport normalization; allowlist/policy
  byte-unchanged.
- `tests/auditRuntimeDeps.test.ts` — +24 second-correction regressions
  (1 policy-text + 11 seam + 12 CLI) with a pinned-producer offline shim;
  2 pre-existing synthetic fixtures corrected for producer fidelity with
  assertions intact.
- `openspec/changes/resolve-windows-dependency-security/{tasks.md,final-report.md,execplan.md}` —
  task reconciliation (11.1–11.7), corrected report claims (§E″) and this
  second-correction record.
- `simulation-output/security-correction-2026-10-03/` — ignored second-
  correction evidence (replay, red/green logs, receipts, final-state receipt);
  no prior evidence overwritten.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md` and this plan completely.
2. Inspect `git status --short`, `git diff --stat`, `git diff --name-only` and
   relevant diffs; reconcile this checkpoint against the working tree.
3. Prepend pinned Node 22.23.2 to PATH and run `npm run agent:resume --
--plan openspec/changes/resolve-windows-dependency-security/execplan.md`.
4. Reread `source-brief.txt`, `tasks.md` and the design. Do not confuse
   planning completion with security remediation.
5. Resolve impact with explicit owned paths; foreign untracked entries are not
   task ownership. Resume only from Exact next action.

## Outcomes & Retrospective

- Status: COMPLETED — `PRECISELY BLOCKED` terminal branch earned on complete
  evidence; overall project remains NOT CERTIFIED.
- Summary: Re-verified every planning fact at apply time and confirmed there is
  no safe executable dependency repair: no published fixed `node-forge`
  anywhere in the chain and the narrow exemption is ineligible because tooling
  calls the affected verifier. Shipped-artifact exposure is now source-bound
  proven absent (complete map-section coverage for web and android JS, byte
  corroboration, APK supplementary with its provenance mismatch preserved).
  The independent audit false-green was repaired fail-closed with 27 tests
  (4 policy-text + 23 executing — accounting corrected after the review;
  the corrective phase brings the file to 50 = 4 policy-text + 46
  executing) with mutation red-proof retained, and non-vacuous
  dependency-resolution
  and cryptographic tripwires pin the known-vulnerable state. Full pinned-
  toolchain validation passed (typecheck 0, lint 0/0, 2487 tests / 2 pre-
  existing skips, OpenSpec 70/70, qa:fast, qa:full with E2E 235/49/0 and
  deterministic simulation 23/23). Nothing was pushed: publication stays an
  unfulfilled conditional task while the audit truthfully stays red.
- Correction follow-up (2026-10-02 independent review): both blocking
  findings are corrected — P1 by making the supported report
  schema/coherence explicit (invalid and incoherent reports now fail closed
  before any verdict), P2 by pinning the npm audit exit threshold
  (`--audit-level=info`) so inherited configuration cannot false-red a
  report-only result. 23 permanent seam + real-CLI regressions cover every
  review fixture with red-before (17 failing on the pre-correction seam) /
  green-after (50/50) proof and per-fixture before/after at both seams.
  Evidence identity is reconciled: run 36965502815 relabeled
  remote-baseline historical CI, the 27-to-50 test accounting corrected,
  toolchain/npm-ci/parent-query receipts re-attested, and a post-commit
  final-state receipt adopted. The qa:full deterministic-simulation
  ENVIRONMENT non-pass reran 23/23. Nothing was pushed; the corrected work
  is handed back for independent re-review. Verdict unchanged:
  PRECISELY BLOCKED; overall NOT CERTIFIED.
- Second correction follow-up (2026-10-03 independent review): the review
  proved that correction incomplete — five further report-coherence/
  advisory-identity false greens (moderate outer finding suppressing a high
  advisory; critical meta-parents riding on moderate-only or merely
  documented leaves; malformed advisory URLs and contradictory package
  identities masquerading as documentation) and an inherited-offline
  skipped-audit false green — plus P2 receipt/report truth gaps. All are
  corrected fail-closed with 24 permanent regressions (16 red-before against
  the pre-fix source / green-after 74/74 + guards 7/7), producer-faithful
  controls preserved (meta parents below their leaves, evidenced cycles,
  scoped names, grouped advisories), every review payload replayed at both
  seams, and the P2 claims reconciled to the retained evidence (missing
  `qa:affected` receipt marked unverified with a truthful rerun; correction
  `qa:full` wrapper non-pass no longer overclaimed; standalone typecheck/lint
  claims narrowed and re-earned with full receipts). `qa:full` at the
  second-corrected source passed end-to-end (E2E 235/49/0, deterministic
  simulation 23/23). Nothing was pushed; the twice-corrected work is handed
  back for independent re-review. Verdict unchanged: PRECISELY BLOCKED;
  overall NOT CERTIFIED.
- Remaining campaign risk: the advisory gate is red until upstream publishes a
  fix; a future apply must re-query state rather than trusting this ledger, and
  must flip the cryptographic tripwire to rejection when a fixed forge lands.
- Follow-up: exactly the resume sequence in Current Checkpoint / final-report
  §I once any upstream condition is met. No Supabase access, no iOS action, no
  native rerun, no publication and no archive occurred.
- Lessons: npm production metadata is not shipped reachability; tooling API
  use disqualifies a build-only waiver even with proven bundle absence;
  textual policy tests missed a real error-path false green (now executing);
  evidence tooling outside `scripts/` crashes typed ESLint rules (derived-output
  ignores must stay complete); a devDependency used by tests must be declared —
  and declaring the transitive tested API at the parents' own range keeps one
  deduped copy and the production audit unchanged.
