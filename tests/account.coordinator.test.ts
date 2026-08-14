import type * as SQLite from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';
import { AccountCoordinator } from '@/core/auth/accountCoordinator';
import type { AccountAuthEvidence, AccountRemoteFingerprint } from '@/core/auth/account.types';

type FakeDatabaseOptions = {
  activeRows?: Record<string, number>;
  deletedRows?: Record<string, number>;
  pendingOutboxCount?: number;
  unownedOutboxCount?: number;
  outboxOwnerIds?: string[];
  ownerBinding?: string | null;
};

function fakeDatabase(options: FakeDatabaseOptions = {}) {
  const meta = new Map<string, string>();
  const activeRows = options.activeRows ?? {};
  const deletedRows = options.deletedRows ?? {};
  let pendingOutboxCount = options.pendingOutboxCount ?? 0;
  let unownedOutboxCount = options.unownedOutboxCount ?? 0;
  let outboxOwnerIds = [...(options.outboxOwnerIds ?? [])];
  if (options.ownerBinding) meta.set('account.owner_user_id', options.ownerBinding);

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
  it('creates anonymous auth only for an empty unbound installation', async () => {
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
    expect(database.meta.has('account.owner_user_id')).toBe(false);
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
});
