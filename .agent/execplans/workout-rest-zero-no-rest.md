# ExecPlan: workout rest_seconds === 0 as intentional no-rest

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Resolve the dual meaning of `rest_seconds === 0` in Workouts so stored,
displayed, and executed rest agree: **0 means intentional zero rest (no rest /
skip rest)**. A user who sets Rest to 0 sees "no rest" in routine summaries,
edits with copy that says 0 = no rest, and runs back-to-back sets with no rest
timer phase. No hidden inherit-default coercion remains on the session path.

## Context

- Schema: `routine_exercise_sets.rest_seconds INTEGER NOT NULL DEFAULT 20`
  (`core/db/client.ts:204`). Type: `rest_seconds: number` (`core/db/types.ts`).
  No NULL exists, so Option B (NULL = inherit) would need migration 26 + backup/
  portable/supabase contract churn — rejected for this box-scoped commit.
- Write path: `addSet`/`updateSet` store raw values (`features/workout/
workout.data.ts`); `addDefaultSet` seeds new sets from `loadRestSecondsDefault()`
  (default 60, clamp 5–1800, `restTimerPreferences.ts` + `workout.data.ts:1788+`).
  Per-set values are authoritative at rest.
- Read/execute path (before fix): `WorkoutSessionScreen` builds
  `buildTimerSequence(applyRestDefault(exercises, restDefault ?? 0))`, where
  `applyRestDefault` (`workout.domain.ts:728`) maps `0 → default`. Stored 0 never
  runs as 0 once the preference loads.
- Display path (before fix): `summarizeExerciseSets` in `RoutineDetailScreen.tsx`
  and `RoutineExerciseCard.tsx` renders raw `0s`; stepper label is bare
  `"Rest (seconds)"` with `min={0}` — invites deliberate 0 while the session
  silently runs the default. Display-vs-run mismatch is the core inconsistency.
- Session skip logic already treats zero rests as back-to-back
  (`advanceFromCurrent` while-loop in `WorkoutSessionScreen.tsx:620+`), but it is
  unreachable post-load because of the coercion. Validation allows 0
  (`validateSetTiming`, `lib/validation.ts:129`), backup validators allow 0
  (`core/backup/backupValidators.ts:480`).
- Prior art: audit F3 flagged both meanings as coherent but unchosen; the repo
  since fixed seeding (`addDefaultSet` from preference) and session-local default
  editing, leaving `applyRestDefault` as a "legacy zero fallback" that contradicts
  the skip comment and the editor UI.

## Scope

- Domain: remove `applyRestDefault` coercion; `buildTimerSequence` omits rest
  phases for `rest_seconds <= 0`; JSDoc states 0 = no rest.
- Data: update `addDefaultSet` comment to the Option A contract; no schema change.
- UI session: build the timer sequence directly from stored per-set values (no
  `applyRestDefault`); repurpose the mid-session rest editor copy to
  "default for new sets" so it cannot mislead as affecting the live sequence;
  keep per-rest ±15s adjust and defensive zero-skip.
- UI builder: stepper labels say `0 = no rest`; collapsed summaries render
  `no rest` instead of `0s`/`0:00`.
- Tests: replace `applyRestDefault` contract tests with zero-rest omission +
  preservation tests; add `buildTimerSequence` zero-rest coverage.
- Validation ledger + single coherent commit. Node 22 verification.

## Non-Goals

- No migration (schema stays `NOT NULL DEFAULT 20`); no NULL-inherit model.
- No backup/portable/supabase contract changes (0 already valid everywhere).
- No Settings-screen rest editor; no E2E additions; no history quick-log badge
  (not needed — real rest-policy work exists and is box-executable).
- No push, tag, or EAS work. No PII.

## Current Checkpoint

- Current milestone: complete — Option A implemented, verified, ready to commit.
- Completed: path mapping; Option A decision; domain (removed `applyRestDefault`,
  `buildTimerSequence` omits `rest_seconds <= 0`); data comment; session screen
  (no coercion, "Default for new sets" + back-to-back hint); builder steppers
  ("0 = no rest") + "no rest" summaries; replaced `applyRestDefault` tests with
  zero-rest omission coverage; full verification green.
