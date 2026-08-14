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
  message: string;
  resendAvailableAt: number | null;
};

export type AccountActionResult = {
  ok: boolean;
  status: AccountStatus;
  message: string;
};

export type AccountRemoteFingerprint = {
  counts: Record<string, number>;
  ownerIds: string[];
};

export type PendingProtection = {
  email: string;
  originalUserId: string;
  requestedAt: string;
  beforeOutboxOwnerIds: string[];
  beforePendingOutboxCount: number;
  beforeRemoteFingerprint: AccountRemoteFingerprint | null;
};

export type PendingRecovery = {
  email: string;
  requestedAt: string;
  temporarySessionUserId: string | null;
  expectedOwnerUserId: string | null;
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
