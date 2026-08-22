# ExecPlan: Harden UI/UX Mass Implementation Wave V1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Convert the latest code-only Warm Momentum/UI-UX mass implementation wave into a production-grade, regression-verified state while also reconciling the older still-ACTIVE `harden-parallel-completion-wave-v2` campaign.

## Context

- Repository: `quantdale/super-habits`.
- Post-wave baseline independently verified: `6dd41bbd51f091aed44f4918ca8f336ec5c421c9` equals remote `main`.
- Only remote branch is `main`.
- Wave range: `3ee030cbefb0bbc4438a062e63509adc3656ae4e..6dd41bbd51f091aed44f4918ca8f336ec5c421c9`, 19 commits, 82 changed files, roughly +9101/-808.
- `docs/ui-ux-design-dna` was merged intact and deleted remotely.
- The implementation wave intentionally ran only typecheck + slice lint and deferred broad QA.
- Older hardening plan `openspec/changes/harden-parallel-completion-wave-v2/execplan.md` remains ACTIVE and contains pre-UI-wave E2E checkpoint state; it must be reconciled, not ignored.
- Authoritative SQLite chain now ends at migration 21 (`daily_plans.top_todo_titles`). New migration work starts from the actual next free version, expected >=22.
- Independent live Supabase check after the wave: migration ledger currently ends at `20260820010000_planning_schema_convergence`. Repository migrations `20260821000000`, `20260821010000`, and `20260822000000` are not yet live, so current client remote contracts are ahead of production schema.

Authoritative files:

- `proposal.md`
- `design.md`
- `tasks.md`
- `specs/ui-ux-mass-wave-hardening/spec.md`
- this ExecPlan
- all `docs/ui-ux/**`
- all `openspec/changes/harden-parallel-completion-wave-v2/**`.

## Scope

- Fresh full regression after the code-only wave.
- Product/test-drift classification and root-cause repair.
- Todo, Habit, Pomodoro, Workout, Calories, Today/Overview, Planning, Goal/Project, Progress hardening.
- Warm Momentum design-system, responsive, keyboard, screen-reader, reduced-motion validation.
- Daily Plan title-snapshot durability/backup/remote verification.
- Reconciliation of prior hardening obligations.
- Pending live Supabase migration convergence and advisors.
- Full web/E2E/sync/simulation/timezone/native-as-available validation.
- Exact-final-SHA GitHub CI closure.

## Non-Goals

- New unrelated product features.
- Another design rewrite.
- Force push/history rewrite.
- Test weakening/skipping as a substitute for fixing regressions.
- Faked environment/native evidence.

## Current Checkpoint

- Current milestone: DEFECT_FIX_WAVE_1_INTEGRATED — fresh session resumed at origin/main `0baef36`; Tasks 0.x + 1 complete; 8 area audits complete; fix wave 1 (7 agents + orchestrator-owned backup/portable convergence) integrated with all local unit/integration gates green; live Supabase migrations applied and verified.
- Completed: fetch/prune fast-forward to `0baef36` (remote main-only, tree clean); read both campaigns + docs/ui-ux core set; `npm run agent:plans` reconciled; baseline gates run and every failure classified; two lint-staged stashes audited (stale, behind main — drop deliberately after first checkpoint commit); 8 read-only audits produced the defect inventory below; fix wave 1 fixes landed for Todos/Habits/Pomodoro/Workout/Calories/Guided Planning/core-ui a11y plus orchestrator items (backup convergence, drift pins, CACHE_VERSION v6, contrast/touch-target/strip fixes, prettier); live Supabase converged (3 pending migrations applied in order, ledger verified, objects probed).
- Completed (this session): fetch/prune fast-forward `6dd41bb..0baef36` (remote main-only, tree clean); read both campaigns + docs/ui-ux core set; `npm run agent:plans` reconciled (also found `harden-productivity-expansion-wave-v1` ACTIVE on environment gates only — live Supabase migration task overlaps ours; native E2E remains ENVIRONMENT); baseline gates: typecheck PASS, lint FAIL (4 prettier errors, auto-fixable; 13 warnings within policy), full Vitest TZ=Asia/Manila 1681/1689 PASS with 8 failures triaged; two lint-staged stashes audited — both trees are thousands of lines BEHIND main (stale automatic backups of already-committed work; unique-era content was recovered into main earlier per old campaign log); drop deliberately after first checkpoint commit.
- Baseline failure classification (all reproduced from log evidence):
  - PRODUCT_BUG — 5× `tests/integration/portableExportImport.test.ts`: migration 21 added `daily_plans.top_todo_titles` but backup/portable contracts were not evolved; exported envelope rows carry the new column and `validatePortableBackupFile` rejects unrecognized keys → export re-validation false + preparePortableImport 'rejected'. Orchestrator-owned fix.
  - TEST_DRIFT — `tests/db.client.test.ts:302` transaction count 11→12 (migration 21 appended); `tests/integration/fixtures.test.ts:40` schema version pin '20'→'21'.
  - FLAKY-suspect (Windows) — `tests/integration/migrations.test.ts:264` EBUSY unlink of temp dir; rerun in isolation to confirm before any change.
