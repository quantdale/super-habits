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

| Flow                              | Tags                                               | Proof                                                                                    |
| --------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `native-smoke.yaml`               | `native`, `smoke`                                  | Native launch, all six sections, Settings open/close                                     |
| `todo-persistence.yaml`           | `native`, `persistence`, `todos`                   | Create a todo, terminate, relaunch, verify it remains                                    |
| `habit-persistence.yaml`          | `native`, `persistence`, `habits`                  | Create/increment a habit, terminate, relaunch, verify count                              |
| `habit-schedule-persistence.yaml` | `native`, `persistence`, `habits`, `habit-v2`      | Create an M/W/F habit, terminate, relaunch, verify the schedule remains                  |
| `calories-persistence.yaml`       | `native`, `persistence`, `calories`                | Create a calorie entry and verify it after relaunch                                      |
| `workout-persistence.yaml`        | `native`, `persistence`, `workout`                 | Create a routine/exercise and verify the routine after relaunch                          |
| `settings-persistence.yaml`       | `native`, `persistence`, `settings`                | Change theme mode and verify it after relaunch                                           |
| `pomodoro-lifecycle.yaml`         | `native`, `lifecycle`, `pomodoro`                  | Start, background, foreground, and reset a running timer                                 |
| `pomodoro-notification-path.yaml` | `native`, `lifecycle`, `notifications`, `pomodoro` | Grant notification permission, start native timer scheduling path, background/foreground |

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

The local runner does not build or install an app. Install the `e2e-test`
profile build on a booted target first. Missing Maestro, `adb`, Xcode/simctl,
a booted target, or the installed app returns `ENVIRONMENT` and a focused JSON
report under `simulation-output/native/`; it is not reported as a pass.

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
  `x86_64` with CMake 3.30.5. The successful local build also needed a C++
  shared-runtime linker correction in generated/dependency inputs; those
  workstation-only changes were not committed. Recheck this toolchain detail
  before treating a clean-machine rebuild as portable.
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
path.

### Cloud-only or not run locally

iOS native execution remains cloud-only on Nitro. `npm run qa:native:ios`
correctly reports `ENVIRONMENT` because Windows has no Xcode `xcrun/simctl`.
The EAS workflow remains the executable iOS path and was not claimed as a
local pass.

### Remaining unproven

The scheduled flow proves schedule persistence but does not mutate the Android
system clock to prove a date-specific off-day card; deterministic off-day
semantics remain covered by domain, timezone, and web clock lanes. The
notification-path flow does not prove system notification-tray delivery.
Long-duration/background timer completion after process death, focused native
`Alert.alert` confirmation coverage, deterministic Android system offline /
reconnect toggling, and platform-specific performance remain unproven.

## Build and cloud path

`eas.json` contains the credential-free `e2e-test` profile: Android produces an
APK and iOS produces a simulator build. `.eas/workflows/native-e2e.yml` builds
both platforms and runs the focused flows through EAS Maestro. It is triggered
manually or by the explicit `native-e2e` pull-request label, so ordinary web PRs
remain practical. The workflow does not submit or publish an app.

## Lifecycle and notification boundaries

The Pomodoro lifecycle flow verifies the running native UI through a real
background/foreground transition and the notification-path flow verifies that
the native permission/scheduling path is entered. These are not claims that a
notification appeared in the tray/notification center or that a timer completed
after a process was killed. Those assertions require a stable Android/iOS
device-lab mechanism and remain capability gaps. The product's documented
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
