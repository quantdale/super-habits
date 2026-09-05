# ExecPlan: Functional Completion V1 (master orchestration)

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close Super Habits' product-depth gaps: users must be able to correct, edit, and manage their own data across Todos (recurring series), Calories (day correction), Workout (routines/custom exercises/logs), and Pomodoro (presets/session metadata); the shipped Weekly Review loop must be reachable from the normal in-app flow; the Linked Actions policy must honestly describe the shipped engine; and Planning-surface persistence must be proven with real-SQL/data-oracle tests.

Success = every shipped correction flow has an explicit contract, an implementation in existing surfaces, and oracle-grade tests, with zero regressions against the certified persistence baseline.

## Context

- Campaign driver: `.agent/EXECUTION_PROMPT.md` (Functional Completion V1, ACTIVE, Planned-From `76f79d9`). Waves 0–10 are defined there; this plan is the master orchestration record. Workstream ExecPlans are opened as waves start (Wave 1).
- Certified foundation to reuse, not rebuild: migrations (`core/db/client.ts`, current schema version 24, append-only), `runSyncedMutation`/`runBackupMutation` + durable outbox, restore invariants (`core/backup/`), account ownership (`core/auth/`), `qa:repeat`, multi-AVD native automation, MATURE corpus seeders, `web:verify`/`web:hygiene`.
- Product disposition (authoritative): `docs/ui-ux/2026-09-01-feature-disposition-ledger.md` line 28 — Weekly Review: keep modal; expose from Plan/Progress, not Today.
- Invariants: soft-delete only (documented exceptions), no `getDatabase` outside data layers, `createId`/`toDateKey`, single-page shell, six sections, one global Add, no seventh tab, no second Gym state, no AI/Ask flag changes.

## Scope

Waves 1–10 of `.agent/EXECUTION_PROMPT.md`: OpenSpec correction contracts; Todos recurring-series management; Calories `consumedOn` correction; Workout routine/exercise/log correction; Pomodoro preset authoring + post-hoc session meta; Weekly Review in-app entry + `deleteWeeklyReview` disposition; Linked Actions policy reconciliation; Planning Hub / Weekly Review E2E + real-SQL test floor; regression ladder; adversarial verification; docs truth.

## Non-Goals

No Production Hardening V3 / Certification V3, no two-way sync, no persistence rewrite, no new top-level section, no cycle-elimination campaign, no `workout.data.ts` split, no migration-block edits, no weakened tests, no AI flag changes.

## Current Checkpoint

- Current milestone: Wave 5 COMPLETE (Pomodoro correction depth) → Wave 6 (Weekly Review surfacing + Linked Actions policy) starting.
- Completed:
  - Wave 0 — truth/hygiene/gates/E1–E6 (all CONFIRMED; commit `3e05490`).
  - Wave 1 — OpenSpec change `complete-product-correction-flows-v1` (design D1–D6, 6 specs, tasks; openspec 51/51; commit `62356b5`).
  - Wave 2 — Todos recurring-series correction (data+UI+6 unit+3 integration+E2E; todos 9/9; P0 25/25; commit `0065ae9`).
  - Wave 3 — Calories day correction (integration 3; E2E day-navigation 5/5; commit `de9632e`).
  - Wave 4 — Workout correction: `deleteWorkoutLog` (hard-delete cascade per the `saved_meals` exception — the three log tables have no `deleted_at`; one durable delete intent per removed row, verified) wired to a confirmed “Delete session” action in Session detail; `updateRoutine` activated via Rename routine (top of builder; history keeps snapshot names — proven); new `CustomExerciseManagerModal` (edit/archive/restore + archived list) wired to `updateCustomExercise`/`archiveCustomExercise`/new `restoreCustomExercise`; design.md D3 amended (hard-delete rationale). E2E strengthened the vacuous “completes a workout” (real workout_logs oracle) + 3 new journeys (rename, accidental-log delete, manager). Fixed a weekend-dependent strict-mode flake in gym-v2 reschedules by scoping to the schedule panel (selector fix, assertion kept).
  - Wave 5 — Pomodoro correction depth (no migration; metadata-only per design D4): new `PomodoroPresetManagerModal` (create/edit/delete custom presets through `savePomodoroPresets` onto the app_meta recoverable-settings path; built-ins protected with delete/edit refused) opened from a “Manage presets” action on the Presets card; `RecentSessionsList` rows became pressable (optional `onEdit`) opening new `SessionMetaEditModal`, which edits the note and relinks/unlinks the task-link through the existing `setPomodoroSessionMeta` contract (undefined=keep, null=clear; single coalesced update intent verified; missing row and empty edit are no-ops). Integration `pomodoroCorrection.test.ts` 3/3 (incl. `user_backup_settings` intent); E2E +2 journeys (preset authoring with app_meta oracle + reload persistence; seeded session corrected to note+link with row and single-intent oracles) — pomodoro spec 6/6, momentum-garden 4/4 unaffected.
