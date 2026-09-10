# ExecPlan: Repository Completion & Truth V1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close the remaining evidence-backed gaps found by a fresh audit at `c65b96a`, so the
repository's shipped behavior, proofs, and documentation all tell the same true story:

- Legacy Pomodoro session notes/associations become durable and backup-recoverable
  (the implemented migration actually runs at bootstrap).
- Users can delete an erroneous saved daily plan from plan history.
- Correctness-sensitive duplicate/dead APIs are consolidated to one implementation.
- Mature write surfaces stop certifying through UI text alone; audited gaps gain
  real-SQL or E2E data oracles.
- Current-facing docs match code reality.
- The final tree passes the full regression ladder and is pushed with CI evidence.

## Context

- Baseline: `HEAD == origin/main == c65b96ac407d5bc74f9011997e6a58463878ff7f`, tree clean,
  campaign `Super Habits Functional Completion V1` COMPLETED; no ACTIVE planner prompt.
- User directive: skip the planner handoff; choose the work autonomously and drive it to
  completion. Repository rules still apply (durable ExecPlan, OpenSpec change, append-only
  migrations, soft delete, durable outbox, no test weakening, evidence-led completion).
- Environment: portable Node 22.23.2 at `%LOCALAPPDATA%\tools\node-v22.23.2-win-x64`
  (repo engines pin `<23`); `better-sqlite3` loads under both host and pinned runtimes.
  Windows CRLF: run `npx prettier --write` on edited files before the lint gate.
- Campaign driver artifacts: `openspec/changes/complete-repository-depth-v1/`.

## Scope

Waves 1–6 of `openspec/changes/complete-repository-depth-v1/tasks.md`:

1. Durability wiring + consolidations.
2. Daily-plan deletion (spec-backed).
3. Test floor (integration + E2E + unit).
4. Documentation truth.
5. Bounded dead-code removal (zero-reference, zero-test only).
6. Regression ladder, ExecPlan close, commit/push/CI.

## Non-Goals

No new product features beyond already-implemented capability activation; no schema
migrations; no two-way sync; no external Supabase/iOS lanes; no reopening completed
campaigns; no test weakening; no broad refactors beyond the named consolidations.

## Current Checkpoint

- Current milestone: Wave 6 regression ladder — deterministic simulation, web verify,
  and native lanes remain; then close/push/CI.
- Completed:
  - Wave 0 — baseline reconciliation, audits, Node 22 runtime, shebang fix, campaign
    artifacts (commit `8d05e03`).
  - Wave 1 — bootstrap runs `migrateLegacySessionMeta`; real-SQL integration 3/3;
    `cancelTodoReminderSafely` consolidated; `WEEKLY_REVIEW_REMINDER_DATA_VERSION` used;
    dead `getBackfillStatus` removed; precedence guard adopted (Calories, Overview layout,
    motion) with motion contract tests 4/4 (commit `939ff38`).
  - Wave 2 — daily-plan deletion: confirmed danger delete in `DailyPlanHistoryView`
    (reusing `softDeleteDailyPlan` + `useConfirmationDialog`), parent editor refresh via
    `onPlanDeleted`; integration `dailyPlanDeletion.test.ts` 2/2; E2E journey in
    `planning-hub.spec.ts` (cancel + confirm + tombstone/intent oracles) passed in the
    focused batch.
  - Wave 3 — new real-SQL suites: `todoBulk.data.test.ts` 3/3, `planningDetails.data.test.ts`
    5/5, `workoutQueries.data.test.ts` 4/4, `pomodoroActiveTimer.data.test.ts` 2/2,
    `habitLifecycleRules.data.test.ts` 2/2, plus Wave 1/2 suites; E2E data oracles added to
    `todos.spec.ts`, `calories.spec.ts`, `settings.spec.ts`, `workout-gym-v2.spec.ts`; new
    `overview.spec.ts` (Next Best Action + customize persistence). Focused batch: 30
    passed / 2 failed → both fixed (calorie goal JSON is an object; the hero needs a
    due-today/overdue task, now seeded via SQL) → both pass on re-run.
  - Wave 4 — docs truth: AGENTS.md, README.md, `docs/PROJECT_STRUCTURE_MAP.md`,
    `docs/knowledge-base/PROJECT_STRUCTURE_MAP.md`, `docs/testing/known-gaps.md`,
    `docs/ui-ux/README.md`, `docs/master-context.md`, and the active agent rule/skill copies
    under `.cursor/` and `.agents/` corrected to code reality.
  - Wave 5 — zero-reference, zero-test removals: `core/ui/{Badge,ProgressBar,SectionTitle}.tsx`,
    `features/weekly-review/index.ts`, `buildMomentumReadModel`, `getMomentumGrowthSources`,
    `filterTimeline`, `getStreakLabel`, `buildGridDateHeaders`, `FOCUS_SECONDS`,
    `isDraftReady`, `isHabitReminderResponse`, `sameOwnerIds`, `getSupabaseAuthUser`,
    `getPendingManifestForDiagnostics`, `getBackupDirtyFlag`, `clearWeeklyPlanEntry`,
    `listScheduleOverrides`, `getOrCreateDailyPlan`, `isDailyPlanStatus`,
    `countCompletedTodos` (and its stale test mock key).
