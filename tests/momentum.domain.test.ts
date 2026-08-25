import { describe, expect, it } from 'vitest';
import {
  ALL_HABIT_WEEKDAYS,
  createHabitRule,
  serializeHabitLifecycleHistory,
} from '@/features/habits/habits.domain';
import {
  buildMomentumGarden,
  buildMomentumSourceExplanations,
  buildMomentumWindow,
  formatMomentumTodaySummary,
} from '@/features/momentum/momentum.domain';
import type { Habit } from '@/core/db/types';
import type { MomentumDomainInput } from '@/features/momentum/momentum.types';

const TODAY = '2026-08-20';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Read',
    target_per_day: 1,
    reminder_time: null,
    category: 'anytime',
    icon: 'menu-book',
    color: '#16a34a',
    rule_history: JSON.stringify([createHabitRule('2026-08-10', ALL_HABIT_WEEKDAYS, 1)]),
    project_id: null,
    goal_id: null,
    created_at: '2026-08-10T12:00:00',
    updated_at: '2026-08-10T12:00:00',
    deleted_at: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<MomentumDomainInput> = {}): MomentumDomainInput {
  return {
    todayKey: TODAY,
    days: 7,
    tasks: [],
    habits: [],
    habitCompletions: [],
    focus: [],
    workouts: [],
    nutrition: [],
    dailyPlans: [],
    reviews: [],
    milestones: [],
    ...overrides,
  };
}

function iso(dateKey: string, hour = 12): string {
  return `${dateKey}T${String(hour).padStart(2, '0')}:00:00`;
}

describe('buildMomentumWindow', () => {
  it('builds an injected local-calendar window across a year boundary', () => {
    expect(buildMomentumWindow('2026-01-01', 3)).toEqual({
      todayKey: '2026-01-01',
      startKey: '2025-12-30',
      endKey: '2026-01-01',
      days: ['2025-12-30', '2025-12-31', '2026-01-01'],
    });
  });

  it('clamps a requested history to the supported bounded range', () => {
    expect(buildMomentumWindow(TODAY, 0).days).toHaveLength(1);
    expect(buildMomentumWindow(TODAY, 999).days).toHaveLength(28);
  });
});

