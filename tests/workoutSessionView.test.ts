import { describe, expect, it } from 'vitest';
import { buildTimerSequence } from '@/features/workout/workout.domain';
import {
  appendAddedSets,
  buildExerciseSetRows,
  buildSessionProgress,
  canAddSetToExercise,
  remapCurrentIndex,
  remapPhaseIndices,
  remapSessionMaps,
} from '@/features/workout/workoutSessionView';
import type { EnteredSetValues, PhaseDisposition } from '@/features/workout/workout.domain';

/** A three-set weighted exercise with 60s rest between sets. */
function strengthExercises() {
  return [
    {
      name: 'Bench Press',
      catalog_exercise_id: 'ex_bench',
      modality: 'weighted_strength' as const,
      superset_group: null,
      sets: [
        {
          set_number: 1,
          active_seconds: 40,
          rest_seconds: 60,
          target_reps_min: 8,
          target_reps_max: 10,
          target_load: 60,
        },
        {
          set_number: 2,
          active_seconds: 40,
          rest_seconds: 60,
          target_reps_min: 8,
          target_reps_max: 10,
          target_load: 60,
        },
        {
          set_number: 3,
          active_seconds: 40,
          rest_seconds: 60,
          target_reps_min: 8,
          target_reps_max: 10,
          target_load: 60,
        },
      ],
    },
    {
      name: 'Cable Row',
      catalog_exercise_id: 'ex_row',
      modality: 'weighted_strength' as const,
      superset_group: null,
      sets: [
        { set_number: 1, active_seconds: 40, rest_seconds: 90, target_load: 50 },
        { set_number: 2, active_seconds: 40, rest_seconds: 90, target_load: 50 },
      ],
    },
  ];
}

describe('buildSessionProgress', () => {
  const sequence = buildTimerSequence(strengthExercises());
  // sequence: bench1, rest, bench2, rest, bench3, rest, row1, rest, row2

  it('counts the actionable set at the cursor as not yet processed', () => {
    const progress = buildSessionProgress(sequence, {}, 0);
    expect(progress).toMatchObject({
      completedSets: 0,
      skippedSets: 0,
      processedSets: 0,
      totalPrescribedSets: 5,
    });
    expect(progress.currentExercise).toMatchObject({
      name: 'Bench Press',
      setNumber: 1,
      totalSets: 3,
      completedInExercise: 0,
    });
  });

  it('counts completed and skipped sets separately and never counts rest phases', () => {
    // bench 1 completed (natural timeout), bench 2 skipped, resting before bench 3.
    const dispositions: Record<number, PhaseDisposition> = { 0: 'completed', 2: 'skipped' };
    const progress = buildSessionProgress(sequence, dispositions, 3);
    expect(progress).toMatchObject({
      completedSets: 1,
      skippedSets: 1,
      processedSets: 2,
      totalPrescribedSets: 5,
    });
    expect(progress.currentExercise).toMatchObject({
      name: 'Bench Press',
      setNumber: 3,
      completedInExercise: 1,
    });
  });

  it('treats phases before the cursor without a disposition as completed (natural timeout)', () => {
    const progress = buildSessionProgress(sequence, {}, 2);
    // phases 0 (bench 1) and 1 (rest) are behind the cursor at bench 2.
    expect(progress.completedSets).toBe(1);
    expect(progress.skippedSets).toBe(0);
  });

  it('counts the final set once when completion holds the cursor on it', () => {
    const dispositions: Record<number, PhaseDisposition> = { 8: 'completed' };
    const progress = buildSessionProgress(sequence, dispositions, 8);
    expect(progress.completedSets).toBe(5);
    expect(progress.skippedSets).toBe(0);
    expect(progress.processedSets).toBe(5);
  });

  it('a skipped final set is never completed work', () => {
    const dispositions: Record<number, PhaseDisposition> = { 8: 'skipped' };
    const progress = buildSessionProgress(sequence, dispositions, 8);
    expect(progress.completedSets).toBe(4);
    expect(progress.skippedSets).toBe(1);
  });

  it('during rest the context is the upcoming set, not the completed one', () => {
    const dispositions: Record<number, PhaseDisposition> = { 0: 'completed' };
    const progress = buildSessionProgress(sequence, dispositions, 1); // resting
    expect(progress.currentExercise).toMatchObject({ name: 'Bench Press', setNumber: 2 });
  });
});

