# ExecPlan: Validate Nitro Android Native E2E

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Finish Nitro's local Android native-testing environment and execute the
committed Maestro flows against an installed SuperHabits `e2e-test` Android
build. The result must distinguish actual device evidence from setup checks,
known gaps, and environment blockers.

## Context

- Repository: `C:\Users\Michael Roy\Documents\super-habits`.
- Related completed OpenSpec: `openspec/changes/add-native-real-user-e2e/`.
- Native contract and flow catalog: `docs/testing/native-e2e.md`, `.maestro/`.
- Native runner: `scripts/qa-native.mjs`; package profile: `eas.json`.
- Android package ID: `com.dale16.superhabits`.
- Nitro is Windows; local iOS execution is not expected.
- The repository currently has extensive unrelated dirty changes. Preserve
  them; only add portable native fixes or documentation when evidence requires
  them.

## Scope

- Inventory Java/JDK, Android SDK/platform tools/emulator, system images,
  AVD/device, acceleration, Maestro, EAS/local build capability, and APKs.
- Provision a compatible local Android target where the host supports it.
- Install the supported Maestro CLI and verify it.
- Produce/install the credential-free `e2e-test` APK without committing native
  build outputs or workstation paths.
- Run native preflight, smoke, all committed Android flows, persistence,
  Pomodoro lifecycle, notification-path, and repeatability checks.
- Classify failures with the repository taxonomy and update native docs and
  this plan with evidence.

## Non-Goals

- Product feature development or native test architecture redesign.
- Production signing, publishing, production credentials, or Play Store use.
- Local iOS execution on Windows.
- Committing SDKs, system images, emulator data, Gradle caches, APKs, secrets,
  or machine-specific paths.
- Expanding notification/offline/Alert coverage unless execution reveals a
  narrow, portable, user-critical gap that can be covered safely.

## Current Checkpoint

- Current milestone: Android native validation is complete on Nitro; committed
  flows, persistence, lifecycle, repeatability, documentation, and focused QA
  have passed or been explicitly classified.
- Completed: Read repository instructions, native docs, Maestro flows, native
  runner, Expo/EAS config, completed native OpenSpec artifacts, and bootstrap
  plan. Confirmed web/tooling doctor passes. Confirmed existing bootstrap plan
  is completed and does not contain a current active task.
- Completed: Final plan resume/validation and Git reconciliation. The EAS
  `e2e-test` profile remains the cloud contract, while Windows EAS local builds
  are unsupported by current Expo guidance. Native documentation also records
  the local CMake/C++ linker caveat for clean-machine rebuilds.
- In progress: None; execution, documentation, validation, and handoff are
  complete.
- Important modified files: `scripts/qa-native.mjs` has task-owned portable
  Windows `.cmd`/`.bat` spawn and path-quoting fixes; the worktree has
  pre-existing user changes across product, QA, docs, package metadata, and
  OpenSpec files. Task-owned changes also include the five corrected Maestro
  flows, native smoke selector, and native documentation.
- Last successful validation: `Nitro_API_36` booted on 2026-08-10 and
  `sys.boot_completed=1`; serial `emulator-5554`, Android 16/API 36,
  x86_64, `Android SDK built for x86_64`, product `sdk_phone64_x86_64`.
- Current failures: Initial builds encountered Maven DNS and Android C++
  runtime-link configuration failures (ENVIRONMENT/toolchain). A local
  generated-project workaround supplied the shared C++ runtime link input;
  the release APK now builds and installs. Initial flow runs found stale
  selectors and viewport assumptions; those TEST_BUG fixes are now validated.
  The first smoke flow run failed at
  `tapOn: 'To Do'` because the live Android hierarchy exposes the committed
  product label as `To Do`; the flow-only selector fix is now validated as a
  TEST_BUG fix.
- Failure evidence: The failed Maestro report
  `simulation-output/native/native-android-smoke-2026-08-10T043630904Z.json`
  and the preserved Maestro run artifacts under
  `%USERPROFILE%\.maestro\tests\2026-08-10_123558`; corrected report
  `simulation-output/native/native-android-smoke-2026-08-10T044023297Z.json`.
- The first task-persistence run independently reproduced the same stale
  selector before any mutation;
  this remains a TEST_BUG correction, not evidence against SQLite persistence.
  Evidence: `simulation-output/native/native-android-all-2026-08-10T044218353Z.json`
  and `%USERPROFILE%\.maestro\tests\2026-08-10_124148`.