describe('buildMomentumGarden', () => {
  it('returns a neutral ready state for an empty dataset', () => {
    const model = buildMomentumGarden(baseInput());

    expect(model.days).toHaveLength(7);
    expect(model.today.activeSources).toEqual([]);
    expect(model.today.hasGrowth).toBe(false);
    expect(model.today.accessibilityLabel).toContain('ready for today');
    expect(model.accessibilityLabel).toContain('no contributions yet');
    expect(model.milestones).toEqual([]);
  });

  it('is deterministic and caps task growth without hiding the source explanation', () => {
    const input = baseInput({
      tasks: [
        ...Array.from({ length: 5 }, (_, index) => ({
          completed: 1 as const,
          completed_at: iso(TODAY, 8 + index),
          deleted_at: null,
        })),
        { completed: 0 as const, completed_at: iso(TODAY), deleted_at: null },
        { completed: 1 as const, completed_at: iso(TODAY), deleted_at: iso(TODAY, 23) },
      ],
    });

    const first = buildMomentumGarden(input);
    const second = buildMomentumGarden(input);
    const tasks = first.today.contributions.tasks;

    expect(first).toEqual(second);
    expect(tasks.level).toBe(3);
    expect(tasks.count).toBe(3);
    expect(tasks.detail).toContain('3+');
    expect(first.today.activeSources).toEqual(['tasks']);
  });

  it('maps one meaningful contribution from each supported area', () => {
    const h = habit();
    const model = buildMomentumGarden(
      baseInput({
        habits: [h],
        habitCompletions: [{ habit_id: h.id, date_key: TODAY, count: 1 }],
        focus: [
          {
            started_at: iso(TODAY, 9),
            ended_at: iso(TODAY, 9),
            duration_seconds: 1_500,
            session_type: 'focus',
          },
          {
            started_at: iso(TODAY, 10),
            ended_at: null as unknown as string,
            duration_seconds: 1_500,
            session_type: 'focus',
          },
          {
            started_at: iso(TODAY, 11),
            ended_at: iso(TODAY, 11),
            duration_seconds: 1_500,
            session_type: 'short_break',
          },
        ],
        workouts: [{ completed_at: iso(TODAY, 18) }],
        nutrition: [
          { consumed_on: TODAY, deleted_at: null },
          { consumed_on: TODAY, deleted_at: null },
        ],
        dailyPlans: [
          { date_key: TODAY, status: 'completed', completed_at: iso(TODAY), deleted_at: null },
        ],
        reviews: [{ status: 'completed', completed_at: iso(TODAY), deleted_at: null }],
        milestones: [
          { id: 'goal-1', label: 'Finish launch', status: 'completed', completed_at: iso(TODAY) },
        ],
      }),
    );

    expect(model.today.activeSources).toEqual([
      'habits',
      'focus',
      'workout',
      'nutrition',
      'planning',
      'review',
    ]);
    expect(model.today.contributions.focus.count).toBe(1);
    expect(model.today.contributions.nutrition.count).toBe(1);
    expect(model.milestones).toEqual([{ id: 'goal-1', label: 'Finish launch', dateKey: TODAY }]);
    expect(formatMomentumTodaySummary(model)).toContain('Habits');
    expect(buildMomentumSourceExplanations(model)).toHaveLength(7);
  });

  it('uses habit schedule and target semantics instead of counting raw increments', () => {
    const scheduled = habit({
      id: 'habit-scheduled',
      target_per_day: 2,
      rule_history: JSON.stringify([createHabitRule('2026-08-14', [1, 3, 5], 2)]),
    });
    const model = buildMomentumGarden(
      baseInput({
        habits: [scheduled],
        habitCompletions: [
          { habit_id: scheduled.id, date_key: '2026-08-17', count: 2 }, // Monday, complete
          { habit_id: scheduled.id, date_key: '2026-08-18', count: 99 }, // Tuesday, off-day
          { habit_id: scheduled.id, date_key: '2026-08-19', count: 1 }, // Wednesday, partial
        ],
      }),
    );

    expect(model.days.find((day) => day.dateKey === '2026-08-17')?.contributions.habits.level).toBe(
      1,
    );
    expect(model.days.find((day) => day.dateKey === '2026-08-18')?.contributions.habits.level).toBe(
      0,
    );
    expect(model.days.find((day) => day.dateKey === '2026-08-19')?.contributions.habits.level).toBe(
      0,
    );
  });

  it('treats lifecycle-masked dates as neutral and preserves earlier growth', () => {
    const paused = habit({
      lifecycle_history: serializeHabitLifecycleHistory([
        { status: 'paused', from_date_key: '2026-08-19', to_date_key: null },
      ]),
    });
    const model = buildMomentumGarden(
      baseInput({
        habits: [paused],
        habitCompletions: [
          { habit_id: paused.id, date_key: '2026-08-18', count: 1 },
          { habit_id: paused.id, date_key: '2026-08-19', count: 1 },
        ],
      }),
    );

    expect(model.days.find((day) => day.dateKey === '2026-08-18')?.hasGrowth).toBe(true);
    expect(model.days.find((day) => day.dateKey === '2026-08-19')?.hasGrowth).toBe(false);
  });

  it('caps focus/workout and deduplicates nutrition tracking without target moralization', () => {
    const model = buildMomentumGarden(
      baseInput({
        focus: Array.from({ length: 5 }, (_, index) => ({
          started_at: iso(TODAY, 8 + index),
          ended_at: iso(TODAY, 8 + index),
          duration_seconds: 1_800,
          session_type: 'focus' as const,
        })),
        workouts: [{ completed_at: iso(TODAY, 16) }, { completed_at: iso(TODAY, 17) }],
        nutrition: Array.from({ length: 20 }, () => ({ consumed_on: TODAY })),
      }),
    );

    expect(model.today.contributions.focus).toMatchObject({ count: 2, level: 2 });
    expect(model.today.contributions.workout).toMatchObject({ count: 1, level: 1 });
    expect(model.today.contributions.nutrition).toMatchObject({ count: 1, level: 1 });
    expect(model.today.contributions.nutrition.detail).toBe('Nutrition tracked');
  });

  it('keeps seven-day boundaries and returning-user history neutral', () => {
    const model = buildMomentumGarden(
      baseInput({
        tasks: [
          { completed: 1, completed_at: iso('2026-08-14') },
          { completed: 1, completed_at: iso('2026-08-13') },
        ],
      }),
    );

    expect(model.days[0].dateKey).toBe('2026-08-14');
    expect(model.days[0].hasGrowth).toBe(true);
    expect(model.days.some((day) => day.dateKey === '2026-08-13')).toBe(false);
    expect(model.hasPriorGrowth).toBe(true);
    expect(model.today.hasGrowth).toBe(false);
    expect(model.today.accessibilityLabel).not.toMatch(/dead|failed|streak/i);
  });

  it('ignores invalid timestamps and soft-deleted milestones', () => {
    const model = buildMomentumGarden(
      baseInput({
        focus: [
          {
            started_at: 'not-a-date',
            ended_at: iso(TODAY),
            duration_seconds: 1_500,
            session_type: 'focus',
          },
        ],
        milestones: [
          {
            id: 'deleted-goal',
            label: 'Gone',
            status: 'completed',
            completed_at: iso(TODAY),
            deleted_at: iso(TODAY),
          },
        ],
      }),
    );

    expect(model.today.hasGrowth).toBe(false);
    expect(model.milestones).toEqual([]);
  });
});
