import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Motion preference contract (Settings → Accessibility): the singleton
 * persists, reports, and — per the F-05 precedence rule — never lets an
 * in-flight AsyncStorage hydration overwrite a newer explicit choice.
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

type MotionModule = typeof import('@/core/theme/motion');

async function loadMotion(): Promise<MotionModule> {
  vi.resetModules();
  return await import('@/core/theme/motion');
}

describe('motion preference', () => {
  beforeEach(() => {
    storage.store.clear();
    storage.deferNextGet(false);
    vi.clearAllMocks();
  });

  afterEach(() => {
    storage.deferNextGet(false);
  });

  it('defaults to system and applies explicit choices immediately', async () => {
    const motion = await loadMotion();

    expect(motion.getMotionPreference()).toBe('system');

    motion.setMotionPreference('full');
    expect(motion.getMotionPreference()).toBe('full');
    expect(storage.store.get('superhabits.motionPreference')).toBe('full');

    motion.setMotionPreference('reduced');
    expect(motion.getMotionPreference()).toBe('reduced');
  });

  it('applies a valid persisted value when no user choice was made', async () => {
    storage.store.set('superhabits.motionPreference', 'reduced');
    const motion = await loadMotion();

    motion.hydrateMotionPreference();
    await vi.waitFor(() => expect(motion.getMotionPreference()).toBe('reduced'));
  });

  it('never lets a late hydration overwrite a newer explicit choice', async () => {
    storage.deferNextGet();
    const motion = await loadMotion();

    motion.hydrateMotionPreference();
    motion.setMotionPreference('full');
    storage.resolvePendingGet('reduced');
    await Promise.resolve();
    await Promise.resolve();

    expect(motion.getMotionPreference()).toBe('full');
  });

  it('ignores invalid persisted values', async () => {
    storage.store.set('superhabits.motionPreference', 'ludicrous-speed');
    const motion = await loadMotion();

    motion.hydrateMotionPreference();
    await Promise.resolve();
    await Promise.resolve();

    expect(motion.getMotionPreference()).toBe('system');
  });
});
