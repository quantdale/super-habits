import { describe, expect, it } from 'vitest';
import {
  resolveAuthRuntime,
  resolveSupabaseAuthOptions,
  ssrSafeStorage,
  type ResolvedSupabaseAuthOptions,
  type SupabaseAuthRuntime,
} from '@/lib/supabaseAuthOptions';

/**
 * Regression guard for the native Auth storage bug: storage selection must be
 * platform-first. The old logic (`typeof window !== 'undefined'` first) picked
 * browser storage on any React Native runtime where a `window` global exists,
 * silently dropping AsyncStorage session persistence.
 */
const asyncStorageStub = {
  getItem: async (): Promise<string | null> => null,
  setItem: async (): Promise<void> => undefined,
  removeItem: async (): Promise<void> => undefined,
};

describe('resolveAuthRuntime is platform-first', () => {
  it('classifies android as native even when a window global exists', () => {
    // Old window-first logic would return 'browser' here and lose persistence.
    expect(resolveAuthRuntime('android', true)).toBe('native');
  });

  it('classifies ios as native even when a window global exists', () => {
    expect(resolveAuthRuntime('ios', true)).toBe('native');
  });

  it('classifies any other non-web platform as native', () => {
    expect(resolveAuthRuntime('windows', true)).toBe('native');
    expect(resolveAuthRuntime('macos', false)).toBe('native');
  });

  it('classifies web with a window global as browser', () => {
    expect(resolveAuthRuntime('web', true)).toBe('browser');
  });

  it('classifies web without a window global as ssr (static export)', () => {
    expect(resolveAuthRuntime('web', false)).toBe('ssr');
  });
});

describe('resolveSupabaseAuthOptions per runtime', () => {
  const optionsFor = (platformOs: string, hasWindow: boolean): ResolvedSupabaseAuthOptions =>
    resolveSupabaseAuthOptions(resolveAuthRuntime(platformOs, hasWindow), asyncStorageStub);

  it('supplies the native storage adapter on android', () => {
    const options = optionsFor('android', true);
    expect(options.storage).toBe(asyncStorageStub);
    expect(options.autoRefreshToken).toBe(true);
    expect(options.persistSession).toBe(true);
    expect(options.detectSessionInUrl).toBe(false);
  });

  it('supplies the native storage adapter on ios', () => {
    const options = optionsFor('ios', true);
    expect(options.storage).toBe(asyncStorageStub);
    expect(options.autoRefreshToken).toBe(true);
    expect(options.persistSession).toBe(true);
    expect(options.detectSessionInUrl).toBe(false);
  });

  it('keeps browser default storage on web browsers (no AsyncStorage override)', () => {
    const options = optionsFor('web', true);
    expect(options.storage).toBeUndefined();
    expect(options.autoRefreshToken).toBe(true);
    expect(options.persistSession).toBe(true);
    expect(options.detectSessionInUrl).toBe(false);
  });

  it('uses an SSR-safe no-op storage on the static export / SSR build', () => {
    const options = optionsFor('web', false);
    expect(options.storage).toBe(ssrSafeStorage);
    expect(options.autoRefreshToken).toBe(false);
    expect(options.persistSession).toBe(false);
    expect(options.detectSessionInUrl).toBe(false);
  });
});

describe('runtime resolution never selects browser on native', () => {
  const runtimes: SupabaseAuthRuntime[] = ['browser', 'ssr', 'native'];

  it('maps every native platform to the native runtime', () => {
    for (const hasWindow of [true, false]) {
      for (const platform of ['android', 'ios', 'windows', 'macos']) {
        expect(resolveAuthRuntime(platform, hasWindow)).toBe('native');
      }
    }
  });

  it('only maps web to browser/ssr', () => {
    expect(resolveAuthRuntime('web', true)).toBe('browser');
    expect(resolveAuthRuntime('web', false)).toBe('ssr');
  });

  it('provides storage exactly when the runtime is native or ssr', () => {
    const native = resolveSupabaseAuthOptions('native', asyncStorageStub);
    const ssr = resolveSupabaseAuthOptions('ssr', asyncStorageStub);
    const browser = resolveSupabaseAuthOptions('browser', asyncStorageStub);
    expect(native.storage).toBeDefined();
    expect(ssr.storage).toBeDefined();
    expect(browser.storage).toBeUndefined();
  });

  it('disables persistence only for the SSR runtime', () => {
    const expected: Record<
      SupabaseAuthRuntime,
      { autoRefreshToken: boolean; persistSession: boolean }
    > = {
      native: { autoRefreshToken: true, persistSession: true },
      browser: { autoRefreshToken: true, persistSession: true },
      ssr: { autoRefreshToken: false, persistSession: false },
    };
    for (const runtime of runtimes) {
      const options = resolveSupabaseAuthOptions(runtime, asyncStorageStub);
      expect(options.autoRefreshToken).toBe(expected[runtime].autoRefreshToken);
      expect(options.persistSession).toBe(expected[runtime].persistSession);
    }
  });
});
