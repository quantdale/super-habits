# ExecPlan: Habit Reminders V1 — Schedule-Aware Native Notifications

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Deliver one opt-in local reminder per habit that fires only on Habit Engine V2 scheduled dates, uses the configured local wall-clock time, survives restart, reconciles schedule/time/target/completion/deletion changes, and is validated on Android as far as the available native harness can honestly prove.

## Context

- OpenSpec: `openspec/changes/add-schedule-aware-habit-reminders/` (`proposal.md`, `specs/habit-reminders/spec.md`, `design.md`, `tasks.md`).
- Habit Engine V2 is complete: `habits.rule_history` stores effective-dated schedule/target rules; `getHabitRuleForDate` and `isHabitScheduledOn` are the schedule authority. Do not reopen that architecture unless a reminder defect proves a genuine V2 bug.
- SQLite is authoritative through `core/db/client.ts`; current runtime schema is v12. `habits.reminder_time TEXT NULL` already exists in bootstrap/reference schemas and is present in the `Habit` type. Existing habits are therefore disabled by null without a new local migration.
- `features/habits/habits.data.ts` owns habit CRUD/completions/soft delete/sync enqueue; `features/habits/habits.domain.ts` is pure schedule/history logic; `HabitsScreen.tsx` owns create/edit UI and existing day-rollover refresh.
- `lib/notifications.ts` currently owns Expo permission/channel setup and Pomodoro time-interval scheduling/cancellation. Pomodoro stores its native ID only in a component ref. There is no existing scheduler inventory or startup reconciliation.
- Expo Notifications 55 provides deterministic `identifier`, one-shot `DATE` triggers, `getAllScheduledNotificationsAsync`, per-ID cancel, notification `data`, and Android channels. Native `DATE` scheduling uses local device time via the Date object; the service will not store indefinite UTC recurrence instants.
- `AppProviders` initializes DB/auth/sync/restore; `DayRolloverProvider` emits a generation on local date change; `useForegroundRefresh` handles AppState/web visibility. The reminder host must reuse these boundaries and remain non-blocking/serialized.
- Supabase sync is full-row upsert for `habits`; restore v1 imports full habit rows. The existing nullable reminder column is already in `simulation/backend/schema.sql`, `core/db/schema.sql`, sync fixtures, and remote-row fixtures. A remote migration is not expected unless audit proves drift.
- Android native tooling is available on Nitro per the completed Habit V2 plan: API-36 x86_64 emulator, Maestro 2.8.0, current APK build/install path. The notification tray was previously not proven; this task must attempt it and classify the result honestly. Windows cannot run iOS simulator QA.
- Pre-existing dirty files must be preserved: `eslint.config.mjs`, `lib/notifications.ts`, `tests/notifications.test.ts`, `package.json`, `package-lock.json`, patch files, and `.agent/execplans/install-configure-dependencies.md`, plus any other changes discovered in the current worktree. Inspect overlapping diffs before edits.

## Scope

- OpenSpec/ExecPlan artifacts for Habit Reminders V1.
- Pure reminder time parsing, local occurrence construction, bounded desired-window planning, and diffable native schedule metadata.
- Shared notification wrapper extension with stable Habit reminders channel/permission state and scheduler inventory primitives, while preserving Pomodoro.
- Persisted `reminder_time` create/edit/disable/delete/restore behavior and reconciliation hooks for startup, foreground, rollover, schedule/time/target/completion changes.
- Compact accessible Habit reminder UI, explicit permission/web states, and safe Habits tap destination.
- Unit, service, real-SQLite, web E2E, simulation, sync/restore, and Android Maestro/native delivery-attempt validation.
- Exact QA evidence, known-gap updates, OpenSpec completion, and completed valid ExecPlan.

## Non-Goals

- Multiple reminders, snooze, adaptive/AI timing, push/backend delivery, social/geofence/calendar integrations, arbitrary recurrence, analytics, or continuous background polling.
- A separate reminder table, reminder history, new sync entity, or changes to Habit Engine V2 rule history/completion restore.
- Infinite recurring native triggers, 365-day per-habit scheduling, `cancelAllScheduledNotificationsAsync`, a new navigation subsystem, or a foreground service.
- iOS execution on Windows, fabricated notification-tray claims, weakened tests, blind retries, arbitrary sleeps, or threshold changes to CG-4/CG-5/J8.
- Resetting, cleaning, stashing, discarding, or overwriting unrelated dirty work.

