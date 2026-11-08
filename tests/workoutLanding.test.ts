import { describe, expect, it } from 'vitest';
import {
  buildQuickStartRows,
  buildTrainingState,
  buildWeekStrip,
  completedWeekdaysForWeek,
  weekdayLabel,
  weekdayShortLabel,
  type RoutineCounts,
  type TrainingStateInput,
} from '@/features/workout/workoutLanding';
import type { WorkoutWeeklyPlanEntry, WorkoutRoutine } from '@/core/db/types';

function routine(id: string, name: string): WorkoutRoutine {
  return {
    id,
    name,
    description: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  } satisfies WorkoutRoutine;
}

function weeklyEntry(
  weekday: number,
  planKind: 'workout' | 'rest',
  routineId: string | null,
): WorkoutWeeklyPlanEntry {
  return {
    id: `wplan_${weekday}`,
    weekday,
    plan_kind: planKind,
    routine_id: routineId,
    note: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  } satisfies WorkoutWeeklyPlanEntry;
}

const counts: RoutineCounts[] = [
  { routineId: 'r_push', exerciseCount: 5, setCount: 20 },
  { routineId: 'r_pull', exerciseCount: 4, setCount: 16 },
];

const lastPerformed = new Map<string, string>([
  ['r_push', '2026-10-09T10:00:00.000Z'], // "yesterday" for a 2026-10-10 now
]);

function trainingInput(overrides: Partial<TrainingStateInput> = {}): TrainingStateInput {
  return {
    schedule: { planKind: 'rest', routineId: null },
    scheduledRoutine: null,
    completedToday: false,
    draftRoutineName: null,
    hasDraft: false,
    routineCount: 2,
    ...overrides,
  };
}

describe('buildTrainingState', () => {
  it('gives a persisted draft the single dominant resume action', () => {
    const state = buildTrainingState(
      trainingInput({ hasDraft: true, draftRoutineName: 'Pull Day' }),
    );
    expect(state.kind).toBe('resume');
    expect(state.primaryAction).toBe('resume');
    expect(state.primaryLabel).toBe('Resume workout');
    expect(state.contextLine).toContain('Pull Day');
    // The resume detail explains that entered progress is saved.
    expect(state.detail).toMatch(/saved/i);
  });

  it('resume outranks a scheduled routine and a completed session', () => {
    const state = buildTrainingState(
      trainingInput({
        hasDraft: true,
        draftRoutineName: 'Leg Day',
        schedule: { planKind: 'workout', routineId: 'r_push' },
        scheduledRoutine: { id: 'r_push', name: 'Push Day', exerciseCount: 5, setCount: 20 },
        completedToday: true,
      }),
    );
    expect(state.kind).toBe('resume');
    expect(state.primaryAction).toBe('resume');
  });

  it('scheduled state shows counts and a start action for the scheduled routine', () => {
    const state = buildTrainingState(
      trainingInput({
        schedule: { planKind: 'workout', routineId: 'r_push' },
        scheduledRoutine: { id: 'r_push', name: 'Push Day', exerciseCount: 5, setCount: 20 },
      }),
    );
    expect(state.kind).toBe('scheduled');
    expect(state.primaryAction).toBe('start-scheduled');
    expect(state.primaryRoutineId).toBe('r_push');
    expect(state.headline).toBe('Push Day');
    expect(state.detail).toContain('5 exercises');
    expect(state.detail).toContain('20 prescribed sets');
  });

  it('completed-today keeps training available without claiming it is pending', () => {
    const state = buildTrainingState(
      trainingInput({
        schedule: { planKind: 'workout', routineId: 'r_push' },
        scheduledRoutine: { id: 'r_push', name: 'Push Day', exerciseCount: 5, setCount: 20 },
        completedToday: true,
      }),
    );
    expect(state.kind).toBe('scheduled');
    expect(state.completedToday).toBe(true);
    expect(state.primaryLabel).toBe('Start another session');
    expect(state.primaryAction).toBe('start-scheduled');
  });

  it('rest state stays compact: no hero primary that blocks quick start', () => {
    const state = buildTrainingState(trainingInput());
    expect(state.kind).toBe('rest');
    expect(state.contextLine).toBe('Today · Rest scheduled');
    expect(state.headline).toBe('Rest day');
    // The primary merely opens the chooser; quick-start rows below carry start.
    expect(state.primaryAction).toBe('choose-routine');
    expect(state.detail).toMatch(/weekly plan stays unchanged/i);
  });

  it('rest day with no routines offers no training action and guides creation', () => {
    const state = buildTrainingState(trainingInput({ routineCount: 0 }));
    expect(state.kind).toBe('rest');
    expect(state.primaryAction).toBe('none');
    expect(state.primaryLabel).toBeNull();
    expect(state.detail).toMatch(/Add a routine/i);
  });

  it('free day with routines still reaches training', () => {
    const state = buildTrainingState(trainingInput({ schedule: null, routineCount: 3 }));
    expect(state.kind).toBe('free');
    expect(state.primaryAction).toBe('choose-routine');
  });

  it('a routine scheduled but missing from the landing read falls back to free, not rest', () => {
    const state = buildTrainingState(
      trainingInput({
        schedule: { planKind: 'workout', routineId: 'r_missing' },
        scheduledRoutine: null,
      }),
    );
    expect(state.kind).toBe('free');
  });
});

