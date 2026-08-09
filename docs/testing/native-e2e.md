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
use visible text/accessibility labels, `extendedWaitUntil`, and explicit app
lifecycle operations. They contain no arbitrary sleeps or coordinate taps.

| Flow                              | Tags                                               | Proof                                                                                    |
| --------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `native-smoke.yaml`               | `native`, `smoke`                                  | Native launch, all six sections, Settings open/close                                     |
| `todo-persistence.yaml`           | `native`, `persistence`, `todos`                   | Create a todo, terminate, relaunch, verify it remains                                    |
| `habit-persistence.yaml`          | `native`, `persistence`, `habits`                  | Create/increment a habit, terminate, relaunch, verify count                              |
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
