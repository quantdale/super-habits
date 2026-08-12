# ExecPlan: Current-source Android and D14 stabilization

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Turn the completed post-integration campaign into reproducible, current-source
evidence. Repair the Android native build if the failure is environment or
repository caused, install and validate the exact resulting APK, re-establish
the D14/CG-4 performance contract, close Habit Progress Insights and Habit
Reminder Interactions readiness where their acceptance evidence is real, run
the required final QA, reconcile documentation/OpenSpec/ExecPlans, and merge
to `main` only if the evidence supports integration.

## Context

- Campaign base: `campaign/post-integration-expansion` at `6287fab`
  (`docs: reconcile integration plan handoff`).
- Stabilization branch: `stabilization/native-d14-closure`.
- Stabilization worktree: `C:\Users\Michael Roy\Documents\super-habits-stabilization`.
- Canonical main is still `15a1a92`; recovery branches/worktrees are preserved.
- The app is an Expo SDK 55 / React Native app with SQLite as the local source
  of truth, a static web export, and serialized Maestro Android validation.
- Historical native evidence used an installed APK and a workstation-only
  generated C++ runtime linker workaround; it does not prove this source tree.
- The current known-gap register records CG-4 and CG-5 as closed historically,
  but this task must independently re-run the unchanged benchmark and update
  the register only from current evidence.
- Runtime schema and data-layer behavior follow `core/db/client.ts` and the
  repository DB/sync invariants; migrations remain append-only.

## Scope

- Recover and validate the current campaign and OpenSpec/ExecPlan state.
- Establish static, dependency, impact-map, and plan-validation baselines.
- Inventory Nitro's Android/JDK/SDK/CMake/NDK environment and reproduce the
  clean current-source CMake/libc++ failure.
- Make only portable repository fixes or exact, evidence-supported machine
  tool repairs; build twice from clean generated state and install the current
  source APK on the existing `Nitro_API_36` target.
- Run serialized current-source smoke, persistence, lifecycle, reminder,
  reminder-action, notification-delivery, and Insights native validation.
- Re-measure and, if needed, profile/fix D14/CG-4 without changing its fixture,
  threshold, assertion, retries, or timing contract; recheck CG-5/J8 and other
  closed performance contracts.
- Re-run focused and broad web, sync/restore, simulation, accessibility,
  dependency, lint/type, OpenSpec, and documentation validation.
- Decide and, only when justified, normally merge the stabilization branch to
  `main` while preserving recovery branches and worktrees.

## Non-Goals

- No unrelated major product feature, framework-major upgrade, or speculative
  redesign.
- No remote Supabase mutation, destructive database reset, forced dependency
  repair, threshold/assertion/fixture weakening, blind retries, or arbitrary
  sleeps.
- No second emulator, concurrent Maestro/native lane, or deletion of recovery
  worktrees/branches.
- No machine-specific paths, generated Android output, SDK content, APKs,
  secrets, or caches committed to the repository.
- No claim of iOS native readiness from this Windows workstation.

## Current Checkpoint

- Current milestone: The native root cause is established and a portable
  candidate fix is installed in the source tree. The SDK/NDK unified CMake
  module receives `ANDROID_STL=c++_shared` but omits `libc++_shared` from
  shared-library link rules; an explicit
  `CMAKE_SHARED_LINKER_FLAGS=-lc++_shared` fixes both dependency and app
  codegen targets. The fix is represented by an Expo prebuild plugin and
  six minimal patch-package patches.
- Completed: Git topology recovered; campaign tip `6287fab`, main tip
  `15a1a92`, integration tip `aa63cb3`, and recovery worktrees preserved.
- In progress: Rebuild the test APK after a native-flow test fix, then continue
  the serialized current-source lifecycle, reminder-action, delivery, and
  Insights lanes; the clean build gate, install, smoke, and persistence lanes
  are now evidenced.
- Important modified files: `app.json`,
  `plugins/withAndroidCxxRuntime.js`, six native dependency patches, and this
  ExecPlan. The originating recovery checkout has unrelated dirty edits that
  remain untouched.
- Last successful validation: `npm test` passed 740 tests/70 files; integration
  passed 68 tests/11 files; timezone QA passed 42 tests in each of five zones;
  typecheck passed; lint passed with 0 errors/19 warnings; strict OpenSpec
  passed 21/21; impact validation passed 12/12; all versioned plan validation
  passed; Expo Doctor passed 19/19; and `git diff --check` passed.
- Current failures: The first current-source persistence aggregate was 9/10;
  its only failure was the now-corrected `habit-reminder-permission-denied`
  Maestro scroll-direction test bug. Final source-SHA-matched persistence,
  lifecycle/action/delivery/Insights, D14, and broad QA evidence remain open.
