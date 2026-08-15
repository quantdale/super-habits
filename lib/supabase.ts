import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { resolveAuthRuntime, resolveSupabaseAuthOptions } from '@/lib/supabaseAuthOptions';

export type RemoteMode = 'disabled' | 'enabled';

let remoteMode: RemoteMode = 'enabled';

export function setRemoteMode(mode: RemoteMode) {
  remoteMode = mode;
}

export function isRemoteEnabled() {
  return remoteMode === 'enabled';
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Platform-first auth storage selection: the platform abstraction decides
 * native vs web; the browser-window check only distinguishes in-browser web
 * from the static export / SSR build. React Native always receives durable
 * AsyncStorage session persistence, even in runtimes where a `window` global
 * happens to exist.
 */
const authOptions = resolveSupabaseAuthOptions(
  resolveAuthRuntime(Platform.OS, typeof window !== 'undefined'),
  AsyncStorage,
);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: authOptions })
  : null;

export function isSupabaseConfigured() {
  return supabaseConfigured;
}

export function getSupabaseFunctionUrl(functionName: string): string | null {
  if (!supabaseConfigured) return null;
  // URL resolution guards trailing-slash env values (plain concat produced
  // `...co//functions/v1/...`).
  return new URL(`functions/v1/${functionName}`, supabaseUrl).toString();
}

export function getSupabaseAnonKey(): string | null {
  return supabaseConfigured ? supabaseAnonKey : null;
}

export type SupabaseAuthEvidence = {
  sessionUserId: string | null;
  sessionIsAnonymous: boolean | null;
  verifiedUserId: string | null;
  verifiedIsAnonymous: boolean | null;
  verifiedEmail: string | null;
};

/**
 * Returns cached-session evidence and separately verified user evidence. A
 * failed verification is intentionally represented as no verified user; the
 * caller must not use cached session metadata for remote authorization.
 */
export async function getSupabaseAuthEvidence(): Promise<SupabaseAuthEvidence> {
  if (!supabase) {
    return {
      sessionUserId: null,
      sessionIsAnonymous: null,
      verifiedUserId: null,
      verifiedIsAnonymous: null,
      verifiedEmail: null,
    };
  }

  let sessionUserId: string | null = null;
  let sessionIsAnonymous: boolean | null = null;
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (!error && session?.user) {
      sessionUserId = session.user.id;
      sessionIsAnonymous = session.user.is_anonymous === true;
    }
  } catch {
    // Verification below remains the authoritative remote gate.
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return {
        sessionUserId,
        sessionIsAnonymous,
        verifiedUserId: null,
        verifiedIsAnonymous: null,
        verifiedEmail: null,
      };
    }
    return {
      sessionUserId,
      sessionIsAnonymous,
      verifiedUserId: user.id,
      verifiedIsAnonymous: user.is_anonymous === true,
      verifiedEmail: user.email ?? null,
    };
  } catch {
    return {
      sessionUserId,
      sessionIsAnonymous,
      verifiedUserId: null,
      verifiedIsAnonymous: null,
      verifiedEmail: null,
    };
  }
}

export async function getSupabaseAuthUser(): Promise<User | null> {
  if (!supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export type SupabaseAuthErrorKind =
  | 'email_conflict'
  | 'invalid_otp'
  | 'expired_otp'
  | 'unknown_account'
  | 'network'
  | 'auth'
  | 'not_configured';

export function classifySupabaseAuthError(error: unknown): SupabaseAuthErrorKind {
  if (!supabaseConfigured) return 'not_configured';
  const candidate = error as { status?: number; code?: string; message?: string } | null;
  const text = `${candidate?.code ?? ''} ${candidate?.message ?? ''}`.toLowerCase();
  if (/already|exist|identity|duplicate|taken|conflict/.test(text)) return 'email_conflict';
  if (/expired|otp.*(expire|invalid)|token.*(expire|invalid)/.test(text)) {
    return /expired/.test(text) ? 'expired_otp' : 'invalid_otp';
  }
  if (/user.*not found|not found|invalid login|signup is disabled/.test(text)) {
    return 'unknown_account';
  }
  if (candidate?.status === 0 || /network|fetch|timeout|offline|failed to fetch/.test(text)) {
    return 'network';
  }
  return 'auth';
}

function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

export async function requestEmailProtection(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ email: email.trim() });
  if (error) throw error;
}

export async function verifyEmailChangeOtp(email: string, token: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email_change',
  });
  if (error) throw error;
}

export async function resendEmailChange(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.resend({
    type: 'email_change',
    email: email.trim(),
  });
  if (error) throw error;
}

export async function requestExistingAccountRecovery(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

/**
 * Supabase Auth has no separate passwordless-recovery resend type. Repeating
 * the same no-create sign-in request is the supported email-code resend path.
 */
export async function resendExistingAccountRecovery(email: string): Promise<void> {
  await requestExistingAccountRecovery(email);
}

export async function verifyExistingAccountOtp(email: string, token: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email',
  });
  if (error) throw error;
}

export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function startSupabaseAutoRefresh(): Promise<void> {
  if (!supabase || Platform.OS === 'web') return;
  await supabase.auth.startAutoRefresh();
}

export async function stopSupabaseAutoRefresh(): Promise<void> {
  if (!supabase || Platform.OS === 'web') return;
  await supabase.auth.stopAutoRefresh();
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session?.access_token ?? null;
}

/**
 * Returns the currently verified Auth user for authorization-sensitive remote
 * operations. Unlike getSession(), getUser() asks Supabase to validate the
 * current access token instead of treating cached session metadata as proof.
 */
export async function getSupabaseAuthUserId(): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user?.id ?? null;
}

/**
 * Reads the locally cached session identity for enqueue-time ownership. This
 * is deliberately separate from getSupabaseAuthUserId(): a local SQLite
 * mutation must not wait for a network round-trip or fail just because the
 * remote auth service is temporarily unavailable.
 */
export async function getSupabaseSessionUserId(): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session?.user?.id ?? null;
}

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
    const msg = signInError.message ?? '';
    if (/anonymous|disabled/i.test(msg) || (signInError as { status?: number }).status === 422) {
      return;
    }
    throw signInError;
  }
}
