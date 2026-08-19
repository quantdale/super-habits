import type * as SQLite from 'expo-sqlite';

export const ACCOUNT_USER_TABLES = [
  'todos',
  'habits',
  'habit_completions',
  'pomodoro_sessions',
  'workout_routines',
  'routine_exercises',
  'routine_exercise_sets',
  'workout_logs',
  'workout_session_exercises',
  'calorie_entries',
  'saved_meals',
  'linked_action_rules',
  'linked_action_events',
  'linked_action_executions',
  'weekly_reviews',
  'projects',
  'goals',
  'daily_plans',
] as const;

export type AccountUserTable = (typeof ACCOUNT_USER_TABLES)[number];

export type LocalTableCount = {
  total: number;
  active: number;
  deleted: number;
};

export type LocalAccountDataState = {
  counts: Record<AccountUserTable, LocalTableCount>;
  activeUserDataCount: number;
  deletedUserDataCount: number;
  hasUserData: boolean;
  pendingOutboxCount: number;
  unownedOutboxCount: number;
  outboxOwnerIds: string[];
  ownerBinding: string | null;
  /**
   * True when the owner binding was created for a temporary anonymous session
   * on a pristine device and is still replaceable by Recover Existing. Any
   * meaningful local content promotes the binding to permanent.
   */
  ownerBindingProvisional: boolean;
};

export type AccountAuthEvidence = {
  sessionUserId: string | null;
  sessionIsAnonymous: boolean | null;
  verifiedUserId: string | null;
  verifiedIsAnonymous: boolean | null;
  verifiedEmail: string | null;
};

export type AccountStatus =
  | 'not_configured'
  | 'remote_disabled'
  | 'anonymous_ready'
  | 'protected'
  | 'protection_pending'
  | 'sign_in_pending'
  | 'recovery_required'
  | 'legacy_owner_unknown'
  | 'owner_mismatch'
  | 'account_conflict'
  | 'remote_unavailable'
  | 'error';

export type AccountState = {
  status: AccountStatus;
  email: string | null;
  isAnonymous: boolean | null;
  hasOwnerBinding: boolean;
  hasUserData: boolean;
  pendingOutboxCount: number;
  canProtect: boolean;
  canRecoverExisting: boolean;
  canRecoverOwner: boolean;
  /**
   * Narrow imported-owner recovery transition: true only for a populated,
   * locally UNBOUND dataset that was validated as a Portable Import V1 file
   * carrying a source-owner fingerprint. The matching source account (the one
   * whose verified UID hashes to the recorded fingerprint) may sign in and
   * claim the dataset; any other account fails closed. Never true for generic
   * populated-device account switching or local-only imports.
   */
  canRecoverImportedOwner: boolean;
  message: string;
  resendAvailableAt: number | null;
};

export type AccountActionResult = {
  ok: boolean;
  status: AccountStatus;
  message: string;
};

export type AccountRemoteFingerprint = {
  /** Diagnostics only — never used as a security invariant. */
  counts: Record<string, number>;
  ownerIds: string[];
};

export type PendingProtection = {
  email: string;
  originalUserId: string;
  requestedAt: string;
  /**
   * Legacy snapshot fields kept only for records written before protection
   * switched to ownership-only verification. New records omit them.
   */
  beforeOutboxOwnerIds?: string[];
  beforePendingOutboxCount?: number;
  beforeRemoteFingerprint?: AccountRemoteFingerprint | null;
};

export type PendingRecovery = {
  email: string;
  requestedAt: string;
  temporarySessionUserId: string | null;
  /**
   * Owner sign-back-in evidence: set only for a permanent local owner binding.
   * For imported-owner recovery the owner is unbound, so this stays null and
   * `expectedOwnerFingerprint` carries the recorded source fingerprint instead.
   */
  expectedOwnerUserId: string | null;
  /**
   * Imported-owner recovery evidence: the recorded portable import source
   * fingerprint. Set only when recovery was requested for a populated unbound
   * dataset carrying a validated import-origin fingerprint. Exactly one of
   * `expectedOwnerUserId` / `expectedOwnerFingerprint` may be non-null (both
   * are null for pristine-device fresh recovery).
   */
  expectedOwnerFingerprint: string | null;
};

export type AccountCoordinatorDependencies = {
  isConfigured: () => boolean;
  isRemoteEnabled: () => boolean;
  getAuthEvidence: () => Promise<AccountAuthEvidence>;
  ensureAnonymousSession: () => Promise<void>;
  requestEmailProtection: (email: string) => Promise<void>;
  verifyEmailChangeOtp: (email: string, token: string) => Promise<void>;
  resendEmailChange: (email: string) => Promise<void>;
  requestExistingAccountRecovery: (email: string) => Promise<void>;
  resendExistingAccountRecovery: (email: string) => Promise<void>;
  verifyExistingAccountOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  getRemoteFingerprint: (userId: string) => Promise<AccountRemoteFingerprint>;
  now: () => Date;
  getDatabase?: () => Promise<SQLite.SQLiteDatabase>;
};