- Previous failure: the no-override build failed at
  `react-native-worklets:buildCMakeRelWithDebInfo[x86_64]` with unresolved
  `std::__ndk1`/`std::bad_alloc`/`__cxa_*`/RTTI/thread symbols. Generated
  `build.ninja` had `ANDROID_STL=c++_shared` in the cache but the worklets
  link rule contained neither `-lc++` nor `libc++_shared.so`; CMake 3.22.1 was
  selected by the dependency default. CMake 3.30.5 and 3.31.6 alone
  reproduced the omission. A generated-app test with the explicit linker flag
  passed, and a clean prebuild now emits that flag in `android/app/build.gradle`.
  D14 current-source samples are not yet collected.
- Native persistence result: the initial 9/10 aggregate run passed every flow
  except `habit-reminder-permission-denied`. Its preserved screenshot showed
  the daily-schedule form already scrolled past the Reminder section; the flow
  used the wrong scroll direction for that default form. Changing only that
  Maestro step from `DOWN` to `UP` made the isolated flow pass, including the
  blocked-notifications assertion and no-reminder-after-save assertion. Treat
  the initial result as a TEST_BUG, not a product failure, and rerun the
  committed flow against an APK built from the post-fix source SHA.
- Relevant quarantines: Windows cannot run iOS/Xcode lanes; Android uses one
  existing emulator and serialized Maestro; visual notification-shade control
  may remain an explicit capability gap if the system UI is nondeterministic.
- Blockers: None established. The Android linker issue is fixed portably;
  current native lifecycle/action/delivery/Insights evidence and D14 remain
  open.
- Condition required to unblock: Produce a clean current-source diagnosis and
  either a reproducible portable fix or an evidence-backed exact toolchain
  repair; preserve an explicit blocker if neither is possible.
- Exact resume action after unblock: Install the APK recorded below, verify the
  package and source hash, then continue with the first unchecked native lane.
- Exact next action: commit the corrected permission-denied Maestro flow and
  checkpoint, rebuild/install the test APK from that new SHA, then run the
  serialized lifecycle/reminder-action lanes.
- Remaining definition of done: current-source Android build/install/native
  evidence; D14 classification and two-batch result or honest partial status;
  focused/broad QA and dependency/OpenSpec/plan/docs reconciliation; final
  diff/security audit; justified merge decision.

## Progress

- [x] Recover Git topology, campaign base, recovery branches, and worktrees.
- [x] Create dedicated stabilization branch/worktree.
- [x] Read repository, QA, native, feature, RN, data/sync, OpenSpec, and
      ExecPlan instructions.
- [x] Create and validate current stabilization baseline.
- [x] Inventory Nitro Android/JDK/SDK/CMake/NDK and generate native project.
- [x] Reproduce and classify the clean current-source Android build failure.
- [x] Repair compatible Android toolchain or portable repository configuration.
- [x] Build twice from clean generated state and produce/install the exact
      current APK; production APK SHA and source SHA were recorded.
- [x] Run the current-source smoke and persistence lanes; smoke passed and
      persistence passed 9/10 initially plus the corrected permission-denied
      flow in isolation.
- [ ] Rerun the corrected persistence flow from the post-fix source SHA, then
      run serialized current-source lifecycle,
      reminders, reminder actions, delivery, and Insights flows.
- [ ] Re-prove Habit Progress Insights and Habit Reminder Interactions parity.
- [ ] Re-establish D14/CG-4, profile/fix only if evidence supports it, and
      re-run CG-5/J8/Insights performance.
- [ ] Run dependency, lint/type, accessibility, sync/restore, simulation, web,
      and final QA matrices.
- [ ] Reconcile OpenSpec, known gaps, native/build docs, and all ExecPlans.
- [ ] Audit the cumulative diff and decide whether to merge to `main`.

## Surprises & Discoveries

- The original recovery checkout is dirty with dependency/package/patch edits,
  but the campaign worktree is clean; this stabilization worktree is clean and
  independent.
- Campaign documentation says a current-source Android APK was built only
  after ignored generated/dependency `-lc++_shared` edits; portability and
  source-SHA identity remain to be proven.
- Nitro currently has CMake 3.22.1 and 3.30.5 plus NDK 27.1.12297006; the
  generated project defaults to new architecture and the installed worklets
  and reanimated Gradle scripts pass `-DANDROID_STL=c++_shared` while both
  default their external CMake version to 3.22.1 unless overridden.
- The no-override clean build proves the worklets target receives
  `-DANDROID_STL=c++_shared`, but CMake 3.22.1 generates a link rule with
  `-llog`, ReactAndroid/jsi/fbjni/Hermes, `-latomic`, and `-lm` only. The
  expected shared C++ runtime is absent, matching every first-order unresolved
  symbol; this is not a missing app symbol or a stale APK issue.
