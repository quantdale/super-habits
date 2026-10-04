## Context

See proposal.md for the motivation. Current `main` is `c1bc380`. The web lane already solved this problem class: `scripts/build-dist-e2e.mjs` sets `EXPO_NO_DOTENV=1`, deletes ambient `EXPO_PUBLIC_*` (`:33-36`), and post-scans every emitted file as bytes for a `supabase.co` host (`:59-87`), and `scripts/serve-e2e.js` refuses to serve an export carrying a live host. `scripts/qa-native-provision.mjs` has no equivalent: `buildEnv = { ...process.env, [E2E_ENV_NAME]: 'true' }` (`:299-315`), its only endpoint-changing path is the opt-in loopback mock (`:302-308`), and it records `sourceSha`, `sourceTreeClean`, package identity, and APK SHA-256 (`:392-415`) but never the resolved remote endpoint. `scripts/native-provenance.mjs:47` runs `git status --porcelain=v1 --untracked-files=all`, which by design excludes ignored files, and `.env` is ignored (`.gitignore:36`). The iOS GitHub Actions lane already asserts a non-empty, duplicate-free flow list (`scripts/qa-ios-github-actions.mjs:50-51`) and requires `report.flows.length === flows.length && every PASS` (`:248`); `scripts/qa-native.mjs` maps only a process exit code to status (`:572`). `android/` is a generated, gitignored tree, so the only tracked Android configuration surface is `app.json`, which declares four permissions and no backup flags. `tests/store-declaration-drift.test.ts:33-42` pins the permission set by reading `app.json`, and its own comment records that the Play Data safety answers were written against that set.

## Goals / Non-Goals

**Goals:**

- Make a native `PASS` mean the same thing a web `PASS` means: hermetic build, recorded remote configuration, verified coverage, verified binary.
- Stop the Android release configuration from participating in OS-level backup, and make the declarations observe the built manifest.
- Record the unproven parts of release posture as unproven, with an exact resume action, instead of leaving them implicit.

**Non-Goals:**

- Producing a store-buildable artifact, a production keystore, an AAB, or a release tag. Those stay owner-gated.
- Rewriting the native runner's target selection, multi-AVD summary, or replay protocol.
- Changing any Maestro flow's assertions, thresholds, or selectors.
- Native iOS work of any kind. The iOS lane is used here only as the reference implementation for the flow-count assertion pattern.

## Decisions

### 1. Reuse the web hermeticity envelope rather than designing a native one

Extract the shared hermetic build steps into one helper and call it from both `scripts/build-dist-e2e.mjs` and `scripts/qa-native-provision.mjs`, parameterized by the build command and the output directory to scan. The native path adds a bundle scan because an APK's JavaScript is inside the archive rather than in loose files.

Alternative: copy the web guard into the native script. Rejected. Two copies of a credential-leak guard drift, and the drift direction is exactly the failure this change exists to prevent.

### 2. Record the resolved endpoint, not a boolean

The provenance sidecar records the resolved Supabase host (or an explicit "none configured"), plus a short fingerprint of the anon key so two builds can be told apart without recording the key. A native run that cannot state its remote configuration reports `NOT_CERTIFIED` rather than `PASS`.

Alternative: record only "hermetic: true". Rejected. That is the claim that was already untrue; the reader needs the endpoint.

### 3. The flow-count assertion is copied from the iOS lane, not generalized yet

Add the same two assertions to `scripts/qa-native.mjs`: resolve the expected flow list for the tag, assert non-empty and duplicate-free, and require the executed count to equal it with every flow passing. The resolution logic lives next to the runner because the Android lane selects flows by tag while the iOS lane selects them from a workflow file.

Alternative: extract a shared flow-list module now. Rejected. The two selection mechanisms differ, and a premature abstraction would couple a Windows-only lane to an EAS workflow file. Noted as a follow-up.

### 4. Binary identity is recorded as observed, not asserted

Add `provisioned: boolean` and `installedApkSha256: string | null` to the report. When `--no-provision` is used, `provisioned` is false and the report says so in its own text; the lane is still allowed to run, because a deliberate re-check of an installed build is a documented use, but the record is self-identifying.

Alternative: refuse `--no-provision` unless an APK path is supplied and hashed. Rejected. It removes a documented capability for a provenance problem that a recorded field solves.

