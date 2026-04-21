import type { CalorieEntry, Habit, Todo } from "@/core/db/types";

export const RESTORE_SCOPED_ENTITIES = [
  "todos",
  "habits",
  "calorie_entries",
] as const;

export const SYNC_BACKED_ENTITIES = [
  ...RESTORE_SCOPED_ENTITIES,
  "workout_routines",
] as const;

export type RestoreScopedEntity = (typeof RESTORE_SCOPED_ENTITIES)[number];
export type SyncBackedEntity = (typeof SYNC_BACKED_ENTITIES)[number];
export type BackupFreshnessSignature = string;

export type RemoteBackupEntityState =
  | "available"
  | "empty"
  | "unavailable"
  | "error";

export type RemoteBackupEntityStatus = {
  entity: SyncBackedEntity;
  phaseOneRestorable: boolean;
  phaseOneStatus: "included" | "excluded_in_phase_one";
  remoteState: RemoteBackupEntityState;
  remoteRowCount: number | null;
  latestUpdatedAt: string | null;
  reason: string | null;
  errorMessage: string | null;
};

export type LocalSyncBackedCounts = Record<SyncBackedEntity, number>;

export type RestoreEligibility =
  | {
      kind: "empty_device";
      message: string;
      localCounts: LocalSyncBackedCounts;
    }
  | {
      kind: "blocked";
      reason:
        | "local_data_present"
        | "remote_backup_unavailable"
        | "remote_disabled";
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
};

export type RestoreExecutionResult =
  | {
      status: "blocked";
      preview: RestorePreview;
    }
  | {
      status: "restored";
      restoredAt: string;
      freshnessSignature: BackupFreshnessSignature;
      importedCounts: Record<RestoreScopedEntity, number>;
    };

export type RemoteRestoreRowMap = {
  todos: Todo;
  habits: Habit;
  calorie_entries: CalorieEntry;
};
