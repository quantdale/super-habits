# NATIVE-CERTIFICATION — PR #79 final convergence (2026-10-15)

## A. Android — `ANDROID_NOT_RUN / ENVIRONMENT_BLOCKED`

**No exact-source Android qualification is claimed.** The PR's habit-editor footer
fix and the two Maestro flow edits remain **web-proven and flow-hardened only** —
the same honest status the register carried before this campaign, now with a
documented, bounded investigation of _why_ device re-qualification is not possible
on this host right now.

### Device-ownership forensics (2026-10-15, read-only first)

| Device          | AVD                  | Started                       | State                                                                | Ownership                                |
| --------------- | -------------------- | ----------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| `emulator-5570` | `braintraining-ui35` | 2026-10-13 20:52 (host local) | `device`; `sys.boot_completed=1`; `adb shell` **responds instantly** | FOREIGN — never touched by this campaign |
| `emulator-5594` | (sdk_phone64_x86_64) | 2026-10-14 02:43              | `device`                                                             | FOREIGN — never touched                  |

- ADB server: single shared server on 5037 (adb 37.0.0). Verified healthy:
  `adb -s emulator-5570 shell getprop` returns immediately.
- `adb emu ...` console commands hang: the newer emulator requires an
  `~/.emulator_console_auth_token` (written into each AVD dir at first boot).
  This explains the earlier session's "`adb emu avd name` hung" note — it is an
  auth gate, not a hung daemon.
- An isolated second server (`adb -L tcp:5039`) was tested for a possible
  campaign-owned path: it reaches the foreign device fine, confirming the default
  server itself is not wedged.

### Campaign-owned emulation attempts (all on a disposable clone `campaign-api36`

[config copied from the repo's own `Nitro_API_36`, API 36 x86_64, pixel_7],
fresh ports, `-no-snapshot`, headless; every attempt logged to
`simulation-output/campaign-emulator-*.log`, gitignored; clone removed afterwards)

| #   | Configuration                                                 | Result                                                                                                                                                                                     |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | full lean clone, `hw.ramSize=1536M`, port 5576                | qemu spawned; guest consumed ~142s CPU then **idle-wedged mid-boot** (no further CPU, no `boot_completed`, adbd transport half-open: `adb shell` hangs while `adb devices` shows `device`) |
| 2   | + `initrd` copy + `hw.ramSize=1024M`                          | emulator launcher **access violation 0xC0000005** (exit -1073741819) right after WHPX init                                                                                                 |
| 3   | same, foreground re-run                                       | same 0xC0000005 (reproducible)                                                                                                                                                             |
| 4   | full 1.97GB clone (userdata qcow2 + encryptionkey), port 5580 | launcher **died silently** post-WHPX (no qemu child)                                                                                                                                       |
| 5   | lean clone, `hw.ramSize=1024M`, port 5580                     | qemu spawned; guest booting (CPU climbing to ~200s), then **both processes vanished mid-boot** — consistent with host memory-pressure termination                                          |
| 6   | `-low-ram -memory 512`                                        | launcher rejected the invalid `-low-ram` flag (operator error, not environment)                                                                                                            |
| 7   | lean clone, `-memory 512`, port 5584                          | launcher spawned qemu then exited (normal Windows emulator pattern); qemu **idle-wedged at 42.6s CPU**, `adb shell` hangs (30s bounded timeout)                                            |

### Root cause: host memory exhaustion (environment, not product)

At the time of the attempts: **31.7 GB total RAM, ~1.3–1.6 GB available,
`Memory Compression` process holding up to 8.1 GB.** Resident consumers include the
user's active WSL2 Ubuntu session (~4.9 GB), two foreign emulators (~3–4 GB), the
agent toolchain, and desktop apps. A third Android guest (even at 512 MB guest RAM)
cannot complete boot on this host; guests wedge in the kernel/zygote stage before
`sys.boot_completed` and before adbd's shell service is usable. This is the exact
signature the previous overnight session recorded as "`adb shell getprop` hung" —
with the important new finding (attempt 5) that fresh guests boot for a while and
then get starved, and that the foreign devices themselves still answer shells.

Per campaign rules, an unowned/unavailable device host is an `ENVIRONMENT` blocker;
no application defect is inferred, and no foreign emulator, the ADB daemon, or a
foreign AVD was killed, reset, or modified at any point.

### 2026-10-16 successor campaign: boot blocker SOLVED; new precise blocker found

One bounded campaign-owned attempt at the improved host state (3.5 GB free)
produced two hard findings and one unlock:

