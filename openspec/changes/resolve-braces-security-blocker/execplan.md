# ExecPlan: Resolve the braces security blocker

Plan-Version: 2
Status: BLOCKED

## Purpose / User Outcome

Complete a bounded, exhaustive triage of the `braces` advisory
`GHSA-vfj7-8cjw-p6xm` (CVE-2026-93687) that surfaced on top of the retained
`node-forge` blocker, and either:

1. land the smallest genuinely safe non-breaking remediation (published fixed
   release, compatible parent update, safe override, or safe path removal) and
   re-evaluate exact-head CI; or
2. prove no safe executable remediation exists and record a precise
   upstream-blocked state with complete dependency/exposure/upstream evidence
   and an exact resume matrix.

In both cases the audit gate stays truthful: no forced fix, no allowlist
weakening, no dependency relocation, no framework migration just to satisfy
`npm audit`, and no fake green.

## Context

- Repository: `quantdale/super-habits`, branch `main`.
- Starting state (verified 2026-10-03): `main == origin/main == HEAD ==
82555461800bea2a0e5ba7cebd5c7db306691476`. Exact-head CI run `37136146011`
  fails `quality` exactly at `Audit runtime dependencies`; `e2e` and `nightly`
  are skipped because quality failed.
- Pinned toolchain for every gate: Node `v22.23.2`, npm `10.9.8`
  (`/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64`). Ambient Node
  `v24.3.0` / npm `11.4.2` ran no gate; its extra `npm ls` "invalid" markers
  were confirmed as ambient-tool artifacts and are absent under the pinned
  toolchain.
- Prior artifact: `resolve-windows-dependency-security` (Status COMPLETED,
  verdict `PRECISELY BLOCKED`) owns the `node-forge` campaign. Its exposure
  findings and audit-boundary hardening are preserved, not rewritten.
- Live red reproduction: `node scripts/audit-runtime-deps.mjs` exits 1 with
  exactly two undocumented highs — `braces GHSA-vfj7-8cjw-p6xm
[node_modules/braces]` and `node-forge GHSA-86w9-cpqp-85rv
[node_modules/node-forge]` — plus three dated documented `brace-expansion`
  entries.
- Evidence root (gitignored): `simulation-output/security-braces-triage/`.
- The audit gate (`scripts/audit-runtime-deps.mjs`) runs `npm audit
--omit=dev --json --audit-level=info --offline=false`, validates the report
  fail-closed, and gates only direct high/critical advisories. It is **not**
  modified by this change; no gate correctness defect was found.

## Scope

- `braces` advisory triage: dependency graph, advisory truth, shipped-artifact
  exclusion, tooling input provenance, the full remediation ladder.
- Bounded `node-forge` upstream refresh for material change only.
- OpenSpec/ExecPlan/evidence records for the triage and the precise blocked
  state.
- Any genuinely safe minimal dependency repair **if one exists** (none was
  found).

## Non-Goals

- Reopening the `node-forge` exposure campaign or its audit-hardening history.
- Framework-wide upgrades (Tailwind 4 / NativeWind 5-RC, Expo SDK, React
  Native, Metro) merely because `npm audit fix --force` suggests them.
- Editing `DOCUMENTED_BUILD_TIME_ADVISORIES`, weakening the high/critical gate,
  `npm audit fix --force`, `node_modules` edits, or vendoring unreleased
  upstream commits.
- Android/iOS re-qualification, production SQL, Supabase mutations, release or
  signing actions, archives, or history rewrites.

## Current Checkpoint

- Milestone: **triage complete and terminal state recorded** — the complete
  `braces` graph, advisory truth, shipped-artifact exclusion, tooling input
  provenance, the full remediation ladder, and the bounded forge refresh are
  evidenced; no safe remediation exists, so no dependency or policy change was
  made and the precise upstream-blocked state is recorded.
- Completed: preflight and state preservation; live red reproduction; full and
  production-only audit reports; single-copy/two-parent graph ledger with every
  production consumer; GitHub + npm advisory verification including the
  derived `range: *` distinction; source-map module-graph exclusion for the web
  (1992 sources) and Android (2342 sources) exports; whole-output byte scans of
  `dist/`, `dist-sync/`, and both exports with every hit classified; APK
  supplementary scan; edge-source inspection; tooling call-site provenance;
  remediation ladder rejection evidence; `NO MATERIAL UPSTREAM CHANGE` for
  `node-forge`; OpenSpec change and ExecPlan written.
- In progress: none — triage and its records are complete; only upstream
  remediation remains, and it is blocked.
- Important modified files: `openspec/changes/resolve-braces-security-blocker/`
  (`proposal.md`, `specs/braces-security-triage/spec.md`, `tasks.md`,
  `execplan.md`, `final-report.md`, `.openspec.yaml`). No dependency, source,
  test, audit-script, or workflow file is modified.
- Last successful validation: pinned Node `v22.23.2` / npm `10.9.8` —
  `node scripts/audit-runtime-deps.mjs` exit 1 reproducing exactly the two
  undocumented highs and three documented entries; `npm run openspec:validate`
  passes all items including this change; `npm run agent:plan:validate:all`
  passes, including this BLOCKED plan; module-graph analyses and APK scan
  completed with zero package-module hits.
