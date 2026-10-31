# Correction Campaign B — security and governance review

Observed **2026-10-23 UTC**. Repository `quantdale/super-habits`; inspected base
`02d43088e10170d03f9db44c887227a9705f8dff`, branch `campaign/b4-security`.
This is isolated engineering/read-only qualification, **not production approval**.
Parent owns the campaign ExecPlan. No competing plan was created.

## Verdict and boundaries

**DEPENDENCY SECURITY BLOCKED; GOVERNANCE PROPOSALS ONLY; CONNECTED VERCEL
VERIFICATION BLOCKED_EXTERNAL. Production remains NOT AUTHORIZED.**

No dependency/lockfile/shared `node_modules` edits, installs, waivers, allowlist
entries, workflow/protection changes, pushes, PRs, merges, deployments, signing
issuance, native identity changes, releases, production SQL or data deletion.
The audit gate and empty allowlist remain byte-unchanged. Existing historical
production Vercel deployments are real: zero GitHub deployment records or a
commit title saying “zero production deployments” cannot disprove that history.

## Late-campaign advisory refresh — 2026-10-23 23:00 UTC

The sections below preserve the worker's earlier observation (approximately
08:40 UTC); they are not the final advisory snapshot. Parent reran the unchanged
audit after resuming the campaign. GitHub now reports braces
GHSA-vfj7-8cjw-p6xm **withdrawn at 2026-10-23T12:53:02Z** (updated12:53:05Z).
The installed braces version is still3.0.3; this is upstream withdrawal, **not
a dependency repair performed by this campaign**.

The final production audit exits1 on **node-forge GHSA-86w9-cpqp-85rv** and
**Zod GHSA-mrhx-c7xc-m3w5** (oversized constrained collection validation can
exhaust memory; advisory updated18:26:52Z). Published affected Zod range is
`<4.6.6`, first patched4.6.6; current registry latest is4.6.7. The lock has
production `zod@3.25.76` required by `@expo/cli` (`^3.25.76`), and a separate
dev-only OpenSpec copy4.4.3. Moving Expo's3.x dependency to4.6.6+ is a major
API/range change, **not a proven safe transitive patch**. No cross-major override
or allowlist entry was applied to manufacture green. Assess Expo's actual
collection-validation input paths and obtain a compatible upstream3.x fix or a
separately qualified parent upgrade; unreviewed parser patches are not remediation.

Decision request CB-SEC-2026-10-23 must therefore be reevaluated against this new
Zod finding before any owner decision. The older 35-package raw inventory below
is historical, not a claim about the final audit's package count. Production
remains blocked, the allowlist and audit implementation remain unchanged, and
source integration would not accept this residual security risk. Final ledger:
`/tmp/campaign-b-final-audit.log`; primary API GETs and exact installed versions
were rechecked directly by the parent.

## 1. Earlier primary advisory and dependency evidence

Live GitHub advisory GETs and the npm registry-backed production audit agree:

| Advisory                        | Installed / latest | Primary affected range | Patched version | Risk                                                                                                                              |
| ------------------------------- | ------------------ | ---------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-vfj7-8cjw-p6xm, braces     | 3.0.3 / 3.0.3      | <=3.0.3                | null            | HIGH: deeply nested patterns exhaust recursive AST walkers and terminate a Node process                                           |
| GHSA-86w9-cpqp-85rv, node-forge | 1.4.0 / 1.4.0      | <=1.4.0                | null            | HIGH: malformed nested DigestAlgorithm elements accepted in RSA PKCS#1 v1.5 verification; low-exponent signature-forgery exposure |

GitHub advisory last-updated timestamps are respectively
`2026-10-02T22:36:34Z` and `2026-10-01T21:09:10Z`; these are provider metadata,
not the date of this fresh retrieval. Neither advisory is withdrawn.
`node scripts/audit-runtime-deps.mjs` exits **1**, identifying **2 direct
undocumented high advisories**. Raw `npm audit --omit=dev --json
--audit-level=info --offline=false` exits **1**, with **35 vulnerable package
entries: 25 high, 10 moderate, 0 critical**. The larger number includes
meta-vulnerable parents; it is not 25 separate direct high advisories.
Finding-level wildcard `range: *` is npm aggregation; the primary advisory
ranges above remain the precise published ranges.

### Presence versus reachability

The lock contains one non-dev copy of each affected package. Complete immediate
parent/range accounting is in `lock-reachability.json`; representative paths:

