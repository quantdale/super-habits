import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { AccountActionResult, AccountState } from '@/core/auth/account.types';
import { useAppTheme } from '@/core/providers/themeContext';
import type {
  RemoteBackupEntityStatus,
  RestorePreview,
  SyncBackedEntity,
} from '@/core/sync/restore.types';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { TextField } from '@/core/ui/TextField';
import { ValidationError } from '@/core/ui/ValidationError';
import type { OutboxSummary, SettingsStatusTone } from './settingsShared';
import { SettingsRow, SettingsSectionHeading, SettingsStatusPill } from './SettingsSharedUi';

const BACKUP_ACCENT = '#0f766e';

const RESTORE_ENTITY_ORDER: SyncBackedEntity[] = [
  'todos',
  'habits',
  'calorie_entries',
  'workout_routines',
];

const RESTORE_ENTITY_LABELS: Record<SyncBackedEntity, string> = {
  todos: 'Todos backup',
  habits: 'Habits backup',
  calorie_entries: 'Calories backup',
  workout_routines: 'Workout backup',
};

function formatBackupTime(value: string | null) {
  if (!value) return 'No restorable backup timestamp is available yet.';
  return new Date(value).toLocaleString();
}

function describeBackupEntity(status: RemoteBackupEntityStatus) {
  if (status.phaseOneStatus === 'excluded_in_phase_one') {
    const countLabel =
      status.remoteRowCount === null
        ? 'Remote status unavailable.'
        : `${status.remoteRowCount} remote rows.`;
    return `${countLabel} ${status.reason}`;
  }

  if (status.remoteState === 'available') {
    return `${status.remoteRowCount ?? 0} rows backed up.${status.latestUpdatedAt ? ` Latest change: ${formatBackupTime(status.latestUpdatedAt)}` : ''}`;
  }

  if (status.remoteState === 'empty') {
    return 'No remote rows are backed up for this entity yet.';
  }

  if (status.remoteState === 'unavailable') {
    return 'Remote backup is not configured in this build.';
  }

  return status.errorMessage
    ? `Backup status failed to load: ${status.errorMessage}`
    : 'Backup status failed to load.';
}

type SettingsBackupSectionProps = {
  outboxSummary: OutboxSummary;
  restorePreview: RestorePreview | null;
  restoreLoading: boolean;
  restoreRunning: boolean;
  restoreError: string | null;
  onRestore: () => void;
  accountState: AccountState;
  onProtectAccount: (email: string) => Promise<AccountActionResult>;
  onVerifyAccountProtection: (token: string) => Promise<AccountActionResult>;
  onResendAccountProtection: () => Promise<AccountActionResult>;
  onRequestAccountRecovery: (email: string) => Promise<AccountActionResult>;
  onVerifyAccountRecovery: (token: string) => Promise<AccountActionResult>;
  onResendAccountRecovery: () => Promise<AccountActionResult>;
};

