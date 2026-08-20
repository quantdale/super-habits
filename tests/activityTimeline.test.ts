import { describe, expect, it } from 'vitest';
import {
  filterTimelineByDay,
  filterTimelineByRange,
  filterTimelineBySources,
  getTimelineDayKeys,
  groupTimelineByDay,
} from '@/features/activity/activityTimeline.domain';
import type { ActivityTimelineItem } from '@/features/activity/activityTimeline.types';

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
