import { appMetaKeys, getAppMetaText, setAppMetaText } from "@/core/db/appMeta";
import { getDatabase } from "@/core/db/client";
import { applyRemoteCalorieEntries } from "@/features/calories/calories.data";
import { applyRemoteHabits } from "@/features/habits/habits.data";
import { applyRemoteTodos } from "@/features/todos/todos.data";
import { isRemoteEnabled, supabase } from "@/lib/supabase";
import { nowIso } from "@/lib/time";
import type {
  BackupFreshnessSignature,
  LocalSyncBackedCounts,
  RemoteBackupEntityStatus,
  RemoteRestoreRowMap,
  RestoreEligibility,
  RestoreExecutionResult,
  RestorePreview,
  RestoreScopedEntity,
  SyncBackedEntity,
} from "@/core/sync/restore.types";
import {
  RESTORE_SCOPED_ENTITIES,
  SYNC_BACKED_ENTITIES,
} from "@/core/sync/restore.types";

const RESTORE_SCOPE_VERSION = "phase_one_restore_v1";
const PAGE_SIZE = 1_000;
const WORKOUT_RESTORE_EXCLUSION_REASON =
  "Workout routines are excluded in this phase because nested routine structure is not synced yet.";

type RemoteMeta = Pick<
  RemoteBackupEntityStatus,
  "remoteState" | "remoteRowCount" | "latestUpdatedAt" | "errorMessage"
>;

type RemoteUpdatedRow = {
  updated_at: string | null;
};

function buildBlockedEligibility(
  reason:
    | "local_data_present"
    | "remote_backup_unavailable"
    | "remote_disabled",
  message: string,
  localCounts: LocalSyncBackedCounts,
): RestoreEligibility {
  return {
    kind: "blocked",
    reason,
    message,
    localCounts,
  };
}

function getOrderedStatusEntries(
  statuses: Record<SyncBackedEntity, RemoteBackupEntityStatus>,
) {
  return SYNC_BACKED_ENTITIES.map((entity) => statuses[entity]);
}

function computeFreshnessSignature(
  statuses: Record<SyncBackedEntity, RemoteBackupEntityStatus>,
): BackupFreshnessSignature | null {
  const relevant = RESTORE_SCOPED_ENTITIES.map((entity) => {
    const status = statuses[entity];
    return {
      entity,
      remoteState: status.remoteState,
      remoteRowCount: status.remoteRowCount ?? 0,
      latestUpdatedAt: status.latestUpdatedAt,
    };
  });

  const hasRemoteBackup = relevant.some(
    (status) =>
      status.remoteState === "available" && (status.remoteRowCount ?? 0) > 0,
  );
  if (!hasRemoteBackup) return null;

  return JSON.stringify({
    version: RESTORE_SCOPE_VERSION,
    entities: relevant,
  });
}

function buildWarnings(
  statuses: Record<SyncBackedEntity, RemoteBackupEntityStatus>,
): string[] {
  const warnings: string[] = [];
  const workoutStatus = statuses.workout_routines;

  if ((workoutStatus.remoteRowCount ?? 0) > 0) {
    warnings.push(WORKOUT_RESTORE_EXCLUSION_REASON);
  }

  const remoteErrors = getOrderedStatusEntries(statuses).filter(
    (status) => status.remoteState === "error" && status.errorMessage,
  );
  if (remoteErrors.length > 0) {
    warnings.push(
      `Some remote backup status checks failed: ${remoteErrors
        .map((status) => `${status.entity}: ${status.errorMessage}`)
        .join("; ")}`,
    );
  }

  return warnings;
}

function buildDisclosures(): string[] {
  return [
    "Habits restore definitions only. Habit completion history stays local-only.",
    "Calories restore entries only. Saved meals stay local-only.",
    WORKOUT_RESTORE_EXCLUSION_REASON,
  ];
}