- Audit defect inventory (8 explore agents, all read-only; citations in their reports):
  - TODOS: HIGH `queryActive` precedence bug `(filters.priority && ...) === true` always false → priority/due-only filters stay in default branch → drag-reorder enabled on filtered subset → `updateTodoOrder` absolute renumber corrupts global sort_order (TodosScreen.tsx:156-160, todos.data.ts:332-357); MED bulk Reopen dead UI, bulk delete lacks confirmation, bulk {changed,skipped} outcomes discarded; LOW startEdit async race; TEST_DRIFT e2e/todos.spec.ts:47-55 swipe-delete now opens confirmation dialog.
  - HABITS: HIGH `incrementHabit` has NO data-layer lifecycle/schedule/effective-date guard (habits.data.ts:137-246) — named campaign debt unmet on primary path; linked-action adapters unguarded (863-1064); steppers bypass schedule gate; HabitCircle gating omits lifecycle masking + creation boundary; day-strip aggregates lack per-date masking; paused-interval streak masking itself OK.
  - POMODORO: HIGH pause() leaves durable intent untouched → reload after long pause phantom-logs a full session via reconcile `complete-unlogged` (PomodoroScreen.tsx:570-577 vs domain planActiveTimerReconcile); MED pill-switch/settings-save during pause leak intent + orphan OS notification. Exactly-once dedupe chain otherwise sound (ref guard → started_at existence → insert-time id dedupe).
  - WORKOUT: HIGH skipped-set dispositions lost on resume → resurrected completed=1 inflating sets_completed/volume (draft persists only {routineId, startedAtIso, phaseIndex, elapsedAdjustSeconds}); MED duration_seconds spans app-closed gap (wall-clock endedAt vs replayed start); measured-zeros OK, PR double-count OK, finish tx integrity OK.
  - CALORIES: HIGH quick-kcal rides `upsertSavedMeal` unconditionally → phantom "Quick add" catalog row + use_count inflation (calories.data.ts:155-170, 238-300); MED edit path increments use_count; copy-day/DST/rollover verified OK.
  - PLANNING/OVERVIEW: HIGH `top_todo_titles` missing from BACKUP_ENTITY_COLUMNS.daily_plans (stripped by adapter projection), validator has no rule (rejects future-correct rows), `applyRemoteDailyPlans` INSERT omits it → snapshots never survive backup/restore (backup.types.ts:240, backupValidators.ts DAILY_PLAN_RULES, dailyPlan.data.ts:388-425); MED guided flow save discards carried-forward ids + clobbers notes/reflection/energyScore + misaligned title lookup (filtered-index bug); Next Best Action deterministic+pinned Today verified OK; zero unit tests for top_todo_titles.
  - DESIGN/A11Y: keyboard focus ring exists only in tab rail (Button/IconButton/MenuSheet/Modal close lack visible web focus); hardcoded light-only `bg-amber-50` chip in HabitsScreen; raw SECTION_COLORS used as text color sub-AA contrast in QuickCaptureOverlay:492 + GuidedPlanningFlow:187; "Progress" button 36px target; reduced-motion coverage table verified GOOD (all 4 meaningful new animations gated).
  - PWA/COMMAND/NOTIFICATIONS: HIGH CACHE_VERSION still 'v5' across entire UI wave → existing installs never detect the new shell (public/sw.js:23); update flow/offline indicator/notification exactly-once/command remote parity verified OK.
