import { describe, expect, it } from 'vitest';
import {
  decideAccountState,
  isValidAccountEmail,
  isValidAccountOtp,
} from '@/core/auth/account.domain';
import { portableOwnerFingerprint } from '@/lib/portableOwnerFingerprint';
import type { AccountAuthEvidence, LocalAccountDataState } from '@/core/auth/account.types';

const emptyCounts = {
  todos: { total: 0, active: 0, deleted: 0 },
  habits: { total: 0, active: 0, deleted: 0 },
  habit_completions: { total: 0, active: 0, deleted: 0 },
  pomodoro_sessions: { total: 0, active: 0, deleted: 0 },
  workout_routines: { total: 0, active: 0, deleted: 0 },
  routine_exercises: { total: 0, active: 0, deleted: 0 },
  routine_exercise_sets: { total: 0, active: 0, deleted: 0 },
  workout_logs: { total: 0, active: 0, deleted: 0 },
  workout_session_exercises: { total: 0, active: 0, deleted: 0 },
  calorie_entries: { total: 0, active: 0, deleted: 0 },
  saved_meals: { total: 0, active: 0, deleted: 0 },
  linked_action_rules: { total: 0, active: 0, deleted: 0 },
  linked_action_events: { total: 0, active: 0, deleted: 0 },
  linked_action_executions: { total: 0, active: 0, deleted: 0 },
} as LocalAccountDataState['counts'];