describe('buildQuickStartRows', () => {
  const now = new Date(2026, 9, 10); // 2026-10-10 local

  it('carries name, counts, last performed, and the today marker', () => {
    const rows = buildQuickStartRows(
      [routine('r_push', 'Push Day'), routine('r_pull', 'Pull Day')],
      counts,
      lastPerformed,
      'r_push',
      now,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      routineId: 'r_push',
      name: 'Push Day',
      exerciseCount: 5,
      setCount: 20,
      lastPerformedLabel: 'Yesterday',
      isScheduledToday: true,
    });
    expect(rows[1].isScheduledToday).toBe(false);
    expect(rows[1].lastPerformedLabel).toBeNull();
  });

  it('a draft for a different routine does not change which routine a row starts', () => {
    const rows = buildQuickStartRows(
      [routine('r_push', 'Push Day'), routine('r_pull', 'Pull Day')],
      counts,
      lastPerformed,
      null,
      now,
    );
    // Rows are keyed to their own routine identity only.
    expect(rows.map((row) => row.routineId)).toEqual(['r_push', 'r_pull']);
    expect(rows.every((row) => !row.isScheduledToday)).toBe(true);
  });

  it('handles zero routines, one routine, and missing counts', () => {
    expect(buildQuickStartRows([], counts, lastPerformed, null, now)).toEqual([]);
    const [single] = buildQuickStartRows([routine('r_solo', 'Solo')], [], lastPerformed, null, now);
    expect(single).toMatchObject({ exerciseCount: 0, setCount: 0, lastPerformedLabel: null });
  });

  it('keeps long routine names intact (no truncation in the view model)', () => {
    const longName = 'Upper Body Strength And Conditioning Day Number Four';
    const [row] = buildQuickStartRows(
      [routine('r_long', longName)],
      counts,
      lastPerformed,
      null,
      now,
    );
    expect(row.name).toBe(longName);
  });
});

