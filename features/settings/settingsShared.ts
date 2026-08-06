import type { SyncStatus } from '@/core/sync/sync.engine';
import type { CalorieGoal } from '@/features/calories/types';
import type { PomodoroSettings } from '@/features/pomodoro/pomodoro.domain';

export type SettingsStatusTone = 'neutral' | 'accent' | 'warning' | 'danger';

export type OutboxSummary = {
  description: string;
  statusLabel: string;
  statusTone: SettingsStatusTone;
};

export function describeOutboxStatus(pendingCount: number, status: SyncStatus): OutboxSummary {
  if (status.consecutiveFailures > 0) {
    const nextRetry = status.nextRetryAt ? new Date(status.nextRetryAt).toLocaleTimeString() : null;
    return {
      description:
        `${pendingCount} record${pendingCount === 1 ? '' : 's'} waiting to sync. ` +
        `Last attempt failed: ${status.lastErrorMessage ?? 'unknown error'}.` +
        (nextRetry ? ` Retrying after ${nextRetry}.` : ''),
      statusLabel: 'Failing',
      statusTone: 'danger',
    };
  }

  if (pendingCount > 0) {
    return {
      description: `${pendingCount} record${pendingCount === 1 ? '' : 's'} waiting to sync.`,
      statusLabel: 'Pending',
      statusTone: 'warning',
    };
  }

  if (status.lastSuccessAt) {
    return {
      description: `Up to date. Last synced ${new Date(status.lastSuccessAt).toLocaleString()}.`,
      statusLabel: 'Synced',
      statusTone: 'accent',
    };
  }

  return {
    description: 'No changes have been queued for backup yet on this device.',
    statusLabel: 'Idle',
    statusTone: 'neutral',
  };
}

export type PomodoroFormState = {
  focusMinutes: string;
  shortBreakMinutes: string;
  longBreakMinutes: string;
  sessionsBeforeLongBreak: string;
};

export function buildPomodoroForm(settings: PomodoroSettings): PomodoroFormState {
  return {
    focusMinutes: String(settings.focusMinutes),
    shortBreakMinutes: String(settings.shortBreakMinutes),
    longBreakMinutes: String(settings.longBreakMinutes),
    sessionsBeforeLongBreak: String(settings.sessionsBeforeLongBreak),
  };
}

export function formatPomodoroSummary(settings: PomodoroSettings) {
  return `${settings.focusMinutes}m focus, ${settings.shortBreakMinutes}m short break, ${settings.longBreakMinutes}m long break, long break every ${settings.sessionsBeforeLongBreak} focus sessions.`;
}

export type CalorieGoalFormState = {
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
};

export function buildCalorieGoalForm(goal: CalorieGoal): CalorieGoalFormState {
  return {
    calories: String(goal.calories),
    protein: String(goal.protein),
    carbs: String(goal.carbs),
    fats: String(goal.fats),
  };
}

export function formatCalorieGoalSummary(goal: CalorieGoal) {
  return `${goal.calories} kcal, ${goal.protein}g protein, ${goal.carbs}g carbs, ${goal.fats}g fats.`;
}
