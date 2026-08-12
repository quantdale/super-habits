# ExecPlan: Habit Engine V2 — Weekly Scheduling and Historical Semantics

Plan-Version: 2
Status: BLOCKED

## Purpose / User Outcome

Deliver weekly scheduled habits with historically correct streak, consistency, today-progress, heatmap, sync/restore, web, simulation, and Android persistence behavior. Existing implicitly-daily habits must retain their current meaning after upgrade, while schedule and target edits become effective-dated and never rewrite earlier performance.

## Context

- OpenSpec: `openspec/changes/add-habit-scheduling-and-history-semantics/`.
- Current repository is `main` at `714819a` with substantial pre-existing dirty work. Git status/diffs are authoritative; unrelated changes must remain untouched.
- SQLite runtime authority is `core/db/client.ts` plus append-only migrations; starting stored version was 11 and this change adds version 12. Local date keys use `toDateKey()`.
- `habits` and the current target are synced as one main row; `habit_completions` is local-only. Restore v1 imports habits but not completion history. The adapter upserts full local rows, and `simulation/backend/schema.sql` is the checked-in remote reference.
- The current habit engine uses daily assumptions: no schedule field/history, 30-day streak reads, current target for all dates, all past grid cells in consistency, and all habits in heatmap denominator.
- Existing dirty overlap includes `features/habits/HabitsScreen.tsx`, `features/overview/OverviewScreen.tsx`, `core/providers/AppProviders.tsx`, linked-actions/restore files, `e2e/helpers/clock.ts`, Maestro flows, QA tooling, and docs. Preserve those changes and integrate the existing day-rollover generation rather than replacing it.

## Scope

- Effective-dated weekly schedule and target history embedded in `habits.rule_history`.
- Domain authority for local scheduled/eligible status, target lookup, streaks, consistency, today progress, aggregate heatmap, and off-day semantics.
- v12 migration, type/data/restore/sync reference updates, Habits/Overview/command/Linked Actions integration.
- Unit, real-SQLite, timezone, Playwright, simulation, and Android Maestro validation.

## Non-Goals

- Monthly or every-N-days recurrence, pausing/vacation/skip tokens, start/end UI, reminder overhaul, XP/rewards, templates, AI coaching, full two-way sync, or completion-history restore.
- Resetting, cleaning, stashing, discarding, or overwriting pre-existing worktree changes.
- Relaxing CG-4/CG-5/J8 thresholds or the fixed 52-column heatmap contract.

## Current Checkpoint

