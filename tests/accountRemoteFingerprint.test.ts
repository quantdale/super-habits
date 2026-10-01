import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * getRemoteFingerprint missing-table tolerance (audit F6): a pre-migration
 * remote lacks tables that the current backup scope includes (e.g.
 * `weekly_reviews`). Those entities provably hold zero rows there, so the
 * fingerprint treats them as count 0 with a recorded diagnostic instead of
 * failing every protection/recovery flow. Every OTHER error still throws
 * fail-closed.
 */

const entityResults = new Map<string, { count?: number | null; error?: unknown }>();
/** Owners the fake remote reports for the distinct-owner probe. */
const remoteOwners = new Set<string>(['user_a']);

// Reset after EVERY test: a per-test timeout or failure mid-body must not be
// able to leak a foreign owner into the next test's evidence.
afterEach(() => {
  remoteOwners.clear();
  remoteOwners.add('user_a');
  entityResults.clear();
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (entity: string) => ({
      select: () => ({
        // Owner-scoped count path (unchanged behaviour).
        eq: () => {
          const result = entityResults.get(entity) ?? {};
          return Promise.resolve({
            data: null,
            count: result.count ?? 0,
            error: result.error ?? null,
          });
        },
        // Distinct-owner probe path (`harden-silent-failure-certification` 4.3):
        // no `user_id` filter, bounded by row count, so the evidence is not
        // derived from the hypothesis it must be able to disprove.
        limit: () =>
          Promise.resolve({
            data: [...remoteOwners].map((user_id) => ({ user_id })),
            error: null,
          }),
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

// `accountCoordinator` is a large module (it pulls the account data layer, the
// auth seam, and the notification reconcilers). Loading it inside the first test
// would charge that cold-load cost to that test's 5s budget, which is tight when
// the whole unit project runs in parallel. Warm the module at COLLECTION time so
// each test's time measures the fingerprint, not the loader.
await import('@/core/auth/accountCoordinator');

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
    // `ownerIds` is now INDEPENDENT of these counts: it comes from a bounded
    // distinct-owner probe rather than from a count already filtered to
    // `user_a` (`harden-silent-failure-certification` 4.3). A zero count for a
    // missing table therefore no longer empties the owner set — the remote
    // still reports this account as an owner.
    expect(fingerprint.ownerIds).toEqual(['user_a']);
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
    // Owner identity comes from the independent probe, so it is unaffected by
    // the counts either way.
    expect(fingerprint.ownerIds).toEqual(['user_a']);
    expect(fingerprint.diagnostics?.[0]).toContain('projects');
  });

  it('reports the owners actually present, so the foreign-owner branch is reachable', async () => {
    remoteOwners.add('someone_else');
    const { getRemoteFingerprint } = await import('@/core/auth/accountCoordinator');
    const fingerprint = await getRemoteFingerprint('user_a');
    // The set is no longer a restatement of "I have rows": a foreign owner is
    // visible, which is what makes the `remote_foreign_owner` protection branch
    // reachable at all.
    expect(fingerprint.ownerIds).toEqual(['someone_else', 'user_a']);
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
