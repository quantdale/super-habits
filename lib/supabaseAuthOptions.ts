import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * Pure, testable Supabase auth storage selection.
 *
 * Platform is the PRIMARY discriminator: any non-web runtime is `native` and
 * must use durable native storage (AsyncStorage), regardless of whether a
 * `window` global happens to exist. The browser-window check applies ONLY
 * inside the web platform, to separate an in-browser session from the Expo
 * static export / SSR build where neither `window` nor `localStorage` exists.
 */
export type SupabaseAuthRuntime = 'browser' | 'ssr' | 'native';

export type ResolvedSupabaseAuthOptions = {
  storage?: SupportedStorage;
  autoRefreshToken: boolean;
  persistSession: boolean;
  detectSessionInUrl: boolean;
};

/** No-op storage used only for the static web export / SSR where no durable
 * browser or native storage exists. Sessions are intentionally not persisted. */
export const ssrSafeStorage: SupportedStorage = {
  getItem: (_key: string) => Promise.resolve<string | null>(null),
  setItem: (_key: string, _value: string) => Promise.resolve(),
  removeItem: (_key: string) => Promise.resolve(),
};

export function resolveAuthRuntime(platformOs: string, hasWindow: boolean): SupabaseAuthRuntime {
  if (platformOs === 'web') {
    return hasWindow ? 'browser' : 'ssr';
  }
  return 'native';
}

export function resolveSupabaseAuthOptions(
  runtime: SupabaseAuthRuntime,
  nativeStorage: SupportedStorage,
): ResolvedSupabaseAuthOptions {
  switch (runtime) {
    case 'browser':
      // Browser default storage (localStorage) is used deliberately; no
      // AsyncStorage override can leak into the browser build.
      return {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      };
    case 'native':
      return {
        storage: nativeStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      };
    case 'ssr':
      return {
        storage: ssrSafeStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      };
  }
}
