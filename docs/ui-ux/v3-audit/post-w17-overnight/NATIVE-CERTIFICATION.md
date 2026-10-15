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

### Minimal unblocking prerequisites (in order)

1. Free ~4 GB host RAM or stop one foreign emulator **with its owner's consent**
   (neither `emulator-5570` nor `emulator-5594` was started by this campaign), or
2. Run the qualification on a different host / CI lane with ≥4 GB headroom:
   `npm run qa:native:provision -- --serial <owned-serial>` then
   `npm run qa:native:targeted` (persistence) and the two flows
   `habit-reminder-disable` and `workout-gym-v2-persistence`, plus smoke and
   lifecycle lanes, at the exact PR head.
3. The two PR #79 flow fixes themselves are still unverified on any device:
   `habit-reminder-disable` (footer `Save changes` hit-target) and
   `workout-gym-v2-persistence` (edge-swipe / typed-name oracle).

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
> A clean retry is dispatched at head `5ebf2d4` (run `38726951043`) to certify the 9 passing
> flows and confirm the 2 fixes.

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
