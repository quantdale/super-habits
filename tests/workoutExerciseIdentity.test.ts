/**
 * AUD-SH09-A / AUD-SH09-B — distinct exercises must not merge by display name.
 *
 * Audited defect (SH-09, Medium): the session summary and payload grouping were
 * keyed on `exerciseName`. Custom exercise names need not be unique, so two
 * "Press" phases with catalog ids `cex_A`/`cex_B` and different modalities
 * (weighted vs timed) produced ONE summary group containing two `setNumber = 1`
 * rows. The screen then resolved group metadata from the FIRST routine exercise
 * with that name, so stable identity and modality were lost in history and
 * progression. Two occurrences of one catalog exercise in a routine collided the
 * same way.
 *
 * These cases drive the real timer sequence → entered values → log payload path
 * and assert distinct instance groups with correct metadata and non-colliding set
 * positions, plus the legacy free-text compatibility control.
 */

import { describe, expect, it } from 'vitest';
import {
  buildTimerSequence,
  collectSessionSetRecords,
  groupSessionExercises,
  summarizeCompletedSets,
} from '@/features/workout/workout.domain';

const SETS = [{ set_number: 1, active_seconds: 30, rest_seconds: 10 }];

describe('AUD-SH09-A: same display name, different catalog identity/modality', () => {
  /** Two custom exercises both named "Press", with different identity/modality. */
  const exercises = [
    {
      name: 'Press',
      catalog_exercise_id: 'cex_A',
      modality: 'weighted_strength' as const,
      unilateral: false,
      supports_external_load: true,
      sets: SETS,
    },
    {
      name: 'Press',
      catalog_exercise_id: 'cex_B',
      modality: 'timed' as const,
      unilateral: false,
      supports_external_load: false,
      sets: SETS,
    },
  ];

  it('keeps the two instances separate through summary and grouping', () => {
    const seq = buildTimerSequence(exercises);
    const activeIdx = seq.map((p, i) => (p.phase === 'active' ? i : -1)).filter((i) => i >= 0);
    expect(activeIdx).toHaveLength(2);

    const dispositions = Object.fromEntries(activeIdx.map((i) => [i, 'completed' as const]));
    const entered = {
      [activeIdx[0]]: { weight: '60', reps: '8' },
      [activeIdx[1]]: { weight: '', reps: '', duration: '45' },
    };
    const last = seq.length - 1;
    const records = collectSessionSetRecords(seq, last, dispositions, entered, 'off');
    const summary = summarizeCompletedSets(seq, last, dispositions);
    const grouped = groupSessionExercises(summary, records);

    // Two groups, not one merged group with two setNumber=1 rows.
    expect(grouped).toHaveLength(2);
    expect(grouped.map((g) => g.exerciseIndex)).toEqual([0, 1]);
    // Each instance keeps its own set, and the set positions do not collide
    // inside a single group (the audited symptom).
    for (const group of grouped) {
      expect(group.sets).toHaveLength(1);
      expect(new Set(group.sets.map((s) => s.setNumber)).size).toBe(group.sets.length);
      expect(group.setsCompleted).toBe(1);
    }
    // Modality-specific values land on the RIGHT instance.
    expect(grouped[0].sets[0]).toMatchObject({ weight: 60, reps: 8 });
    expect(grouped[0].sets[0].durationSeconds).toBeUndefined();
    expect(grouped[1].sets[0]).toMatchObject({ weight: null, reps: null });
    expect(grouped[1].sets[0].durationSeconds).toBe(45);
  });

  it('the payload resolves metadata from the instance position, not the name', () => {
    const seq = buildTimerSequence(exercises);
    const activeIdx = seq.map((p, i) => (p.phase === 'active' ? i : -1)).filter((i) => i >= 0);
    const dispositions = Object.fromEntries(activeIdx.map((i) => [i, 'completed' as const]));
    const last = seq.length - 1;
    const records = collectSessionSetRecords(seq, last, dispositions, {}, 'off');
    const summary = summarizeCompletedSets(seq, last, dispositions);
    const grouped = groupSessionExercises(summary, records);

    // The screen resolves `routine.exercises[g.exerciseIndex]`; emulate that and
    // assert each group gets ITS OWN catalog identity (the audited defect used
    // `find(item => item.name === name)`, which returned cex_A for both).
    const resolved = grouped.map((group) => {
      const exercise = exercises[group.exerciseIndex];
      return {
        exerciseIndex: group.exerciseIndex,
        catalogExerciseId: exercise?.catalog_exercise_id ?? null,
        modality: exercise?.modality ?? 'timed',
      };
    });
    expect(resolved).toEqual([
      { exerciseIndex: 0, catalogExerciseId: 'cex_A', modality: 'weighted_strength' },
      { exerciseIndex: 1, catalogExerciseId: 'cex_B', modality: 'timed' },
    ]);
    // The name-based lookup demonstrably collapses them, which is why it was
    // the defect: both resolve to cex_A.
    const byName = grouped.map(
      (group) => exercises.find((item) => item.name === group.exerciseName)?.catalog_exercise_id,
    );
    expect(byName).toEqual(['cex_A', 'cex_A']);
  });
});

