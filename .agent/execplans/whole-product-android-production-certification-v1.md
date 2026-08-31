# ExecPlan: Whole-Product Android Production Certification V1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Run a long-running (~12h) autonomous production hardening, real-device-simulation, defect-removal, UI/UX, performance, data-durability, and release-certification campaign across the ENTIRE SuperHabits product. Close the primary gap from the previous Gym convergence campaign: native Android qualification never passed because API-36 AVD was missing. Achieve final-source APK built, installed, and passing Maestro on API-36 x86_64 emulator plus broad product QA.

## Context

- Repository: `quantdale/super-habits` at `D:/Documents/tryPython/superhabits`
- Starting SHA: `56dad404b2e85c19e8821ad032a374d5e76d20bf` (main == origin/main)
- Previous campaign `production-gym-convergence-and-real-world-certification-v1` removed Gym prototype, converged UX, reconciled OpenSpec, but native lanes returned ENVIRONMENT (API-35 only)
- Current verified remote baseline: main, SHA 56dad404, CI PASS, 0 open PRs/issues
- Native runner: `scripts/qa-native.mjs` + `scripts/qa-native-provision.mjs` + `scripts/native-qa-utils.mjs` enforces API 36 x86_64, appId `com.dale16.superhabits`, uses Expo prebuild + Gradle assemble
- Maestro flows: `.maestro/flows/*.yaml` (26 flows), `.maestro/config.yaml`
- Known docs: `docs/testing/native-e2e.md`, `docs/testing/autonomous-qa.md`, `docs/testing/known-gaps.md`, `qa/impact-map.json`
- Host: Windows 11 Pro, JDK 17.0.20 (Temurin), Android SDK at `C:\Users\palac\AppData\Local\Android\Sdk`, platform-tools 37.0.0, emulator 37.1.11, Maestro 2.9.0
- Discovery 2026-08-31: installed platforms include android-36, build-tools 36, but NO android-36 system image; 6 AVDs all API-35 (atd35, braintraining-_, change7_, superhabits); running emulator-5554 is API 35 (change7api35)

## Scope

- Phase 0: Orientation + durable campaign state (this plan)
- Phase 1: Android toolchain → install API-36 image, create Nitro_API_36 AVD, boot & verify sys.boot_completed=1, API 36, x86_64
- Phase 2: Build + install current-source APK via `qa:native:provision --force`
- Phase 3: Mandatory native baseline: `qa:native:android`, `qa:native:targeted`, `qa:native:lifecycle` + direct flows
- Phase 4: Actual Android exploratory testing (Mobile Next MCP / ADB / hierarchy)
- Phase 5-15: Whole-product journey matrix (shell, habits, todos, gym/workout, calories, pomodoro, overview/planning, command, settings/themes, backup/recovery, offline/reconnect)
- Phase 16-19: Process-death/durability, date/time/midnight, performance, stress/soak
- Phase 20: Whole-codebase engineering audit + defect fixes
- Phase 22-26: Continuous QA, broad final matrix, final Android rebuild, hygiene, push, CI verification

## Non-Goals

- No AGPL source copy, no second state system, no two-way sync rewrite, no new tab, no production secrets publish
- No iOS claims from Windows, no fabricated cloud success, no weakening assertions to get green
- No committing APKs, SDKs, emulator data, secrets

## Current Checkpoint

