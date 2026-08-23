# ExecPlan: Weekly Review Cadence Loop

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Weekly Review is SuperHabits' anchor ritual — it reschedules stale todos, carries work forward, and rolls up habit/todo progress — but nothing ever prompts it. This change closes the adoption loop: a schedule-aware weekly nudge with one-tap entry into the review, persisted through backup/restore like every sibling reminder.

## Context

- Notification infrastructure already covers todo due-dates (`todoReminderScheduler`), schedule-aware habit reminders (`habitReminders.service`), and a daily-plan nudge (`dailyPlanReminderScheduler`) — the weekly loop is the missing sibling.
- Settings snapshot is at `BACKUP_SETTINGS_VERSION = 4` with an append-only canonical-text rule; the weekly key is the final V4 field and the frozen V3 form remains compatible.
- Web degrades silently for native notifications; the honest-degradation pattern is established in the Notifications settings bucket.

## Scope

Pure occurrence math → preference persistence → native scheduler bridge → deep entry → settings UI → backup/restore coverage → focused validation.

## Non-Goals

- Two-way sync of any kind; changes to review executor semantics; iOS-specific delivery proof (capability gap #1 stands).

## Current Checkpoint

- Current milestone: Weekly Review implementation, Settings V4 persistence, web/sync journey proof, deterministic simulation proof, and HEAVY performance-gate measurement fix are complete; exact CI then exposed a simulation-harness numeric-input race, which is corrected locally and now awaits final commit/push certification.
- Completed: Core reminder wave is implemented: pure occurrence math + codec, AsyncStorage preference store, native cancel-then-schedule bridge, notification response routing into the Weekly Review surface, and the Notifications settings row with honest web/native-only copy. Settings V4 now captures live AsyncStorage preferences, restores them through the durable post-commit marker, and preserves frozen V3 canonicalization.
- In progress: Run the post-fix focused and broad gates, finalize OpenSpec/ExecPlan evidence, serialize the coherent commit, push it, and certify the exact SHA.
- Important modified files: `core/backup/backup.types.ts`, `core/backup/backupRestore.ts`, `core/backup/backupSettings.ts`, `core/portable/portableFormat.ts`, `core/notifications/notificationPreferences.ts`, `core/notifications/weeklyReviewReminderScheduler.ts`, `features/settings/SettingsNotificationsSection.tsx`, `features/weekly-review/weeklyReviewReminder.domain.ts`, `simulation/runner/actions.ts`, simulation report/runner files, `e2e/journeys/settings-ripple.spec.ts`, and the new focused tests.
- Last successful validation: fresh `npm run build:web` PASS; corrected deterministic reproducibility passes 3/3 on `E2E_PORT=8083`; `npm run qa:simulation -- --all --mode deterministic` passes all 22 scenarios; and the complete four-project E2E run passes 183/227 with 44 expected skips and 0 failures. The full run includes Weekly Review journey test 204, simulation self-test 3.5, and schema test 4.4; HEAVY section-switch maximum was 766 ms against the unchanged 800 ms ceiling. Prior typecheck/lint/unit/integration/timezone/OpenSpec/impact/theme/schema, focused settings-ripple 6/6, P0 journeys 25/25, sync E2E 46/46, and HEAVY 10/10 evidence remain green, all on `TZ=Asia/Manila` using isolated ports.
- Failures: GitHub run `32635670615` at `5f6f062` had quality PASS and e2e FAIL with 182 passed/44 skipped/1 failed in self-test 3.5. Artifact `simulation-output/run_mt5q8j9f_udl3xlcl/run-report.json` showed the first scenario run's requested `target=3` persisted as `target_per_day=31` during `createHabit`; this was traced to the controlled React Native Web input racing between `fill('')` and delayed `type('3')`, not a Weekly Review or product data failure. The harness now uses one fill plus `toHaveValue`. Native smoke/persistence/lifecycle remain ENVIRONMENT-blocked because no e2e-test APK is installed. Repository-wide `format:check` still reports 68 pre-existing non-campaign markdown/YAML files; touched files pass targeted formatting.
- Relevant quarantines: None.
- Blockers: None for local investigation; GitHub job-log re-run/access is external and will be verified after the root-cause fix is pushed.
- Condition required to unblock: N/A.
- Exact resume action after unblock: N/A.
- Exact next action: Inspect the final diff and validators, commit/push the corrected harness, and verify the exact SHA's remote branch and GitHub Actions status.
- Remaining definition of done: default E2E + sync evidence, final OpenSpec/ExecPlan reconciliation, final commit/push, and exact-SHA CI certification as far as the available GitHub access allows; native lanes remain an explicit environment blocker until an installed e2e-test APK is available.

## Progress

- [x] Gap audit + campaign selection
- [x] 1.1 Domain helper + unit tests (8/8)
- [x] 1.2 Preference model + storage key
- [x] 2.1 Scheduler bridge (single identifier, replace-not-duplicate)
- [x] 2.2 Notification tap → Weekly Review entry (dispatcher + host wiring)
- [x] 3.1 Settings control (toggle/weekday/time; honest web note)
- [x] 3.2 Settings runtime validation test additions
- [x] 4.1 Settings V4 allowlist extension (append-only; V3 canonical form frozen)
- [x] 4.2 Restore V2 + portable import coverage
- [x] 5.1 Unit, integration, and type/lint validation ladder
- [x] 5.2 Web journey, simulation, and HEAVY performance ladder
- [x] 5.3 Sync lane and final certification ladder

## Surprises & Discoveries

- The first isolated simulation attempt was pointed at an unrelated development server already occupying port 8081; rerunning on a dedicated static-server port passed all lanes. This is recorded as an environment hazard, not a product or assertion change.

## Decision Log

- 2026-08-23 — Selected over global search / backup-nudge candidates: highest retention leverage on an already-built ritual; lowest risk; strongest test-pattern precedent (daily-plan loop).

## Validation Ledger

- 2026-08-23 — Post-RC gap audit basis — INFO — known-gaps register read; feature surface inventoried; reminder coverage mapped.
- 2026-08-23 — `npm run qa:affected -- --files ...` — PASS — impact map selected `qa:fast`, `qa:full`, `qa:integration`, `qa:journeys`, `qa:simulation`, `qa:native:smoke`, and `qa:native:targeted` with broad regression required.
- 2026-08-23 — Focused web settings journey — PASS — 6/6 steps; numeric weekday/time preference persisted and reloaded with honest web copy.
- 2026-08-23 — `npm run qa:integration` — PASS — 36 files / 206 tests.
- 2026-08-23 — `npm run qa:journeys` — PASS — 25/25 prioritized journeys after a fresh web export.
- 2026-08-23 — `npm run qa:simulation` — PASS — 22 scenarios validated; deterministic smoke 24/24.
- 2026-08-23 — exact combined `npm run e2e` — PARTIAL/CLASSIFIED — 178 passed, 44 skipped, 4 did not run; one P2 HEAVY section-switch oracle observed 934 ms before measurement stabilization.
- 2026-08-23 — P2 HEAVY controlled repetition — PASS — 10/10 full repetitions; browser RAF polling + `performance.now()` retained the 800 ms assertion and measured max switch 758 ms.
- 2026-08-23 — `npm run build:sync` — PASS — fresh `dist-sync` export; dummy Supabase URL verified in output.
- 2026-08-23 — `npm run e2e:sync` — PASS — 46/46 sync-boundary journeys on port 8082.
- 2026-08-23 — fresh `npm run build:web` + exact `npm run e2e` — PASS — 183 passed, 44 expected runtime-gated skips, 0 failures across 227 tests; final P2 max switch 693 ms.
- 2026-08-23 — native smoke/persistence/lifecycle — ENVIRONMENT — Android package `com.dale16.superhabits` is not installed; reports under `simulation-output/native/`.
- 2026-08-23 — GitHub Actions run `32635670615` @ `5f6f062b15de332a3f06156f04c1802e68756a5f` — quality PASS; e2e FAIL with 182 passed, 44 skipped, and one deterministic self-test failure. Artifact inspection identified a controlled numeric-input clear-plus-type race (`3` became `31`), now corrected with one fill and an explicit value assertion.
- 2026-08-23 — Corrected deterministic reproducibility test, `--repeat-each=3` on `E2E_PORT=8083` — PASS — 3/3 after input synchronization fix.
- 2026-08-23 — `npm run qa:simulation -- --all --mode deterministic` — PASS — fresh web export and 22/22 deterministic scenarios.
- 2026-08-23 — corrected full `npm run e2e` on `TZ=Asia/Manila`, `E2E_PORT=8083` — PASS — 183 passed, 44 expected skips, 0 failures across 227 tests; Weekly Review settings journey, self-test 3.5, schema test 4.4, and HEAVY section switching all passed.

## Changed Files / Areas

- `features/weekly-review/**`, `core/notifications/**`, `features/settings/**`, `core/backup/settings allowlist`, `tests/**`.

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, this plan.
2. git fetch/reconcile; run agent:resume -- --plan <this file>.
3. Continue from Exact next action.

## Outcomes & Retrospective

- Status: Active.
