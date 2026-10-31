// SYNTHETIC only: the real JS adapter/startup run against mocked Expo methods.
// This does not inject a rejection into an installed Android/iOS native module.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/features/pomodoro/pomodoro.domain';
import {
  planTimerStartup,
  runTimerStartup,
  type TimerStartupEffects,
} from '@/features/pomodoro/pomodoro.startup';
import { cancelScheduledNotification, scheduleTimerEndNotification } from '@/lib/notifications';

const native = vi.hoisted(() => ({
  channel: vi.fn(),
  permissions: vi.fn(),
  request: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  platform: { OS: 'android' },
}));
vi.mock('react-native', () => ({ Platform: native.platform }));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: native.channel,
  getPermissionsAsync: native.permissions,
  requestPermissionsAsync: native.request,
  scheduleNotificationAsync: native.schedule,
  cancelScheduledNotificationAsync: native.cancel,
  AndroidImportance: { HIGH: 5 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const plan = planTimerStartup(
  {},
  { mode: 'focus', settings: DEFAULT_SETTINGS, completedFocus: 0 },
  new Date('2026-10-23T10:00:00Z'),
);
function effects(): TimerStartupEffects {
  return {
    cancelPreviousNotification: vi.fn(),
    commit: vi.fn(),
    recover: vi.fn(),
    reportScheduleWarning: vi.fn(),
  };
}
const environment = {
  scheduleTimerEndNotification,
  cancelScheduledNotification,
  platform: 'native' as const,
};

beforeEach(() => {
  vi.resetAllMocks();
  native.platform.OS = 'android';
  native.channel.mockResolvedValue(undefined);
  native.permissions.mockResolvedValue({ granted: true });
  native.schedule.mockResolvedValue('expo-native-id');
  native.cancel.mockResolvedValue(undefined);
});

describe('Pomodoro native scheduling adapter (synthetic Expo boundary)', () => {
  it('commits a successful scheduler ID after creating the Android channel', async () => {
    const state = effects();
    const result = await runTimerStartup(plan, environment, state);
    expect(result.outcome).toBe('started');
    expect(native.channel).toHaveBeenCalledWith('default', { name: 'General', importance: 5 });
    expect(native.schedule).toHaveBeenCalledWith({
      content: plan.notificationCopy,
      trigger: { type: 'timeInterval', seconds: plan.durationSeconds },
    });
    expect(state.commit).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: 'expo-native-id' }),
    );
    expect(state.recover).not.toHaveBeenCalled();
  });

  it('propagates schedule rejection into recovery and accepts a later start', async () => {
    native.schedule.mockRejectedValueOnce(new Error('native scheduler rejected'));
    const first = effects();
    expect(await runTimerStartup(plan, environment, first)).toMatchObject({
      outcome: 'failed',
      message: 'native scheduler rejected',
    });
    expect(first.recover).toHaveBeenCalledOnce();
    expect(first.commit).not.toHaveBeenCalled();
    expect(native.cancel).not.toHaveBeenCalled(); // No returned ID belongs to the failed attempt.
    const second = effects();
    expect((await runTimerStartup(plan, environment, second)).outcome).toBe('started');
    expect(second.commit).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: 'expo-native-id' }),
    );
  });

  it('keeps denied permission as warning-success without calling the scheduler', async () => {
    native.permissions.mockResolvedValue({ granted: false });
    native.request.mockResolvedValue({ granted: false });
    const state = effects();
    expect((await runTimerStartup(plan, environment, state)).outcome).toBe('started');
    expect(native.schedule).not.toHaveBeenCalled();
    expect(state.reportScheduleWarning).toHaveBeenCalledWith({
      kind: 'permission-denied',
      notificationId: null,
      warning: 'notification',
    });
    expect(state.commit).toHaveBeenCalledWith(expect.objectContaining({ notificationId: null }));
  });

  it('classifies an empty returned ID as warning-success, not a proven schedule', async () => {
    native.schedule.mockResolvedValue('');
    const state = effects();
    expect((await runTimerStartup(plan, environment, state)).outcome).toBe('started');
    expect(state.commit).toHaveBeenCalledWith(expect.objectContaining({ notificationId: null }));
    expect(state.reportScheduleWarning).toHaveBeenCalledOnce();
  });

  it('suppresses a native cancellation rejection for an invalid or already-fired ID', async () => {
    native.cancel.mockRejectedValue(new Error('unknown identifier'));
    await expect(cancelScheduledNotification('invalid-id')).resolves.toBeUndefined();
    expect(native.cancel).toHaveBeenCalledWith('invalid-id');
  });

  it('does not call native permission or scheduling methods on web', async () => {
    native.platform.OS = 'web';
    await expect(scheduleTimerEndNotification(60, 'Focus', 'Done')).resolves.toBeNull();
    expect(native.permissions).not.toHaveBeenCalled();
    expect(native.schedule).not.toHaveBeenCalled();
  });
});
