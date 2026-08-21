import { describe, expect, it, vi } from 'vitest';
import {
  filterTimelineByDay,
  filterTimelineByRange,
  filterTimelineBySources,
  getTimelineDayKeys,
  groupTimelineByDay,
} from '@/features/activity/activityTimeline.domain';
import type { ActivityTimelineItem } from '@/features/activity/activityTimeline.types';
import { dateKeyToLocalDate } from '@/lib/time';
import { buildActivityTimeline } from '@/features/activity/activityTimeline.data';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

function item(
  id: string,
  source: ActivityTimelineItem['source'],
  dateKey: string,
): ActivityTimelineItem {
  return {
    id,
    occurredAt: `${dateKey}T10:00:00.000Z`,
    dateKey,
    category: source === 'habit' ? 'health' : 'productivity',
    source,
    title: `Item ${id}`,
    icon: 'check-circle',
  };
}

describe('filterTimelineBySources', () => {
  const items = [
    item('a', 'todo', '2026-08-20'),
    item('b', 'habit', '2026-08-19'),
    item('c', 'focus', '2026-08-18'),
    item('d', 'workout', '2026-08-17'),
    item('e', 'calories', '2026-08-16'),
    item('f', 'daily_plan', '2026-08-15'),
    item('g', 'project', '2026-08-14'),
    item('h', 'goal', '2026-08-13'),
  ];

  it('returns everything for "all"', () => {
    expect(filterTimelineBySources(items, 'all')).toHaveLength(8);
  });

  it('filters each entity type', () => {
    expect(filterTimelineBySources(items, 'todos').map((i) => i.id)).toEqual(['a']);
    expect(filterTimelineBySources(items, 'habits').map((i) => i.id)).toEqual(['b']);
    expect(filterTimelineBySources(items, 'focus').map((i) => i.id)).toEqual(['c']);
    expect(filterTimelineBySources(items, 'workout').map((i) => i.id)).toEqual(['d']);
    expect(filterTimelineBySources(items, 'calories').map((i) => i.id)).toEqual(['e']);
  });

  it('planning covers plans, reviews, projects and goals', () => {
    expect(filterTimelineBySources(items, 'planning').map((i) => i.id)).toEqual(['f', 'g', 'h']);
  });
});

describe('filterTimelineByRange', () => {
  const items = [
    item('today', 'todo', '2026-08-20'),
    item('d5', 'todo', '2026-08-15'),
    item('d8', 'todo', '2026-08-12'),
    item('d40', 'todo', '2026-07-11'),
  ];

  it('keeps only items within the inclusive window', () => {
    const out = filterTimelineByRange(items, '7', '2026-08-20');
    expect(out.map((i) => i.id)).toEqual(['today', 'd5']);
  });

  it('30-day window includes day-30 but not day-31', () => {
    const out = filterTimelineByRange(items, '30', '2026-08-20');
    expect(out.map((i) => i.id)).toEqual(['today', 'd5', 'd8']);
  });

  it('"all" returns items unchanged', () => {
    expect(filterTimelineByRange(items, 'all', '2026-08-20')).toEqual(items);
  });

  it('handles month boundaries', () => {
    const out = filterTimelineByRange([item('x', 'todo', '2026-07-25')], '7', '2026-08-01');
    expect(out).toHaveLength(0);
    const out2 = filterTimelineByRange([item('y', 'todo', '2026-07-26')], '7', '2026-08-01');
    expect(out2).toHaveLength(1);
  });
});

