# W9 Workout design

## 1. What the engine guarantees (do not redesign)

`workout.domain.ts` + `workout.data.ts` are authoritative:

- `buildTimerSequence()` flattens the routine into strictly sequential active
  and rest phases. `rest_seconds === 0` omits the rest phase entirely; superset
  partners run back-to-back with rest after the group. The session cursor is a
  single `currentIndex` that only moves forward (`advanceFromCurrent`,
  natural timeout, Skip).
- Dispositions: natural timeout = `completed`, Skip = `skipped`. Skipped active
  phases are never completed work (`summarizeCompletedSets`).
- Weighted/bodyweight active phases stop their timer at zero WITHOUT completing;
  timed/cardio phases record their duration at zero and advance. Legacy
  free-text exercises remain timer-driven.
- The draft (`app_meta.workout.active_session_draft`) stores routineId,
  startedAtIso, phaseIndex, elapsedAdjustSeconds, dispositions, enteredSets,
  remainingSeconds. Resume replays them. One draft authority.
- `collectSessionSetRecords` → `groupSessionExercises` → `logWorkoutSession` is
  the only write path; `findNewPersonalRecords` is the only PR source; XP is
  awarded only after `logWorkoutSession` returns `applied`.

W9 changes presentation and session-local set composition only. No timer
arithmetic, no schema migration, no sync/backup change, no routine-template
write from the live session.

## 2. Landing model

Pure view model (`features/workout/workoutLanding.ts`):

- `buildTrainingState({ schedule, routine, completedToday, draft, routines })`
  → `{ kind: 'resume' | 'scheduled' | 'rest' | 'free', headline, detail,
primary: { label, action } }`. One primary action per screen.
- `buildQuickStartRows(routines, counts, lastPerformed, todayKey)` → compact
  rows (name, "N exercises · M sets", last performed label, start action).
- `buildWeekStrip(weeklyPlan, routines, todayWeekday)` → 7 cells with readable
  assignment text; `rest` distinct from unassigned.

Composition order (top → bottom):

1. `PageHeader` "Workout" (no subtitle) + one-line training state
   (Today · Push Day / Today · Rest scheduled).
2. Primary action card: Resume (draft) | Start today's routine | Start a
   routine (quick start below). Discard secondary + confirmed.
3. QUICK START section label + routine rows (flat, hairline-separated;
   SwipeableCard retained for delete; row opens the routine detail; Start is
   the row's primary; "Complete workout" quick-log remains per row).
4. THIS WEEK section label + collapsed strip + "Edit plan" + (scheduled
   workout only) "Move to another day".
5. YOUR ROUTINES management: add-routine form (name/description) — unchanged
   contract (`Add routine`, validation, one-row guard).
6. HISTORY & INSIGHTS disclosure (collapsed by default): recent sessions,
   totals, progress/PRs/body areas, body weight, weekly volume, heatmap,
   streak/days. All heavy derivations (personal records, training totals,
   body-area distribution, heatmap days) are computed only while open.

## 3. Live session model

Pure view model (`features/workout/workoutSessionView.ts`):

- `buildSessionProgress(sequence, dispositions, currentIndex)` →
  `{ completedSets, skippedSets, processedSets, totalPrescribedSets,
currentExercise: { name, setNumber, totalSets, completed } }`.
- `buildExerciseSetRows(sequence, exerciseIndex, dispositions, enteredSets,
currentIndex, previousLookup)` → per-set rows for the current exercise:
  `{ setNumber, state: 'completed'|'skipped'|'current'|'upcoming', previous,
entered }`. Sequential cursor preserved: only the phase at `currentIndex`
  is actionable; completed rows show recorded values read-only.
- `withAddedSet(sequence, addedSets, exerciseName)` → new sequence + index
  remap for dispositions/enteredSets when a session-local set is appended to
  an exercise. Pure, unit-tested; the only place the sequence grows mid-session.

Anatomy:

```
WorkoutSessionScreen
  [session top bar] routine name · 3/15 sets (1 skipped) · elapsed · End
  [PR notice — brief, nonblocking, dismissible]
  [exercise block] name · Set 2 of 3 · modality · target
     set table: # | PREV | inputs | DONE   (completed/skipped/upcoming states)
     Add set (session-local)
  [rest dock — only while current phase is rest]
     Rest 0:47  −15s  +15s  Skip   Next: Bench Press — Set 3 of 3
```

- Inputs by modality (unchanged semantics): weight + reps (weighted;
  additional-load label for bodyweight), reps only when external load is
  unsupported, duration (timed), duration + distance + pace (cardio),
  reps/side label (unilateral), effort (RIR/RPE when enabled), legacy
  free-text = weight/reps.
- Rest is a docked panel laid out in flow at the bottom of the session screen
  (content padding above it), never overlaying inputs. Reaching zero advances
  to the next phase exactly as today; it never completes a set. Skipping rest
  uses the existing `advanceFromCurrent('skipped')` on the rest phase
  (unchanged).
- Progress label uses `completedSets / totalPrescribedSets` with skipped shown
  separately; elapsed time is its own readout.
- Finish: unchanged exactly-once guard; `logWorkoutSession` failure now sets
  an error state with retry; success shows the summary (duration, sets done,
  exercises, volume, PRs) and one Done action.
- Cancel: `useConfirmationDialog` with truthful copy — leaving keeps the draft
  and returns to the landing (Resume dominant there); discard is the separate
  confirmed destructive path. The draft is cleared only on finish, discard, or
  when the routine becomes invalid.

## 4. Add set contract (narrow)

- Appends one set to the CURRENT exercise in the session: set number =
  prescribed count + 1 + already-added; rest seconds inherit the exercise's
  last prescribed set (0 stays 0, superset adjacency unchanged); active
  seconds inherit the exercise's last active seconds (or pacing default for
  timed modalities).
- Session state holds `addedSets: Record<exerciseName, number>`; the sequence
  is `withAddedSet(buildTimerSequence(routine.exercises), addedSets,
exerciseName)`. `withAddedSet` returns the remap so dispositions,
  enteredSets, and the cursor keep pointing at the same phases.
- Persisted in the draft (new optional `addedSets` field, additive normalize);
  resume reconstructs the same sequence. Finish logs the added sets with
  correct numbering through the unchanged record pipeline.
- The recurring routine is never written; the log is the only durable record.

## 5. Performance posture

- Landing: heavy analytics gated behind the open disclosure; quick-start/week
  reads are the existing batched `Promise.all` refresh.
- Session: entered-value edits patch one key of `enteredSets`; the draft write
  stays debounced (250ms); the set table memoizes rows per
  (sequence, dispositions, enteredSets, currentIndex); the rest dock owns its
  own 1s tick state so typing never re-renders the whole exercise block on a
  timer frame.

## 6. Evidence plan

`docs/ui-ux/v3-audit/w9/`: populated, rest-day, scheduled day, draft/resume,
empty, quick-start, week collapsed, week editor, routine detail, active
strength, bodyweight, cardio/timed, set completed, set skipped, rest dock,
zero-rest, long exercise name, PR notice, finish summary, history expanded,
dark, large text, HEAVY, 360/390/768/1280.
