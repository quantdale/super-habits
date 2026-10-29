import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  filterTimelineByDay,
  filterTimelineByRange,
  filterTimelineBySources,
  formatHabitTimelineTitle,
  formatTimelineDayLabel,
  getTimelineDayKeys,
  groupTimelineByDay,
  hasClockTime,
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

  // Pages are slices of ONE merged feed, so paging neither loses a row from a
  // light source nor serves the same row twice.
  it('pages one merged newest-first feed without losing rows across pages', async () => {
    const now = new Date('2026-08-20T12:00:00');
    const todos = Array.from({ length: 60 }, (_, i) => ({
      id: `todo_${i}`,
      title: `Task ${i}`,
      completed_at: new Date(Date.UTC(2026, 6, 20, 10, 0, i)).toISOString(),
    }));
    const workouts = Array.from({ length: 2 }, (_, i) => ({
      id: `wrk_${i}`,
      routine_id: 'r1',
      name: `Routine ${i}`,
      completed_at: new Date(Date.UTC(2026, 6, 19, 10, 0, i)).toISOString(),
    }));
    getDatabase.mockResolvedValue(makeDb({ todos, workout_logs: workouts }));

    const collected: string[] = [];
    let after: { occurredAt: string; id: string } | undefined;
    let guard = 0;
    for (;;) {
      const page = await buildActivityTimeline({ days: 'all', now, limit: 25, after });
      expect(page.items.length).toBeLessThanOrEqual(25);
      for (let i = 1; i < page.items.length; i += 1) {
        expect(page.items[i - 1].occurredAt >= page.items[i].occurredAt).toBe(true);
      }
      collected.push(...page.items.map((item) => item.id));
      if (!page.hasMore) break;
      after = page.nextCursor ?? undefined;
      expect(after, 'a page with hasMore carries a cursor').toBeDefined();
      guard += 1;
      expect(guard, 'paging terminates').toBeLessThan(20);
    }

    expect(collected).toHaveLength(62);
    expect(new Set(collected).size).toBe(62);
    // Both workouts (the oldest rows) survived paging.
    expect(collected).toContain('workout:wrk_0');
    expect(collected).toContain('workout:wrk_1');
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

    const { items } = await buildActivityTimeline({
      days: 30,
      now: new Date('2026-08-20T12:00:00'),
    });

    const sql = db.getAllAsync.mock.calls.find((call) =>
      call[0].includes('FROM habit_completions'),
    )?.[0] as string;
    expect(sql).toContain('LEFT JOIN habits h ON h.id = hc.habit_id');
    expect(sql).not.toContain('h.deleted_at IS NULL');

    const habitItems = items.filter((item) => item.source === 'habit');
    expect(habitItems).toHaveLength(2);
    expect(habitItems.find((item) => item.id === 'habit:hc_deleted')?.title).toBe(
      'Logged "a deleted habit"',
    );
    expect(habitItems.find((item) => item.id === 'habit:hc_live')?.title).toBe('Logged "Water"');
    for (const habitItem of habitItems) {
      expect(habitItem.title.startsWith('Completed')).toBe(false);
    }
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

    const { items } = await buildActivityTimeline({
      days: 30,
      now: new Date('2026-08-20T12:00:00'),
    });
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

    const { items } = await buildActivityTimeline({
      days: 30,
      now: new Date('2026-08-20T12:00:00'),
    });
    const corrupt = items.find((item) => item.id === 'habit:hc_corrupt');
    expect(corrupt?.dateKey).toBe('2026-08-05');
  });

  // Decrement touches bump updated_at but must never render as Completed:
  // habit rows are state, so every habit item uses the log operation label.
  it('labels decrement-touched rows with the log operation, not Completed', async () => {
    const db = makeDb({
      habit_completions: [
        habitCompletionRow({
          id: 'hc_decremented',
          date_key: '2026-08-10',
          count: 1,
          updated_at: '2026-08-20T09:00:00.000Z', // decrement touch today
        }),
      ],
    });
    getDatabase.mockResolvedValue(db);

    const { items } = await buildActivityTimeline({
      days: 30,
      now: new Date('2026-08-20T12:00:00'),
    });
    const decremented = items.find((item) => item.id === 'habit:hc_decremented');
    expect(decremented?.title).toBe('Logged "Water"');
    expect(decremented?.title.startsWith('Completed')).toBe(false);
    expect(decremented?.dateKey).toBe('2026-08-10');
  });
});