## Current Checkpoint

- Current milestone: Habit Reminders V1 implementation and required validation are complete; the completed artifacts are ready for handoff.
- Completed: Read startup guidance (`AGENTS.md`, `.agent/PLANS.md`, `docs/codex-workflow.md`, structure/rules, feature/RN/DB skills); inspected Git branch/status/log and plans; created task branch `codex/add-schedule-aware-habit-reminders`; audited Habit V2 domain/data/UI, SQLite v12 schema/types, sync/restore/reference schemas, notification/Pomodoro code, Expo notification API/native trigger implementations, lifecycle providers, settings architecture, Maestro flows, native runner, timezone/simulation/QA docs; recorded current dirty overlap; created proposal/spec/design/tasks; implemented the reminder stack, focused web coverage, simulation case, native flows, and test-build-only delivery probe.
- In progress: None. Final QA, documentation, OpenSpec tasks, and ExecPlan closure are complete.
- Important modified files: `openspec/changes/add-schedule-aware-habit-reminders/{proposal.md,design.md,tasks.md,specs/habit-reminders/spec.md,execplan.md}`, reminder domain/service/signal/host files, shared notification wrapper, habit data/UI, app tap host, focused unit/integration tests, and existing test mocks are currently owned by this task. Existing dirty files are not owned by this task unless an intentional overlapping fix is required.
- Last successful validation: final `qa:fast` (55 unit files/644 tests; typecheck and lint 0 errors/20 warnings), integration (9 files/52 tests), five-timezone matrix, focused Habits Playwright (10/10), broad `e2e:full` (152 passed/17 intentional skips), sync E2E (19/19), deterministic simulation (17/17 scenarios), current-source Android targeted (10/10), lifecycle (3/3), direct smoke (pass), and Android notification-manager delivery (`VERIFIED`).
- Current failures: The clean current-source Android release rebuild exposed the documented workstation-only native dependency linker omission (`react-native-worklets`/related CMake targets fail to resolve `libc++_shared`); a temporary ignored validation-only link correction allowed the APK to assemble. The workaround is not product code and is absent from the repository changes. One aggregate smoke attempt was classified `ENVIRONMENT` because Maestro's Android device server died during `launchApp` while its heartbeat file was locked; a later aggregate attempt transiently missed the reverse-swipe `Start focus` assertion while the same heartbeat lock errors were present. The unchanged flow passed when replayed directly, so this is classified `FLAKY_TEST`/Maestro harness contention, not a product defect. No reminder product failure remains open.
- Relevant quarantines: Visual notification-shade interaction, accelerated fourteen-day production recurrence, iOS execution on Windows, and platform-specific long-running/background coverage remain capability boundaries. Android notification-manager posting after test-build process termination is verified. Existing test/QA quarantines remain authoritative.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None; hand off the completed implementation and final evidence.
- Remaining definition of done: None.

## Progress

- [x] Recover repository instructions, Git state, existing OpenSpec/ExecPlans, Habit V2, notification, lifecycle, sync/restore, DB, native, simulation, and QA architecture.
- [x] Isolate the task on a dedicated branch while preserving unrelated dirty work.
- [x] Finalize reminder semantics: null/HH:MM, V2 schedule authority, local time, fourteen-day bounded window, same-day passed-time skip, completion suppression, target history, permission UX, stable channel, no Pomodoro interference, Habits tap fallback.
- [x] Create OpenSpec proposal, capability spec, design, and implementation tasks.
- [x] Validate OpenSpec artifacts and this Plan-Version 2 ExecPlan.
- [x] Implement pure reminder planner/time domain and tests.
- [x] Implement shared native notification primitives and idempotent reconciliation service/tests.
- [x] Integrate habit persistence, mutations, restore, lifecycle, tap routing, and UI.
- [x] Add SQLite/sync/restore/web E2E/simulation/native coverage.
- [x] Run affected and broad QA; classify delivery/background/process-death limitations.
- [x] Complete OpenSpec tasks, documentation, final validation, and this plan's Outcomes & Retrospective.

## Surprises & Discoveries