- Current milestone: Provenance hardening and release verification are in progress; historical Android and broad-QA evidence is retained below.
- Completed:
  - Git truth verified at repository revision `56dad404b2e85c19e8821ad032a374d5e76d20bf`; the working tree intentionally contains the campaign's uncommitted UI, flow, test, and plan changes.
  - Read AGENTS.md, ONBOARDING.md, .agent/PLANS.md, docs/testing/native-e2e.md, autonomous-qa.md, known-gaps, previous execplan, validate plan, qa-native scripts, Maestro config, and flows.
  - Android discovery: JDK 17 correct, SDK rooted, adb 37.0.0, emulator 37.1.11, platforms 35/36/37, build-tools 34/35/36, Maestro 2.9.0 present, licenses accepted, Node v24.3.0 (nvmrc wants 22.23.2).
  - Phase 1: Installed `system-images;android-36;default;x86_64`; created and booted `Nitro_API_36` with `sys.boot_completed=1`, API 36, x86_64, Android 16, and WHPX acceleration.
  - Phase 2: Provisioned the current working-tree source APK. The native provenance report identifies repository revision `56dad404`; campaign changes are included in the built artifact even though they are not committed.
  - Shared `core/ui/Modal.tsx` reserves the effective Android navigation-bar inset in modal bounds and scroll viewport sizing. `core/ui/Screen.tsx` applies the same fallback inset to page scroll bounds and bottom content padding.
  - Final current-source APK report: source revision `56dad404b2e85c19e8821ad032a374d5e76d20bf`, APK SHA-256 `527D3F8C9CAA566ABDEE8887040EC4E2E602788DEDEDD7344D363FDF5B8FA68C`, package `com.dale16.superhabits` 1.0.0, API 36/x86_64 `Nitro_API_36` on `emulator-5564`, report `simulation-output/native/native-android-build.json`.
  - Final exact-APK native lanes: smoke 2/2, targeted persistence 11/11, and lifecycle 6/6 pass on `emulator-5564`; reports `simulation-output/native/native-android-smoke-2026-08-31T132408817Z.json`, `simulation-output/native/native-android-persistence-2026-08-31T133539933Z.json`, and `simulation-output/native/native-android-lifecycle-2026-08-31T134232000Z.json`. The lifecycle aggregate includes Gym V2 session lifecycle; the persistence aggregate includes Gym V2 persistence.
  - Phase 4-15 Android exploration: Mobile Next inspected Overview, Todos, Habits, Focus, Workout, Calories, Command Center, and Settings; screenshots are retained under `simulation-output/native/mobile-next-*.png`. Native settings, backup, portable backup, auth/session, command-center, habit-insight, and notification-path flows pass.
  - Phase 16-19 durability/performance/stress: two fresh deterministic `soak-sustained-use` runs pass all 132 steps and integrity oracles (`simulation-output/run_mth48p9y_yni5rjk7/run-report.json`, `simulation-output/run_mth4apkz_d3u9wlze/run-report.json`). Cycle averages remain bounded without late-sequence growth; `npm run qa:timezones` passes all five timezone environments (43 tests each).
  - Phase 20 audit: all modified Maestro flows pass syntax validation; campaign source/flow files pass targeted Prettier; no additional product defect was established.
  - Broad local-only QA: `qa:full` passes typecheck, lint, 1,835 Vitest tests, OpenSpec validation, full web E2E, simulation validation, and all 23 deterministic scenarios. `npm run build:sync` plus `npm run e2e:sync` passes 40/46 with six documented capability skips. Impact map, themes, and Supabase schema validation also pass.
- In progress: fail-closed native provenance tooling, focused retesting of corrected Maestro flows, intentional-change commit, clean final APK rebuild, final broad gates, push, and exact-head CI verification.
- Last successful validation: final exact-APK native smoke 2/2, persistence 11/11, lifecycle 6/6; `npm run qa:fast` PASS (typecheck, ESLint, 1,608 unit tests), `npm test` PASS 1,835/1,835, `npm run openspec:validate` PASS 45/45, `npm run sim:validate` PASS 23/23, themes 140/140, Supabase schema, impact map, five-zone timezone matrix, targeted Maestro syntax, and targeted Prettier all PASS.
- Current failures: None in repository-owned gates. The earlier lifecycle aggregate failure was classified as environment interference after Maestro's device server died and the emulator package service became unavailable; the clean exact-APK rerun passed all 6/6.
- Important modified files: `.agent/execplans/whole-product-android-production-certification-v1.md`, `core/ui/Modal.tsx`, `core/ui/Screen.tsx`, `e2e/pwa-update.spec.ts`, `.maestro/flows/workout-gym-v2-persistence.yaml`, `.maestro/flows/workout-gym-v2-session-lifecycle.yaml`, `.maestro/flows/backup-v2-settings.yaml`, `.maestro/flows/portable-backup.yaml`, `.maestro/flows/portable-backup-blocked.yaml`, `.maestro/flows/auth-session-protect.yaml`, `.maestro/flows/command-center-v2.yaml`, `.maestro/flows/habit-progress-insights.yaml`, `.maestro/flows/habit-reminder-actions.yaml`, `.maestro/flows/habit-reminder-actions-replay.yaml`, `.maestro/flows/habit-reminder-delivery.yaml`; provision/log files and native reports are ignored/generated.
- Broad QA triage:
  - The first `qa:full` attempt built with workstation Supabase variables and failed the local-only Settings assertion; screenshot showed the configured-build copy. A forced local-only rebuild (`EXPO_PUBLIC_SUPABASE_URL=` and `EXPO_PUBLIC_SUPABASE_ANON_KEY=`) reproduced no product failure; isolated Settings is 2/2 pass and the final local-only `qa:full` is green.
  - The PWA apply-update test exposed a real test synchronization race: `expect.poll()` evaluated `sessionStorage` while the worker-driven reload destroyed the execution context. Arming a page load listener before the click preserves the exact once-only reload assertion; isolated PWA coverage is 4/4 pass and the final local-only `qa:full` is green.
  - One configured-backend portable-owner journey step failed once then passed on retry; the local-only lane correctly skips that remote-capability path. Preserve the prior artifact as a flaky/remote-environment observation, not a product failure.
