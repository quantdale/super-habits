# W16 — Android API-36 current-source native qualification

## Verdict

**PASS on the local `Nitro_API_36` target** for the exact integrated source
`b50034d1c30ce1ff60fe6c1c2ff44f4f68a3d438`, with all six qualifying lanes green
and a fully source-authenticated, credential-free APK. iOS remains
**owner-deferred** (not run, not inferred).

## Exact-source provenance

| Field             | Value                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Source SHA        | `b50034d1c30ce1ff60fe6c1c2ff44f4f68a3d438`                                                                                                    |
| Source tree       | clean (`sourceTreeClean: true`, `sourceTreeStatus: []`)                                                                                       |
| Build kind        | `canonical` (credential-free E2E equivalent, test-only flag `EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST=true`)                                       |
| Hermetic envelope | dotenv blocked (`EXPO_NO_DOTENV=1`); bundle scan for `supabase.co`: **0 matches**                                                             |
| App id / version  | `com.dale16.superhabits` / `1.0.0` (1)                                                                                                        |
| APK SHA-256       | `AA89D9FE84AC3B33ADBE75455EB31A6BC09247F39E7B89E35BA945D60EEC2E0E`                                                                            |
| APK path          | `android/app/build/outputs/apk/release/app-release.apk`                                                                                       |
| Target            | serial `emulator-5594`, **API 36**, **ABI x86_64**, AVD `Nitro_API_36`                                                                        |
| Build commands    | `npx expo prebuild --platform android --clean` → `gradlew app:assembleRelease --no-daemon --no-build-cache -PreactNativeArchitectures=x86_64` |
| Install           | `adb -s emulator-5594 install -r -d -g <apk>`                                                                                                 |
| Provenance file   | `docs/ui-ux/v3-audit/w16/native-android-build.json`                                                                                           |

The runner refuses to certify a mismatched target: `checkTarget()` blocks unless
the device reports API `36` **and** ABI `x86_64`, and a later block rejects an
installed build whose source SHA does not equal `HEAD`. Both guards fired during
this wave (an API-35 AVD and a stale APK were each rejected), which is how the
provenance claim below is earned rather than asserted.

## Environment

| Component     | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| Host          | Windows 11, Android SDK `%LOCALAPPDATA%\Android\Sdk`           |
| Emulator      | `emulator 37.1.11.0`, `-gpu host` (see the blocker note below) |
| System image  | `system-images;android-36;default;x86_64`                      |
| Java / Gradle | Temurin JDK 17; Gradle 9.0.0 via the project wrapper           |
| Maestro       | 2.9.0                                                          |
| ADB           | platform-tools, device `emulator-5594`                         |

**Environment blocker during provisioning (resolved):** the `Nitro_API_36` AVD
segfaulted on every launch with `-gpu swiftshader_indirect` (and on launch with
`-gpu off`/`auto`), while the pre-existing API-35 AVD on the same host ran fine.
Rebuilding the AVD from the same system image reproduced it, ruling out a corrupt
AVD; the crash log shows `Failed to load opengl32sw`. The fix was `-gpu host`
(the mode the working sibling AVD uses), after which the AVD boots and reports
`Nitro_API_36`/API 36/x86_64. Two of the campaign's own stray `Nitro_API_36`
emulator processes were terminated by explicit PID; the unrelated
`braintraining-ui35` emulator (PID 44452) was never touched.

## Executed lanes (all at source `b50034d`)

| Lane            | Command                                                                            | Result                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provision       | `node scripts/qa-native-provision.mjs --serial emulator-5594`                      | **PASS** — APK built, installed, provenance recorded                                                                                                                        |
| smoke           | `node scripts/qa-native.mjs --platform android --tag smoke --serial emulator-5594` | **2/2 PASS** (`native-smoke`, `command-center-v2`)                                                                                                                          |
| persistence     | `… --tag persistence …`                                                            | **11/11 PASS** (`calories`, `habit`, `habit-schedule`, `habit-reminder-{persistence,disable,isolation,permission-denied}`, `settings`, `todo`, `workout`, `workout-gym-v2`) |
| lifecycle       | `… --tag lifecycle …`                                                              | **6/6 PASS** (`habit-reminder-{actions,actions-replay,delivery}`, `pomodoro-lifecycle`, `pomodoro-notification-path`, `workout-gym-v2-session-lifecycle`)                   |
| reward          | `… --tag reward …`                                                                 | **1/1 PASS** (`gamification-reward`)                                                                                                                                        |
| backup-v2       | `… --tag backup-v2 …`                                                              | **1/1 PASS** (`backup-v2-settings`)                                                                                                                                         |
| portable-backup | `… --tag portable-backup …`                                                        | **2/2 PASS** (`portable-backup`, `portable-backup-blocked`)                                                                                                                 |

Raw machine-readable reports: `docs/ui-ux/v3-audit/w16/native-reports/`.

## Core shell and navigation coverage (the §16.1 matrix)

| Requirement                                            | Evidence                                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Cold launch from the installed APK to Today            | `native-smoke` (launch → `Today` → `Plan today`)                                                                                  |
| All six destinations, correct selected tab             | `native-smoke` taps Today/To Do/Habits/Focus/Workout/Calories through the `Section tabs` landmark                                 |
| Quick Capture entry, modal close/back, keyboard return | `command-center-v2` (Quick capture → Add something → Describe it → close)                                                         |
| Settings open/close                                    | `native-smoke` (`Open settings` → `Close settings`)                                                                               |
| Modal + keyboard form                                  | `calories-persistence` (Manual add form with the soft keyboard)                                                                   |
| Background/foreground + process kill/relaunch          | `habit-reminder-*`, `pomodoro-lifecycle`, `workout-persistence`, `workout-gym-v2-session-lifecycle` (all `killApp` → `launchApp`) |
| Persistence after restart (real SQLite)                | all 11 persistence flows                                                                                                          |
| Theme persistence                                      | `settings-persistence`                                                                                                            |