- The repository already has `habits.reminder_time` as a nullable field in runtime bootstrap, schema/type, remote reference schema, sync adapter full-row behavior, and restore fixtures. This materially simplifies V1 and avoids a migration unless a live remote audit finds drift.
- Expo's weekly trigger numbering is Sunday=1 while Habit Engine V2 uses ISO Monday=1. One-shot local date triggers avoid leaking that mismatch into the reminder planner.
- Expo's native date trigger implementation is local-time aware (`Date` timestamp on Android and one-shot calendar/time interval behavior on iOS), while recurring calendar triggers cannot express completion suppression/effective schedule history cleanly.
- Pomodoro's shared wrapper changes are already dirty in the user worktree (`current.granted` permission response and Android default-channel setup). All edits must preserve those user changes and extend rather than replace them.
- The notification system has no durable notification log and does not need one: deterministic identifiers plus native inventory are sufficient and bounded.

## Decision Log

- 2026-08-12 — Use existing nullable `habits.reminder_time` as current-only V1 config — it is already persisted/synced/restored, legacy-null is quiet, and reminder history has no user-facing requirement.
- 2026-08-12 — Use a fourteen-local-day one-shot schedule window — it balances offline reliability and bounded native queue size while allowing effective-dated schedule/target and completion-aware reconciliation.
- 2026-08-12 — Use deterministic `habit-reminder:<habitId>:<dateKey>` identifiers plus metadata — repeated reconciliation is idempotent, stale/duplicate entries can be removed, and Pomodoro IDs remain outside the namespace.
- 2026-08-12 — Use local Date component construction and Expo one-shot DATE triggers — preserves wall-clock semantics and lets the platform handle timezone/DST offsets; no indefinite UTC recurrence is stored.
- 2026-08-12 — Treat permission denial as disabled in the UI and do not prompt on startup — avoids false enabled state and repeated nagging.
- 2026-08-12 — Route taps to the existing Habits section only — exact habit focus is optional and a new route/navigation system is out of V1 scope.
- 2026-08-12 — Classify Android tray/background/process-death results from real evidence — existing native flow proves scheduling path, not actual delivery, so this task cannot preclaim VERIFIED.

## Validation Ledger