function local(overrides: Partial<LocalAccountDataState> = {}): LocalAccountDataState {
  return {
    counts: emptyCounts,
    activeUserDataCount: 0,
    deletedUserDataCount: 0,
    hasUserData: false,
    pendingOutboxCount: 0,
    unownedOutboxCount: 0,
    outboxOwnerIds: [],
    ownerBinding: null,
    ownerBindingProvisional: false,
    ...overrides,
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

function decide(localState: LocalAccountDataState, authState: AccountAuthEvidence = auth()) {
  return decideAccountState({
    configured: true,
    remoteEnabled: true,
    local: localState,
    auth: authState,
  });
}

function decideWithImport(
  localState: LocalAccountDataState,
  authState: AccountAuthEvidence,
  fingerprint: string | null,
) {
  return decideAccountState({
    configured: true,
    remoteEnabled: true,
    local: localState,
    auth: authState,
    importOriginOwnerFingerprint: fingerprint,
  });
}

/** A's real fingerprint; FP_B is a different valid-format fingerprint. */
const FP_A = portableOwnerFingerprint('user_a');
const FP_B = 'b'.repeat(64);

describe('recoverable account state machine', () => {
  it('allows an empty install to create a temporary anonymous session', () => {
    const result = decide(local());

    expect(result.status).toBe('remote_unavailable');
    expect(result.shouldCreateAnonymous).toBe(true);
    expect(result.canRecoverExisting).toBe(true);
  });

  it('recognizes an empty temporary anonymous session as recoverable', () => {
    const result = decide(
      local(),
      auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      }),
    );

    expect(result.status).toBe('anonymous_ready');
    expect(result.canRecoverExisting).toBe(true);
    expect(result.shouldCreateAnonymous).toBe(false);
  });

  it('provisionally binds a pristine empty install to the verified anonymous session', () => {
    const result = decide(
      local(),
      auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      }),
    );

    expect(result.bindProvisionalUserId).toBe('anon_a');
    expect(result.bindCurrentUserId).toBeNull();
    expect(result.status).toBe('anonymous_ready');
  });

  it('keeps a pristine provisional binding recoverable under its own session', () => {
    const result = decide(
      local({ ownerBinding: 'anon_a', ownerBindingProvisional: true }),
      auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      }),
    );

    expect(result.status).toBe('anonymous_ready');
    expect(result.canRecoverExisting).toBe(true);
    expect(result.canRecoverOwner).toBe(false);
    expect(result.canProtect).toBe(true);
  });

  it('starts a fresh temporary anonymous session when a pristine provisional session is lost', () => {
    const result = decide(local({ ownerBinding: 'anon_a', ownerBindingProvisional: true }));

    expect(result.status).toBe('recovery_required');
    expect(result.shouldCreateAnonymous).toBe(true);
    expect(result.canRecoverExisting).toBe(true);
    expect(result.canRecoverOwner).toBe(false);
  });

  it('fails closed when a different account is verified on a pristine provisional device', () => {
    const result = decide(
      local({ ownerBinding: 'anon_a', ownerBindingProvisional: true }),
      auth({ sessionUserId: 'user_b', verifiedUserId: 'user_b', verifiedIsAnonymous: false }),
    );

    expect(result.status).toBe('owner_mismatch');
    expect(result.bindCurrentUserId).toBeNull();
    expect(result.bindProvisionalUserId).toBeNull();
    expect(result.canRecoverExisting).toBe(true);
  });

  it('no longer allows replacement once a provisional binding has content', () => {
    const result = decide(
      local({
        hasUserData: true,
        activeUserDataCount: 1,
        ownerBinding: 'anon_a',
        ownerBindingProvisional: true,
      }),
      auth({
        sessionUserId: 'anon_a',
        sessionIsAnonymous: true,
        verifiedUserId: 'anon_a',
        verifiedIsAnonymous: true,
      }),
    );

    expect(result.status).toBe('anonymous_ready');
    expect(result.canRecoverExisting).toBe(false);
    expect(result.canRecoverOwner).toBe(false);
  });

  it('treats a populated permanent binding as non-replaceable', () => {
    const result = decide(
      local({ hasUserData: true, activeUserDataCount: 1, ownerBinding: 'user_a' }),
      auth({
        sessionUserId: 'user_a',
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'a@example.com',
      }),
    );

    expect(result.status).toBe('protected');
    expect(result.canRecoverExisting).toBe(false);
  });

  it('offers owner sign-back-in for a permanent binding only', () => {
    const permanent = decide(
      local({ hasUserData: true, ownerBinding: 'user_a' }),
      auth({ sessionUserId: 'user_b', verifiedUserId: null }),
    );
    expect(permanent.canRecoverOwner).toBe(true);

    const provisional = decide(
      local({ ownerBinding: 'anon_a', ownerBindingProvisional: true }),
      auth({ sessionUserId: 'user_b', verifiedUserId: null }),
    );
    expect(provisional.canRecoverOwner).toBe(false);
  });

  it('does not bind a pristine install to a verified permanent session', () => {
    const result = decide(
      local(),
      auth({ sessionUserId: 'user_b', verifiedUserId: 'user_b', verifiedIsAnonymous: false }),
    );

    expect(result.bindCurrentUserId).toBeNull();
    expect(result.bindProvisionalUserId).toBeNull();
    expect(result.status).toBe('protected');
  });

  it('legacy-binds data to a compatible verified session', () => {
    const result = decide(
      local({ hasUserData: true, activeUserDataCount: 1 }),
      auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }),
    );

    expect(result.bindCurrentUserId).toBe('user_a');
    expect(result.status).toBe('anonymous_ready');
  });

  it('reports a bound matching permanent account as protected', () => {
    const result = decide(
      local({ hasUserData: true, activeUserDataCount: 1, ownerBinding: 'user_a' }),
      auth({
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'a@example.com',
      }),
    );

    expect(result.status).toBe('protected');
    expect(result.canProtect).toBe(false);
  });

  it('requires recovery when a bound dataset has no verified session', () => {
    const result = decide(local({ hasUserData: true, ownerBinding: 'user_a' }));

    expect(result.status).toBe('recovery_required');
    expect(result.shouldCreateAnonymous).toBe(false);
    expect(result.canRecoverOwner).toBe(true);
  });

  it('fails closed on a verified owner mismatch', () => {
    const result = decide(
      local({ hasUserData: true, ownerBinding: 'user_a' }),
      auth({ verifiedUserId: 'user_b', verifiedIsAnonymous: false }),
    );

    expect(result.status).toBe('owner_mismatch');
    expect(result.bindCurrentUserId).toBeNull();
    expect(result.canRecoverOwner).toBe(true);
  });

  it('uses a single historical outbox owner as recovery evidence', () => {
    const result = decide(
      local({ hasUserData: true, pendingOutboxCount: 1, outboxOwnerIds: ['user_a'] }),
    );

    expect(result.status).toBe('recovery_required');
    expect(result.seedOwnerUserId).toBe('user_a');
  });

  it('reports multiple historical outbox owners as a conflict', () => {
    const result = decide(
      local({
        hasUserData: true,
        pendingOutboxCount: 2,
        outboxOwnerIds: ['user_a', 'user_b'],
      }),
    );

    expect(result.status).toBe('account_conflict');
    expect(result.shouldCreateAnonymous).toBe(false);
  });

  it('does not bind a current session when pending outbox ownership is unknown', () => {
    const result = decide(
      local({ hasUserData: true, pendingOutboxCount: 1, unownedOutboxCount: 1 }),
    );

    expect(result.status).toBe('legacy_owner_unknown');
    expect(result.bindCurrentUserId).toBeNull();
    expect(result.shouldCreateAnonymous).toBe(false);
  });

  it('binds legacy unowned outbox rows when the verified session is the only owner evidence', () => {
    const result = decide(
      local({ hasUserData: true, pendingOutboxCount: 1, unownedOutboxCount: 1 }),
      auth({ verifiedUserId: 'user_a', verifiedIsAnonymous: true }),
    );

    expect(result.status).toBe('anonymous_ready');
    expect(result.bindCurrentUserId).toBe('user_a');
    expect(result.shouldCreateAnonymous).toBe(false);
  });

  it('does not assign a dataset to a session when legacy evidence disagrees', () => {
    const result = decide(
      local({ hasUserData: true, pendingOutboxCount: 1, outboxOwnerIds: ['user_a'] }),
      auth({ verifiedUserId: 'user_b', verifiedIsAnonymous: false }),
    );

    expect(result.status).toBe('owner_mismatch');
    expect(result.bindCurrentUserId).toBeNull();
  });

  it('distinguishes local-only and remote-disabled states', () => {
    expect(
      decideAccountState({
        configured: false,
        remoteEnabled: true,
        local: local(),
        auth: auth(),
      }).status,
    ).toBe('not_configured');
    expect(
      decideAccountState({
        configured: true,
        remoteEnabled: false,
        local: local({ hasUserData: true }),
        auth: auth(),
      }).status,
    ).toBe('remote_disabled');
  });
});

