import { describe, expect, it } from 'vitest';
import {
  computeProjectProgress,
  computeTargetDateCountdown,
  daysUntilDate,
  filterProjectRows,
  sortProjectRows,
  type ProjectListRow,
} from '@/features/projects/projects.domain';
import type { Project } from '@/core/db/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_1',
    name: 'Test Project',
    description: null,
    color: '#3B82F6',
    status: 'active',
    target_date: null,
    completed_at: null,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function makeRow(overrides: {
  project?: Partial<Project>;
  progressPercent?: number;
}): ProjectListRow {
  return {
    project: makeProject(overrides.project),
    progressPercent: overrides.progressPercent ?? 0,
    linkedCounts: { todos: 0, goals: 0, habits: 0 },
  };
}

describe('computeProjectProgress', () => {
  it('returns isEmpty with percent 0 when no linked entities exist', () => {
    const result = computeProjectProgress({
      todos: { total: 0, done: 0 },
      goals: { count: 0, averageProgressPercent: 0 },
      habits: { habitCount: 0, recentCompletions: 0, windowDays: 30 },
    });
    expect(result.isEmpty).toBe(true);
    expect(result.percent).toBe(0);
    expect(result.todoRatio).toBeNull();
    expect(result.goalRatio).toBeNull();
    expect(result.habitRatio).toBeNull();
  });

  it('computes todo completion ratio alone', () => {
    const result = computeProjectProgress({
      todos: { total: 4, done: 1 },
      goals: { count: 0, averageProgressPercent: 0 },
      habits: { habitCount: 0, recentCompletions: 0, windowDays: 30 },
    });
    expect(result.todoRatio).toBeCloseTo(0.25);
    expect(result.percent).toBe(25);
  });

  it('averages available sources without counting empty ones as zero', () => {
    // todo 50%, goal avg 100% → mean 75%; no habits.
    const result = computeProjectProgress({
      todos: { total: 2, done: 1 },
      goals: { count: 2, averageProgressPercent: 100 },
      habits: { habitCount: 0, recentCompletions: 0, windowDays: 30 },
    });
    expect(result.percent).toBe(75);
  });

  it('caps habit ratio at 1 (over-completion cannot exceed 100%)', () => {
    const result = computeProjectProgress({
      todos: { total: 0, done: 0 },
      goals: { count: 0, averageProgressPercent: 0 },
      habits: { habitCount: 1, recentCompletions: 90, windowDays: 30 },
    });
    expect(result.habitRatio).toBe(1);
    expect(result.percent).toBe(100);
  });

  it('computes habit consistency as completions over expected slots', () => {
    const result = computeProjectProgress({
      todos: { total: 0, done: 0 },
      goals: { count: 0, averageProgressPercent: 0 },
      habits: { habitCount: 2, recentCompletions: 30, windowDays: 30 },
    });
    expect(result.habitRatio).toBeCloseTo(0.5);
    expect(result.percent).toBe(50);
  });

  it('clamps goal average progress into 0–100', () => {
    const result = computeProjectProgress({
      todos: { total: 0, done: 0 },
      goals: { count: 1, averageProgressPercent: 150 },
      habits: { habitCount: 0, recentCompletions: 0, windowDays: 30 },
    });
    expect(result.goalRatio).toBe(1);
    expect(result.percent).toBe(100);
  });
});

describe('daysUntilDate / computeTargetDateCountdown', () => {
  it('computes positive day difference on local calendar', () => {
    expect(daysUntilDate('2026-03-02', '2026-03-01')).toBe(1);
    expect(daysUntilDate('2026-01-01', '2025-12-31')).toBe(1);
  });

  it('computes negative day difference for overdue dates', () => {
    expect(daysUntilDate('2026-02-28', '2026-03-01')).toBe(-1);
  });

  it('returns null countdown for missing or invalid target date', () => {
    expect(computeTargetDateCountdown(null, '2026-08-20')).toBeNull();
    expect(computeTargetDateCountdown('', '2026-08-20')).toBeNull();
    expect(computeTargetDateCountdown('2026-13-40', '2026-08-20')).toBeNull();
  });

  it('labels today, remaining, and overdue states', () => {
    expect(computeTargetDateCountdown('2026-08-20', '2026-08-20')?.label).toBe('Due today');
    expect(computeTargetDateCountdown('2026-08-22', '2026-08-20')?.label).toBe('2 days remaining');
    expect(computeTargetDateCountdown('2026-08-19', '2026-08-20')?.label).toBe('1 day overdue');
    expect(computeTargetDateCountdown('2026-08-19', '2026-08-20')?.isOverdue).toBe(true);
  });
});

describe('filterProjectRows / sortProjectRows', () => {
  const rows = [
    makeRow({ project: { id: 'a', status: 'active' }, progressPercent: 10 }),
    makeRow({ project: { id: 'b', status: 'completed' }, progressPercent: 90 }),
    makeRow({ project: { id: 'c', status: 'active' }, progressPercent: 50 }),
  ];

  it('filters by status and passes all through unchanged', () => {
    expect(filterProjectRows(rows, 'all')).toHaveLength(3);
    expect(filterProjectRows(rows, 'active').map((r) => r.project.id)).toEqual(['a', 'c']);
    expect(filterProjectRows(rows, 'completed').map((r) => r.project.id)).toEqual(['b']);
  });

  it('sorts by progress descending', () => {
    expect(sortProjectRows(rows, 'progress').map((r) => r.project.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by target date ascending with undated last', () => {
    const dated = [
      makeRow({ project: { id: 'x', target_date: '2026-10-01' } }),
      makeRow({ project: { id: 'y', target_date: null } }),
      makeRow({ project: { id: 'z', target_date: '2026-05-01' } }),
    ];
    expect(sortProjectRows(dated, 'target_date').map((r) => r.project.id)).toEqual(['z', 'x', 'y']);
  });

  it('sorts by name and preserves manual order for the manual key', () => {
    const named = [
      makeRow({ project: { id: '1', name: 'Beta' } }),
      makeRow({ project: { id: '2', name: 'Alpha' } }),
    ];
    expect(sortProjectRows(named, 'name').map((r) => r.project.name)).toEqual(['Alpha', 'Beta']);
    expect(sortProjectRows(named, 'manual').map((r) => r.project.id)).toEqual(['1', '2']);
  });
});
