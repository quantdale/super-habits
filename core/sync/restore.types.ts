import type { CalorieEntry, Habit, Todo } from '@/core/db/types';

export const RESTORE_SCOPED_ENTITIES = ['todos', 'habits', 'calorie_entries'] as const;

export const SYNC_BACKED_ENTITIES = [...RESTORE_SCOPED_ENTITIES, 'workout_routines'] as const;

export type RestoreScopedEntity = (typeof RESTORE_SCOPED_ENTITIES)[number];
export type SyncBackedEntity = (typeof SYNC_BACKED_ENTITIES)[number];
export type BackupFreshnessSignature = string;

export type RemoteBackupEntityState = 'available' | 'empty' | 'unavailable' | 'error';

export type RemoteBackupEntityStatus = {
  entity: SyncBackedEntity;
  phaseOneRestorable: boolean;
  phaseOneStatus: 'included' | 'excluded_in_phase_one';
  remoteState: RemoteBackupEntityState;
  remoteRowCount: number | null;
  latestUpdatedAt: string | null;
  reason: string | null;
  errorMessage: string | null;
};

export type LocalSyncBackedCounts = Record<SyncBackedEntity, number>;

/** Backup completeness state shown in Settings and the startup prompt. */
export type BackupCoverageState =
  | 'v2_complete'
  | 'v1_legacy'
  /**
   * The remote did not answer, so its backup generation is unestablished. This
   * is NOT the same as legacy: claiming legacy promises that most of the
   * dataset is absent, which is a claim we could not make.
   */
  | 'unknown'
  /**
   * At least one outbox record can never push, so this backup is permanently
   * incomplete. Distinct from `in_progress`, which promises the work is still
   * moving.
   */
  | 'blocked'
  | 'in_progress'
  | 'invalid'
  | 'unavailable';

export type RestoreEligibility =
  | {
      kind: 'empty_device';
      message: string;
      localCounts: LocalSyncBackedCounts;
    }
  | {
      kind: 'blocked';
      reason:
        'local_data_present' | 'remote_backup_unavailable' | 'remote_disabled' | 'owner_mismatch';
      message: string;
      localCounts: LocalSyncBackedCounts;
    };

export type RestorePreview = {
  remoteAvailable: boolean;
  latestRestorableBackupAt: string | null;
  freshnessSignature: BackupFreshnessSignature | null;
  dismissedForCurrentBackup: boolean;
  startupPromptEligible: boolean;
  eligibility: RestoreEligibility;
  entityStatuses: Record<SyncBackedEntity, RemoteBackupEntityStatus>;
  warnings: string[];
  disclosures: string[];
  /** Backup Completeness V2 state. */
  backupState: BackupCoverageState;
  lastCompleteBackupAt: string | null;
  /** Entity groups the manifest did not cover, disclosed rather than hidden. */
  missingEntities: string[];
  recoverableAreas: string[];
  pendingChangeCount: number;
  backfillInProgress: boolean;
};

export type RestoreExecutionResult =
  | {
      status: 'blocked';
      preview: RestorePreview;
      message?: string;
    }
  | {
      status: 'invalid';
      message: string;
      diagnostics: string[];
      preview: RestorePreview;
    }
  | {
      status: 'restored';
      restoredAt: string;
      freshnessSignature: BackupFreshnessSignature;
      importedCounts: Record<string, number>;
    };

export type RemoteRestoreRowMap = {
  todos: Todo;
  habits: Habit;
  calorie_entries: CalorieEntry;
};