describe('day-jump helpers', () => {
  const items = [
    item('a', 'todo', '2026-08-20'),
    item('b', 'habit', '2026-08-20'),
    item('c', 'focus', '2026-08-18'),
  ];

  it('lists distinct day keys most recent first', () => {
    expect(getTimelineDayKeys(items)).toEqual(['2026-08-20', '2026-08-18']);
  });

  it('filters to a single day', () => {
    expect(filterTimelineByDay(items, '2026-08-18').map((i) => i.id)).toEqual(['c']);
  });

  it('null day key means all days', () => {
    expect(filterTimelineByDay(items, null)).toEqual(items);
  });

  it('grouping stays stable after filtering', () => {
    const groups = groupTimelineByDay(filterTimelineByDay(items, '2026-08-20'));
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Data layer: buildActivityTimeline (F3/F5/F6)
// ---------------------------------------------------------------------------

type TableRows = Record<string, Record<string, unknown>[]>;

/** Minimal db stub that routes getAllAsync calls by queried table. */
function makeDb(rows: TableRows) {
  return {
    getAllAsync: vi.fn(
      async (sql: string, _params: unknown[]): Promise<Record<string, unknown>[]> => {
        if (sql.includes('FROM todos')) return rows.todos ?? [];
        if (sql.includes('FROM habit_completions')) return rows.habit_completions ?? [];
        if (sql.includes('FROM pomodoro_sessions')) return rows.pomodoro_sessions ?? [];
        if (sql.includes('FROM workout_logs')) return rows.workout_logs ?? [];
        if (sql.includes('FROM calorie_entries')) return rows.calorie_entries ?? [];
        if (sql.includes('FROM weekly_reviews')) return rows.weekly_reviews ?? [];
        if (sql.includes('FROM daily_plans')) return rows.daily_plans ?? [];
        if (sql.includes('FROM projects')) return rows.projects ?? [];
        if (sql.includes('FROM goals')) return rows.goals ?? [];
        return [];
      },
    ),
    getFirstAsync: vi.fn(async () => null),
  };
}

function habitCompletionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hc_1',
    habit_id: 'habit_1',
    date_key: '2026-08-01',
    count: 1,
    updated_at: '2026-08-01T09:00:00.000Z',
    name: 'Water',
    ...overrides,
  };
}

describe('buildActivityTimeline data layer', () => {
  // F6: the SQL window must start at local midnight of today − (days − 1),
  // not at the current time-of-day, so the fetch cannot drop events the
  // domain range filter promises to keep.
  it('anchors the fetch window at local midnight of the first day in the window', async () => {
    const now = new Date('2026-08-20T15:34:00');
    const db = makeDb({});
    getDatabase.mockResolvedValue(db);

    await buildActivityTimeline({ days: 90, now });

    const expectedStart = dateKeyToLocalDate('2026-08-20');
    expectedStart.setDate(expectedStart.getDate() - 89); // → local midnight of 2026-05-23
    const expectedSinceIso = expectedStart.toISOString();
    expect(expectedSinceIso).not.toBe(
      new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000).toISOString(),
    );

    const habitCall = db.getAllAsync.mock.calls.find((call) =>
      call[0].includes('FROM habit_completions'),
    );
    expect(habitCall?.[1]).toEqual([expectedSinceIso]);

    const todoCall = db.getAllAsync.mock.calls.find((call) => call[0].includes('FROM todos'));
    expect(todoCall?.[1]).toEqual([expectedSinceIso]);

    // The calorie-day query uses the same anchor in date-key form.
    const calorieCall = db.getAllAsync.mock.calls.find((call) =>
      call[0].includes('FROM calorie_entries'),
    );
    expect(calorieCall?.[1]).toEqual(['2026-05-23']);
  });

  // F3 canonical history rule: completions of soft-deleted habits stay in the
  // timeline with a fallback label instead of vanishing via an INNER JOIN.
  it('keeps completions of deleted habits via LEFT JOIN with a fallback label', async () => {
    const db = makeDb({
      habit_completions: [
        habitCompletionRow({ id: 'hc_live', name: 'Water' }),
        habitCompletionRow({ id: 'hc_deleted', habit_id: 'habit_gone', name: null }),
      ],
    });
    getDatabase.mockResolvedValue(db);

    const items = await buildActivityTimeline({ days: 30, now: new Date('2026-08-20T12:00:00') });

    const sql = db.getAllAsync.mock.calls.find((call) =>
      call[0].includes('FROM habit_completions'),
    )?.[0] as string;
    expect(sql).toContain('LEFT JOIN habits h ON h.id = hc.habit_id');
    expect(sql).not.toContain('h.deleted_at IS NULL');

    const habitItems = items.filter((item) => item.source === 'habit');
    expect(habitItems).toHaveLength(2);
    expect(habitItems.find((item) => item.id === 'habit:hc_deleted')?.title).toBe(
      'Completed "a deleted habit"',
    );
    expect(habitItems.find((item) => item.id === 'habit:hc_live')?.title).toBe('Completed "Water"');
  });

  // F5: bucket by the row's authoritative date_key — a decrement or backdated
  // correction bumps updated_at but must not move the event to today.
  it('buckets habit items by date_key and labels multi-count rows', async () => {
    const db = makeDb({
      habit_completions: [
        habitCompletionRow({
          id: 'hc_backdated',
          date_key: '2026-08-01',
          count: 2,
          updated_at: '2026-08-20T09:00:00.000Z', // touched today for an old day
        }),
        habitCompletionRow({
          id: 'hc_single',
          date_key: '2026-08-02',
          count: 1,
          updated_at: '2026-08-02T09:00:00.000Z',
        }),
      ],
    });
    getDatabase.mockResolvedValue(db);

    const items = await buildActivityTimeline({ days: 30, now: new Date('2026-08-20T12:00:00') });
    const backdated = items.find((item) => item.id === 'habit:hc_backdated');
    const single = items.find((item) => item.id === 'habit:hc_single');

    expect(backdated?.dateKey).toBe('2026-08-01');
    expect(backdated?.subtitle).toContain('2026-08-01');
    expect(backdated?.subtitle).toContain('2×');
    expect(single?.dateKey).toBe('2026-08-02');
    expect(single?.subtitle ?? '').not.toContain('×');
  });

  it('survives a corrupt updated_at by trusting the row date_key', async () => {
    const db = makeDb({
      habit_completions: [
        habitCompletionRow({ id: 'hc_corrupt', date_key: '2026-08-05', updated_at: 'garbage' }),
      ],
    });
    getDatabase.mockResolvedValue(db);

    const items = await buildActivityTimeline({ days: 30, now: new Date('2026-08-20T12:00:00') });
    const corrupt = items.find((item) => item.id === 'habit:hc_corrupt');
    expect(corrupt?.dateKey).toBe('2026-08-05');
  });
});