- In progress: E2E validation ladder next.
- Exact next action: commit fix wave 1 in coherent slices, then run the E2E ladder (`npm run build:web` → focused specs → full Playwright/journeys/PWA → simulation → timezone → dist-sync), reconcile both campaign plans, push, and watch CI for the exact final SHA.
- Important modified files: see Validation Ledger entries and `git status`; Git is authoritative.
- Last successful validation: full Vitest 1726/1726 on the combined fix-wave tree (2026-08-22); supabase:schema:validate PASS.
- Current failures: None open locally. Environment-limited items recorded in Validation Ledger (Supabase advisors need dashboard/docker tooling; native lanes pending device check).
- Relevant quarantines: None accepted as closure evidence.
- Blockers: None to local work; none to live Supabase (authorized CLI access confirmed, migrations applied and verified). Remaining closure items are validation-ladder runs, plan reconciliation, and exact-SHA CI green.
- Remaining definition of done: unchanged from handoff (all non-environment tasks evidenced; prior plan honestly reconciled; live convergence when authorized; full QA green incl. E2E/journeys/simulation/timezone/dist-sync; clean main-only Git; exact final SHA GitHub quality+e2e green).

## Progress

- [x] Authoring: verify reported UI/UX wave landed on remote main.
- [x] Authoring: verify branch consolidation resulted in remote main-only.
- [x] Authoring: inspect merged UI/UX roadmap and known debt.
- [x] Authoring: detect migration-head change to v21.
- [x] Authoring: independently detect live Supabase migration lag.
- [x] Authoring: persist post-wave hardening package.
- [x] Reconcile repository and active historical plans. (0baef36; plans reconciled; stash audit done)
- [x] Establish fresh full post-wave regression baseline. (TS PASS; lint 4 prettier errs; Vitest 1681/1689, 8 failures classified)
- [x] Harden Todos/Habits. (fix wave 1 commits 2981647, a662a39)
- [x] Harden Focus/Workout. (f7d7aa8, 6a0b8ec)
- [x] Harden Calories/Today. (ab1f9e1; Today strip current-day fraction in 82f2a7a; Overview verified OK in audit)
- [x] Harden Planning/Goals/Projects/Progress. (8f9c920; top_todo_titles convergence in 6908f91)
- [x] Harden design system/accessibility/responsive behavior. (82f2a7a focus rings/contrast/strip; reduced-motion + responsive verified in audit)
- [x] Reconcile Backup/Portable/migration-21 contract. (6908f91; live migrations applied)
- [x] Apply/verify live Supabase convergence. (db push exit 0; ledger + PostgREST probes recorded)
- [ ] Repair E2E/journeys/simulation test drift and product bugs.
- [ ] Run full final validation ladder.
- [ ] Reconcile older hardening plan and this plan to evidence.
- [ ] Push exact final main and obtain GitHub quality/e2e green.

## Surprises & Discoveries

- 2026-08-22 — The previous code-only wave correctly merged the UI/UX docs branch but also landed on top of an older ACTIVE hardening plan whose exact checkpoint still describes unfinished E2E triage from before the latest redesign.
- 2026-08-22 — Current source has migration 21 while live Supabase remains at `20260820010000`; three later repository migrations are absent from the live ledger.
- 2026-08-22 — The implementation report explicitly identifies four product-debt areas requiring root-cause hardening: workout resumed measurements, quick-kcal saved-meal coupling, Pomodoro crash-recovery summary path, and past-day Habit lifecycle write gating.
- 2026-08-22 — The UI/UX wave changed high-frequency interaction structure enough that multiple E2E selector failures are expected, but each must be reproduced/classified rather than blanket-updated.

## Decision Log

