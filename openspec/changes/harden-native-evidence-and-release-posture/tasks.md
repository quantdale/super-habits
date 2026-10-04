## 1. Native build hermeticity

- [x] 1.1 Extract the shared hermetic-build steps from `scripts/build-dist-e2e.mjs:33-87` into a reusable helper parameterized by build command and output directory
- [x] 1.2 Call that helper from `scripts/qa-native-provision.mjs:299-315`, replacing the ambient-environment `buildEnv`, and fail loudly naming any offending ambient `EXPO_PUBLIC_*` variable
- [x] 1.3 Add a post-build scan of the produced APK's JavaScript bundle for any routable `supabase.co` host, and fail provisioning when one is found
- [x] 1.4 Record the resolved Supabase endpoint and an anon-key fingerprint in the provenance sidecar written by `scripts/native-provenance.mjs`, or an explicit "no remote configured"
- [x] 1.5 Make a native run that cannot state its remote configuration report `NOT_CERTIFIED` rather than `PASS`
- [x] 1.6 Add coverage that a workstation whose environment file names a live project produces an APK with no live host and a provenance record naming the endpoint used

## 2. Native coverage and binary identity

- [x] 2.1 Add expected-flow-list resolution for the requested tag to `scripts/qa-native.mjs`, asserting non-empty and duplicate-free as `scripts/qa-ios-github-actions.mjs:50-51` does
- [x] 2.2 Require `report.flows.length === expectedFlows.length` and every flow `PASS` before reporting a lane pass, instead of mapping only the process exit code at `scripts/qa-native.mjs:572`
- [x] 2.3 Add `provisioned: boolean` and `installedApkSha256: string | null` to the native report schema, populated on the provisioning path and on the already-installed path
- [x] 2.4 Make a `--no-provision` report state in its own text that it ran on an unverified installed binary
- [x] 2.5 Remove the no-op `--force` flag from `scripts/qa-native-provision.mjs:39,311` and correct the remediation message in `scripts/qa-native.mjs:465-467` to name the command that actually rebuilds

## 3. Android release configuration

- [x] 3.1 Set `expo.android.allowBackup: false` in `app.json` and confirm the generated manifest no longer carries `android:allowBackup="true"`
- [x] 3.2 Correct `docs/release/privacy-policy.md` so the statement about data leaving the device matches the actual OS-level backup posture
- [x] 3.3 Correct the store data-declaration document to address OS-level backup and device-to-device transfer explicitly
- [x] 3.4 Extend `tests/store-declaration-drift.test.ts` with a merged-manifest source that is used when the build intermediates exist and a committed expected-permission list otherwise, and fail when a built-manifest permission is not declared
- [x] 3.5 Remove the unused overlay permission from the application's own manifest contribution in `app.json`, and confirm no code path uses it
- [x] 3.6 Add a release-profile guard that rejects `EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST` for any profile other than the E2E test profile, and run it for every release-candidate profile
- [x] 3.7 Record in `docs/release/` that the only executable release-build path is debug-signed, that the E2E and store builds share an application identity and version code, and that release builds are unminified and unshrunk, with the exact resume action for each

## 4. AI default-off specification

- [x] 4.1 Add coverage asserting the command center's rendered surface offers no Ask or Auto option in a build without `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT`, rather than asserting only the constant's value
- [x] 4.2 Add coverage that a build without the flag issues no paid provider request through the command center

## 5. Validate

- [x] 5.1 Run `npx vitest run tests/store-declaration-drift.test.ts tests/version-build-consistency.test.ts` and record the exact result
- [x] 5.2 Run `npm run qa:fast` on pinned Node `v22.23.2` and record the exact result
- [x] 5.3 Boot `Nitro_API_36` when it can start safely, run `npm run qa:native:provision`, then `node scripts/qa-native.mjs --platform android --tag smoke`, and inspect the report's new hermeticity, endpoint, coverage, and binary-identity fields — **EXECUTED 2026-10-01 on `68db684` (smoke 1/2), then re-executed green on `80b0b33` after the flow repair.** First run: provisioning succeeded (`BUILD SUCCESSFUL in 6m 5s`, bundle scan 1 entry / 0 Supabase hosts, APK SHA-256 `5DF9D5DC72EF13B4B88DF32527244C50BD750D1C48EF79EB0CA3B6D2ADFA1014`, remote `local-only` with a null endpoint); `native-smoke` passed and `command-center-v2` failed deterministically on `tapOn: 'Create'` because this change's own render boundary removes the mode selector in an ordinary build (`TEST_BUG`). The one-step `.maestro/` repair was executed by the linked successor `windows-closure-reconciliation` (`80b0b33`, platform-conditional flow step plus a non-vacuous regression guard), and the smoke lane then passed **2/2** (`command-center-v2` 37 s, `native-smoke` 53 s) from a clean detached checkout of `80b0b33` with provisioning PASS (`BUILD SUCCESSFUL in 9m 45s`, bundle scan 1 entry / 0 Supabase hosts, APK SHA-256 `E2F43FBBE37FFA28D31EB3379DAB7C06B352EBF456748AF958D367245C3690D2`, remote `local-only`, `flowCoverage.verdict: OK`). All new fields are present and correct in both reports.
- [x] 5.4 Re-run the persistence and lifecycle tags against the same current-source build and record the exact flow counts — **persistence 11/11 passed in 16m 50s and lifecycle 6/6 passed in 8m 39s**, both `flowCoverage.verdict: OK` (expected == executed), same `installedApkSha256`, `remoteConfiguration.mode: local-only`, `bundleScan.scannedEntries: 1` / `matches: 0`. Reports under `simulation-output/native/apply-closure-2026-10-01/`.
- [x] 5.5 Run `npm run openspec:validate --all` and confirm this change still validates
- [x] 5.6 Review the full diff and confirm no Maestro assertion, threshold, or selector was changed and no tracked Android source file was edited directly
