import { describe, expect, it } from 'vitest';
import {
  computeFocusStats,
  getAbandonNotice,
} from '@/features/pomodoro/pomodoro.domain';
import type { PomodoroSession } from '@/core/db/types';

function session(input: {
  startedAt: Date;
  durationSeconds?: number;
  sessionType?: PomodoroSession['session_type'];
}): PomodoroSession {
  return {
    id: `pom_${input.startedAt.getTime()}_${input.sessionType ?? 'focus'}`,
    started_at: input.startedAt.toISOString(),
    ended_at: input.startedAt.toISOString(),
    duration_seconds: input.durationSeconds ?? 1500,
    session_type: input.sessionType ?? 'focus',
    created_at: input.startedAt.toISOString(),
  };
}

// Wednesday, 2026-01-14 local noon — stable reference "today".
const TODAY = new Date(2026, 0, 14, 12, 0, 0, 0);

function daysAgo(n: number, hour = 10): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe('computeFocusStats', () => {
  it('returns zeros and no best day when there are no sessions', () => {
    expect(computeFocusStats([], TODAY)).toEqual({
      todayMinutes: 0,
      todaySessions: 0,
      weekMinutes: 0,
      weekSessions: 0,
      thirtyDayMinutes: 0,
      thirtyDaySessions: 0,
      bestDay: null,
    });
  });

  it('counts only focus-type sessions toward minutes', () => {
    const stats = computeFocusStats(
      [
        session({ startedAt: daysAgo(0), durationSeconds: 1500 }),
        session({ startedAt: daysAgo(0), durationSeconds: 300, sessionType: 'short_break' }),
        session({ startedAt: daysAgo(0), durationSeconds: 900, sessionType: 'long_break' }),
      ],
      TODAY,
    );
    expect(stats.todaySessions).toBe(1);
    expect(stats.todayMinutes).toBe(25);
  });

  it('treats legacy "break" rows as non-focus', () => {
    const stats = computeFocusStats(
      [session({ startedAt: daysAgo(0), durationSeconds: 1500, sessionType: 'break' })],
      TODAY,
    );
    expect(stats.todaySessions).toBe(0);
    expect(stats.todayMinutes).toBe(0);
  });

  it('windows today/week/30-day correctly across local midnight boundaries', () => {
    const stats = computeFocusStats(
      [
        session({ startedAt: daysAgo(0), durationSeconds: 1500 }),
        session({ startedAt: daysAgo(6), durationSeconds: 1200 }),
        session({ startedAt: daysAgo(7), durationSeconds: 1800 }),
        session({ startedAt: daysAgo(29), durationSeconds: 600 }),
        session({ startedAt: daysAgo(30), durationSeconds: 3600 }),
      ],
      TODAY,
    );
    expect(stats.todaySessions).toBe(1);
    expect(stats.weekSessions).toBe(2); // day 7 falls outside the 7-day window
    expect(stats.thirtyDaySessions).toBe(4); // day 30 falls outside the 30-day window
    expect(stats.thirtyDayMinutes).toBe(25 + 20 + 30 + 10);
  });

  it('picks the best day by minutes within the 30-day window', () => {
    const stats = computeFocusStats(
      [
        session({ startedAt: daysAgo(0), durationSeconds: 1500 }),
        session({ startedAt: daysAgo(5), durationSeconds: 1500 }),
        session({ startedAt: daysAgo(5), durationSeconds: 1500 }),
        session({ startedAt: daysAgo(5), durationSeconds: 900 }),
      ],
      TODAY,
    );
    expect(stats.bestDay).toEqual({
      dateKey: '2026-01-09',
      minutes: 25 + 25 + 15,
    });
  });

  it('ignores pre-window days when choosing bestDay even with huge minutes', () => {
    const stats = computeFocusStats(
      [
        session({ startedAt: daysAgo(0), durationSeconds: 600 }),
        session({ startedAt: daysAgo(90), durationSeconds: 36000 }),
      ],
      TODAY,
    );
    expect(stats.bestDay?.minutes).toBe(10);
  });
});

describe('getAbandonNotice', () => {
  it('returns null when idle', () => {
    expect(
      getAbandonNotice({ mode: 'focus', phase: 'idle', remaining: 1500, totalSeconds: 1500 }),
    ).toBeNull();
  });

  it('returns null when nothing has elapsed yet', () => {
    expect(
      getAbandonNotice({ mode: 'focus', phase: 'running', remaining: 1500, totalSeconds: 1500 }),
    ).toBeNull();
  });

  it('explains that an interrupted focus is never logged', () => {
    const notice = getAbandonNotice({
      mode: 'focus',
      phase: 'running',
      remaining: 1500 - 19 * 60,
      totalSeconds: 1500,
    });
    expect(notice?.title).toBe('Abandon this focus?');
    expect(notice?.body).toContain('19 minutes');
    expect(notifyBody(notice)).toContain('never logged');
  });

  it('uses discard wording for a paused focus', () => {
    const notice = getAbandonNotice({
      mode: 'focus',
      phase: 'paused',
      remaining: 600,
      totalSeconds: 1500,
    });
    expect(notice?.title).toBe('Discard paused focus?');
  });

  it('clarifies breaks are not logged and streaks are unaffected', () => {
    const notice = getAbandonNotice({
      mode: 'short_break',
      phase: 'running',
      remaining: 120,
      totalSeconds: 300,
    });
    expect(notice?.body).toContain('not logged');
    expect(notice?.body).toContain('streak');
  });
});

function notifyBody(notice: { title: string; body: string } | null): string {
  return notice ? notice.title + ' ' + notice.body : '';
}