export function SettingsBackupSection({
  outboxSummary,
  restorePreview,
  restoreLoading,
  restoreRunning,
  restoreError,
  onRestore,
  accountState,
  onProtectAccount,
  onVerifyAccountProtection,
  onResendAccountProtection,
  onRequestAccountRecovery,
  onVerifyAccountRecovery,
  onResendAccountRecovery,
}: SettingsBackupSectionProps) {
  const { tokens } = useAppTheme();

  const restoreButtonDisabled =
    restoreLoading ||
    restoreRunning ||
    !restorePreview ||
    restorePreview.eligibility.kind !== 'empty_device';
  const restoreButtonLabel = restoreRunning ? 'Restoring...' : 'Restore backup';

  const latestBackupStatusLabel = restoreLoading
    ? 'Loading'
    : restorePreview?.remoteAvailable
      ? 'Available'
      : restorePreview?.eligibility.kind === 'blocked' &&
          restorePreview.eligibility.reason === 'remote_disabled'
        ? 'Local only'
        : 'Not ready';

  const latestBackupStatusTone: SettingsStatusTone =
    latestBackupStatusLabel === 'Available'
      ? 'accent'
      : latestBackupStatusLabel === 'Loading'
        ? 'neutral'
        : latestBackupStatusLabel === 'Local only'
          ? 'warning'
          : 'neutral';

  const restoreEligibilityLabel = restoreLoading
    ? 'Loading'
    : restorePreview?.eligibility.kind === 'empty_device'
      ? 'Allowed'
      : 'Blocked';

  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="Backup / Sync / Restore"
        title="Backup status and restore"
        subtitle="Remote backup status and phase-one restore. This is backup sync, not full two-way sync."
        icon="cloud-sync"
        accentColor={BACKUP_ACCENT}
      />
      <View className="gap-3">
        <SettingsAccountCard
          accountState={accountState}
          onProtectAccount={onProtectAccount}
          onVerifyAccountProtection={onVerifyAccountProtection}
          onResendAccountProtection={onResendAccountProtection}
          onRequestAccountRecovery={onRequestAccountRecovery}
          onVerifyAccountRecovery={onVerifyAccountRecovery}
          onResendAccountRecovery={onResendAccountRecovery}
        />
        <Card accentColor={BACKUP_ACCENT} className="mb-0">
          <SettingsRow
            first
            label="Outbox sync"
            description={outboxSummary.description}
            statusLabel={outboxSummary.statusLabel}
            statusTone={outboxSummary.statusTone}
            accentColor={BACKUP_ACCENT}
          />
          <SettingsRow
            label="Latest restorable backup"
            description={
              restoreLoading
                ? 'Checking remote backup status...'
                : formatBackupTime(restorePreview?.latestRestorableBackupAt ?? null)
            }
            statusLabel={latestBackupStatusLabel}
            statusTone={latestBackupStatusTone}
            accentColor={BACKUP_ACCENT}
          />
          <SettingsRow
            label="Restore rule"
            description={
              restoreLoading
                ? 'Checking whether this device is still eligible for phase-one restore.'
                : (restorePreview?.eligibility.message ?? 'Backup status is not available yet.')
            }
            statusLabel={restoreEligibilityLabel}
            statusTone={
              restoreEligibilityLabel === 'Allowed'
                ? 'accent'
                : restoreEligibilityLabel === 'Blocked'
                  ? 'warning'
                  : 'neutral'
            }
            accentColor={BACKUP_ACCENT}
          />
          <SettingsRow
            label="Current backup model"
            description="Backups push synced rows to the remote account. Restore is cautious and empty-device only in this phase, so this page should not be read as full sync or merge support."
            statusLabel="Backup"
            last
          />

          <ValidationError message={restoreError} />
          <Button
            label={restoreButtonLabel}
            onPress={onRestore}
            disabled={restoreButtonDisabled}
            color={BACKUP_ACCENT}
          />
        </Card>

        <Card accentColor={BACKUP_ACCENT} className="mb-0">
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Phase-one coverage
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            The backup feed covers more than the current restore scope. The rows below show what is
            backed up and what this phase can actually restore.
          </Text>

          <View className="mt-4">
            {RESTORE_ENTITY_ORDER.map((entity, index) => (
              <SettingsRow
                key={entity}
                first={index === 0}
                last={index === RESTORE_ENTITY_ORDER.length - 1}
                label={RESTORE_ENTITY_LABELS[entity]}
                description={
                  restoreLoading || !restorePreview
                    ? 'Checking backup coverage...'
                    : describeBackupEntity(restorePreview.entityStatuses[entity])
                }
                statusLabel={
                  restoreLoading || !restorePreview
                    ? 'Loading'
                    : restorePreview.entityStatuses[entity].phaseOneStatus ===
                        'excluded_in_phase_one'
                      ? 'Excluded'
                      : restorePreview.entityStatuses[entity].remoteState === 'available'
                        ? 'Backed up'
                        : restorePreview.entityStatuses[entity].remoteState === 'empty'
                          ? 'Empty'
                          : 'Unavailable'
                }
                statusTone={
                  restoreLoading || !restorePreview
                    ? 'neutral'
                    : restorePreview.entityStatuses[entity].phaseOneStatus ===
                        'excluded_in_phase_one'
                      ? 'warning'
                      : restorePreview.entityStatuses[entity].remoteState === 'available'
                        ? 'accent'
                        : 'neutral'
                }
                accentColor={BACKUP_ACCENT}
              />
            ))}
          </View>

          {restorePreview ? (
            <View
              className="mt-4 rounded-2xl border px-4 py-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
            >
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                Current restore disclosures
              </Text>
              {restorePreview.disclosures.map((item) => (
                <Text
                  key={item}
                  className="mt-2 text-sm leading-6"
                  style={{ color: tokens.textMuted }}
                >
                  {item}
                </Text>
              ))}
            </View>
          ) : null}

          {restorePreview?.warnings.length ? (
            <View
              className="mt-3 rounded-2xl border px-4 py-3"
              style={{
                borderColor: tokens.warningBorder,
                backgroundColor: tokens.warningBackground,
              }}
            >
              <Text className="text-sm font-semibold" style={{ color: tokens.warningText }}>
                Warnings
              </Text>
              {restorePreview.warnings.map((warning) => (
                <Text
                  key={warning}
                  className="mt-2 text-sm leading-6"
                  style={{ color: tokens.warningText }}
                >
                  {warning}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      </View>
    </ScreenSection>
  );
}

function maskAccountEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(1, Math.min(local.length - 1, 5)))}@${domain}`;
}

function accountStatusLabel(accountState: AccountState): string {
  switch (accountState.status) {
    case 'not_configured':
      return 'Unavailable';
    case 'remote_disabled':
      return 'Local only';
    case 'anonymous_ready':
      return 'Anonymous / unprotected';
    case 'protection_pending':
      return 'Verification pending';
    case 'protected':
      return 'Protected';
    case 'sign_in_pending':
      return 'Sign-in pending';
    case 'recovery_required':
    case 'legacy_owner_unknown':
      return 'Recovery required';
    case 'owner_mismatch':
      return 'Account mismatch';
    case 'account_conflict':
      return 'Account conflict';
    case 'remote_unavailable':
      return 'Remote unavailable';
    case 'error':
      return 'Unavailable';
  }
}

function accountStatusTone(accountState: AccountState): SettingsStatusTone {
  if (accountState.status === 'protected') return 'accent';
  if (accountState.status === 'anonymous_ready') return 'warning';
  if (
    accountState.status === 'owner_mismatch' ||
    accountState.status === 'account_conflict' ||
    accountState.status === 'recovery_required' ||
    accountState.status === 'legacy_owner_unknown'
  ) {
    return 'danger';
  }
  return 'neutral';
}

function SettingsAccountCard({
  accountState,
  onProtectAccount,
  onVerifyAccountProtection,
  onResendAccountProtection,
  onRequestAccountRecovery,
  onVerifyAccountRecovery,
  onResendAccountRecovery,
}: Omit<
  SettingsBackupSectionProps,
  | 'outboxSummary'
  | 'restorePreview'
  | 'restoreLoading'
  | 'restoreRunning'
  | 'restoreError'
  | 'onRestore'
>) {
  const { tokens } = useAppTheme();
  const [protectEmail, setProtectEmail] = useState('');
  const [protectCode, setProtectCode] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!accountState.resendAvailableAt) return undefined;
    const intervalId = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(intervalId);
  }, [accountState.resendAvailableAt]);

  const protectionPending = accountState.status === 'protection_pending';
  const recoveryPending = accountState.status === 'sign_in_pending';
  const ownerRecovery = accountState.canRecoverOwner;
  const canRequestRecovery = accountState.canRecoverExisting || accountState.canRecoverOwner;
  const resendRemaining = accountState.resendAvailableAt
    ? Math.max(0, Math.ceil((accountState.resendAvailableAt - now) / 1_000))
    : 0;
  const resendDisabled = busy || resendRemaining > 0;

  const runAction = async (action: () => Promise<AccountActionResult>) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await action();
      if (result.ok) setActionMessage(result.message);
      else setActionError(result.message);
    } catch {
      setActionError('We could not complete that account action. Your local data was not changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card accentColor={BACKUP_ACCENT} className="mb-0">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold" style={{ color: tokens.text }}>
            Backup identity
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            {accountState.message}
          </Text>
        </View>
        <View className="shrink-0">
          <SettingsStatusPill
            label={accountStatusLabel(accountState)}
            tone={accountStatusTone(accountState)}
            accentColor={BACKUP_ACCENT}
          />
        </View>
      </View>

      {accountState.status === 'protected' && accountState.email ? (
        <Text className="mt-3 text-sm" style={{ color: tokens.text }}>
          Email: {maskAccountEmail(accountState.email) ?? 'Protected email'}
        </Text>
      ) : null}

      <ValidationError message={actionError} />
      {actionMessage ? (
        <Text className="mt-3 text-sm leading-6" style={{ color: tokens.textMuted }}>
          {actionMessage}
        </Text>
      ) : null}

      {accountState.canProtect && !protectionPending ? (
        <View className="mt-4">
          <TextField
            label="Email for backup recovery"
            value={protectEmail}
            onChangeText={setProtectEmail}
            placeholder="you@example.com"
            keyboardType="default"
            accessibilityLabel="Email for backup recovery"
          />
          <Button
            label={busy ? 'Sending...' : 'Protect backup with email'}
            onPress={() => runAction(() => onProtectAccount(protectEmail))}
            disabled={busy}
            color={BACKUP_ACCENT}
          />
        </View>
      ) : null}

      {protectionPending ? (
        <View className="mt-4">
          <TextField
            label="Six-digit verification code"
            value={protectCode}
            onChangeText={setProtectCode}
            placeholder="123456"
            unsignedInteger
            accessibilityLabel="Backup protection verification code"
          />
          <View className="gap-2">
            <Button
              label={busy ? 'Verifying...' : 'Verify email'}
              onPress={() => runAction(() => onVerifyAccountProtection(protectCode))}
              disabled={busy}
              color={BACKUP_ACCENT}
            />
            <Button
              label={resendRemaining > 0 ? `Resend code in ${resendRemaining}s` : 'Resend code'}
              onPress={() => runAction(onResendAccountProtection)}
              disabled={resendDisabled}
              variant="ghost"
            />
          </View>
        </View>
      ) : null}

      {canRequestRecovery && !recoveryPending ? (
        <View className="mt-5 border-t pt-4" style={{ borderColor: tokens.border }}>
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            {ownerRecovery ? 'Sign back into this device account' : 'Recover existing backup'}
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            {ownerRecovery
              ? 'Use the email that protects this device’s backup. Local data stays available while remote backup is paused.'
              : 'On a new or empty device, sign in to an existing protected account. Account merging is not supported.'}
          </Text>
          <View className="mt-3">
            <TextField
              label="Protected account email"
              value={recoveryEmail}
              onChangeText={setRecoveryEmail}
              placeholder="you@example.com"
              accessibilityLabel="Protected account email"
            />
            <Button
              label={
                busy
                  ? 'Sending...'
                  : ownerRecovery
                    ? 'Send sign-in code'
                    : 'Recover existing backup'
              }
              onPress={() => runAction(() => onRequestAccountRecovery(recoveryEmail))}
              disabled={busy}
              color={BACKUP_ACCENT}
            />
          </View>
        </View>
      ) : null}

      {recoveryPending ? (
        <View className="mt-4">
          <TextField
            label="Six-digit sign-in code"
            value={recoveryCode}
            onChangeText={setRecoveryCode}
            placeholder="123456"
            unsignedInteger
            accessibilityLabel="Account recovery verification code"
          />
          <View className="gap-2">
            <Button
              label={busy ? 'Signing in...' : 'Sign in and continue'}
              onPress={() => runAction(() => onVerifyAccountRecovery(recoveryCode))}
              disabled={busy}
              color={BACKUP_ACCENT}
            />
            <Button
              label={resendRemaining > 0 ? `Resend code in ${resendRemaining}s` : 'Resend code'}
              onPress={() => runAction(onResendAccountRecovery)}
              disabled={resendDisabled}
              variant="ghost"
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}