- Current milestone: Product implementation, Nitro workstation provisioning, and the local web/SQLite/simulation/timezone/Android lanes are complete. The only Habit Engine V2 product-acceptance item remains authorized Supabase schema deployment and a remote Habit V2 round trip.
- Completed: Startup docs, skills, feature/data/DB/sync/restore/linked-action/Overview/heatmap/tests/journeys/known-gap/OpenSpec audit completed. Starting Git status/branch/log and active plan inventory captured. Existing day-rollover and linked-action dirty changes inspected. Current daily habit semantics and remote schema limitation verified. OpenSpec proposal, capability spec, design, and task list created. v12 migration/types/reference schemas, effective-dated domain algorithms, unbounded streak reads, persistence/edit behavior, restore compatibility, Overview rest-day state, schedule-diverse simulation fixtures, linked-action off-day coverage, and two fake-clock Playwright schedule journeys implemented.
- Completed this continuation: Diagnosed the persisted-vs-inherited Maestro PATH discrepancy, made the native runner portable on Windows, built/installed a fresh current-source x86_64 Android release APK, executed scheduled and daily Habit persistence, and created/static-validated the additive remote migration. No reminder work is in scope.
- Completed this continuation's live Nitro audit: Node 22.23.2/npm 10.9.8, JDK 17.0.20, Android SDK/API 36 x86_64 with `Nitro_API_36`, Python 3.13.15, Visual Studio 2022 Build Tools, and Maestro 2.8.0 are present; user-level Android/Maestro/Deno PATH entries and both Android SDK variables are persisted. `npm ci` passed with repository patches/hooks; Playwright Chromium 147.0.7727.15 launches headlessly; Deno 2.9.5 was installed and both Edge Function checks pass; pinned EAS 18.5.0, Supabase 2.113.0, Vercel 58.9.2, and one-off `tsx` 4.23.12 probes pass. Docker/Podman, local EAS, and GitHub CLI are not installed. `npm run doctor` reports only existing Expo SDK patch/config-version drift; no blind dependency upgrade was made.
- Completed this continuation's web/local readiness proof: `npm ci`, `npm test` (62 files/661 tests), `npm run qa:fast`, `npm run qa:integration` (51), `npm run qa:timezones` (five zones), `npm run build:web`, infrastructure Chromium (10/10), P0 journeys (16/16), deterministic P0 simulation, `npm run build:sync`, and `npm run e2e:sync` (19/19) passed. `npm run web -- --port 8091` returned HTTP 200 after bundling. A broad `npm run e2e` rerun exposed one existing heavy-journey D14 performance failure (`overview→todos` 993ms > 800ms); the focused rerun timed out while mounting the same heavy fixture, so this remains preserved as host/performance `ENVIRONMENT` evidence rather than a Habit V2 semantic failure.
- Completed this continuation's fresh native proof: CMake 3.30.5, Gradle 9.0.0, MSVC `cl.exe`, WHPX, and the API-36 x86_64 emulator all validate; a current-source release APK built after the documented workstation-only `libc++_shared` dependency-input correction, installed, and launched. Native smoke passed; persistence passed 6/6 including the M/W/F schedule flow; lifecycle passed 2/2. Windows iOS preflight remains the documented `ENVIRONMENT`/cloud-only boundary.
- In progress: Remote gate only. It remains blocked pending authenticated Supabase identity, explicit target/environment confirmation, migration history/schema inspection, and a safe dry-run.
- Important modified files: pre-existing dirty files listed above; new change artifacts under this directory plus the habit engine files and focused tests listed in Changed Files / Areas.
- Last validation: In this continuation, `npm test`, `npm run qa:integration`, `npm run qa:timezones`, `npm run e2e:sync`, and the fresh native lanes listed above passed. The historical 2026-08-10 full `npm run e2e` green run remains recorded, but the current broad rerun is not claimed as green because of the preserved D14 performance failure.
- Current failures: The current broad `npm run e2e` run has one heavy P2 D14 latency failure (`overview→todos` 993ms > 800ms), and its focused rerun timed out before the same section-switch assertion. Classify as `ENVIRONMENT`/host-performance instability pending a later dedicated performance investigation; do not weaken the threshold or attribute it to the Habit V2 data contract. The earlier focused Habits `TEST_BUG` remains fixed and its final 9-test file passes.
- Relevant quarantines: Preserve existing known gaps and performance contracts; do not claim them closed without evidence. The earlier Maestro-missing reports remain historical ENVIRONMENT evidence; current native execution is green. Native off-day date semantics remain covered by domain/web/timezone lanes because deterministic Android clock mutation is not safely supported.
- Blockers: Remote schema deployment and round-trip access remain unverified. The repository-supported Supabase CLI is `2.113.0`; `npx supabase projects list` reports no access token, `npx supabase login` refuses the automatic browser flow in this non-TTY session, `npx supabase migration list --linked` reports no linked project, and `npx supabase db push --linked --dry-run` stops before any remote inspection because no project is linked. No Supabase public configuration or linked metadata exists, and Docker/Podman is unavailable for a local Supabase fallback. The deployment workflow contains only an authoring-time clue (`kruubbynsmxzxfdunaal`, named `superhabits`), which does not by itself establish the intended environment or authorize mutation.
- Condition required to unblock: Authenticate with the official Supabase CLI and explicitly confirm that the workflow ref `kruubbynsmxzxfdunaal` is the intended guarded development/staging or disposable target (or provide the correct project ref and environment), then inspect migration status before applying only this migration and run the dedicated Habit V2 round trip.
- Exact resume action after unblock: From an interactive user terminal, complete `npx --no-install supabase login` (or set the user-owned `SUPABASE_ACCESS_TOKEN` without exposing it), then run `npx --no-install supabase projects list`; confirm the intended project/environment before `supabase link`. Continue with `npx supabase migration list --linked`, read-only schema/RLS inspection, `npx supabase db push --linked --dry-run`, and only then the additive migration and isolated round trip.
- Exact next action: No independent local setup remains. The next action is the user-owned interactive Supabase authentication and explicit project/environment confirmation. Do not run `supabase link` or `supabase db push` against an unidentified project.
- Remaining definition of done: Authorized remote schema application and remote `rule_history` upsert/read/restore evidence; then rerun the affected QA set and mark this plan COMPLETED.

