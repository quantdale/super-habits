# ExecPlan: Harden native evidence and release posture

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Apply the [harden-native-evidence-and-release-posture OpenSpec change](proposal.md)
and its [tasks](tasks.md): a native `PASS` is produced by a hermetic build whose
remote configuration is recorded, proves the flow coverage it claims, and names
the binary it ran; the Android release configuration stops handing the local
database to OS-level backup and requests no permission the declarations do not
cover; a test-only seam cannot ship in a release profile; and Ask/Auto
default-off is a specified obligation with coverage on the rendered surface
rather than on a constant.

## Context

- Starting HEAD `c1bc380ce330cda1e089fd79b49a12029defbb72` on `main`, with five
  earlier changes from this wave already applied on top of it.
- The native lane's build was not hermetic: `scripts/qa-native-provision.mjs`
  built with `{ ...process.env }` plus one flag and no `EXPO_NO_DOTENV`, so
  prebuild read the developer's `.env`. This host's `.env` names
  `EXPO_PUBLIC_SUPABASE_URL` for a live project, and the APK the lane built on
  2026-09-24 and reported as credential-free — with a clean source SHA — carries
  that host inside `assets/index.android.bundle`. The new scanner found it at
  offset 1136711 of the real artifact, so this is a measured defect, not a
  hypothetical one.
- The runner mapped only Maestro's process exit code to `PASS`, so a tag that
  selected zero flows (or a renamed flow) was indistinguishable from a full
  green battery. The iOS lane already refused that; Android did not.
- The generated merged manifest carried `android:allowBackup="true"` with no
  backup rules, and requested `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`,
  `SYSTEM_ALERT_WINDOW`, `INTERNET`, `ACCESS_NETWORK_STATE`,
  `READ/WRITE_EXTERNAL_STORAGE`, the FCM c2dm receiver permission, the app's
  signature receiver permission, and an 18-permission launcher-badge family —
  while the store declarations named four.
- Ask and Auto were hidden behind `AI_ASK_EXPERIMENT_ENABLED`, asserted only by
  reading that constant's value, and the only other lock was the render boundary
  itself, with nothing at the provider entry point.

## Scope

The five task groups in tasks.md: hermetic build (1.1-1.6), coverage and binary
identity (2.1-2.5), Android release configuration (3.1-3.7), AI default-off
specification (4.1-4.2), and validation (5.1-5.6).

## Non-Goals

No production keystore, AAB, store submission, or release tag. No change to
`simulation/matrix.ts` or to which lanes run. No Maestro assertion, threshold,
or selector change. No native iOS work — the iOS lane is the reference pattern
for the flow-count assertion, nothing more. No hand edit of the generated
`android/` tree: every Android configuration change goes through `app.json`.

## Current Checkpoint

- Current milestone: COMPLETE — all 26 tasks are checked. The device leg (5.3, 5.4) was executed twice on 2026-10-01: first at `68db684` (provisioning PASS, smoke 1/2, persistence 11/11, lifecycle 6/6), then all-green at `80b0b33` after the linked successor `windows-closure-reconciliation` repaired the stale flow step. Every claim in this change was validated against a real hermetic release build rather than argued.
- Completed: the shared hermetic envelope (`scripts/hermetic-build.mjs`) is
  called by BOTH build paths; the native provisioner fails on an ambient Supabase
  variable by name, scans the built APK's bundle before installing, and records
  the resolved endpoint plus an anon-key fingerprint; a build record that cannot
  state its remote is no longer reinstallable as current-source evidence; the
  Android runner resolves an expected flow list before touching the target,
  requires the executed set to match, records `provisioned` /
  `installedApkSha256` / a self-identifying binary note, and refuses to certify
  coverage it cannot prove; `--force` is gone; `allowBackup: false` and
  `blockedPermissions` are set in `app.json` and verified in a real prebuild AND
  a real merge; the store declarations state the built permission set, the blocked
  overlay, and the OS-backup posture; `docs/release/release-signing-posture.md`
  records the signing/identity/minification posture as unproven with resume
  actions; a release-profile guard rejects the native test seam outside
  `e2e-test`; and Ask/Auto default-off is enforced both at the render boundary
  (a pure surface module the screen and mode toggle consume) and at the provider
  entry point.
- Current milestone: 25 of 26 checked. The device leg (5.3, 5.4) was **EXECUTED on
  2026-10-01** against the current source `68db684` from a clean detached worktree
  of that commit (the in-tree run is refused by `requireCleanGitTree`; see the
  blocker below). **5.4 is checked on green evidence** (persistence 11/11,
  lifecycle 6/6). **5.3 stays UNCHECKED** because its smoke lane is 1/2: the
  `command-center-v2` flow fails deterministically on `tapOn: 'Create'`.