- After correcting that selector, task persistence reached the form and
  failed at the submit tap because the Android keyboard and the form's own
  scrollable content kept the semantic `Add task` button outside the visible
  viewport. The flow now uses Maestro's state-based `hideKeyboard` and
  `scrollUntilVisible` commands before submitting; this is a TEST_BUG in the
  flow sequence, with no data mutation proven by the failed run. Evidence:
  `simulation-output/native/native-android-all-2026-08-10T044325373Z.json` and
  `%USERPROFILE%\.maestro\tests\2026-08-10_124242`.
- Habit persistence then reached the native form but failed at `Create habit`
  for the same keyboard/scroll visibility condition. The flow now dismisses
  the keyboard and uses `scrollUntilVisible` before submission. Evidence:
  `simulation-output/native/native-android-all-2026-08-10T044746529Z.json` and
  `%USERPROFILE%\.maestro\tests\2026-08-10_124704`.
- After the visibility correction, the habit was created successfully but the
  flow's exact assertion did not match the live accessibility label, which
  includes the additional `Long press to remove one.` suffix. The flow will
  use a prefix regex for both the zero and one-count states; this is another
  TEST_BUG selector correction. Evidence:
  `simulation-output/native/native-android-all-2026-08-10T044915684Z.json` and
  `%USERPROFILE%\.maestro\tests\2026-08-10_124839`.
- Calories creation and its immediate assertion passed, but after relaunch the
  flow checked `Native breakfast` while still on the Form view. The captured
  screen shows the product's separate Form/Diary tabs and no intake history in
  Form; the persistence assertion will switch to Diary first. This is a
  TEST_BUG in the flow's view selection, not yet evidence of a persistence
  defect. Evidence:
  `simulation-output/native/native-android-all-2026-08-10T045142789Z.json` and
  `%USERPROFILE%\.maestro\tests\2026-08-10_125044`.
- Switching to Diary after creation still did not prove relaunch persistence;
  the next run will assert the entry in Diary both before and after process
  termination to distinguish a write/render issue from a reload issue.
- The diagnostic Calories run showed the immediate Diary assertion also failed:
  the plain `Add entry` selector resolved to the non-clickable section heading,
  not the second clickable submit button. This is a TEST_BUG selector collision
  and means the earlier apparent immediate assertion was not submission proof.
  Evidence:
  `simulation-output/native/native-android-all-2026-08-10T045645400Z.json` and
  `%USERPROFILE%\.maestro\tests\2026-08-10_125601`.
- The indexed submit selector identified the second matching text node, but
  its center was at the Android navigation-bar boundary because the form
  footer was the final scroll item. A `containsChild` experiment incorrectly
  backgrounded the app, confirming that this was not a safe selector fix. The
  flow now requests `centerElement: true` before tapping the indexed semantic
  submit control. Evidence is preserved under
  `%USERPROFILE%\.maestro\tests\2026-08-10_130059` and
  `%USERPROFILE%\.maestro\tests\2026-08-10_125914`.
- Maestro could not center the final footer item because the scroll container
  ends at the Android navigation boundary. The flow keeps the indexed
  semantic selector and taps a relative point near the control's top edge,
  which stays inside the app viewport; this is the next execution check, not
  a raw coordinate selector.
- Calories persistence is now proven: the flow submitted through the actual
  clickable footer, found `Native breakfast` in Diary before termination, then
  killed/relaunched the app and found it again. Report:
  `simulation-output/native/native-android-all-2026-08-10T050616098Z.json`.
- Workout routine creation succeeded in the first execution (the hierarchy
  showed `Your routines`), but the flow asserted the new accessible row before
  scrolling it into view. The flow now uses semantic `scrollUntilVisible` for
  `Open Native strength routine routine`. Evidence:
  `simulation-output/native/native-android-all-2026-08-10T050729196Z.json` and
  `%USERPROFILE%\.maestro\tests\2026-08-10_130653`.
- The corrected Workout run passed routine and exercise creation, but its
  relaunch assertion checked the routine name before scrolling the list into
  view. Evidence:
  `simulation-output/native/native-android-all-2026-08-10T051038655Z.json` and
  `%USERPROFILE%\.maestro\tests\2026-08-10_130929`.
- Workout persistence is now proven: routine and exercise creation passed,
  the process was killed, the app relaunched, and the routine was found after
  semantic scrolling. Report:
  `simulation-output/native/native-android-all-2026-08-10T051210150Z.json`.
