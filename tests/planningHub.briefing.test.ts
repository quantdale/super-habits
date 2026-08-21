import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTodayBriefing } from '@/features/planning-hub/planningHub.briefing';
import type { PomodoroSession } from '@/core/db/types';

const { listPomodoroSessionsForDateRange } = vi.hoisted(() => ({
  listPomodoroSessionsForDateRange: vi.fn(),
}));

vi.mock('@/features/todos/todos.data', () => ({
  listTodos: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/pomodoro/pomodoro.data', () => ({
  listPomodoroSessionsForDateRange,
}));

vi.mock('@/features/projects/projects.data', () => ({
  countActiveProjects: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/features/goals/goals.data', () => ({
  countActiveGoals: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/features/daily-plan/dailyPlan.data', () => ({
  getDailyPlan: vi.fn().mockResolvedValue(null),
}));

function session(input: {
  durationSeconds: number;
  sessionType: PomodoroSession['session_type'];
}): PomodoroSession {
  return {
    id: `pom_${input.sessionType}_${input.durationSeconds}`,
    started_at: '2026-04-15T10:00:00.000Z',
    ended_at: '2026-04-15T10:25:00.000Z',
    duration_seconds: input.durationSeconds,
    session_type: input.sessionType,
    created_at: '2026-04-15T10:00:00.000Z',
  };
}

describe('buildTodayBriefing — yesterdayFocusMinutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts only focus-type sessions toward yesterday focus minutes', async () => {
    listPomodoroSessionsForDateRange.mockResolvedValue([
      session({ durationSeconds: 1500, sessionType: 'focus' }),
      // Break rows must never inflate the focus figure.
      session({ durationSeconds: 300, sessionType: 'short_break' }),
      session({ durationSeconds: 900, sessionType: 'long_break' }),
      session({ durationSeconds: 3600, sessionType: 'break' }), // legacy type
    ]);

    const briefing = await buildTodayBriefing('2026-04-16');
    expect(briefing.yesterdayFocusMinutes).toBe(25);
    expect(listPomodoroSessionsForDateRange).toHaveBeenCalledWith('2026-04-15', '2026-04-15');
  });

  it('rounds partial minutes down to the nearest minute', async () => {
    listPomodoroSessionsForDateRange.mockResolvedValue([
      session({ durationSeconds: 90, sessionType: 'focus' }),
      session({ durationSeconds: 90, sessionType: 'focus' }),
    ]);

    const briefing = await buildTodayBriefing('2026-04-16');
    expect(briefing.yesterdayFocusMinutes).toBe(3); // 180s → 3m
  });

  it('reports zero when nothing was logged yesterday', async () => {
    listPomodoroSessionsForDateRange.mockResolvedValue([]);

    const briefing = await buildTodayBriefing('2026-04-16');
    expect(briefing.yesterdayFocusMinutes).toBe(0);
  });
});