describe('buildExerciseSetRows', () => {
  const sequence = buildTimerSequence(strengthExercises());
  const previousLookup = null;

  it('renders one row per prescribed set with sequential states', () => {
    const rows = buildExerciseSetRows(
      sequence,
      0,
      { 0: 'completed', 2: 'skipped' },
      {},
      4,
      previousLookup,
    );
    expect(rows.map((row) => [row.setNumber, row.state])).toEqual([
      [1, 'completed'],
      [2, 'skipped'],
      [3, 'current'],
    ]);
  });

  it('marks sets behind a skipped set as upcoming only ahead of the cursor', () => {
    const rows = buildExerciseSetRows(sequence, 0, {}, {}, 0, previousLookup);
    expect(rows.map((row) => row.state)).toEqual(['current', 'upcoming', 'upcoming']);
  });

  it('exposes the engine phase so modality inputs are read from it', () => {
    const rows = buildExerciseSetRows(sequence, 0, {}, {}, 0, previousLookup);
    expect(rows[0].phase.modality).toBe('weighted_strength');
    expect(rows[0].phase.targetLoad).toBe(60);
    expect(rows[0].phase.targetRepsMin).toBe(8);
    expect(rows[1].phaseIndex).toBe(2);
  });

  it('carries entered values and defaults to empty strings for unentered sets', () => {
    const entered: Record<number, EnteredSetValues> = { 0: { weight: '60', reps: '10' } };
    const rows = buildExerciseSetRows(sequence, 0, {}, entered, 0, previousLookup);
    expect(rows[0].entered).toEqual({ weight: '60', reps: '10' });
    expect(rows[1].entered).toEqual({ weight: '', reps: '' });
  });

  it('previous context comes from the unchanged lookup semantics', () => {
    const rows = buildExerciseSetRows(sequence, 0, {}, {}, 0, {
      byCatalogExerciseSet: new Map([
        [
          'ex_bench::1',
          {
            exerciseName: 'Bench Press',
            catalogExerciseId: 'ex_bench',
            setNumber: 1,
            weight: 55,
            reps: 10,
          },
        ],
      ]),
      byCatalogExercise: new Map(),
      byExerciseSet: new Map(),
      byExercise: new Map(),
      byLegacyExerciseSet: new Map(),
      byLegacyExercise: new Map(),
    });
    expect(rows[0].previous).toMatchObject({ weight: 55, reps: 10 });
    expect(rows[1].previous).toBeNull();
  });
});

