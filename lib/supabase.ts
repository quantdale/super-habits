import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type RemoteMode = "disabled" | "enabled";

let remoteMode: RemoteMode = "enabled";

export function setRemoteMode(mode: RemoteMode) {
  remoteMode = mode;
}

export function isRemoteEnabled() {
  return remoteMode === "enabled";
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const isBrowser = typeof window !== "undefined";

/** AsyncStorage touches `window` internally; avoid it during Expo static web export / SSR. */
const ssrSafeStorage = {
  getItem: (_key: string) => Promise.resolve<string | null>(null),
  setItem: (_key: string, _value: string) => Promise.resolve(),
  removeItem: (_key: string) => Promise.resolve(),
};

/** `createClient` throws if the URL is empty — skip on CI/Vercel when env vars are unset. */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: (isBrowser ? AsyncStorage : ssrSafeStorage) as typeof AsyncStorage,
        autoRefreshToken: isBrowser,
        persistSession: isBrowser,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Ensures a Supabase auth session exists, creating an anonymous session when none is present.
 * No-ops when Supabase env is not configured (missing URL or anon key).
 */
export async function ensureAnonymousSession(): Promise<void> {
  if (!supabase) {
    return;
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (session) {
    return;
  }

  const { error: signInError } = await supabase.auth.signInAnonymously();

  if (signInError) {
    const msg = signInError.message ?? "";
    if (
      /anonymous|disabled/i.test(msg) ||
      (signInError as { status?: number }).status === 422
    ) {
      return;
    }
    throw signInError;
  }
}