## Defects found and fixed

Every failure below was reproduced on the exact-source build, classified, fixed
at its owning surface, and re-verified on-device. Eight were test/flow defects
caused by earlier waves' restructures; one was a genuine accessibility gap.

### N-1 — Native-only P2: bottom-nav labels truncated (PRODUCT, fixed)

Measured on-device at 1080×2400 / density 420: each destination has a 146px
(≈55.6dp) slot, yet the labels rendered as `Tod…`, `To …`, `Habi…`, `Worko…`,
`Calori…` — see `native-02-navbar-crop.png`. The accessibility names were always
complete, so this was pure text clipping, and web at 360px renders the same
labels in full. Android's Nunito metrics are wider than the web build's, so
`numberOfLines={1}` ellipsised. Fix: the label uses the full slot width
(`alignSelf: 'stretch'` + `textAlign: 'center'`). Verified in
`native-11-navbar-light.png`: all six labels render completely.

### N-2 — Accessibility gap: weekly-plan day and assignment unlinked (PRODUCT, fixed)

`WeekStripRow` rendered the weekday and its assignment as sibling text nodes, so
assistive tech read "Mon" and a routine name with nothing relating them, and the
assignment was not assertable. The assignment now carries
`accessibilityLabel={`${weekday}: ${assignment}`}`. Additive; visual output
unchanged.

### Flow-selector defects (TEST, all fixed)

Several native flows still asserted copy that W6–W13 had deliberately removed,
and two asserted values on the wrong surface. None was a product defect; none
was weakened.

| Flow                                                                                   | Defect                                                                                                                                                                                                                                         | Fix                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `native-smoke`                                                                         | `Offline-first task manager.` (W6), `Anytime` (W7), Workout onboarding copy (W9), `2000 kcal left` (W10 unformatted)                                                                                                                           | `Todos`, `DAILY CHECK-IN`, `QUICK START`, `2,000 kcal left`                                                                                                                                                         |
| `command-center-v2`                                                                    | `Command input` card header (W13)                                                                                                                                                                                                              | field label `Command`                                                                                                                                                                                               |
| `calories-persistence`                                                                 | W10 doc subtitle, `Logged today` heading, unformatted kcal                                                                                                                                                                                     | view switcher, saved entry name, `1,630 kcal left`                                                                                                                                                                  |
| `habit-schedule-persistence`, `habit-reminder-{persistence,isolation,disable,actions}` | asserted schedule/reminder on the _list row_, which shows the rest-day variant on any non-scheduled weekday                                                                                                                                    | open the habit detail → `Settings` tab, which is date-independent; assert `Mon / Wed / Fri` and the real single-node caption `Current schedule · Reminder 18:00`; re-open the detail after the edit modal closes it |
| `workout-persistence`, `workout-gym-v2-*`                                              | scrolled DOWN for a routine that is prepended ABOVE the create form; tapped a non-existent `Monday <routine>` label; `Week` / `Your routines` / `Complete set` / `Weight input` / `Workout in progress` / `Recent sessions` all stale or gated | scroll UP; open the day assign sheet and pick the routine chip; `This week`, `QUICK START`, `Complete set 1`, `Weight`/`Reps`, `Session in progress`, expand `History and insights`                                 |
| `gamification-reward`                                                                  | asserted an off-screen hint after W13 inserted the milestone block above it                                                                                                                                                                    | bounded scroll first                                                                                                                                                                                                |
| `backup-v2-settings`, `portable-backup*`                                               | fixed four-swipe approach overshot the shortened (W13) Backup section                                                                                                                                                                          | two bounded swipes + `scrollUntilVisible`                                                                                                                                                                           |

## Preserved contracts

- No `core/db`, `core/sync`, `core/backup`, `core/portable` semantics change; no
  schema, migration, dependency or security-policy change.
- No production Supabase mutation; the build is credential-free (0 hosts).
- Both P2/a11y product fixes are presentational/additive and were verified by
  re-running their affected flows on a freshly built exact-source APK.
- Every flow assertion was replaced with a currently-rendered, unique marker;
  where the oracle changed, it became stricter (the durable habit detail view
  instead of date-dependent list text).

## Residuals

| Residual                                                 | Status                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| iOS native qualification                                 | **owner-deferred** — not run, never inferred from Android/web                                                                  |
| Notification-tray delivery, long-horizon recurrence      | **capability gap** — `habit-reminder-delivery` covers the test-build near-term schedule path only (unchanged from prior waves) |
| `Alert.alert` native confirmation, system offline toggle | **capability gap** (unchanged)                                                                                                 |
| AVD `-gpu host` requirement on this host                 | environment note; recorded above and in the W16 plan                                                                           |

## iOS policy

No iOS simulator or cloud lane was provisioned. The `.eas/workflows/native-e2e.yml`
cloud path requires an EAS-linked repository and a plan permitting Maestro jobs,
neither of which was verified as available here; it was therefore **not run**.
No iOS result is claimed.