describe('buildWeekStrip', () => {
  const routines = [routine('r_push', 'Push Day'), routine('r_pull', 'Pull Day')];

  it('renders seven cells in Monday-first order with readable assignments', () => {
    const cells = buildWeekStrip({
      weeklyPlan: [
        weeklyEntry(1, 'workout', 'r_push'),
        weeklyEntry(2, 'workout', 'r_pull'),
        weeklyEntry(3, 'rest', null),
      ],
      routines,
      todayWeekday: 1,
    });
    expect(cells).toHaveLength(7);
    expect(cells[0]).toMatchObject({
      dayLabel: 'Mon',
      state: 'workout',
      routineName: 'Push Day',
      isToday: true,
    });
    expect(cells[1].routineName).toBe('Pull Day');
    expect(cells[2]).toMatchObject({ state: 'rest', routineName: null });
    expect(cells[3]).toMatchObject({ state: 'unassigned', routineName: null });
  });

  it('explicit rest is distinct from an unassigned day', () => {
    const cells = buildWeekStrip({
      weeklyPlan: [weeklyEntry(3, 'rest', null)],
      routines,
      todayWeekday: 1,
    });
    expect(cells[2].state).toBe('rest');
    expect(cells[4].state).toBe('unassigned');
  });

  it('today cell shows the resolved override and marks it as an override', () => {
    const cells = buildWeekStrip({
      weeklyPlan: [weeklyEntry(2, 'workout', 'r_push')],
      routines,
      todayWeekday: 2,
      todayResolution: { planKind: 'workout', routineId: 'r_pull', isOverride: true },
    });
    expect(cells[1]).toMatchObject({
      isToday: true,
      routineName: 'Pull Day',
      isOverride: true,
    });
    // The recurring template row itself still holds Push Day.
    const template = weeklyEntry(2, 'workout', 'r_push');
    expect(template.routine_id).toBe('r_push');
  });

  it('an override marking today as rest wins for today without editing the template', () => {
    const cells = buildWeekStrip({
      weeklyPlan: [weeklyEntry(2, 'workout', 'r_push')],
      routines,
      todayWeekday: 2,
      todayResolution: { planKind: 'rest', routineId: null, isOverride: true },
    });
    expect(cells[1]).toMatchObject({ state: 'rest', isOverride: true, routineName: null });
  });

  it('assignment alone is not completion: planned stays planned without a log', () => {
    const cells = buildWeekStrip({
      weeklyPlan: [weeklyEntry(1, 'workout', 'r_push'), weeklyEntry(3, 'workout', 'r_pull')],
      routines,
      todayWeekday: 5,
    });
    expect(cells[0]).toMatchObject({ state: 'workout', routineName: 'Push Day', completed: false });
    expect(cells[2]).toMatchObject({ state: 'workout', completed: false });
  });

  it('a completed session this week marks that day done, assignment or not', () => {
    const cells = buildWeekStrip({
      weeklyPlan: [weeklyEntry(1, 'workout', 'r_push')],
      routines,
      todayWeekday: 5,
      // Monday (1) has a log; Tuesday (2) has one too, even with no assignment.
      completedWeekdays: [1, 2],
    });
    expect(cells[0]).toMatchObject({ state: 'workout', routineName: 'Push Day', completed: true });
    expect(cells[1]).toMatchObject({ state: 'unassigned', routineName: null, completed: true });
    expect(cells[3]).toMatchObject({ completed: false });
  });

  it('an explicit rest day stays rest unless it was actually trained', () => {
    const restOnly = buildWeekStrip({
      weeklyPlan: [weeklyEntry(3, 'rest', null)],
      routines,
      todayWeekday: 5,
    });
    expect(restOnly[2]).toMatchObject({ state: 'rest', completed: false });
    const restTrained = buildWeekStrip({
      weeklyPlan: [weeklyEntry(3, 'rest', null)],
      routines,
      todayWeekday: 5,
      completedWeekdays: [3],
    });
    expect(restTrained[2]).toMatchObject({ state: 'rest', completed: true });
  });

  it('a future assigned day is never done', () => {
    const cells = buildWeekStrip({
      weeklyPlan: [weeklyEntry(6, 'workout', 'r_push')],
      routines,
      todayWeekday: 3,
      // Even a (corrupt) future weekday in the completed set cannot make it done.
      completedWeekdays: [6],
    });
    expect(cells[5]).toMatchObject({ state: 'workout', routineName: 'Push Day', completed: false });
    // Today itself CAN complete (its date has happened).
    const todayDone = buildWeekStrip({
      weeklyPlan: [weeklyEntry(3, 'workout', 'r_push')],
      routines,
      todayWeekday: 3,
      completedWeekdays: [3],
    });
    expect(todayDone[2]).toMatchObject({ isToday: true, completed: true });
  });

  it('a template assignment for a deleted routine degrades to unassigned rather than a stale name', () => {
    const cells = buildWeekStrip({
      weeklyPlan: [weeklyEntry(4, 'workout', 'r_deleted')],
      routines,
      todayWeekday: 1,
    });
    expect(cells[3]).toMatchObject({ state: 'unassigned', routineName: null });
  });
});