describe('AUD-SH09-A: two occurrences of one catalog exercise stay distinct', () => {
  const exercises = [
    {
      name: 'Squat',
      catalog_exercise_id: 'builtin_squat',
      modality: 'weighted_strength' as const,
      unilateral: false,
      supports_external_load: true,
      sets: [
        { set_number: 1, active_seconds: 30, rest_seconds: 10 },
        { set_number: 2, active_seconds: 30, rest_seconds: 10 },
      ],
    },
    {
      name: 'Squat',
      catalog_exercise_id: 'builtin_squat',
      modality: 'weighted_strength' as const,
      unilateral: false,
      supports_external_load: true,
      sets: SETS,
    },
  ];

  it('does not merge repeated occurrences into one group', () => {
    const seq = buildTimerSequence(exercises);
    const activeIdx = seq.map((p, i) => (p.phase === 'active' ? i : -1)).filter((i) => i >= 0);
    expect(activeIdx).toHaveLength(3);
    const dispositions = Object.fromEntries(activeIdx.map((i) => [i, 'completed' as const]));
    const last = seq.length - 1;
    const records = collectSessionSetRecords(seq, last, dispositions, {}, 'off');
    const summary = summarizeCompletedSets(seq, last, dispositions);
    const grouped = groupSessionExercises(summary, records);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((g) => g.exerciseIndex)).toEqual([0, 1]);
    expect(grouped.map((g) => g.sets.length)).toEqual([2, 1]);
    // No group carries a duplicate setNumber.
    for (const group of grouped) {
      expect(new Set(group.sets.map((s) => s.setNumber)).size).toBe(group.sets.length);
    }
  });

  it('keeps added and skipped sets inside their own instance', () => {
    const seq = buildTimerSequence(exercises);
    const activeIdx = seq.map((p, i) => (p.phase === 'active' ? i : -1)).filter((i) => i >= 0);
    // Skip the first instance's second set and the second instance's only set.
    const dispositions = {
      [activeIdx[0]]: 'completed' as const,
      [activeIdx[1]]: 'skipped' as const,
      [activeIdx[2]]: 'skipped' as const,
    };
    const last = seq.length - 1;
    const records = collectSessionSetRecords(seq, last, dispositions, {}, 'off');
    const summary = summarizeCompletedSets(seq, last, dispositions);
    const grouped = groupSessionExercises(summary, records);

    expect(grouped).toHaveLength(2);
    // Instance 0: two rows, one completed one skipped, setsCompleted reflects
    // only the completed set.
    expect(grouped[0].sets.map((s) => s.completed)).toEqual([true, false]);
    expect(grouped[0].setsCompleted).toBe(1);
    // Instance 1: its own skipped row, retained so the skip is not lost.
    expect(grouped[1].sets.map((s) => s.completed)).toEqual([false]);
    expect(grouped[1].setsCompleted).toBe(0);
  });
});

describe('AUD-SH09-B: legacy free-text entries keep their stable identity', () => {
  const exercises = [
    {
      name: 'Mystery movement',
      sets: SETS,
    },
    {
      name: 'Another movement',
      sets: SETS,
    },
  ];

  it('groups legacy exercises by instance position with an immutable name snapshot', () => {
    const seq = buildTimerSequence(exercises);
    const activeIdx = seq.map((p, i) => (p.phase === 'active' ? i : -1)).filter((i) => i >= 0);
    const dispositions = Object.fromEntries(activeIdx.map((i) => [i, 'completed' as const]));
    const last = seq.length - 1;
    const records = collectSessionSetRecords(seq, last, dispositions, {}, 'off');
    const summary = summarizeCompletedSets(seq, last, dispositions);
    const grouped = groupSessionExercises(summary, records);

    expect(grouped).toHaveLength(2);
    // No invented catalog identity, and each group keeps its own name snapshot.
    expect(grouped.map((g) => g.exerciseName)).toEqual(['Mystery movement', 'Another movement']);
    expect(grouped.every((g) => g.sets.every((s) => s.catalogExerciseId === undefined))).toBe(true);
    // Weighted-entry semantics are preserved for legacy rows.
    expect(grouped[0].sets[0]).toMatchObject({ weight: null, reps: null, completed: true });
  });

  it('two legacy exercises with the SAME name remain distinguishable', () => {
    // Legacy routines could genuinely contain the same free-text name twice.
    const sameName = [
      { name: 'Superset thing', sets: SETS },
      { name: 'Superset thing', sets: SETS },
    ];
    const seq = buildTimerSequence(sameName);
    const activeIdx = seq.map((p, i) => (p.phase === 'active' ? i : -1)).filter((i) => i >= 0);
    const dispositions = Object.fromEntries(activeIdx.map((i) => [i, 'completed' as const]));
    const last = seq.length - 1;
    const records = collectSessionSetRecords(seq, last, dispositions, {}, 'off');
    const summary = summarizeCompletedSets(seq, last, dispositions);
    const grouped = groupSessionExercises(summary, records);
    expect(grouped).toHaveLength(2);
    expect(grouped.map((g) => g.exerciseIndex)).toEqual([0, 1]);
  });
});
