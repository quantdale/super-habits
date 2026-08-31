# Native real-user E2E

The native layer is a small complement to the web QA system, not a second copy
of the 181-test Playwright suite:

```text
Vitest → domain correctness
real SQLite → persistence and constraints
Playwright → deep web/PWA behavior
simulation → deterministic and seeded web stress
Maestro → built native app, lifecycle, platform reality
```

## Workspace and flows

The committed workspace is `.maestro/`. Flows are independently runnable and
use visible text/accessibility labels, `extendedWaitUntil`, state-based
scrolling, and explicit app lifecycle operations. They contain no arbitrary
sleeps or raw absolute-coordinate taps. The Calories footer uses an indexed
semantic selector with a relative point only to keep the matched control above
the Android API-36 navigation-bar boundary.

| Flow                                    | Tags                                                              | Proof                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `native-smoke.yaml`                     | `native`, `smoke`                                                 | Native launch, all six sections, Settings open/close                                     |
| `todo-persistence.yaml`                 | `native`, `persistence`, `todos`                                  | Create a todo, terminate, relaunch, verify it remains                                    |
| `habit-persistence.yaml`                | `native`, `persistence`, `habits`                                 | Create/increment a habit, terminate, relaunch, verify count                              |
| `habit-schedule-persistence.yaml`       | `native`, `persistence`, `habits`, `habit-v2`                     | Create an M/W/F habit, terminate, relaunch, verify the schedule remains                  |
| `habit-reminder-persistence.yaml`       | `native`, `persistence`, `notifications`, `habits`, `habit-v2`    | Create an M/W/F reminder, terminate, relaunch, verify schedule/time/configuration        |
| `habit-reminder-disable.yaml`           | `native`, `persistence`, `notifications`, `habits`                | Disable a reminder and verify it stays off after relaunch                                |
| `habit-reminder-permission-denied.yaml` | `native`, `persistence`, `notifications`, `habits`                | Denied permission is visible and does not enable a reminder                              |
| `habit-reminder-isolation.yaml`         | `native`, `persistence`, `notifications`, `habits`, `pomodoro`    | Two reminders remain independent; delete one; Pomodoro lifecycle still works             |
| `habit-reminder-delivery.yaml`          | `native`, `lifecycle`, `notifications`, `habit-reminder-delivery` | Test-build-only near-term schedule, background, and process termination                  |
| `habit-reminder-actions.yaml`           | `native`, `lifecycle`, `notifications`, `habit-reminder-actions`  | Exact-habit tap, Mark complete, Snooze, and configured-time preservation                 |
| `habit-reminder-actions-replay.yaml`    | `native`, `lifecycle`, `notifications`, `habit-reminder-replay`   | Mark complete replay after kill/relaunch remains exactly once                            |
| `calories-persistence.yaml`             | `native`, `persistence`, `calories`                               | Create a calorie entry and verify it after relaunch                                      |
| `workout-persistence.yaml`              | `native`, `persistence`, `workout`                                | Create a routine/exercise and verify the routine after relaunch                          |
| `workout-gym-v2-persistence.yaml`       | `native`, `persistence`, `workout`, `gym-v2`                      | Custom catalog exercise, typed prescription, and weekly plan survive relaunch            |
| `workout-gym-v2-session-lifecycle.yaml` | `native`, `lifecycle`, `workout`, `gym-v2`                        | Typed measurement and durable active-session draft resume after force-stop               |
| `settings-persistence.yaml`             | `native`, `persistence`, `settings`                               | Change theme mode and verify it after relaunch                                           |
| `pomodoro-lifecycle.yaml`               | `native`, `lifecycle`, `pomodoro`                                 | Start, background, foreground, and reset a running timer                                 |
| `pomodoro-notification-path.yaml`       | `native`, `lifecycle`, `notifications`, `pomodoro`                | Grant notification permission, start native timer scheduling path, background/foreground |

Gym V2 keeps the legacy free-text path covered by the original Workout
persistence flow and adds a focused native layer for the higher-risk platform
contracts: custom/catalog identity, typed prescription persistence, weekly
planning, and durable active-session resume. The full catalog, modality,
progression, body-weight, and history matrix remains in
`e2e/workout-gym-v2.spec.ts` and the real-SQLite suites; native flows stay small
and lifecycle-focused rather than duplicating that matrix.