- 2026-08-12 — `git status --short; git branch -vv; git log --oneline --decorate -15; npm run agent:plans` — PASS — branch/status/log/plans recovered; unrelated dirty work preserved; completed Habit V2 plan present.
- 2026-08-12 — Startup source/skill/architecture audit — PASS — Habit V2 authority, nullable reminder column, shared Pomodoro notification path, Expo trigger/inventory APIs, lifecycle, sync/restore, native tooling/docs, simulation, and QA impact areas inspected.
- 2026-08-12 — `npx --no-install openspec new change add-schedule-aware-habit-reminders` — PASS — change scaffold created at `openspec/changes/add-schedule-aware-habit-reminders/`.
- 2026-08-12 — OpenSpec artifact creation — PASS — proposal, `specs/habit-reminders/spec.md`, design, tasks, and this ExecPlan created; validation pending.
- 2026-08-12 — OpenSpec strict validation — PASS — `npx --no-install openspec validate add-schedule-aware-habit-reminders --type change --strict` and `npm run openspec:validate` passed; the repository validator reported 19/19 items.
- 2026-08-12 — `npm run agent:plan:validate -- --plan openspec/changes/add-schedule-aware-habit-reminders/execplan.md` — PASS — Plan-Version 2 structure and completion requirements validated.
- 2026-08-12 — `npx tsc --noEmit --pretty false`, `npx tsc -p simulation/tsconfig.json --noEmit --pretty false`, `npm run lint`, `git diff --check` — PASS — source and simulation typechecks passed; lint reported 22 warnings and 0 errors; no whitespace errors.
- 2026-08-12 — Reminder focused tests — PASS — `npx vitest run tests/habitReminders.domain.test.ts tests/habitReminders.service.test.ts` passed 33/33; focused SQLite/sync/restore tests passed 14/14.
- 2026-08-12 — `npm test` — PASS — 64 files and 695 tests passed.
- 2026-08-12 — `npm run qa:timezones` — PASS — Asia/Manila, UTC, America/New_York, Pacific/Honolulu, and Pacific/Kiritimati each passed 40 tests.
- 2026-08-12 — `npm run build:web`; `npx playwright test e2e/habits.spec.ts --project=chromium` — PASS — static export succeeded and the focused Habit web suite passed 10/10.
- 2026-08-12 — `npm run qa:simulation -- --scenario habit-reminders-v1 --mode deterministic` — PASS — scenario validation passed and all six reminder simulation steps passed.
- 2026-08-12 — `npm run openspec:validate`; `npm run qa:impact:validate` — PASS — 19 OpenSpec items and 12 impact rules validated.
- 2026-08-12 — `EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST=true npx expo run:android --variant release`; direct x86_64 Gradle retry — ENVIRONMENT — current-source native release assembly failed in C++ dependency linking with unresolved `std::__ndk1`/`__cxa_*`/libc++ symbols; no current reminder APK was installed from these attempts. Existing APK remains only a prior baseline and is not used as current reminder evidence.
- 2026-08-12 — Temporary ignored dependency CMake correction plus `android/gradlew.bat app:assembleRelease --no-daemon -PreactNativeArchitectures=x86_64` — PASS/PARTIAL — adding `-lc++_shared` only to the generated/dependency CMake targets allowed the current-source APK to assemble; this is a workstation/toolchain workaround, not a committed product change. The bundle contains the test-only delivery hook; native execution is pending install and Maestro.
- 2026-08-12 — Current-source Android reminder Maestro — PASS — persistence, disable, denied-permission, and multi-habit/Pomodoro isolation flows passed; reports are under `simulation-output/native/` and the multi-habit flow was corrected only for viewport navigation after the first test-harness selector/visibility failures.
- 2026-08-12 — `node scripts/qa-native-delivery.mjs` — PASS / VERIFIED — the test-only 20-second schedule completed after background/process termination; Android notification manager observed package `com.dale16.superhabits`, title `Native delivery habit`, body `Time to complete your habit.`, deterministic test identity, and channel `habit-reminders`. Report: `simulation-output/native/habit-reminder-delivery-2026-08-12T090401052Z.json`.
- 2026-08-12 — Delivery harness correction — TEST_BUG fixed — the probe initially imported `resolve` from `node:fs`, then asserted a transient UI message that is not rendered; the authoritative `dumpsys notification` assertion remained intact and the corrected probe verified delivery.
- 2026-08-12 — `npm run qa:affected`, `npm run qa:fast`, `npm run qa:integration`, `npm run agent:resume -- --plan ...` — PASS — impact map selected all affected web/native/sync gates; fast passed 55 files/643 unit tests, integration passed 9 files/52 tests, and resume/plan validation passed with only preserved unrelated-dirty warnings.
- 2026-08-12 — Trigger-staleness hardening — PASS — reconciliation now compares the native DATE trigger timestamp as well as deterministic metadata; focused service tests passed 7/7, TypeScript and lint passed, and `git diff --check` reported no whitespace errors.
- 2026-08-12 — Broad web/sync/simulation validation — PASS — `npm run e2e:full` completed with 152 passed and 17 intentional skips; J8 printed cold Overview 476ms, max switch 782ms, diary search 347ms, picker search 94ms; `npm run e2e:sync` passed 19/19; `npm run qa:simulation -- --all --mode deterministic` passed all 17 scenarios.
- 2026-08-12 — Final fast/integration validation — PASS — `npm run qa:fast` passed typecheck, lint with 0 errors/20 warnings, and 55 unit files/644 tests; `npm run qa:integration` passed 9 files/52 tests. The stale-trigger fix is included in these final gates.
- 2026-08-12 — Final timezone/impact/OpenSpec validation — PASS — all five timezone matrix zones passed 40/40 reminder-domain tests each; `npm run qa:impact:validate` passed 12/12 rules; documentation and task ledger updated.
- 2026-08-12 — Sequential Android native validation — PASS — `npm run qa:native:targeted` passed 10/10 flows (report `simulation-output/native/native-android-persistence-2026-08-12T094838933Z.json`); `npm run qa:native:lifecycle` passed 3/3 (report `simulation-output/native/native-android-lifecycle-2026-08-12T095008203Z.json`); direct `native-smoke.yaml` reproduction passed (report `simulation-output/native/native-android-all-2026-08-12T095324942Z.json`).
- 2026-08-12 — Native failure classification — FLAKY_TEST/ENVIRONMENT — an earlier aggregate smoke attempt recorded Maestro device-server death/heartbeat-file contention, and a later aggregate run transiently missed the reverse-swipe assertion with the same heartbeat lock errors. The unchanged direct flow passed; no reminder assertion or app crash failed. Reports are retained under `simulation-output/native/`.
- 2026-08-12 — iOS preflight — ENVIRONMENT — `npm run qa:native:ios` correctly blocked because Windows has no Xcode `xcrun/simctl`; report `simulation-output/native/native-ios-smoke-2026-08-12T095340421Z.json`.
- 2026-08-12 — Documentation and plan closure — PASS — `docs/testing/native-e2e.md` and `docs/testing/known-gaps.md` distinguish verified Android notification-manager delivery from visual-shade/long-horizon/iOS gaps; OpenSpec tasks 6.5 and 7.1–7.5 are complete; this ExecPlan is marked `COMPLETED`.

