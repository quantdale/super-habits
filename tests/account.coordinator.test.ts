import type * as SQLite from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';
import { AccountCoordinator } from '@/core/auth/accountCoordinator';
import { portableOwnerFingerprint } from '@/lib/portableOwnerFingerprint';
import type { AccountAuthEvidence, AccountRemoteFingerprint } from '@/core/auth/account.types';

type FakeDatabaseOptions = {
  activeRows?: Record<string, number>;
  deletedRows?: Record<string, number>;
  pendingOutboxCount?: number;
  unownedOutboxCount?: number;
  outboxOwnerIds?: string[];
  ownerBinding?: string | null;
  ownerBindingProvisional?: boolean;
};

function fakeDatabase(options: FakeDatabaseOptions = {}) {
  const meta = new Map<string, string>();
  const activeRows = options.activeRows ?? {};
  const deletedRows = options.deletedRows ?? {};
  let pendingOutboxCount = options.pendingOutboxCount ?? 0;
  let unownedOutboxCount = options.unownedOutboxCount ?? 0;
  let outboxOwnerIds = [...(options.outboxOwnerIds ?? [])];
  if (options.ownerBinding) meta.set('account.owner_user_id', options.ownerBinding);
  if (options.ownerBindingProvisional) meta.set('account.owner_binding_state', 'provisional');

  const db = {
    getFirstAsync: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === 'SELECT value FROM app_meta WHERE key = ?') {
        const value = meta.get(String(params?.[0] ?? ''));
        return value === undefined ? null : { value };
      }
      if (sql.includes('FROM sync_outbox') && sql.includes('owner_user_id IS NOT NULL')) {
        return { count: 0 };
      }
      if (sql.includes('FROM sync_outbox') && sql.includes('AS count')) {
        if (sql.includes('owner_user_id IS NULL')) return { count: unownedOutboxCount };
        return { count: pendingOutboxCount };
      }
      const match = sql.match(/FROM\s+([a-z_]+)/i);
      if (match?.[1] && sql.includes('AS total')) {
        const table = match[1];
        const active = activeRows[table] ?? 0;
        const deleted = deletedRows[table] ?? 0;
        if (sql.includes('deleted_at')) {
          return { total: active + deleted, active, deleted };
        }
        return { total: active + deleted };
      }
      return null;
    }),
    getAllAsync: vi.fn(async (sql: string) => {
      if (sql.includes('DISTINCT owner_user_id')) {
        return outboxOwnerIds.map((owner_user_id) => ({ owner_user_id }));
      }
      return [];
    }),
    runAsync: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql === 'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)') {
        meta.set(String(params[0]), String(params[1]));
      }
      if (sql.startsWith('UPDATE sync_outbox SET owner_user_id')) {
        const owner = String(params[0]);
        unownedOutboxCount = 0;
        if (!outboxOwnerIds.includes(owner)) outboxOwnerIds.push(owner);
      }
      return { changes: 1, lastInsertRowId: 1 };
    }),
    withTransactionAsync: vi.fn(async (task: () => Promise<void>) => task()),
  };

  return {
    db: db as unknown as SQLite.SQLiteDatabase,
    meta,
    getOutbox: () => ({
      pendingOutboxCount,
      unownedOutboxCount,
      outboxOwnerIds: [...outboxOwnerIds],
    }),
    __setOutbox: (next: {
      pendingOutboxCount?: number;
      unownedOutboxCount?: number;
      outboxOwnerIds?: string[];
    }) => {
      if (next.pendingOutboxCount !== undefined) pendingOutboxCount = next.pendingOutboxCount;
      if (next.unownedOutboxCount !== undefined) unownedOutboxCount = next.unownedOutboxCount;
      if (next.outboxOwnerIds !== undefined) outboxOwnerIds = [...next.outboxOwnerIds];
    },
  };
}

function auth(overrides: Partial<AccountAuthEvidence> = {}): AccountAuthEvidence {
  return {
    sessionUserId: null,
    sessionIsAnonymous: null,
    verifiedUserId: null,
    verifiedIsAnonymous: null,
    verifiedEmail: null,
    ...overrides,
  };
}

function fingerprint(overrides: Partial<AccountRemoteFingerprint> = {}): AccountRemoteFingerprint {
  return {
    counts: { todos: 1, habits: 0, calorie_entries: 0, workout_routines: 0 },
    ownerIds: ['user_a'],
    ...overrides,
  };
}

function coordinatorFor(
  database: ReturnType<typeof fakeDatabase>,
  currentAuth: { value: AccountAuthEvidence },
  overrides: Partial<ConstructorParameters<typeof AccountCoordinator>[0]> = {},
) {
  let now = new Date('2026-08-14T12:00:00.000Z');
  const coordinator = new AccountCoordinator({
    isConfigured: () => true,
    isRemoteEnabled: () => true,
    getDatabase: async () => database.db,
    getAuthEvidence: async () => currentAuth.value,
    ensureAnonymousSession: async () => undefined,
    requestEmailProtection: async () => undefined,
    verifyEmailChangeOtp: async () => undefined,
    resendEmailChange: async () => undefined,
    requestExistingAccountRecovery: async () => undefined,
    resendExistingAccountRecovery: async () => undefined,
    verifyExistingAccountOtp: async () => undefined,
    signOut: async () => {
      currentAuth.value = auth();
    },
    getRemoteFingerprint: async () => fingerprint(),
    now: () => now,
    ...overrides,
  });
  // Tests can advance the clock without depending on wall time.
  return Object.assign(coordinator, {
    __setNow: (next: Date) => {
      now = next;
    },
  });
}

