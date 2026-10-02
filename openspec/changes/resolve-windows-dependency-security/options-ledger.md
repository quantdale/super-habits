# Ranked options ledger — resolve-windows-dependency-security (apply)

Task 3.5 deliverable. All registry/advisory/parent observations re-queried
2026-10-02 on the pinned toolchain at `891ed228`; raw captures in
`simulation-output/security-apply-2026-10-02/`. Exposure facts are in
[exposure-assessment.md](exposure-assessment.md).

## Option 1 — compatible direct-parent update (task 3.1)

| Parent                            | Line checked                                   | `node-forge` requirement | Removal of vulnerable path?                   |
| --------------------------------- | ---------------------------------------------- | ------------------------ | --------------------------------------------- |
| `@expo/cli` 55.0.30–55.0.36       | the supported Expo 55 family (55.0.36 is last) | `^1.3.3`                 | No                                            |
| `@expo/cli` 56.0.0–56.1.26        | next family                                    | `^1.3.3`                 | No                                            |
| `@expo/cli` 57.0.27 (latest)      | next family                                    | `^1.3.3`                 | No                                            |
| `@expo/cli` 58.0.0–58.1.1 (next)  | newest line                                    | `^1.3.3`                 | No                                            |
| `@expo/code-signing-certificates` | 0.0.6 (installed) → 0.0.7 (latest)             | `^1.3.3` → `^1.4.0`      | No — 0.0.7 requires the same vulnerable range |

`expo` 55 family is complete at 55.0.31 (dist-tag `sdk-55`). No published
parent release removes either affected path. **No viable target exists.**

## Option 2 — compatible fixed `node-forge` override (task 3.2)

- npm registry: `node-forge` versions end at **1.4.0**; dist-tag
  `latest = 1.4.0`; `time.modified 2026-03-24`. GitHub: no releases, top tag
  `v1.4.0`.
- Advisory `GHSA-86w9-cpqp-85rv` (CVE-2026-85393, HIGH, CWE-347, CVSS 7.5):
  individual vulnerable range `<= 1.4.0`, `first_patched_version: null`
  (npm's grouped entry shows range `*` — the two fields are not the same fact).
  Updated 2026-10-01; an incomplete fix for CVE-2026-33894.
- Both parents require `^1.3.3`, so a future published `1.4.1` (or later
  minor) would satisfy every range and resolve cleanly — but **no such
  version is published**. The upstream fix PR `digitalbazaar/forge#1152`
  (head `ceba344…`) is still **open/unmerged**; its changelog's mention of
  1.4.1 is not a release. Overriding to a nonexistent version, vendoring the
  unreviewed PR patch (also ineffective: `npm audit` evaluates the locked
  version, not patched files), or installing a random fork are explicitly
  rejected by the design and would not clear the advisory.

**No override target exists.**

## Option 3 — smallest compatible family adjustment (task 3.3)

A framework-family bump (`expo` SDK 56/57/58, `@expo/cli` 56/57/58) is a
major migration the brief forbids without sufficient validation — and it does
not fix the finding: every inspected CLI release through 58.1.1 still requires
`node-forge@^1.3.3` + `@expo/code-signing-certificates@^0.0.6`. npm's own
offered fix is `expo@44.0.6` (`isSemVerMajor: true`) — a breaking downgrade;
`npm audit fix --dry-run` instead proposes the unrelated `react-native@0.87.1`
bump (the same breaking resolution already rejected in the brace-expansion
documentation). Neither is accepted; `npm audit fix --force` is never run.

**Rejected: no safe family adjustment exists.**

## Option 4 — remove an unused dependency path / supported substitution (task 3.3)

Both paths are inside `@expo/cli`, the framework build tool that supports the
product/build system. The code-signing chain is exercised (development
certificate validation, dev-manifest signing, CSR issuance, iOS/macOS
signing-identity parsing), so it is not an unused chain: removal would require
forking/patching the CLI (not a supported change), and `expo` itself is the
runtime framework, not removable. A substitution for `node-forge` inside the
helper/CLI would replace a mature PKI implementation with an unproven one and
has no supported, provenance-checked candidate. Relocating the dependency to
`devDependencies` or filtering it from bundles would only hide it and is
forbidden by the design.

**Rejected: no safe removal or substitution exists.**

## Option 5 — narrow documented exemption (task 3.4)

Predicate-by-predicate (all must hold):

| #   | Predicate                                                          | Status at apply time                                                                                         |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | No safe patched dependency exists                                  | **Proven** (Option 2)                                                                                        |
| 2   | No safe parent upgrade exists                                      | **Proven** (Option 1)                                                                                        |
| 3   | Dependency demonstrably not runtime-reachable in shipped artifacts | Proven for web/android JS source-bound module graphs (APK supplementary, provenance-mismatched) — but see #4 |
| 4   | The vulnerability's affected API is not used                       | **FAILS** — tooling calls `certificate.verify` / `publicKey.verify` / `csr.verify` (exposure-assessment §3)  |
| 5   | Classification is reproducible                                     | Would hold (audit + path analysis reproduce exactly)                                                         |
| 6   | Exact package/path/advisory named                                  | Would hold (`node-forge` / `node_modules/node-forge` / `GHSA-86w9-cpqp-85rv`)                                |
| 7   | Date, rationale, removal condition supplied                        | Would hold                                                                                                   |

Predicate 4 fails on direct source evidence, so the exception is **ineligible**
— independently of predicate 3's provenance limits. The new-high/critical gate
policy is preserved unchanged; no allowlist entry is added for forge.

## Selected branch (task 3.6)

**No safe executable vulnerability repair exists.** The campaign routes to the
precisely-blocked evidence/report path (tasks 8.4, 9.x) with the audit gate
retained red — it cannot truthfully pass while a real undocumented high
advisory remains in the production tree. Conditional repair/publication tasks
(4.x, 7.x) remain unchecked. The independent `AUDIT_POLICY_BUG` (fail-open
command/report seam) is separately and safely executable and is implemented in
Phase 5 — parser success is explicitly **not** claimed to resolve forge.

Exact upstream condition to resume dependency remediation (any one of):

1. a published, independently verified compatible fixed `node-forge` release
   (≥ 1.4.1 satisfying both parents' `^1.3.3` ranges) — PR merge alone is
   insufficient; or
2. a supported `@expo/cli` / `@expo/code-signing-certificates` release that
   removes **both** vulnerable paths; or
3. a proven safe supported substitution with its own compatibility/security
   provenance.

Exact resume sequence: fetch then-current `main`; re-query the advisory API,
npm registry and parent manifests; repeat the graph/exposure checks; pursue
only an evidenced safe candidate (design Decision 3 order); then run the
Phase-4 repair/regression/validation/publication tasks.