- 2026-08-22 — Create a dedicated post-UI-wave hardening change rather than overwriting the historical hardening artifacts. The new orchestrator must reconcile the older ACTIVE plan as part of closure so both histories stay auditable.
- 2026-08-22 — Treat live Supabase schema lag as blocking because current client backup/sync/restore contracts include fields/tables introduced by pending migrations.
- 2026-08-22 — Do not automatically persist every UI preference remotely; hardening focuses on correctness/recovery contracts already established by the product and current settings architecture.
- 2026-08-22 — Fix wave 1 delegated to 7 coder agents on strictly disjoint file sets (Todos; Habits incl. its screen cosmetics; Pomodoro; Workout; Calories; GuidedPlanningFlow incl. its contrast fix; core/ui a11y primitives). Agents run targeted Vitest only and never commit; orchestrator serializes commits. Orchestrator exclusively owns backup/portable/validator/restore `top_todo_titles` convergence, migration-related test-drift pins, prettier autofix, CACHE_VERSION bump, integration, and all later gates.
- 2026-08-22 — Workout resume duration: keep wall-clock `started_at` but persist accumulated active elapsed in the draft and derive `duration_seconds` from active time, so app-closed gaps are not billed as workout duration; skipped-set dispositions must be persisted in the draft to stop completed=1 fabrication.
- 2026-08-22 — Calories quick-kcal split via `{ maintainSavedMeal }` option on add/update entry paths (default true for form path); quick-add passes false; edit path skips use_count increment; unit test that codified the coupling is updated to the new intended contract (not weakened).

## Validation Ledger