describe('AccountCoordinator', () => {
  it('creates anonymous auth for an empty unbound installation and provisionally binds it', async () => {
    const database = fakeDatabase();
    const currentAuth = { value: auth() };
    const ensureAnonymousSession = vi.fn(async () => {
      currentAuth.value = auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      });
    });
    const coordinator = coordinatorFor(database, currentAuth, { ensureAnonymousSession });

    await expect(coordinator.bootstrap()).resolves.toMatchObject({ status: 'anonymous_ready' });
    expect(ensureAnonymousSession).toHaveBeenCalledTimes(1);
    // The fresh dataset is claimed for the temporary anonymous session as a
    // replaceable (provisional) owner so first local-only activity can never
    // strand later synced writes.
    expect(database.meta.get('account.owner_user_id')).toBe('anon_a');
    expect(database.meta.get('account.owner_binding_state')).toBe('provisional');
  });

  it('does not create anonymous auth when a session already exists', async () => {
    const database = fakeDatabase();
    const currentAuth = {
      value: auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      }),
    };
    const ensureAnonymousSession = vi.fn();
    const coordinator = coordinatorFor(database, currentAuth, { ensureAnonymousSession });

    await expect(coordinator.bootstrap()).resolves.toMatchObject({ status: 'anonymous_ready' });
    expect(ensureAnonymousSession).not.toHaveBeenCalled();
    expect(database.meta.get('account.owner_user_id')).toBe('anon_a');
    expect(database.meta.get('account.owner_binding_state')).toBe('provisional');
  });

  it('does not recreate anonymous auth after a bound session disappears', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = { value: auth() };
    const ensureAnonymousSession = vi.fn();
    const coordinator = coordinatorFor(database, currentAuth, { ensureAnonymousSession });

    await expect(coordinator.bootstrap()).resolves.toMatchObject({ status: 'recovery_required' });
    expect(ensureAnonymousSession).not.toHaveBeenCalled();
  });

  it('legacy-binds a compatible current account without rewriting rows', async () => {
    const database = fakeDatabase({ activeRows: { todos: 1 } });
    const currentAuth = {
      value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }),
    };
    const coordinator = coordinatorFor(database, currentAuth);

    await expect(coordinator.bootstrap()).resolves.toMatchObject({
      status: 'anonymous_ready',
      hasOwnerBinding: true,
    });
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
  });

  it('adopts legacy unowned outbox rows only for a verified compatible session', async () => {
    const database = fakeDatabase({
      activeRows: { todos: 1 },
      pendingOutboxCount: 1,
      unownedOutboxCount: 1,
    });
    const currentAuth = {
      value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }),
    };
    const coordinator = coordinatorFor(database, currentAuth);

    await expect(coordinator.bootstrap()).resolves.toMatchObject({
      status: 'anonymous_ready',
      hasOwnerBinding: true,
    });
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
    expect(database.getOutbox()).toMatchObject({ unownedOutboxCount: 0 });
  });

  it('reports a different verified account without rebinding', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = {
      value: auth({ verifiedUserId: 'user_b', verifiedIsAnonymous: false }),
    };
    const coordinator = coordinatorFor(database, currentAuth);

    await expect(coordinator.refresh()).resolves.toMatchObject({ status: 'owner_mismatch' });
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
  });

  it('protects an anonymous owner and preserves its UUID and outbox owner', async () => {
    const database = fakeDatabase({
      ownerBinding: 'user_a',
      activeRows: { todos: 1 },
      pendingOutboxCount: 1,
      outboxOwnerIds: ['user_a'],
    });
    const currentAuth = {
      value: auth({
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: true,
        sessionUserId: 'user_a',
        sessionIsAnonymous: true,
      }),
    };
    const requestEmailProtection = vi.fn();
    const verifyEmailChangeOtp = vi.fn(async () => {
      currentAuth.value = auth({
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'recover@example.com',
        sessionUserId: 'user_a',
      });
    });
    const coordinator = coordinatorFor(database, currentAuth, {
      requestEmailProtection,
      verifyEmailChangeOtp,
      getRemoteFingerprint: async () => fingerprint(),
    });

    await expect(coordinator.protect('recover@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'protection_pending',
    });
    expect(requestEmailProtection).toHaveBeenCalledWith('recover@example.com');
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');

    await expect(coordinator.verifyProtection('123456')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });
    expect(verifyEmailChangeOtp).toHaveBeenCalledWith('recover@example.com', '123456');
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
    expect(database.getOutbox()).toMatchObject({ outboxOwnerIds: ['user_a'] });
  });

  it('does not switch to an email that belongs to another account', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    const requestEmailProtection = vi.fn().mockRejectedValue(new Error('email already exists'));
    const coordinator = coordinatorFor(database, currentAuth, { requestEmailProtection });

    await expect(coordinator.protect('other@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'anonymous_ready',
      message: expect.stringContaining('another'),
    });
    expect(currentAuth.value.verifiedUserId).toBe('user_a');
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
  });

  it('recovers an existing account only on an empty device', async () => {
    const database = fakeDatabase();
    const currentAuth = { value: auth() };
    const requestExistingAccountRecovery = vi.fn();
    const verifyExistingAccountOtp = vi.fn(async () => {
      currentAuth.value = auth({
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'recover@example.com',
        sessionUserId: 'user_a',
      });
    });
    const coordinator = coordinatorFor(database, currentAuth, {
      requestExistingAccountRecovery,
      verifyExistingAccountOtp,
      getRemoteFingerprint: async () => fingerprint({ counts: {}, ownerIds: [] }),
    });

    await expect(coordinator.requestRecovery('recover@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    await expect(coordinator.verifyRecovery('654321')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });
    expect(requestExistingAccountRecovery).toHaveBeenCalledTimes(1);
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
  });

  it('blocks recovery before authentication when local data exists', async () => {
    const database = fakeDatabase({ activeRows: { pomodoro_sessions: 1 } });
    const currentAuth = { value: auth() };
    const requestExistingAccountRecovery = vi.fn();
    const coordinator = coordinatorFor(database, currentAuth, { requestExistingAccountRecovery });

    await expect(coordinator.requestRecovery('recover@example.com')).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('switching'),
    });
    expect(requestExistingAccountRecovery).not.toHaveBeenCalled();
  });

  it('recovers the bound owner after session loss without rebinding local data', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = { value: auth() };
    const requestExistingAccountRecovery = vi.fn();
    const verifyExistingAccountOtp = vi.fn(async () => {
      currentAuth.value = auth({
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'recover@example.com',
        sessionUserId: 'user_a',
      });
    });
    const coordinator = coordinatorFor(database, currentAuth, {
      requestExistingAccountRecovery,
      verifyExistingAccountOtp,
      getRemoteFingerprint: async () => fingerprint(),
    });

    await expect(coordinator.requestRecovery('recover@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    await expect(coordinator.verifyRecovery('654321')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
  });

  it('rejects a different account during bound-owner recovery and clears its session', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = { value: auth() };
    const signOut = vi.fn(async () => {
      currentAuth.value = auth();
    });
    const coordinator = coordinatorFor(database, currentAuth, {
      signOut,
      requestExistingAccountRecovery: vi.fn(),
      verifyExistingAccountOtp: vi.fn(async () => {
        currentAuth.value = auth({
          verifiedUserId: 'user_b',
          verifiedIsAnonymous: false,
          verifiedEmail: 'other@example.com',
          sessionUserId: 'user_b',
        });
      }),
      getRemoteFingerprint: async () => fingerprint(),
    });

    await coordinator.requestRecovery('other@example.com');
    await expect(coordinator.verifyRecovery('654321')).resolves.toMatchObject({
      ok: false,
      status: 'owner_mismatch',
      message: expect.stringContaining('different account'),
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
  });

  it('rejects malformed and unknown recovery codes without binding a UID', async () => {
    const database = fakeDatabase();
    const currentAuth = { value: auth() };
    const coordinator = coordinatorFor(database, currentAuth, {
      requestExistingAccountRecovery: vi.fn(),
      verifyExistingAccountOtp: vi.fn(),
    });

    await coordinator.requestRecovery('recover@example.com');
    await expect(coordinator.verifyRecovery('12ab56')).resolves.toMatchObject({ ok: false });
    expect(database.meta.has('account.owner_user_id')).toBe(false);
  });

  it('keeps the anonymous account safe when protection request cannot reach Auth', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    const coordinator = coordinatorFor(database, currentAuth, {
      requestEmailProtection: vi.fn().mockRejectedValue({ status: 0, message: 'network offline' }),
    });

    await expect(coordinator.protect('recover@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'anonymous_ready',
      message: expect.stringContaining('could not complete'),
    });
    expect(database.meta.has('account.protection_pending')).toBe(false);
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
  });

  it('maps an expired protection code without changing the anonymous session', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    const coordinator = coordinatorFor(database, currentAuth, {
      verifyEmailChangeOtp: vi.fn().mockRejectedValue(new Error('OTP expired')),
    });

    await coordinator.protect('recover@example.com');
    await expect(coordinator.verifyProtection('123456')).resolves.toMatchObject({
      ok: false,
      status: 'protection_pending',
      message: expect.stringContaining('could not complete'),
    });
    expect(currentAuth.value.verifiedUserId).toBe('user_a');
    expect(database.meta.has('account.protection_pending')).toBe(true);
  });

  it('enforces one protection request at a time and supports bounded resend', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    let releaseRequest!: () => void;
    const requestEmailProtection = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseRequest = resolve;
        }),
    );
    const resendEmailChange = vi.fn(async () => undefined);
    const coordinator = coordinatorFor(database, currentAuth, {
      requestEmailProtection,
      resendEmailChange,
    });

    const firstRequest = coordinator.protect('recover@example.com');
    await vi.waitFor(() => expect(requestEmailProtection).toHaveBeenCalledTimes(1));
    await expect(coordinator.protect('recover@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'error',
    });
    releaseRequest();
    await expect(firstRequest).resolves.toMatchObject({ ok: true, status: 'protection_pending' });

    await expect(coordinator.resendProtection()).resolves.toMatchObject({
      ok: false,
      status: 'protection_pending',
    });
    const setNow = (coordinator as unknown as { __setNow: (next: Date) => void }).__setNow;
    setNow(new Date('2026-08-14T12:01:00.000Z'));
    await expect(coordinator.resendProtection()).resolves.toMatchObject({
      ok: true,
      status: 'protection_pending',
    });
    expect(resendEmailChange).toHaveBeenCalledWith('recover@example.com');
  });

  it('treats protection for an already permanent account as idempotent', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = {
      value: auth({
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'recover@example.com',
      }),
    };
    const requestEmailProtection = vi.fn();
    const coordinator = coordinatorFor(database, currentAuth, { requestEmailProtection });

    await expect(coordinator.protect('recover@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
      message: expect.stringContaining('already protected'),
    });
    expect(requestEmailProtection).not.toHaveBeenCalled();
  });

  it('allows bound-owner recovery from a temporary wrong session but requires the bound UID', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = {
      value: auth({
        sessionUserId: 'user_b',
        sessionIsAnonymous: false,
        verifiedUserId: 'user_b',
        verifiedIsAnonymous: false,
      }),
    };
    const requestExistingAccountRecovery = vi.fn();
    const coordinator = coordinatorFor(database, currentAuth, {
      requestExistingAccountRecovery,
      getRemoteFingerprint: vi.fn().mockRejectedValue(new Error('remote should not be queried')),
    });

    await expect(coordinator.requestRecovery('recover@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    expect(requestExistingAccountRecovery).toHaveBeenCalledWith('recover@example.com');
  });

  it('SCENARIO A: allows new outbox rows while the protection OTP is pending', async () => {
    const database = fakeDatabase({
      ownerBinding: 'user_a',
      activeRows: { todos: 1 },
      pendingOutboxCount: 1,
      outboxOwnerIds: ['user_a'],
    });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    const coordinator = coordinatorFor(database, currentAuth, {
      verifyEmailChangeOtp: vi.fn(async () => {
        currentAuth.value = auth({
          verifiedUserId: 'user_a',
          verifiedIsAnonymous: false,
          verifiedEmail: 'a@example.com',
          sessionUserId: 'user_a',
        });
      }),
    });

    await coordinator.protect('a@example.com');
    // The user creates a synced Todo while waiting for the email code.
    database.__setOutbox({ pendingOutboxCount: 2, outboxOwnerIds: ['user_a'] });
    await expect(coordinator.verifyProtection('123456')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
    await expect(coordinator.refresh()).resolves.toMatchObject({ status: 'protected' });
  });

  it('SCENARIO B: allows outbox flush and remote row-count changes while the OTP is pending', async () => {
    const database = fakeDatabase({
      ownerBinding: 'user_a',
      activeRows: { todos: 1 },
      pendingOutboxCount: 1,
      outboxOwnerIds: ['user_a'],
    });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    const coordinator = coordinatorFor(database, currentAuth, {
      verifyEmailChangeOtp: vi.fn(async () => {
        currentAuth.value = auth({
          verifiedUserId: 'user_a',
          verifiedIsAnonymous: false,
          verifiedEmail: 'a@example.com',
          sessionUserId: 'user_a',
        });
      }),
      getRemoteFingerprint: async () =>
        fingerprint({
          counts: { todos: 12, habits: 3, calorie_entries: 5, workout_routines: 1 },
          ownerIds: ['user_a'],
        }),
    });

    await coordinator.protect('a@example.com');
    // Background sync drains the outbox and pushes more rows while pending.
    database.__setOutbox({ pendingOutboxCount: 0, outboxOwnerIds: [] });
    await expect(coordinator.verifyProtection('123456')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });
  });

  it('SCENARIO C: linked-action cascades while pending still succeed when ownership is intact', async () => {
    const database = fakeDatabase({
      ownerBinding: 'user_a',
      activeRows: { todos: 1, habit_completions: 2 },
      pendingOutboxCount: 3,
      outboxOwnerIds: ['user_a'],
    });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    const coordinator = coordinatorFor(database, currentAuth, {
      verifyEmailChangeOtp: vi.fn(async () => {
        currentAuth.value = auth({
          verifiedUserId: 'user_a',
          verifiedIsAnonymous: false,
          verifiedEmail: 'a@example.com',
          sessionUserId: 'user_a',
        });
      }),
    });

    await coordinator.protect('a@example.com');
    // A habit completion triggered a linked action that mutated a todo too.
    database.__setOutbox({ pendingOutboxCount: 4, outboxOwnerIds: ['user_a'] });
    await expect(coordinator.verifyProtection('123456')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });
  });

  it('SCENARIO D: a foreign owner appearing in the outbox while pending fails closed', async () => {
    const database = fakeDatabase({
      ownerBinding: 'user_a',
      activeRows: { todos: 1 },
      pendingOutboxCount: 1,
      outboxOwnerIds: ['user_a'],
    });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    const signOut = vi.fn(async () => {
      currentAuth.value = auth();
    });
    const coordinator = coordinatorFor(database, currentAuth, {
      signOut,
      verifyEmailChangeOtp: vi.fn(async () => {
        currentAuth.value = auth({
          verifiedUserId: 'user_a',
          verifiedIsAnonymous: false,
          verifiedEmail: 'a@example.com',
          sessionUserId: 'user_a',
        });
      }),
    });

    await coordinator.protect('a@example.com');
    database.__setOutbox({ pendingOutboxCount: 2, outboxOwnerIds: ['user_a', 'user_b'] });
    await expect(coordinator.verifyProtection('123456')).resolves.toMatchObject({
      ok: false,
      status: 'error',
      message: expect.stringContaining('ownership changed'),
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
    expect(database.meta.has('account.protection_last_failure')).toBe(true);
    // Restart: no stale protection_pending, session gone, and the foreign
    // owner evidence remains → fail-closed account conflict, never a stale
    // protection_pending loop.
    const restarted = coordinatorFor(database, currentAuth);
    await expect(restarted.refresh()).resolves.toMatchObject({ status: 'account_conflict' });
  });

  it('SCENARIO E: a changed verified user after the OTP fails closed and clears the pending record', async () => {
    const database = fakeDatabase({
      ownerBinding: 'user_a',
      activeRows: { todos: 1 },
      pendingOutboxCount: 1,
      outboxOwnerIds: ['user_a'],
    });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    const signOut = vi.fn(async () => {
      currentAuth.value = auth();
    });
    const coordinator = coordinatorFor(database, currentAuth, {
      signOut,
      verifyEmailChangeOtp: vi.fn(async () => {
        currentAuth.value = auth({
          verifiedUserId: 'user_b',
          verifiedIsAnonymous: false,
          verifiedEmail: 'b@example.com',
          sessionUserId: 'user_b',
        });
      }),
    });

    await coordinator.protect('a@example.com');
    await expect(coordinator.verifyProtection('123456')).resolves.toMatchObject({
      ok: false,
      status: 'recovery_required',
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
    expect(database.meta.has('account.protection_last_failure')).toBe(true);
    // The converted-but-unsafe session is gone; restart must not loop as
    // protection_pending.
    const restarted = coordinatorFor(database, currentAuth);
    await expect(restarted.refresh()).resolves.toMatchObject({ status: 'recovery_required' });
  });

  it('reconciles a stale pending protection after a different user takes over', async () => {
    const database = fakeDatabase({ ownerBinding: 'user_a', activeRows: { todos: 1 } });
    const currentAuth = { value: auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }) };
    const coordinator = coordinatorFor(database, currentAuth);
    await coordinator.protect('a@example.com');
    expect(database.meta.has('account.protection_pending')).toBe(true);

    currentAuth.value = auth({
      verifiedUserId: 'user_b',
      verifiedIsAnonymous: false,
      sessionUserId: 'user_b',
    });
    await expect(coordinator.refresh()).resolves.toMatchObject({ status: 'owner_mismatch' });
    expect(database.meta.get('account.protection_pending')).toBe('null');
  });

  it('replaces a provisional anonymous owner with a recovered account on a pristine device', async () => {
    const database = fakeDatabase({ ownerBinding: 'anon_a', ownerBindingProvisional: true });
    const currentAuth = {
      value: auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      }),
    };
    const coordinator = coordinatorFor(database, currentAuth, {
      verifyExistingAccountOtp: vi.fn(async () => {
        currentAuth.value = auth({
          verifiedUserId: 'user_b',
          verifiedIsAnonymous: false,
          verifiedEmail: 'b@example.com',
          sessionUserId: 'user_b',
        });
      }),
      getRemoteFingerprint: async () => fingerprint({ counts: {}, ownerIds: [] }),
    });

    await expect(coordinator.requestRecovery('b@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    await expect(coordinator.verifyRecovery('654321')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });
    expect(database.meta.get('account.owner_user_id')).toBe('user_b');
    expect(database.meta.get('account.owner_binding_state')).toBe('permanent');
  });

  it('blocks recovery once local-only content exists on a provisionally bound device', async () => {
    const database = fakeDatabase({
      ownerBinding: 'anon_a',
      ownerBindingProvisional: true,
      activeRows: { pomodoro_sessions: 1 },
    });
    const currentAuth = {
      value: auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      }),
    };
    const requestExistingAccountRecovery = vi.fn();
    const coordinator = coordinatorFor(database, currentAuth, { requestExistingAccountRecovery });

    await expect(coordinator.requestRecovery('b@example.com')).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('switching'),
    });
    expect(requestExistingAccountRecovery).not.toHaveBeenCalled();
  });

  it('promotes a provisional binding when content exists and the owner session is present', async () => {
    const database = fakeDatabase({
      ownerBinding: 'anon_a',
      ownerBindingProvisional: true,
      activeRows: { pomodoro_sessions: 1 },
    });
    const currentAuth = {
      value: auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      }),
    };
    const coordinator = coordinatorFor(database, currentAuth);

    await expect(coordinator.refresh()).resolves.toMatchObject({ status: 'anonymous_ready' });
    expect(database.meta.get('account.owner_binding_state')).toBe('permanent');
    expect(database.meta.get('account.owner_user_id')).toBe('anon_a');
  });

  it('starts a fresh temporary anonymous session on a pristine provisional device after session loss', async () => {
    const database = fakeDatabase({ ownerBinding: 'anon_a', ownerBindingProvisional: true });
    const currentAuth = { value: auth() };
    const ensureAnonymousSession = vi.fn(async () => {
      currentAuth.value = auth({
        sessionUserId: 'anon_b',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_b',
        verifiedIsAnonymous: true,
      });
    });
    const coordinator = coordinatorFor(database, currentAuth, { ensureAnonymousSession });

    await expect(coordinator.bootstrap()).resolves.toMatchObject({ status: 'anonymous_ready' });
    expect(ensureAnonymousSession).toHaveBeenCalledTimes(1);
    expect(database.meta.get('account.owner_user_id')).toBe('anon_b');
    expect(database.meta.get('account.owner_binding_state')).toBe('provisional');
  });

  it('keeps a provisional binding provisional while the device stays pristine', async () => {
    const database = fakeDatabase({ ownerBinding: 'anon_a', ownerBindingProvisional: true });
    const currentAuth = {
      value: auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      }),
    };
    const coordinator = coordinatorFor(database, currentAuth);

    await expect(coordinator.refresh()).resolves.toMatchObject({
      status: 'anonymous_ready',
      canRecoverExisting: true,
    });
    expect(database.meta.get('account.owner_binding_state')).toBe('provisional');
  });
});