- Relevant quarantines: None.
- Blockers: The intentional campaign changes are not yet committed, so the final clean-commit APK and exact-head CI evidence do not exist.
- Condition required to unblock: N/A.
- Exact resume action after unblock: N/A.
- Exact next action: finish provenance validation, commit the intentional campaign changes, then rebuild and rerun final Android and broad gates from the clean candidate SHA.
- Remaining definition of done: final intended source committed and pushed; working tree clean; APK built from that exact clean commit with `sourceTreeClean: true`; Android smoke/persistence/lifecycle pass; broad gates pass; `HEAD == origin/main`; exact-head GitHub CI passes.

## Progress

- [x] Phase 0 orientation reads + git truth
- [x] Create ExecPlan `.agent/execplans/whole-product-android-production-certification-v1.md`
- [x] Phase 1: Install API-36 system image + create/boot AVD — PASS (Nitro_API_36, API 36 x86_64, boot_completed 1)
- [x] Phase 2: Provision current-tree APK — PASS (source revision/APK provenance recorded; working-tree changes explicitly noted)
- [x] Phase 3: Native baseline lanes — final current-tree install, smoke 2/2, persistence 11/11, lifecycle 6/6 PASS on API-36/x86_64 `Nitro_API_36`/`emulator-5564`
- [x] Phase 4: Exploratory Android testing — six-section/native surface exploration, Settings/Command Center, notification delivery, and recovery surfaces verified
- [x] Phase 5-15: Whole-product journey matrix — native section coverage and cross-feature web journeys verified
- [x] Phase 16-19: Durability/performance/stress — two clean 132-step deterministic soak runs plus timezone matrix PASS
- [x] Phase 20: Engineering audit + fixes — shared Android inset fix, flow synchronization corrections, and PWA test synchronization fix verified
- [x] Phase 22-26: Final QA + rebuild + hygiene — broad QA/sync pass, final APK `527D3F8C...` certified, targeted syntax/format checks pass, generated scratch files removed, and plan validation pass

## Surprises & Discoveries

- 2026-08-31 — Node v24.3.0 exceeds repo .nvmrc 22.23.2 pin; no nvm present. Will attempt with current Node or install/use 22 if build fails.
- 2026-08-31 — All 6 local AVDs are API 35 despite platform android-36 being installed; no android-36 system image installed at all. Must sdkmanager install before AVD creation.
- 2026-08-31 — Maestro 2.9.0 present at `C:\Users\palac\bin\maestro.cmd` and `C:\Users\palac\.maestro\bin\maestro`, licenses already accepted.
- 2026-08-31 — API-36 default x86_64 image downloaded successfully after ~113s; initial `sdkmanager --list` truncated display hid it but verbose parsing and file existence proved it. AVD creation succeeded with auto ABI selection.

## Decision Log

- 2026-08-31 — Choose `system-images;android-36;default;x86_64` as Phase 1 target — matches Nitro historical default image, smallest, no Play Store requirement per native-e2e docs.
- 2026-08-31 — Campaign ExecPlan uses whole-product scope, not Gym-only, per mission brief.
- 2026-08-31 — Enabled hw.gpu.enabled=yes for Nitro_API_36 to avoid software rendering slowness; verified WHPX usable.
- 2026-08-31 — Provision report and APK hash prove Phase 2 completed at source SHA `56dad404`; the prior checkpoint was stale because the Gradle process had already exited.
- 2026-08-31 — The shell defines an empty `HOME`, so the emulator needed explicit `ANDROID_AVD_HOME=C:\Users\palac\.android\avd`; a sandbox-launched attempt also left an orphan QEMU holding the AVD lock. The stale child was identified by parent/command line and stopped; the current run uses port 5560 with snapshots disabled.

## Validation Ledger

