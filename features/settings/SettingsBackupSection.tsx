import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import type {
  RemoteBackupEntityStatus,
  RestorePreview,
  SyncBackedEntity,
} from '@/core/sync/restore.types';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { ValidationError } from '@/core/ui/ValidationError';
import type { OutboxSummary, SettingsStatusTone } from './settingsShared';
import { SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

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
};

export function SettingsBackupSection({
  outboxSummary,
  restorePreview,
  restoreLoading,
  restoreRunning,
  restoreError,
  onRestore,
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
