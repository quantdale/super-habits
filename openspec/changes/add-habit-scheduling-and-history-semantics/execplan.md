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

- Current milestone: Product implementation and all runnable web, sync, simulation, unit, integration, timezone, performance, and Android native lanes are complete; the only remaining acceptance item is authorized Supabase schema deployment and a remote Habit V2 round trip.
- Completed: Startup docs, skills, feature/data/DB/sync/restore/linked-action/Overview/heatmap/tests/journeys/known-gap/OpenSpec audit completed. Starting Git status/branch/log and active plan inventory captured. Existing day-rollover and linked-action dirty changes inspected. Current daily habit semantics and remote schema limitation verified. OpenSpec proposal, capability spec, design, and task list created. v12 migration/types/reference schemas, effective-dated domain algorithms, unbounded streak reads, persistence/edit behavior, restore compatibility, Overview rest-day state, schedule-diverse simulation fixtures, linked-action off-day coverage, and two fake-clock Playwright schedule journeys implemented.
- Completed this continuation: Diagnosed the persisted-vs-inherited Maestro PATH discrepancy, made the native runner portable on Windows, built/installed a fresh current-source x86_64 Android release APK, executed scheduled and daily Habit persistence, and created/static-validated the additive remote migration. No reminder work is in scope.
- In progress: None locally. Waiting only for authorized Supabase target/project context to perform the remaining remote migration and round-trip proof.
- Important modified files: pre-existing dirty files listed above; new change artifacts under this directory plus the habit engine files and focused tests listed in Changed Files / Areas.
- Last successful validation: `npm run e2e` — PASS — 151 passed, 17 skipped across Chromium, journeys, and simulation; plus `qa:fast`, integration (51), five-zone timezone (13 per zone), P0 journeys (16), sync journeys (19), focused Habits (9), native smoke, native lifecycle (2/2), native targeted (6/6), OpenSpec (18/18), impact-map validation, and migration static checks. Remote deployment remains unrun by safety gate.
- Current failures: None in the final runnable validation lanes. An earlier focused Habits run exposed a `TEST_BUG` in the schedule-edit journey: a forced, unscoped action did not assert edit-mode activation. The journey now waits for the semantic exit state, scopes the edit action to Habit groups, and the final 9-test file passes.
- Relevant quarantines: Preserve existing known gaps and performance contracts; do not claim them closed without evidence. The earlier Maestro-missing reports remain historical ENVIRONMENT evidence; current native execution is green. Native off-day date semantics remain covered by domain/web/timezone lanes because deterministic Android clock mutation is not safely supported.
- Blocker: Remote schema deployment and round-trip access remain unverified. The repository-supported Supabase CLI is `2.113.0`, but `npx supabase projects list` reports that no access token is available; the repository is not linked, no public client configuration or ignored linked metadata exists, and Docker/Podman is unavailable for a local Supabase fallback. The deployment workflow contains only an authoring-time clue (`kruubbynsmxzxfdunaal`, named `superhabits`), which does not by itself establish the intended environment or authorize mutation.
- Condition required to unblock: Authenticate with the official Supabase CLI and explicitly confirm that the workflow ref `kruubbynsmxzxfdunaal` is the intended guarded development/staging or disposable target (or provide the correct project ref and environment), then inspect migration status before applying only this migration and run the dedicated Habit V2 round trip.
- Exact resume action after unblock: `npx supabase migration list --linked` (after linking/authentication and target confirmation), apply the pending repository migration with the repository-supported command, then run the established disposable/backend round-trip lane or a narrowly scoped test/dev row upsert and restore verification.
- Exact next action: User/operator runs `npx supabase login` (or supplies the supported `SUPABASE_ACCESS_TOKEN` through secure workstation configuration) and confirms the intended project ref/environment; then rerun `npx supabase projects list` and link only the confirmed target. Do not run `supabase link` or `supabase db push` against an unidentified project.
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
- Remaining risks: The intended live Supabase project and its actual RLS/schema state remain unverifiable here. The existing aggregate `npm run e2e:full` timed out in the earlier session; its constituent projects were rerun successfully and are recorded above.
- Follow-up: Provide the authorized target, inspect migration status, apply only the additive migration, and prove remote upsert/read/restore. Keep reminders deferred until this remote gate closes.