- In progress: web `build:web`/`web:verify`/`web:hygiene`; then the native smoke/persistence
  lane on the canonical `Nitro_API_36` AVD (current APK provenance is stale at
  `d7935a0`, so auto-provision will rebuild from the final tree).
- Git reconciliation (2026-09-11): tree clean; `HEAD == 65641af`, `origin/main == c65b96a`;
  four local commits are ahead and unpushed (`8d05e03`, `939ff38`, `4723df5`, `65641af`).
  Push happens at task 6.4 after the remaining ladder and CI verification.
- Important modified files: see Changed Files below.
- Last successful validation: fast gates PASS 2026-09-11 (typecheck/lint 0, label parity,
  OpenSpec 52/52, themes 140, schema contract, impact map 13); deterministic simulation
  23/23 PASS 2026-09-11; full `npm run e2e` battery 243 passed / 13 skipped / 1 failed
  (flake, known-gap 16); full Vitest 2001 passed / 1 skipped (193 files); focused
  chromium batch 32/32; static validators green.
- Current failures: None open. The full-battery habits rule-history failure passed
  standalone on the identical tree → classified FLAKY_TEST (host-load commit race,
  known-gap 16, assertions unchanged).
- Relevant quarantines: known-gap 15 (J8 headroom floor under battery load) unchanged.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: run `npm run qa:simulation` (deterministic lane), then
  `web:verify`/`web:hygiene`, and the native smoke/persistence lane on the canonical
  `Nitro_API_36` AVD; then close the plan, commit, push, and verify CI.
- Remaining definition of done: tasks 6.2–6.4 (simulation + web + native lanes, native
  evidence or honest ENVIRONMENT classification, plan COMPLETED + validated,
  commit/push/CI).

## Progress

- [x] Wave 0 — baseline reconciliation, audits, Node 22 runtime, shebang fix (2026-09-10)
- [x] Wave 1 — durability wiring + consolidations (2026-09-10)
- [x] Wave 2 — daily plan deletion (2026-09-10)
- [x] Wave 3 — test floor (2026-09-10)
- [x] Wave 4 — documentation truth (2026-09-10)
- [x] Wave 5 — bounded dead-code removal (2026-09-10)
- [ ] Wave 6 — regression ladder + delivery

## Surprises & Discoveries

- **P1 product bug found by the new test floor:** `bulkRemoveTodos` tombstoned rows locally
  without enqueueing the `todos` delete intent, so the remote copy (and any restore) would
  resurrect bulk-deleted todos. Fixed by enqueueing one delete intent per removed row
  inside the same transaction; the new integration test is the regression proof.
- `qa:fast` failed at HEAD on Windows because Vitest cannot transform an imported `.mjs`
  that starts with a shebang (CRLF working copy); removing the shebang is the fix.
- Host default Node 24.3.0 violates the engines pin; portable 22.23.2 is used for gates.
- The Overview Next Best Action intentionally stays hidden for plain pending todos; it
  needs an overdue/due-today task (or another ranked signal) — the E2E now seeds one.
