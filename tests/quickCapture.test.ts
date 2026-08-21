import { describe, expect, it, vi } from 'vitest';
import { parseQuickCapture } from '@/features/quick-capture/quickCapture.domain';
import {
  MAX_RECENT_CAPTURES,
  pushRecentCapture,
  removeRecentCapture,
  undoRecentCapture,
  type RecentCapture,
} from '@/features/quick-capture/recentCaptures';

const NOW = new Date('2026-08-20T10:00:00'); // Thursday
const PROJECTS = [
  { id: 'p1', name: 'Home Renovation' },
  { id: 'p2', name: 'Work' },
];
const GOALS = [
  { id: 'g1', name: 'Read more' },
  { id: 'g2', name: 'Fitness' },
];

describe('parseQuickCapture — due dates', () => {
  it('parses "today"', () => {
    const r = parseQuickCapture('Call dentist today', { now: NOW });
    expect(r.title).toBe('Call dentist');
    expect(r.dueDateKey).toBe('2026-08-20');
  });

  it('parses "tomorrow" and abbreviations', () => {
    expect(parseQuickCapture('Submit report tomorrow', { now: NOW }).dueDateKey).toBe('2026-08-21');
    expect(parseQuickCapture('tmr buy milk', { now: NOW }).title).toBe('buy milk');
    expect(parseQuickCapture('tmr buy milk', { now: NOW }).dueDateKey).toBe('2026-08-21');
  });

  it('parses weekday names to the next occurrence, skipping today', () => {
    const r = parseQuickCapture('Gym plan friday', { now: NOW });
    expect(r.dueDateKey).toBe('2026-08-21');
    expect(r.title).toBe('Gym plan');
  });

  it('"on monday" resolves to next week when said on a Monday', () => {
    const mondayNow = new Date('2026-08-17T10:00:00');
    const r = parseQuickCapture('Prep standup on monday', { now: mondayNow });
    expect(r.dueDateKey).toBe('2026-08-24');
    expect(r.title).toBe('Prep standup');
  });

  it('parses explicit YYYY-MM-DD and rejects malformed dates', () => {
    const ok = parseQuickCapture('Taxes 2026-09-01', { now: NOW });
    expect(ok.dueDateKey).toBe('2026-09-01');
    expect(ok.title).toBe('Taxes');

    const bad = parseQuickCapture('Taxes 2026-13-01', { now: NOW });
    expect(bad.dueDateKey).toBeNull();
    expect(bad.title).toBe('Taxes 2026-13-01');
  });

  it('does not treat random numbers as dates', () => {
    const r = parseQuickCapture('Buy 4 apples', { now: NOW });
    expect(r.dueDateKey).toBeNull();
    expect(r.title).toBe('Buy 4 apples');
  });
});

describe('parseQuickCapture — priority', () => {
  it('parses !urgent token', () => {
    const r = parseQuickCapture('Fix leak !urgent', { now: NOW });
    expect(r.priority).toBe('urgent');
    expect(r.title).toBe('Fix leak');
  });

  it('parses bare word "urgent"', () => {
    const r = parseQuickCapture('urgent call bank', { now: NOW });
    expect(r.priority).toBe('urgent');
    expect(r.title).toBe('call bank');
  });

  it('parses !low token', () => {
    const r = parseQuickCapture('Someday reorganize desk !low', { now: NOW });
    expect(r.priority).toBe('low');
    expect(r.title).toBe('Someday reorganize desk');
  });

  it('defaults to normal priority', () => {
    expect(parseQuickCapture('Plain task', { now: NOW }).priority).toBe('normal');
  });

  it('does not fire priority on words containing the token', () => {
    const r = parseQuickCapture('Urgently deliver package', { now: NOW });
    expect(r.priority).toBe('normal');
    expect(r.title).toBe('Urgently deliver package');
  });
});

describe('parseQuickCapture — project/goal mentions', () => {
  it('matches a leading #project mention case-insensitively', () => {
    const r = parseQuickCapture('#home renovation fix the sink', {
      projects: PROJECTS,
      goals: GOALS,
      now: NOW,
    });
    expect(r.projectId).toBe('p1');
    expect(r.matchedProjectName).toBe('Home Renovation');
    expect(r.title).toBe('fix the sink');
  });

  it('matches a prefix mention (#home → Home Renovation)', () => {
    const r = parseQuickCapture('#home paint wall', { projects: PROJECTS, goals: GOALS, now: NOW });
    expect(r.projectId).toBe('p1');
    expect(r.title).toBe('paint wall');
  });

  it('does not match a partial word (#hom ≠ Home)', () => {
    const r = parseQuickCapture('#homework finish essay', {
      projects: PROJECTS,
      goals: GOALS,
      now: NOW,
    });
    expect(r.projectId).toBeNull();
    expect(r.title).toBe('#homework finish essay');
  });

  it('matches a leading @goal mention', () => {
    const r = parseQuickCapture('@fitness run 5k', { projects: PROJECTS, goals: GOALS, now: NOW });
    expect(r.goalId).toBe('g2');
    expect(r.matchedGoalName).toBe('Fitness');
    expect(r.title).toBe('run 5k');
  });

  it('leaves unknown mentions in the title', () => {
    const r = parseQuickCapture('#unknown thing', { projects: PROJECTS, goals: GOALS, now: NOW });
    expect(r.projectId).toBeNull();
    expect(r.goalId).toBeNull();
    expect(r.title).toBe('#unknown thing');
  });

  it('combines mentions, priority and due date', () => {
    const r = parseQuickCapture('#work urgent ship release tomorrow', {
      projects: PROJECTS,
      goals: GOALS,
      now: NOW,
    });
    expect(r.projectId).toBe('p2');
    expect(r.priority).toBe('urgent');
    expect(r.dueDateKey).toBe('2026-08-21');
    expect(r.title).toBe('ship release');
  });
});

describe('recent captures undo list', () => {
  function entry(key: string, undo: () => Promise<void> = async () => {}): RecentCapture {
    return { key, label: `label ${key}`, undo };
  }

  it('keeps only the most recent captures, newest first', () => {
    let list: RecentCapture[] = [];
    for (let i = 1; i <= MAX_RECENT_CAPTURES + 2; i++) {
      list = pushRecentCapture(list, entry(`k${i}`));
    }
    expect(list).toHaveLength(MAX_RECENT_CAPTURES);
    expect(list.map((e) => e.key)).toEqual(['k7', 'k6', 'k5', 'k4', 'k3']);
  });

  it('removes an undone entry by key and leaves others intact', () => {
    const list = [entry('a'), entry('b'), entry('c')];
    expect(removeRecentCapture(list, 'b').map((e) => e.key)).toEqual(['a', 'c']);
  });

  it('runs the undo for a known key and reports it as removed', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const list = [entry('todo_1', undo)];
    await expect(undoRecentCapture(list, 'todo_1')).resolves.toEqual({ removed: true });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('propagates undo failures so the caller keeps the entry visible', async () => {
    const undo = vi.fn().mockRejectedValue(new Error('delete failed'));
    const list = [entry('habit_1', undo)];
    await expect(undoRecentCapture(list, 'habit_1')).rejects.toThrow('delete failed');
  });

  it('reports no removal for an unknown key without running any undo', async () => {
    const undo = vi.fn();
    await expect(undoRecentCapture([entry('a', undo)], 'missing')).resolves.toEqual({
      removed: false,
    });
    expect(undo).not.toHaveBeenCalled();
  });
});