- `tailwindcss@3.4.19 → chokidar@3.6.0 (~3.0.2) → braces@3.0.3`;
  `tailwindcss → micromatch@4.0.8 (^3.0.3) → braces`.
- Micromatch also has production consumers `fast-glob`, `metro-file-map`,
  `@jest/transform`, `jest-haste-map`, and `jest-message-util`. Upgrading only
  Tailwind/chokidar cannot remove those paths.
- `expo@55.0.31 → @expo/cli@55.0.36 (^1.3.3) → node-forge@1.4.0`;
  the CLI also uses `@expo/code-signing-certificates@0.0.6 → node-forge ^1.3.3`.
  The root dev dependency is an additional consumer, not grounds to classify
  the shared production copy as dev-only.

`npm explain braces node-forge` is preserved but **not authoritative here**:
this worktree's `node_modules` junction makes it label braces extraneous and
forge dev. Classification above derives from this checkout's actual lock and
its production audit, not the junction's misleading installed-tree rendering.

A fresh literal-import scan of **415** JS/TS source files in `app`, `core`,
`features`, `lib`, and `supabase/functions` finds **0** direct imports of braces,
micromatch, chokidar or node-forge. This is source-level evidence, not a new
artifact proof. No exact-head web/native artifact was built or scanned here;
prior campaign bundle-absence evidence is historical, not transferred to this
commit. Bundled/vendored parser copies are outside npm's dependency accounting;
this inspection does not certify their absence.

Inspected tooling entry points demonstrate real exposure: `fast-glob` calls
`micromatch.braces`, micromatch's parse/brace APIs enter braces, and chokidar
expands brace-bearing watch paths. Repository/configuration globs are the
observed pattern inputs; arbitrary app-entered patterns reaching these APIs
were not found. Package presence through Metro/Jest does not alone prove those
consumers execute the vulnerable walkers. Expo's code-signing certificate
module imports forge and invokes certificate/public-key verification. That is a
tooling trust boundary, not proof that an attacker supplied a production key
or forged a deployed artifact. Existing synthetic forge tripwire tests pass
while explicitly demonstrating acceptance of the malformed shape; their green
result **documents the vulnerability, not its remediation**.

### Minimal remediation assessment

No published compatible patched package is available. Current registry leads:
`micromatch@4.0.8` still requires braces `^3.0.3`; chokidar latest 6.0.0 removes
its own braces dependency but is not a compatible 3.x substitution and cannot
remove micromatch's path. Expo SDK-55 CLI candidate 55.0.37 still requires forge
`^1.3.3`; latest CLI 58.1.14 and code-signing-certificates 0.0.7 require vulnerable
forge `^1.4.0`. Upgrading Expo wholesale is neither minimal nor proven sufficient.

Upstream braces PR `micromatch/braces#72` is now **closed, unmerged**, updated
2026-10-13, head `28d440b5dd449dbf1fe6f3506cf94ecca4d02660` (a change from the
older open-PR record). Forge `digitalbazaar/forge#1152` remains **open,
unmerged**, head `ceba34402e329f0365134f23fe19898756527d65`. These unpublished
patch leads are not qualified repairs. A local fork/patch would require
separate parent ownership, provenance review, parser/crypto regression tests,
all-copy coverage and an explicit policy decision: leaving the known version
number in place does not clear the unchanged advisory gate. No such scope or
exception is adopted here.

**Smallest next safe repair:** when a verified compatible patched 3.x braces
or forge release appears, parent owns the minimal manifest/lock update in an
isolated dependency checkout, validates every production path, and reruns the
unchanged gate. No safe published patch was found to hand over now. Never use
`npm audit fix --force`, a git-ref override to an unreviewed patch, or dependency
relocation to manufacture green.

## 2. Exact open Snyk PR inspection — do not merge

All three were open at retrieval. Read metadata, the complete diff, and the
actual base/head package and lock contents through GitHub's contents API;
PR titles and truncated files API patches were not treated as the diff.

| PR / exact inspected head                      | Actual manifest change                         | Lock diff size      | Finding                                                                       |
| ---------------------------------------------- | ---------------------------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| #92 `7df6ba9dd293dc37380e751c6892a6b44fb27f80` | RN 0.83.10 → 0.87.0; Tailwind ^3.4.19 → ^4.0.0 | 2,063 changed lines | Both affected copies remain; broad incompatible upgrade, not a minimal repair |
| #81 `4ce1d4cc4270b792e1215cf14196585e55faafc6` | Same RN/Tailwind changes as #92                | 1,891 changed lines | Both affected copies remain; stale/conflicting base; not a minimal repair     |
| #57 `52f6c644db5dce5ec996af987394f6cdf2b10525` | RN 0.83.10 → 0.85.0                            | 1,031 changed lines | Both affected copies remain; stale/conflicting base; not a minimal repair     |