describe('AccountCoordinator — imported-owner recovery (Portable V1 closure)', () => {
  const FP_A = portableOwnerFingerprint('user_a');

  function importedOwnerDatabase(overrides: FakeDatabaseOptions = {}) {
    const database = fakeDatabase({
      activeRows: { todos: 1 },
      ...overrides,
    });
    // The durable Portable Import V1 origin fingerprint (validated import).
    database.meta.set('portable.last_import_owner_fingerprint', FP_A);
    return database;
  }

  /** Anonymous temporary session T still signed in after the import. */
  function tempSessionAuth() {
    return {
      value: auth({
        sessionUserId: 'temp_t',
        sessionIsAnonymous: true,
        verifiedUserId: 'temp_t',
        verifiedIsAnonymous: true,
      }),
    };
  }

  it('A: matching account binds the imported dataset after fingerprint-verified recovery', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const verifyExistingAccountOtp = vi.fn(async () => {
      currentAuth.value = auth({
        sessionUserId: 'user_a',
        sessionIsAnonymous: false,
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'a@example.com',
      });
    });
    const coordinator = coordinatorFor(database, currentAuth, {
      verifyExistingAccountOtp,
      getRemoteFingerprint: async () => fingerprint({ counts: {}, ownerIds: [] }),
    });

    const state = await coordinator.refresh();
    expect(state.canRecoverImportedOwner).toBe(true);
    expect(state.canRecoverExisting).toBe(false);
    expect(state.canRecoverOwner).toBe(false);

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    const pending = JSON.parse(database.meta.get('account.recovery_pending') ?? 'null') as {
      expectedOwnerUserId: string | null;
      expectedOwnerFingerprint: string | null;
    };
    expect(pending.expectedOwnerUserId).toBeNull();
    expect(pending.expectedOwnerFingerprint).toBe(FP_A);

    await expect(coordinator.verifyRecovery('123456')).resolves.toMatchObject({
      ok: true,
      status: 'protected',
    });
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
    expect(database.meta.get('account.owner_binding_state')).toBe('permanent');
    // Pending record cleared; source fingerprint retained (inert diagnostics).
    expect(database.meta.get('account.recovery_pending')).toBe('null');
    expect(database.meta.get('portable.last_import_owner_fingerprint')).toBe(FP_A);
  });

  it('B: wrong account is signed out, nothing binds, fingerprint and data are preserved', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const signOut = vi.fn(async () => {
      currentAuth.value = auth();
    });
    const verifyExistingAccountOtp = vi.fn(async () => {
      currentAuth.value = auth({
        sessionUserId: 'user_b',
        sessionIsAnonymous: false,
        verifiedUserId: 'user_b',
        verifiedIsAnonymous: false,
        verifiedEmail: 'b@example.com',
      });
    });
    const coordinator = coordinatorFor(database, currentAuth, {
      signOut,
      verifyExistingAccountOtp,
      getRemoteFingerprint: async () => fingerprint({ counts: {}, ownerIds: [] }),
    });

    await expect(coordinator.requestRecovery('b@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    await expect(coordinator.verifyRecovery('123456')).resolves.toMatchObject({
      ok: false,
      status: 'owner_mismatch',
      message: expect.stringContaining('different account'),
    });
    expect(signOut).toHaveBeenCalled();
    expect(currentAuth.value.verifiedUserId).toBeNull();
    // Never bound, never rewritten: the imported dataset stays unclaimed.
    expect(database.meta.has('account.owner_user_id')).toBe(false);
    expect(database.meta.get('portable.last_import_owner_fingerprint')).toBe(FP_A);
    // Pending record is terminated after the wrong-account attempt.
    expect(database.meta.get('account.recovery_pending')).toBe('null');
  });

  it('C: blocks imported-owner recovery when temporary session T has remote backup rows', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const requestExistingAccountRecovery = vi.fn();
    const coordinator = coordinatorFor(database, currentAuth, {
      requestExistingAccountRecovery,
      getRemoteFingerprint: async () => fingerprint(),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
      message: expect.stringContaining('remote backup data'),
    });
    expect(requestExistingAccountRecovery).not.toHaveBeenCalled();
  });

  it('D: allows imported-owner recovery when temporary session T has no remote rows', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => fingerprint({ counts: {}, ownerIds: [] }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
  });

  it('E: returns a retryable remote-unavailable state when the footprint check fails', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => {
        throw new Error('offline');
      },
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'remote_unavailable',
    });
    expect(database.meta.has('account.owner_user_id')).toBe(false);
  });

  it('F: local-only portable import (no fingerprint) never grants the exception', async () => {
    const database = fakeDatabase({ activeRows: { todos: 1 } });
    // Local-only source file: the durable marker is the literal `null`.
    database.meta.set('portable.last_import_owner_fingerprint', 'null');
    // No session after import: no anonymous claim happens, and the imported
    // local-only dataset stays unbound with NO account-switch exception.
    const currentAuth = { value: auth() };
    const requestExistingAccountRecovery = vi.fn();
    const coordinator = coordinatorFor(database, currentAuth, { requestExistingAccountRecovery });

    const state = await coordinator.refresh();
    expect(state.canRecoverImportedOwner).toBe(false);
    expect(state.status).toBe('legacy_owner_unknown');
    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('switching'),
    });
    expect(requestExistingAccountRecovery).not.toHaveBeenCalled();
  });

  it('F2: a local-only import with anonymous session T still follows legacy first-account claim', async () => {
    const database = fakeDatabase({ activeRows: { todos: 1 } });
    database.meta.set('portable.last_import_owner_fingerprint', 'null');
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth);

    // Legacy Recoverable Account semantics: the first anonymous session
    // claims the local-only dataset; no imported-owner exception exists.
    await expect(coordinator.refresh()).resolves.toMatchObject({
      status: 'anonymous_ready',
      canRecoverImportedOwner: false,
      hasOwnerBinding: true,
    });
    expect(database.meta.get('account.owner_user_id')).toBe('temp_t');
  });

  it('G: legacy populated unbound dataset without import origin stays fail-closed', async () => {
    const database = fakeDatabase({ activeRows: { todos: 1 } });
    const currentAuth = { value: auth() };
    const coordinator = coordinatorFor(database, currentAuth);

    const state = await coordinator.refresh();
    expect(state.canRecoverImportedOwner).toBe(false);
    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('switching'),
    });
  });

  it('H: a permanent owner-bound device never surfaces the imported-owner exception', async () => {
    const database = importedOwnerDatabase({ ownerBinding: 'user_b' });
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth);

    const state = await coordinator.refresh();
    expect(state.canRecoverImportedOwner).toBe(false);
    expect(database.meta.get('account.owner_user_id')).toBe('user_b');
  });

  it('I: a matching account already authenticated after import binds automatically', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = {
      value: auth({
        sessionUserId: 'user_a',
        sessionIsAnonymous: false,
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'a@example.com',
      }),
    };
    const coordinator = coordinatorFor(database, currentAuth);

    await expect(coordinator.refresh()).resolves.toMatchObject({
      status: 'protected',
      canRecoverImportedOwner: false,
    });
    expect(database.meta.get('account.owner_user_id')).toBe('user_a');
  });

  it('J: wrong anonymous session T keeps the source-account recovery form visible', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth);

    const state = await coordinator.refresh();
    expect(state.canRecoverImportedOwner).toBe(true);
    expect(state.status).toBe('owner_mismatch');
    expect(state.message).toContain('created');
  });

  it('keeps an imported-owner pending recovery visible across refresh', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => fingerprint({ counts: {}, ownerIds: [] }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: true,
    });
    await expect(coordinator.refresh()).resolves.toMatchObject({
      status: 'sign_in_pending',
      email: 'a@example.com',
    });
  });

  it('clears an imported-owner pending recovery when eligibility drifts (owner binds elsewhere)', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => fingerprint({ counts: {}, ownerIds: [] }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: true,
    });
    // The dataset becomes owner-bound while the code is pending.
    database.meta.set('account.owner_user_id', 'user_b');
    database.meta.delete('account.owner_binding_state');
    await expect(coordinator.refresh()).resolves.toMatchObject({
      status: 'owner_mismatch',
      canRecoverImportedOwner: false,
    });
    expect(database.meta.get('account.recovery_pending')).toBe('null');
  });

  it('V2-1: blocks imported-owner recovery when T has only pomodoro_sessions remote rows', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const requestExistingAccountRecovery = vi.fn();
    const coordinator = coordinatorFor(database, currentAuth, {
      requestExistingAccountRecovery,
      getRemoteFingerprint: async () => ({
        counts: {
          todos: 0,
          habits: 0,
          calorie_entries: 0,
          workout_routines: 0,
          pomodoro_sessions: 25,
        },
        ownerIds: ['temp_t'],
      }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
      message: expect.stringContaining('remote backup data'),
    });
    expect(requestExistingAccountRecovery).not.toHaveBeenCalled();
  });

  it('V2-2: blocks imported-owner recovery when T has only saved_meals remote rows', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => ({
        counts: {
          todos: 0,
          habits: 0,
          calorie_entries: 0,
          workout_routines: 0,
          saved_meals: 3,
        },
        ownerIds: ['temp_t'],
      }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
    });
  });

  it('V2-3: blocks imported-owner recovery when T has only habit_completions remote rows', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => ({
        counts: {
          todos: 0,
          habits: 0,
          habit_completions: 42,
          calorie_entries: 0,
          workout_routines: 0,
        },
        ownerIds: ['temp_t'],
      }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
    });
  });

  it('V2-4: blocks imported-owner recovery when T has only linked_action_rules remote rows', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => ({
        counts: {
          todos: 0,
          habits: 0,
          calorie_entries: 0,
          workout_routines: 0,
          linked_action_rules: 2,
        },
        ownerIds: ['temp_t'],
      }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
    });
  });

  it('V2-5: blocks imported-owner recovery when T has only user_backup_settings remote row', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => ({
        counts: {
          todos: 0,
          habits: 0,
          calorie_entries: 0,
          workout_routines: 0,
          user_backup_settings: 1,
        },
        ownerIds: ['temp_t'],
      }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
    });
  });

  it('V2-6: blocks imported-owner recovery when T has only backup_manifest remote row', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => ({
        counts: {
          todos: 0,
          habits: 0,
          calorie_entries: 0,
          workout_routines: 0,
          backup_manifest: 1,
        },
        ownerIds: ['temp_t'],
      }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
    });
  });

  it('V2-7: blocks imported-owner recovery when T has only routine_exercise_sets remote rows', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => ({
        counts: {
          todos: 0,
          habits: 0,
          calorie_entries: 0,
          workout_routines: 0,
          routine_exercise_sets: 8,
        },
        ownerIds: ['temp_t'],
      }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
    });
  });

  it('V2-8: blocks imported-owner recovery when T has only workout_logs remote rows', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => ({
        counts: {
          todos: 0,
          habits: 0,
          calorie_entries: 0,
          workout_routines: 0,
          workout_logs: 5,
        },
        ownerIds: ['temp_t'],
      }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
    });
  });

  it('V2-9: allows imported-owner recovery when all remote backup entity counts are zero', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => ({
        counts: {
          todos: 0,
          habits: 0,
          habit_completions: 0,
          calorie_entries: 0,
          saved_meals: 0,
          workout_routines: 0,
          routine_exercises: 0,
          routine_exercise_sets: 0,
          workout_logs: 0,
          workout_session_exercises: 0,
          pomodoro_sessions: 0,
          linked_action_rules: 0,
          user_backup_settings: 0,
          backup_manifest: 0,
        },
        ownerIds: [],
      }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
  });

  it('V2-10: returns remote_unavailable when footprint check fails (covers all V2 entities)', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const coordinator = coordinatorFor(database, currentAuth, {
      getRemoteFingerprint: async () => {
        throw new Error('network timeout');
      },
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: false,
      status: 'remote_unavailable',
    });
  });

  it('fails closed when the source fingerprint changes while recovery is pending', async () => {
    const database = importedOwnerDatabase();
    const currentAuth = tempSessionAuth();
    const verifyExistingAccountOtp = vi.fn(async () => {
      currentAuth.value = auth({
        sessionUserId: 'user_a',
        sessionIsAnonymous: false,
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'a@example.com',
      });
    });
    const coordinator = coordinatorFor(database, currentAuth, {
      verifyExistingAccountOtp,
      getRemoteFingerprint: async () => fingerprint({ counts: {}, ownerIds: [] }),
    });

    await expect(coordinator.requestRecovery('a@example.com')).resolves.toMatchObject({
      ok: true,
      status: 'sign_in_pending',
    });
    // The recorded fingerprint is rewritten (or cleared) while pending.
    database.meta.set('portable.last_import_owner_fingerprint', 'b'.repeat(64));
    await expect(coordinator.verifyRecovery('123456')).resolves.toMatchObject({
      ok: false,
      status: 'account_conflict',
    });
    expect(database.meta.has('account.owner_user_id')).toBe(false);
    expect(currentAuth.value.verifiedUserId).toBeNull();
  });
});
