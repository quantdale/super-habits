# Final report — braces security triage and dependency blocker convergence

Campaign date: 2026-10-03 (UTC). Toolchain: Node `v22.23.2` / npm `10.9.8`.
Evidence root (gitignored): `simulation-output/security-braces-triage/`.
No production, Supabase, native, signing, or release action was taken.

## A. Repository identity

- Starting SHA: `82555461800bea2a0e5ba7cebd5c7db306691476`
  (`main == origin/main == HEAD`, re-verified after `git fetch --all --prune`).
- Ending SHA: the local commit that records this change (`git log -1` at the tip of
  `main`; the commit adds only this change directory). `origin/main` was not
  advanced (no publication; see §I).
- Branch: `main`. One worktree. Stash `pre-recovery-local-changes` preserved.
  Foreign untracked roots preserved (iOS extract, prior change directories).
- Observed exact-head CI at the starting SHA: run `37136146011` — `quality`
  failed exactly at `Audit runtime dependencies`; `e2e` and `nightly` skipped.

## B. Braces dependency graph

One physical copy, two direct parents (machine-verifiable ledger:
`braces-path-ledger.json`):

```text
node_modules/braces@3.0.3   (no dev flag; registry tarball)
├─ required by node_modules/chokidar@3.6.0        range ~3.0.2   [production]
│  └─ required only by tailwindcss@3.4.19 (CLI watch mode; lib/cli/build/watching.js)
└─ required by node_modules/micromatch@4.0.8      range ^3.0.3   [production]
   ├─ tailwindcss@3.4.19         (direct, ^4.0.8; content matcher)
   ├─ fast-glob@3.3.3            (^4.0.8; tailwindcss ^3.3.2, @fission-ai/openspec ^3.3.3 dev)
   ├─ metro-file-map@0.83.8      (^4.0.4; expo@55.0.31 → @expo/metro@55.1.2)
   ├─ @jest/transform@29.7.0     (^4.0.4; react-native@0.83.10 → babel-jest@29.7.0)
   ├─ jest-haste-map@29.7.0      (^4.0.4; @jest/transform)
   ├─ jest-message-util@29.7.0   (^4.0.4; react-native → jest-environment-node → @jest/fake-timers)
   └─ find-yarn-workspace-root@2.0.0 (^4.0.2; patch-package@8.0.1, dev)
```

Complete parent/consumer record: `npm-explain-braces-full.txt`,
`npm-ls-braces.txt`, `braces-path-ledger.json`. `npm ls --omit=dev
micromatch --all` confirms the Metro and React Native Jest paths are production
(`--omit=dev` output in the validation log). **Correction (2026-10-04):** this
is the npm package graph. It understates braces presence: installed tool
distributions also bundle their own parser copies (rollup ×2, vite, prettier,
resolve-workspace-root) that `npm ls`/`npm audit` cannot see
(`vendored-braces-detection.json`).

## C. Advisory state