#92 base is this task's base; #81 base is `85599dfbf3cbe2077f04ae51bfe3c19b6c04bff3`;
#57 base is `b7c68854e626bbd9f06dfd9a2df3b322715d982f`.
All three head locks retain **braces 3.0.3 and forge 1.4.0**. All three have a
root lock RN spec beginning `^`, whereas their manifest uses an exact version;
this inconsistency is independently visible in the retrieved content, but no
clean install was attempted and an install failure is not claimed.

Installed Expo 55's supported bundled RN is **0.83.10**. Interop 0.2.3 requires
Tailwind **~3**. Thus the RN changes are outside this SDK's supported matrix,
and #92/#81 additionally violate the installed interop Tailwind peer. A proper
framework migration would require matched Expo/React/native-module changes and
fresh platform qualification; these PRs supply neither a compatible minimal
fix nor elimination of the named findings. No PR was merged or modified.

## 3. Governance gap and two inactive proposal choices

Fresh read-only protection inspection: ruleset **15001092 is disabled**;
classic main protection GET returns **404 Branch not protected**; effective
main rules GET returns **[]**. The disabled object's PR rule requires zero
approvals and no status checks. Its empty bypass list does not compensate for
its disabled enforcement.

See [governance choices](campaign-b-governance/README.md):

- **A:** inert proposed payload requiring PR + independent fresh review,
  resolved threads, up-to-date `quality` and `e2e` bound to Actions app 15368,
  no force/deletion, linear history, no bypass actors. Existing red quality
  blocks SOURCE integration too; this is not silently selected for Campaign B.
- **B:** later owner-approved implementation of separate engineering-quality
  source checks while retaining dependency audit as mandatory failing release
  security, production hold and independent owner approval. No such new check
  exists now; no fictional required-check payload is supplied. Every production
  route, including external Vercel integration/manual paths, must enforce the
  release gate before activation. This is not a waiver or current enforcement.

Parent explicitly directed presentation of both choices rather than a
contradictory quality-required source-integration claim. This worker neither
chooses governance on the owner's behalf nor changes administrator settings.

At inspected base, Actions run **39893146510** reports e2e success, quality
failure, nightly skipped. Parent verified the quality failure was audit-only.
The separately retrieved check-runs API also contains later run **39893838353**
with cancelled quality and skipped e2e/nightly. These runs are distinct;
ancestor/base checks are not qualification of this worker's forthcoming commit.

## 4. Vercel projects and unchanged hold

| Project                                                       | Connected read-only status                                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Canonical `prj_lv9lvnsEH1hLuiRNCFIRQCz16ZQr` (`super-habits`) | BLOCKED_EXTERNAL — no provider tool, Vercel CLI, exported Vercel token, or available standard local CLI auth file |
| Legacy `prj_RYrRGteH3w6pSYERrPDL27DJJAAd` (`superhabits`)     | Same blocker; not assumed retired or harmless                                                                     |

No connected provider request could be authenticated with this worker's allowed
tools. Do not confuse that with a provider 404 or proof of absence. Existing
reports describe both project integrations and historical production releases;
those historical observations were inspected but not requalified as live state.

Local `vercel.json` still contains `git.deploymentEnabled.main: false`, unchanged
from base. That is a source hold, not a security boundary against manual
production promotion or proof of either project's live dashboard configuration.
No preview or production deployment, alias operation, environment mutation, hook,
project relink or billing operation was performed.

**Owner/operator replay after read-only access is provided:** use Vercel GET
project metadata for each exact project ID (including the correct owning team),
GET its deployments filtered by project and target=production, GET production
aliases/domains and Git integration settings; inspect production branch,
deployment-enable state, latest production deployment's SHA/time/target, and
all automatic/manual promotion paths. Record only non-secret metadata. Compare
both integrations to the unchanged main hold; preserve real history. Do not
change a hold or deploy merely to test it. Provider auth restoration and any
administrator settings change need separate owner authority.

## 5. Signing, privacy/store and incident owner blockers