## Changed Files / Areas

- `openspec/changes/add-schedule-aware-habit-reminders/` — proposal, capability spec, design, tasks, and living implementation/QA plan.
- `lib/notifications.ts` — shared permission/channel/scheduler primitive extension; preserve existing dirty Pomodoro behavior.
- `features/habits/habitReminders.domain.ts` or equivalent pure module — time parsing, local date occurrence planning, desired window, diff metadata.
- `features/habits/habitReminders.service.ts` or equivalent — native adapter/reconciliation boundary and serialized requests.
- `features/habits/habits.data.ts`, `features/habits/HabitsScreen.tsx`, `features/habits/types.ts` — reminder persistence/mutation hooks/UI contracts.
- `core/providers/AppProviders.tsx`, `core/providers/DayRolloverProvider.tsx`, `app/_layout.tsx` — startup/foreground/rollover/tap integration, only if required by the final host design.
- `tests/`, `tests/integration/`, `e2e/`, `simulation/`, `.maestro/`, `docs/testing/`, `docs/knowledge-base/` — contract, persistence, web, simulation, native and evidence updates.
- `core/db/client.ts`, `core/db/schema.sql`, `simulation/backend/schema.sql`, `supabase/migrations/` — audit-only initially; modify only if a real schema drift requires an additive migration.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan, and all files under `openspec/changes/add-schedule-aware-habit-reminders/`.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and inspect any dirty diff overlapping notification/habit files; preserve unrelated changes.
3. Run `npm run agent:resume -- --plan openspec/changes/add-schedule-aware-habit-reminders/execplan.md`; reconcile Git discrepancy warnings before implementation.
4. Run `npx --no-install openspec status --change add-schedule-aware-habit-reminders --json` and `npx --no-install openspec instructions apply --change add-schedule-aware-habit-reminders --json`; read all returned context files before coding.
5. Continue only from `Exact next action`, updating this checkpoint after every implementation milestone, decision, failure, large QA run, and before native/E2E runs.
6. Use `npm run qa:affected` after meaningful changes; follow its gates, then run `npm run qa:timezones`, focused Playwright, simulation, sync, and native lanes as impact requires.
7. Preserve native reports/artifacts and classify failures as `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`, `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY`. Never claim actual delivery unless the system tray was observed.

## Outcomes & Retrospective

- Status: COMPLETED.
- Summary: Habit Reminders V1 now persists one opt-in canonical `HH:MM` reminder per habit, plans a bounded fourteen-local-day window from Habit Engine V2, reconciles native schedules idempotently, respects completion/target/off-day semantics, handles permission and web boundaries explicitly, and validates Android configuration plus short-horizon notification-manager delivery after process termination.
- Proof: Final unit/integration, timezone, web build/E2E, sync/restore, deterministic simulation, OpenSpec/impact, and sequential Android native reports are listed in the Validation Ledger. No schema migration was needed because `habits.reminder_time` already existed across the local/reference/sync/restore contracts.
- Remaining risks: Android visual notification-shade interaction and accelerated long-horizon production recurrence were not claimed; iOS remains an EAS/macOS lane because Windows lacks Xcode; the clean native rebuild still needs a workstation/toolchain fix for the ignored `-lc++_shared` linker workaround. The unrelated dirty worktree changes remain preserved.
- Follow-up: Add user-visible reminder history/completion feedback or an explicit notification-center QA lane only after this one-reminder local scheduling contract has accumulated production usage evidence.