- Native evidence recorded 2026-10-01 (pinned Node v22.23.2, hermetic build,
  serial `emulator-5554`, AVD `Nitro_API_36`, API 36 x86_64):
  - `npm run qa:native:provision -- --serial emulator-5554` → `BUILD SUCCESSFUL in
6m 5s` (608 actionable tasks), `Bundle scan: 1 JS/bytecode entry(ies) in the
APK, no Supabase host`, `Android E2E APK installed: com.dale16.superhabits
1.0.0 on emulator-5554 (source 68db684d0915d8cd781d52b282a3934ca214171b, APK
SHA-256 5DF9D5DC72EF13B4B88DF32527244C50BD750D1C48EF79EB0CA3B6D2ADFA1014)`,
    `Remote configuration recorded: none configured (local-only)`, exit 0.
  - `--tag smoke` → **1/2**, outcome `FAILED_NEEDS_TRIAGE`. `native-smoke` passed
    (1m 33s); `command-center-v2` failed (44s) with `Element not found: Text
matching regex: Create`. Report fields: `provisioned: true`,
    `installedApkSha256` as above, `remoteConfiguration {mode: local-only,
endpoint: null, anonKeyFingerprint: null}`,
    `bundleScan {host: supabase.co, scannedEntries: 1, matches: 0}`,
    `flowCoverage {verdict: MISMATCH, expected 2, executed 2, missing [],
reason: "Maestro exited 1."}`.
  - `--tag persistence` → **11/11 passed in 16m 50s**, `flowCoverage.verdict: OK`
    (expected 11, executed 11).
  - `--tag lifecycle` → **6/6 passed in 8m 39s**, `flowCoverage.verdict: OK`
    (expected 6, executed 6).
  - Both green tags report the same `installedApkSha256`,
    `remoteConfiguration.mode: local-only` with a null endpoint, and
    `bundleScan.scannedEntries: 1` / `matches: 0`.
  - Artifacts preserved in-repo at
    `simulation-output/native/apply-closure-2026-10-01/` (three tag reports, the
    build record, and the failing flow's `commands.json` + hierarchy +
    screenshot).