- The calorie goal is stored as a JSON object (`{ calories, protein, carbs, fats }`), not a
  scalar; the E2E oracle asserts the object shape.

## Decision Log

- 2026-09-10 — Skip the planner handoff per explicit user directive; author the campaign
  artifacts (OpenSpec change + ExecPlan) directly and execute them.
- 2026-09-10 — Remove the shebang from `scripts/journey-label-parity.mjs` rather than
  weakening the test import or skipping the suite; the script is only ever run via `node`.
- 2026-09-10 — Run the legacy session-metadata promotion at bootstrap (not screen-scoped).
- 2026-09-10 — Delete dead `getBackfillStatus`; keep the live `backupRestore` helper.
- 2026-09-10 — Adopt the precedence guard only where an ad-hoc equivalent or demonstrable
  race exists (Calories view mode, Overview card layout, motion singleton).
- 2026-09-10 — Daily-plan deletion reuses `softDeleteDailyPlan` + `useConfirmationDialog`.
- 2026-09-10 — Dead-code scope is zero-reference AND zero-test only; test-covered dead
  APIs stay (no test weakening), recorded in tasks 5.2. Deliberately retained families:
  redundant lifecycle wrappers (`setTodoCompletionState`, `setGoalStatus`, `setProjectStatus`,
  `commitDailyPlan`, `completeDailyPlan`, `listPomodoroSessions`, `listWorkoutLogs`), the
  legacy Linked Actions CRUD/policy surface (19+ tests), and pure domain helpers whose
  tests encode contracted semantics (pomodoro state/parse, PR classification, macro donut,
  overview CTA/visibility, momentum sources, timeline filters). They are unused in
  production but removing them would delete their contracts without a product change.
- 2026-09-10 — E2E oracle fixes: seed due-today data via `runSql` for the hero; assert the
  calorie-goal object shape.

## Validation Ledger

- 2026-09-10 — shebang fix + label parity — PASS — unit 3/3, script green.
- 2026-09-10 — Wave 1 focused suite — PASS — eslint 0; unit 53/53; integration 3/3.
- 2026-09-10 — `pomodoroSessionMetaMigration` — PASS — 3/3 real SQLite.
- 2026-09-10 — `dailyPlanDeletion` — PASS — 2/2 real SQLite.
- 2026-09-10 — `todoBulk` / `planningDetails` / `workoutQueries` / `pomodoroActiveTimer` /
  `habitLifecycleRules` — PASS — 3/3, 5/5, 4/4, 2/2, 2/2.
- 2026-09-10 — Focused chromium batch (planning-hub, todos, calories, settings, overview,
  workout-gym-v2) — 30 passed / 2 failed → fixes → the 2 fixed tests PASS individually.
- 2026-09-10 — `openspec validate` — PASS — 52/52 (includes the new change).
- 2026-09-10 — `agent:plan:validate` — PASS — this plan valid ACTIVE.
- 2026-09-11 — `npm run openspec:validate` / `validate:themes` /
  `supabase:schema:validate` / `qa:impact:validate` — PASS — 52/52, 140 checks, schema
  contract, 13 rules (final tree `65641af` + plan edit).
- 2026-09-11 — `npm run typecheck` + `npm run lint` + `node scripts/journey-label-parity.mjs`
  — PASS — 0/0 + rail parity OK.
- 2026-09-11 — `npm run qa:simulation -- --all` — PASS — 23/23 deterministic scenarios
  (fresh `build:web`, owned :8081 server, `sim:validate` clean).
- 2026-09-10 — full `npx vitest run` — PASS — 2001 passed / 1 skipped (193 files, both projects).
- 2026-09-10 — `npm run openspec:validate` / `validate:themes` / `supabase:schema:validate` /
  `qa:impact:validate` — PASS — 52/52, 140 checks, schema contract, 13 rules.
- 2026-09-10 — `npx eslint . --max-warnings 0` + `npx tsc --noEmit` — PASS — 0/0.
- 2026-09-10 — focused chromium batch (6 specs) — PASS — 32/32.
- 2026-09-10 — full `npm run e2e` — 243 passed / 13 skipped / 1 failed — the failure
  (`habits.spec.ts` rule-history oracle) passed standalone (6.0 s) on the identical tree;
  classified FLAKY_TEST and registered as known-gap 16 (assertions unchanged).