- **Signing/release:** `eas.json` production only sets autoIncrement; credential
  source remains implicit remote account state, submit.production is `{}`.
  E2E is credential-free/simulator where applicable. Android and iOS IDs remain
  `com.dale16.superhabits`, source version/build 1.0.0 / 1; actual remote-resolved
  build numbers require artifact evidence. The existing signing-posture report
  documents debug-signed local QA and unproven store artifacts. No new binary,
  credential inventory or production-signature verification was earned here.
  Owner must establish signing custody/source and provide exact-artifact
  certificate/hash/provenance under separate authority; no key was issued.
- **Privacy/legal:** privacy policy remains a draft with missing effective date,
  monitored support address, public policy URL, verified ownership/deletion
  procedure, and provider/retention approval. Automatic configured anonymous
  backup and enabled AI transmissions must be reflected in actual build-specific
  store declarations. No invented contact/address/legal answer or claim that
  publication is already complete.
- **Store:** submission package R01–R16 remains an owner action inventory:
  actual console agreements/app records, trader/age/health/data-safety answers,
  production-signed artifacts, real-build screenshots and explicit final release
  authorization. Static source, passing tests or Android QA do not certify
  store/iOS readiness. No tag, upload or store submission was made.
- **Incident:** inspected `external-blocker-closure/incident-residue.md` still
  requires exact-target owner deletion approval and fresh private revalidation.
  Its historical 135 confirmed-synthetic-record proposal and broader ambiguous
  cohorts are **not freshly queried counts**. No production row/owner IDs are
  copied into this public report. The historical recovery packet records absent
  public+auth recovery and incomplete migration authority; neither absence nor
  current catalog was rechecked here. A recoverable public+auth point, exact
  current targets/cascade review, credentials and separate explicit authority
  are prerequisites to any later incident cleanup/DDL. This campaign grants none.

## 6. Dated advisory owner decision request — NOT ACCEPTED / NOT A WAIVER

Record **CB-SEC-2026-10-23**, prepared 2026-10-23 UTC; status
**PENDING OWNER DECISION**. This record itself grants no acceptance or exception.
Request validity expires **2026-10-30T00:00:00Z**, or immediately on changed
advisory/patch/path/provider evidence, whichever is earlier. Expiry requires
fresh review; it never switches a gate to green.

- **Scope/risk:** the two exact advisories and production tool paths in §1;
  stack-exhaustion build/watch denial of service and forge verification
  integrity. Source import absence narrows observed runtime reachability, not
  the vulnerable production dependency graph. Other audit entries and all
  cloud/native/store prerequisites remain visible; no blanket risk acceptance.
- **Requested decision:** owner selects governance A, or separately authorizes
  design/implementation/review of B for SOURCE integration only. Engineering
  can remain isolated while that decision is pending. Production release is
  blocked under either choice until mandatory security and other prerequisites
  pass and explicit release authority is granted.
- **Authority:** repository owner/authorized governance administrator must make
  and record the choice; security/cloud reviewer independently reviews evidence.
  Parent coordinates any package/lock mutation and compatible patch qualification.
  Agent reports, bot PRs, disabled rules and green E2E are not decision authority.
  No owner signature/approval is fabricated here.
- **Replay:** refresh both GitHub advisory GETs, registry versions/parent ranges,
  upstream PR state, full lock path ledger and raw production audit; run the
  unchanged gate and crypto/audit guards. Resolve fresh source/release impact,
  recheck protections and both live Vercel projects, preserve failures, and
  bind any subsequent qualification to the actual candidate SHA.
- **Stop/expiry triggers:** new patch or changed advisory, added dependency path,
  untrusted tooling-input reachability, changed signing/remote build posture,
  missing/changed provider hold or production route, or request expiry. Stop
  and request parent ownership; do not auto-apply a patch, waiver or deployment.

## 7. Validation and evidence handoff

Evidence root **`.agent/evidence/campaign-b-security/`** is gitignored and
preserved locally, not committed derived evidence. The final external handoff
provides the actual commit SHA; this pre-commit report does not invent its own
future identity. No tests were added/modified for these documentation/proposal
changes.

Key replay commands and results:

