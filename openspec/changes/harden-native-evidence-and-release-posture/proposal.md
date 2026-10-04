## Why

The native QA lane is the repository's only runtime evidence for Android, and two of its guarantees do not hold. Its APK build is not hermetic: `scripts/qa-native-provision.mjs:299-315` inherits the ambient environment and the developer `.env` without `EXPO_NO_DOTENV` or any strip, so an APK reported as credential-free can carry live Supabase credentials and drain the sync outbox into production while the lane reports `PASS` with a clean source SHA — the exact incident class the web lane already fixed and documented. Its evidence chain also trusts the operator: `--no-provision` and `--build-metadata` can report a previously installed build as current-source proof, and the runner has no flow-count assertion, so a tag that matches zero flows is indistinguishable from a pass. Separately, the Android release configuration is unsafe by default — the merged manifest carries `allowBackup="true"` with no backup rules, which uploads the entire local database and the persisted Supabase session tokens to the device's Google account — and the store declarations and their guard were drafted against a four-permission list while the built APK requests `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW`.

## What Changes

- Make the native Android E2E build hermetic: set `EXPO_NO_DOTENV=1`, strip ambient `EXPO_PUBLIC_*`, and post-build scan the bundle for any `supabase.co` host, mirroring `scripts/build-dist-e2e.mjs`.
- Record the resolved Supabase endpoint and anon-key fingerprint in the provenance sidecar, so a native PASS states which remote, if any, it targeted.
- Give the Android runner the iOS lane's coverage assertion: an expected, non-empty, duplicate-free flow list, and a PASS only when the flow count matches and every flow passed.
- Emit `provisioned` and `installedApkSha256` fields so a `--no-provision` PASS record is self-identifying, and remove the no-op `--force` flag or make it do what its remediation message promises.
- Set `expo.android.allowBackup: false` in `app.json` so every future prebuild emits a manifest that does not participate in OS-level backup and device-to-device transfer, and reconcile the privacy-policy and store-data-declaration documents with that posture.
- Extend the store-declaration guard to observe the merged Android manifest (or a committed expected-permission list) so a library-added permission fails loudly, and remove the unused overlay permission from the app's own manifest contribution.
- Keep release signing as an owner-gated residual, but record the debug-keystore release path, the shared `applicationId`/`versionCode` between the E2E and store builds, and the disabled minification as an explicit, unproven release-posture finding with a resume action.
- Add a release-build guard that rejects `EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST` in a non-`e2e-test` build profile.
- Add a spec requirement that Ask and Auto are default-off, which `openspec/specs/ai-ask/spec.md` currently does not state, and pin the `CommandScreen` early-return in a test.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `native-release-qualification`: Add requirements that native evidence is produced by a hermetic build whose remote configuration is recorded, that a native PASS requires a verified flow count and a verified installed binary, and that the Android release configuration does not expose local data to OS-level backup or request permissions the declarations do not cover.
- `ai-ask`: Add a requirement that Ask and Auto are default-off and that the default is a spec-level obligation with executing coverage, not only a source-string assertion.

## Impact

Touches `app.json`, `scripts/qa-native-provision.mjs`, `scripts/qa-native.mjs`, `scripts/native-provenance.mjs`, `scripts/qa-ios-github-actions.mjs` (only if its flow-list helper is shared), `tests/store-declaration-drift.test.ts`, `docs/release/*`, and one spec. The generated `android/` tree is gitignored and is not edited; every Android configuration change is expressed through tracked `app.json`. No Supabase query or mutation, no product feature change, no local schema migration. The signing keystore, store submission, and any release tag remain owner-gated and stay unproven by this change.