async function getLocalSyncBackedCounts(): Promise<LocalSyncBackedCounts> {
  const db = await getDatabase();
  const entries = await Promise.all(
    SYNC_BACKED_ENTITIES.map(async (entity) => {
      const row = await db.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total FROM ${entity} WHERE deleted_at IS NULL`,
      );
      return [entity, row?.total ?? 0] as const;
    }),
  );

  return Object.fromEntries(entries) as LocalSyncBackedCounts;
}

async function fetchRemoteEntityMeta(entity: SyncBackedEntity): Promise<RemoteMeta> {
  if (!isRemoteEnabled() || !supabase) {
    return {
      remoteState: "unavailable",
      remoteRowCount: null,
      latestUpdatedAt: null,
      errorMessage: null,
    };
  }

  const countResult = await supabase
    .from(entity)
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (countResult.error) {
    return {
      remoteState: "error",
      remoteRowCount: null,
      latestUpdatedAt: null,
      errorMessage: countResult.error.message,
    };
  }

  const count = countResult.count ?? 0;
  if (count === 0) {
    return {
      remoteState: "empty",
      remoteRowCount: 0,
      latestUpdatedAt: null,
      errorMessage: null,
    };
  }

  const latestResult = await supabase
    .from(entity)
    .select("updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (latestResult.error) {
    return {
      remoteState: "error",
      remoteRowCount: count,
      latestUpdatedAt: null,
      errorMessage: latestResult.error.message,
    };
  }

  const latestRow = (latestResult.data?.[0] ?? null) as RemoteUpdatedRow | null;

  return {
    remoteState: "available",
    remoteRowCount: count,
    latestUpdatedAt: latestRow?.updated_at ?? null,
    errorMessage: null,
  };
}

async function getRemoteEntityStatuses(): Promise<
  Record<SyncBackedEntity, RemoteBackupEntityStatus>
> {
  const entries = await Promise.all(
    SYNC_BACKED_ENTITIES.map(async (entity) => {
      const remoteMeta = await fetchRemoteEntityMeta(entity);
      const isWorkout = entity === "workout_routines";

      const status: RemoteBackupEntityStatus = {
        entity,
        phaseOneRestorable: !isWorkout,
        phaseOneStatus: isWorkout ? "excluded_in_phase_one" : "included",
        remoteState: remoteMeta.remoteState,
        remoteRowCount: remoteMeta.remoteRowCount,
        latestUpdatedAt: remoteMeta.latestUpdatedAt,
        reason: isWorkout ? WORKOUT_RESTORE_EXCLUSION_REASON : null,
        errorMessage: remoteMeta.errorMessage,
      };

      return [entity, status] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<SyncBackedEntity, RemoteBackupEntityStatus>;
}

function computeLatestRestorableBackupAt(
  statuses: Record<SyncBackedEntity, RemoteBackupEntityStatus>,
): string | null {
  const candidates = RESTORE_SCOPED_ENTITIES.map(
    (entity) => statuses[entity].latestUpdatedAt,
  ).filter((value): value is string => Boolean(value));

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function buildUnavailableEntityStatuses(): Record<
  SyncBackedEntity,
  RemoteBackupEntityStatus
> {
  return Object.fromEntries(
    SYNC_BACKED_ENTITIES.map((entity) => [
      entity,
      {
        entity,
        phaseOneRestorable: entity !== "workout_routines",
        phaseOneStatus:
          entity === "workout_routines" ? "excluded_in_phase_one" : "included",
        remoteState: "unavailable",
        remoteRowCount: null,
        latestUpdatedAt: null,
        reason: entity === "workout_routines" ? WORKOUT_RESTORE_EXCLUSION_REASON : null,
        errorMessage: null,
      } satisfies RemoteBackupEntityStatus,
    ]),
  ) as Record<SyncBackedEntity, RemoteBackupEntityStatus>;
}

function buildEligibility(
  localCounts: LocalSyncBackedCounts,
  remoteAvailable: boolean,
  remoteEnabled: boolean,
): RestoreEligibility {
  const hasAnyLocalSyncRows = SYNC_BACKED_ENTITIES.some(
    (entity) => localCounts[entity] > 0,
  );

  if (!remoteEnabled) {
    return buildBlockedEligibility(
      "remote_disabled",
      "Remote backup is disabled in local-only mode.",
      localCounts,
    );
  }

  if (hasAnyLocalSyncRows) {
    return buildBlockedEligibility(
      "local_data_present",
      "Restore is only available on an empty device in this phase. Existing active synced local rows block import.",
      localCounts,
    );
  }

  if (!remoteAvailable) {
    return buildBlockedEligibility(
      "remote_backup_unavailable",
      "No restorable remote backup is available for this account yet.",
      localCounts,
    );
  }

  return {
    kind: "empty_device",
    message:
      "This device is empty for synced tables, so importing the remote backup is allowed.",
    localCounts,
  };
}

async function fetchRemoteRows<TEntity extends RestoreScopedEntity>(
  entity: TEntity,
): Promise<RemoteRestoreRowMap[TEntity][]> {
  if (!isRemoteEnabled()) {
    throw new Error("[restore] Remote backup is disabled.");
  }
  if (!supabase) return [];

  const rows: RemoteRestoreRowMap[TEntity][] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const result = await supabase
      .from(entity)
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (result.error) {
      throw new Error(`[restore] Failed to fetch ${entity}: ${result.error.message}`);
    }

    const batch = (result.data ?? []) as RemoteRestoreRowMap[TEntity][];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

export async function getRestorePreview(): Promise<RestorePreview> {
  const remoteEnabled = isRemoteEnabled();
  const [db, localCounts, entityStatuses] = await Promise.all([
    getDatabase(),
    getLocalSyncBackedCounts(),
    remoteEnabled
      ? getRemoteEntityStatuses()
      : Promise.resolve(buildUnavailableEntityStatuses()),
  ]);

  const remoteAvailable =
    remoteEnabled &&
    RESTORE_SCOPED_ENTITIES.some((entity) => {
      const status = entityStatuses[entity];
      return status.remoteState === "available" && (status.remoteRowCount ?? 0) > 0;
    });
  const freshnessSignature = computeFreshnessSignature(entityStatuses);
  const dismissedSignature =
    freshnessSignature === null
      ? null
      : await getAppMetaText(db, appMetaKeys.restorePromptDismissedSignature);
  const dismissedForCurrentBackup =
    freshnessSignature !== null && dismissedSignature === freshnessSignature;
  const eligibility = buildEligibility(localCounts, remoteAvailable, remoteEnabled);

  return {
    remoteAvailable,
    latestRestorableBackupAt: computeLatestRestorableBackupAt(entityStatuses),
    freshnessSignature,
    dismissedForCurrentBackup,
    startupPromptEligible:
      remoteAvailable &&
      eligibility.kind === "empty_device" &&
      !dismissedForCurrentBackup,
    eligibility,
    entityStatuses,
    warnings: buildWarnings(entityStatuses),
    disclosures: buildDisclosures(),
  };
}

export async function dismissCurrentRestorePrompt(
  freshnessSignature: BackupFreshnessSignature | null,
): Promise<void> {
  if (!freshnessSignature) return;

  const db = await getDatabase();
  await setAppMetaText(
    db,
    appMetaKeys.restorePromptDismissedSignature,
    freshnessSignature,
  );
}

export async function restoreFromRemoteBackup(): Promise<RestoreExecutionResult> {
  if (!isRemoteEnabled()) {
    return {
      status: "blocked",
      preview: await getRestorePreview(),
    };
  }

  const preview = await getRestorePreview();
  if (preview.eligibility.kind !== "empty_device") {
    return {
      status: "blocked",
      preview,
    };
  }

  const freshnessSignature = preview.freshnessSignature;
  if (!freshnessSignature) {
    return {
      status: "blocked",
      preview,
    };
  }

  const [todos, habits, calorieEntries] = await Promise.all([
    fetchRemoteRows("todos"),
    fetchRemoteRows("habits"),
    fetchRemoteRows("calorie_entries"),
  ]);

  const db = await getDatabase();
  const restoredAt = nowIso();

  await db.withTransactionAsync(async () => {
    await applyRemoteTodos(db, todos);
    await applyRemoteHabits(db, habits);
    await applyRemoteCalorieEntries(db, calorieEntries);

    await setAppMetaText(db, appMetaKeys.lastRestoreSignature, freshnessSignature);
    await setAppMetaText(db, appMetaKeys.lastRestoreAt, restoredAt);
  });

  return {
    status: "restored",
    restoredAt,
    freshnessSignature,
    importedCounts: {
      todos: todos.length,
      habits: habits.length,
      calorie_entries: calorieEntries.length,
    },
  };
}
