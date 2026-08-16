import { describe, expect, it } from 'vitest';
import { decideAccountState } from '@/core/auth/account.domain';
import type { AccountAuthEvidence, LocalAccountDataState } from '@/core/auth/account.types';
import { portableOwnerFingerprint } from '@/lib/portableOwnerFingerprint';

/**
 * Portable Import V1 ownership protection: a dataset that was imported from
 * another device's backup records the source owner fingerprint; the account
 * coordinator must fail closed against any unrelated verified account and
 * allow only the matching account to bind the dataset.
 */

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

const OWNER_A = '11111111-2222-3333-4444-555555555555';
const OWNER_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const FP_A = portableOwnerFingerprint(OWNER_A);

/** Populated local dataset, no binding (typical post-import state). */
function populated(): LocalAccountDataState {
  return local({
    hasUserData: true,
    activeUserDataCount: 5,
    counts: { ...emptyCounts, todos: { total: 5, active: 5, deleted: 0 } },
  });
}

function decide(
  localState: LocalAccountDataState,
  authState: AccountAuthEvidence = auth(),
  importOriginOwnerFingerprint: string | null = null,
) {
  return decideAccountState({
    configured: true,
    remoteEnabled: true,
    local: localState,
    auth: authState,
    importOriginOwnerFingerprint,
  });
}

describe('portable import-origin owner gating', () => {
  it('blocks an unrelated verified account from binding an imported dataset', () => {
    const result = decide(
      populated(),
      auth({ verifiedUserId: OWNER_B, verifiedIsAnonymous: false }),
      FP_A,
    );
    expect(result.status).toBe('owner_mismatch');
    expect(result.bindCurrentUserId).toBeNull();
    expect(result.canProtect).toBe(false);
    expect(result.canRecoverExisting).toBe(false);
    expect(result.message).toMatch(/imported from another backup account/);
  });

  it('allows the matching account to bind an imported dataset', () => {
    const result = decide(
      populated(),
      auth({ verifiedUserId: OWNER_A, verifiedIsAnonymous: false }),
      FP_A,
    );
    expect(result.status).toBe('protected');
    expect(result.bindCurrentUserId).toBe(OWNER_A);
  });

  it('allows the matching anonymous session to bind an imported dataset', () => {
    const result = decide(
      populated(),
      auth({ verifiedUserId: OWNER_A, verifiedIsAnonymous: true }),
      FP_A,
    );
    expect(result.status).toBe('anonymous_ready');
    expect(result.bindCurrentUserId).toBe(OWNER_A);
    expect(result.canProtect).toBe(true);
  });

  it('keeps legacy behavior when no import origin is recorded', () => {
    // Without a recorded origin fingerprint, populated unbound data still
    // binds the first verified account (legacy semantics).
    const result = decide(
      populated(),
      auth({ verifiedUserId: OWNER_B, verifiedIsAnonymous: false }),
      null,
    );
    expect(result.status).toBe('protected');
    expect(result.bindCurrentUserId).toBe(OWNER_B);
  });

  it('does not restrict a dataset imported from a local-only source file', () => {
    // A file with no source fingerprint records `null`; any account may bind
    // the data exactly like legacy local data.
    const result = decide(
      populated(),
      auth({ verifiedUserId: OWNER_B, verifiedIsAnonymous: false }),
      null,
    );
    expect(result.bindCurrentUserId).toBe(OWNER_B);
  });

  it('reports the import origin when no account is signed in', () => {
    const result = decide(populated(), auth(), FP_A);
    expect(result.status).toBe('legacy_owner_unknown');
    expect(result.message).toMatch(/imported from another device/);
    expect(result.canRecoverExisting).toBe(false);
    expect(result.canProtect).toBe(false);
  });

  it('keeps legacy message when populated unbound data has no import origin', () => {
    const result = decide(populated(), auth());
    expect(result.status).toBe('legacy_owner_unknown');
    expect(result.message).toMatch(/no recoverable owner evidence/);
  });

  it('does not affect owner-bound devices (import origin only matters pre-binding)', () => {
    const boundToA = local({ ownerBinding: OWNER_A, hasUserData: true, activeUserDataCount: 5 });
    const result = decide(
      boundToA,
      auth({ verifiedUserId: OWNER_A, verifiedIsAnonymous: false }),
      FP_A,
    );
    expect(result.status).toBe('protected');
    expect(result.canProtect).toBe(false);
  });

  it('does not affect pristine devices (no content to claim)', () => {
    const pristine = local({ ownerBindingProvisional: true, ownerBinding: OWNER_B });
    const result = decide(
      pristine,
      auth({ verifiedUserId: OWNER_B, verifiedIsAnonymous: true }),
      FP_A,
    );
    expect(result.status).toBe('anonymous_ready');
    expect(result.bindCurrentUserId).toBeNull(); // provisional already bound
    expect(result.canRecoverExisting).toBe(true);
  });
});
