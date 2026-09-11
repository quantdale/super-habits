import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';

/**
 * Reward feedback contract: which native calls a tier makes, and how the two
 * persisted preferences gate them. The F-05 precedence rule (a late hydration
 * never overwrites an explicit choice) is asserted here as well because the
 * preferences live behind the same singleton pattern as the motion preference.
 */

const storage = vi.hoisted(() => {
  const store = new Map<string, string>();
  let pendingGet: ((value: string | null) => void) | null = null;
  let deferNextGet = false;
  return {
    store,
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: vi.fn(async (key: string) => {
      if (!deferNextGet) return store.get(key) ?? null;
      deferNextGet = false;
      return new Promise<string | null>((resolve) => {
        pendingGet = (value) => {
          if (value !== null) store.set(key, value);
          resolve(value);
        };
      });
    }),
    deferNextGet(next = true) {
      deferNextGet = next;
    },
    resolvePendingGet(value: string | null) {
      if (!pendingGet) throw new Error('no deferred getItem is pending');
      const resolve = pendingGet;
      pendingGet = null;
      resolve(value);
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

type FeedbackModule = typeof import('@/lib/rewardFeedback');

const STORAGE_KEY = 'superhabits.rewardFeedback';

async function freshModule(): Promise<FeedbackModule> {
  vi.resetModules();
  storage.store.clear();
  vi.clearAllMocks();
  return import('@/lib/rewardFeedback');
}

async function flushHydration(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reward feedback preferences', () => {
  it('defaults to haptics + sound on and applies a persisted choice', async () => {
    const feedback = await freshModule();
    storage.store.set(STORAGE_KEY, JSON.stringify({ haptics: false, sound: true }));

    expect(feedback.getRewardFeedbackPreferences()).toEqual({ haptics: true, sound: true });
    feedback.hydrateRewardFeedbackPreferences();
    await flushHydration();
    expect(feedback.getRewardFeedbackPreferences()).toEqual({ haptics: false, sound: true });
  });

  it('ignores a corrupt persisted payload', async () => {
    const feedback = await freshModule();
    storage.store.set(STORAGE_KEY, 'not json');
    feedback.hydrateRewardFeedbackPreferences();
    await flushHydration();
    expect(feedback.getRewardFeedbackPreferences()).toEqual({ haptics: true, sound: true });
  });

  it('never lets a late hydration overwrite an explicit choice (F-05)', async () => {
    const feedback = await freshModule();
    storage.deferNextGet();
    feedback.hydrateRewardFeedbackPreferences();
    feedback.setRewardFeedbackPreferences({ sound: false });
    storage.resolvePendingGet(JSON.stringify({ haptics: true, sound: true }));
    await flushHydration();

    expect(feedback.getRewardFeedbackPreferences().sound).toBe(false);
  });

  it('persists a change for the next cold start', async () => {
    const feedback = await freshModule();
    feedback.setRewardFeedbackPreferences({ haptics: false });
    await flushHydration();
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify({ haptics: false, sound: true }),
    );
  });
});

describe('emitRewardFeedback', () => {
  it('keeps a routine check-off soundless and gentle', async () => {
    const feedback = await freshModule();
    feedback.emitRewardFeedback('light');

    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('plays the success chime for a completed quest', async () => {
    const feedback = await freshModule();
    feedback.emitRewardFeedback('success');

    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
  });

  it('reuses one player per tier instead of spawning a new one per reward', async () => {
    const feedback = await freshModule();
    feedback.emitRewardFeedback('milestone');
    feedback.emitRewardFeedback('milestone');

    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
  });

  it('respects a disabled preference', async () => {
    const feedback = await freshModule();
    feedback.setRewardFeedbackPreferences({ haptics: false, sound: false });

    feedback.emitRewardFeedback('milestone');

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('survives a platform without a haptic engine or audio playback', async () => {
    const feedback = await freshModule();
    vi.mocked(Haptics.impactAsync).mockRejectedValueOnce(new Error('no haptics'));
    vi.mocked(createAudioPlayer).mockImplementationOnce(() => {
      throw new Error('no audio');
    });

    expect(() => feedback.emitRewardFeedback('milestone')).not.toThrow();
  });
});