## Progress

- [x] Read startup/architecture/invariant/QA/OpenSpec guidance and current relevant source/tests.
- [x] Inspect Git state, branch/log, active plans, and pre-existing dirty overlap.
- [x] Audit starting habit schema, target/completion semantics, streak, consistency, heatmap, edit, deletion, sync, restore, Linked Actions, Overview, rollover, web/native paths.
- [x] Choose embedded effective-dated `rule_history` JSON on the synced habit row; preserve current target column and completion rows.
- [x] Create proposal, capability spec, design, and implementation task list.
- [x] Validate OpenSpec and ExecPlan before implementation.
- [x] Implement v12 migration/types/reference schemas.
- [x] Implement pure schedule/history domain and tests.
- [x] Implement persistence, restore/sync compatibility, and real-SQLite tests.
- [x] Integrate UI, Overview, command retrieval, Linked Actions, rollover, and accessibility.
- [x] Add web journeys, simulation diversity, and Android Maestro persistence flow.
- [x] Run affected and broad QA; classify failures and preserve artifacts.
- [x] Complete the native-gated OpenSpec/ExecPlan handoff once Maestro is available; current Android smoke, lifecycle, targeted persistence, and Habit V2 schedule persistence evidence are green.
- [ ] Complete the remote-gated OpenSpec/ExecPlan handoff after authorized additive migration deployment and a remote Habit V2 round trip.

## Surprises & Discoveries

- The worktree is intentionally dirty with a large Nitro hardening/agent-lifecycle set. The existing `HabitsScreen` change is only day-rollover refresh wiring; it is a dependency to preserve.
- Existing `SupabaseSyncAdapter` selects full local rows, and the disposable backend documents missing remote columns as schema drift. Adding a local habit column requires updating `simulation/backend/schema.sql` and recording the live dashboard prerequisite; otherwise a failed push must remain queued.
- Existing streak UI and command retrieval use bounded completion history (30 days in the screen, 365 in Ask), so removing the arbitrary correctness cap requires changing the data API call sites, not merely increasing a constant.
- Existing habit completion Linked Actions intentionally accept a supplied source date; this can preserve off-day rows without changing schedule history, provided domain metrics filter them.

## Decision Log

- 2026-08-10 — Use one `habits.rule_history` JSON column instead of a new `habit_rules` table — the habit row is already the synced/restored unit, so this keeps history from silently disappearing without a new outbox/entity or remote pull protocol.
- 2026-08-10 — Use ISO weekdays 1=Monday through 7=Sunday — this is unambiguous for business schedules and avoids JavaScript Sunday-zero leaking into persisted data.
- 2026-08-10 — Keep consistency/heatmap at the existing 364-day reporting window while making streak reads unbounded — this corrects denominator semantics without silently changing the product's reporting period.
- 2026-08-10 — Treat off-day completion rows as compatible but neutral — existing Linked Actions and direct data pathways remain stable; schedule state stays rule-history-only.
- 2026-08-10 — Use `npx --no-install openspec` because the CLI is installed through the local npm toolchain but not available as a PowerShell command.

## Validation Ledger

