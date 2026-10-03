## 1. Preflight and reproduction

- [x] 1.1 Preserve starting state: fetch/prune, record `main == origin/main == HEAD == 82555461800bea2a0e5ba7cebd5c7db306691476`, one worktree, stash `pre-recovery-local-changes`, foreign untracked roots; verify Node `v22.23.2` / npm `10.9.8` on the pinned toolchain (`simulation-output/security-braces-triage/registry-state.json` toolchain field)
- [x] 1.2 Reproduce the live red: `node scripts/audit-runtime-deps.mjs` exits 1 with exactly two undocumented highs (`braces`, `node-forge`) and three documented `brace-expansion` entries (`simulation-output/security-braces-triage/audit-gate.log`)
- [x] 1.3 Retain full and production-only audit reports and exit codes (`npm-audit-full.json`, `npm-audit-prod.json`)
- [x] 1.4 Record the observed exact-head CI failure: run `37136146011` at `8255546`, `quality` failed only at `Audit runtime dependencies`, `e2e`/`nightly` skipped (`ci-run-37136146011.json`, `-jobs.json`)

## 2. Complete braces graph

- [x] 2.1 Record every installed/locked copy: one physical copy `node_modules/braces@3.0.3` with no `dev` flag, resolved from the registry (`braces-path-ledger.json`)
- [x] 2.2 Record every direct parent with required range and dev status: `chokidar@3.6.0 (~3.0.2)`, `micromatch@4.0.8 (^3.0.3)` (`braces-path-ledger.json`, `npm-ls-braces.txt`, `npm-explain-braces-top.txt`)
- [x] 2.3 Record every production consumer of the hoisted `micromatch` copy: `@jest/transform@29.7.0`, `fast-glob@3.3.3`, `jest-haste-map@29.7.0`, `jest-message-util@29.7.0`, `metro-file-map@0.83.8`, `tailwindcss@3.4.19`; dev-only: `find-yarn-workspace-root@2.0.0` (`braces-path-ledger.json`)
- [x] 2.4 Trace each production chain to root: `expo@55.0.31 → @expo/metro@55.1.2 → metro-file-map@0.83.8 → micromatch`; `react-native@0.83.10 → babel-jest@29.7.0 → @jest/transform@29.7.0 → jest-haste-map` and `react-native → jest-environment-node → @jest/fake-timers → jest-message-util`; `tailwindcss@3.4.19 → chokidar` and `→ fast-glob → micromatch` (`npm-explain-braces-full.txt`)

## 3. Advisory truth

