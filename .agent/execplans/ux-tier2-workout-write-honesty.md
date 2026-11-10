# ExecPlan: Workout write-failure honesty (Tier-2 silent-no-op UI writes, part 4)

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Every user-initiated Workout write must be honest when SQLite rejects it: the
failure is visible on the surface the user acted from, the screen keeps the
pre-tap state instead of implying success, and a retry after the underlying
problem clears commits exactly once. The success path — including set-log
durability/ordering and gamification XP accounting — is unchanged.

## Context

- Branch `ux/tier2-workout`, from `main` at `c084c794` (the merged Tier-2
  todo/habit/pomodoro write-failure work, PR #206). One of up to six parallel
  sessions; this session owns `features/workout/*`,
  `e2e/workout-write-failure.spec.ts`, and `tests/*.test.ts` for real logic.
- The established contract (mirrored from `e2e/todos-write-failure.spec.ts`,
  `e2e/habits-write-failure.spec.ts`, `e2e/pomodoro-write-failure.spec.ts`):
  inject a real `RAISE(ABORT)` trigger through `e2e/helpers/dbHarness.ts`, then
  assert (a) a visible `role=alert`, (b) unchanged UI + durable rows + no
  outbox intent, (c) one-shot success on retry.
- `e2e/helpers/failure.ts` injects at the REMOTE (`*.supabase.co`) boundary
  only, so it cannot fail a local OPFS write; the hermetic `dist/` export
  bundles no Supabase host. Local SQLite trigger injection is the only honest
  instrument for this defect class.
- Tier-1 (`6b23b6ea`) already closed the workout builder queue, add/rename/
  move/delete-exercise handlers, and the session save path. Those were expected
  to be already honest; the audit confirmed it.
- Harness rule: entering the DB document destroys the app page's React state,
  so triggers are installed before a surface opens and row reads happen at
  interaction boundaries only.

## Scope

- Audit every user-initiated write handler in `features/workout`.
- Verify each candidate is really silent on current code with a throwaway probe
  spec BEFORE changing anything.
- Fix only the genuinely silent sites, in the repo's existing pattern
  (`core/ui/ValidationError`, `accessibilityRole="alert"`).
- Deliver one `e2e/workout-write-failure.spec.ts` covering every fixed site with
  the (a)/(b)/(c) contract.

## Non-Goals

- No data-model, migration, schema, or sync-adapter change.
- No change to the success path, set-log durability/ordering, session save
  ordering, or gamification/XP accounting.
- No new dependency; no golden PNG created, updated, or committed; no
  screenshot on the success path may change (new UI renders only on failure).
- No edit outside this session's file split (`core/ui/*`, `core/theme/*`,
  other features, existing workout specs are read-only).

## Current Checkpoint

- Current milestone: implementation and verification complete; changes are left
  uncommitted for the parent to review, commit, push, and open the draft PR.
- Completed: repo guidance read; all workout write handlers audited; probe spec
  run before and after fixes (12/12 silent before, all handled after); eight
  handlers fixed across four files; one shared copy helper plus its unit test
  added; the new spec written and green; every regression lane and the visual
  comparison re-run green.
- In progress: nothing.
- Important modified files: `features/workout/WorkoutScreen.tsx`,
  `features/workout/RoutineDetailScreen.tsx`,
  `features/workout/CustomExerciseManager.tsx`,
  `features/workout/WorkoutHistoryDetail.tsx`,
  `features/workout/workoutWriteFailure.ts` (new),
  `e2e/workout-write-failure.spec.ts` (new),
  `tests/workoutWriteFailure.test.ts` (new).
- Last successful validation: `npx tsc --noEmit` 0 errors; `npx eslint` 0
  errors/0 warnings on every touched file; `npx prettier --check` clean; `npx
vitest run` 85 tests passed across the five workout suites; `E2E_PORT=8104
npx playwright test --project=chromium e2e/workout-write-failure.spec.ts` 13
  passed; the workout regression lane 29 passed; the W9/W9.5 + audit lane 22
  passed with 6 skipped; the visual `workout landing (phone, light)` comparison
  1 passed with the golden unchanged.
- Current failures: none.
- Quarantines: none — no test deleted, skipped, weakened, or blindly retried.
- Blockers: none.
- Exact next action: none — the task is complete; parent review owns the next
  step.
- Remaining definition of done: none — every requirement in scope is
  implemented, verified, and recorded above.

## Progress