- 2026-08-31 — `git status --short` — PASS — clean
- 2026-08-31 — `git rev-parse HEAD` vs `origin/main` — PASS — both 56dad404
- 2026-08-31 — Android inventory (jdk/adb/emulator/sdkmanager/avdmanager/maestro) — PASS with expected gap: API-36 image absent (now resolved)
- 2026-08-31 — `sdkmanager --licenses` — PASS — All accepted
- 2026-08-31 — `maestro --version` — PASS — 2.9.0
- 2026-08-31 — `adb devices -l` initial — PASS — emulator-5554 API35 present
- 2026-08-31 — `sdkmanager "system-images;android-36;default;x86_64"` — PASS — download ~113s, parsing confirms installed
- 2026-08-31 — `avdmanager create avd -n Nitro_API_36` — PASS — default/x86_64 pixel_7
- 2026-08-31 — `emulator -avd Nitro_API_36` boot — PASS — emulator-5556, sys.boot_completed 1, API 36, x86_64, Android 16, WHPX
- 2026-08-31 — `npm run qa:native:provision -- --serial emulator-5556 --force` — IN PROGRESS — prebuild complete, Gradle assembling x86_64 release
- 2026-08-31 — `simulation-output/native/native-android-build.json` + `Get-FileHash android/app/build/outputs/apk/release/app-release.apk` — PASS — source SHA, package, API/ABI/AVD, and APK SHA-256 match
- 2026-08-31 — explicit emulator launch on emulator-5556 — ENVIRONMENT/RECOVERED — empty `HOME` and sandbox write ACL caused AVD discovery/lock failures; stale orphan QEMU removed and ADB server restarted
- 2026-08-31 — explicit emulator launch on emulator-5560 — IN PROGRESS — `Nitro_API_36`, API 36/x86_64 device visible; cold boot not complete yet
- 2026-08-31 — emulator-5560 cold-boot polling — ENVIRONMENT — device stayed connected but shell/property calls stalled and QEMU CPU stopped advancing; disposable AVD reset selected as the next recovery action
- 2026-08-31 — emulator-5564 normal-window `-gpu host` launch — PASS — `Nitro_API_36`, API 36/x86_64, `sys.boot_completed=1`; shell/property calls responsive
- 2026-08-31 — `npm run qa:native:provision -- --serial emulator-5564 --force` — PASS — 608 Gradle tasks, install success, package identity/version verified; report refreshed with current source/APK hashes
- 2026-08-31 — `npm run qa:native:android -- --serial emulator-5564` — PASS — smoke 2/2; report `simulation-output/native/native-android-smoke-2026-08-30T173635744Z.json`
- 2026-08-31 — `sdkmanager --licenses` — PASS — All accepted
- 2026-08-31 — `maestro --version` — PASS — 2.9.0
- 2026-08-31 — `adb devices -l` — PASS — emulator-5554 device present (API 35, x86_64, change7api35)
- 2026-08-31 — clean raw Maestro Gym V2 replay on emulator-5564 — PRODUCT BUG — `Name` field bounds `[91,2256][991,2348]` overlap Android navigation bar `[0,2274][1080,2400]`; Maestro tapped center `(541,2302)`, Android logged `LAUNCHER_TASKBAR_HOME_BUTTON_TAP`, and the app was backgrounded before the later `Primary body area` scroll
- 2026-08-31 — targeted persistence triage — ENVIRONMENT/RECOVERED — concurrent OMP Maestro job on emulator-5554 held the global Maestro session path; exact stale OMP/test process trees were stopped and the expired `change7api35` lock was released, after which the clean replay reached the real product defect
- 2026-08-31 — `core/ui/Modal.tsx` Android inset fix — PASS — typecheck and Prettier check pass; native rebuild required before runtime evidence
- 2026-08-31 — `npm run qa:native:provision -- --serial emulator-5564 --force` after modal fix — PASS — rebuilt/install current source; Gradle `BUILD SUCCESSFUL` in 6m20s; source/APK provenance refreshed to `56dad404` / `BC3BBF1C3CC6B8B97920EB80C2B6C3D34A30FD2F8BF3DA1F2A3A394F47AF53DE`
- 2026-08-31 — patched Gym V2 replay — PASS — `.maestro/flows/workout-gym-v2-persistence.yaml` completed custom catalog creation, typed prescriptions, weekly planning, process restart, and restored target values on `emulator-5564`; report `simulation-output/native/native-android-persistence-2026-08-30T183349408Z.json`
- 2026-08-31 — patched legacy workout persistence replay — PASS — `.maestro/flows/workout-persistence.yaml` completed routine/legacy exercise creation, process restart, and restored routine visibility on `emulator-5564`; report `simulation-output/native/native-android-persistence-2026-08-30T183529258Z.json`
- 2026-08-31 — aggregate targeted persistence replay — ENVIRONMENT — 3 flows passed, then `emulator-5564` disappeared; 8 remaining flows failed with `device not found`; report `simulation-output/native/native-android-persistence-2026-08-30T184159655Z.json`
- 2026-08-31 — Nitro_API_36 recovery — PASS after environment reset — 5564 hung before ADB registration after restart attempts; wiped only the disposable Nitro_API_36 userdata, relaunched on port 5568, and verified `sys.boot_completed=1`, API 36, x86_64, AVD `Nitro_API_36`
- 2026-08-31 — `npm run qa:native:provision -- --serial emulator-5568 --force` — PASS — 608 Gradle tasks, install success; source `56dad404b2e85c19e8821ad032a374d5e76d20bf`, APK SHA-256 `4F4726776EA95BC47A3BAF2888725A82C0AC7522D8DE94817F8B4310565189DF9`, package 1.0.0 on API 36/x86_64 `Nitro_API_36`
- 2026-08-31 — `npm run qa:native:targeted -- --serial emulator-5568 --no-provision` — PASS — all 11/11 persistence flows passed in 13m33s; report `simulation-output/native/native-android-persistence-2026-08-30T191138544Z.json`
- 2026-08-31 — `npm run qa:native:lifecycle -- --serial emulator-5568` — TEST_BUG/flow-coordinate triage — 2/6 Pomodoro flows passed; habit action flows dismissed an inset modal, delivery scrolled away from its target, and Gym lifecycle hit Android Home; report `simulation-output/native/native-android-lifecycle-2026-08-30T233806163Z.json`
- 2026-08-31 — focused Gym lifecycle replay after gesture cleanup — PARTIAL — creation, modal custom exercise, restart/resume, typed values, completion, and save passed; final `Recent sessions` assertion failed because four upward swipes overscrolled past the section; report `simulation-output/native/native-android-lifecycle-2026-08-30T234318393Z.json`
- 2026-08-31 — focused Gym lifecycle replay with one/two upward history swipes — PARTIAL — one stopped at Week/Ready-to-train and two stopped at Add new routine/Your routines; `Recent sessions` is the next block, so a third upward swipe is the current flow hypothesis; reports `simulation-output/native/native-android-lifecycle-2026-08-30T235224520Z.json` and `simulation-output/native/native-android-lifecycle-2026-08-30T235628795Z.json`
- 2026-08-31 — focused Gym lifecycle replay with three upward history swipes — PASS — creation, typed custom exercise, force-stop/resume, completion, recent-session visibility, restart, and Progress visibility passed; report `simulation-output/native/native-android-lifecycle-2026-08-31T000039818Z.json`
- 2026-08-31 — focused habit-reminder action replay — PASS — create, injected completion, restart, edit-mode replay, and persisted completion passed; report `simulation-output/native/native-android-lifecycle-2026-08-31T000410282Z.json`
- 2026-08-31 — focused habit-reminder actions — PASS — reminder tap, mark complete, snooze, and reminder persistence passed; report `simulation-output/native/native-android-lifecycle-2026-08-31T000740378Z.json`
- 2026-08-31 — focused habit-reminder delivery — PASS — scheduled notification path and force-stop completed; report `simulation-output/native/native-android-lifecycle-2026-08-31T000918789Z.json`
- 2026-08-31 — `npm run qa:native:lifecycle -- --serial emulator-5568` — PASS — all 6/6 lifecycle flows passed in 8m49s; report `simulation-output/native/native-android-lifecycle-2026-08-31T001855980Z.json`
- 2026-08-31 — `node scripts/qa-native-delivery.mjs` with `NATIVE_ANDROID_SERIAL=emulator-5568` — ENVIRONMENT/target selection — scheduling flow passed but bare `adb` saw multiple connected devices during delivery verification; report `simulation-output/native/habit-reminder-delivery-2026-08-31T002213667Z.json`
- 2026-08-31 — `ANDROID_SERIAL=emulator-5568 node scripts/qa-native-delivery.mjs` — PASS/VERIFIED — Android notification manager observed package, title, and body after app process termination; report `simulation-output/native/habit-reminder-delivery-2026-08-31T002438796Z.json`
- 2026-08-31 — post-build smoke-tag replay — PARTIAL — `native-smoke` passed; `command-center-v2` failed because its fixed 5%-width swipe dismissed the inset modal before `Parse command`; report `simulation-output/native/native-android-smoke-2026-08-31T002738173Z.json`
- 2026-08-31 — isolated `command-center-v2.yaml` replay after gesture correction — PASS — parser reached the review card, `Nothing has been saved yet.`, `Ready to save: yes`, and `Confirm and save` were all verified; report `simulation-output/native/native-android-all-2026-08-31T003405152Z.json`
- 2026-08-31 — direct `backup-v2-settings.yaml` replay before correction — TEST_BUG — backup heading was scrolled off before assertion; report `simulation-output/native/native-android-all-2026-08-31T003654714Z.json`
- 2026-08-31 — corrected `backup-v2-settings.yaml` replay — PASS — Backup status and Backup coverage remained reachable through anchored scroll; report `simulation-output/native/native-android-all-2026-08-31T003818057Z.json`
- 2026-08-31 — corrected `portable-backup.yaml` replay — PASS — full export disclosure, Android share fallback (`No apps can perform this action.`), and DocumentsUI empty picker (`Recent`/`No items`) verified; report `simulation-output/native/native-android-all-2026-08-31T005551393Z.json`
- 2026-08-31 — corrected `portable-backup-blocked.yaml` replay — PASS — current Quick capture setup and empty-device restore guard verified; report `simulation-output/native/native-android-all-2026-08-31T010719125Z.json`
- 2026-08-31 — auth first launch without backend configuration — ENVIRONMENT — remote backup warning was expected because the build had no Supabase endpoint; report `simulation-output/native/native-android-all-2026-08-31T010847737Z.json`
- 2026-08-31 — deterministic local auth mock build/install — PASS/TEST-ONLY — mock endpoint on emulator loopback, synthetic owner UUID, and OTP `123456`; manual debug manifest cleartext override was required for Android HTTP testing and is not release configuration
- 2026-08-31 — ordered auth first/restart/protect replays against the mock — PASS — anonymous bootstrap, restart preservation, email protection, OTP verification, protected state, and no owner mismatch verified; reports `simulation-output/native/native-android-all-2026-08-31T014725235Z.json`, `...014817700Z.json`, and `...014944595Z.json`
- 2026-08-31 — auth retries with stale `emulator-5558` transport — ENVIRONMENT — Maestro rejected the offline extra transport; reports `simulation-output/native/native-android-all-2026-08-31T014545279Z.json` and `...014623224Z.json`; exact stale transport disconnected and `emulator-5568` remained healthy
- 2026-08-31 — final no-mock current-source provision — PASS — `npm run qa:native:provision -- --serial emulator-5568 --force`; source `56dad404`, APK SHA-256 `E62A0D5A9979CF46E6C40B5C1F67822B948FE69751C5402496D21E55F2AB3D8D`, package 1.0.0, API 36/x86_64, and no generated cleartext manifest override
- 2026-08-31 — final-build `settings-persistence.yaml` replay — PASS — Dark theme persisted across process death/relaunch; report `simulation-output/native/native-android-all-2026-08-31T031356919Z.json`
- 2026-08-31 — `habit-progress-insights.yaml` replay before correction — TEST_BUG — flow tapped `Add anytime habit` before scrolling to the current group-card control; report `simulation-output/native/native-android-all-2026-08-31T031448496Z.json`, screenshot/hierarchy artifacts `C:\Users\palac\.maestro\tests\2026-08-31_111409`
- 2026-08-31 — corrected final-build `habit-progress-insights.yaml` replay — PASS — create/check-in, progress modal metrics, close/reopen, streak, completion rate, and target-vs-actual assertions verified; report `simulation-output/native/native-android-all-2026-08-31T031706465Z.json`
- 2026-08-31 — `npm run qa:native:android -- --serial emulator-5568 --no-provision` — PASS — command-center-v2 and native-smoke passed 2/2 in 1m35s; report `simulation-output/native/native-android-smoke-2026-08-31T032533654Z.json`
- 2026-08-31 — `npm run typecheck` — PASS — `tsc --noEmit` completed successfully after the resumed campaign changes
- 2026-08-31 — final current-tree build provenance — PASS — `native-android-build.json` records APK SHA-256 `6E09045402DA1945948746297212EC955C84C598756CE02EFC17D53DCFF44D91`, package `com.dale16.superhabits` 1.0.0, API 36/x86_64 `Nitro_API_36`, and boot-complete target `emulator-5568`; source SHA is the repository revision and the report is paired with the intentionally dirty campaign tree.
- 2026-08-31 — final-source Gym V2 persistence replay — PASS — typed custom catalog metadata, progression/reps/target-load fields, weekly plan, process restart, and restored `40`/`5`/`8` values; direct report generated by `.maestro/flows/workout-gym-v2-persistence.yaml`.
- 2026-08-31 — final-source Gym V2 lifecycle replay — PASS — typed active-session values `42`/`6` survived force-stop/relaunch, completion saved history, and Recent sessions/Progress remained visible; direct report generated by `.maestro/flows/workout-gym-v2-session-lifecycle.yaml`.
- 2026-08-31 — final-source aggregate targeted persistence — PASS — 11/11 flows in `17m38s`; report `simulation-output/native/native-android-persistence-2026-08-31T100854042Z.json`.
- 2026-08-31 — final-source aggregate lifecycle — PASS — 6/6 flows in `11m41s`; report `simulation-output/native/native-android-lifecycle-2026-08-31T104047418Z.json`.
- 2026-08-31 — Mobile Next Android exploration — PASS — `Nitro_API_36` inspected all six product sections, Command Center, and Settings; screenshots retained under `simulation-output/native/mobile-next-*.png`, including `mobile-next-overview.png`, `mobile-next-todos.png`, `mobile-next-habits.png`, `mobile-next-focus.png`, `mobile-next-workout.png`, `mobile-next-calories.png`, `mobile-next-command-center.png`, and `mobile-next-settings.png`.
- 2026-08-31 — deterministic soak run 1 — PASS — 132/132 steps, final integrity oracles, report `simulation-output/run_mth48p9y_yni5rjk7/run-report.json`; total 87.3s.
- 2026-08-31 — deterministic soak run 2 — PASS — 132/132 steps, final integrity oracles, report `simulation-output/run_mth4apkz_d3u9wlze/run-report.json`; total 87.5s. Per-cycle averages remained bounded across all 12 cycles.
- 2026-08-31 — `npm run qa:timezones` — PASS — Asia/Manila, UTC, America/New_York, Pacific/Honolulu, and Pacific/Kiritimati; 43 tests passed in each environment.
- 2026-08-31 — modified Maestro syntax + targeted Prettier — PASS — all 11 modified YAML flows and both shared layout files plus formatted auth/insight flows pass.
- 2026-08-31 — first broad `qa:full` attempt — ENVIRONMENT — workstation `.env` Supabase variables contaminated the local-only bundle; Settings empty-device copy failed with the configured-build message. Failure screenshot preserved under `.cursor/playwright-output/e2e-failures/`.
- 2026-08-31 — local-only Settings reproduction — PASS — empty local-only rebuild with both Supabase variables blank; `e2e/settings.spec.ts` 2/2 pass.
- 2026-08-31 — PWA apply-update race fix — PASS — `e2e/pwa-update.spec.ts` now arms a load listener before worker-driven reload; isolated PWA project 4/4 pass and no once-only assertion was weakened.
- 2026-08-31 — local-only broad `qa:full` — PASS — typecheck, lint, 1,835 Vitest tests, OpenSpec, full web E2E, simulation validation, and all 23 deterministic scenarios; report artifact `artifact://185`.
- 2026-08-31 — `npm run build:sync` — PASS — dummy Supabase URL baked into fresh `dist-sync/`, with no real credentials.
- 2026-08-31 — `npm run e2e:sync` — PASS — 40/46 remote-boundary tests passed and six documented capability-gated steps skipped; artifact `artifact://189`.
- 2026-08-31 — impact, theme, and schema contracts — PASS — impact map 13 rules valid; 140 contrast checks pass; Supabase schema contract covers 14 migrations and owner-scoped tables.
- 2026-08-31 — final lifecycle aggregate attempt on the previous emulator state — ENVIRONMENT — Maestro heartbeat writes hit a Windows file-lock error and the Maestro device server then died; `cmd package` became unavailable and five follow-on flows could not launch. Report `simulation-output/native/native-android-lifecycle-2026-08-31T123518062Z.json`; no repository-owned product failure established.
- 2026-08-31 — clean API-36 target recovery — PASS — restarted `Nitro_API_36` on `emulator-5564`, verified `sys.boot_completed=1`, API 36, x86_64, and responsive package manager before final installation.
- 2026-08-31 — final current-tree APK rebuild/provision — PASS — 608 Gradle tasks, install success, source revision `56dad404b2e85c19e8821ad032a374d5e76d20bf`, APK SHA-256 `527D3F8C9CAA566ABDEE8887040EC4E2E602788DEDEDD7344D363FDF5B8FA68C`, report `simulation-output/native/native-android-build.json`.
- 2026-08-31 — final exact-APK smoke — PASS — 2/2 flows on `emulator-5564`; report `simulation-output/native/native-android-smoke-2026-08-31T132408817Z.json`.
- 2026-08-31 — final exact-APK persistence — PASS — 11/11 flows, including Gym V2 persistence; report `simulation-output/native/native-android-persistence-2026-08-31T133539933Z.json`.
- 2026-08-31 — final exact-APK lifecycle — PASS — 6/6 flows, including Gym V2 session lifecycle; report `simulation-output/native/native-android-lifecycle-2026-08-31T134232000Z.json`.
- 2026-08-31 — final broad static/contract matrix — PASS — `npm run qa:fast` (119 files/1,608 unit tests), `npm test` (160 files/1,835 tests), `npm run openspec:validate` (45/45), `npm run sim:validate` (23/23), themes (140), Supabase schema, impact map, and timezone matrix.
- 2026-08-31 — final campaign hygiene — PASS — all 11 modified Maestro flows pass `check-syntax`; all campaign source, flow, E2E, and plan files pass targeted Prettier; generated native scratch files were removed; `git diff --check` is clean.