- In progress: none.
- Important modified files: `features/pomodoro/PomodoroPresetManager.tsx` (new), `SessionMetaEditModal.tsx` (new), `PomodoroScreen.tsx`, `RecentSessionsList.tsx`, `tests/integration/pomodoroCorrection.test.ts` (new), `e2e/pomodoro.spec.ts`, `openspec/.../tasks.md` (4.1–4.3 checked).
- Last successful validation: typecheck 0; lint 0; full Vitest 1956/1956 (180 files); pomodoro E2E 6/6 + momentum-garden 4/4 (2026-09-05).
- Current failures: None. Two TEST_BUGs fixed in-flight (kcal-recompute assertion; weekend 'Rest day' strict-mode collision).
- Relevant quarantines: None.
- Blockers: None (externals unchanged).
- Exact next action: Wave 6 — surface Weekly Review from Plan/Progress (disposition line 28: keep modal), disposition `deleteWeeklyReview`, and reconcile the Linked Actions policy with the engine (audit the runtime gate that skips `pomodoro.log`/`calorie.log` before choosing authorable vs honest deferral).
- Remaining definition of done: terminal condition A of `.agent/EXECUTION_PROMPT.md` §9.

## Progress

- [x] Wave 0 — Re-baseline: Git/plan truth, hygiene, qa:fast, E1–E6 re-verification (all CONFIRMED) — 2026-09-05
- [x] Wave 1 — OpenSpec contracts + design decisions D1–D6 (commit `62356b5`, openspec 51/51)
- [x] Wave 2 — Todos recurring-series correction (unit 6 + integration 3 + E2E; full Vitest 1946/1946; todos spec 9/9; P0 25/25)
- [x] Wave 3 — Calories day-correction (integration 3 + E2E 5/5 day-navigation; unit 22/22)
- [x] Wave 4 — Workout correction (integration 4; E2E workout 12/12 incl. rename/delete/manager; gym-v2 flake scoped; full Vitest 1953/1953)
- [x] Wave 5 — Pomodoro correction depth (integration 3; E2E pomodoro 6/6 incl. preset authoring + session correction; full Vitest 1956/1956)
- [ ] Wave 6 — Weekly Review surfacing + Linked Actions policy
- [ ] Wave 7 — Planning-surface test floor
- [ ] Wave 8 — Regression ladder
- [ ] Wave 9 — Adversarial verification

## Surprises & Discoveries

- Engine runtime skips `pomodoro.log`/`calorie.log` legacy rules ("unsupported") despite implemented effects — policy likely gates execution too (`linkedActions.engine` + policy resolution). Wave 6 must audit the gate path before choosing A (authorable) vs B (honest deferral).
- `web:hygiene` and the whole `qa:fast` chain work cleanly on this Windows host; native lanes use existing `scripts/qa-native*.mjs`.
- E2E (web): nested `core/ui/Modal` stacks (routine builder + exercise picker) can transiently misroute clicks after the inner dialog closes — a close/re-layout race causes tests to hang for the full timeout (~50% flake). Deterministic pattern: don't click builder controls immediately after closing the nested picker; seed at the DB layer (`queryRows`) or re-open the dialog first. Also: `returnToApp` lands on Overview — always `goToTab` again after `queryRows`/`returnToApp`; wait for a UI signal (e.g. session card) before `queryRows` so the harness connection never races the write transaction.
- Durable outbox coalesces intents per (entity, id) — `sync_outbox` holds one row with the latest operation; assert that shape in tests.
- The three completed-log tables (`workout_logs`, `workout_session_exercises`, `workout_session_sets`) have no `deleted_at`; corrections there must follow the hard-delete + per-row delete-intent exception (design D3 amendment).

## Decision Log

- 2026-09-05 — Master orchestration plan + per-wave workstream plans (proven shape from prior campaigns) — single source for campaign checkpoint; workstream plans own implementation detail.
- 2026-09-05 — Wave 4: accidental completed-session delete uses the saved_meals hard-delete exception + durable per-row delete intents instead of soft delete (no `deleted_at` columns exist; remote-schema mirroring out of scope) — user-visible contract unchanged (design D3 amendment records the evidence).

## Validation Ledger

- 2026-09-05 — `npm run agent:plans` — PASS — 48/48 COMPLETED predecessors.
- 2026-09-05 — `npm run web:hygiene` — PASS — 8081/8082 free.
- 2026-09-05 — `npm run qa:fast` — PASS — typecheck 0, lint 0, Vitest unit 1691/1691 (128 files), label parity OK.

## Changed Files / Areas

- `.agent/execplans/functional-completion-v1.md` — this master plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`.
2. Read `.agent/EXECUTION_PROMPT.md` fully (authoritative waves + invariants).
3. Read this plan completely, then any ACTIVE workstream ExecPlan it lists.
4. `git status --short`; `git diff --stat`; `git log --oneline -10`; reconcile checkpoint with Git (Git wins).
5. `npm run agent:resume -- --plan .agent/execplans/functional-completion-v1.md`.
6. `npm run qa:affected` for changed files; run resolved gates.
7. Continue from `Exact next action`; update this plan before finishing any session.

## Outcomes & Retrospective

- Status: Active (Wave 0 complete).
