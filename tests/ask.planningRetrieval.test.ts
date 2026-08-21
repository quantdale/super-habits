import { describe, expect, it } from 'vitest';
import {
  formatGoalProgressAnswer,
  formatProjectStatusAnswer,
  formatTodayFocusAnswer,
} from '@/features/command/planningAsk.domain';

describe('features/command/planningAsk.domain formatters', () => {
  it('formats a single project status answer', () => {
    const answer = formatProjectStatusAnswer({
      scope: 'single',
      projects: [{ name: 'Apollo', status: 'active', targetDate: '2026-05-01', openTodoCount: 2 }],
    });
    expect(answer).toBe('Apollo is active with 2 open Todos. Target date is 2026-05-01.');
  });

  it('formats an overall project list answer', () => {
    const answer = formatProjectStatusAnswer({
      scope: 'overall',
      projects: [
        { name: 'Apollo', status: 'active', targetDate: null, openTodoCount: 1 },
        { name: 'Zen', status: 'paused', targetDate: null, openTodoCount: 0 },
      ],
    });
    expect(answer).toBe('Apollo: active, 1 open Todo; Zen: paused, 0 open Todos');
  });

  it('handles the empty project list', () => {
    expect(formatProjectStatusAnswer({ scope: 'overall', projects: [] })).toBe(
      'No active Projects were found.',
    );
  });

  it('formats a single goal progress answer', () => {
    expect(
      formatGoalProgressAnswer({
        scope: 'single',
        goals: [{ title: 'Read more', progressPercent: 50, status: 'active' }],
      }),
    ).toBe('Read more: 50% complete (active).');
  });

  it('formats an overall goal progress answer', () => {
    expect(
      formatGoalProgressAnswer({
        scope: 'overall',
        goals: [
          { title: 'Read more', progressPercent: 50, status: 'active' },
          { title: 'Run 5k', progressPercent: 10, status: 'active' },
        ],
      }),
    ).toBe('Read more: 50%; Run 5k: 10%');
  });

  it('formats a today focus answer with plan context', () => {
    const answer = formatTodayFocusAnswer({
      dateKey: '2026-04-21',
      planIntention: 'Deep work',
      topTodos: [{ title: 'Buy groceries', completed: false }],
      pendingTodoCount: 3,
      habitsRemainingCount: null,
    });
    expect(answer).toBe(
      'Intention: Deep work. Top priorities: Buy groceries. 3 pending Todos today.',
    );
  });

  it('falls back when no plan exists', () => {
    const answer = formatTodayFocusAnswer({
      dateKey: '2026-04-21',
      planIntention: null,
      topTodos: [],
      pendingTodoCount: 1,
      habitsRemainingCount: null,
    });
    expect(answer).toContain('No top priorities are set for today yet.');
    expect(answer).toContain('1 pending Todo today.');
  });
});
