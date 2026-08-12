# ExecPlan: Current-source Android and D14 stabilization

Plan-Version: 2
Status: COMPLETED

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

- Current milestone: The current-source Android build, serialized native
  regression gates, and two controlled D14 batches are green. The SDK/NDK unified CMake
  module receives `ANDROID_STL=c++_shared` but omits `libc++_shared` from
  shared-library link rules; an explicit
  `CMAKE_SHARED_LINKER_FLAGS=-lc++_shared` fixes both dependency and app
  codegen targets. The fix is represented by an Expo prebuild plugin and
  six minimal patch-package patches.
- Completed: Git topology recovered; campaign tip `6287fab`, main tip
  `15a1a92`, integration tip `aa63cb3`, and recovery worktrees preserved.
- Completed: Focused/broad web, sync, accessibility, dependency, simulation,
  and repository QA passed; docs, OpenSpec, and plans are reconciled before
  the separate final main-consolidation decision.
- In progress: None — stabilization implementation and evidence work is
  complete; final main consolidation is the next task.
- Important modified files: `app.json`,
  `plugins/withAndroidCxxRuntime.js`, six native dependency patches, native
  Maestro flows, native/build and known-gap docs, canonical/archive OpenSpec
  artifacts, and this ExecPlan. The originating recovery checkout has
  unrelated dirty edits that remain untouched.
- Last successful validation: `npm test` passed 740 tests/70 files; integration
  passed 68 tests/11 files; timezone QA passed 42 tests in each of five zones;
  typecheck passed; lint passed with 0 errors/19 warnings; strict OpenSpec
  passed 21/21; impact validation passed 12/12; all versioned plan validation
  passed; Expo Doctor passed 19/19; and `git diff --check` passed.
- Current failures: None in the stabilization scope. The initial 9/10
  aggregate was a TEST_BUG in the denied-permission flow and the corrected
  current-source rerun is green. iOS remains an expected Windows environment
  limitation, and framework-transitive audit advisories remain deferred.
- Previous failure: the no-override build failed at
  `react-native-worklets:buildCMakeRelWithDebInfo[x86_64]` with unresolved
  `std::__ndk1`/`std::bad_alloc`/`__cxa_*`/RTTI/thread symbols. Generated
  `build.ninja` had `ANDROID_STL=c++_shared` in the cache but the worklets
  link rule contained neither `-lc++` nor `libc++_shared.so`; CMake 3.22.1 was
  selected by the dependency default. CMake 3.30.5 and 3.31.6 alone
  reproduced the omission. A generated-app test with the explicit linker flag
  passed, and a clean prebuild now emits that flag in `android/app/build.gradle`.
- D14 current-source samples are recorded below from two independent batches.
- Native persistence result: the initial 9/10 aggregate run passed every flow
  except `habit-reminder-permission-denied`. Its preserved screenshot showed
  the daily-schedule form already scrolled past the Reminder section; changing
  only that Maestro step from `DOWN` to `UP` made the isolated flow pass. The
  committed post-fix APK rerun is `10/10`.
- Native current-source result: smoke, persistence (`10/10`), lifecycle/action
  (`5/5`), real notification-manager delivery, current-source Insights
  open/metrics/history/close/reopen, and direct System UI shade actions passed
  from `b3a5a2e`. Mark Complete routed to the named habit and produced `1 of 1
scheduled`; a repeated tap remained at one. Snooze produced an app-owned
  Expo alarm at `+14m54.893s`.
- Relevant quarantines: Windows cannot run iOS/Xcode lanes; Android uses one
  existing emulator and serialized Maestro. The shade evidence uses semantic
  System UI hierarchy discovery and coordinate activation only at the OS UI
  boundary.
- D14 result: Two independent 10-run controlled batches passed the unchanged
  `maxSwitch <= 800ms` assertion. Batch A was `759, 747, 758, 773, 735, 735,
752, 765, 753, 745ms` (min 735, median 752.5, P90 765, max 773, 10/10).
  Batch B was `743, 763, 755, 767, 751, 744, 733, 770, 756, 746ms` (min
  733, median 753, P90 767, max 770, 10/10). The same runs kept CG-5 diary
  search at 372–420ms and the saved-meal picker at 75–84ms, both under 500ms.
- D14 classification: ENVIRONMENT/HOST-SENSITIVE, not PRODUCT_BUG. The
  earlier misses were not reproduced after native/build work stopped and one
  browser worker ran on isolated port 8097; the current product path has a
  27ms worst-case margin across 20 valid repetitions. No D14 code change was
  made, and the benchmark fixture, threshold, assertion, and retry policy are
  unchanged.