- 2026-08-10 — `git status --short; git branch -vv; git log --oneline --decorate -15; npm run agent:plans` — PASS — current branch is `main` at `714819a`; pre-existing dirty work and completed plans enumerated.
- 2026-08-10 — Startup source/doc/skill audit — PASS — current daily semantics, DB v11, sync/restore scope, linked actions, day rollover, heatmap fixed-width behavior, simulation/native tooling, and known gaps inspected.
- 2026-08-10 — `npx --no-install openspec new change add-habit-scheduling-and-history-semantics` — PASS — change scaffold created.
- 2026-08-10 — OpenSpec proposal/spec/design/tasks creation — PASS — all planning artifacts exist; validation pending.
- 2026-08-10 — `npx --no-install openspec validate add-habit-scheduling-and-history-semantics --type change --strict` — PASS — change valid.
- 2026-08-10 — `npm run agent:plan:validate -- --plan openspec/changes/add-habit-scheduling-and-history-semantics/execplan.md` — PASS — active Plan-Version 2 structure valid.
- 2026-08-10 — v12 migration/type/reference schema implementation — PASS — append-only migration initializes all existing habits, including deleted rows, with local creation-date every-day rules; schema/type snapshots updated.
- 2026-08-10 — schedule/history domain implementation — PASS — local weekday resolution, effective-dated target/schedule lookup, eligible-day filtering, unbounded streaks, grace semantics, consistency, heatmap aggregation, and activity calculations centralized.
- 2026-08-10 — `npx vitest run tests/habits.domain.test.ts tests/habits.data.test.ts tests/ask.retrieval.test.ts tests/db.client.test.ts` — PASS — 4 files, 54 tests.
- 2026-08-10 — `npm run test:integration -- --run tests/integration/migrations.test.ts tests/integration/habitScheduling.test.ts` — PASS — 2 files, 7 tests.
- 2026-08-10 — `npm run typecheck` — PASS — no TypeScript errors.
- 2026-08-10 — restore/sync compatibility implementation and integration assertions — PASS — remote rows with rule history round-trip; legacy remote rows fall back to local creation-date every-day rules; full-row sync adapter remains the serialization boundary.
- 2026-08-10 — simulation fixture/API-leg schedule diversity implementation — PASS — runner writes the persisted rule history and fixture preambles cover daily, weekdays, weekends, M/W/F, and a custom two-day schedule; typecheck passed.
- 2026-08-10 — focused regression after restore/simulation changes — PASS — 9 files, 83 tests; one stale schema-version fixture expectation was updated from 11 to 12.
- 2026-08-10 — `npm run build:web` — PASS — static Expo web export completed to `dist/`.
- 2026-08-10 — `npx playwright test e2e/habits.spec.ts --project=chromium` — PASS — 8 tests, including M/W/F off-day neutrality, fake-clock rollover to a scheduled day, and schedule persistence after reload.
- 2026-08-10 — `npx vitest run tests/integration/habitScheduling.test.ts tests/integration/linkedActions.test.ts` — PASS — 2 files, 9 tests; linked-action off-day increment remains neutral and deduplicated.
- 2026-08-10 — `npm run qa:fast` — FIRST RUN FAILED — product tests were green but one stale restore-helper argument assertion failed after adding `rule_history`; fixed the assertion, then `npm run lint` passed with 0 errors/20 warnings and `npm run test:unit` passed.
- 2026-08-10 — `npm run qa:integration` — PASS — 9 files, 50 tests.
- 2026-08-10 — `npm run qa:timezones` — PASS — Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati; 13 tests per zone.
- 2026-08-10 — `npm run qa:simulation` — PASS — model validation plus deterministic P0 smoke (24 steps).
- 2026-08-10 — `npm run qa:native:smoke` — BLOCKED / ENVIRONMENT — Maestro CLI missing; report `simulation-output/native/native-android-smoke-2026-08-10T070057272Z.json`.
- 2026-08-10 — `npm run qa:native:android` — BLOCKED / ENVIRONMENT — Maestro CLI missing; report `simulation-output/native/native-android-smoke-2026-08-10T070101444Z.json`.
- 2026-08-10 — `npm run qa:native:targeted` — BLOCKED / ENVIRONMENT — Maestro CLI missing; report `simulation-output/native/native-android-persistence-2026-08-10T070106320Z.json`.
- 2026-08-10 — `npm run e2e:full` — TIMEOUT / ENVIRONMENT — aggregate wrapper exceeded 10 minutes and left run-specific child processes; those exact processes were stopped. Constituent projects were rerun separately: feature Chromium 85 passed/7 skipped, journeys 62 passed/10 skipped, simulation 3 passed.
- 2026-08-10 — `npm run build:sync` — PASS — dummy-Supabase `dist-sync/` export completed.
- 2026-08-10 — `npm run e2e:sync` — PASS — 19/19 remote-boundary journey tests passed.
- 2026-08-10 — `npm run qa:fast` — FIRST RUN FAILED / TEST_BUG — typecheck passed, lint found mixed LF/CRLF formatting in `app/index.tsx` after temporary native selector experimentation; `npx prettier --write app/index.tsx` corrected it without runtime changes.
- 2026-08-10 — `npm run qa:fast` — PASS — typecheck, lint (0 errors/20 existing warnings), and unit tests (53 files, 610 tests).
- 2026-08-10 — `npm run qa:integration` — PASS — 9 files, 51 integration tests.
- 2026-08-10 — `npm run qa:timezones` — PASS — Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati; 13 tests per zone.
- 2026-08-10 — `npm run qa:journeys` — PASS — fresh web export and 16 P0 journey tests.
- 2026-08-10 — `npm run qa:simulation` — PASS — fresh web export, model validation, and deterministic P0 smoke scenario.
- 2026-08-10 — `npm run build:sync` + `npm run e2e:sync` — PASS — dummy Supabase export rebuilt; 19/19 sync journeys passed.
- 2026-08-10 — `npx playwright test e2e/habits.spec.ts --project=chromium` — PASS — 9 focused Habit V2 tests.
- 2026-08-10 — `npm run e2e` — PASS — 151 passed, 17 skipped across 168 Chromium/journeys/simulation tests; J8 reported `maxSwitch=768ms` under the 800ms limit and all CG checks remained green.
- 2026-08-10 — `npm run openspec:validate` + `npm run qa:impact:validate` — PASS — 18 OpenSpec items and 12 impact-map rules valid.
- 2026-08-10 — `npm run agent:plan:validate -- --plan openspec/changes/add-habit-scheduling-and-history-semantics/execplan.md` — PASS — Plan-Version 2 structure valid; plan remains BLOCKED only for remote access.
- 2026-08-10 — `npm run qa:native:ios` — NOT RUN / ENVIRONMENT — Windows Nitro cannot run the documented iOS native lane; Android evidence is complete and the limitation is preserved.
- 2026-08-10 — `npm run sim:run -- --mode deterministic` without a server — BLOCKED / ENVIRONMENT — all 16 setup steps received `ERR_CONNECTION_REFUSED`; run artifacts preserved under `simulation-output/run_msmx140q_4ogexnpn/` through `run_msmx2nmr_btvq0e6i/`.
- 2026-08-10 — `npm run sim:run -- --mode deterministic` with static E2E server — PASS — 16/16 scenarios passed.
- 2026-08-10 — `npm test` — PASS — 62 files, 661 tests.
- 2026-08-10 — Final `npm run build:web` after target-history accessibility update — PASS — static Expo export completed to `dist/`.
- 2026-08-10 — First final focused Habits run after rebuild — TEST_BUG — schedule-edit journey used a forced, unscoped edit action without asserting edit-mode activation; failure artifact preserved under `.cursor/playwright-output/e2e-failures/`.
- 2026-08-10 — `npx playwright test e2e/habits.spec.ts --project=chromium --grep "schedule edits remain visible"` after semantic selector correction — PASS — 1 test.
- 2026-08-10 — `npx playwright test e2e/habits.spec.ts --project=chromium --grep "target edits keep"` after rebuilding — PASS — 1 target-history test with SQLite row oracle.
- 2026-08-10 — Final `npx playwright test e2e/habits.spec.ts --project=chromium` — PASS — 9 tests, including M/W/F off-day/scheduled-day flow, schedule edit reload, and historical target edit.
- 2026-08-10 — `npm run openspec:validate` — PASS — all 18 repository OpenSpec items valid.
- 2026-08-10 — `npm run qa:impact:validate` — PASS — 12 impact-map rules valid.
- 2026-08-10 — `npm run agent:resume -- --plan openspec/changes/add-habit-scheduling-and-history-semantics/execplan.md` — PASS — checkpoint reconciled; plan validation PASS; native blocker and unrelated dirty-file warnings preserved.
- 2026-08-10 — Final `npm run typecheck` — PASS — no TypeScript errors after accessible target input and journey updates.
- 2026-08-10 — Final `npm run lint` — PASS — 0 errors, 20 existing warnings; formatting and the unused Linked Action calculation were corrected.
- 2026-08-10 — Final `npm test` — PASS — 62 files, 661 tests.
- 2026-08-10 — Final `npm run qa:timezones` — PASS — all five required zones, 13 tests per zone.
- 2026-08-10 — Final `npm run agent:plan:validate -- --plan openspec/changes/add-habit-scheduling-and-history-semantics/execplan.md` — PASS — Plan-Version 2 structure valid; status remains ACTIVE because native evidence is unavailable.
- 2026-08-10 — Final native attempts: `npm run qa:native:smoke`, `npm run qa:native:targeted`, `npm run qa:native:android` — BLOCKED / ENVIRONMENT — Maestro CLI missing; final reports `simulation-output/native/native-android-smoke-2026-08-10T080542497Z.json`, `simulation-output/native/native-android-persistence-2026-08-10T080543768Z.json`, and `simulation-output/native/native-android-smoke-2026-08-10T080545012Z.json`.
- 2026-08-10 — Final `npx playwright test --project=chromium` — PASS — 86 passed, 7 skipped; includes the final target-history journey.
- 2026-08-10 — Maestro environment recovery — PASS — official Maestro 2.8.0 was present at the persisted user install path but absent from the inherited Codex process PATH; `scripts/qa-native.mjs` now probes persisted Windows user PATH entries and `.bat`/`.cmd` launchers without committing machine paths.
- 2026-08-10 — Fresh Android build/install — PASS — `android/app/build/outputs/apk/release/app-release.apk` assembled from current source with JDK 17, CMake 3.30.5, x86_64 architecture, installed on `emulator-5554` (`Nitro_API_36`, API 36, x86_64).
- 2026-08-10 — `node scripts/qa-native.mjs --platform android --flow .maestro/flows/habit-schedule-persistence.yaml` — PASS — created M/W/F habit, asserted `Mon / Wed / Fri`, killed/relaunched, and asserted the same habit/schedule; report `simulation-output/native/native-android-all-2026-08-10T093213206Z.json`.
- 2026-08-10 — `node scripts/qa-native.mjs --platform android --flow .maestro/flows/habit-persistence.yaml` — PASS — daily habit completion persisted across kill/relaunch; report `simulation-output/native/native-android-all-2026-08-10T093305536Z.json`.
- 2026-08-10 — `npm run qa:native:smoke` / `npm run qa:native:android` — PASS — native smoke traversed all six sections and settings; final Android smoke report `simulation-output/native/native-android-smoke-2026-08-10T094302028Z.json`.
- 2026-08-10 — `npm run qa:native:targeted` — PASS — 6/6 persistence flows passed, including schedule persistence; report `simulation-output/native/native-android-persistence-2026-08-10T094157950Z.json`.
- 2026-08-10 — `npm run qa:native:lifecycle` — PASS — Pomodoro lifecycle and notification-path flows passed 2/2; report `simulation-output/native/native-android-lifecycle-2026-08-10T094359203Z.json`.
- 2026-08-10 — Supabase migration audit — PASS/PARTIAL — repository had no managed migrations; added `supabase/migrations/20260810130000_add_habits_rule_history.sql` as `TEXT NOT NULL DEFAULT '[]'`, with no drop/delete/update/RLS/grant operations. Static contract checks and `npm run sim:validate` passed; local Postgres was unavailable (`docker` not found and Supabase local profile absent).
- 2026-08-10 — Remote Supabase deployment gate — BLOCKED / ENVIRONMENT + CREDENTIAL_REQUIRED + SPEC_AMBIGUITY — no target project reference, access token, public Supabase configuration, linked project, or authorized disposable project exists on this workstation; no remote mutation was attempted.
- 2026-08-10 — Remote-gate recovery audit — PASS/BLOCKED — `npx supabase --version` reported `2.113.0`; `npx supabase projects list` reported `LegacyPlatformAuthRequiredError` with no token; `npx supabase migration list --linked` reported no linked project; `npx supabase status` reported Docker/Podman unavailable. The only repository target clue is the workflow’s authoring-time ref `kruubbynsmxzxfdunaal` (`superhabits`), which remains insufficient to establish environment intent. The additive migration was verified verbatim; no remote mutation was attempted.
- 2026-08-12 — Nitro dependency/bootstrap audit — PASS/PARTIAL — Node 22.23.2/npm 10.9.8, JDK 17.0.20, Python 3.13.15, VS Build Tools 17.14, Android SDK/API 36 x86_64, CMake 3.30.5, Gradle wrapper 9.0.0, WHPX, Maestro 2.8.0, Playwright Chromium, and Deno 2.9.5 validated. `npm ci` passed and repository patches/hooks applied. User-scope Android/Maestro/Deno PATH and Android SDK variables are persisted. Docker/Podman, local EAS, and GitHub CLI remain intentionally uninstalled because they are optional/not required for the current Windows workflow.
- 2026-08-12 — CLI/tool probes — PASS — local Supabase CLI 2.113.0, EAS CLI 18.5.0, Vercel CLI 58.9.2, and `tsx` 4.23.12 resolved through pinned/one-off `npx` invocations; `deno check` passed for both Supabase Edge Functions. `npm run dev:doctor` passed overall and reports only optional global EAS/Supabase commands as absent; `npm run doctor` reports existing Expo SDK patch/config drift and the existing watcher option warning, with no blind upgrade applied.
- 2026-08-12 — Browser/web readiness — PASS — Playwright Chromium 147.0.7727.15 launched; `npm run build:web`, infrastructure Chromium 10/10, `npm run web -- --port 8091` HTTP 200, and static-web SQLite/OPFS checks passed.
- 2026-08-12 — Local QA regression — PASS — `npm test` 62 files/661 tests, `npm run qa:fast`, `npm run qa:integration` 51 tests, `npm run qa:timezones` across five zones, `npm run sim:validate`, P0 journeys 16/16, deterministic P0 simulation, `npm run build:sync`, and `npm run e2e:sync` 19/19.
- 2026-08-12 — Broad Playwright regression — ENVIRONMENT / preserved failure — `npm run e2e` completed with one heavy P2 D14 section-switch failure (`overview→todos` 993ms against the 800ms ceiling). A focused rerun timed out while mounting the same heavy fixture. No selector, threshold, or test weakening was made; the failure artifacts remain under `.cursor/playwright-output/e2e-failures/`.
- 2026-08-12 — Android toolchain and current-source build — PASS with workstation-only correction — JDK 17, CMake 3.30.5, Gradle 9.0.0, MSVC, WHPX, API-36 x86_64 AVD, and `adb` validated. The clean dependency build reproduced the documented `libc++_shared` linker omission in native dependency CMake inputs; adding that link input locally to the generated/dependency CMake files allowed `assembleRelease` to pass, after which the APK installed/launched on `emulator-5554`. No generated Android or `node_modules` correction is tracked.
- 2026-08-12 — Fresh Android native QA — PASS — `npm run qa:native:smoke` 1/1, scheduled Habit flow direct run PASS, `npm run qa:native:targeted` 6/6 including Habit V2 M/W/F persistence, and `npm run qa:native:lifecycle` 2/2. `npm run qa:native:ios` correctly returned `ENVIRONMENT` on Windows because Xcode `xcrun/simctl` is unavailable.
- 2026-08-12 — Remote Supabase gate — BLOCKED / CREDENTIAL_REQUIRED + SPEC_AMBIGUITY — all five relevant environment variables are absent; `npx --no-install supabase projects list` reports no access token; official `npx --no-install supabase login` refuses automatic login in the non-TTY agent session; linked migration list reports no project; linked dry-run stops with no project ref. No link, schema inspection, migration repair, push, remote test row, or cleanup was attempted.
- 2026-08-12 — `npm run qa:affected` + focused `npx vitest run tests/agent-execplan.test.ts` — PASS — the only current tracked change is this ExecPlan; the documentation/agent gate resolved to `qa:fast`, and the focused test passed 9/9.
- 2026-08-12 — Final `npm run agent:resume -- --plan ...`, plan validation, OpenSpec validation, impact-map validation, all-plan validation, and `git diff --check` — PASS — checkpoint reconciled, 18 OpenSpec items and 12 impact rules valid, all versioned plans valid, and no whitespace errors. Plan intentionally remains `BLOCKED` for the remote gate.