- Settings persistence passed across kill/relaunch: Dark mode was selected,
  the app was terminated and relaunched, and Settings reopened with Dark
  selected. Report:
  `simulation-output/native/native-android-all-2026-08-10T051257614Z.json`.
- Aggregate targeted Android lane passed all five committed persistence flows
  (`calories`, `habit`, `settings`, task, `workout`) in 2m44s. Report:
  `simulation-output/native/native-android-persistence-2026-08-10T051625424Z.json`.
- Aggregate lifecycle lane passed both committed Pomodoro flows in 36s:
  lifecycle and notification-path. Report:
  `simulation-output/native/native-android-lifecycle-2026-08-10T051806110Z.json`.
- The unfiltered eight-flow Maestro folder run passed Calories, Habit, and
  Smoke, then lost the `emulator-5554` transport; the remaining five flows
  failed at startup/cleanup without app assertions. ADB and the emulator were
  healthy again on inspection (`adb devices` showed `device`, boot property
  `1`). Classify this run as ENVIRONMENT/target transport instability, not a
  product or flow result. Report:
  `simulation-output/native/native-android-all-2026-08-10T052033636Z.json`;
  Maestro cleanup evidence is in its preserved run log.
- Reliability reruns after the transport recovered passed: native smoke,
  task process persistence, and Pomodoro background/foreground lifecycle.
  Reports:
  `simulation-output/native/native-android-all-2026-08-10T052221815Z.json`,
  `simulation-output/native/native-android-all-2026-08-10T052323194Z.json`, and
  `simulation-output/native/native-android-all-2026-08-10T052413931Z.json`.
- The iOS preflight correctly remained ENVIRONMENT on Windows: `xcrun/simctl`
  is unavailable. Report:
  `simulation-output/native/native-ios-smoke-2026-08-10T052754702Z.json`.
- Relevant quarantines: Native notification tray delivery, true long-running
  background execution, native Alert dialogs, and system offline toggling are
  documented capability gaps until a deterministic mechanism exists.
- Blockers: None for the current installed-target run. The local CMake/STL
  workaround must be assessed for portability before any repository change is
  considered. A prior Google APIs image download stalled, but the smaller
  official API-36 default image completed successfully.
- Condition required to unblock: If the host cannot support a target or local
  build and EAS is unavailable, record the exact external/manual blocker and
  preserve all completed checks rather than claiming native pass.
- Exact resume action after unblock: Re-run the failed prerequisite check, then
  continue from the first incomplete milestone below without repeating green
  setup.
- Exact next action: No further action is required; final handoff is complete.
- Remaining definition of done: Complete. A booted Android target has the
  expected package installed from the local credential-free equivalent of the
  dedicated `e2e-test` build; committed smoke, persistence, Pomodoro lifecycle,
  and notification-path flows actually ran; critical flows were repeated;
  failures were classified; docs and this plan contain evidence and remaining
  gaps; final plan validation passes.

## Progress

- [x] Recover repository instructions, native contract, flows, config, and
      completed native OpenSpec artifacts.
- [x] Inspect initial Git state and confirm unrelated dirty work is present.
- [x] Create this task-scoped active ExecPlan.
- [x] Inventory Nitro's Android/JDK/Maestro/build environment.
- [x] Provision and boot a usable Android emulator/device, if supported.
- [x] Install Maestro and verify the supported runtime.
- [x] Build and install the local credential-free Android equivalent of the
      dedicated `e2e-test` APK.
- [x] Run native preflight and smoke; preserve and classify any failures.
- [x] Run all committed Android flows and persistence/lifecycle checks.
- [x] Repeat critical flows and assess reliability.
- [x] Investigate focused Alert/offline coverage only if deterministic and
      in-scope; document notification-delivery boundary.
- [x] Update native documentation and this plan with actual evidence.
- [x] Run affected QA for portable repository fixes and validate focused QA.
- [x] Reconcile Git and complete the final handoff.

## Surprises & Discoveries

- 2026-08-10 — The prior bootstrap plan is COMPLETED and accurately records
  that JDK/SDK/emulator tooling exists but no AVD/device or Maestro was ready;
  this task is a separate validation phase.
- 2026-08-10 — Expo SDK 55 officially targets compile/target SDK 36; the
  stable API-36 default x86_64 system image was selected because the app does
  not require Play Store or Google APIs for this native contract.
- 2026-08-10 — The AVD boots with WHPX acceleration and reaches both
  `sys.boot_completed=1` and `dev.bootcomplete=1`.
