## Why

`main` fails exact-head CI (`quality`, run `37136146011` at `8255546`) at the
`Audit runtime dependencies` step because the production dependency audit
reports two undocumented high advisories. One is the retained `node-forge`
blocker `GHSA-86w9-cpqp-85rv` (previously triaged to `PRECISELY BLOCKED`). The
other is the newer `braces` advisory `GHSA-vfj7-8cjw-p6xm` (HIGH, CVE-2026-93687,
published 2026-09-18), which the prior campaign recorded only as an observation
while its own scope was `node-forge`. This change performs the exhaustive
`braces` triage the previous campaign deferred: whether a safe non-breaking
remediation exists, what the real production exposure and tooling reachability
are, and what the exact legitimate terminal state is.

Local reproduction on the pinned toolchain (Node v22.23.2 / npm 10.9.8):
`node scripts/audit-runtime-deps.mjs` exits 1 with exactly two undocumented
highs — `braces GHSA-vfj7-8cjw-p6xm [node_modules/braces]` and `node-forge
GHSA-86w9-cpqp-85rv [node_modules/node-forge]` — plus the three dated
documented `brace-expansion` entries.

## What Changes

- Reproduce and retain the live red, the full and production-only `npm audit`
  reports, and the exact gate output.
- Trace the complete `braces` graph: installed copies, direct parents, required
  ranges, dev/production status, and every production consumer of the hoisted
  `micromatch` copy, as a machine-verifiable ledger.
- Establish advisory truth from the authoritative sources (GitHub advisory API
  and the npm registry advisory endpoint) and distinguish the advisory's
  published affected range from npm's derived finding-level `range` field.
- Prove shipped-artifact exclusion with the existing hermetic scanners:
  source-map module identities for the web and Android exports plus whole-output
  byte corroboration, an APK scan (supplementary, provenance-limited), and
  edge-function source inspection; classify every byte-level hit.
- Characterize tooling reachability and input provenance for every
  `braces`/`micromatch`/`chokidar` call site.
- Evaluate the full remediation ladder in order — patched release, compatible
  parent update, npm override, path removal, smallest family upgrade, major
  tooling upgrade — with machine-verifiable evidence and explicit rejection
  reasons.
- Refresh the retained `node-forge` upstream state only for material change;
  do not reopen the prior campaign's exposure analysis.
- Land the smallest safe repair if one genuinely exists. If none exists, make
  no dependency or policy change, keep the audit gate truthfully red, and
  record the precise upstream-blocked state, the exact unblock condition, and
  the resume matrix.
- Record the triage in this change's artifacts and an ExecPlan. Do **not**
  modify `DOCUMENTED_BUILD_TIME_ADVISORIES` merely to suppress the red, do not
  run `npm audit fix --force`, and do not perform a Tailwind/Expo/React Native
  major migration.

## Capabilities

### New Capabilities

- `braces-security-triage`: A bounded, machine-verifiable triage contract for a
  transitive vulnerable package with no published fix: complete path ledger,
  authoritative advisory truth, source-bound shipped-artifact exclusion,
  tooling input provenance, an exhaustive remediation ladder, and a precise
  upstream-blocked terminal state with exact resume conditions.

### Modified Capabilities

None. `dependency-security-closure` (the retained `node-forge` change) stays
untouched; this change records the `braces` blocker separately so the two
blockers cannot be conflated.

## Impact

Evidence and OpenSpec/ExecPlan records only. `package.json`,
`package-lock.json`, `scripts/audit-runtime-deps.mjs`, tests, application
source, and CI workflows are unchanged. The dependency audit stays red by
design while a real undocumented high advisory remains, so exact-head CI
`quality` remains failing and `e2e` remains skipped until an upstream release
legitimately removes the finding. No Supabase, production, native, or release
action is taken. Overall certification stays **NOT CERTIFIED**.
