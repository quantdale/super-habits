import { describe, expect, it, vi } from 'vitest';

/**
 * getRemoteFingerprint missing-table tolerance (audit F6): a pre-migration
 * remote lacks tables that the current backup scope includes (e.g.
 * `weekly_reviews`). Those entities provably hold zero rows there, so the
 * fingerprint treats them as count 0 with a recorded diagnostic instead of
 * failing every protection/recovery flow. Every OTHER error still throws
 * fail-closed.
 */

const entityResults = new Map<string, { count?: number | null; error?: unknown }>();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (entity: string) => ({
      select: () => ({
        eq: () => {
          const result = entityResults.get(entity) ?? {};
          return Promise.resolve({
            data: null,
            count: result.count ?? 0,
            error: result.error ?? null,
          });
        },
      }),
    }),
  },
  isSupabaseConfigured: () => true,
  isRemoteEnabled: () => true,
  ensureAnonymousSession: async () => undefined,
  getSupabaseAuthEvidence: async () => ({
    sessionUserId: 'user_a',
    sessionIsAnonymous: true,
    verifiedUserId: 'user_a',
    verifiedIsAnonymous: true,
    verifiedEmail: null,
  }),
  getSupabaseAuthUserId: async () => 'user_a',
  getSupabaseSessionUserId: async () => 'user_a',
  requestEmailProtection: async () => undefined,
  verifyEmailChangeOtp: async () => undefined,
  resendEmailChange: async () => undefined,
  requestExistingAccountRecovery: async () => undefined,
  verifyExistingAccountOtp: async () => undefined,
  signOutSupabase: async () => undefined,
  classifySupabaseAuthError: () => 'unknown',
}));

describe('getRemoteFingerprint — missing remote table tolerance', () => {
  it('treats a PGRST205 schema-cache miss as count 0 with a diagnostic', async () => {
    entityResults.clear();
    entityResults.set('weekly_reviews', {
      error: {
        code: 'PGRST205',
        message: "Could not find the table 'public.weekly_reviews' in the schema cache",
      },
    });
    const { getRemoteFingerprint } = await import('@/core/auth/accountCoordinator');
    const fingerprint = await getRemoteFingerprint('user_a');
    expect(fingerprint.counts.weekly_reviews).toBe(0);
    expect(fingerprint.ownerIds).toEqual([]);
    expect(fingerprint.diagnostics).toHaveLength(1);
    expect(fingerprint.diagnostics?.[0]).toContain('weekly_reviews');
  });

  it('tolerates the relation-not-found error form too', async () => {
    entityResults.clear();
    entityResults.set('projects', {
      error: { message: 'relation "public.projects" does not exist' },
    });
    entityResults.set('todos', { count: 2 });
    const { getRemoteFingerprint } = await import('@/core/auth/accountCoordinator');
    const fingerprint = await getRemoteFingerprint('user_a');
    expect(fingerprint.counts.projects).toBe(0);
    expect(fingerprint.counts.todos).toBe(2);
    // Non-zero evidence still identifies the owner.
    expect(fingerprint.ownerIds).toEqual(['user_a']);
    expect(fingerprint.diagnostics?.[0]).toContain('projects');
  });

  it('still throws fail-closed for any other per-entity error', async () => {
    entityResults.clear();
    entityResults.set('todos', {
      error: { code: 'PGRST401', message: 'simulated network outage' },
    });
    const { getRemoteFingerprint } = await import('@/core/auth/accountCoordinator');
    await expect(getRemoteFingerprint('user_a')).rejects.toThrow('simulated network outage');
  });

  it('records no diagnostics when every table exists', async () => {
    entityResults.clear();
    entityResults.set('weekly_reviews', { count: 3 });
    const { getRemoteFingerprint } = await import('@/core/auth/accountCoordinator');
    const fingerprint = await getRemoteFingerprint('user_a');
    expect(fingerprint.counts.weekly_reviews).toBe(3);
    expect(fingerprint.diagnostics).toBeUndefined();
  });
});