- CMake 3.30.5 selected through `CMAKE_VERSION` changes the generated build
  directory but does not add the C++ runtime. The NDK toolchain maps legacy
  `ANDROID_STL` to CMake's canonical `CMAKE_ANDROID_STL_TYPE`, but the
  generated cache does not retain the latter and the standard-library link
  inputs remain only `-latomic -lm`; an explicit canonical-variable experiment
  is the next discriminating test.
- Repository guidance has historical version/count drift in secondary docs;
  current source and fresh command output will control final documentation.
- `habit-reminder-permission-denied` is a daily-schedule form case, unlike the
  custom-schedule reminder flows. Its form was already at the lower end of the
  modal after keyboard dismissal, so `scrollUntilVisible` needed `UP` to find
  the earlier Reminder control. The app's denied-permission message and save
  behavior passed once the flow used that direction.

## Decision Log

- 2026-08-13 — Branch from `campaign/post-integration-expansion@6287fab` rather
  than `main`, because the user explicitly scopes stabilization to the completed
  campaign and Git confirms that tip.
- 2026-08-13 — Use a sibling worktree and retain every existing worktree and
  recovery branch to prevent cross-session contamination.
- 2026-08-13 — Treat the installed APK and native results described in campaign
  docs as historical leads until a binary built from this branch's source SHA
  is installed and matched to the native test evidence.

## Validation Ledger

- 2026-08-13 — Git recovery inventory — PASS; campaign `6287fab`, main
  `15a1a92`, integration `aa63cb3`, recovery branches/worktrees preserved.
- 2026-08-13 — Required guidance reads — PASS; repository maps, rules,
  feature/RN/data skills, native QA, autonomous QA, OpenSpec/ExecPlan material
  read before implementation.
- 2026-08-13 — `npm ci` — PASS; 1,138 packages installed; npm reported 16
  advisories (6 moderate, 10 high); worktree-only simple-git-hooks `ENOTDIR`
  warning because `.git` is a worktree file.
- 2026-08-13 — `npm run typecheck` — PASS; zero TypeScript errors.
- 2026-08-13 — `npm run lint` — PASS; 0 errors and 19 warnings.
- 2026-08-13 — `npm test` — PASS; 740 tests across 70 files.
- 2026-08-13 — `npm run qa:integration` — PASS; 68 tests across 11 files.
- 2026-08-13 — `npm run qa:timezones` — PASS; 42 tests in each of Asia/Manila,
  UTC, America/New_York, Pacific/Honolulu, and Pacific/Kiritimati.
- 2026-08-13 — `npm run openspec:validate -- --strict` — PASS; 21/21.
- 2026-08-13 — `npm run qa:impact:validate` — PASS; 12 rules valid.
- 2026-08-13 — `npm run agent:plan:validate:all` — PASS; all 11 versioned
  plans valid.
- 2026-08-13 — `npx expo-doctor` — PASS; 19/19 checks.
- 2026-08-13 — `git diff --check` — PASS.
- 2026-08-13 — Android host inventory — PASS/PARTIAL; JDK 17.0.20, API 36,
  build-tools 36.0.0, platform-tools 37.0.1, CMake 3.22.1/3.30.5, NDK
  27.1.12297006, one `Nitro_API_36` AVD, and no connected device.
- 2026-08-13 — `npx expo prebuild --platform android --no-install` — PASS;
  generated a clean ignored Android project from this source; no committed
  `android/` directory exists.
- 2026-08-13 — generated native configuration inspection — PASS; new
  architecture and Hermes are enabled, Gradle 9.0.0 is configured, and the
  package/native dependency metadata was captured before the first build.
- 2026-08-13 — clean no-override Android release build — FAIL / ENVIRONMENT or
  dependency-toolchain — `react-native-worklets:worklets` for x86_64 failed
  after 3m36s using CMake 3.22.1 and NDK 27.1.12297006. First meaningful
  failures were unresolved C++ standard-library/ABI symbols; the generated
  worklets link rule omitted both `-lc++` and `libc++_shared.so` despite the
  `ANDROID_STL=c++_shared` argument. No APK was produced.
- 2026-08-13 — no-override failure artifact inspection — PASS; CMake cache,
  `build.ninja`, `build_model.json`, and `build_stdout_worklets.txt` agree on
  target, ABI, NDK, CMake, STL argument, and missing runtime link input.
- 2026-08-13 — Android toolchain/build — NOT RUN on this branch.
- 2026-08-13 — CMake/libc++ root-cause probe — PASS; CMake 3.22.1's installed
  Android-Common module adds only `-latomic -lm` for `c++_shared`; explicit
  `-DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared` produced a successful shared
  library link in a minimal probe. CMake 3.30.5 and 3.31.6 did not repair the
  omission by themselves.