- Blockers: None established for Android build, current-source native QA, D14,
  broad QA, or repository reconciliation. iOS remains outside this Windows
  workstation's capability.
- Condition required to unblock: Not applicable — no stabilization blocker
  remains.
- Exact resume action after unblock: None — use the final consolidation plan
  for the next task.
- Exact next action: None — stabilization is complete; proceed to the separate
  final-main-consolidation plan and merge decision.
- Remaining definition of done: No remaining work in this stabilization plan.
  Final main
  consolidation must independently validate the selected descendant on
  `main`, prove ancestry/content coverage, run main QA, and synchronize
  `origin/main` when permitted.

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
- [x] Run the current-source smoke and persistence lanes; the exact post-fix
      APK passed smoke and persistence `10/10`.
- [x] Run serialized current-source lifecycle, reminder actions/replay,
      notification delivery, and direct notification-shade action evidence.
- [x] Re-prove Habit Progress Insights and Habit Reminder Interactions parity
      with a semantic native flow and exact-source system UI evidence.
- [x] Re-establish D14/CG-4 in two independent controlled 10-run batches;
      classify the old misses as environment/host-sensitive and recheck CG-5
      and J8 in the same unchanged HEAVY runs.
- [x] Run focused Habit Insights performance/accessibility checks.
- [x] Run dependency, lint/type, accessibility, sync/restore, simulation, web,
      and final QA matrices.
- [x] Reconcile OpenSpec, known gaps, native/build docs, and all ExecPlans.
- [x] Audit the cumulative diff and hand the validated descendant to the
      separate final-main-consolidation task.

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
  step to `direction: UP`, the isolated flow passed end to end.
- 2026-08-13 — post-fix current-source APK — PASS; source SHA `b3a5a2e`,
  test-build APK SHA-256
  `CDA600F1A1386AD8268342271CFF850B98FBF74F605B57F581027FEF77F91A61`,
  package `com.dale16.superhabits`, version `1.0.0`, versionCode `1`,
  x86_64/API 36, installed on `emulator-5554` after clean prebuild. This
  build includes `EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST=true` for the native
  action controls.
- 2026-08-13 — post-fix current-source persistence — PASS; `npm run
qa:native:targeted` completed `10/10` flows in 7m43s. Report
  `simulation-output/native/native-android-persistence-2026-08-12T214333706Z.json`
  records `gitSha=b3a5a2e`.
- 2026-08-13 — post-fix current-source lifecycle — PASS; `npm run
qa:native:lifecycle` completed `5/5` flows in 3m35s, including reminder
  action routing, replay, delivery, and Pomodoro isolation. Report
  `simulation-output/native/native-android-lifecycle-2026-08-12T214730799Z.json`
  records `gitSha=b3a5a2e`.
- 2026-08-13 — current-source real notification delivery — PASS; the real
  scheduling flow posted `Native delivery habit` / `Time to complete your
habit.` in Android's notification manager after app termination. Report
  `simulation-output/native/habit-reminder-delivery-2026-08-12T215759038Z.json`.
- 2026-08-13 — current-source Android shade Mark Complete — PASS; System UI
  hierarchy exposed semantic buttons `Mark complete` at `[147,841][512,967]`
  and `Snooze` at `[523,841][726,967]`. A fresh delivered notification action
  cold-started `MainActivity`, routed to `Native delivery habit`, and after
  closing the focused editor the list showed `1 of 1 scheduled`. Repeating
  the same action left the count at one, consistent with exactly-once
  notification-action handling.
- 2026-08-13 — current-source Android shade Snooze — PASS; a fresh delivered
  notification's semantic `Snooze` action resumed the app and
  `adb shell dumpsys alarm` showed an app-owned
  `expo.modules.notifications.NOTIFICATION_EVENT` alarm with requester
  `+14m54s893ms`, matching the fixed 15-minute replacement.
- 2026-08-13 — current-source Habit Progress Insights — PASS; new semantic
  flow `.maestro/flows/habit-progress-insights.yaml` created a habit, recorded
  one completion, opened the progress modal, asserted current/longest streak,
  scheduled completion rate, recent target-vs-actual history and `Target met`,
  then closed and reopened the modal. Report
  `simulation-output/native/native-android-all-2026-08-12T220002956Z.json`
  records `gitSha=b3a5a2e`.
- 2026-08-13 — current-source exact smoke rerun — PASS; the smoke flow passed
  all six section navigations and Settings open/close on the installed APK.
  Report `simulation-output/native/native-android-all-2026-08-12T220059910Z.json`
  records `gitSha=b3a5a2e`.