Run the workspace directly when Maestro is installed:

```bash
maestro test .maestro --include-tags=smoke
maestro test .maestro --include-tags=persistence
```

The repository runner is preferred because it checks prerequisites and records
replay context:

```bash
npm run qa:native:android
npm run qa:native:lifecycle
npm run qa:native:ios
node scripts/qa-native.mjs --platform android --flow .maestro/flows/native-smoke.yaml
```

On the documented Windows Android lane, the runner selects the single booted
API-36 x86_64 target, checks its package/provenance identity, and automatically
builds and installs the current credential-free `e2e-test` equivalent when the
APK is missing or stale. Native certification is fail-closed when Git cannot
prove a clean checkout of the source SHA.

```bash
npm run qa:native:provision -- --serial <serial>
npm run qa:native:android -- --serial <serial>
npm run qa:native:targeted -- --serial <serial>
npm run qa:native:lifecycle -- --serial <serial>
# Use --no-provision only when deliberately checking an already-installed build.
node scripts/qa-native.mjs --platform android --tag smoke --serial <serial> --no-provision
# Requires an e2e-test/native build with EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST=true.
node scripts/qa-native-delivery.mjs
```

The local Android provisioner runs Expo prebuild with
`EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST=true`, assembles the x86_64 release APK
without production credentials, installs it on the verified serial, and writes
ignored provenance metadata under `simulation-output/native/`. The metadata
records the source SHA, `sourceTreeClean`, target serial/API/ABI/AVD, package
identity, build timestamp, and APK SHA-256; the provisioner rechecks cleanliness
after prebuild and Gradle. `git status --porcelain` omits intentionally ignored
generated output, but tracked or relevant untracked source changes block the
build with a remediation message. Missing Maestro, `adb`, Xcode/simctl, a
booted target, or a supported API-36 x86_64 target returns `ENVIRONMENT` with a
replay command and focused JSON report; it is not reported as a pass. EAS
remains the cloud build/install path for iOS.

## Nitro validation evidence (2026-08-10)

The Windows Nitro workstation has a working local Android lane:

- JDK 17, Android SDK/platform tools, API-36 x86_64 default system image, and
  the `Nitro_API_36` AVD with hardware acceleration are available.
- Maestro 2.8.0 is installed and the credential-free local release APK for
  the `e2e-test` package (`com.dale16.superhabits`) was built, installed, and
  launched successfully. This is the Windows-supported local equivalent of
  the EAS profile; the EAS local-build command itself remains a macOS/Linux
  capability.
- Build details: the generated Expo Android project was assembled for
  `x86_64` with the installed Android SDK/NDK toolchain. The historical build
  needed a C++ shared-runtime linker correction in generated/dependency inputs;
  the 2026-08-13 stabilization made that correction reproducible through the
  committed Expo prebuild plugin and patch-package patches described below.
- The first Codex shell could not resolve Maestro because the long-running
  process retained a stale PATH even though the official launcher existed in
  the persisted Windows user PATH. `scripts/qa-native.mjs` now probes that
  persisted user PATH and supports `.bat`/`.cmd` launchers without committing
  a machine-specific path.
- `npm run qa:native:android` passed. The aggregate targeted lane passed 6/6
  persistence flows, including the scheduled M/W/F flow, and the lifecycle
  lane passed 2/2 Pomodoro flows.
- Every committed Android flow has executed successfully in the focused
  lanes. Smoke, Todo persistence, and Pomodoro lifecycle were rerun after the
  target stabilized and passed again. Reports are retained under
  `simulation-output/native/` and Maestro artifacts under the user Maestro
  test directory.

### Proven on Nitro

Native launch/navigation, SQLite-backed Todo, scheduled and daily Habit,
Calories, Workout, and
Settings persistence across process termination, Pomodoro background/foreground
state, notification permission setup, and the native notification scheduling
path. Habit reminder persistence/permission/isolation flows are part of the
current-source validation for this change.