- In progress: nothing. All 26 tasks are checked.
- Final green device battery at `80b0b33` (clean detached checkout, pinned Node
  v22.23.2, ambient Supabase variables unset, AVD `Nitro_API_36`, serial
  `emulator-5554`, API 36 x86_64, package `com.dale16.superhabits` 1.0.0 (1),
  APK SHA-256 `E2F43FBBE37FFA28D31EB3379DAB7C06B352EBF456748AF958D367245C3690D2`):
  provisioning PASS (`BUILD SUCCESSFUL in 9m 45s`, bundle scan 1 JS/bytecode
  entry / 0 Supabase hosts, remote `local-only`); smoke **2/2**
  (`command-center-v2` 37 s, `native-smoke` 53 s); persistence **11/11**
  (13 m 32 s); lifecycle **6/6** (7 m 28 s). Every `flowCoverage.verdict` is
  `OK` (expected == executed) and every report carries the same APK identity and
  `local-only` remote. Artifacts preserved in-repo at
  `simulation-output/native/windows-closure-2026-10-01/` (three tag reports, the
  build record, and the repaired flow's debug tree).
- Important modified files: `app.json`, `scripts/release-profile-guard.mjs` (new),
  `scripts/hermetic-build.mjs` (new), `scripts/native-apk-scan.mjs` (new),
  `scripts/native-flow-coverage.mjs` (new), `scripts/build-dist-e2e.mjs`,
  `scripts/qa-native-provision.mjs`, `scripts/qa-native.mjs`,
  `scripts/native-avd.mjs`, `features/command/commandSurface.ts` (new),
  `features/command/{CommandScreen,ModeToggle,askParser,types,ask.types}.ts*`,
  four release documents, and seven test files.
- Last successful validation: pinned Node `v22.23.2` — a REAL hermetic Android
  release build (`EXPO_NO_DOTENV=1`, no ambient `EXPO_PUBLIC_*`) finished
  `BUILD SUCCESSFUL in 7m 19s` (608 tasks), and its artifact was checked three
  ways: `native-apk-scan.mjs` reports 0 Supabase hosts in
  `assets/index.android.bundle` (the 2026-09-24 APK scanned positive for
  `kruubbynsmxzxfdunaal.supabase.co`); the merged manifest carries
  `android:allowBackup="false"` with zero `SYSTEM_ALERT_WINDOW` entries; and the
  permission guard passes against that real merge (36 permissions). Then
  `npm run typecheck` 0 errors; `npm run lint` 0 errors / 0 warnings;
  `npm run qa:fast` green (unit 167 files / 2029 tests; journey-label,
  quarantine-register, and release-profile guards OK); `npm run qa:integration`
  79 files / 386 tests passed, 1 file / 2 tests skipped (pre-existing);
  `npm run openspec:validate --all` 68/68; strict per-change validate OK;
  `npx prettier --check` clean on every changed file.
- Current failures: none. The `command-center-v2` smoke residual is fixed and
  device-verified: `CommandScreen` correctly returns the command content without
  `ModeToggle` while `AI_ASK_EXPERIMENT_ENABLED` is false, and the flow is now
  platform-conditional (Android asserts the ordinary Create surface and the
  absence of `Ask`/`Auto`; the iOS branch keeps the historical `tapOn: 'Create'`).
  The fix and its non-vacuous regression guard live in
  `windows-closure-reconciliation` (`.maestro/flows/command-center-v2.yaml`,
  `tests/maestroCommandCenterFlowGuards.test.ts`). The pre-existing
  `tests/nativeAuthMock.test.ts` `isPidAlive` host-speed sensitivity is unchanged
  and passes in this campaign's runs.
- Relevant quarantines: none. No test was weakened, skipped, or given a longer
  timeout; the two Ask-pipeline test files keep their explicit rollout opt-in and
  the default-off obligation stays covered in `tests/askDefaultOffSurface.test.ts`.
- Blockers: none for this change. The two earlier blockers are resolved: the
  clean-tree precondition is met by the clean detached checkout used for both
  batteries, and the `.maestro/` flow repair was authorized by the Windows closure
  brief and executed by the linked successor.
- Exact next action: None — the change is complete; archiving into
  `openspec/specs/` is a separate user-invoked OpenSpec step.
- Remaining definition of done: complete — every task is checked on direct
  evidence, the device leg is green at the current source, and the change is
  validated.
- Durable environment constraint for the next session (recorded here because
  this is where the native work is read from): **`npm run build:e2e` and every
  lane built on it (`e2e:full`, `qa:journeys`, `qa:full`, `qa:native:provision`,
  `web:verify`, `qa:repeat`, `web-lifecycle`) refuse to run while ambient
  `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are exported** —
  the hermetic envelope aborts non-zero and names the offending variables. Run
  `unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY` before any
  build, E2E, or native lane. The same envelope also means a native build with no
  remote configured records `remoteConfiguration.mode: "local-only"` with a null
  endpoint, which is a PASS condition, not a missing field.

## Progress

- [x] Wave 0 — the real defect reproduced on the real artifact: the 2026-09-24
      APK scanned positive for `kruubbynsmxzxfdunaal.supabase.co`, and the
      pre-fix merged manifest read for the backup flag and the full permission
      set (1.1-1.6 context).
- [x] Wave 1 — the hermetic envelope extracted into `scripts/hermetic-build.mjs`
      and called by both the web export and the native provisioner (1.1, 1.2);
      the APK bundle scan added as a ZIP reader with a fail-loud CLI (1.3); the
      remote configuration and anon-key fingerprint recorded in the provenance
      sidecar (1.4); a build that cannot state its remote is neither
      reinstallable nor reportable as a pass (1.5); coverage for a
      live-project workstation, the fingerprint contract, and the refusal
      (1.6).
- [x] Wave 2 — expected-flow-list resolution, the executed-set reader, and the
      coverage decision extracted and asserted, including against 59 real
      Maestro debug trees from the archived battery (2.1, 2.2); `provisioned`,
      `installedApkSha256`, the self-identifying binary note, and
      `remoteConfiguration`/`bundleScan` in the report (2.3, 2.4); `--force`
      removed from both scripts and the remediation text corrected to name the
      command that rebuilds (2.5).
- [x] Wave 3 — `allowBackup: false` and `blockedPermissions` set in `app.json`
      and confirmed in a real prebuild output (3.1, 3.5); the privacy policy,
      its hosted rendering, and the store data declarations corrected (3.2,
      3.3); the permission guard extended with a merged-manifest source, a
      committed expected list, and a synthetic-fixture non-vacuity case (3.4);
      the release-profile guard added, wired into `qa:fast` and a named script
      (3.6); the signing/identity/minification posture recorded as unproven with
      a resume action per item (3.7).
- [x] Wave 4 — the pure command surface consumed by `ModeToggle` and
      `CommandScreen`, with coverage on the offered modes, the renderable
      views, and the persisted-mode restore; a provider-side lock that refuses
      before configuration is consulted, with a rollout-build control proving
      the lock is the flag and not a permanent refusal (4.1, 4.2).
- [x] Wave 5 — validation: the focused test files, `qa:fast`, `qa:integration`,
      `openspec validate --all`, the strict per-change validate, prettier on the
      changed files, and a REAL hermetic release build whose artifact was checked
      for a leaked host, a backup flag, and a permission set (5.1, 5.2, 5.5,
      5.6).
- [x] Wave 6 — the device leg: provision, smoke, then persistence and lifecycle
      with recorded flow counts (5.3, 5.4). **Executed twice on 2026-10-01.** First
      on `68db684` from a clean detached worktree: provisioning green, smoke 1/2
      (`command-center-v2` red, `TEST_BUG`), persistence 11/11, lifecycle 6/6.
      Then all-green on `80b0b33` after the linked successor
      `windows-closure-reconciliation` repaired the stale flow step: provisioning
      PASS, smoke **2/2**, persistence **11/11**, lifecycle **6/6**, every
      coverage verdict `OK`, same APK SHA-256 `E2F43FBB…C3690D2`.

## Surprises & Discoveries

- The hermeticity defect was not theoretical: the artifact the lane reported as
  a credential-free `PASS` on 2026-09-24 inlines a live project host, and the
  cause is the developer's `.env` being read during prebuild. The bundle entry
  turned out to be STORED rather than deflated, so a raw byte search would also
  have caught it — but the scanner inflates either form, because that is not a
  property an APK build guarantees.
- The ZIP reader had to be dependency-free: a certification guard that pulls an
  archive library onto a cold machine reintroduces the supply-chain class this
  scan exists to remove. The tests build their own ZIPs (stored and deflated) so
  the fixtures are inspectable rather than opaque binaries.
- Maestro writes one directory per executed flow under
  `<debug-output>/.maestro/tests/<run>/`, each with a `manifest.json`. That is
  the evidence the coverage decision reads, and it was validated against 59 real
  archived runs: 49 prove an exact set match, and the rest are early-aborted
  failures where the exit code is the real finding (the decision checks the exit
  code FIRST for exactly this reason).
- The tag parser's first version consumed the flow body (`- launchApp:`) as tag
  entries, because a YAML list item and a flow command look identical at column 0. Only INDENTED items belong to a header list; the real flows proved it.
- `js-yaml` is present in `node_modules` only transitively and has no bundled
  types, so both the workflow reader in `tests/ciLaneIntegrity.test.ts` and the
  flow/manifest readers here use small purpose-built parsers instead of adding
  an undeclared dependency to a quality gate.
- `releaseText()` in the store-declaration test strips `.` and `_`, so it can
  never match a dotted permission name; the permission assertions read the raw
  markdown. The earlier version of that test was vacuous for the new list, which
  is exactly the failure mode a "declaration drift guard" must not have.
- The pre-existing `isPidAlive` test spawns Windows `tasklist` four times per
  call and is the only test in the suite that times out under full-suite load on
  this host. It was left alone: giving it a longer timeout would be weakening a
  meaningful signal about host speed.
- Adding the provider lock broke 25 existing Ask-pipeline tests, which exercised
  a rollout-gated path without opting in. The honest fix was for those two
  files to declare the opt-in before the import graph loads, not to weaken the
  lock; the default-off obligation is covered in the new file.
- The merged-manifest source caught ME. The committed permission list,
  transcribed by hand from a previous build's manifest, named
  `com.htc.launcher.READ_SETTINGS` and `com.htc.launcher.UPDATE_SHORTCET` (both
  wrong), included two the merge does not contain, and missed the four
  `com.android.launcher.permission.*` entries. Reading the real merge turned 34
  into 36 and failed the guard — the strongest available evidence that the check
  is not decorative, because it rejected the author's own convenient claim.
- A second `Nitro_API_36` instance cannot boot while the pre-existing emulator
  holds the AVD ("Another emulator instance is running"). **2026-10-01 follow-up:
  that process was reclaimed by an explicit decision** — it was an orphaned
  headless `Nitro_API_36` (PID 56380, launched 2026-09-30 19:28 by a prior
  automated session, 0 MB resident, 44 s CPU in 13 h, `adb shell` exit 124), the
  stale AVD locks were removed, and the AVD was then booted cleanly.
- **The emulator was never the real blocker.** Two `-no-snapshot` cold boots on
  this host never reached `sys.boot_completed` (guest RSS paged down to 48–146 MB
  while the host held 0.24–1.16 GB free). Booting the AVD the way the runner
  itself does — `-avd Nitro_API_36 -no-boot-anim -no-snapshot-save`, i.e. loading
  the saved `default_boot` snapshot — reaches `sys.boot_completed=1` in about
  50 s and reports API 36 / x86_64 / `ro.boot.qemu.avd_name=Nitro_API_36`. The
  earlier "no usable target" conclusion was an artifact of forcing a cold boot.
- **The certification-cleanliness precondition is stricter than "commit your
  work".** `requireCleanGitTree` requires an EMPTY
  `git status --porcelain=v1 --untracked-files=all`, so the preserved untracked
  `.tmp-ios36423379932/` extract and the untracked active `openspec/changes/*`
  directories keep the developer tree permanently dirty no matter how much is
  committed. The device leg therefore ran from a clean detached worktree of the
  same commit, which is how CI certifies committed source.
- **The new report fields work end to end on a real device.** All three tags
  recorded `provisioned: true`, the same `installedApkSha256`, an explicit
  `remoteConfiguration.mode: "local-only"` with a null endpoint, and a
  `bundleScan` that scanned 1 entry with 0 Supabase hosts.
- **The device leg found a real cross-change conflict.** `command-center-v2`
  fails deterministically on `tapOn: 'Create'` because this change's own render
  boundary removes the mode selector in an ordinary build (which the spec
  requires), while the Maestro flow still taps that chip. The same flow passed on
  Android at `56dad404`, so the break is this wave's. The fix is a one-step
  `.maestro/` edit, frozen for this campaign.

## Decision Log

- Extract ONE hermetic envelope and call it from both build paths rather than
  copying the web guard into the native script: two copies of a credential-leak
  guard drift, and the drift direction is the failure this change exists to
  prevent.
- Fail loudly on an ambient `EXPO_PUBLIC_SUPABASE_*` rather than stripping it
  silently: a workstation configured against a live remote must not silently
  produce a "credential-free" artifact, while non-Supabase public flags are
  stripped and reported rather than fatal.
- Record the resolved endpoint plus a 16-hex fingerprint of the anon key, never
  the key: two builds must be tellable apart without writing a credential into
  a report file.
- Treat a build record without a recorded remote as NOT current evidence, in
  both the install-only validator and the runner's build-match predicate, so the
  gate self-heals by re-provisioning instead of trusting a 2026-09-24 artifact.
- Keep Maestro invocation semantics unchanged (`--include-tags` over the
  workspace, one process) and prove coverage by COMPARING the resolved expected
  set against Maestro's own per-flow debug output, rather than restructuring the
  lane into N invocations. The N-invocation refactor is the iOS shape, but it
  would change the only native runtime evidence path for a coverage proof that
  does not need it.
- Check the Maestro exit code BEFORE the set comparison, so a real failing run
  is reported as a failure with the shortfall as context, not as a coverage
  mystery.
- `allowBackup: false` over backup-rules XML: the whole dataset is a
  credential-bearing database plus a persisted session, so selective exclusion
  has no case today, and the flag covers both classic and device-to-device paths.
- Block the overlay permission through `expo.android.blockedPermissions` rather
  than by editing the generated manifest: `android/` is gitignored and
  regenerated, so a hand edit would not survive the next prebuild.
- Compare `merged manifest − blocked permissions` against the committed list, so
  a stale local build (pre-prebuild) does not fail the guard while a genuinely
  library-added permission still does.
- Keep the Ask/Auto lock at TWO layers — the render surface and the provider
  entry point — because the spec demands the render boundary and a single future
  caller bypassing the surface should still not be able to spend money.
- Add the provider lock as a new `rollout_disabled` reason code rather than
  reusing `remote_not_configured`, so a refusal caused by policy is
  distinguishable in the report from one caused by configuration.

## Adversarial Review and Dispositions

- **Could the hermetic build still leak?** The envelope removes both dotenv
  loading and ambient `EXPO_PUBLIC_*`, the canonical remote record throws if a
  URL survived, and the APK's bundle is scanned for the host before install. The
  scanner was proven non-vacuous against a REAL leaked artifact and against
  synthetic stored/deflated archives, and its CLI exit code is asserted.
- **Could the coverage proof pass by omission?** A tag matching zero flows is
  refused BEFORE the target is touched (exit 2, `NOT_CERTIFIED`); a missing
  debug tree is `UNPROVEN`, not an assumed pass; a dropped or extra flow is a
  `MISMATCH`; a non-zero exit is a failure. The runner only reports `PASS` when
  the exit code is 0 AND the sets match exactly.
- **Is `--no-provision` still a hole?** It remains a documented use, but the
  report now carries `provisioned: false`, the on-device APK SHA-256, and a
  self-identifying note; the wording is a tested function, not prose.
- **Do the declarations match the artifact?** The guard reads the real merged
  manifest when a build exists and the committed list otherwise, and requires
  `app.json`'s declared four to be a subset. A synthetic manifest with a
  library-added permission fails the comparison.
- **Does the OS-backup claim survive a prebuild?** Verified in the regenerated
  `android/app/src/main/AndroidManifest.xml`: `android:allowBackup="false"` and
  `SYSTEM_ALERT_WINDOW tools:node="remove"`. No code path draws an OS overlay
  (the only "overlay" identifiers are in-app theme scrims).
- **Is the release posture honest?** Every claim in the new record is read back
  from the same sources by `tests/releaseBuildPosture.test.ts` (the generated
  `build.gradle` where it exists, the tracked config otherwise), and the record
  states there is no store-buildable artifact.
- **Can a test seam ship?** `scripts/release-profile-guard.mjs` fails for any
  non-`e2e-test` profile in `eas.json` and for the seam in `app.json`; it runs in
  `qa:fast`, and the test asserts the seam is still genuinely present on
  `e2e-test` so the guard cannot pass by the feature being deleted.
- **Product blast radius.** The only product files touched are the command
  feature's reachability decisions and two reason-code unions; no behavior
  changes for an ordinary build (Create is still the only mode it offers).

## Validation Ledger

| Date       | Command / source                                                                                                                   | Outcome                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-30 | APK scan of the 2026-09-24 artifact (`assets/index.android.bundle`)                                                                | FOUND THE DEFECT — `kruubbynsmxzxfdunaal.supabase.co` at offset 1136711 in the APK the lane reported as a credential-free `PASS` (method 0/STORED)                                                                                                                                                                                                                                    |
| 2026-09-30 | `npx expo prebuild --platform android --clean` (with `EXPO_NO_DOTENV=1`)                                                           | PASS — regenerated manifest carries `android:allowBackup="false"` and `SYSTEM_ALERT_WINDOW tools:node="remove"`                                                                                                                                                                                                                                                                       |
| 2026-09-30 | Coverage decision replayed against 59 archived Maestro debug trees                                                                 | PASS — 49 exact set matches; the other 10 are early-aborted runs whose non-zero exit is the real finding                                                                                                                                                                                                                                                                              |
| 2026-09-30 | `npx vitest run tests/nativeHermeticityAndCoverage.test.ts`                                                                        | PASS — 20/20 (envelope, refusal, fingerprint, live-project workstation, ZIP scan stored/deflated/clean/CLI, flow resolution, tag parsing, executed-set reader, coverage verdicts, binary note, wiring)                                                                                                                                                                                |
| 2026-09-30 | `npx vitest run tests/store-declaration-drift.test.ts tests/version-build-consistency.test.ts`                                     | PASS — 23/23 (built-manifest observation, synthetic manifest, library-addition non-vacuity, backup+overlay posture, full declaration inventory)                                                                                                                                                                                                                                       |
| 2026-09-30 | `npx vitest run tests/askDefaultOffSurface.test.ts`                                                                                | PASS — 7/7 (rendered surface, rollout build, persisted-mode restore, render-boundary wiring, provider lock, rollout control, no direct fetch)                                                                                                                                                                                                                                         |
| 2026-09-30 | `npx vitest run tests/releaseBuildPosture.test.ts`                                                                                 | PASS — 4/4 (seam confined to `e2e-test`, shared identity/version, debug-signed release config, unminified posture with resume actions)                                                                                                                                                                                                                                                |
| 2026-09-30 | `npm run release:profiles:guard`                                                                                                   | PASS — 3 release-candidate profiles, no seam outside `e2e-test`                                                                                                                                                                                                                                                                                                                       |
| 2026-09-30 | `npm run typecheck`                                                                                                                | PASS — 0 errors                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-30 | `npm run lint`                                                                                                                     | PASS — 0 errors, 0 warnings (`--max-warnings 0`)                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-30 | `npm run qa:fast` (pinned Node v22.23.2)                                                                                           | PASS — unit 167 files / 2029 tests; journey-label, quarantine-register, and release-profile guards OK                                                                                                                                                                                                                                                                                 |
| 2026-09-30 | `npm run qa:integration` (pinned Node v22.23.2)                                                                                    | PASS — 79 files / 386 tests passed, 1 file / 2 tests skipped (pre-existing)                                                                                                                                                                                                                                                                                                           |
| 2026-09-30 | `npm run openspec:validate --all`                                                                                                  | PASS — 68 passed / 0 failed                                                                                                                                                                                                                                                                                                                                                           |
| 2026-09-30 | `openspec validate harden-native-evidence-and-release-posture --type change --strict`                                              | PASS — change is valid                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-30 | `npm run qa:native:provision` / `--tag smoke` / persistence / lifecycle (5.3, 5.4)                                                 | NOT RUN — ENVIRONMENT, two causes. (1) The certification path requires a clean Git tree; this session's apply work is uncommitted by design and `requireCleanGitTree` refuses. (2) `emulator-5554` (pre-existing, not started here) times out on `adb shell getprop` (exit 124), and a second `Nitro_API_36` refuses to boot while it holds the AVD. Resume action in the checkpoint. |
| 2026-09-30 | Provisional hermetic Gradle release build (`EXPO_NO_DOTENV=1`, ambient `EXPO_PUBLIC_*` unset)                                      | PASS — `BUILD SUCCESSFUL in 7m 19s`, 608 actionable tasks; APK SHA-256 `F3D9A63C39589FCA3BD91BDDFCC1C6AB0AD43A2ADEDE50E2F3A502B143D961C5`                                                                                                                                                                                                                                             |
| 2026-09-30 | `node scripts/native-apk-scan.mjs` on that hermetic APK                                                                            | PASS — 1 JS/bytecode entry scanned, 0 Supabase hosts, where the 2026-09-24 artifact scanned POSITIVE for `kruubbynsmxzxfdunaal.supabase.co`                                                                                                                                                                                                                                           |
| 2026-09-30 | Merged manifest from that build (`merged_manifests/release/processReleaseManifest`)                                                | PASS — `android:allowBackup="false"`, zero `SYSTEM_ALERT_WINDOW` entries, 36 permissions                                                                                                                                                                                                                                                                                              |
| 2026-09-30 | `npx vitest run tests/store-declaration-drift.test.ts` against that REAL merge                                                     | CAUGHT A REAL ERROR, then PASS — the hand-transcribed list had 2 misnamed launcher permissions, 2 that do not exist, and missed 4 `com.android.launcher.permission.*` entries (34 vs the real 36). Corrected against the artifact; now 17/17 with the real merge as the source                                                                                                        |
| 2026-09-30 | `npx prettier --check` on every changed file of this change                                                                        | PASS — all clean                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-01 | `npm run qa:native:provision -- --serial emulator-5554` (clean worktree of `68db684`)                                              | PASS — `BUILD SUCCESSFUL in 6m 5s` (608 tasks); `Bundle scan: 1 JS/bytecode entry(ies), no Supabase host`; APK SHA-256 `5DF9D5DC72EF13B4B88DF32527244C50BD750D1C48EF79EB0CA3B6D2ADFA1014`; `Remote configuration recorded: none configured (local-only)`; exit 0                                                                                                                      |
| 2026-10-01 | `node scripts/qa-native.mjs --platform android --tag smoke --serial emulator-5554`                                                 | **1/2 — `FAILED_NEEDS_TRIAGE`.** `native-smoke` PASSED (1m 33s); `command-center-v2` FAILED (44s) on `tapOn: 'Create'` (`TEST_BUG`). `flowCoverage {verdict: MISMATCH, expected 2, executed 2, missing [], reason: "Maestro exited 1."}`, `provisioned: true`, `bundleScan 1/0`, `remoteConfiguration local-only`                                                                     |
| 2026-10-01 | `node scripts/qa-native.mjs --platform android --flow .maestro/flows/command-center-v2.yaml --serial emulator-5554 --no-provision` | FAILED again with `Element with Text matching regex: Create not found` — deterministic, not a flake (labelled not-current-source because `--no-provision` was used; the current-source run is the tag run above)                                                                                                                                                                      |
| 2026-10-01 | `node scripts/qa-native.mjs --platform android --tag persistence --serial emulator-5554`                                           | PASS — **11/11 flows in 16m 50s**, `flowCoverage.verdict: OK` (expected 11, executed 11), same APK SHA-256 and `local-only` remote                                                                                                                                                                                                                                                    |
| 2026-10-01 | `node scripts/qa-native.mjs --platform android --tag lifecycle --serial emulator-5554`                                             | PASS — **6/6 flows in 8m 39s**, `flowCoverage.verdict: OK` (expected 6, executed 6), same APK SHA-256 and `local-only` remote                                                                                                                                                                                                                                                         |
| 2026-10-01 | Reclaim of the orphaned `emulator-5554` (PID 56380)                                                                                | EXPLICIT DECISION — orphaned headless `Nitro_API_36`, 0 MB resident, 44 s CPU in 13 h, `adb shell` exit 124, holding the AVD lock. Killed by exact PID; stale locks removed; no unrelated process touched                                                                                                                                                                             |
| 2026-10-01 | Flow repair landed as `80b0b33` (`windows-closure-reconciliation` task 3)                                                          | PASS — platform-conditional step in `.maestro/flows/command-center-v2.yaml` (Android asserts `Command input` visible and `Ask`/`Auto` absent; iOS keeps `tapOn: 'Create'`), 8/8 new guard tests including a non-vacuous rejection of the reconstructed pre-fix step                                                                                                                   |
| 2026-10-01 | `npm run qa:native:provision -- --serial emulator-5554` (clean checkout of `80b0b33`)                                              | PASS — `BUILD SUCCESSFUL in 9m 45s`, 608 actionable tasks; `Bundle scan: 1 JS/bytecode entry(ies), no Supabase host`; APK SHA-256 `E2F43FBBE37FFA28D31EB3379DAB7C06B352EBF456748AF958D367245C3690D2`; remote `local-only`; installed on `emulator-5554`                                                                                                                               |
| 2026-10-01 | `node scripts/qa-native.mjs --platform android --tag smoke --serial emulator-5554` (at `80b0b33`)                                  | **PASS — 2/2 in 1m 29s.** `command-center-v2` PASSED (37 s, exercising the previously unproven example/parse/review/confirm steps) and `native-smoke` PASSED (53 s); `flowCoverage.verdict: OK` (expected 2, executed 2)                                                                                                                                                              |
| 2026-10-01 | `node scripts/qa-native.mjs --platform android --tag persistence --serial emulator-5554` (at `80b0b33`)                            | PASS — **11/11 in 13m 32s**, `flowCoverage.verdict: OK` (expected 11, executed 11), same APK SHA-256 and `local-only` remote                                                                                                                                                                                                                                                          |
| 2026-10-01 | `node scripts/qa-native.mjs --platform android --tag lifecycle --serial emulator-5554` (at `80b0b33`)                              | PASS — **6/6 in 7m 28s**, `flowCoverage.verdict: OK` (expected 6, executed 6), same APK SHA-256 and `local-only` remote                                                                                                                                                                                                                                                               |
| 2026-10-01 | `npx vitest run tests/store-declaration-drift.test.ts` inside the checkout holding the real `android/` build tree                  | PASS — 17/17 with the built-manifest limb read from the fresh merge (36 permissions, `allowBackup=false`, no `SYSTEM_ALERT_WINDOW`), not from the committed transcription                                                                                                                                                                                                             |

## Changed Files / Areas

- `app.json` — `expo.android.allowBackup: false` and
  `expo.android.blockedPermissions: ["android.permission.SYSTEM_ALERT_WINDOW"]`.
- `scripts/hermetic-build.mjs` (new) — `hermeticBuildEnv` (dotenv off, ambient
  `EXPO_PUBLIC_*` stripped and reported, Supabase names called out),
  `remoteEnvRefusal`, `runHermeticBuild`, `describeRemoteConfiguration` (endpoint
  plus anon-key fingerprint), `scanDirectoryForNeedle`.
- `scripts/build-dist-e2e.mjs` — now calls the shared envelope and scanner
  instead of its own copy.
- `scripts/native-apk-scan.mjs` (new) — dependency-free ZIP central-directory
  reader, per-entry inflate, `supabase.co` search, fail-loud CLI.
- `scripts/native-apk-scan.mjs` CLI used by `scripts/qa-native-provision.mjs` —
  bundle scan before install; provenance `remoteConfiguration`, `hermeticBuild`,
  and `bundleScan` fields; `schemaVersion: 2`.
- `scripts/native-flow-coverage.mjs` (new) — `parseFlowTags`, `listFlowFiles`,
  `resolveExpectedFlows` (non-empty, duplicate-free), `readExecutedFlows` (from
  Maestro's debug output), `evaluateFlowCoverage`, `describeBinaryEvidence`.
- `scripts/qa-native.mjs` — expected-flow resolution before the target is
  touched, coverage-gated `PASS`, `provisioned` / `installedApkSha256` /
  `binaryNote` / `flowCoverage` / `remoteConfiguration` / `bundleScan` in the
  report, on-device APK hashing, a build-match predicate that requires a recorded
  remote and a bundle scan, and the corrected remediation text.
- `scripts/qa-native-provision.mjs` — hermetic build env, loud refusal naming an
  ambient Supabase variable, pre-install bundle scan, remote/fingerprint record,
  `--force` removed.
- `scripts/native-avd.mjs` — `validateInstallOnlyMetadata` requires a recorded,
  coherent remote configuration.
- `scripts/release-profile-guard.mjs` (new) — rejects the native test seam on any
  non-`e2e-test` profile and in `app.json`.
- `package.json` — `release:profiles:guard` script; the guard added to `qa:fast`.
- `features/command/commandSurface.ts` (new) — the rendered surface as a pure
  function of the rollout flag.
- `features/command/ModeToggle.tsx`, `features/command/CommandScreen.tsx` —
  consume the surface (mode options, view reachability, persisted-mode restore).
- `features/command/askParser.ts`, `features/command/types.ts`,
  `features/command/ask.types.ts` — provider-side lock and the
  `rollout_disabled` reason code.
- `docs/release/release-signing-posture.md` (new) — signing, identity, and
  minification posture as unproven, with a resume action per item.
- `docs/release/app-store-readiness.md` — built permission inventory by origin,
  the blocked overlay, and the backup posture.
- `docs/release/privacy-policy.md`, `public/privacy.html` — OS-level backup and
  device-to-device transfer stated truthfully.
- `docs/release/store-data-declarations.md` — new §2a for OS backup, transfer,
  and the artifact-verification action.
- `tests/nativeHermeticityAndCoverage.test.ts` (new),
  `tests/releaseBuildPosture.test.ts` (new), `tests/askDefaultOffSurface.test.ts`
  (new), `tests/store-declaration-drift.test.ts`, `tests/nativeAuthMock.test.ts`,
  `tests/askParser.test.ts`, `tests/autoModeRouter.test.ts`.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the change's
   `proposal.md` / `design.md` / `specs/` / `tasks.md`.
2. `git status --short` and `git diff --stat`; reconcile this checkpoint against
   the real tree.
3. Re-run `npx vitest run tests/nativeHermeticityAndCoverage.test.ts
tests/store-declaration-drift.test.ts tests/askDefaultOffSurface.test.ts
tests/releaseBuildPosture.test.ts` and `npm run qa:fast`.
4. If the tree is clean and a responsive API 36 x86_64 emulator is booted, run
   the device leg exactly as the checkpoint's resume action states.

## Outcomes & Retrospective

- Status: COMPLETED — 26/26 tasks checked. Implementation, non-device validation, and the device leg are all green at the current source, with the flow repair owned by the linked successor and verified on the exact committed candidate.
- Summary: a native `PASS` now requires a hermetic build whose provenance names
  its remote (or says there is none), an APK whose bundle was scanned before
  install, a flow set that was actually executed, and a named binary — proven on
  a real build, where the same scanner that caught the previous artifact's live
  host reports a clean one. The release configuration no longer offers the local
  database to OS-level backup and no longer requests a permission the
  declarations do not cover; a test-only seam cannot ship; and Ask/Auto
  default-off is enforced at the render boundary and at the provider, with
  coverage that fails if either regresses while the flag constant stays false.
  The last red lane — the stale `command-center-v2` smoke step — was classified
  `TEST_BUG`, repaired platform-conditionally without touching product code or
  iOS semantics, guarded non-vacuously, and re-run green on the current-source
  hermetic APK (smoke 2/2, persistence 11/11, lifecycle 6/6).
- Proof: the validation ledger above, ending with the three green tag reports at
  APK SHA-256 `E2F43FBB…C3690D2` in
  `simulation-output/native/windows-closure-2026-10-01/`.
- Follow-up: archive this change into `openspec/specs/` when the user invokes the
  OpenSpec archive step. Owner actions that stay owner-gated: the production
  upload key, the Play permission answers against the real artifact, and the
  release-signing decisions in `docs/release/release-signing-posture.md`.