- In progress: none.
- Important modified files: `features/workout/workout.domain.ts`,
  `features/workout/workout.data.ts`, `features/workout/WorkoutSessionScreen.tsx`,
  `features/workout/RoutineDetailScreen.tsx`, `features/workout/RoutineExerciseCard.tsx`,
  `tests/workout.pr.test.ts`, `tests/workout.domain.test.ts`, this plan.
- Last successful validation: `npm test` 215 files / 2182 tests PASS; `npm run
typecheck` PASS; `npm run lint` PASS; targeted rest suites 65/65 PASS;
  `agent:plan:validate` PASS (2026-09-20, Node v22.23.2).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: none (single commit to follow in the same change).

## Progress

- [x] Map all rest_seconds read/write/inherit/UI paths.
- [x] Decide Option A (0 = intentional no rest) with rationale.
- [x] Write ExecPlan (this file).
- [x] Domain: 0 = no rest, omit zero rest phases.
- [x] Data: comment contract update.
- [x] UI: session + builder copy/summary consistency.
- [x] Tests: replace/extend rest contract tests.
- [x] Verify: typecheck, lint, vitest, plan validate.
- [x] Single commit.

## Surprises & Discoveries

- `advanceFromCurrent` already documents zero rest as intentional back-to-back,
  directly contradicting `applyRestDefault`'s inherit semantic — the codebase
  implements neither option consistently, so filler-work escape does not apply.
- `addDefaultSet` seeding + session-local default editing already landed, so
  removing the legacy fallback is safe: new sets carry the preference explicitly
  and manual zeros read as deliberate no-rest.

## Decision Log

- 2026-09-20 — Choose Option A (0 = intentional zero rest, clear "no rest" copy)
  over Option B (NULL = inherit). Why: schema is NOT NULL with no tri-state UI;
  B needs migration 26 + cross-contract churn beyond one-commit cap, while A
  matches the seeded-at-create direction, existing skip logic, stepper min 0,
  and validation/backup acceptance of 0. Rejected B explicitly for scope, not merit.

## Validation Ledger

- 2026-09-20 — `node --version` — PASS — `v22.23.2`.
- 2026-09-20 — `git status --short` / `git log --oneline -5` — PASS — clean tree,
  head `7b3251e`.
- 2026-09-20 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-20 — `npx vitest run tests/workout.pr.test.ts tests/workout.domain.test.ts` —
  PASS — 2 files, 65 tests passed.
- 2026-09-20 — `npm run lint` — PASS — 0 errors, 0 warnings.
- 2026-09-20 — `npm test` — PASS — 215 files, 2182 tests, 0 failures.
- 2026-09-20 — `npm run agent:plan:validate -- --plan
.agent/execplans/workout-rest-zero-no-rest.md` — PASS — Status COMPLETED.

## Changed Files / Areas

- `features/workout/workout.domain.ts` — rest policy + timer sequence.
- `features/workout/workout.data.ts` — contract comment.
- `features/workout/WorkoutSessionScreen.tsx` — remove coercion, copy fix.
- `features/workout/RoutineDetailScreen.tsx` — stepper + summary copy.
- `features/workout/RoutineExerciseCard.tsx` — stepper + summary copy.
- `tests/workout.pr.test.ts`, `tests/workout.domain.test.ts` — contract tests.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`.
3. Reconcile checkpoint with working tree; continue from Exact next action.
4. Run `npm run qa:affected` when applicable; then cheapest sufficient gates
   (`typecheck`, `lint`, targeted Vitest) before broad `npm test`.
5. Run `npm run agent:plan:validate -- --plan .agent/execplans/workout-rest-zero-no-rest.md`
   before completion.

## Outcomes & Retrospective

- Status: Completed.
- Summary: `rest_seconds === 0` is now intentional no-rest end to end — timer
  omits the rest phase, builders label `0 = no rest` and summarize `no rest`,
  the session preference only seeds future sets, and tests pin omission +
  explicit-rest preservation. Verified: typecheck/lint clean, 2182 Vitest tests
  green on Node 22.
- Follow-up: none. A NULL-inherit model (Option B) remains a possible future
  direction but needs migration 26 + contract churn; not pursued here.