describe('imported-owner recovery state', () => {
  const populated = local({ hasUserData: true });

  it('surfaces imported-owner recovery on a populated unbound dataset with a recorded fingerprint and no session', () => {
    const result = decideWithImport(populated, auth(), FP_A);
    expect(result.status).toBe('legacy_owner_unknown');
    expect(result.canRecoverImportedOwner).toBe(true);
    expect(result.canRecoverExisting).toBe(false);
    expect(result.canRecoverOwner).toBe(false);
  });

  it('surfaces imported-owner recovery while a wrong anonymous session T remains signed in', () => {
    const result = decideWithImport(
      populated,
      auth({
        sessionUserId: 'temp-t',
        sessionIsAnonymous: true,
        verifiedUserId: 'temp-t',
        verifiedIsAnonymous: true,
      }),
      FP_A,
    );
    expect(result.status).toBe('owner_mismatch');
    expect(result.canRecoverImportedOwner).toBe(true);
  });

  it('hides the recovery form when a wrong NON-anonymous account is verified', () => {
    const result = decideWithImport(
      populated,
      auth({
        sessionUserId: 'user_b',
        sessionIsAnonymous: false,
        verifiedUserId: 'user_b',
        verifiedIsAnonymous: false,
        verifiedEmail: 'b@example.com',
      }),
      FP_A,
    );
    expect(result.status).toBe('owner_mismatch');
    expect(result.canRecoverImportedOwner).toBe(false);
  });

  it('auto-binds the matching verified account without a recovery form', () => {
    const result = decideWithImport(
      populated,
      auth({
        sessionUserId: 'user_a',
        sessionIsAnonymous: false,
        verifiedUserId: 'user_a',
        verifiedIsAnonymous: false,
        verifiedEmail: 'a@example.com',
      }),
      FP_A,
    );
    expect(result.status).toBe('protected');
    expect(result.bindCurrentUserId).toBe('user_a');
    expect(result.canRecoverImportedOwner).toBe(false);
  });

  it('never grants the exception to a local-only portable import (no fingerprint)', () => {
    const result = decideWithImport(populated, auth(), null);
    expect(result.canRecoverImportedOwner).toBe(false);
  });

  it('never grants the exception to a malformed fingerprint', () => {
    const result = decideWithImport(populated, auth(), 'not-a-fingerprint');
    expect(result.canRecoverImportedOwner).toBe(false);
  });

  it('never grants the exception while the dataset is owner-bound', () => {
    const result = decideWithImport(
      local({ hasUserData: true, ownerBinding: 'user_b' }),
      auth(),
      FP_A,
    );
    expect(result.canRecoverImportedOwner).toBe(false);
  });

  it('never grants the exception when another account has pending outbox work', () => {
    const result = decideWithImport(
      local({ hasUserData: true, pendingOutboxCount: 1, outboxOwnerIds: ['user_b'] }),
      auth(),
      FP_A,
    );
    expect(result.canRecoverImportedOwner).toBe(false);
  });

  it('never grants the exception on an empty dataset even with a recorded fingerprint', () => {
    const result = decideWithImport(local(), auth(), FP_A);
    expect(result.canRecoverImportedOwner).toBe(false);
  });

  it('does not grant the capability when remote backup is not configured or disabled', () => {
    const notConfigured = decideAccountState({
      configured: false,
      remoteEnabled: true,
      local: populated,
      auth: auth(),
      importOriginOwnerFingerprint: FP_A,
    });
    expect(notConfigured.canRecoverImportedOwner).toBe(false);
    const remoteDisabled = decideAccountState({
      configured: true,
      remoteEnabled: false,
      local: populated,
      auth: auth(),
      importOriginOwnerFingerprint: FP_A,
    });
    expect(remoteDisabled.canRecoverImportedOwner).toBe(false);
  });

  it('keeps FP_B out: only the recorded fingerprint grants the exception', () => {
    const result = decideWithImport(populated, auth(), FP_B);
    expect(result.canRecoverImportedOwner).toBe(true);
  });
});

describe('account input validation', () => {
  it('accepts ordinary email addresses and exactly six OTP digits', () => {
    expect(isValidAccountEmail('user@example.com')).toBe(true);
    expect(isValidAccountOtp('123456')).toBe(true);
    expect(isValidAccountOtp('12345')).toBe(false);
    expect(isValidAccountOtp('1234567')).toBe(false);
  });

  it('rejects malformed email and non-numeric OTP input', () => {
    expect(isValidAccountEmail('not-an-email')).toBe(false);
    expect(isValidAccountOtp('12ab56')).toBe(false);
  });
});
