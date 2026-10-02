# Exploration: Windows dependency-security follow-up

Explored **before** proposing, 2026-10-02. This records observations and limits,
not an executed repair. The complete input is preserved in [source-brief.txt](source-brief.txt)
(SHA-256 `0bf3df7b16a78e205d56913c1caca9c60bc9680e31da550ae7ff869d3cba4df4`).
The filename was reused after an older Windows campaign; that older brief and
its `2bdfd5f1...` hash are not this task's requirements.

## 1. Verified starting reality

After `git fetch origin`, `main`, `origin/main`, and HEAD all resolve to
`891ed228ffc39f002ac13cc62aad2ee0b69ef1fe`. There is one worktree, no tracked
or staged diff, one preserved stash `pre-recovery-local-changes` at
`c35e281d740df1e367c1be0f38383237ca080239`, and eight foreign untracked roots:
the iOS extract and seven earlier change directories. Their preservation
baseline contains 125 files/links. Planning uses
`docs/windows-dependency-security-proposal` without creating a commit.

CI [36965502815](https://github.com/quantdale/super-habits/actions/runs/36965502815)
is the latest observed main run and matches that exact SHA. Every preceding
quality step passed, including install, typecheck, Deno, lint, theme/OpenSpec/
plan/parity checks and combined tests. The runtime-dependency audit failed;
quality failed, E2E skipped because quality failed, nightly skipped. None is
reinterpreted as a current green run.

Ambient tools are Node 24.3.0/npm 11.4.2. All local investigation gates used
Node **22.23.2**, npm **10.9.8**, by prepending
`/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64` to PATH.

## 2. Tight reproducer and dependency graph

`node scripts/audit-runtime-deps.mjs` reproduced exit 1:

```text
[UNDOCUMENTED] high node-forge GHSA-86w9-cpqp-85rv [node_modules/node-forge]
node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements
range: *
1 undocumented high/critical advisory(ies) in the production tree.
```

Both `npm audit --json` and `npm audit --omit=dev --json` report the same forge
finding. The production report has 12 high/11 moderate/0 critical package
entries, the full report 17 high/13 moderate/0 critical; these include propagated
parent entries and are **not** counts of distinct exploitable advisories.
Existing exact-path brace-expansion entries remain printed/documented. No new
exception was added.

`npm ls node-forge --all`, `npm explain node-forge`, installed package manifests,
and semantic `package-lock.json` inspection agree:

```text
superhabits (production dependency)
└─ expo@55.0.31
   └─ @expo/cli@55.0.36
      ├─ node-forge@1.4.0                    required ^1.3.3
      └─ @expo/code-signing-certificates@0.0.6
         └─ node-forge@1.4.0 (deduplicated)  required ^1.3.3
```

There are two dependency parent paths and **one physical installed/locked copy**,
`node_modules/node-forge`; its lock entry has no `dev: true`. Peer-related
explanations do not introduce another forge instance. npm includes CLI tooling
because Expo is a production dependency, not because it inspected app bundles.
This is not installed-versus-lock drift.

## 3. Current advisory and upstream options

The GitHub advisory API, fetched directly, reports:

- [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv),
  CVE-2026-85393, HIGH, CWE-347, CVSS v3 7.5.
- Vulnerable range `<= 1.4.0`; `first_patched_version: null`.
- Reviewed/updated 2026-10-01; this is an incomplete fix for CVE-2026-33894.
- npm's grouped range is `*`, while its individual advisory range is `<=1.4.0`.
  Do not confuse those fields or infer that a future release is already safe.

Registry observations:

| Option                         | Observation                                                                                                                           | Planning disposition                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Compatible forge bump/override | `latest` is 1.4.0, already installed                                                                                                  | No published fixed version observed; overriding to 1.4.0 cannot fix this advisory.             |
| Stable Expo/CLI 55 update      | Expo 55 stops at 55.0.31; CLI 55 stops at 55.0.36; all queried CLI 55 releases require forge `^1.3.3`                                 | No same-family published parent fix observed.                                                  |
| Certificate-helper update      | Latest 0.0.7 requires forge `^1.4.0`                                                                                                  | Does not remove the vulnerable range; changing 0.0.x also needs explicit compatibility proof.  |
| Framework family upgrade       | Latest CLI 57.0.27 still requires forge `^1.3.3` and helper `^0.0.6`                                                                  | A framework migration is neither justified nor a demonstrated fix.                             |
| npm suggested fix              | `expo@44.0.6`, `isSemVerMajor: true`                                                                                                  | Breaking downgrade, not accepted; never run `npm audit fix --force`.                           |
| Remove dependency              | Expo runtime and its CLI support the product/build system                                                                             | No proof that removing either complete path preserves functionality.                           |
| Upstream source patch          | [forge PR 1152](https://github.com/digitalbazaar/forge/pull/1152), open and unmerged, head `ceba34402e329f0365134f23fe19898756527d65` | Research lead, not a reviewed/published compatible repair or permission to silently vendor it. |
| Narrow exception               | Tooling calls the affected API                                                                                                        | The brief's affected-API-unused condition fails; an exception is not eligible.                 |

PR 1152 adds a nested sequence element-count check and a nested-garbage test.
Its proposed changelog mentions 1.4.1; **that is not a published release**.
A future apply must re-query these observations rather than freezing an
unavailable version into `package.json` now.

## 4. Exposure: metadata versus execution

Source evidence establishes a distinction, not a blanket "safe" label:

- `node_modules/expo/package.json` separates runtime `src/Expo.ts` from
  executable `bin/cli`; the latter loads `@expo/cli`.
- No forge import/use was found in `app/`, `features/`, `core/`, `lib/`, or
  `supabase/`. Supabase function entrypoints import local JS helpers, not forge.
  No production deployment was inspected or changed.
- CLI `build/src/run/ios/codeSigning/Security.js` imports forge to parse PEM
  certificates. This source read is not an iOS run or certification action.
- CLI `build/src/utils/codesigning.js` imports the certificate helper.
  `getProjectPrivateKeyAndCertificateFromFilePathsAsync` calls
  `validateSelfSignedCertificate`; `signManifestString` calls
  `signBufferRSASHA256AndVerify`. Expo Go development-manifest middleware
  invokes the code-signing helpers conditionally.
- Helper `build/main.js` calls `certificate.verify(certificate)` at line 176,
  `certificate.publicKey.verify(...)` at line 203, and `csr.verify(csr)` at
  line 246. Forge `lib/x509.js:734` delegates to `publicKey.verify`.
- Forge `lib/rsa.js:1142` defaults to RSASSA-PKCS1-v1_5; at 1171–1182 it
  validates the outer DigestInfo count but not the nested DigestAlgorithm count.
  This matches the new advisory, rather than the already-fixed outer-sequence bug.

**Classification now:** real `DEPENDENCY_VULNERABILITY`, npm-production-transitive,
with affected-API reachability in build/development tooling and
`NO_PATCH_AVAILABLE` in the observed registry. Shipped app/runtime exposure is
**not yet conclusively proven absent**. Whether ordinary configuration reaches
an exploitable input/low-exponent key needs configuration/call-path evidence;
no practical attack against this app or its signing material was attempted.
Even definitive shipped absence would not make the affected tooling API unused.

## 5. Artifact investigation and honest gaps

Existing helpers were reused, not replaced with a package-name-only grep:

- `scanDirectoryForNeedle` from `scripts/hermetic-build.mjs` scans all file bytes.
  Historical `dist/` (index mtime 2026-10-01T15:52:56.824Z) and `dist-sync/`
  (2026-10-01T02:12:04.091Z) contain no `node-forge`,
  `DigestInfo.DigestAlgorithm`, `DigestInfo value.`, or
  `Encryption block is invalid.` signatures. These are supplementary scans,
  not source-bound module graphs or proof of absence after minification.
- APK scanning reused ZIP inflation and read every candidate entry via
  `scripts/native-apk-scan.mjs`, including `assets/index.android.bundle`.
  The same signatures were absent. The on-disk APK hash is
  `f3d9a63c39589fca3bd91bddfcc1c6ab0ad43a2adede50e2f3a502b143d961c5`;
  it does **not** match the retained green build record's `E6E55ED5...` hash.
  No qualification/source identity is transferred to this unmatched binary.
- A fresh hermetic web export with source maps was attempted through
  `runHermeticBuild`, `--max-workers 1`, and task-owned ignored output.
  It hit the 600-second command deadline while bundling; no complete output
  or module graph was obtained. The sequential Android JS export was not reached.
- Resource probe then observed 455 MB free/32488 MB RAM and 100% CPU; largest
  unrelated consumers included vmmemWSL and memory compression. No unrelated
  process was killed; no remaining owned export root was found. This is
  `ENVIRONMENT` evidence for an incomplete exploratory build, not security
  exoneration, a product fix, or an altered test timeout.

Future apply must finish source-bound web/native module-graph inspection and
artifact scans if relevant. No new APK/device/iOS/production-server result exists.

## 6. Narrow audit-policy defect discovered

The current gate has an independent fail-open boundary: `runAudit()` accepts
parseable npm error JSON, and defaults empty stdout to `{}`. `findings()` then
finds no advisories and exits 0. This does **not** explain the live forge red
(the live report is valid), and repairing it cannot make forge green.

A disposable VM execution of the **unchanged actual CLI source**, replacing
only its `node:child_process` import with a synthetic command result, proved:

| Command-result fixture                  | npm status | Current gate exit   |
| --------------------------------------- | ---------- | ------------------- |
| Valid empty audit v2 report             | 0          | 0 (expected)        |
| Undocumented forge high                 | 1          | 1 (expected)        |
| `{ error: { code: 'EAI_AGAIN', ... } }` | 1          | **0 (false green)** |
| Empty stdout from failed command        | 1          | **0 (false green)** |
| Malformed JSON                          | 1          | 1 (expected)        |

Classify as `AUDIT_POLICY_BUG`, preserve the fixture result in
`audit-cli-fixtures.json`, and propose the smallest fail-closed parser/runner
repair with behavioral tests. Existing `tests/auditRuntimeDeps.test.ts` only
asserts script text and an override; it does not exercise these error paths.
A new semantic seam must prove red/green behavior, not merely check another
string. npm exit 1 with a valid vulnerability report is legitimate and must
not be confused with a transport/invalid-report failure.

## 7. Conclusion and proposal boundary

The evidence supports a bounded security successor, not another broad feature
campaign. The implementation decision tree is: reverify current upstream ->
prove a compatible fix/removal for both paths -> regress and validate ->
fast-forward publish -> exact-final-head quality/audit/E2E -> reconcile records.
If no safe repair exists, retain the red gate and produce a precise upstream
blocker, not a fake exemption. The independent fail-open parser defect belongs
in this same narrow audit boundary.

Overall remains **NOT CERTIFIED**. Retained Android green, J8 622/800 with the
878 ms history/800 ms ceiling/15% floor, prior full-QA chronology, owner-deferred
iOS, credential-dependent production catalog, proven-absent recovery inventory,
stopped DDL, gap-21 fail-closed behavior and canonical 17/22 ledger are not
reopened or promoted by this investigation. No Supabase project was accessed.

Raw logs/JSON and preservation manifest are under
`simulation-output/security-explore-2026-10-02/`. The proposal preserves all
brief sections through design traceability and leaves every apply task unchecked.