describe('completedWeekdaysForWeek', () => {
  /** Local-calendar key, mirroring lib/time's toDateKey contract. */
  const key = (date: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  };
  const log = (localIso: string) => ({ completed_at: new Date(localIso).toISOString() });

  it('starts the week on Monday and ends it on Sunday', () => {
    // 2026-10-13 is a Tuesday; the week runs Mon 12 → Sun 18.
    expect(completedWeekdaysForWeek([log('2026-10-12T09:00:00')], '2026-10-13', key)).toEqual([1]);
    // Sunday closes the week: on Sunday 18 the window still starts Mon 12.
    expect(completedWeekdaysForWeek([log('2026-10-18T09:00:00')], '2026-10-18', key)).toEqual([7]);
    // The following week that Sunday is out of range.
    expect(completedWeekdaysForWeek([log('2026-10-18T09:00:00')], '2026-10-20', key)).toEqual([]);
    // A Wednesday mid-week key resolves the same Monday boundary.
    expect(completedWeekdaysForWeek([log('2026-10-14T09:00:00')], '2026-10-14', key)).toEqual([3]);
  });

  it('excludes last Sunday (it belongs to the previous week)', () => {
    expect(completedWeekdaysForWeek([log('2026-10-11T09:00:00')], '2026-10-13', key)).toEqual([]);
    // ...while this week's Sunday IS included.
    expect(completedWeekdaysForWeek([log('2026-10-18T09:00:00')], '2026-10-18', key)).toEqual([7]);
  });

  it('includes today, including a session logged late at night local time', () => {
    // 23:55 local on Tuesday must count as Tuesday even though it is the next
    // day in UTC (the local-calendar contract `toDateKey` encodes).
    expect(completedWeekdaysForWeek([log('2026-10-13T23:55:00')], '2026-10-13', key)).toEqual([2]);
    // 00:05 local Wednesday counts as Wednesday, not Tuesday.
    expect(completedWeekdaysForWeek([log('2026-10-14T00:05:00')], '2026-10-14', key)).toEqual([3]);
  });

  it('dedupes repeated sessions on one day and sorts Monday-first', () => {
    expect(
      completedWeekdaysForWeek(
        [log('2026-10-16T09:00:00'), log('2026-10-13T09:00:00'), log('2026-10-16T18:00:00')],
        '2026-10-16',
        key,
      ),
    ).toEqual([2, 5]);
  });

  it('moves the window with the day key (no stale week across a rollover)', () => {
    const logs = [log('2026-10-16T09:00:00')]; // Friday of the 12–18 week
    expect(completedWeekdaysForWeek(logs, '2026-10-16', key)).toEqual([5]);
    // Next Monday: same logs, new week → nothing completed this week.
    expect(completedWeekdaysForWeek(logs, '2026-10-19', key)).toEqual([]);
    // And a log from the NEW week appears with the new Monday boundary.
    expect(completedWeekdaysForWeek([log('2026-10-19T09:00:00')], '2026-10-19', key)).toEqual([1]);
  });

  it('returns nothing for an empty history or a malformed day key', () => {
    expect(completedWeekdaysForWeek([], '2026-10-13', key)).toEqual([]);
    expect(completedWeekdaysForWeek([log('2026-10-13T09:00:00')], '', key)).toEqual([]);
  });
});

describe('weekday labels', () => {
  it('maps Monday-first weekdays', () => {
    expect(weekdayLabel(1)).toBe('Monday');
    expect(weekdayLabel(7)).toBe('Sunday');
    expect(weekdayShortLabel(1)).toBe('Mon');
  });
});