- 2026-08-10 — Maestro CLI 2.8.0 installed from the official GitHub release;
  published SHA-256 matched. Its archive contains a nested `maestro` folder,
  so the effective user bin is `%USERPROFILE%\\maestro\\maestro\\bin`.
- 2026-08-10 — Native preflight initially misclassified installed Maestro as
  missing because Node `spawnSync` with `shell:false` cannot execute Windows
  batch files. The narrow `.cmd`/`.bat` shell fix in `scripts/qa-native.mjs`
  makes the runner reach the expected missing-package check.
- 2026-08-10 — Current Expo guidance says EAS `--local` is not supported on
  Windows; use `npx expo run:android --variant release` for a local release
  build. This is the selected credential-free path; the checked-in EAS
  `e2e-test` profile remains the cloud workflow contract.
- 2026-08-10 — Actual Android execution found and fixed stale `Todos` versus
  `To Do` navigation labels, keyboard/scroll submission visibility, a habit
  accessibility-label suffix, Calories Form-versus-Diary selection, a
  duplicated Calories `Add entry` heading/button selector, and off-screen
  Workout rows. These were TEST_BUGs; no product semantics were changed.
- 2026-08-10 — The unfiltered folder run lost the emulator transport after
  three passes. Tagged/individual lanes then passed after ADB recovered; the
  interruption is classified ENVIRONMENT and is retained as evidence.
- 2026-08-10 — Android API-36 navigation insets place the final Calories
  submit footer at the viewport boundary. The flow uses an indexed semantic
  control with a relative point inside the control; no raw absolute screen
  coordinates are used.

## Decision Log

- 2026-08-10 — Use a new task plan rather than reopening the completed
  bootstrap plan — the repository protocol requires independent task state and
  the bootstrap plan's milestone is already complete.
- 2026-08-10 — Preserve the existing dirty worktree — the user explicitly
  states those changes are unrelated to this native mission unless evidence
  proves otherwise.
- 2026-08-10 — Treat actual Maestro execution against the installed package as
  the gate — tool installation, emulator boot, and YAML validation alone are
  insufficient by the native contract.

## Validation Ledger

- 2026-08-10 — `npm run dev:doctor` — PASS for web/Android CLI tooling;
  Maestro absent from PATH; no native execution evidence yet.
- 2026-08-10 — `git status --short` — INFO; extensive pre-existing dirty work
  preserved and not attributed to this task.
- 2026-08-10 — Required repository/native documentation and flow reads — PASS.
- 2026-08-10 — Android host inventory — PASS/PARTIAL — JDK 17, SDK Platform
  36, Build Tools 36.0.0, platform-tools 37.0.1, Emulator 37.1.11, WHPX,
  and CPU virtualization verified; no physical device; Maestro/APK absent.
- 2026-08-10 — SDK image install — PASS — `system-images;android-36;default;x86_64`
  downloaded and unpacked; the API-36 Google APIs attempt was abandoned after
  no progress and is not needed.
- 2026-08-10 — AVD boot — PASS — `Nitro_API_36` / `emulator-5554`, API 36,
  Android 16, x86_64, `sys.boot_completed=1`.
- 2026-08-10 — `npm run qa:native:android` before app install — ENVIRONMENT —
  after the runner fix, correctly reported `com.dale16.superhabits` absent and
  emitted a focused native report; no flow was claimed as passing.
- 2026-08-10 — Runner diagnosis — TEST_BUG/FIXED — Node batch-file spawning
  returned `EINVAL`; fixed only Windows shell invocation for `.cmd`/`.bat` and
  reran preflight to the expected package blocker.
- 2026-08-10 — Local release build — ENVIRONMENT — Gradle dependency
  resolution failed with `No such host is known` for Maven Central and the
  Google Maven fallback while fetching KSP; no native execution was claimed.
- 2026-08-10 — Local release build retry — BUILD FAILURE under investigation —
  Maven resolution succeeded and the build installed CMake, but the
  `react-native-worklets` `arm64-v8a` native link failed with unresolved C++
  runtime symbols; no native execution was claimed.
- 2026-08-10 — Build toolchain diagnosis — ENVIRONMENT/toolchain — React
  Native 0.83.4 requests CMake 3.30.5, while `react-native-worklets` falls
  back to 3.22.1 unless `CMAKE_VERSION` is set. Installed the official SDK
  CMake 3.30.5 and will use it without changing repository configuration.