- Current failures: exact-head CI `quality` fails at the dependency audit by
  design because two real undocumented high advisories remain; `e2e` is
  skipped behind it. Both advisories are upstream-blocked with no published
  fix.
- Relevant quarantines: none added, widened, or removed by this change.
- Blockers: (1) `braces@3.0.3` is the latest published version and is itself in
  the advisory range `<=3.0.3` with no patched release; upstream fix PR
  `micromatch/braces#72` is open/unmerged and does not bump the package
  version. (2) `node-forge@1.4.0` remains the latest release and is itself in
  the advisory range `<=1.4.0` with no patched release; upstream PR
  `digitalbazaar/forge#1152` is open/unmerged. (3) Every production path to
  `braces` is framework build/test tooling (`tailwindcss` via `chokidar` and
  `micromatch`; Expo's `metro-file-map`; React Native's Jest stack) with no
  compatible parent release that removes the path.
- Condition required to unblock: any ONE of — a published `braces` release
  `>3.0.3` that satisfies `chokidar@~3.0.2` and `micromatch@^3.0.3` (expected
  after upstream PR #72 merges and releases), or an npm-published replacement/
  drop-in with reviewed provenance; additionally for full green CI, a published
  `node-forge` `>1.4.0` satisfying both `@expo/cli` (`^1.3.3`) and
  `@expo/code-signing-certificates` (`^1.4.0`) ranges (or a supported parent
  release removing both forge paths).
- Exact resume action after unblock: on pinned Node `v22.23.2` / npm `10.9.8`:
  `git fetch --all --prune`, confirm `main` fast-forward status, re-query
  `npm view braces version` / the GitHub advisory API / `npm view micromatch
dependencies.braces` / `npm view chokidar@3 version`, then if a safe target
  exists `npm install --package-lock-only` (or the minimal `overrides` edit) and
  `npm ci`; verify `npm ls braces --all` shows no vulnerable copy and
  `node scripts/audit-runtime-deps.mjs` no longer reports `braces`; run
  `npm run typecheck`, `npm run lint`, `npm run openspec:validate`,
  `npm run agent:plan:validate:all`, `npm test`, both security suites
  (`npx vitest run tests/auditRuntimeDeps.test.ts
tests/nodeForgeSecurityGuards.test.ts`), plus any new braces guard, and the
  impact-appropriate QA (`npm run qa:fast`, escalating to `npm run qa:full` and
  build-tool validation if resolution/bundling changes); then follow the
  publication rules with exact-head green CI. Resume commands are recorded in
  `final-report.md` §L.
- Exact next action: **hold.** No Windows-executable work remains. Resume only
  from the unblock condition above, using the exact commands in
  `final-report.md` §L.
- Remaining definition of done: the two conditional tasks in `tasks.md` §8
  (8.1 land a safe remediation, 8.2 dependency-mutation validation) remain
  unchecked because no safe remediation exists; every other task is checked
  with evidence. The change stays unarchived while the upstream condition is
  unmet.

## Progress

- [x] 1. Preflight, state preservation, pinned toolchain, live red reproduction, exact-head CI recording
- [x] 2. Complete `braces` dependency graph ledger (copies, parents, ranges, dev flags, production consumers)
- [x] 3. Advisory truth (GitHub + npm registry) and the derived `range: *` distinction
- [x] 4. Shipped-artifact exclusion (web/android source maps, byte scans, APK, edge sources) and tooling input provenance
- [x] 5. Full remediation ladder with evidence and rejection reasons
- [x] 6. Bounded `node-forge` refresh — `NO MATERIAL UPSTREAM CHANGE`
- [x] 7. Records, dual-blocker resume matrix, validation, owned-path commit
- [ ] 8. Conditional safe remediation and dependency-mutation validation — blocked upstream (not earned)

## Surprises & Discoveries

- `braces` is not reachable only through Tailwind: the single copy is required
  by `chokidar@3.6.0` **and** `micromatch@4.0.8`, and `micromatch` is
  production-reachable through Expo's `metro-file-map` and React Native's Jest
  stack as well as Tailwind. npm's suggested `tailwindcss@4.3.3` fix therefore
  cannot clear the finding even setting aside its NativeWind incompatibility.
- The `range: *` in the audit output is npm's derived finding-level
  `simpleRange` over tree versions, not the advisory range; the individual
  advisory range is `<=3.0.3` in both `via[0].range` and the registry advisory
  metadata. No gate defect — the gate does not match on range.
- Upstream fix PR #72 does not modify `package.json`, so even a git-ref
  override would install code claiming `3.0.3` and the advisory would keep
  matching; the override is rejected on both provenance and effectiveness
  grounds.
- The retained hermetic export bundle filename matches the current `dist`
  bundle identity while bytes differ because ambient `.env` Supabase values are
  inlined by plain `build:web`; the retained map evidence remains valid because
  no application or bundling source changed between the export commit and HEAD.
- All `braces` byte hits in shipped outputs are unrelated strings (React error
  copy; MaterialCommunityIcons glyph names) and the one `tailwindcss` hit is
  the generated-CSS license banner inside map `sourcesContent`.

## Decision Log

1. **No remediation landed; no dependency or policy edit.** The ladder is
   exhausted: no patched release, no compatible parent update, no safe
   override target, no removable path, and no proportionate family upgrade that
   would remove every production path. Recording a wildcard or blanket
   exception was rejected; the gate stays red and truthful.
2. **The audit engine is untouched.** `range: *` is producer semantics, not a
   gate defect, and the gate's decision does not use range. No red-capable
   test seam required a fix.
3. **A separate OpenSpec change.** The `braces` blocker is recorded in
   `resolve-braces-security-blocker` rather than reopening the completed
   `node-forge` change, so the two blockers stay clearly distinguished.
4. **PR #72 and forge PR #1152 are upstream conditions, not remediation
   inputs.** Unreleased, unmerged code is not vendored; patched files would not
   move `npm audit` anyway.
5. **No framework migration.** Tailwind 4 is both breaking (NativeWind 4 peers
   `tailwindcss ~3`; only `nativewind@5.0.0-rc.0` supports it) and
   insufficient (Metro/Jest `micromatch` paths persist), so it is
   disproportionate and ineffective.
6. **Evidence reused only with source-identity proof.** The retained hermetic
   exports predate HEAD, so the triage proved no application/bundling source
   changed between the export commit and HEAD before reusing the module-graph
   results.

## Validation Ledger

- `node scripts/audit-runtime-deps.mjs` (pinned toolchain) — exit 1; exactly
  two undocumented highs (`braces`, `node-forge`) and three documented
  `brace-expansion` entries; unchanged by this change. Evidence:
  `simulation-output/security-braces-triage/audit-gate.log` (2026-10-03).
- `npm audit --json`, `npm audit --omit=dev --json` — exit 1; production and
  full reports retained. Evidence: `npm-audit-prod.json`,
  `npm-audit-full.json` (2026-10-03).
- `npm ls braces --all`, `npm explain braces` (pinned toolchain) — one copy,
  two direct parents, listed production consumers. Evidence:
  `braces-path-ledger.json`, `npm-ls-braces.txt`, `npm-explain-braces-top.txt`.
- Source-map module-graph analyses — web: 3 maps / 1992 sources / 0 module
  hits; Android: 1 map / 2342 sources / 0 module hits. Evidence:
  `export-web-braces-analysis.json`, `export-android-braces-analysis.json`.
- Whole-output byte scans (`scanDirectoryForNeedle` over `dist/`, `dist-sync/`)
  and APK archive scan — zero package hits; all `braces` hits classified.
  Evidence: `apk-braces-scan.json`, run output in `final-report.md` §D.
- Registry/advisory capture — `registry-state.json` (2026-10-03, Node
  `v22.23.2` / npm `10.9.8`).
- `npm run openspec:validate` — passes all items including this change
  (recorded in `final-report.md` §H).
- `npm run agent:plan:validate:all` — passes, including this BLOCKED plan
  (recorded in `final-report.md` §H).
- No dependency mutation validation was run because no dependency changed;
  `git diff --stat` for `package.json`, `package-lock.json`,
  `scripts/audit-runtime-deps.mjs` is empty.

## Changed Files / Areas

- `openspec/changes/resolve-braces-security-blocker/**` — the triage record,
  spec delta, task list, this plan, and the final report. This is the only
  committed change.
- `simulation-output/security-braces-triage/**` — gitignored raw evidence
  (audit reports, graph ledger, registry state, module-graph analyses, APK
  scan, tooling call-sites, CI run JSON).
- Explicitly unchanged: `package.json`, `package-lock.json`,
  `scripts/audit-runtime-deps.mjs`, `tests/**`, `app/ features/ core/ lib/`,
  `.github/workflows/**`.

## Recovery / Resume Instructions

1. Reread `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. Run `npm run agent:resume -- --plan openspec/changes/resolve-braces-security-blocker/execplan.md`
   and inspect Git discrepancies.
3. Re-verify the unblock condition from `final-report.md` §L (published
   `braces > 3.0.3`, or a supported parent/toolchain change removing all
   production paths; for full green CI also a patched `node-forge > 1.4.0` or
   supported parent fix).
4. Resume only from **Exact resume action after unblock** above / §L commands.
5. Keep the audit gate red and unmodified until a real fix exists. Never run
   `npm audit fix --force`, never add a wildcard allowlist entry, never edit
   `node_modules`.

## Outcomes & Retrospective

The triage reached its truthful terminal state: **no safe `braces` remediation
exists today**, so no dependency or policy change was made, the audit gate
stays fail-closed and red on two real undocumented highs, and the change
records a complete evidence chain with an exact resume matrix. The `node-forge`
refresh found no material upstream change and deliberately did not reopen the
prior campaign. What remains is purely upstream release availability; the
conditional tasks in `tasks.md` §8 stay unchecked by design. The campaign
deliberately avoided a framework migration, an allowlist entry, and any forced
fix. Overall project certification is unchanged and remains **NOT CERTIFIED**.