- 2026-08-22 — `git fetch --prune` + ff to `0baef36` — PASS — remote main-only; tree clean; stashes inspected (2 stale lint-staged backups, behind main).
- 2026-08-22 — GitHub compare `6dd41bb..main` at session start — PASS — identical; then advanced to `0baef36` (campaign spec commit).
- 2026-08-22 — `npm run agent:plans` — PASS — this plan + older wave-v2 plan + productivity-expansion-v1 ACTIVE (latter on environment gates only).
- 2026-08-22 — `npm run typecheck` (baseline) — PASS — 0 errors.
- 2026-08-22 — `npm run lint` (baseline) — FAIL — 4 prettier/prettier errors (e2e/journeys/fat-fingers.spec.ts, e2e/journeys/settings-ripple.spec.ts, e2e/workout.spec.ts, tests/workout.restPreferences.test.ts), all auto-fixable; 13 warnings within ≤25 policy.
- 2026-08-22 — full Vitest TZ=Asia/Manila (baseline) — FAIL — 1681/1689 PASS; 8 failures classified (5 portable PRODUCT_BUG top_todo_titles validator gap; 2 TEST_DRIFT migration-count/schema-version pins; 1 migrations.test EBUSY Windows FLAKY-suspect pending isolation rerun).
- 2026-08-22 — Orchestrator: backup/portable `top_todo_titles` convergence — FIXED — appended column to current BACKUP_ENTITY_COLUMNS.daily_plans only (V4 frozen snapshot untouched); validator uses optionalColumnRule (absent=null-safe legacy, null/string current); applyRemoteDailyPlans INSERT includes it; fixture daily_plans gains column; schema validator requires migration+fixture column; stale migration comment corrected (comment-only edit, DDL untouched; migration not yet applied live). Decision: append-only addition WITHIN scope-V5 epoch — historical backups keep meaning, no scope bump required.
- 2026-08-22 — TEST_DRIFT pins updated — db.client.test.ts tx count 11→12 + up-to-date probe '20'→'21'; fixtures.test.ts version pin '20'→'21'; migrations.test v13-no-op pins '20'→'21' (EBUSY was downstream of assertion failure leaving session open — deterministic, not flaky).
- 2026-08-22 — `npm run supabase:schema:validate` after changes — PASS.
- 2026-08-22 — targeted reruns post-fix — PASS — portableExportImport(6)+db.client(17)+fixtures(4) = 27/27; migrations.test 7/7; backupValidators+portableFormat+portableExportSize = 65/65 incl. new legacy/null/non-string top_todo_titles cases.
- 2026-08-22 — public/sw.js CACHE_VERSION 'v5'→'v6' — UI wave shipped ~10 shell-changing commits without a bump, silently disabling update detection for existing installs (audit finding); bumped for next deploy.
- 2026-08-22 — prettier --write on the 4 baseline lint-error files — fixed (fat-fingers.spec, settings-ripple.spec, workout.spec, workout.restPreferences.test).
- 2026-08-22 — Fix wave 1 agent reports — Todos D1-D7 complete (48/48 todos tests; queryActive fix + drag defense-in-depth + bulk confirm + dead Reopen removed + outcome notices + startEdit race guard + e2e delete-confirm drift update); Pomodoro complete (59/59; pausedRemainingSeconds in durable intent + interrupted reconcile verdict + pill/settings cleanup); Workout complete (70/70 incl. new draft suite; dispositions/enteredSets/remaining persisted + back-compat + active-time duration override for resumed sessions).
- 2026-08-22 — Fix wave 1 remaining agents — Habits complete (125/125; isHabitActionableOn domain predicate gating incrementHabit + linked-action adapters at the DATA layer incl. status/lifecycle/schedule/creation boundary; screen mirrors predicate; decrement intentionally ungated so invalid check-ins stay removable); Calories complete (93/93; maintainSavedMeal opt default true, quick-add false, edit path skips catalog, linked-action path skips); Guided Planning complete (68/68 planning suites; new guidedPlanning.model.ts pure module: delta-only carry-forward seeding, existing-plan prefill through canonical upsertDailyPlan, unfiltered-index title alignment, sectionAccents contrast); core/ui focus rings complete (useKeyboardFocusRing helper wired into Button/IconButton/MenuSheet items+Cancel/Modal close, web-only, APIs unchanged; typecheck+eslint clean).
- 2026-08-22 — Orchestrator extras — QuickCaptureOverlay 'Captured.' text → sectionAccents.habits.text (sub-AA raw color fixed); TodayProgressStrip Tasks fraction → current-day semantics (completed today vs due-today+overdue set; '—' when nothing due) per task 7.4.
- 2026-08-22 — Combined-tree gates round 1 — typecheck PASS; lint FAIL (41 prettier errors across agent-edited files → prettier --write → PASS 0 errors/13 warnings); Vitest 11 failed/1715 passed → triaged: 5 REAL seed-drift TEST_DRIFT (dateKeys ×2, fixtures TYPICAL/HEAVY, planningRollups: tests seeded habit completions via incrementHabit on dates before the seeded habit's creation — the new intentional lifecycle gate correctly rejects them) + timeouts in backupRestore settings tests that pass sequentially (Windows parallel-file contention; Habits agent independently observed same).
- 2026-08-22 — Focused Playwright round 2 (after tablist/habit-tile/diary fixes; dist rebuilt): 42 passed / 21 failed. Remaining failures root-caused to 3 causes:
  1. TEST_DRIFT — TodoQuickCapture placeholder "Quick add a task..." collided with every spec's /Add a task/i modal-input lookup (fills landed in quick capture). FIXED product-side: placeholder now "Quick add" (single-point deconfliction; no spec asserted the old copy). Covers boundary todos ×3 + todos.spec ×6.
  2. FLAKY-by-design race in test helper — fillRoutineName used char-by-char .type({delay:15}); failure snapshot proved the routine was created as 'Bi' (dropped chars) on the heavier redesigned screen. FIXED helper to atomic fill(). Covers workout.spec ×5 + boundary :228.
  3. PRODUCT_BUG — Habits day-strip selection captured at mount never follows day rollover: after advanceToNextDay the ring read '0 of 1 on Mon, Aug 10' with viewingPastDay=true — check-ins would silently target yesterday after midnight. FIXED product-side: effect snaps selectedDateKey to toDateKey() on DayRolloverProvider generation change. Covered by habits.spec M/W/F off-day journey.
     Portable-backup ×4 = cause 1 (seeds todos via the modal helpers). Pomodoro ×4 all green in this round.
- 2026-08-22 — Focused Playwright round 3 (fresh dist with 'Quick add' placeholder + rollover snap): 53 passed / 2 failed → boundary:68 (fixed post-launch: inline `.first()` swept to `.last()` across 7 spec files incl. journeys) + todos:30 (strict-mode duplicate 'Mark incomplete' checkbox once completed tasks shown; scoped `.first()`). Both verified PASS individually. Focused chromium suite effectively 55/55 green.
- 2026-08-22 — Full `npm run e2e` round 1: chromium project FULLY GREEN (121 tests); journeys/simulation surfaced 7 failures, ALL root-caused and fixed (test-side only; no product changes since BUILD3):
  1. P3 setup + P4 double-increment — shared oracle helper `switchSection` had the same unscoped 'Habits' lookup → scoped to 'Section tabs' tablist.
  2. P3 theme step + simulation smoke/4.4 — stale Overview marker 'Your day at a glance…' (copy removed by UI wave) in SECTION_HEADINGS + three-months-in markers; replaced with the unique visible 'Customize' toggle text. Simulation imports switchSection from e2e/helpers/oracles, so both sim selfTest failures share this root cause.
  3. P1 Maya step 7 — async session-log insert raced single-shot row read; passes solo. Added polled `expectRowsEventually` oracle and used it for that count (strengthens the assertion, no timeout inflation).
  4. P2 Tom step 3 — sectionOpacity leaf-text matcher used the same stale overview marker; now 'Customize'.
  5. Journey habit-tile locators in chain-reaction-habit-increment/bad-backend/fat-fingers/the-commute swept to the `Add anytime habit` a11y contract.
- 2026-08-22 — Full journeys round: 66 passed / 2 failed → both fixed at root:
  1. a-tuesday step 7 (recurred under suite load): root cause identified — the session insert is fire-and-forget and each row-oracle read navigates to the DB harness, destroying the app page before an in-flight insert commits under load. Fixed by awaiting the SessionNotePrompt (renders ONLY after recordCompletedPomodoroSession confirms inserted=true) before any row oracle — a contract-based durability gate, not a timeout bump. Verified green solo.
  2. fat-fingers step 7: swipe-anchor helper blindly preferred nth(1) of any duplicate title; the redesigned completion settle leaves a transient pending copy that detaches after count(), hanging the anchor. Fixed helper to anchor the LAST visible match (re-resolved per action). fat-fingers now 11/11.
- 2026-08-22 — Definitive full `npm run e2e` — **PASS** — 183 passed / 0 failed / 0 flaky over 29.7m across chromium+journeys+simulation+pwa. Every previously-failing surface green including the P1 focus-session exactly-once step under suite load, the M/W/F habit rollover journey, and both simulation selfTest reproducibility/schema tests.
- 2026-08-22 — Timezone matrix — **PASS** — Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati (.agent/hardening-evidence/qa-timezones.log).
- 2026-08-22 — dist-sync build (dummy Supabase env) running; e2e:sync lane next; native lane will be attempted once more before closure.
- 2026-08-22 — Seed-drift root-cause fixes (tests only; product gate unchanged): dateKeys.test.ts backdates seed habits (created_at + rule_history via createHabitRule) to cover exercised dates; fixtures/seeders.ts backdates all seeded habits to one day before backfill start using the injected clock; planningRollups.test.ts captures freshDatabase() and backdates its habit. Sequential rerun of affected files: 21/21 PASS.
- 2026-08-22 — Focused Playwright (8 changed-surface specs, chromium, workers=1): 27 passed / 44 failed over 24m. ALL failures triaged to 4 root causes:
  1. TEST_DRIFT — `goToTab` strict-matched TWO buttons for Habits/Focus/Workout: the FirstRunOnboardingCard interest chips on Overview duplicate those tab labels exactly. FIXED product-side + helper-side: rail container gains `accessibilityLabel="Section tabs"` + `accessibilityRole="tablist"` (real a11y landmark win), goToTab scopes inside it. Covers habits.spec ×11, pomodoro ×4, workout.spec ×8, boundary habit tests ×3.
  2. TEST_DRIFT — `openNewTodoModal` clicked `.first()` 'Add task' which now resolves to the TodoQuickCapture submit (disabled while its input is empty; the run's call log proves `aria-disabled="true"` is emitted, but the click still must avoid the disabled twin, so final fix selects `.last()` — the FAB renders after all Screen content). Covers todos.spec ×7, portable-backup ×4, boundary todos ×4.
  3. TEST_DRIFT — habits helpers/boundary chain used visible text 'Add' per group, removed by the redesign; new contract is a11y label `Add {group} habit` on the dashed tile. Fixed in e2e/habits.spec.ts openAddHabitModal + boundary test-6 chain.
  4. TEST_DRIFT — Diary food names now render twice by design (entry row + Frequent re-log chip). Added product anchor `accessibilityLabel="Daily log"` on the diary day-log region; calories-day-navigation specs scope entry assertions through it.
     OPEN: boundary :231 'Big Routine' row never appeared after Add-routine click — cause unknown, needs empirical rerun after rebuild.
     Product changes in this batch are intentional contract clarifications (landmark labels), not behavior changes; typecheck PASS; dist/ rebuild in progress.
- 2026-08-22 — Live Supabase convergence EXECUTED — `supabase projects list` confirmed authorized CLI access; pre-apply `migration list --linked` snapshotted remote ending at 20260820010000 (.agent/hardening-evidence/live-migration-list-before.txt); all three pending migration files reviewed (strictly additive: CREATE TABLE weekly_reviews w/ owner RLS+policies+grants+indexes; nullable/defaulted v20 columns + workout_session_sets table w/ composite owner FK; daily_plans.top_todo_titles nullable); `supabase db push --linked` EXIT 0 applying all three in order; post-apply ledger shows all 12 applied (.agent/hardening-evidence/live-migration-list-after.txt). Object verification: PostgREST probes return 42501 permission-denied (hardened grants working, tables EXIST) for weekly_reviews/workout_session_sets/daily_plans/habits/pomodoro_sessions/workout_logs — a missing relation would be 42P01. Column-level verification rests on atomic per-file transaction success + supabase:schema:validate PASS + fixture parity. Row preservation provable by inspection: zero data-mutating statements in any of the three files. Advisors/security-linter require dashboard/docker tooling unavailable locally — recorded as ENVIRONMENT-limited sub-item; DDL-level mitigations (owner indexes, RLS, grant revokes) were designed in and validated by the schema validator.
- 2026-08-22 — Client remote contract now converged: BACKUP_ENTITY_COLUMNS.daily_plans includes top_todo_titles and production has the column; sync adapter projection will send it safely.
- 2026-08-22 — GitHub branch search — PASS — remote branch `main` only.
- 2026-08-22 — GitHub compare `3ee030c..main` — PASS — 19 commits; 82 files changed; mass UI/UX implementation confirmed.
- 2026-08-22 — Source inspection `core/db/client.ts` — PASS — migration 20 exists and migration 21 adds `daily_plans.top_todo_titles`; next free migration expected >=22.
- 2026-08-22 — Live Supabase migration-ledger query — FAIL/OPEN — latest live migration is `20260820010000_planning_schema_convergence`; expected later repository migrations are absent and must be converged before closure.

## Changed Files / Areas

At authoring: only `openspec/changes/harden-ui-ux-mass-implementation-wave-v1/**`.

Implementation scope may touch the UI wave surfaces plus tests, migrations, backup/portable/sync, notification/PWA, and shared infrastructure as required by root-cause fixes.

## Recovery / Resume Instructions

1. Fetch/prune and inspect Git state.
2. Read `AGENTS.md`, `.agent/PLANS.md`, all files in this change, all `docs/ui-ux/**`, and `openspec/changes/harden-parallel-completion-wave-v2/**`.
3. Run `npm run agent:plans` and reconcile discrepancies into this ExecPlan before proceeding.
4. Start from `Exact next action`.
5. Do not trust pre-wave test evidence as proof for current main.

## Outcomes & Retrospective

- Status: ACTIVE.
- Outcome: pending implementation.
- Completion requires full evidence in tasks/validation ledger plus exact-head green CI.