- [x] Read `AGENTS.md`, the WINDOWS-FIRST successor report §10 (row "Tier-2
      silent-no-op UI writes"), `e2e/helpers/failure.ts`, and the three merged
      write-failure specs; read the merged Tier-1/Tier-2 commits (`6b23b6ea`,
      `c084c794`).
- [x] Read every workout write path in `workout.data.ts` and its UI callers and
      built the candidate matrix.
- [x] Built the hermetic export (`npm run build:e2e`, lock + memory gate).
- [x] Wrote a throwaway probe spec asserting `role=alert` on the owning surface
      for 12 candidates and ran it on unmodified code: all 12 failed, i.e. every
      candidate was genuinely silent.
- [x] Fixed the silent sites, re-ran the probe until each rendered its alert on
      the correct surface, then deleted the probe.
- [x] Wrote the permanent spec with the (a)/(b)/(c) contract per site and
      corrected only assertion shape (decorative glyph vs. sentence, `AS n`
      column name, harness state destruction ordering, atomic-move semantics).
- [x] Ran the regression lanes, the visual comparison, typecheck, lint, format,
      and the focused vitest suites.

## Surprises & Discoveries

- **"Already surfaced" was mostly false for this feature.** Several handlers
  did catch, but rendered the message on the _landing form_ while a modal or
  sheet was the only interactive surface — visually behind the scrim, so to the
  user it was silence. The day sheet, "Move workout", and the library picker
  all had this shape. The fix is not "add a catch" but "report on the surface
  the user is looking at", which is why each of those now owns its own error
  slot.
- `RoutineDetailScreen` already declared "No error surface in this modal
  (matches the silent empty guard)" in the custom-exercise manager; the manager
  is a separate dialog, so its rejection was unreachable from the builder. The
  manager now owns its alert.
- `ValidationError` renders a decorative MaterialIcons glyph inside the
  `role=alert` node, so whole-node `toHaveText` matching fails while the
  sentence is correct. Assertions use `toContainText` on the scoped node.
- The move-workout flow is a single transaction (Tier-1 `6b23b6ea`), so after a
  rejected destination leg the SOURCE override row is still the original
  workout — a useful, stronger assertion than "no rows exist".
- The body-weight delete's alert must render inside the History & insights
  disclosure (above the cards that own the rows), not on the landing form and
  not at the top of the page.

## Decision Log

- **Report on the acting surface, not the page.** Every fixed site owns a
  dedicated error state colocated with its control; the shared landing
  `workoutError` remains for the New routine form only.
- **One copy helper (`workoutWriteFailure.ts`).** Storage-classified failures
  (`core/storage/storageSafety`) keep their actionable, data-safe copy;
  everything else gets the site's own fixed sentence. Engine text such as
  "Error finalizing statement" or a `RAISE(ABORT)` message is never shown, and
  one sentence per site keeps the honesty contract assertable.
- **No error on the success path.** Each new `ValidationError` renders only
  when its state is non-null, so no success-path screenshot can change (proved
  by the unchanged `workout-landing-390-light` golden comparison).
- **Never hide a durable record.** The two discard handlers now keep the
  pending-save/draft React state when the delete is rejected — dropping it
  would display "no workout" while a remount resurrects it.
- **Left the already-honest sites alone** (documented per-site in the report)
  rather than routing them through the new helper, to keep the diff minimal and
  the success path untouched.

## Validation Ledger

| Gate                  | Command                                                                                                                           | Result                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Typecheck             | `npx tsc --noEmit`                                                                                                                | 0 errors                    |
| Lint                  | `npx eslint features/workout e2e/workout-write-failure.spec.ts tests/workoutWriteFailure.test.ts --max-warnings 0`                | 0 errors, 0 warnings        |
| Format                | `npx prettier --check` on touched files                                                                                           | clean                       |
| Unit + integration    | `npx vitest run` on the 5 workout suites                                                                                          | 85 passed                   |
| New spec              | `E2E_PORT=8104 npx playwright test --project=chromium e2e/workout-write-failure.spec.ts`                                          | 13 passed                   |
| Feature regression    | `workout.spec.ts`, `workout-gym-v2.spec.ts`, `workout-editor-input-reliability.spec.ts`, `workout-body-weight-validation.spec.ts` | 29 passed                   |
| W9/W9.5 + audit lanes | `workout-w9*.spec.ts`, `workout-w95*.spec.ts`, `workout-snapshot-ordering.spec.ts`, `workout-finish-celebration.spec.ts`          | 22 passed / 6 skipped       |
| Visual                | `--project=visual --grep "workout landing"`                                                                                       | 1 passed (golden unchanged) |

Final verdict: pass. Final green evidence: `npx playwright test
--project=chromium e2e/workout-write-failure.spec.ts` 13 passed; `npx vitest run`
on the workout suites 85 passed; `npx tsc --noEmit` and `npx eslint
--max-warnings 0` both passed with zero findings on every touched file.

Every heavy command ran under `flock /tmp/sh-heavy.lock
/workspace/pi-sessions/memwait.sh` with `E2E_PORT=8104`; `node_modules` was
never installed or mutated.

## Changed Files / Areas

- `features/workout/WorkoutScreen.tsx` — routine create/delete, quick log,
  weekly-plan chips, day-sheet assignment, move workout, body-weight delete,
  both discards; per-surface error state.
- `features/workout/RoutineDetailScreen.tsx` — library picker + custom-create
  failures reported on the picker; legacy add routed through the shared helper.
- `features/workout/CustomExerciseManager.tsx` — rename/archive/restore.
- `features/workout/WorkoutHistoryDetail.tsx` — session delete.
- `features/workout/workoutWriteFailure.ts` (new) — the shared copy helper.
- `e2e/workout-write-failure.spec.ts` (new) — 13 pinned contracts.
- `tests/workoutWriteFailure.test.ts` (new) — helper classification.

## Recovery / Resume Instructions

- Reread `AGENTS.md`, `.agent/PLANS.md`, and this plan; inspect `git status
--short` and `git diff`.
- The only follow-up surface is review feedback on the eight handler changes:
  each must keep its alert on its own surface, keep success paths untouched,
  and keep the new spec green. Verify with the commands in the validation
  ledger (lock + memory gate, `E2E_PORT=8104`).
- Do not weaken the spec: an alert must stay scoped to the surface that owns
  the write, and the retry must stay a one-shot exactly-once assertion.

## Outcomes & Retrospective

Eight silent sites across four files now report their failures where the user
acted, keep the pre-tap UI and durable state, and retry cleanly; one shared copy
helper keeps storage-failure copy honest and consistent. The remaining workout
write paths were already honest since Tier-1 and are left unchanged (enumerated
in the final report). No success-path behaviour, ordering, durability, or XP
accounting changed, and the landing golden still matches.