- Advisory: `GHSA-vfj7-8cjw-p6xm` (CVE-2026-93687), HIGH, CVSS 3.1 7.5
  (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`), CWE-674.
- Published 2026-09-18T18:31:41Z; updated 2026-10-02T22:36:34Z
  (`ghsa-vfj7-8cjw-p6xm.json`).
- Affected range: `<= 3.0.3` — every published `braces` version.
- Patched version: **none**; `first_patched_version: null`. npm registry
  advisory `1240992` agrees (`vulnerable_versions <=3.0.3`, no
  `patched_versions`) (`npm-advisory-bulk.json`).
- Installed version: `3.0.3` (registry latest; published 2024-05-21; no
  release since — `registry-state.json`).
- Exploit primitive: a deeply nested brace pattern exhausts the call stack in
  the recursive AST walkers (missing depth guards) and terminates the Node
  process with an uncaught `RangeError`.
- Derived vs published range: the audit's finding-level `range: *` is npm's
  `Vuln.toJSON()` `simpleRange` over the installed tree; the individual
  advisory entry keeps `range: "<=3.0.3"` (`via[0].range`). The wildcard is a
  producer artifact, not a claim that a future patched version is affected.
- Upstream fix: `micromatch/braces#72` ("fix: prevent stack overflow from
  deeply nested patterns") — open, `mergeable_state: clean`, head
  `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`, 8 commits / 12 files, updated
  2026-10-03; **not merged, not released**, and it does not change
  `package.json` (`braces-upstream-pr72.json`).
- npm's offered fix: `tailwindcss@4.3.3`, `isSemVerMajor: true`
  (`npm-audit-prod.json`).

## D. Exposure

### Shipped web (hermetic export, source maps)

74 files, 3 map sections, 1992 module sources; zero `braces`/`micromatch`/
`chokidar`/`tailwindcss` modules (`export-web-braces-analysis.json`). Byte
scan: zero `micromatch`/`chokidar`/`tailwindcss`/`node-forge` hits; `braces`
hits are the React error string "wrap your children in braces" and
MaterialCommunityIcons glyph names (`code-braces`, `cloud-braces`); the one
`tailwindcss` hit is the generated-CSS banner in map `sourcesContent`.
Current `dist/` and `dist-sync/` byte scans: zero `micromatch`/`chokidar`/
`tailwindcss`/`node-forge`; same classified `braces` false positives. The
current `dist/` bundle shares the retained export's filename but not its
bytes; byte identity is not claimed, and after the 2026-10-04 correction no
cause for the difference is asserted (`dist-env-markers.json` retracts the
earlier ambient-`.env` explanation).

### Shipped Android JS (hermetic export, source maps)

77 files, 1 map, 2342 module sources; zero module hits
(`export-android-braces-analysis.json`). Byte scan: zero hits for all needles.

### APK (supplementary, provenance-limited)

`android/app/build/outputs/apk/release/app-release.apk` sha256
`F3D9A63C39589FCA3BD91BDDFCC1C6AB0AD43A2ADEDE50E2F3A502B143D961C5` (does not
match the retained green build record; no qualification transfers). Full
archive scan (`apk-braces-scan.json`): zero hits for `micromatch`, `chokidar`,
`tailwindcss`, `node-forge`; the single `braces` entry hit is the icon glyph
map inside `assets/index.android.bundle`.

### Edge/server

`supabase/functions/**` imports no `braces`/`micromatch` and contains neither
package name. No other deployed server artifact exists in the repository.

### Reachability separation

- **A. Package presence:** absent from every shipped artifact and module graph
  that could be checked.
- **B. Runtime API reachability:** no runtime path — no application or server
  source imports the package; the vulnerable parser is not in any bundle.
- **C. Tooling exposure (corrected 2026-10-04):** the affected parser **is**
  executed by build/test tooling, but only through specific entry points:
  `micromatch.parse`/`micromatch.braces`, reached by `fast-glob@3.3.3`
  (`out/utils/pattern.js:137`) when `tailwindcss` expands
  `tailwind.config.js` content globs, and `chokidar`'s `braces.expand`
  (`index.js:258`) only for `tailwindcss --watch` paths containing `{`.
  `micromatch.matcher`/`some`/`any`/main and the Jest/Metro consumers use
  picomatch only and do not enter the parser (`api-reachability.json`,
  `tooling-call-sites.txt`). Installed tool distributions also bundle
  npm-invisible parser copies (rollup ×2, vite, prettier,
  resolve-workspace-root). In every observed case the vulnerable _pattern_
  input is repository/configuration-controlled, and no untrusted or
  user-controlled string reaches it.

## E. Options tested

| #   | Candidate                   | Result                                          | Evidence / reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Patched `braces` release    | **Rejected — none exists**                      | Latest 3.0.3 = vulnerable version; `first_patched: null`; PR #72 open/unmerged, unreleased, no version bump                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2   | Compatible parent update    | **Rejected — none exists**                      | `chokidar` 3.x ends at 3.6.0; `micromatch` ends at 4.0.8; `tailwindcss` 3.x ends at 3.4.19 (`v3-lts`); `fast-glob` 3.3.3 still requires `micromatch ^4.0.8`; `metro-file-map` 0.83.8/0.84.6/0.87.1 all `^4.0.4`; `@jest/transform` 30.5.2 still `jest-haste-map` 30.5.1                                                                                                                                                                                                                                                                                               |
| 3   | npm override                | **Rejected — no target**                        | No fixed version exists to point at; PR #72 git-ref override rejected (unreleased/unreviewed, provenance change, version stays 3.0.3 so the advisory still matches). 2026-10-04 bounded substitution assessment (`substitution-assessment.json`): `brace-expansion` not a drop-in (installed 2.1.4 lacks `expand`/`compile`/`parse`/`stringify`/`create`; published 5.0.12 is an object exposing `expand` only and is not callable, while micromatch calls `braces(pattern, options)` as a function); `picomatch` is a matcher only; limits recorded in the artifact. |
| 4   | Remove the path             | **Rejected — not removable**                    | Parents are Tailwind (via `chokidar` and `micromatch`), Expo's `metro-file-map`, React Native's Jest stack, `openspec`, `patch-package`; replacing them means replacing the build/test framework                                                                                                                                                                                                                                                                                                                                                                      |
| 5   | Smallest family upgrade     | **Rejected — breaking AND insufficient**        | `tailwindcss@4.3.3` publishes zero dependencies but NativeWind 4 / `react-native-css-interop` peer `tailwindcss ~3`; only `nativewind@5.0.0-rc.0` (preview/RC) supports Tailwind 4; and the Metro/Jest `micromatch` production paths persist, so the finding would remain                                                                                                                                                                                                                                                                                             |
| 6   | Major tooling upgrade       | **Rejected — disproportionate and ineffective** | Latest `@expo/metro` → `metro-file-map@0.84.6` still `micromatch ^4.0.4`; React Native Jest stack still `micromatch`; no inspected release removes the path                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7   | Narrow documented exemption | **Rejected — not added**                        | Affected recursive walkers are executed by tooling; gate policy is preserved strictly; an entry would not clear CI while `node-forge` remains undocumented, and prefer-truthful-red discipline applies                                                                                                                                                                                                                                                                                                                                                                |

## F. Node-forge refresh

**NO MATERIAL UPSTREAM CHANGE.**

- Registry latest: `node-forge@1.4.0` (still in range `<=1.4.0`); tags end
  `v1.4.0`.
- Advisory `GHSA-86w9-cpqp-85rv` still `first_patched_version: null`
  (updated 2026-10-01).
- Upstream PR `digitalbazaar/forge#1152` still open, head unchanged
  `ceba34402e329f0365134f23fe19898756527d65`.
- Parent ranges unchanged: `@expo/cli@57.0.27` → `^1.3.3`;
  `@expo/cli@55.0.36` → `^1.3.3`; `@expo/code-signing-certificates@0.0.7` →
  `^1.4.0`.

Evidence: `registry-state.json`, `ghsa-86w9-cpqp-85rv.json`,
`forge-upstream-pr1152.json`. Per the campaign rule, no further forge work was
performed.

## G. Remediation

None. No dependency, lockfile, audit-policy, test, source, or workflow change
was made. `git diff --stat` for `package.json`, `package-lock.json`, and
`scripts/audit-runtime-deps.mjs` is empty; `DOCUMENTED_BUILD_TIME_ADVISORIES`
is byte-unchanged. The only committed change is this OpenSpec record. No
forced fix, no dependency relocation, no wildcard exception, no `node_modules`
edit.

## H. Validation

| Command (toolchain as actually executed)                                                             | Outcome                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/audit-runtime-deps.mjs` (first run, ambient Node `v24.3.0` / npm `11.4.2`)             | exit 1; 2 undocumented highs + 3 documented `brace-expansion`; later reproduced pinned (retained `audit-gate.log`)                                                                                |
| `npm audit --json` (ambient) / `npm audit --omit=dev --json` (pinned)                                | exit 1; reports retained                                                                                                                                                                          |
| `npm ls braces --all` / `npm explain braces` (`npm ls` ambient; explain pinned)                      | single copy; two direct parents; full consumer paths (pinned reproductions in `toolchain-attribution.txt`)                                                                                        |
| `npm ls --omit=dev micromatch --all`                                                                 | production consumers confirmed (Metro, Jest stack, Tailwind)                                                                                                                                      |
| Source-map module-graph analyses (web/Android)                                                       | 0 module hits (1992 / 2342 sources)                                                                                                                                                               |
| Byte scans (`dist/`, `dist-sync/`, exports) + APK archive scan                                       | 0 package hits; all name hits classified                                                                                                                                                          |
| Executed call-site / API-reachability / vendored-copy / substitution assessment (pinned, 2026-10-04) | corrected evidence in `tooling-call-sites.txt`, `braces-callsite-ledger.json`, `api-reachability.json`, `vendored-braces-detection.json`, `substitution-assessment.json`, `dist-env-markers.json` |
| `npm run qa:fast` (pinned, 2026-10-03, pre-commit)                                                   | PASS; 171 files / 2143 tests, plus journey-label/quarantine-register/release-profile parity                                                                                                       |
| Focused security/documentation suites (pinned, pre-commit)                                           | PASS; 6 files / 121 tests (auditRuntimeDeps 80, nodeForgeSecurityGuards 7, agent-execplan 9, agentDocConsistency 11, Maestro guards 14)                                                           |
| `npm run openspec:validate`                                                                          | passes all items, including this change (re-run 2026-10-04)                                                                                                                                       |
| `npm run agent:plan:validate:all`                                                                    | passes, including this BLOCKED plan (re-run 2026-10-04)                                                                                                                                           |

`npm ci` and `qa:full` were not run because no dependency changed; the locked
graph is untouched. Build-tool validation was read-only artifact/module-graph
inspection of the retained source-bound exports, whose source identity with
HEAD is shown in §B/§D (the byte difference at equal filename is not claimed
as identity). `qa:fast` and the focused suites did run on the pinned toolchain
before the record commit; the earlier statement that no QA was earned was
incorrect and is superseded by this table.

## I. Exact-head CI

- SHA: `82555461800bea2a0e5ba7cebd5c7db306691476` (remote `main` unchanged).
- Run: `37136146011` — `quality`: **failure**, failing step exactly
  `Audit runtime dependencies`; `e2e`: skipped (quality failed); `nightly`:
  skipped as expected. No cancellations or ancestor runs counted as success.
- No publication was performed because no dependency remediation exists;
  committing the triage record alone would not change the audit outcome and
  would only re-demonstrate the same red. Publication is withheld until the
  upstream unblock condition (or another safe repair) is met.

## J. Remaining security blockers

1. `braces` `GHSA-vfj7-8cjw-p6xm` — `DEPENDENCY_VULNERABILITY /
UPSTREAM_BLOCKED`: no published fixed release; no compatible parent/override
   target; no removable path; not shipped; tooling-only execution on
   repository-controlled patterns.
2. `node-forge` `GHSA-86w9-cpqp-85rv` — `DEPENDENCY_VULNERABILITY /
UPSTREAM_BLOCKED` (unchanged from the prior campaign): no published fixed
   release; all inspected parent ranges retain the vulnerable range.

## K. Existing project residuals

Unchanged, not reopened, not promoted:

- Android: GREEN (retained prior qualification; not re-run — no native artifact
  impact).
- J8: `NOT_TRIGGERED` with valid `622/800 ms` evidence.
- iOS: `DEFERRED_BY_OWNER / ENVIRONMENT`.
- Production catalog: `CREDENTIAL / EXTERNAL`; recovery proven absent; DDL
  stopped.
- Overall certification: **NOT CERTIFIED**.

## L. Resume matrix

| Blocker      | Current package | Required event                                                                                                                                                                                                      | Resume command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `braces`     | `3.0.3`         | A published `braces > 3.0.3` (expected after `micromatch/braces#72` merges and releases) satisfying `chokidar ~3.0.2` / `micromatch ^3.0.3`, or a supported parent/toolchain release removing every production path | `git fetch --all --prune && git rev-parse HEAD origin/main && npm view braces version && curl -s https://api.github.com/advisories/GHSA-vfj7-8cjw-p6xm && npm view micromatch dependencies.braces && npm view chokidar@3 version` — then if safe: minimal `npm install --package-lock-only`/override edit → `npm ci` → `npm ls braces --all` (no vulnerable copy) → `node scripts/audit-runtime-deps.mjs` (no braces finding) → `npm run typecheck && npm run lint && npm run openspec:validate && npm run agent:plan:validate:all && npm test` → `npx vitest run tests/auditRuntimeDeps.test.ts tests/nodeForgeSecurityGuards.test.ts` (+ any new braces guard) → `npm run qa:fast`, escalating to `npm run qa:full` and build-tool validation if resolution/bundling changes |
| `node-forge` | `1.4.0`         | A published `node-forge > 1.4.0` satisfying both `^1.3.3` parents (PR #1152 merge alone is insufficient), or a supported `@expo/cli` / `@expo/code-signing-certificates` release removing both paths                | `git fetch --all --prune && npm view node-forge version && curl -s https://api.github.com/advisories/GHSA-86w9-cpqp-85rv && npm view @expo/cli@latest dependencies.node-forge && npm view @expo/code-signing-certificates@latest dependencies.node-forge` — then the same minimal-bump → `npm ci` → gate → validation sequence, following `resolve-windows-dependency-security/options-ledger.md`                                                                                                                                                                                                                                                                                                                                                                              |

## M. Verdict

**DEPENDENCY SECURITY PRECISELY BLOCKED**

`braces` has no safe executable remediation today (no patched release, no
compatible parent or override target, no removable path, and no proportionate
family upgrade that would clear the finding), and `node-forge` was refreshed to
`NO MATERIAL UPSTREAM CHANGE`. The audit gate remains truthfully red; the
resume matrix above is the exact continuation point.

## N. Independent-review corrections (2026-10-04)

An independent two-axis review of the `8255546`→`1688252` record found six
valid evidence/reporting defects. All six are resolved in this addendum's
sibling edits and the regenerated evidence; the security verdict does not
change.

1. **Tooling provenance completed and corrected.** `tooling-call-sites.txt` now
   records the executed APIs per consumer and each input's provenance, backed
   by `braces-callsite-ledger.json` and `api-reachability.json`. The genuine
   parser entry points are `micromatch.parse`/`micromatch.braces` (via
   `fast-glob`) and `chokidar`'s `braces.expand`; `matcher`/`some`/`any`/main
   calls are picomatch-only.
2. **Reachability classification corrected** in §D/C above.
3. **npm-invisible bundled copies recorded** (rollup ×2, vite, prettier,
   resolve-workspace-root) in §B and §D/C.
4. **Substitution rejection now assessed**, not asserted (§E option 3).
5. **Toolchain attribution corrected** in §H; ambient Node `v24.3.0`/npm
   `11.4.2` ran the preflight, first gate and full audit, with pinned
   reproductions for the retained gate and production audit
   (`toolchain-attribution.txt`).
6. **QA reconciliation and byte-claim retraction** in §H/the export note: the
   earlier ambient-`.env` byte-difference explanation is withdrawn
   (`dist-env-markers.json`), and the pre-commit `qa:fast`/focused-suite runs
   are recorded instead of being described as unearned.
