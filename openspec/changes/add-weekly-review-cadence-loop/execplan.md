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

- Current milestone: Weekly Review implementation, Settings V4 persistence, web/sync journey proof, deterministic simulation proof, and HEAVY performance-gate measurement fix are complete; only commit/push and exact-SHA certification remain.
- Completed: Core reminder wave is implemented: pure occurrence math + codec, AsyncStorage preference store, native cancel-then-schedule bridge, notification response routing into the Weekly Review surface, and the Notifications settings row with honest web/native-only copy. Settings V4 now captures live AsyncStorage preferences, restores them through the durable post-commit marker, and preserves frozen V3 canonicalization.
- In progress: Finalize OpenSpec/ExecPlan evidence, serialize the coherent commit, push it, and certify the exact SHA.
- Important modified files: `core/backup/backup.types.ts`, `core/backup/backupRestore.ts`, `core/backup/backupSettings.ts`, `core/portable/portableFormat.ts`, `core/notifications/notificationPreferences.ts`, `core/notifications/weeklyReviewReminderScheduler.ts`, `features/settings/SettingsNotificationsSection.tsx`, `features/weekly-review/weeklyReviewReminder.domain.ts`, simulation report/runner files, `e2e/journeys/settings-ripple.spec.ts`, and the new focused tests.
- Last successful validation: typecheck PASS; lint PASS (0 errors/12 warnings); `npm test` 146 files/1,745 tests PASS; integration 36 files/206 tests PASS; timezone matrix 5 zones/43 tests each PASS; OpenSpec 40/40 PASS; impact map, theme contrast (140 checks), and Supabase schema PASS; focused settings-ripple 6/6 PASS; P0 journeys 25/25 PASS; deterministic simulation validation (22 scenarios) + smoke 24/24 PASS; isolated simulation self-test plus three repeated 4.4 runs PASS; exact combined E2E 183 passed/44 skipped/0 failed; sync E2E 46/46 PASS; HEAVY performance 10/10 repetitions PASS with max switch 758 ms after RAF/performance.now measurement stabilization, all on `TZ=Asia/Manila` using isolated ports.
- Failures: Latest known CI evidence is GitHub run `32607777040` at `69bc1ff`, with quality PASS and one substantive simulation self-test failure in the main E2E lane. The locally repeated scenario/seeded/repro sequence and deterministic QA pass; the diagnostic patch now reports the exact lane and environmental context if CI reproduces it. The first exact combined local E2E run reached 178 passed/44 skipped/4 not run and exposed one P2 HEAVY switch measurement at 934 ms; controlled repetition showed the coarse Node-side polling caused near-threshold observation jitter, and the unchanged 800 ms assertion now passes 10/10 with browser-frame sampling. One `qa:fast` run had a transient restore-coordinator module-lifecycle timeout, but the isolated test and subsequent full unit rerun passed. Repository-wide `format:check` still reports 68 pre-existing non-campaign markdown/YAML files; every touched file passes targeted formatting.
- Relevant quarantines: None.
- Blockers: None for local investigation; GitHub job-log re-run/access is external and will be verified after the root-cause fix is pushed.
- Condition required to unblock: N/A.
- Exact resume action after unblock: N/A.
- Exact next action: Inspect the final diff, run the plan validators once more, commit/push, and verify the exact SHA's remote branch and GitHub Actions status.
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

## Changed Files / Areas

- `features/weekly-review/**`, `core/notifications/**`, `features/settings/**`, `core/backup/settings allowlist`, `tests/**`.

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, this plan.
2. git fetch/reconcile; run agent:resume -- --plan <this file>.
3. Continue from Exact next action.

## Outcomes & Retrospective

- Status: Active.