### 5. `--force` is removed rather than implemented

Remove the parsed-but-unused `--force` flag and change the remediation message in `scripts/qa-native.mjs:465-467` to name the command that actually rebuilds. `main()` already always does `expo prebuild --clean` and `assembleRelease --no-build-cache --no-daemon` (`:312-353`), so a "force" flag has nothing to force.

Alternative: make `--force` skip a cache. Rejected. There is no cache to skip; implementing it would add a flag whose only effect is a log line's honesty.

### 6. Backup exclusion is expressed through tracked configuration

Set `expo.android.allowBackup: false` in `app.json`, which the prebuild turns into the manifest attribute, rather than editing the generated `android/` tree. The privacy policy and the store data-declaration document are corrected in the same change.

Alternative: add an `android:dataExtractionRules` XML and a config plugin. Rejected. It is more surface for the same outcome, and `allowBackup: false` covers both the classic and the device-to-device transfer paths for an app whose whole dataset is a credential-bearing local database. A future case for selective exclusion is a separate, justified change.

### 7. The permission guard observes the built manifest when one exists, and a committed list when it does not

`tests/store-declaration-drift.test.ts` gains a second source: when `android/app/build/intermediates/merged_manifest/` exists locally it is read, and when it does not (CI, fresh clone) the guard asserts against a committed expected-permission list that includes the library-contributed permissions. Either way, a permission the declarations do not cover fails.

Alternative: require a Gradle build in CI to read the merged manifest. Rejected. It adds a heavy, platform-specific job to the pull-request gate to observe a value that a committed list states precisely.

### 8. Release signing stays a residual, but an explicit one

Record in `docs/release/` that the only executable release-build path is debug-signed, that the E2E and store builds share `applicationId` and `versionCode 1`, and that release builds are unminified and unshrunk. No keystore, signing config, or `applicationIdSuffix` is created, because producing a production signing key is an owner action with custody consequences.

Alternative: generate a local release keystore for QA. Rejected. A locally generated key that is not the owner's is worse than none: it would let a QA build look store-buildable.

## Risks / Trade-offs

- [Making the native build hermetic breaks a workflow that relied on ambient env] → The mock-auth path still sets its own endpoint explicitly, and the hermetic helper fails with a message naming the offending variable rather than silently stripping it.
- [A recorded "none configured" endpoint makes some lanes not runnable] → A lane that needs a remote now fails loudly with the resume action, instead of passing against a remote nobody recorded. That is the intended trade.
- [Disabling OS backup removes a user's expectation of device migration] → The in-app backup and restore path is the supported migration route and is documented as such; the privacy policy is corrected to say so.
- [A committed expected-permission list can go stale in the permissive direction] → The local path reads the real merged manifest, so the committed list is checked against reality on any machine that has built the app; the guard's message states which source it used.
- [Asserting on the rendered Ask surface is more brittle than asserting on a constant] → The assertion renders the command center without the flag and checks the mode selector's options, which is the behavior a user depends on and the property a refactor would actually break.

## Migration Plan

No data or schema migration, no native code change. Apply order: (1) extract the hermetic-build helper and wire both build paths; (2) add the bundle scan and the provenance endpoint/fingerprint fields; (3) add the Android flow-count assertion; (4) add `provisioned` and `installedApkSha256` and remove `--force`; (5) set `allowBackup: false` and correct the privacy-policy and store-declaration documents; (6) extend the permission guard with the built-manifest source and remove the unused overlay permission; (7) add the release-profile seam guard; (8) record the release-signing residual with its resume action; (9) add the Ask default-off requirement's coverage. Validation: `npm run supabase:schema:validate` where the schema guard is touched, `npx vitest run tests/store-declaration-drift.test.ts`, `npm run qa:fast` on pinned Node `v22.23.2`, and a real `npm run qa:native:provision` plus `--tag smoke` on `Nitro_API_36` when the emulator can start safely, with the report's new fields inspected. Rollback is a revert of the single commit; `android/` regenerates from `app.json` on the next prebuild.

## Open Questions

None that change the specs or the task split. Whether the Android lane can run on this host at apply time is an execution observation with an `ENVIRONMENT` classification already specified.