## Changed Files / Areas

- `openspec/changes/add-habit-scheduling-and-history-semantics/` — proposal, capability spec, design, tasks, and this durable plan.
- `core/db/client.ts`, `core/db/types.ts`, `core/db/schema.sql` — v12 local schema/type/reference updates.
- `features/habits/habits.domain.ts`, `features/habits/habits.data.ts`, `features/habits/HabitsScreen.tsx`, `features/habits/HabitCircle.tsx`, `features/habits/types.ts`, `core/ui/NumberStepperField.tsx` — schedule authority, persistence, accessible target editing, and UI.
- `features/overview/OverviewScreen.tsx`, `features/command/ask.retrieval.ts` — cross-feature statistics and unbounded streak retrieval.
- `core/sync/restore.coordinator.ts`, `simulation/backend/schema.sql`, `supabase/migrations/20260810130000_add_habits_rule_history.sql`, linked-action tests/paths — compatibility and remote-schema evidence where needed.
- `simulation/backend/DRIFT.md`, `scripts/qa-native.mjs`, `.maestro/flows/*.yaml` — portable native command discovery, gesture-based section navigation, and remote-schema deployment status.
- `docs/testing/native-e2e.md`, `docs/testing/known-gaps.md` — recovered Nitro evidence, native schedule coverage, and the remaining remote/off-day boundaries.
- `tests/`, `e2e/`, `simulation/`, `.maestro/` — contract coverage and deterministic/native validation.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan, and all change artifacts in this directory.
2. Run `git status --short`, `git diff --stat`, and `git diff --name-only`; preserve pre-existing dirty files and inspect overlapping diffs before editing.
3. Run `npm run agent:resume -- --plan openspec/changes/add-habit-scheduling-and-history-semantics/execplan.md`; reconcile warnings with Git and this checkpoint.
4. Run `npm run qa:affected` after meaningful implementation milestones and follow its resolved gates; use `npm run qa:timezones` for date changes.
5. Before large builds/test suites, update Current Checkpoint with the exact command and expected evidence. Preserve failures and classify them using `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`, `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY`.
6. Do not claim a lane passed unless its command actually ran; record native environment blockers explicitly.

## Outcomes & Retrospective

- Status: Blocked — native-gated completion is proven; authorized remote schema deployment and round-trip evidence are externally blocked.
- Summary: Weekly schedules, effective-dated history, schedule-aware metrics, migration, persistence, UI, restore/sync reference behavior, Linked Actions compatibility, deterministic simulation, web journeys, and performance contracts are implemented and validated.
- Proof: prior web/local evidence remains above; this continuation adds fresh Android API 36 evidence (smoke, lifecycle 2/2, targeted persistence 6/6, and scheduled M/W/F persistence), plus the repository migration and static/disposable-path audit.
- Remaining risks: The intended live Supabase project and its actual RLS/schema state remain unverifiable here. The current broad `npm run e2e` preserved one heavy P2 D14 host-performance failure and a focused rerun timed out; no threshold or assertion was weakened. The Habit V2-focused web, sync, integration, simulation, and native lanes remain green.
- Follow-up: Provide the authorized target, inspect migration status, apply only the additive migration, and prove remote upsert/read/restore. Keep reminders deferred until this remote gate closes.