- 2026-08-13 — D14/CG-4 Batch A — PASS; after stopping the task-owned Android
  emulator and confirming no task-owned server/build process remained, the
  unchanged HEAVY J8 journey ran serially on isolated E2E port 8097 for 10
  valid repetitions. Max-switch samples were
  `759,747,758,773,735,735,752,765,753,745ms`; min 735, median 752.5, P90
  765, max 773, pass 10/10. CG-5 diary search was 372–392ms and picker
  search 75–84ms; all seven J8 steps passed in every repetition.
- 2026-08-13 — D14/CG-4 Batch B — PASS; an independent serial 10-repetition
  run under the same unchanged fixture/threshold/assertions produced
  `743,763,755,767,751,744,733,770,756,746ms`; min 733, median 753, P90
  767, max 770, pass 10/10. CG-5 diary search was 373–420ms and picker
  search 75–82ms; all seven J8 steps passed in every repetition.
- 2026-08-13 — D14 classification — ENVIRONMENT/HOST-SENSITIVE; the old
  misses were not reproducible once native/build activity stopped and the
  benchmark ran with one browser worker on port 8097. The current path has a
  27ms worst-case margin across 20 valid repetitions. No product performance
  code or benchmark contract was changed.
- 2026-08-13 — focused web Insights/accessibility — PASS; `e2e/habits.spec.ts`
  passed 11/11, including exact-habit Insights accessibility, M/W/F off-day
  neutrality, schedule edits, reminder persistence, and historical target
  edits. Full Vitest coverage includes current-day grace, creation boundary,
  target >1, zero eligible windows, and timezone-safe domain cases.
- 2026-08-13 — deterministic simulation — PASS; all 17 scenarios passed in
  345.8 seconds on isolated E2E port 8097.
- 2026-08-13 — P0 journeys — PASS; 16/16 steps passed.
- 2026-08-13 — full E2E aggregate — PASS; 153 passed and 17 documented
  environment/opt-in skips across 170 tests; the HEAVY J8 row passed with
  maxSwitch 745ms in this run.
- 2026-08-13 — sync/restore boundary — PASS; `npm run e2e:sync` passed 19/19
  against the dummy-Supabase `dist-sync` build.
- 2026-08-13 — dependency health — PASS/PARTIAL; Expo Doctor 19/19. `npm
audit` remains at 16 framework-transitive advisories (6 moderate, 10 high);
  available automatic fixes require Expo 53 or React Native 0.72 major
  downgrades and were deferred.
- 2026-08-13 — OpenSpec archival — PASS; `add-habit-progress-insights` was
  archived as `2026-08-13-add-habit-progress-insights` and its canonical
  `openspec/specs/habit-progress-insights/spec.md` was created.
- 2026-08-13 — documentation and plan reconciliation — PASS; native shade,
  Android build, Insights parity, D14 classification, and remaining platform
  gaps now reflect current evidence; strict OpenSpec and all plan validators
  pass.

## Changed Files / Areas

- `.agent/execplans/native-d14-stabilization.md` — durable state for this
  stabilization mission.
- `app.json`, `plugins/withAndroidCxxRuntime.js`, six native dependency
  patches, and `docs/testing/native-e2e.md` — portable Android C++ runtime
  linking fix and evidence.
- `.maestro/flows/habit-reminder-permission-denied.yaml` — corrected daily
  form scroll direction for the denied-notification persistence case.
- `.maestro/flows/habit-progress-insights.yaml` — current-source semantic
  native Insights parity flow.
- `docs/testing/known-gaps.md` — current Android shade and remaining-capability
  classification.
- `openspec/specs/habit-progress-insights/` and
  `openspec/changes/archive/2026-08-13-add-habit-progress-insights/` —
  canonical spec and completed change archive.
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

- The current-source Android build is reproducible from clean Expo-generated
  state with NDK `27.1.12297006` and CMake `3.22.1`; the portable fix avoids
  machine-specific paths and does not commit generated Android output.
- Native current-source evidence is green for smoke, 10/10 persistence, 5/5
  lifecycle/action flows, real notification delivery, direct Android shade
  Mark Complete/Snooze proof, and Insights open/metrics/history/close/reopen.
- D14/CG-4 is closed under controlled conditions with two independent 10/10
  batches and unchanged contract/fixture/assertions. The honest classification
  is host-sensitive rather than a product regression.
- The only native failure discovered was a test-flow scroll-direction bug in
  the denied-permission case; it was corrected without weakening the product
  assertion and the committed aggregate rerun is 10/10.
- Habit Progress Insights is complete, its canonical spec is created, and its
  change is archived. The stabilization handoff is ready for final main
  consolidation; no unrelated feature work was started.