describe('appendAddedSets', () => {
  it('appends correctly numbered sets that inherit the exercise timing', () => {
    const exercises = strengthExercises();
    const extended = appendAddedSets(exercises, { 0: 2 });
    expect(extended[0].sets.map((set) => [set.set_number, set.rest_seconds])).toEqual([
      [1, 60],
      [2, 60],
      [3, 60],
      [4, 60],
      [5, 60], // the new final set inherits the prescribed rest
    ]);
    const sequence = buildTimerSequence(extended);
    // Bench gains one active phase and one inter-set rest per added set:
    // 5 actives + 5 rests (bench is not the session's last exercise).
    expect(
      sequence.filter((phase) => phase.exerciseIndex === 0 && phase.phase === 'active'),
    ).toHaveLength(5);
    expect(
      sequence.filter((phase) => phase.exerciseIndex === 0 && phase.phase === 'rest'),
    ).toHaveLength(5);
    expect(sequence[sequence.length - 1].phase).toBe('active');
  });

  it('leaves other exercises and the original input untouched', () => {
    const exercises = strengthExercises();
    const extended = appendAddedSets(exercises, { 0: 1 });
    expect(extended[1]).toBe(exercises[1]);
    expect(exercises[0].sets).toHaveLength(3);
  });

  it('ignores zero, negative, and unknown indexes', () => {
    const exercises = strengthExercises();
    expect(appendAddedSets(exercises, { 0: 0 })[0].sets).toHaveLength(3);
    expect(appendAddedSets(exercises, { 0: -1 })[0].sets).toHaveLength(3);
    expect(appendAddedSets(exercises, { 9: 2 })[0].sets).toHaveLength(3);
  });

  it('superset partners are excluded from add-set', () => {
    const exercises = [
      {
        name: 'Push-up',
        modality: 'bodyweight' as const,
        superset_group: 'pair',
        sets: [{ set_number: 1, active_seconds: 5, rest_seconds: 0 }],
      },
      {
        name: 'Lunge',
        modality: 'bodyweight' as const,
        superset_group: 'pair',
        sets: [{ set_number: 1, active_seconds: 5, rest_seconds: 0 }],
      },
    ];
    expect(canAddSetToExercise(exercises, 0)).toBe(false);
    expect(canAddSetToExercise(exercises, 1)).toBe(false);
    expect(canAddSetToExercise(strengthExercises(), 0)).toBe(true);
    expect(canAddSetToExercise(strengthExercises(), 5)).toBe(false);
  });

  it('an added final set keeps the inter-exercise rest before the next exercise', () => {
    const extended = appendAddedSets(strengthExercises(), { 0: 1 });
    // The added set becomes bench's new final set, but bench is not the
    // session's last exercise: its final set still rests before Cable Row,
    // exactly like bench's prescribed final set does.
    expect(extended[0].sets[3].rest_seconds).toBe(60);
    const sequence = buildTimerSequence(extended);
    expect(
      sequence.filter((phase) => phase.exerciseIndex === 0 && phase.phase === 'rest'),
    ).toHaveLength(4);
    expect(
      sequence.find(
        (phase) => phase.exerciseIndex === 0 && phase.phase === 'rest' && phase.setNumber === 4,
      ),
    ).toMatchObject({ durationSeconds: 60 });
  });

  it('an added set on the session-final exercise ends the workout with no trailing rest', () => {
    const extended = appendAddedSets(strengthExercises(), { 1: 1 });
    // Added sets inherit the prescribed rest; the engine's positional
    // last-set rule suppresses rest after the true session-final set.
    expect(extended[1].sets[2].rest_seconds).toBe(90);
    const sequence = buildTimerSequence(extended);
    expect(sequence[sequence.length - 1]).toMatchObject({
      phase: 'active',
      exerciseIndex: 1,
      setNumber: 3,
    });
  });
});

describe('phase-index remap after an in-session add', () => {
  it('keeps dispositions, entered values, and the cursor on the same phases', () => {
    const before = buildTimerSequence(strengthExercises());
    const after = buildTimerSequence(appendAddedSets(strengthExercises(), { 0: 1 }));
    const remap = remapPhaseIndices(before, after);

    // bench phases keep their positions; the row exercise shifts by two.
    expect(remap.get(0)).toBe(0);
    expect(remap.get(2)).toBe(2);
    expect(remap.get(4)).toBe(4);
    expect(remap.get(6)).toBe(8);
    expect(remap.get(8)).toBe(10);
    expect(remap.size).toBe(before.length);

    const dispositions: Record<number, PhaseDisposition> = { 0: 'completed', 2: 'skipped' };
    const entered: Record<number, EnteredSetValues> = { 2: { weight: '60', reps: '8' } };
    const remappedDispositions = remapSessionMaps(dispositions, remap);
    const remappedEntered = remapSessionMaps(entered, remap);
    expect(remappedDispositions).toEqual({ 0: 'completed', 2: 'skipped' });
    expect(remappedEntered).toEqual({ 2: { weight: '60', reps: '8' } });

    // Cursor at bench 2 stays on bench 2's active phase after the insert.
    expect(remapCurrentIndex(2, remap)).toBe(2);
    // A cursor sitting on a rest phase still resolves to a shift-consistent index.
    expect(remapCurrentIndex(1, remap)).toBe(1);
  });

  it('the remapped sequence keeps every original phase identity exactly once', () => {
    const before = buildTimerSequence(strengthExercises());
    const after = buildTimerSequence(appendAddedSets(strengthExercises(), { 0: 2 }));
    const remap = remapPhaseIndices(before, after);
    const remappedTargets = [...remap.values()];
    expect(new Set(remappedTargets).size).toBe(remappedTargets.length);
    for (const [oldIndex, newIndex] of remap) {
      expect(after[newIndex].exerciseName).toBe(before[oldIndex].exerciseName);
      expect(after[newIndex].setNumber).toBe(before[oldIndex].setNumber);
      expect(after[newIndex].phase).toBe(before[oldIndex].phase);
    }
  });
});