- 2026-08-13 — generated-app candidate build — PASS; after adding the flag to
  the generated app `defaultConfig.externalNativeBuild`, the x86_64 release
  APK completed with the default CMake 3.22.1 and NDK 27.1.12297006.
- 2026-08-13 — portable configuration candidate — PASS;
  Expo prebuild plugin `withAndroidCxxRuntime` and six minimal patch-package
  patches were created, `npm ci` applied all patches successfully, and
  `npx expo prebuild --platform android --clean --no-install` regenerated the
  flag in the app Gradle file.
- 2026-08-13 — attempted second build via `gradlew clean app:assembleRelease`
  — NOT COUNTED; Gradle's native clean task reconfigured the old app CMake
  tree after codegen directories had been removed and failed on missing
  autolinking JNI directories. The prior APK path remained, so this result is
  explicitly excluded from Build B. The next attempt regenerates Android from
  scratch and verifies no APK exists before building.
- 2026-08-13 — Build A — PASS; after `npm ci` and clean Expo prebuild,
  `app:assembleRelease --no-daemon --no-build-cache
-PreactNativeArchitectures=x86_64` completed in 6m03s with CMake 3.22.1 and
  NDK 27.1.12297006. The app-level and dependency link steps completed with
  the explicit shared-runtime flag.
- 2026-08-13 — Build B — PASS; a second clean Expo prebuild confirmed no APK
  remained, then the same standalone release command completed in 5m00s.
  This is the first current-source Android build gate that is reproducible
  from `npm ci` and generated native state.
- 2026-08-13 — post-commit current-source build — PASS; commit `57c9366` was
  regenerated with clean Expo prebuild and assembled in 3m15s using the same
  x86_64/NDK configuration. The APK is now eligible for source-SHA identity
  and installation evidence.
- 2026-08-13 — current-source install/launch — PASS; APK SHA-256
  `79358E403B9BCF54255EF2C4AB03D996524701EEEC56485E2689896C2B7058B8`,
  package `com.dale16.superhabits`, version `1.0.0`, was installed with
  `adb -s emulator-5554 install -r -d -g` after verifying the source SHA
  `57c9366`. The existing `Nitro_API_36` target launched `MainActivity`.
- 2026-08-13 — current-source native smoke — PASS; the committed smoke flow
  completed all section navigation and Settings assertions against that APK.
- 2026-08-13 — current-source persistence lane — PARTIAL then TEST_BUG
  isolated; 9/10 flows passed. `habit-reminder-permission-denied` failed only
  because its daily-schedule form search used the wrong scroll direction. The
  preserved screenshot and hierarchy show the form at the bottom with the
  Reminder section above the visible viewport. After changing that one test
  step to `direction: UP`, the isolated flow passed end to end. A final
  post-commit rerun is required for source-SHA identity.
- 2026-08-13 — D14/CG-4 — NOT RUN for this stabilization branch.

## Changed Files / Areas

- `.agent/execplans/native-d14-stabilization.md` — durable state for this
  stabilization mission.
- `app.json`, `plugins/withAndroidCxxRuntime.js`, six native dependency
  patches, and `docs/testing/native-e2e.md` — portable Android C++ runtime
  linking fix and evidence.
- `.maestro/flows/habit-reminder-permission-denied.yaml` — corrected daily
  form scroll direction for the denied-notification persistence case.
- Future changes will be limited to evidence-backed Android/build, performance,
  test, accessibility, documentation, or safe dependency areas and listed here
  as they occur.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan completely.
2. Work only in `C:\Users\Michael Roy\Documents\super-habits-stabilization`.
3. Run `git status --short`, `git diff --stat`, `git diff --name-only`,
   `npm run agent:resume -- --plan .agent/execplans/native-d14-stabilization.md`,
   and inspect the latest QA/native artifacts.
4. Reconcile this checkpoint with Git; Git wins if narrative and files differ.
5. Continue from `Exact next action`, updating the checkpoint before every
   major build, native lane, profiling run, or broad QA phase.
6. Keep Android and Maestro work serialized on the existing `Nitro_API_36`
   emulator; stop task-owned heavy work before D14 measurements.
7. Before completion run strict OpenSpec, impact-map, all plan validation, the
   final diff/security audit, and this plan's validator.

## Outcomes & Retrospective

- Stabilization is still ACTIVE. The current-source CMake/libc++ blocker is
  resolved with a portable prebuild/plugin-plus-patch configuration, and clean
  build/install/smoke evidence exists. Native persistence is substantively
  green after correcting one test-flow direction, but the final source-SHA
  matched rerun and the remaining native, performance, and broad QA gates are
  still required.

- Status: Active.
- Summary: Stabilization work has not yet been executed.
- Follow-up: Populate this section with exact current-source evidence and the
  justified merge or remaining-blocker decision at task completion.