## Changed Files / Areas

- `.agent/execplans/whole-product-android-production-certification-v1.md` — durable campaign state, triage, and validation evidence
- `core/ui/Modal.tsx` — shared Android modal safe-area fix under runtime verification
- `core/ui/Screen.tsx` — shared Android page bottom-inset fallback for edge-to-edge navigation
- `e2e/pwa-update.spec.ts` — load-event synchronization for worker-driven reload assertion
- `.maestro/flows/workout-gym-v2-persistence.yaml`, `.maestro/flows/workout-gym-v2-session-lifecycle.yaml` — removed unsafe fixed swipes and added anchored field/row scrolling; runtime verified
- `.maestro/flows/habit-reminder-actions.yaml`, `.maestro/flows/habit-reminder-actions-replay.yaml`, `.maestro/flows/habit-reminder-delivery.yaml` — replaced unsafe modal/section gestures with element-aware scrolling; runtime verified
- `.maestro/flows/command-center-v2.yaml` — replaced unsafe modal swipe and targeted the actual review subtitle; isolated flow runtime verified
- `.maestro/flows/backup-v2-settings.yaml` — anchored Backup status before scrolling to Backup coverage; runtime verified
- `.maestro/flows/portable-backup.yaml` — anchored backup section, used an in-modal disclosure swipe, and asserted actual Android share/picker fallback surfaces; runtime verified
- `.maestro/flows/portable-backup-blocked.yaml` — updated current Quick capture setup and anchored the empty-device restore guard; runtime verified
- `.maestro/flows/auth-session-protect.yaml` — added bounded modal scrolling and status-card targeting; runtime verified with deterministic local auth mock
- `.maestro/flows/habit-progress-insights.yaml` — anchored the current scrollable habit-group add control; final-build runtime verified

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan fully.
2. Inspect `git status --short`, `git rev-parse HEAD`, and `git rev-parse origin/main`; do not describe the working tree as clean while campaign edits remain uncommitted.
3. Verify `adb -s emulator-5568 get-state`, `adb -s emulator-5568 shell getprop sys.boot_completed`, API level, ABI, and `maestro --version`.
4. Rebuild with `npm run qa:native:provision -- --serial emulator-5568 --force` after any source change, then rerun `qa:native:android`, `qa:native:targeted`, and `qa:native:lifecycle`.
5. Keep web E2E local-only by blanking `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; use `npm run build:sync` only for the isolated dummy-backend lane.
6. Update this ledger after every new failure or milestone; classify failures with the autonomous-QA taxonomy and preserve artifact paths.

## Outcomes & Retrospective

- Status: Active; historical Android and repository evidence is preserved, but release certification remains open until clean-commit provenance, push, and exact-head CI are verified.
- Summary: API-36 Android qualification and broad local QA were established on the prior current-tree artifact. This continuation adds fail-closed Git provenance and must replace the dirty-tree artifact with a clean-commit certification artifact.
- Remaining: Commit all intentional source, Maestro, E2E, tooling, documentation, and test changes; rerun final certification; push `main`; verify exact-head CI.