## Changed Files / Areas

- `scripts/journey-label-parity.mjs` — shebang removed.
- `openspec/changes/complete-repository-depth-v1/` — proposal, design, tasks, 2 specs.
- `.agent/execplans/repository-completion-and-truth-v1.md` — this plan.
- Wave 1: `core/providers/AppProviders.tsx`, `features/todos/todos.data.ts`,
  `core/notifications/weeklyReviewReminderScheduler.ts`, `core/backup/backupBackfill.ts`,
  `features/calories/CaloriesScreen.tsx`, `features/overview/OverviewScreen.tsx`,
  `core/theme/motion.ts`, `tests/integration/pomodoroSessionMetaMigration.test.ts`,
  `tests/motionPreference.test.ts`.
- Wave 2: `features/daily-plan/DailyPlanHistoryView.tsx`, `features/daily-plan/DailyPlanView.tsx`,
  `tests/integration/dailyPlanDeletion.test.ts`, `e2e/planning-hub.spec.ts`.
- Wave 3: `tests/integration/{todoBulk,planningDetails,workoutQueries,pomodoroActiveTimer,habitLifecycleRules}.data.test.ts`
  (note: `pomodoroActiveTimer` and `habitLifecycleRules` use `.data.` naming), `e2e/{todos,calories,settings,workout-gym-v2}.spec.ts`,
  `e2e/overview.spec.ts`.
- Wave 4: `AGENTS.md`, `README.md`, `docs/PROJECT_STRUCTURE_MAP.md`,
  `docs/knowledge-base/PROJECT_STRUCTURE_MAP.md`, `docs/testing/known-gaps.md`,
  `docs/ui-ux/README.md`, `docs/master-context.md`, `.cursor/rules/superhabits-rules.mdc`,
  `.cursor/agents/feature-agent.md`, `.agents/agents/feature-agent.md`,
  `.cursor/skills/rn-expo-conventions/SKILL.md`, `.agents/skills/rn-expo-conventions/SKILL.md`,
  `.cursor/skills/db-and-sync-invariants/SKILL.md`, `.agents/skills/db-and-sync-invariants/SKILL.md`,
  `playwright.config.ts`, `e2e/README.md`.
- Wave 5: deleted `core/ui/{Badge,ProgressBar,SectionTitle}.tsx`, `features/weekly-review/index.ts`;
  trimmed exports in `features/momentum/momentum.{data,domain}.ts`,
  `features/activity/activityTimeline.domain.ts`, `features/habits/habits.domain.ts`,
  `features/pomodoro/pomodoro.domain.ts`, `features/command/command.domain.ts`,
  `core/notifications/notificationResponseDispatcher.ts`, `core/auth/account.domain.ts`,
  `lib/supabase.ts`, `core/sync/supabase.adapter.ts`, `features/workout/workout.data.ts`,
  `features/daily-plan/dailyPlan.{data,domain}.ts`, `features/todos/todos.data.ts`,
  `tests/ask.retrieval.test.ts`.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, then this plan fully.
2. Read `openspec/changes/complete-repository-depth-v1/` artifacts.
3. `git status --short`, `git log --oneline -8`; reconcile with the checkpoint (Git wins).
4. Run `npm run agent:resume -- --plan .agent/execplans/repository-completion-and-truth-v1.md`.
5. Use Node 22.23.2 for all gates:
   `$env:PATH = "$env:LOCALAPPDATA\tools\node-v22.23.2-win-x64;" + $env:PATH`.
6. After any edit batch, run `npx prettier --write` on changed files before the lint gate.
7. Continue from `Exact next action`; checkpoint this plan at every milestone/failure.

## Outcomes & Retrospective

- Status: Active.
- Summary: Waves 0–5 landed; a P1 bulk-delete sync gap was found and fixed; durability
  promotion, daily-plan deletion, test floor, docs truth, and bounded cleanup complete.
- Follow-up: focused re-verification then the full regression ladder and delivery.