- 2026-08-10 — Local release build — PASS — Built
  `android/app/build/outputs/apk/release/app-release.apk` for `x86_64` using
  the generated local project, `CMAKE_VERSION=3.30.5`, and
  `-PreactNativeArchitectures=x86_64`. Because the NDK/CMake link line omitted
  the shared C++ runtime, the generated dependency/app CMake inputs were
  locally augmented with `-lc++_shared`; no node_modules or generated Android
  files are repository changes.
- 2026-08-10 — APK install/startup — PASS — Installed package
  `com.dale16.superhabits` on `emulator-5554`; `MainActivity` started and
  native libraries including `libc++_shared.so`, Hermes, app modules, and
  generated codegen libraries loaded without a fatal startup exception.
- 2026-08-10 — `npm run qa:native:android` — PASS — Committed native smoke
  executed on the installed Android package after preflight.
- 2026-08-10 — Focused Android flows — PASS — All eight committed flows passed
  in individual or tag lanes: smoke; Todo, Habit, Calories, Workout, and
  Settings persistence; Pomodoro lifecycle; notification path.
- 2026-08-10 — Persistence evidence — PASS — Each persistence flow used
  process termination and relaunch; aggregate targeted lane passed 5/5.
- 2026-08-10 — Lifecycle evidence — PASS — Pomodoro lifecycle and notification
  scheduling-path aggregate passed 2/2; notification-tray delivery remains
  unproven by design.
- 2026-08-10 — Repeatability — PASS — Smoke, Todo persistence, and Pomodoro
  lifecycle each passed again after target recovery; no flow flakiness observed
  in the focused reruns.
- 2026-08-10 — `npm run qa:affected` — PASS — Impact plan generated; broad
  rules include unrelated dirty product/web changes, while this task's native
  and focused QA gates were run explicitly.
- 2026-08-10 — `npm run qa:fast` — PASS — Typecheck, lint (20 pre-existing
  warnings, 0 errors), and 612 unit tests across 53 files.
- 2026-08-10 — `npm run qa:integration` — PASS — 46 integration tests across
  8 files.
- 2026-08-10 — `npm run qa:native:ios` — ENVIRONMENT — Windows lacks
  `xcrun/simctl`; EAS/macOS remains the iOS path.

## Changed Files / Areas

- `.agent/execplans/validate-nitro-android-native-e2e.md` — task-owned durable
  state for this native validation mission.
- `scripts/qa-native.mjs` — portable Windows runner fix proven by preflight.
- `.maestro/flows/native-smoke.yaml` — corrected the live `To Do` selector.
- `.maestro/flows/todo-persistence.yaml` — corrected `To Do` and form
  keyboard/scroll sequence.
- `.maestro/flows/habit-persistence.yaml` — corrected form visibility and
  dynamic accessibility-label matching.
- `.maestro/flows/calories-persistence.yaml` — corrected submit control,
  Diary assertions, and Android navigation-boundary interaction.
- `.maestro/flows/workout-persistence.yaml` — added semantic scrolling for
  routine creation and relaunch assertions.
- `docs/testing/native-e2e.md` and `docs/testing/known-gaps.md` — recorded
  Nitro evidence, cloud-only iOS status, and remaining native gaps.
- No SDK, AVD, APK, Gradle cache, credential, or absolute workstation path was
  added to the repository. Generated `android/` and local node_modules
  diagnostics remain workstation-only/ignored.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan completely.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`,
   `git branch -vv`, and recent log; preserve unrelated changes.
3. Run `npm run agent:resume -- --plan .agent/execplans/validate-nitro-android-native-e2e.md`.
4. Resume from the plan's `Exact next action`, updating the checkpoint before
   each major setup/build/run milestone.
5. Use `npm run qa:affected` only if repository source/docs/test files are
   changed by this task; workstation-only setup does not require broad web QA.
6. Before completion run `npm run agent:plan:validate -- --plan .agent/execplans/validate-nitro-android-native-e2e.md`.

## Outcomes & Retrospective

- Status: COMPLETED.
- Summary: Nitro now has a booted API-36 x86_64 Android target, Maestro 2.8.0,
  an installed local credential-free Android E2E-equivalent build, and actual
  passing Android smoke, persistence, lifecycle, and notification-path flows.
- Classifications: stale selectors and viewport assumptions were TEST_BUGs and
  were fixed narrowly in flows/runner; the unfiltered-folder emulator loss was
  ENVIRONMENT; iOS is ENVIRONMENT/cloud-only; notification tray, long-running
  background execution, Alert dialogs, and offline toggling remain explicit
  capability gaps.
- Follow-up: No further work is required for this validation plan. Remaining
  native capability gaps are documented for a future deterministic lab or
  cloud run.