### Cloud-only or not run locally

iOS native execution remains cloud-only on Nitro. `npm run qa:native:ios`
correctly reports `ENVIRONMENT` because Windows has no Xcode `xcrun/simctl`.
The EAS workflow remains the executable iOS path and was not claimed as a
local pass.

### Remaining unproven

The scheduled flow proves schedule persistence but does not mutate the Android
system clock to prove a date-specific off-day card; deterministic off-day
semantics remain covered by domain, timezone, and web clock lanes. The
notification-path flow does not prove delivery by itself. The separate
test-build-only delivery flow now proves a short-horizon Android local
notification: after a 20-second one-shot trigger and app process termination,
`adb shell dumpsys notification` observed the expected package, title, body,
deterministic test identity, and `habit-reminders` channel. Report:
`simulation-output/native/habit-reminder-delivery-2026-08-12T090401052Z.json`
(`VERIFIED`). A visual notification-shade interaction was not automated, so
that presentation layer remains unasserted. The 14-day production window has
not been accelerated on-device; long-horizon recurrence, long-running
background timer completion after process death, focused native `Alert.alert`
confirmation coverage, deterministic Android system offline / reconnect
toggling, and platform-specific performance remain unproven.

### Nitro reminder validation evidence (2026-08-12)

The current-source Android release APK was assembled for the API-36 x86_64
emulator after a workstation-only, ignored `-lc++_shared` correction in
dependency CMake inputs. No such generated dependency edit is part of the
product change. The installed APK contains the test-only delivery hook and
passed these sequential lanes:

- `npm run qa:native:targeted` — 10/10 persistence flows, including reminder
  persistence, disablement, denied permission, schedule-aware configuration,
  multi-habit isolation, and Pomodoro isolation. Report:
  `simulation-output/native/native-android-persistence-2026-08-12T094838933Z.json`.
- `npm run qa:native:lifecycle` — 3/3 flows, including the reminder delivery
  path and both Pomodoro lifecycle/notification paths. Report:
  `simulation-output/native/native-android-lifecycle-2026-08-12T095008203Z.json`.
- `node scripts/qa-native.mjs --platform android --flow .maestro/flows/native-smoke.yaml`
  — the direct smoke reproduction passed all section and Settings assertions.
  Report:
  `simulation-output/native/native-android-all-2026-08-12T095324942Z.json`.
- `node scripts/qa-native-delivery.mjs` — `VERIFIED`; Android's notification
  manager observed the test notification after app termination. Report:
  `simulation-output/native/habit-reminder-delivery-2026-08-12T090401052Z.json`.

One preceding aggregate smoke attempt failed with a Maestro device-server
heartbeat-file lock, and a later aggregate attempt transiently missed the
reverse-swipe `Start focus` assertion; the unchanged flow passed when replayed
directly. These are retained as `FLAKY_TEST` harness evidence, not suppressed
or weakened product assertions. `npm run qa:native:ios` remains an expected
`ENVIRONMENT` block on Windows because Xcode `xcrun/simctl` is unavailable.

### Habit Reminders V2 action evidence (2026-08-12)

The rebuilt current-source Android APK passed these same-path response probes
on `Nitro_API_36`:

- `habit-reminder-actions.yaml` passed exact ID-based body-tap routing into
  the existing Habit edit interaction, one canonical target-one completion
  with the mounted card refreshed to `1 of 1`, and Snooze scheduling while the
  configured reminder remained `18:00`.
- `habit-reminder-actions-replay.yaml` passed Mark complete, process kill,
  relaunch, and replay of the same response through the production response
  bridge; the card remained `1 of 1`.
- `node scripts/qa-native-delivery.mjs` remained `VERIFIED`: Android's
  notification manager observed the real scheduled reminder after the app was
  backgrounded and terminated.

### Current-source notification shade proof (2026-08-13)

The current-source APK was rebuilt and installed after the CMake/libc++ fix.
For a fresh delivered reminder, Android System UI hierarchy inspection exposed
semantic `Mark complete` and `Snooze` actions. Activating `Mark complete` cold-
started the app, routed the exact habit, and produced one completion; repeating
the same response left the count at one. Activating `Snooze` on a second fresh
delivery produced one replacement alarm approximately 15 minutes ahead in
`dumpsys alarm`. Coordinate activation was used only after semantic discovery
at the System UI boundary; no app-content selector was coordinate-only.

