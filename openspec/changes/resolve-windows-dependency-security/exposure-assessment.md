# Path/exposure assessment — resolve-windows-dependency-security (apply)

Captured 2026-10-02 on the pinned toolchain (Node v22.23.2 / npm 10.9.8) at
`main == origin/main == HEAD == 891ed228ffc39f002ac13cc62aad2ee0b69ef1fe`.
Raw evidence: `simulation-output/security-apply-2026-10-02/` (ignored). This
file is task 2.7's deliverable; the ranked remediation options are in
[options-ledger.md](options-ledger.md).

## 1. Dependency paths (task 2.2)

One physical installed/locked copy, two parent paths:

```text
superhabits (root production dependency)
└─ expo@55.0.31                       [production]
   └─ @expo/cli@55.0.36               [production, not dev-marked in lockfile]
      ├─ node-forge@^1.3.3 ──────────► node_modules/node-forge@1.4.0
      └─ @expo/code-signing-certificates@0.0.6
         └─ node-forge@^1.3.3 ───────► node_modules/node-forge@1.4.0 (deduped)
```

- Lock entry `node_modules/node-forge` (version 1.4.0,
  `registry.npmjs.org/node-forge/-/node-forge-1.4.0.tgz`) carries **no
  `dev: true`** marker → npm classifies it production-reachable.
- Semantic lock traversal found exactly two requiring parents
  (`node_modules/@expo/cli`, `node_modules/@expo/code-signing-certificates`),
  both range `^1.3.3`, both production. Installed manifests agree
  (CLI 55.0.36, helper 0.0.6). No nested/extra copy exists; peer-related
  explanations introduce no additional forge instance.
- npm includes this tooling in the production tree because `expo` is a root
  **production** dependency. That is dependency metadata, **not** proof that
  forge ships in any app bundle (see §2).

## 2. Shipped-artifact reachability (tasks 2.5, 2.6)

Source-bound exports of the current exact source, hermetic envelope
(EXPO_NO_DOTENV=1, all ambient `EXPO_PUBLIC_*` stripped/none present),
`--source-maps external`, one export per platform, task-owned output:

| Export                | Map sections                          | Module sources | `node-forge` modules | `code-signing-certificates` modules | Only `@expo/cli` module          |
| --------------------- | ------------------------------------- | -------------- | -------------------- | ----------------------------------- | -------------------------------- |
| web (74 files)        | entry 1969 + worker 22 + todoNotif. 1 | 1992           | **0**                | **0**                               | `build/metro-require/require.js` |
| android JS (77 files) | entry 2342                            | 2342           | **0**                | **0**                               | `build/metro-require/require.js` |

- Every map section was enumerated and every `sources` entry checked
  (`export-web-analysis.json`, `export-android-analysis.json`). Byte-needle
  corroboration (`node-forge`, `DigestInfo.DigestAlgorithm`,
  `DigestInfo value.`, `Encryption block is invalid.`) over **every** output
  file: zero hits in both exports.
- `@expo/cli/build/metro-require/require.js` is a module-resolution shim; it
  contains no cryptography and no verifier.
- The static-rendering graph (Expo CLI's `@expo/router-server/node/render.js`)
  is transient build tooling executed during export; no render.js artifact
  exists in either shipped output tree. Shipped web output is 3 JS bundles +
  HTML/CSS/assets; shipped android JS output is one bundle (+ assets).
- Output identities (SHA-256 per js/map/css/html/json) are recorded in the
  analysis JSONs. The fresh web export reproduces the same bundle content
  hashes as the historical `dist/` (e.g. `entry-8c182cd879ebc5bb55e236aa4a22b362`).
- **APK (supplementary, provenance-mismatched):** on-disk
  `android/app/build/outputs/apk/release/app-release.apk` =
  `F3D9A63C39589FCA3BD91BDDFCC1C6AB0AD43A2ADEE50E2F3A502B143D961C5` does **not**
  match the retained green build record's `E6E55ED5C4D5…` (record source
  `7a6aeb22b31d`, clean tree, Nitro_API_36). No qualification transfers to
  this binary. Rescanned anyway with entry-completeness proof: 1630/1630 ZIP
  entries inflated (0 failed, 0 skipped), 1/1 JS-bundle candidate entry read;
  zero forge signatures in the entire archive
  (`apk-forge-scan.json`, `apk-all-entry-scan.json`).
- **Edge/server artifacts:** `supabase/functions/**` source imports no forge
  and no `@expo/code-signing-certificates` (grep over function sources). There
  is no other deployed server artifact in this repository; deployed edge state
  on Supabase was **not accessed** (campaign forbids Supabase access), so a
  deployed-bundle identity is an explicit access limit, not a safety claim.
  The edge functions use WebCrypto/Deno APIs and local JS helpers only.
- Product source (`app/`, `features/`, `core/`, `lib/`, `constants/`) imports
  no `node-forge`.

**Conclusion (shipped exposure):** node-forge does not enter the web bundle,
the android JS bundle, or any repository-deployed edge source. This is now
source-map-module-identity evidence (primary) with byte corroboration, not a
package-name grep. The historical APK scan remains supplementary.

## 3. Tooling execution and affected-API reachability (task 2.4)

The affected API is RSA PKCS#1 v1.5 signature verification
(`publicKey.verify` / `rsa.verify` default scheme). Call trace in installed
source:

- `@expo/code-signing-certificates@0.0.6 build/main.js`:
  - `validateSelfSignedCertificate` → line 176 `certificate.verify(certificate)`
    (forge x509 self-signature check → `lib/x509.js` `publicKey.verify`);
  - `signBufferRSASHA256AndVerify` → line 203
    `certificate.publicKey.verify(digest…, digestSignature)` (directly the
    affected verifier);
  - `generateDevelopmentCertificateFromCSR` → line 246 `csr.verify(csr)`.
- `@expo/cli@55.0.36 build/src/utils/codesigning.js`: calls
  `validateSelfSignedCertificate` (line 308, when validating a project
  development certificate) and `signBufferRSASHA256AndVerify` (line 401, in
  `signManifestString`).
- `@expo/cli build/src/start/server/middleware/ExpoGoManifestHandlerMiddleware.js`
  (development-server manifest middleware): `getCodeSigningInfoAsync` +
  `signManifestString` — signs the Expo Go development manifest when project
  code signing is configured; verification happens in Expo Go.
- `@expo/cli build/src/run/ios/codeSigning/Security.js`: imports forge
  directly, `pki.certificateFromPem` on macOS `security find-certificate`
  output (iOS/macOS code-signing identity resolution; a source read is not an
  iOS action).

The installed vulnerable defect matches the advisory exactly
(`node-forge@1.4.0 lib/rsa.js`): the RSASSA-PKCS1-v1_5 verifier validates the
outer DigestInfo element count (`obj.value.length !== 2`, the earlier
CVE-2026-33894 fix) but `digestInfoValidator` does not constrain the nested
`DigestInfo.DigestAlgorithm` SEQUENCE to its two named elements — extra nested
elements are accepted (GHSA-86w9-cpqp-85rv).

**Execution class:** the affected verifier is executed by **build/development
tooling** (Expo CLI code-signing flows: development certificate validation,
dev-manifest signing self-check, CSR-based development certificate issuance,
iOS/macOS signing-identity parsing). It is not executed by the shipped app.
Input material in these flows is the developer's own development certificate /
CSR / locally-generated signature (locally generated or fetched from the
developer's own EAS account); no untrusted network signature is verified by
this app's flows, and no practical attack against this app or its signing
material was attempted (per the brief). Low-exponent-key applicability is not
established for tooling-generated keys (forge key generation defaults to
e = 65537; `signBufferRSASHA256AndVerify` verifies a self-produced signature).
The Expo Go client verifies manifests signed by this tooling — the vulnerable
verifier is in the tooling, not in the client bundle.

**Classification:** `DEPENDENCY_VULNERABILITY` (real, high,
GHSA-86w9-cpqp-85rv) + `NO_PATCH_AVAILABLE`, npm-production-transitive via
framework tooling, with affected-API reachability in build/development
tooling and demonstrated non-inclusion in shipped web/android JS artifacts
(APK supplementary). It is **not** `BUILD_TIME_ONLY` as a waiver label — the
tooling executes at development/build time and uses the affected API, which
disqualifies any build-only exemption under the brief's predicates.

## 4. Red-result classifications

### R1 — live audit gate red

- **WHY:** undocumented high advisory `GHSA-86w9-cpqp-85rv` on
  `node_modules/node-forge` in the production tree.
- **CLASSIFICATION:** `DEPENDENCY_VULNERABILITY`.
- **EVIDENCE:** `audit-gate-before.log` (exit 1), `npm-audit-full.json` /
  `npm-audit-prod.json` (exit 1), advisory metadata
  (`<=1.4.0`, `first_patched_version: null`), path analysis §1.
- **WHAT IS REQUIRED:** a published, independently verified compatible fixed
  `node-forge` release satisfying both parents' `^1.3.3` ranges (or their
  supported replacement), or a supported parent release that removes both
  vulnerable paths.
- **EXACT NEXT ACTION:** complete the options ledger (Phase 3) and, absent a
  safe candidate, route to the precise-blocked proof (task 3.6 → 8.4) while
  Phase 5 hardens the independent audit defect.

### R2 — audit gate false-green on invalid command results

- **WHY:** `runAudit()` accepts parseable npm error JSON and defaults empty
  failed stdout to `{}`, so `findings()` sees no advisories and exits 0.
- **CLASSIFICATION:** `AUDIT_POLICY_BUG`.
- **EVIDENCE:** planning-time VM fixtures executing the unchanged CLI source
  (`simulation-output/security-explore-2026-10-02/audit-cli-fixtures.json`):
  error-JSON fixture → exit 0, empty-failure fixture → exit 0 (both false
  greens); valid empty report → 0; undocumented high → 1; malformed → 1.
- **WHAT IS REQUIRED:** the fail-closed command/report seam with executing
  behavioral tests (Phase 5, tasks 5.1–5.4).
- **EXACT NEXT ACTION:** implement Phase 5 at the real command/report seam;
  this does not and cannot resolve R1.

### R3 — planning-time exploratory web export incomplete (history)

- **WHY:** 600-second harness deadline under measured host contention
  (455 MB free / 100% CPU at the time).
- **CLASSIFICATION:** `ENVIRONMENT` (preserved history).
- **EVIDENCE:** `simulation-output/security-explore-2026-10-02/export-web.log`.
- **WHAT IS REQUIRED / EXACT NEXT ACTION:** none — superseded at apply time by
  the completed fresh exports in §2 (web and android, full map coverage).
  The historical non-pass is retained as history, not re-labeled.