| Command                                                                                                                                                                                                                                                                     | Result / evidence file                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gh api advisories/GHSA-vfj7-8cjw-p6xm` and `gh api advisories/GHSA-86w9-cpqp-85rv`                                                                                                                                                                                         | PASS retrieval; `braces-advisory.json`, `node-forge-advisory.json`                                                                                                                                                   |
| `node scripts/audit-runtime-deps.mjs`                                                                                                                                                                                                                                       | FAIL exit 1, expected genuine security blocker, not a pass; `audit-gate.log`                                                                                                                                         |
| `npm audit --omit=dev --json --audit-level=info --offline=false`                                                                                                                                                                                                            | Exit 1, 35 package entries as above; `npm-audit.json`                                                                                                                                                                |
| `npm explain braces node-forge`                                                                                                                                                                                                                                             | Exit 0; junction classification caveat above; `dependency-paths.log`                                                                                                                                                 |
| `gh api repos/quantdale/super-habits/pulls/<92,81,57>`; `/files --paginate`; same PR endpoint with `-H 'Accept: application/vnd.github.diff'`; `/contents/<package.json,package-lock.json>?ref=<exact-base-or-head>`                                                        | PASS; `pr-*.json`, `pr-*.diff`, `pr-*-exact-summary.json`                                                                                                                                                            |
| `npm view <spec> version dependencies peerDependencies dist-tags --json`                                                                                                                                                                                                    | PASS for braces, node-forge, chokidar@latest, micromatch@latest, @expo/cli@latest, @expo/code-signing-certificates@latest, expo@latest, nativewind@4.2.3, react-native-css-interop@0.2.3; `registry-candidates.json` |
| `npm view @expo/cli@sdk-55 version dependencies.node-forge --json`                                                                                                                                                                                                          | PASS retrieval, no forge removal; `expo55-cli-candidate.json`                                                                                                                                                        |
| GitHub GET ruleset/effective rules/classic protection/check-runs                                                                                                                                                                                                            | PASS inspection including expected protection 404; `ruleset-15001092.json`, `main-effective-rules.json`, `main-protection.json`, `base-check-runs.json`                                                              |
| `npm run qa:affected -- --files docs/reports/campaign-b-security.md docs/reports/campaign-b-governance/strict-main-ruleset.proposed.json docs/reports/campaign-b-governance/README.md`                                                                                      | PASS; documentation rule → qa:fast, no broad regression; `qa-affected.log`                                                                                                                                           |
| `npm run typecheck`                                                                                                                                                                                                                                                         | PASS exit 0; `typecheck.log`                                                                                                                                                                                         |
| `npm run lint`                                                                                                                                                                                                                                                              | NOT EARNED: enclosing command timed out at 180s; no terminal lint result; `lint.log`                                                                                                                                 |
| `npm test -- --no-cache --maxWorkers=2`                                                                                                                                                                                                                                     | NOT EARNED: tool timeout at 240s before terminal suite summary; `vitest-all.log`; no full-suite pass claimed                                                                                                         |
| `node node_modules/vitest/vitest.mjs run --no-cache --maxWorkers=2 tests/auditRuntimeDeps.test.ts tests/nodeForgeSecurityGuards.test.ts tests/releaseBuildPosture.test.ts tests/privacy-hosting.test.ts tests/store-declaration-drift.test.ts tests/agent-execplan.test.ts` | PASS **124 tests / 6 files**, 20.55s; `focused-tests.log`                                                                                                                                                            |
| `node scripts/journey-label-parity.mjs`; `node scripts/quarantine-register-parity.mjs`; `node scripts/release-profile-guard.mjs`; `node scripts/cloud-native-isolation.mjs`                                                                                                 | Each PASS exit 0; `qa-fast-guards.log`                                                                                                                                                                               |
| `npm run web:hygiene`                                                                                                                                                                                                                                                       | PASS, ports 8081/8082 free; `web-hygiene.log`                                                                                                                                                                        |

Vitest caching is disabled to avoid writes into the shared dependency junction.
The qa:fast aggregate is **not claimed passed**: typecheck, focused tests and
individual guards passed, but full lint/unit result was not earned within the
bounded attempts. Initial Git Bash leading-slash advisory endpoint failures
and an incorrect tooling inspection filename are retained in
`initial-command-failures.log`; corrected read-only requests succeeded.

No build/E2E/native/deployment was required for inert documentation/proposals;
none is claimed. Vercel connected inspection remains NOT RUN / BLOCKED_EXTERNAL,
not a successful check. Security/cloud reviewer must review this report and the
inactive proposals before any later owner decision. Exact final formatting,
proposal assertions, whitespace check and commit receipt are in the external
handoff/evidence ledger.

**Next action:** parent hands the commit and preserved evidence to the
security/cloud reviewer, obtains the A/B governance decision and read-only
Vercel access, and keeps production blocked. Request parent dependency ownership
only when a safe patch/removal candidate is actually established.