1. **The boot wedge is GPU-mode-specific.** `campaign-api36c` (fresh
   API-36 `default` x86_64, pixel_7) booted with `sys.boot_completed=1` in
   ~30s using **`-gpu host`** — the exact configuration both live emulators
   on this host use. All 7 prior attempts used `-gpu swiftshader_indirect`
   (or equivalent) and wedged. `adb shell` on the campaign device answers
   instantly.
2. **Exact-source Android provisioning works end to end.** From a clean
   checkout (`superhabits-android-cert` @ `5e62038`): local Gradle Release
   build 7m47s → APK installed on `emulator-5578`:
   `com.dale16.superhabits 1.0.0 (source 5e620385441343d763d21e9458d8e1ba4f51091c,
APK SHA-256 9CB978BA342351F219971BB7E93A3A8DAA663E0D196390790C0A60C84A426C4D)`
   with a clean bundle scan (1 JS entry, no Supabase host).
3. **New blocker (ENVIRONMENT): Maestro cannot enumerate devices on this
   host while the foreign `emulator-5594` transport is wedged.**
   `DeviceService.listAndroidDevices` (Maestro 2.9.0) opens an `adb shell`
   on EVERY transport on the shared adb server before honoring `--device`;
   `emulator-5594`'s shell read never returns (bounded per-device probe:
   `emulator-5570` → alive, `emulator-5578` → alive, `emulator-5594` →
   hangs past 12s, JVM thread-dump shows `dadb … AdbServer.readString` in
   `listAndroidDevices`). dadb hard-codes the ADB-server endpoint
   (`ANDROID_ADB_SERVER_PORT` verified ignored: an isolated server on 5041
   never lists the wedged device, yet Maestro still hangs), so there is no
   zero-touch route around a wedged transport on the shared server. Per
   campaign rules the foreign emulator/transport is not touched.

**Owner-action remediation (unblocks the flows immediately):** repair or
shut down the foreign `emulator-5594` (its adbd shell service is
half-open — `adb devices` shows `device` while `adb shell` hangs) **with its
owner's consent**, or reboot the host; then, on the campaign device (already
provisioned at the exact source):

```
emulator -avd campaign-api36c -no-snapshot -no-window -gpu host -memory 2048 -cores 2 -port 5578
npm run qa:native:provision -- --serial emulator-5578   # already done for 5e62038
npm run qa:native:targeted        # persistence tag
node scripts/qa-native.mjs --platform android --flow .maestro/flows/habit-reminder-disable.yaml --serial emulator-5578 --no-provision --no-stop
node scripts/qa-native.mjs --platform android --flow .maestro/flows/workout-gym-v2-persistence.yaml --serial emulator-5578 --no-provision --no-stop   # x3 consecutive
node scripts/qa-native.mjs --platform android --flow .maestro/flows/workout-gym-v2-session-lifecycle.yaml --serial emulator-5578 --no-provision --no-stop
```

Android certification remains `ENVIRONMENT_BLOCKED` at this record's date,
but the blocker is now a single wedged foreign transport with a documented
remediation — not host capacity.

## B. iOS — `EXECUTED AND FAILED` (run 38676461813, head 9aa0f78); verifying re-run dispatched

> **Correction (this campaign).** This section previously read `NOT RUN`. That was
> stale. The repo's own GHA iOS lane **did execute** at PR #79 head `9aa0f78` (run
> [38676461813](https://github.com/quantdale/super-habits/actions/runs/38676461813)):
> it booted the iOS 26.2 simulator, built/installed/launched the unsigned Release app,
> and ran all 13 Maestro flows. It **failed** — but **not as 13 application defects**.
> A coverage-accounting defect in `readExecutedFlows` (it only understood Maestro's
> legacy `manifest.json` layout) reported every flow `executed: []`, so **9 flows that
> actually passed (Maestro exit 0) were misreported `NOT_CERTIFIED`**, and 4 genuinely
> failed (`FAILED_NEEDS_TRIAGE`): `todo-persistence`, `calories-persistence`,
> `workout-gym-v2-persistence`, `workout-gym-v2-session-lifecycle`. The harness defect is
> fixed (`29dd16a`, proven 13/13 against the run-38676461813 artifact); two of the four
> are fixed selector bugs (`db04415`); the other two are nav/gesture divergences deferred
> for evidence-based triage. A first verifying re-run (run `38712060166`, head `db04415`)
> **did not reach the flows**: `simctl launch` and `simctl get_app_container` both hung
> (ETIMEDOUT) while `list`/`screenshot` succeeded and the app log stayed empty — the iOS
> simulator's app-launch/installd service wedged (ENVIRONMENT flake, not an app defect; the
> app built+installed fine). `Run iOS flows` was SKIPPED, so **no certification was earned**.
> A clean retry **ran the flows at exact head `5ebf2d4` (run `38726951043`): 10 PASS / 3 FAIL.**
> `todo-persistence` PASSED (selector fix confirmed) and `workout-gym-v2-session-lifecycle`'s
> input fix let it progress past the typed-value assert; the coverage reader is proven
> end-to-end (flows now report their real PASS/FAIL). Still failing: `calories-persistence`
> and `workout-gym-v2-persistence` (unchanged deferred divergences) and
> `workout-gym-v2-session-lifecycle` (now at a NEW post-relaunch point — the app was
> unreachable, `App crashed or stopped`, with no crash exception in the captured logs;
> inconclusive between a real crash and the run-2 launch-service flake — needs isolated
> repro + DiagnosticReports). iOS is **10/13 certified at `5ebf2d4`; not fully certified.**