describe('formatHabitTimelineTitle', () => {
  it('uses the log operation label, never Completed', () => {
    expect(formatHabitTimelineTitle('Water')).toBe('Logged "Water"');
    expect(formatHabitTimelineTitle('a deleted habit')).toBe('Logged "a deleted habit"');
    expect(formatHabitTimelineTitle('Water').startsWith('Completed')).toBe(false);
  });

  it('truncates long habit names to 60 chars like the timeline', () => {
    const long = `${'n'.repeat(100)}`;
    const title = formatHabitTimelineTitle(long);
    expect(title).toBe(`Logged "${`${'n'.repeat(59)}…"`}`);
    expect(title.startsWith('Completed')).toBe(false);
  });
});

/**
 * W17 (Codex P2, PR #76): a date-only occurrence must not render as a clock
 * time. Calorie rows use `occurredAt` as a deterministic `YYYY-MM-DD` sort key
 * on purpose, so `hasClockTime` is the single authority the view consults before
 * formatting an event time.
 */
describe('hasClockTime (W17 date-only guard)', () => {
  it('rejects a date-only key so no clock time is fabricated', () => {
    expect(hasClockTime('2026-10-13')).toBe(false);
    expect(hasClockTime('')).toBe(false);
    expect(hasClockTime('unknown')).toBe(false);
  });

  it('accepts a timestamp-backed instant', () => {
    expect(hasClockTime('2026-10-13T10:00:00.000Z')).toBe(true);
    expect(hasClockTime('2026-10-13T14:05:00')).toBe(true);
  });

  it('keeps every real timeline source that carries a time formattable', () => {
    // The data layer supplies full instants for all timestamp sources, and a
    // date-only key only for the calorie day aggregate.
    expect(hasClockTime('2026-10-13T18:30:00.000Z')).toBe(true);
    expect(hasClockTime('2026-10-13')).toBe(false);
  });
});

/**
 * Audit C §9: `formatDayLabel` lived in the view with
 * `Math.round(diff / (24 * 60 * 60 * 1000))`. It is now a pure domain helper
 * over `lib/time`'s calendar-day differ and injectable `todayKey`.
 */
describe('formatTimelineDayLabel', () => {
  const previousTz = process.env.TZ;

  afterEach(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  it('labels Today, Yesterday, the synthetic bucket, and older days', () => {
    expect(formatTimelineDayLabel('2026-08-20', '2026-08-20')).toBe('Today');
    expect(formatTimelineDayLabel('2026-08-19', '2026-08-20')).toBe('Yesterday');
    expect(formatTimelineDayLabel('unknown', '2026-08-20')).toBe('Earlier');
    expect(formatTimelineDayLabel('2026-08-03', '2026-08-20')).toBe('2026-08-03');
  });

  it('degrades a malformed key to the raw key instead of throwing', () => {
    // A corrupt timestamp yields this key; the label is on the render path.
    expect(formatTimelineDayLabel('NaN-NaN-NaN', '2026-08-20')).toBe('NaN-NaN-NaN');
  });

  it('resolves Yesterday across the 23-hour DST day', () => {
    process.env.TZ = 'America/New_York';
    expect(formatTimelineDayLabel('2026-03-07', '2026-03-08')).toBe('Yesterday');
  });

  it('does not call the skipped date-line day Yesterday', () => {
    process.env.TZ = 'Pacific/Apia';
    expect(formatTimelineDayLabel('2011-12-29', '2011-12-31')).toBe('2011-12-29');
  });

  it('filterTimelineByRange spans exactly N local days across DST', () => {
    process.env.TZ = 'America/New_York';
    const items = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-08'].map((key) =>
      item(`i-${key}`, 'todo', key),
    );
    // 7-day window ending on the 23-hour spring-forward day starts Mar 2.
    expect(filterTimelineByRange(items, '7', '2026-03-08').map((i) => i.dateKey)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-08',
    ]);
  });
});
