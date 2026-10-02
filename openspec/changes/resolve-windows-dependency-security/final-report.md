# Final report — resolve-windows-dependency-security (apply)

Campaign verdict: **PRECISELY BLOCKED** (one of the two earned verdicts; see J).
Overall project state remains **NOT CERTIFIED**. All raw evidence:
`simulation-output/security-apply-2026-10-02/` (gitignored). Pinned toolchain
throughout: Node `v22.23.2` / npm `10.9.8`
(`/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64`); ambient Node 24 ran
no gate.

## A. Repository state

| Item                                                    | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting HEAD                                           | `891ed228ffc39f002ac13cc62aad2ee0b69ef1fe` == `main` == `origin/main` (re-verified after fetch; no newer remote commit)                                                                                                                                                                                                                                                                                                                                     |
| Final local state                                       | campaign + correction commits added locally on `main` (commits-created row below); **nothing pushed** — publication is an unfulfilled conditional task (§7) while the audit is truthfully red. The precise final local SHA, remote SHA, dirty status and commit list live in the immutable post-commit receipt `simulation-output/security-correction-2026-10-02/final-state-receipt.json` (this report intentionally does not embed its own commit's hash) |
| Remote-baseline historical CI (NOT CI at the local tip) | run `36965502815` is historical CI **at the pushed baseline** `891ed228ffc39f002ac13cc62aad2ee0b69ef1fe` (= then `origin/main`): `quality` FAILED at `Audit runtime dependencies`, `e2e` skipped (because quality failed), `nightly` skipped. It is **not** CI on the unpublished local tip, which has no hosted run and none is claimed                                                                                                                    |
| Foreign state                                           | 125 files across 8 untracked roots byte-verified unchanged (`preservation-baseline-apply.json`); stash `pre-recovery-local-changes` (`c35e281d…`) untouched; one worktree; no reset/stash-drop/force operations                                                                                                                                                                                                                                             |
| Commits created                                         | local-only, logical (audit seam + tests; dependency/test guards + test-only devDependency; evidence/reconciliation docs; then the 2026-10-02 correction commits: audit schema/exit-threshold boundary + regressions, correction evidence/report docs). No force push, no history rewrite. Exact SHAs in the final-state receipt                                                                                                                             |

## B. node-forge root cause

- **Installed/locked:** one physical copy `node_modules/node-forge@1.4.0`
  (lock entry not dev-marked), reached through `expo@55.0.31 →
@expo/cli@55.0.36` by two parent paths: direct `node-forge@^1.3.3` and
  `@expo/code-signing-certificates@0.0.6 → node-forge@^1.3.3` (deduped). Plus
  the root test-only devDependency `node-forge@^1.3.3` added 2026-10-02 (see C).
- **Advisory:** `GHSA-86w9-cpqp-85rv` / CVE-2026-85393, HIGH (CWE-347, CVSS 7.5
  `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N`), individual range `<= 1.4.0`,
  `first_patched_version: null` (npm's grouped range `*` is a different field),
  updated 2026-10-01, incomplete fix for CVE-2026-33894. The defect is exact:
  installed `lib/rsa.js` validates the outer DigestInfo element count
  (`obj.value.length !== 2`) but not the nested `DigestInfo.DigestAlgorithm`
  count — extra nested elements are accepted (demonstrated by executing test).
- **Classification:** real `DEPENDENCY_VULNERABILITY` + `NO_PATCH_AVAILABLE`,
  npm-production-transitive via framework tooling. **Not** a classification bug.
- **Vulnerable API reachability:** RSA PKCS#1 v1.5 verification
  (`publicKey.verify`) IS called by build/development tooling:
  `@expo/code-signing-certificates` `validateSelfSignedCertificate`
  (main.js:176 `certificate.verify`), `signBufferRSASHA256AndVerify` (main.js:203),
  `generateDevelopmentCertificateFromCSR` (main.js:246 `csr.verify`), invoked
  from `@expo/cli` `utils/codesigning.js` (dev-manifest signing / development
  certificate validation) and `run/ios/codeSigning/Security.js`
  (forge `certificateFromPem` on macOS `security` output). Inputs in these flows
  are the developer's own certificate/CSR/self-produced signatures; no
  untrusted-network verification and no practical attack is claimed or attempted.
- **Shipped exposure — proven absent for JS artifacts (source-bound):** fresh
  hermetic exports at current source with external source maps: web 3 map
  sections (1992 module sources) and android JS 1 map section (2342 sources) —
  **zero `node-forge` / `@expo/code-signing-certificates` modules** in every
  section; the only `@expo/cli` module shipped is the crypto-free
  `metro-require/require.js` shim; zero byte-needle hits across all output files.
  The static-rendering graph (`render.js`) is transient tooling absent from
  output. Historical APK rescan: 1630/1630 entries inflated, zero signatures —
  supplementary only (on-disk `F3D9A63C…` ≠ certified `E6E55ED5…`; no identity
  transferred). `supabase/functions` sources import no forge; deployed edge
  state not accessed (explicit limit). Historical incomplete planning export
  retained as history (`ENVIRONMENT`, 600 s under contention), superseded — not
  relabeled — by the completed exports.

## C. Remediation

- **Selected branch:** none is safely executable — `PRECISELY BLOCKED` (J).
  Files changed (all local, unpublished):
  - `scripts/audit-runtime-deps.mjs` — fail-closed command/report seam
    (`validateAuditCommandResult`, `evaluateAudit`, injectable `main`);
    CLI behavior/allowlist policy unchanged. Before/after dependency versions:
    none (no dependency repair exists). Corrective phase (2026-10-02): the
    supported report schema is now explicit (auditReportVersion 2, severity
    enums, non-negative integer metadata counts coherent with the reported
    findings, non-empty dependency paths, via references resolving to usable
    advisory evidence) and the npm audit exit threshold is pinned
    (`--audit-level=info`); allowlist/policy unchanged. Second correction
    (2026-10-03): advisory/package/URL identity and severity coherence are
    now validated against the pinned producer's schema before any verdict
    (finding key == body name == advisory `name`/`dependency`; parseable
    http(s) advisory URLs; outer severity never below its explicit advisory
    severities; meta-reference severities bounded by the advisory evidence
    their chains reach), and the transport normalizes npm's `offline` config
    (`--offline=false` + `npm_config_offline` override) so a skipped registry
    request can no longer serialize into a clean verdict. Allowlist and
    advisory policy remain byte-unchanged.
  - `tests/auditRuntimeDeps.test.ts` — kept all 4 meaningful policy tests;
    added 23 executing seam/CLI-contract tests (18 seam + 5 CLI) incl. the
    original-false-green demonstration — 27 tests total (4 policy-text + 23
    executing), correcting the earlier "23 seam + 5 CLI / 28 executing"
    miscount. The corrective phase adds 23 more (13 seam + 10 CLI), so the
    file then held **50 tests = 4 policy-text + 46 executing**. The second
    correction (2026-10-03) adds 24 more (1 policy-text + 11 seam + 12 CLI),
    so the file now holds **74 tests = 5 policy-text + 69 executing
    (42 seam + 27 CLI)** (recomputed from `vitest --reporter=json`, not a
    magic acceptance number).
  - `tests/nodeForgeSecurityGuards.test.ts` — semantic resolution guard
    (documented-state pin + bad-graph rejection) and the cryptographic
    nested-DigestAlgorithm tripwire with synthetic keys and RSA controls.
  - `package.json` / `package-lock.json` — **+1 line each**: test-only
    devDependency `node-forge@^1.3.3` (same range as the tooling parents,
    dedupes to the same copy; production audit tree unchanged — verified after
    `npm ci`). Added so the guard can execute the installed API and to satisfy
    dependency-hygiene lint (undeclared import).
  - `eslint.config.mjs` — +3 lines: `simulation-output/**` added to the existing
    derived-output global ignores (gitignored evidence dir; typed rules crash on
    its diagnostic tooling — same lint-exempt class as `scripts/*.mjs`).
  - Evidence/reconciliation docs: this change's `tasks.md`/`execplan.md`/
    `exposure-assessment.md`/`options-ledger.md`/`final-report.md` and
    `final-certification-closure/{closure-report,execplan}.md` triage notes.
- **Why this shape:** the options ledger (re-verified at apply time) rules out
  every dependency repair: no fixed forge is published (registry latest 1.4.0 is
  the vulnerable version; PR 1152 unmerged), no parent release removes either
  path (`@expo/cli` 55→58 all keep `node-forge@^1.3.3`; helper 0.0.7 keeps
  `^1.4.0`), framework-family bumps are breaking and not a fix, the chain is
  used tooling (not removable), and the narrow exemption is ineligible because
  the affected API **is** used (predicate 4 fails).
- **Alternatives rejected:** npm's `expo@44.0.6` fix (breaking downgrade);
  `npm audit fix`/`--force` (never run; dry-run shows it would drag in the
  unrelated `react-native@0.87.1` bump); vendoring PR 1152 or a random fork
  (unreviewed, and patched files don't move `npm audit`); dependency relocation
  to devDependencies or bundle filtering (hiding, forbidden); build-only
  exemption (tooling calls the verifier); inventing a `1.4.1` override target
  (unreleased).

## D. Security result

- **Local audit (`node scripts/audit-runtime-deps.mjs`): exit 1** — 1
  undocumented high (`node-forge GHSA-86w9-cpqp-85rv [node_modules/node-forge]`).
  This red is retained by design; faking it green is explicitly out of bounds.
- **Remaining highs/criticals:** prod report 12 high / 11 moderate / 0 critical
  package entries (propagated parent entries, not distinct advisories); the only
  high advisories are the documented `brace-expansion` trio (exact-path
  allowlist, dated 2026-09-29) and the gating forge advisory. Full report
  17 high / 13 moderate.
- **Documented exceptions:** unchanged — the three `brace-expansion`
  entries only. **No forge entry, no wildcard, no new exception** was added
  (`DOCUMENTED_BUILD_TIME_ADVISORIES` diff is empty of policy changes).
- The audit gate is now fail-closed across the whole boundary: npm error JSON /
  empty failed output / malformed / unsupported / signalled / incoherent
  results fail visibly instead of printing a clean verdict (previously exit 0
  on two of these at apply time, and — as the 2026-10-02 independent review
  proved — on seven more malformed/incoherent report shapes). The corrected
  boundary validates the supported schema (auditReportVersion 2 only), known
  severity enums, non-negative integer metadata counts coherent with the
  reported findings, usable non-empty dependency paths, and `via` references
  that resolve to usable advisory evidence (dangling references and
  evidence-free cycles rejected before any verdict). The npm audit exit
  threshold is pinned (`--audit-level=info`, plus the matching `npm_config`
  override) so inherited npm configuration cannot turn valid lower-severity
  reports into false reds; report-only lower severities and the
  exit-0-with-findings fail-closed contradiction check are preserved.
- Second-correction closure (2026-10-03): the boundary now also validates
  advisory/package/URL identity and severity coherence against the supported
  producer's serialization (`Vuln.toJSON()`/`Vuln.addAdvisory`,
  `Advisory`): every object `via` entry is a direct advisory whose
  `name`/`dependency` equal its finding key, with a parseable http(s)
  advisory URL (non-empty final path segment as the advisory id) and an
  explicit severity enum; a finding's severity can never sit below its
  explicit advisory severities (which previously let a moderate outer finding
  suppress a high advisory) nor above the advisory evidence its `via`
  reference chain reaches (which previously let a critical meta-parent ride on
  a moderate-only or merely-documented leaf). Legitimate npm shapes remain
  supported: grouped/multi-advisory reports, meta parents BELOW their
  referenced findings' aggregate severity, evidenced reference cycles,
  aliases and scoped names. The transport also normalizes npm's `offline`
  config (explicit `--offline=false` plus the `npm_config_offline` override,
  case-variant env dedupe): the pinned producer skips the registry request
  when effective `offline` is true and serializes a clean-shaped report with
  exit 0 — reproduced on this vulnerable tree — so a skipped audit can no
  longer become a successful clean verdict, while genuine registry failures
  still fail visibly through the transport/error path.

## E. Validation (pinned toolchain; commands actually run)

| Gate                                                    | Result                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/audit-runtime-deps.mjs`                   | exit 1 (retained red; re-run after every change)                                                                                                                                                                                                                                                                                                                                    |
| `npm audit --json` / `--omit=dev --json`                | exit 1; raw reports retained                                                                                                                                                                                                                                                                                                                                                        |
| `npm ls node-forge --all` / `npm explain`               | one copy, two tooling paths (+ root test devDep), unchanged after `npm ci`                                                                                                                                                                                                                                                                                                          |
| `npm ci` (clean reconstruction)                         | PASS; lock diff exactly +1 line; graph/audit unchanged                                                                                                                                                                                                                                                                                                                              |
| `npm run typecheck`                                     | 0 errors (one TS2322 in new test typing fixed via JSDoc seam signature)                                                                                                                                                                                                                                                                                                             |
| `npm run lint` (zero warnings)                          | 0 errors / 0 warnings after prettier fixes; evidence-dir ignore fix for typed-rule crash (preserved failure + classification)                                                                                                                                                                                                                                                       |
| `npm test` (unit + integration)                         | **2487 passed / 2 skipped** (252 files: 251 pass / 1 skip) — the 2 skips are the pre-existing opt-in cloud tests                                                                                                                                                                                                                                                                    |
| focused: `auditRuntimeDeps` + `nodeForgeSecurityGuards` | 34/34                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run openspec:validate`                             | 70/70                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run agent:plan:validate:all`                       | PASS (this plan ACTIVE→COMPLETED)                                                                                                                                                                                                                                                                                                                                                   |
| `npm run qa:affected -- --files <owned>`                | resolved `qa:fast → qa:full`                                                                                                                                                                                                                                                                                                                                                        |
| `npm run qa:fast`                                       | PASS (2090 unit tests + journey/quarantine/profile guards)                                                                                                                                                                                                                                                                                                                          |
| `npm run qa:full`                                       | **PASS end-to-end** (apply-phase run, `security-apply-2026-10-02/qa-full.log`): typecheck+lint+tests+OpenSpec → hermetic `build:e2e` → E2E **235 passed / 49 skipped / 0 failed** (26.8 m) → deterministic simulation **23/23**. The correction-phase `qa:full` is a different, later run with its own preserved wrapper non-pass — see E′; neither run is relabeled from the other |
| fresh web recheck export (post-change source)           | byte-identical bundle identities (all SHA-256 match the first export); zero forge modules — bundle impact of this change proven nil                                                                                                                                                                                                                                                 |
| mutation red-proof                                      | reverting the seam to the original fail-open turns 12 tests red (captured); restored file hash-identical                                                                                                                                                                                                                                                                            |
| not run (correctly)                                     | `qa:native:*` (no native/runtime impact — 6.6 documents retained applicability), iOS lanes (owner-deferred), `e2e:sync`/nightly/disposable cloud (unchanged scope), any Supabase access (forbidden)                                                                                                                                                                                 |

### E′. Correction-phase validation and evidence identity (2026-10-02 review follow-up)

The independent review found the apply's historical receipts incomplete
(parent-query, pinned-preflight, clean-install, source-identity) — an evidence
limitation, not proof the commands never ran. The corrective phase re-attests
what is re-verifiable and narrows the rest; raw artifacts under
`simulation-output/security-correction-2026-10-02/`.

| Gate / claim                          | Receipt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pinned toolchain                      | `toolchain-receipt.txt` — Node v22.23.2 / npm 10.9.8 first on PATH; ambient Node 24 ran no gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| focused audit suite                   | **50/50** at corrected source (`green-after-vitest.log`); guards 7/7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| red-before / green-after              | 17 of the new tests FAIL against the pre-correction seam (`red-before-vitest.log`); per-fixture before/after at the real seam AND real CLI in `repro-replay.json` — all 7 review false greens flip exit 0 → 1, clean/high controls unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| live audit                            | `audit-gate-corrected.log` — exit 1 retained red (undocumented forge high), documented findings still printed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| npm audit-level semantics             | `audit-level-{info,moderate,high,critical}.json` — identical 23-entry reports at every level, exits 1/1/1/0: the configured threshold changes only the exit code (why the pin is required)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| clean reconstruction                  | `npm-ci.log` — `npm ci` PASS under pinned npm; lockfile byte-unchanged by the install; `npm-ls-node-forge-after-ci.log` — one `node-forge@1.4.0`, same two tooling parents + root test devDep                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| parent/registry/advisory re-query     | `view-*.json`, `advisory-current.json`, `upstream-pr-1152-current.json` — forge latest 1.4.0 still vulnerable, advisory range `<= 1.4.0`, `first_patched_version: null`, CLI 55.0.36 and 57.0.27 both keep `node-forge@^1.3.3`, helper 0.0.7 keeps `^1.4.0`, PR 1152 open/unmerged (`ceba344…`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `+1 line` package/lock claim          | re-attested from Git: `git diff 891ed228..HEAD --numstat -- package.json package-lock.json` = `1 0` each                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| typecheck / lint (correction)         | `typecheck.log` and `lint-final.log` retain the command bodies with no diagnostics — log-body evidence only, with **no standalone exit/source/toolchain receipt** (claim narrowed accordingly); both gates re-ran at the second-correction source with full receipts (§E″)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| full unit + integration               | `npm-test.log` — 2510 passed / 2 pre-existing opt-in skips (252 files) at corrected source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| OpenSpec + plans                      | OpenSpec 70/70 (in `qa-full.log`); `plan-validation.log` for versioned plans                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `qa:affected` → `qa:fast` → `qa:full` | **`qa-affected.log` receipt absent — the historical impact claim is unverified.** The correction-time `qa:affected` command left no receipt in `simulation-output/security-correction-2026-10-02/`; its claimed `qa:fast → qa:full` resolution is consistent with the retained `qa-fast.log`/`qa-full.log` chronology but is not proof the command ran. A truthful receipted rerun at the second-correction source lives in `simulation-output/security-correction-2026-10-03/qa-affected.log`. `qa-fast.log` PASS; `qa-full.log` stages: typecheck/lint/tests 2510-2/OpenSpec 70/70 PASS, `e2e:full` **235 passed / 49 skipped / 0 failed (30.9 m)**, deterministic simulation lane 27 scenario runs PASSED then `soak-sustained-use` failed at chromium launch (exit `0xC0000142`, `browserType.launch: Target page, context or browser has been closed`) before the 3600 s tool window killed the chain — preserved non-pass, rerun result below |
| host resources at that non-pass       | `host-resources-post-timeout.txt` — 137 MiB free of 32 GiB, CPU 68 %, top consumers unrelated (Memory Compression, vmmemWSL, opencode ×3, MsMpEng); nothing unrelated was terminated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| deterministic-simulation rerun        | PASS 23/23 incl. `soak-sustained-use` (`qa-simulation-rerun.log`) — the first-attempt crash is classified ENVIRONMENT (chromium launch exit `0xC0000142` under measured memory pressure), not a product or test defect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| final source identity                 | `final-state-receipt.json` — final local SHA, remote SHA, dirty status, commit list (written after the last commit)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### E″. Second-correction validation and evidence identity (2026-10-03 review follow-up)

The second independent review proved five further report-coherence/advisory-
identity false greens and an inherited-offline skipped-audit false green at the
same claimed fail-closed boundary, plus P2 report/receipt truth gaps. Raw
artifacts under `simulation-output/security-correction-2026-10-03/`; the
review's own evidence under
`simulation-output/security-correction-review-2026-10-03/` is read-only and
unchanged.

| Gate / claim                            | Receipt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pinned toolchain                        | `gates-receipt-*.log` — Node v22.23.2 / npm 10.9.8 first on PATH for every gate; command + exit + source-hash + HEAD recorded per gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| red-before / green-after                | **16 of the new tests FAIL against the pre-fix source** (`red-before-vitest.log`: 16 failed / 58 passed of 74) — exactly the 5 review shapes + the laundering cycle + the offline regressions + their CLI twins; green-after **74/74 + guards 7/7** (`green-after-vitest.log`). Two pre-existing synthetic fixtures were corrected for producer identity/severity fidelity (advisory `name`/`dependency`, aggregate/advisory severity) with their original assertions intact                                                                                                                                                  |
| boundary replay (review payloads)       | `boundary-replay-fixed.{json,log}` — all 17 review payloads re-executed at the review baseline AND the corrected source at the real seam and the real CLI: the five new false greens flip exit 0 → 1 at both seams, the original seven stay closed, valid documented/grouped-meta/evidenced-cycle controls unchanged, and the P2 report-only verdict is delivered under inherited `audit-level=critical` decided by the actual pinned npm reporter. The review's `audit-level-repro.json` fixture lacks producer `name`/`dependency` fields and was adapted in memory (recorded in the receipt; the review file is untouched) |
| offline suppression (actual npm)        | pinned npm: `npm_config_offline=true npm audit --omit=dev --json --audit-level=info` → exit 0 with the clean-shaped empty report (`npm-audit-offline-actual.json`) — the reproduced false green; through the fixed gate the same inherited config exits **1** on the real report (`gate-offline-postfix.log`), and with the normalization the raw command returns the real 23-entry report (`npm-audit-offline-flag-normalized.json`). Case-variant `NPM_CONFIG_OFFLINE=true` also fails closed (`gate-offline-casevariant.log`)                                                                                              |
| npm config precedence                   | `npm-precedence-probe.log` — pinned npm `config get offline`: CLI `--offline=false`/`--no-offline` beat inherited `npm_config_offline`, which beats project `.npmrc`; `npm_config_audit=false` does NOT suppress the `npm audit` command (`npm-audit-audit-config-false.json`: real 23-entry report, exit 1) — offline is the only request-skipping config channel, and it is normalized                                                                                                                                                                                                                                      |
| live audit                              | `gate-live-postfix.log` — exit 1 retained red (undocumented forge high); documented findings still printed; no allowlist/policy change (`DOCUMENTED_BUILD_TIME_ADVISORIES` untouched)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| typecheck / lint                        | `gates-receipt-typecheck-lint.log`, `typecheck.log` (exit 0), `lint-after-format.log` (0 errors / 0 warnings, `--max-warnings 0`), `format-check.log` — full command/exit/toolchain/source receipts at corrected source                                                                                                                                                                                                                                                                                                                                                                                                       |
| full unit + integration                 | `npm-test.log` + `gates-receipt-npm-test.log` — **2534 passed / 2 pre-existing opt-in skips** (252 files) at second-corrected source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| focused suites                          | `gates-receipt-focused.log` — audit 74 + crypto guards 7 = **81/81**; `plan-doc-tests.log` + `gates-receipt-plan-docs.log` — plan/docs **20/20** (9 ExecPlan + 11 doc-consistency); `openspec-validation.log` **70/70**; `plan-validation.log` versioned-plan validation PASS                                                                                                                                                                                                                                                                                                                                                 |
| `qa:affected` (this correction)         | `qa-affected.log` + `gates-receipt-qa-affected.log` — owned five-path resolution: `qa:fast → qa:full` + focused `tests/agent-execplan.test.ts` (rule `agent-workflow-and-documentation`)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `qa:fast` / `qa:full` (this correction) | `qa-fast.log` PASS; `qa-full.log` + `gates-receipt-qa-full.log` — **PASS end-to-end, exit 0**: typecheck/lint/tests 2534-2/OpenSpec 70/70 → hermetic `build:e2e` → `e2e:full` **235 passed / 49 skipped / 0 failed (29.4 m)** → deterministic simulation **all 23 scenarios passed**. Own evidence at its own source; the correction-time wrapper non-pass (E′) remains preserved and is not relabeled by this run                                                                                                                                                                                                            |
| final source identity                   | `final-state-receipt.json` — written after the last task-owned commit (final local SHA, remote SHA, dirty status, commit list, preservation/hygiene recheck)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## F. Hosted CI

- Exact SHA `891ed228ffc39f002ac13cc62aad2ee0b69ef1fe`, run **36965502815**
  (push): `quality` **failure** (audit step), `e2e` **skipped** (because quality
  failed — never counted as success), `nightly` **skipped** (expected on push).
  No newer run exists; no ancestor success is reused.
- **No publication occurred**, so there is no post-publication CI to attest:
  publishing requires a proven repaired candidate with green exact-head
  quality/audit/E2E (task 7.x, unfulfilled). The campaign's local commits are
  the prepared candidate for the resume in J.
- Run `36965502815` is labeled **remote-baseline historical CI** (2026-10-02
  review correction): it attests only the pushed baseline `891ed228`. The
  unpublished local tip (apply + correction commits) has **no** hosted CI run,
  and no exact-head hosted claim is made for it.

## G. Regression protection (executing, non-vacuous)

- **Audit seam:** 27 tests at apply time = 4 policy-text + 23 executing (18 at
  the real `validateAuditCommandResult` / `evaluateAudit` seams + 5 CLI-contract
  through the actual script with a stub npm) — correcting the earlier
  "23 seam + 5 CLI / 28 executing" miscount. Coverage: clean/documented/
  uncovered-path/new-advisory/future-critical/error-JSON/empty/malformed/
  unsupported/invalid-shape/spawn/signal/status/incoherent fixtures. Red-capable:
  the original-false-green demonstration pins the defect, and a mutation run
  turned 12 tests red before restore.
- **Correction regressions (2026-10-02):** +23 executing tests (13 seam +
  10 CLI) covering every review false-green fixture (report version 999,
  metadata-vs-findings incoherence, `HIGH` severity, empty `via`, dangling via
  reference, documented advisory with empty paths, negative/non-integer
  counts) plus reference-cycle and valid grouped-meta/multi-advisory controls,
  at BOTH the real seam and the real CLI, and the P2 exit-threshold
  normalization (inherited `audit-level=critical` configuration, info/low
  report-only controls, exit-0-with-findings still fail-closed). Red-before:
  17 fail against the pre-correction seam; green-after 50/50;
  `repro-replay.json` carries per-fixture before/after at both seams.
- **Second-correction regressions (2026-10-03):** +24 tests (1 policy-text +
  11 seam + 12 CLI) covering the five remaining review false-green shapes
  (high advisory behind a moderate outer finding; critical meta-parent
  reaching only moderate evidence or only the documented high; malformed
  advisory URL impersonating documentation; contradictory finding/advisory
  package identity) plus the severity-laundering reference cycle, at BOTH the
  real seam and the real CLI, and the inherited-offline skipped-audit false
  green (CLI regressions for inherited env and project/user `.npmrc` channels,
  producer-model self-tests, and an un-normalized false-green demonstration).
  Controls preserved: documented-through-meta, evidenced reference cycle,
  meta-parent BELOW its leaf's aggregate severity (legitimate npm subset
  semantics), scoped names, grouped/multi-advisory reports. Red-before:
  **16 fail** against the pre-fix source (`red-before-vitest.log`);
  green-after 74/74 + guards 7/7; `boundary-replay-fixed.json` carries
  per-fixture before/after at both seams for every review payload. The
  permanent offline tests are deterministic and network-free: their shim
  models the pinned producer (`@npmcli/arborist/lib/audit-report.js` skip
  before the registry request + clean-shaped `toJSON()`) and npm's verified
  config precedence, not the gate's own fix; end-to-end attestation uses the
  separately retained actual-npm receipts.
- **Test accounting (recomputed at second-corrected source):** the audit file
  holds **74 tests = 5 policy-text + 69 executing (42 seam + 27 CLI)**; the
  focused parent suite is **81 = 74 audit + 7 guards**; plan/doc suites add 20
  separately (9 ExecPlan + 11 doc-consistency). Point-in-time counts, not
  acceptance numbers.
- **Dependency resolution:** semantic guard pins the documented copy/parent/
  version state and demonstrably rejects nested copies, extra parents, version
  drift and dev-relocation fixtures; it executes against the real lockfile and
  install (no lockfile-text snapshot).
- **Cryptographic tripwire:** synthetic RSA material only; legit signature
  verifies (control), tampered signature rejected (non-vacuous), fixture
  self-check proves the extra nested DigestAlgorithm element, and the tripwire
  pins that installed forge 1.4.0 **accepts** the forgery shape — it flips red
  the moment a fixed forge lands, forcing the documented state to be updated
  together with the resolution guard.

## H. Existing closure state (preserved, not reopened)

- **Android:** retained green — provisioning PASS, smoke 2/2, persistence 11/11,
  lifecycle 6/6 at the recorded source/APK identities (`80b0b33`/`E2F43FBB…`,
  `7a6aeb2`/`E6E55ED5…`). This campaign's changes are audit-script/test/docs +
  test-only devDependency — no product/native source — so no rerun was earned
  (6.6 documented applicability); iOS untouched.
- **J8:** preserved — historical 878 ms `ENVIRONMENT` excursion, accepted
  622/800 ms post-fix evidence, 800 ms ceiling and 15 % floor unchanged,
  task 4.3 `NOT_TRIGGERED`.
- **qa:full chronology:** prior campaign pass (250 files/2457 tests, OpenSpec
  69/69, E2E 235/49/0, sim 23/23) remains historical; this campaign ran
  `qa:full` twice, each its own evidence at its own source: the apply-phase run
  ended green (E), the correction-phase run preserved a wrapper non-pass with
  stage results and a separate simulation-only 23/23 rerun (E′) — the wrapper
  is not relabeled green from its rerun.
- **iOS:** owner-deferred (`DEFERRED_BY_OWNER / ENVIRONMENT`), never certified.
- **Production:** catalog read credential-dependent; recovery point proven
  absent (`pitr_enabled: false`, `backups: []`, `physical_backup_data: {}` at
  the original observation); DDL stopped; **zero Supabase access or mutation in
  this campaign** (`superhabits`/`kruubbynsmxzxfdunaal` untouched).
- **Canonical ledger:** **17/22** unchanged (2.1, 2.4, 3.2, 3.3, 4.3 open);
  overall **NOT CERTIFIED**; gap-21 fail-closed, default-off AI/account/restore
  invariants unchanged. `final-certification-closure` records were updated only
  with this triage outcome; completed historical plans were referenced, not
  rewritten.

## I. Remaining work

- **Actionable Windows/local:** the second independent review proved the
  2026-10-02 correction incomplete (five report-coherence/advisory-identity
  false greens and an inherited-offline skipped-audit false green remained),
  so the earlier "local work exhausted" claim was premature and is reconciled
  here. Those gaps are now closed with red-capable regressions at both seams
  (§E″), so executable local work on the audit boundary is again exhausted
  pending upstream — while overall certification truth is unchanged.
- **Owner action:** return the corrected apply for **independent re-review** —
  the 2026-10-03 second review's P1/P2 blocking findings are corrected per
  `simulation-output/security-correction-review-2026-10-03/correction-prompt.md`
  (the 2026-10-02 review's findings were corrected by the first correction);
  this correction session pushed nothing and claims no certification.
  Publication remains prepared but intentionally withheld until the upstream
  condition lands.
- **Credential/external (exact upstream condition):** any ONE of
  (1) a published, independently verified fixed `node-forge` (≥ 1.4.1
  satisfying both parents' `^1.3.3` ranges) — PR merge alone is insufficient;
  (2) a supported `@expo/cli` / `@expo/code-signing-certificates` release
  removing **both** vulnerable paths;
  (3) a proven safe supported substitution with its own provenance.
  **Exact resume:** fetch then-current `main`; re-query advisory/registry/parent
  metadata; repeat the graph/exposure checks; pursue only an evidenced safe
  candidate (options-ledger order); then run tasks 4.x (repair + guards),
  6.x, and 7.x (publish by fast-forward; require green quality/audit/E2E at the
  final exact SHA; reconcile records).
- **Deliberately deferred (unchanged):** iOS certification, production
  catalog/DDL/recovery work, the canonical open tasks 2.1/2.4/3.2/3.3/4.3.

## J. Terminal verdict

**PRECISELY BLOCKED**

The dependency vulnerability has no safe executable repair today: the complete
options/exposure proof (B/C, `exposure-assessment.md`, `options-ledger.md`)
rules out updates, overrides, family changes, removal/substitution and any
eligible exemption, so the audit gate cannot truthfully pass and remains red.
The independent audit fail-open was repaired and covered by executing
regression tests, and the independent review's fail-closed boundary defect
(P1 schema/coherence) plus npm exit-semantics issue (P2) were corrected with
executing seam + CLI regressions and evidence-identity reconciliation (§E′).
The second independent review proved that correction incomplete (five further
report-coherence/advisory-identity false greens and an inherited-offline
skipped-audit false green); those are now closed the same way — fail closed
before any verdict, producer-faithful controls preserved, red-capable
regressions at both seams (§E″) — and the report/receipt claims were
reconciled to the actual retained evidence.
Each correction is audit-gate correctness only and is explicitly **not**
claimed to resolve forge.
Unfulfilled conditional tasks (4.x dependency repair, 7.x publication) remain
unchecked. Overall project state remains **NOT CERTIFIED**.

## Appendix — requirement audit (task 9.1)

Each normative requirement of
`specs/dependency-security-closure/spec.md` verified against direct evidence:

| Requirement                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository state verified, foreign state preserved      | preflight logs; `preservation-baseline-apply.json` (125 files/8 roots re-verified); stash `c35e281d…` untouched                                                                                                                                                                                                                                                                                                                                                           |
| Pinned supported toolchain                              | every gate under Node v22.23.2 / npm 10.9.8; ambient Node 24 ran none                                                                                                                                                                                                                                                                                                                                                                                                     |
| Diagnosis covers every dependency path                  | `lockfile-traversal.log`, `npm-ls`/`npm-explain`, both parent paths + ranges + lineage; aggregate `*` vs individual `<=1.4.0` distinguished                                                                                                                                                                                                                                                                                                                               |
| Exposure proven independently of dependency labels      | source-bound map sections (web 3/1992, android 1/2342, zero forge modules), tooling call trace (helper main.js:176/203/246), APK 1630/1630 supplementary + provenance limit                                                                                                                                                                                                                                                                                               |
| Smallest proven safe remediation                        | `options-ledger.md` — all five options evidenced and rejected; no forced fix, no invented target, no vendored patch                                                                                                                                                                                                                                                                                                                                                       |
| Exceptions require every strict predicate               | predicate table; #4 (affected API unused) FAILS → exception ineligible; policy unchanged                                                                                                                                                                                                                                                                                                                                                                                  |
| Audit execution fails closed on invalid results         | `validateAuditCommandResult` + 69 executing tests (42 seam + 27 CLI); error JSON/empty/malformed/unsupported/signalled/incoherent, all twelve review false-green shapes (seven 2026-10-02 + five 2026-10-03), the severity-laundering cycle, and skipped-audit (inherited offline) suppression all fail visibly at seam + real CLI (`repro-replay.json`, `boundary-replay-fixed.json`); advisory/package/URL identity and severity coherence validated before any verdict |
| Supported report schema and coherence are explicit      | auditReportVersion 2 only; severity enums; non-negative integer metadata counts coherent with findings; usable non-empty dependency paths; via references resolving to usable advisory evidence; finding key == body name == advisory `name`/`dependency`; parseable http(s) advisory URLs; outer severity bounded below by its explicit advisory severities and above by the advisory evidence its reference chain reaches                                               |
| npm audit exit threshold normalized (review P2)         | `--audit-level=info` pinned on the command line + `npm_config` override; inherited-`audit-level=critical` CLI regression; lower severities stay report-only; exit 0 with findings stays fail-closed; npm `offline` normalized the same way (`--offline=false` + `npm_config_offline` override) so a skipped audit cannot report clean                                                                                                                                     |
| New high/critical remain gating                         | live audit exit 1 retained after every change; undocumented forge high still fails; documented findings still printed                                                                                                                                                                                                                                                                                                                                                     |
| Regression protection executes actual security behavior | mutation red-proof (12 tests), bad-graph fixtures rejected, RSA controls + fixture self-check + defect tripwire; first correction red-before 17 failing / green-after 50/50 at seam + real CLI; second correction red-before **16 failing** / green-after 74/74 + guards 7/7 with per-fixture before/after at both seams (`boundary-replay-fixed.json`)                                                                                                                   |
| Clean reconstruction proves the change                  | `npm ci` after the +1-line devDependency; `npm ls`/audit verified unchanged                                                                                                                                                                                                                                                                                                                                                                                               |
| Validation follows actual impact                        | owned-path `qa:affected` → `qa:fast → qa:full` per gate receipts; correction-time wrapper non-pass preserved (E′, relabeled nowhere), second-correction receipts in E″                                                                                                                                                                                                                                                                                                    |
| Artifact validation hermetic and source-bound           | hermetic envelope (no dotenv, no ambient EXPO_PUBLIC_*), source maps primary, byte scans corroboration; Android applicability documented (no rerun for ceremony); iOS untouched                                                                                                                                                                                                                                                                                           |
| Failures and safety stops explicit                      | lint-crash and TS2322 preserved+classified (6.7 ledger); no stop condition crossed (no production/signing/secret/force operations)                                                                                                                                                                                                                                                                                                                                        |
| Publication scoped, fast-forward only                   | publication deliberately unfulfilled; commits local-only; no force push/rewrite; foreign state intact                                                                                                                                                                                                                                                                                                                                                                     |
| Hosted success tied to exact pushed SHA                 | no push → no hosted claim; run 36965502815 relabeled remote-baseline historical CI (kept red-with-skipped-E2E at `891ed228`); skipped E2E never counted green; the unpublished local tip has no hosted run                                                                                                                                                                                                                                                                |
| Closure reconciliation preserves certification truth    | `final-certification-closure/{closure-report,execplan}.md` triage notes only; NOT CERTIFIED, 17/22, Android/J8/iOS/production truths intact                                                                                                                                                                                                                                                                                                                               |
| Two truthful terminal outcomes                          | `PRECISELY BLOCKED` chosen on complete proof; conditional tasks unchecked; no fake green                                                                                                                                                                                                                                                                                                                                                                                  |
| Final handoff and process hygiene auditable             | this A–J report + categorized residuals; `web:hygiene` + foreign verification in the campaign ledger                                                                                                                                                                                                                                                                                                                                                                      |

Brief sections 0–19 are covered by A–J and the tables above; the design's
input-coverage mapping (all 19 sections) stands unchanged.