- **Static readiness (this campaign):** `app.json` iOS block is coherent
  (`com.dale16.superhabits`, tablet support, `ITSAppUsesNonExemptEncryption=false`,
  no stray permissions); all 27 Maestro flows use `appId: com.dale16.superhabits`
  and semantic selectors with no Android-only mechanisms in the iOS-listed 13;
  no committed `ios/` workspace (generated per run by prebuild + `pod install`);
  `eas.json` `e2e-test` is credential-free (`withoutCredentials: true`,
  `ios.simulator: true`).
- **Known iOS risks carried forward:** `pressKey: home` semantics in
  `pomodoro-lifecycle`; keyboard overlay fragility in `workout-gym-v2-*`
  (pre-existing, mitigated with edge swipes); notification-tray delivery remains a
  documented capability gap; the new habit footer has **no KeyboardAvoidingView**,
  so on iOS (`UIModalPresentationOverFullScreen`) the pinned footer is covered
  while the name field is focused — recorded as P2 `DEFERRED_BY_RISK` (shared-Modal
  fix not device-verifiable here; the GHA iOS lane does not run the habit-editor
  flow). No iOS run is claimed from TypeScript compilation, the EAS YAML's
  existence, or a SKIPPED workflow.
- **Infrastructure:** the EAS cloud iOS lane is externally blocked (project
  `@dale16/superhabits` has no linked GitHub repo; Maestro jobs need a paid plan —
  owner actions, unchanged). The repo's **own credential-free GitHub lane**
  `.github/workflows/ios-native-e2e.yml` (macos-15-intel, unsigned simulator build,
  exact-SHA assertions, no secrets) is dispatched by this campaign at the final
  PR head; its genuine outcome is recorded in RELEASE-DECISION.md and TEST-MATRIX.md.

## C. What would make these claims real

A single owned, responsive emulator (or the GHA/cloud macOS lane succeeding at the
exact head) plus the two flows passing **three clean consecutive runs** at that
source, with the APK SHA-256/install provenance recorded by
`scripts/qa-native-provision.mjs` reports and the iOS provenance JSON from
An owned, responsive Android device is still unavailable on this host (Section A), so
Android stays `ENVIRONMENT_BLOCKED`. iOS is no longer `NOT RUN`: it is **`EXECUTED AND
FAILED`** (Section B) and earns certification only when a run at an exact source SHA
reports all 13 flows PASS (run `38712060166` flaked at launch; retry `38726951043` at `5ebf2d4` is the dispatched attempt).
Neither lane is certified at this record's date.

## D. Run-3 failure root causes (successor campaign, 2026-10-15/16)

Run `38726951043` (head `5ebf2d4a95efe11a3035625f5809743bbde47899`) closed at
**10 PASS / 3 FAIL**. All three failures are now root-caused from that run's own
Maestro `commands-*.json`, `maestro.log`, failure hierarchies, screenshots, and
the captured `simulator-app.log` (system log). None is an application data or
persistence defect.

