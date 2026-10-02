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

- Current milestone: COMPLETED — apply campaign finished on the
  `PRECISELY BLOCKED` terminal branch (earned verdict; see
  [final-report.md](final-report.md) §J). This is Windows/local exhaustion
  pending upstream, NOT project certification (overall remains NOT CERTIFIED).
- Completed: (apply phase, 2026-10-02) full preflight (refs `891ed228` ==
  main == origin/main, history/stash/worktrees, 8 foreign roots, 125-file
  preservation baseline, CI `36965502815` reconciled); pinned toolchain used
  for every gate; audit red reproduced and raw reports retained; complete
  path/lockfile/API/exposure proof (web 3 map sections/1992 sources + android
  JS 1 section/2342 sources with zero forge modules, byte needles clean, APK
  1630/1630 entries scanned supplementary with provenance mismatch preserved,
  edge sources forge-free); apply-time registry/advisory/parent/PR re-query
  confirming NO published fix anywhere (forge latest 1.4.0 still affected,
  `first_patched_version: null`, CLI 55→58 all keep `node-forge@^1.3.3`, helper
  0.0.7 keeps `^1.4.0`, PR 1152 unmerged); ranked options ledger rejecting all
  five options incl. the exemption (affected-API-used predicate fails); the
  fail-closed audit command/report seam with 28 executing tests (23 seam + 5
  CLI contract) incl. the original-false-green demonstration and a 12-test
  mutation red-proof; dependency-resolution guard + cryptographic
  nested-DigestAlgorithm tripwire (7 tests, synthetic keys, controls);
  test-only devDependency `node-forge@^1.3.3` (+1 line package.json/lock,
  deduped single copy, `npm ci` reconstruction verified, audit unchanged red);
  narrow `simulation-output/**` eslint-ignore fix after preserving the typed-
  rule crash; full validation (typecheck 0, lint 0/0, tests 2487/2-skip,
  focused 34/34, OpenSpec 70/70, plans PASS, qa:fast PASS, qa:full PASS with
  E2E 235/49-skip/0-fail + deterministic simulation 23/23, post-change bundle
  recheck byte-identical); canonical reconciliation of
  `final-certification-closure/{closure-report,execplan}.md` triage notes only.
- In progress: None.
- Important modified files: `scripts/audit-runtime-deps.mjs` (fail-closed
  seam), `tests/auditRuntimeDeps.test.ts` (+23 tests, policy tests preserved),
  `tests/nodeForgeSecurityGuards.test.ts` (new guards),
  `package.json`/`package-lock.json` (test-only devDep, +1 line each),
  `eslint.config.mjs` (derived-output ignore, +3 lines), this change's
  `tasks.md`/`exposure-assessment.md`/`options-ledger.md`/`final-report.md`/
  this plan, and `final-certification-closure/{closure-report,execplan}.md`
  (triage outcome only). All evidence under
  `simulation-output/security-apply-2026-10-02/` (ignored).
- Last successful validation: full pinned-toolchain battery above; live audit
  re-run exit 1 (retained red, by design); foreign 125 files/links and
  stash/worktrees reverified; `web:hygiene` PASS (8081/8082 free).
- Current failures: the live audit gate remains exit 1
  (`DEPENDENCY_VULNERABILITY`, expected and retained). That is the precise
  blocker itself, not a broken gate.
- Relevant quarantines: None changed; the two opt-in cloud skips remain as
  found.
- Blockers: no published fixed `node-forge` (registry latest 1.4.0 affected;
  all `@expo/cli` 55–58 keep `node-forge@^1.3.3`; helper 0.0.7 keeps `^1.4.0`;
  upstream PR 1152 open/unmerged); narrow exemption ineligible (tooling calls
  the affected verification API); publication therefore unfulfilled (no push).
- Condition required to unblock: a published, independently verified compatible
  fixed `node-forge` release (≥1.4.1 satisfying both `^1.3.3` ranges), or a
  supported parent release removing both vulnerable paths, or a proven safe
  supported substitution with its own provenance.
- Exact resume action after unblock: fetch then-current `main`; re-query
  advisory/registry/parent metadata; repeat graph/exposure checks; pursue only
  an evidenced safe candidate per options-ledger order; then run tasks 4.x
  (repair + guards), 6.x and 7.x (fast-forward publication with green
  quality/audit/E2E at the final exact SHA) and reconcile records.
- Exact next action: None — task complete.
- Remaining definition of done: None for this campaign. Conditional tasks 4.x
  and 7.x remain unchecked by design (final-report.md §I); they belong to the
  resume above.

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
  The independent audit false-green was repaired fail-closed with 28 executing
  tests (mutation red-proof retained), and non-vacuous dependency-resolution
  and cryptographic tripwires pin the known-vulnerable state. Full pinned-
  toolchain validation passed (typecheck 0, lint 0/0, 2487 tests / 2 pre-
  existing skips, OpenSpec 70/70, qa:fast, qa:full with E2E 235/49/0 and
  deterministic simulation 23/23). Nothing was pushed: publication stays an
  unfulfilled conditional task while the audit truthfully stays red.
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