- [x] 3.1 Verify `GHSA-vfj7-8cjw-p6xm` from the GitHub advisory API: CVE-2026-93687, HIGH, CVSS 7.5 (CWE-674), published 2026-09-18T18:31:41Z, updated 2026-10-02T22:36:34Z, affected `<= 3.0.3`, `first_patched_version: null` (`ghsa-vfj7-8cjw-p6xm.json`)
- [x] 3.2 Verify npm registry advisory agreement: advisory `1240992`, `vulnerable_versions <=3.0.3`, no `patched_versions` (`npm-advisory-bulk.json`)
- [x] 3.3 Distinguish npm's finding-level `range: *` from the advisory range: raw report shows `via[0].range == "<=3.0.3"` while top-level `range == "*"`; producer source confirms `toJSON()` serializes `simpleRange` over tree versions while the advisory retains its published range (`npm-audit-prod.json`, capture notes in `final-report.md` §C)
- [x] 3.4 Record the vulnerable code path: recursive AST walkers in `lib/parse.js`, `lib/expand.js`, `lib/stringify.js`, `lib/compile.js` (depth guards added by upstream PR #72); attacker needs a deeply nested pattern string
- [x] 3.5 Record npm's offered fix: `tailwindcss@4.3.3` (`isSemVerMajor: true`) (`npm-audit-prod.json` fixAvailable)

## 4. Shipped exposure and tooling reachability

- [x] 4.1 Enumerate every source-map section of the retained hermetic web export: 3 maps, 1992 sources, zero `braces`/`micromatch`/`chokidar`/`tailwindcss` modules (`export-web-braces-analysis.json`)
- [x] 4.2 Enumerate the retained hermetic Android JS export: 1 map, 2342 sources, zero module hits (`export-android-braces-analysis.json`)
- [x] 4.3 Corroborate with whole-output byte scans of `dist/`, `dist-sync/`, and both exports; classify every `braces` hit as the React error string or MaterialCommunityIcons glyph names and the one `tailwindcss` hit as the generated-CSS banner inside map `sourcesContent`
- [x] 4.4 Show source identity for export reuse: `git diff --stat 891ed228..HEAD` contains no `app/`, `features/`, `core/`, `lib/` or bundling source; `dist` and the retained web export share the bundle filename identity (`entry-8c182cd879ebc5bb55e236aa4a22b362`)
- [x] 4.5 Scan the on-disk APK with the existing archive scanner: zero hits for `micromatch`/`chokidar`/`tailwindcss`/`node-forge`; the single `braces` entry hit is the icon glyph map; record the provenance-mismatched hash `F3D9A63C…` (`apk-braces-scan.json`)
- [x] 4.6 Inspect edge/server sources: `supabase/functions/**` imports no `braces`/`micromatch`
- [x] 4.7 Characterize every tooling call site and its input provenance (`tooling-call-sites.txt`): micromatch compiles repository/config patterns; chokidar expands watch paths containing `{` only in `tailwindcss --watch`; Metro/Jest matchers test file paths against config globs; no runtime or untrusted-input path exists

## 5. Remediation ladder

- [x] 5.1 Patched release: none — latest `braces` is `3.0.3` (2024-05-21), advisory range `<=3.0.3`, `patched_versions` absent, upstream PR #72 open/unmerged (head `28d440b5`, updated 2026-10-03), tags end at `3.0.3`, and the PR does not bump the package version
- [x] 5.2 Compatible parent update: none — `chokidar@3.6.0` is the last 3.x; `micromatch@4.0.8` is latest; `tailwindcss@3.4.19` is the `v3-lts` tag; `fast-glob@3.3.3` latest still requires `micromatch@^4.0.8`; `metro-file-map` `0.83.8`/`0.84.6`/`0.87.1` all require `micromatch@^4.0.4`; `@jest/transform@30.5.2` still uses `jest-haste-map@30.5.1` (`registry-state.json`)
- [x] 5.3 npm override: no fixed version exists to target; a git-ref override to unmerged PR #72 is rejected (unreleased, unreviewed, provenance change, and the unchanged package version keeps the advisory match); no drop-in replacement package is published (`registry-state.json`, `final-report.md` §E)
- [x] 5.4 Path removal: rejected — `braces` has exactly two direct parents (`chokidar` = Tailwind watch tooling only; `micromatch` = Metro/Expo, React Native's Jest stack, Tailwind content matching, openspec, patch-package); none is removable without replacing framework build/test tooling
- [x] 5.5 Smallest family upgrade (npm's own suggestion, Tailwind 4): rejected — breaking (Tailwind 4 publishes zero dependencies but NativeWind 4 / `react-native-css-interop` peer `tailwindcss ~3`; only the `nativewind@5.0.0-rc.0` preview supports Tailwind 4) **and** insufficient (Metro/Jest `micromatch` paths remain, so the audit finding persists)
- [x] 5.6 Major tooling upgrade (Expo/React Native/Metro families): rejected — every inspected latest release still requires `micromatch`, the migration is disproportionate, and it would not clear the finding
- [x] 5.7 Exception policy: evaluated against the gate predicates and rejected — the affected recursive walkers are executed by build tooling, the policy stays strict, and an entry would not clear CI while `node-forge` remains undocumented; `DOCUMENTED_BUILD_TIME_ADVISORIES` is byte-unchanged (`git diff` empty)

## 6. Node-forge refresh

- [x] 6.1 Registry: latest `node-forge` is `1.4.0` (vulnerable), tags end at `v1.4.0` (`registry-state.json`)
- [x] 6.2 Advisory: `GHSA-86w9-cpqp-85rv` still `first_patched_version: null`, updated 2026-10-01 (`ghsa-86w9-cpqp-85rv.json`)
- [x] 6.3 Upstream fix PR `digitalbazaar/forge#1152` still open, head unchanged `ceba344…` (`forge-upstream-pr1152.json`)
- [x] 6.4 Parent ranges unchanged: `@expo/cli@57.0.27` still `^1.3.3`; `@expo/cli@55.0.36` `^1.3.3`; `@expo/code-signing-certificates@0.0.7` `^1.4.0` (`registry-state.json`)
- [x] 6.5 Record `NO MATERIAL UPSTREAM CHANGE` and stop forge work (`final-report.md` §F)

## 7. Terminal state, records, and validation

- [x] 7.1 Make no dependency or policy change; verify `git diff` for `package.json`, `package-lock.json`, and `scripts/audit-runtime-deps.mjs` is empty
- [x] 7.2 Write the triage record: `proposal.md`, `specs/braces-security-triage/spec.md`, `tasks.md`, `execplan.md`, `final-report.md`
- [x] 7.3 Record the dual-blocker resume matrix with exact trigger events and commands (`final-report.md` §L)
- [x] 7.4 Validate the change: `npm run openspec:validate` and `npm run agent:plan:validate:all` pass from the final tree; the audit gate still reproduces the same two undocumented highs (`simulation-output/security-braces-triage/audit-gate.log`)
- [x] 7.5 Commit only the owned OpenSpec record (no fake dependency change, no push; remote `main` stays at `8255546` and its exact-head CI outcome is unchanged)

## 8. Bounded remediation (conditional, not earned)

- [ ] 8.1 Land a safe `braces` remediation if a published patched release or a safe compatible parent/override target appears — NOT EARNED: no such target exists upstream as of 2026-10-03
- [ ] 8.2 Re-run dependency mutation validation (`npm ci`, `npm ls braces --all`, `npm audit`, gate) and the impact-appropriate QA if a remediation is landed — NOT EARNED: no dependency change is made