| Flow                               | Classification                                              | Root cause (evidence)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Fix                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calories-persistence`             | **TEST_BUG** — tap-target occlusion                         | `Manual add` resolved to `[204,776][318,820]` while `Section tabs` occupied `[8,778][394,840]`; Maestro taps element bounds centers, so the tap activated the **Focus tab** and the failure hierarchy is the Focus surface. Identical bounds/signature at run 38676461813 (deterministic).                                                                                                                                                                                                                                                    | Flow scrolls to the empty day-log title (`No meals logged on this day`) first so the action row clears the floating tab bar before the tap.                                                                                                                                                                                        |
| `workout-gym-v2-persistence`       | **TEST_BUG** — tap-target occlusion on the dialog clip edge | `progression increment` resolved to `[41,812][141,843]` against the routine dialog panel's bottom clip edge (`core/ui/Modal` dialog: maxHeight 86% centered ⇒ panel bottom ≈813). The center tap landed on the modal's full-screen **Dismiss scrim** and closed the routine detail; the flow then searched the Workout landing for the row's sibling field. Identical at run 38676461813. **Refutes the prior "gesture escaped the card" hypothesis**: the scroll command at the divergence completed in 1.2s without issuing a single swipe. | Flow centers the row inside the panel (`centerElement: true`) before every field tap in the block and centers the routine-row tap post-restart.                                                                                                                                                                                    |
| `workout-gym-v2-session-lifecycle` | **ENVIRONMENT** — automation launch race, **not a crash**   | `launchApp` completed 14:23:05.16; SpringBoard recorded PID 64694 `running-active-Visible` at 14:23:05.0; XCTestDriver's 14:23:06.05 `viewHierarchy` returned `"Application com.dale16.superhabits is not running"` and Maestro aborted with "App crashed or stopped" at 14:23:06.4; the same PID kept logging (UIKit boot 14:23:06.5–14:23:09.6, JS `[sync] flush` 14:23:17.7). Failure screenshot is the black pre-first-frame screen. No crash/termination record.                                                                         | Harness-level, evidence-gated, identified single re-run (below). Maestro cannot absorb this in-flow: `IOSDeviceErrors.AppCrash` is not a `MaestroException`, and `MaestroCommandRunner` rethrows non-`MaestroException` failures (verified against Maestro sources), so `optional: true`/`retry` are ineffective against the race. |

### Harness hardening (Campaign 2 invariants)

- `scripts/qa-ios-launch-race.mjs` (new, unit-tested in `tests/qaIosLaunchRace.test.ts`):
  signature detection, flow error extraction from the Maestro 2.x command
  evidence, crash-report scanning, and a pure recovery decision.
- `scripts/qa-ios-github-actions.mjs`: every failed flow now captures
  **crash reports** (`~/Library/Logs/DiagnosticReports` listing + copies),
  **process liveness** (`simctl spawn … ps`), and a **failure screenshot**
  alongside `simulator-app.log` — so crash-vs-unreachable is decidable from
  the artifact alone (a missing crash report is never treated as proof by
  itself).
- Launch-race recovery is allowed **only** when the failure carries the
  `App crashed or stopped` / `is not running` signature **and** the app
  process is alive **and** no new app crash report exists. It is bounded to
  one full re-run per flow per lane run and reported as
  `PASS_AFTER_LAUNCH_RACE_RECOVERY` (lane status
  `PASS_WITH_LAUNCH_RACE_RECOVERY`) — identified, never a plain `PASS`, so a
  recovered flow is never silently counted as a deterministic pass.
- `.github/workflows/ios-native-e2e.yml` accepts an optional focused
  `flows` subset (`IOS_FLOW_SUBSET`) for development iteration. Subset runs
  report `SUBSET_PASS` and **can never certify** (`expectedFlowCount` keeps
  the full inventory; unknown subset names fail closed).
- No assertion was weakened anywhere: the occluded taps are re-anchored
  semantically and the post-relaunch readiness requirement remains strict.

### Adversarial review round (independent read-only review, 2026-10-16)

An independent review confirmed all three root causes (none could be disproved)
and found real defects in the first harness draft and latent flow weaknesses;
all P1/P2 items were fixed in the same campaign:

- **P1 (flow evidence honesty)** — `Target reps min/max` are `NumberStepperField`
  labels shared by an inert label `Text` and the input itself, so an unscoped
  `tapOn` hits index 0 (the label) and the following `inputText` is a silent
  no-op (the exact defect previously fixed for `Weight` in run 36423379932).
  Fixed with `index: 1` taps. The post-restart oracles were also colliding:
  bare `40` is satisfied by the set's default Active-seconds value, and `5`/`8`
  were used for two fields each. Fixed with six unique values
  (`2.5`/`5`/`8`/`7`/`11`/`42`) each asserted individually.
- **P2 (harness honesty)** — a flow row could surface `PASS` from the native
  report even when the harness predicate (exit 0 + exact source SHA) failed,
  and a failed recovery could collapse into a plain `PASS`. Fixed:
  `attemptStatus()` never yields `PASS` without the full predicate, a failed
  recovery keeps the first attempt's failure status, and every recovery
  attempt (recovered or not) is listed in the lane report and summary.
- **P2 (gate robustness)** — process liveness matched raw `ps` lines (crash
  tooling arguments could fake a live app) and an unreadable
  DiagnosticReports folder was indistinguishable from "no crash". Fixed:
  liveness matches the `SuperHabits` executable name only, and the crash scan
  is fail-closed (`CRASH_REPORT_SCAN_UNAVAILABLE` refuses recovery).
- **Guard revision** — `tests/maestroIosFlowGuards.test.ts` previously pinned
  "no `centerElement` on the increment scroll" from the refuted hypothesis. The
  pin is replaced by the proven invariant (the increment scroll must center the
  row inside the dialog panel) plus new pins for the `index: 1` stepper taps
  and the unique persistence oracles. The revision is evidence-backed: the
  run-38726951043 command log shows the divergent scroll completed with zero
  swipes, so no scroll gesture — centered or not — caused the escape.
- Residual (documented, not fixed): the calories flow's modal-submit tap
  (`Add entry`) shares its label with the diary empty-state action; iOS
  `accessibilityViewIsModal` excludes the background, and a missed submit
  cannot false-pass because the post-save header oracle (`1,630 kcal left`)
  would fail. Left as-is pending device evidence.

## E. Qualification run 38793221651 (head `5f7a45b`) — 9 PASS / 4 FAIL, and its two findings

The full 13-flow suite ran at the fix head (4h05m on the loaded intel runner;
the source-cleanliness gate finally reported `sourceUnchangedApartFromGeneratedIos:
true`, so the earlier breadcrumb blocker is confirmed closed).

| #   | Flow                               | Result                                                                              |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `native-smoke`                     | PASS                                                                                |
| 2   | `todo-persistence`                 | PASS                                                                                |
| 3   | `habit-persistence`                | PASS                                                                                |
| 4   | `habit-progress-insights`          | PASS                                                                                |
| 5   | `habit-reminder-actions`           | PASS                                                                                |
| 6   | `habit-reminder-actions-replay`    | PASS                                                                                |
| 7   | **`calories-persistence`**         | **PASS** — the tap-occlusion fix is device-verified (first-ever pass for this flow) |
| 8   | `workout-persistence`              | FAILED (flaked — see finding 2)                                                     |
| 9   | `workout-gym-v2-persistence`       | FAILED (regressed by finding 1, then flaked)                                        |
| 10  | `workout-gym-v2-session-lifecycle` | FAILED (flaked — see finding 2)                                                     |
| 11  | `settings-persistence`             | FAILED (flaked — see finding 3)                                                     |
| 12  | `pomodoro-lifecycle`               | PASS                                                                                |
| 13  | `pomodoro-notification-path`       | PASS                                                                                |

**Finding 1 (regression, fixed): `centerElement: true` does not converge with
`direction: UP` in Maestro 2.2.0 on this target.** The run's command log shows
the routine row found **fully visible** (`Visibility Percent: 1.0`) yet the
centering swipes overshot it until the 20s budget expired inside 8s-per-fetch
hierarchy calls (`Scrolling try count: 0` → swipe → timeout). Every
`direction: UP` + `centerElement` scroll failed this run while every
`direction: DOWN` + `centerElement` scroll passed (the habit flows). The three
workout row scrolls that pair them are now plain visibility stops (the
run-3-proven construct), and a guard test pins the pairing as forbidden.

**Finding 2 (target flake, mitigated): slow AX-tree materialization.** The
runner was ~2x slower than run 3 (4h05m vs ~2h): post-launch hierarchy polls
returned empty depth-6 trees for ~25s, and each fetch cost up to 8s. The
`workout-persistence` / `workout-gym-v2-session-lifecycle` row scrolls lost
that race (finding 1 amplified it); their budgets are now 30s.

**Finding 3 (target flake, mitigated): the settings drawer assert raced the
same materialization.** `Close settings` was fully rendered by the failure
dump but its 5s `extendedWaitUntil` polled thin trees throughout. Both drawer
asserts now wait for the entrance animation and carry an evidence-based 15s
budget.

Also fixed from this run: the recovery-gate liveness probe parsed `ps` output
wrongly (reported a live app as dead — safe direction, but useless evidence);
it now matches the executable comm exactly.

**Position after E:** the three original failures are root-caused and fixed
(calories now device-verified; the gym-persistence progression block awaits
device proof — its earlier steps were never reached in this run); the 3 new
failures are one reproducible harness regression (fixed and guarded) plus two
slow-runner flakes (budgeted). A clean qualification run at the next head is
the remaining iOS evidence; given the runner's demonstrated per-run flake
rate, a single run should be read with the per-flow logs, not as a coin flip.