The current-source Android Insights flow also passed: an exact habit opened its
Progress modal, exposed current/longest streak, scheduled completion rate,
recent target-vs-actual history and semantic labels, then closed and reopened
successfully. The flow is `.maestro/flows/habit-progress-insights.yaml`.

### Current-source Android CMake stabilization evidence (2026-08-13)

The clean current-source build initially failed in `react-native-worklets` and
then in generated application codegen targets with unresolved libc++ symbols
(`std::__ndk1`, `operator new/delete`, `std::bad_alloc`, `__cxa_*`, RTTI, and
thread symbols). The installed CMake Android toolchain accepted
`ANDROID_STL=c++_shared` but omitted `libc++_shared` from the shared-library
link rules; changing CMake versions alone did not change that behavior.

The portable correction is now applied during every install/prebuild:

- `plugins/withAndroidCxxRuntime.js` adds
  `-DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared` to the generated application
  `defaultConfig.externalNativeBuild` arguments.
- Patch-package patches add the same explicit linker input to the six native
  dependency CMake configurations that build in this app.

After `npm ci`, clean Expo prebuild, and x86_64 release builds from generated
native state, two independent builds passed on Nitro with NDK
`27.1.12297006` and the default installed CMake `3.22.1`. The Gradle/CMake
clean task itself can fail when asked to clean and assemble in one invocation
because it removes generated codegen directories before native reconfiguration;
the validated procedure regenerates Android with Expo, verifies no APK exists,
and then runs the standalone assemble command.

The action flows use a test-only response injection that enters the same
central dispatcher used by the Expo notification listener and cold-start
recovery. Category registration and actual Android posting are exercised by
the installed APK. The separate current-source shade proof above additionally
used Android System UI semantic discovery to activate both real actions. The
real SQLite suite separately proves target-greater-than-one,
concurrent/restart replay, Linked Actions, duplicate Snooze,
deletion/schedule races, and local-midnight guards.

## Build and cloud path

`eas.json` contains the credential-free `e2e-test` profile: Android produces an
APK and iOS produces a simulator build. `.eas/workflows/native-e2e.yml` builds
both platforms and runs the focused flows through EAS Maestro. It is triggered
manually or by the explicit `native-e2e` pull-request label, so ordinary web PRs
remain practical. The workflow does not submit or publish an app.

## Lifecycle and notification boundaries

The Pomodoro lifecycle flow verifies the running native UI through a real
background/foreground transition and the notification-path flow verifies that
the native permission/scheduling path is entered. The separate delivery probe
is the only lane that can claim actual Android delivery, and it must retain its
JSON report. The current probe verifies posting to Android's notification
manager after process termination; visual shade interaction and iOS tray
delivery remain unproven on Nitro/Windows. The product's documented
no-resume-after-process-death behavior is not invented as a requirement here.

Maestro does not replace the web failure-injection lane for system-level offline
toggling. Native local-first behavior should be tested on a device when a
supported network-control mechanism is selected; the current deterministic
offline/reconnect contract remains covered by Playwright and simulation.

## Failure handling

Native reports include platform, app ID, tag/flow, target, Git SHA when
available, replay command, status, and runner output. A failed flow is
`FAILED_NEEDS_TRIAGE`, not automatically `FLAKY_TEST` or `PRODUCT_BUG`.

Preserve the report and rerun its replay command, then classify with the same
vocabulary as web QA: `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`,
`EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY`. EAS Maestro artifacts and screenshots
belong with the corresponding workflow run.

## Platform responsibilities

- Android smoke and targeted lifecycle flows are the practical local gate when
  an emulator/device and E2E APK are available.
- iOS uses a macOS simulator locally or the EAS workflow; Windows development
  does not claim iOS execution.
- Cross-platform native success is reported only when both platform runs have
  actually executed. An unavailable platform is `EXTERNAL BLOCKER` or `NOT RUN`.
