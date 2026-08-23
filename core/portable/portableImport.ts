import {
  clearLocalDatasetOwner,
  getLocalDatasetOwner,
  getLocalDatasetOwnerProvisional,
  inspectLocalAccountDataState,
} from '@/core/auth/account.data';
import type { LocalAccountDataState } from '@/core/auth/account.types';
import { appMetaKeys, deleteAppMetaKey, setAppMetaText } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { isDeviceEmptyForRestore } from '@/core/backup/backupRestore';
import {
  applyRecoverableSettingsToSqlite,
  applyPendingThemeApplication,
  stagePendingThemeApplication,
} from '@/core/backup/backupSettings';
import { ensureBackupBackfill } from '@/core/backup/backupBackfill';
import { BACKUP_ENTITIES, type BackupEntity } from '@/core/backup/backup.types';
import { validatePortableBackupFile } from '@/core/portable/portableFormat';
import {
  PORTABLE_DOMAIN_LABELS,
  type PortableBackupFile,
  type PortableImportEligibility,
  type PortableImportOutcome,
  type PortableImportPreview,
  type PortableImportResult,
  type PortableOwnerVerdict,
} from '@/core/portable/portable.types';
import { portableOwnerFingerprint } from '@/lib/portableOwnerFingerprint';
import { nowIso } from '@/lib/time';
import { requestHabitReminderReconciliation } from '@/core/notifications/habitReminderSignals';
import { requestWorkoutReminderReconciliation } from '@/core/notifications/workoutReminderSignals';
import type {
  CalorieEntry,
  BodyWeightEntry,
  CustomExercise,
  DailyPlan,
  Goal,
  Habit,
  HabitCompletion,
  PomodoroSession,
  Project,
  RoutineExercise,
  RoutineExerciseSet,
  SavedMeal,
  Todo,
  WorkoutLog,
  WorkoutRoutine,
  WorkoutSessionExercise,
  WorkoutSessionSet,
  WorkoutScheduleOverride,
  WorkoutWeeklyPlanEntry,
} from '@/core/db/types';
import type { LinkedActionRuleRow } from '@/core/linked-actions/linkedActions.types';
import type { WeeklyReview } from '@/features/weekly-review/weeklyReview.types';
import { applyRemoteTodos } from '@/features/todos/todos.data';
import { applyRemoteHabits, applyRemoteHabitCompletions } from '@/features/habits/habits.data';
import {
  applyRemoteCalorieEntries,
  applyRemoteSavedMeals,
} from '@/features/calories/calories.data';
import { applyRemotePomodoroSessions } from '@/features/pomodoro/pomodoro.data';
import { applyRemoteProjects } from '@/features/projects/projects.data';
import { applyRemoteGoals } from '@/features/goals/goals.data';
import { applyRemoteDailyPlans } from '@/features/daily-plan/dailyPlan.data';
import {
  applyRemoteRoutineExercises,
  applyRemoteRoutineExerciseSets,
  applyRemoteWorkoutLogs,
  applyRemoteWorkoutRoutines,
  applyRemoteWorkoutSessionExercises,
  applyRemoteWorkoutSessionSets,
  applyRemoteBodyWeightEntries,
  applyRemoteCustomExercises,
  applyRemoteWorkoutScheduleOverrides,
  applyRemoteWorkoutWeeklyPlan,
} from '@/features/workout/workout.data';
import { applyRemoteLinkedActionRules } from '@/core/linked-actions/linkedActions.data';
import { applyRemoteWeeklyReviews } from '@/features/weekly-review/weeklyReview.data';

/**
 * Portable Data Import V1.
 *
 * Pipeline (ZERO local mutation before the explicit Confirm):
 *   select → size check → read → JSON parse → validate portable envelope →
 *   validate format/domain versions → validate every row → validate
 *   settings → verify entity checksums → verify settings checksum → verify
 *   payload checksum → validate dependency graph → owner compatibility →
 *   verify destination emptiness → human preview → user confirms → re-check
 *   emptiness + owner INSIDE the transaction → ONE atomic SQLite import →
 *   post-import current-state reconciliation.
 *
 * The import reuses the side-effect-free Restore V2 import functions: it
 * reconstructs state, it never replays history (no linked actions, no
 * recurring-todo creation, no habit-reminder scheduling, no notifications,
 * no saved-meal use-count increments).
 */

type OwnerEvaluation = {
  verdict: PortableOwnerVerdict;
  message: string;
  disclosures: string[];
  blockedReason: 'owner_mismatch' | null;
};

/**
 * Owner compatibility decision, derived ONLY from durable local state + the
 * file's one-way source fingerprint (never from the session, and the file can
 * never set the owner binding).
 */
export function evaluateOwnerCompatibility(
  local: LocalAccountDataState,
  fileOwnerFingerprint: string | null,
): OwnerEvaluation {
  if (fileOwnerFingerprint === null) {
    if (local.ownerBinding) {
      return {
        verdict: 'adopting_into_owner',
        message:
          'This file has no source account. On import, the data becomes this device’s account dataset and may be uploaded to that account’s cloud backup.',
        disclosures: [
          'This backup was created on a device without a backup account. Importing it onto this account-bound device makes the data this account’s dataset.',
        ],
        blockedReason: null,
      };
    }
    return {
      verdict: 'local_only_source',
      message:
        'This backup was created without a backup account and can be imported on this empty device.',
      disclosures: [
        'The imported data is treated like local data. The first account that signs in on this device may claim it as its dataset.',
      ],
      blockedReason: null,
    };
  }

  if (!local.ownerBinding || local.ownerBindingProvisional) {
    // Case C: the device is unclaimed (no binding, or only a replaceable
    // provisional anonymous session on a pristine device). Import is allowed;
    // the provisional binding is dropped and the origin fingerprint recorded
    // so only the matching account can later claim the dataset.
    return {
      verdict: 'unclaimed',
      message:
        'This backup belongs to a backup account. This device is unclaimed, so the data can be imported; only that account can later sign in and claim this dataset.',
      disclosures: [
        'The source account fingerprint is recorded on this device. Signing in with any other account is blocked for this dataset.',
      ],
      blockedReason: null,
    };
  }

  if (portableOwnerFingerprint(local.ownerBinding) === fileOwnerFingerprint) {
    return {
      verdict: 'same_owner',
      message: 'This backup was created on this device’s backup account.',
      disclosures: [],
      blockedReason: null,
    };
  }

  return {
    verdict: 'different_owner',
    message: 'This backup belongs to a different account and cannot be imported on this device.',
    disclosures: [],
    blockedReason: 'owner_mismatch',
  };
}

function emptinessEligibility(local: LocalAccountDataState): PortableImportEligibility {
  if (!isDeviceEmptyForRestore(local)) {
    return {
      kind: 'blocked',
      reason: 'device_not_empty',
      message:
        'Import is only available on an empty device. This device contains local data, so nothing was changed.',
    };
  }
  return { kind: 'eligible', message: 'This device is empty and can receive the backup.' };
}

function buildPreview(
  fileName: string,
  file: PortableBackupFile,
  local: LocalAccountDataState,
): PortableImportPreview {
  const counts: Partial<Record<BackupEntity, number>> = {};
  let totalRows = 0;
  for (const entity of BACKUP_ENTITIES) {
    const rows = file.entities[entity] ?? [];
    counts[entity] = rows.length;
    totalRows += rows.length;
  }
  const eligibility = emptinessEligibility(local);
  const owner = evaluateOwnerCompatibility(local, file.source.ownerFingerprint);
  // Owner mismatch blocks the preview just like a populated device: the file
  // is incompatible with this device's durable owner and must not proceed to
  // confirmation.
  const resolvedEligibility: PortableImportEligibility =
    eligibility.kind === 'blocked'
      ? eligibility
      : owner.blockedReason === 'owner_mismatch'
        ? { kind: 'blocked', reason: 'owner_mismatch', message: owner.message }
        : { kind: 'eligible', message: owner.message };
  return {
    fileName,
    exportedAt: file.exportedAt,
    counts,
    totalRows,
    settingsIncluded: true,
    integrityVerified: true,
    ownerVerdict: owner.verdict,
    ownerMessage: owner.message,
    disclosures: owner.disclosures,
    warnings:
      resolvedEligibility.kind === 'blocked'
        ? [resolvedEligibility.message]
        : [
            'The exported file is not encrypted and contains personal Super Habits data. Only import files you trust.',
          ],
    eligibility: resolvedEligibility,
  };
}

/**
 * Step 1 — parse, validate EVERYTHING, evaluate owner + emptiness, and build
 * the human preview. No local mutation of any kind.
 */
export async function preparePortableImport(input: {
  fileName: string;
  text: string;
}): Promise<PortableImportOutcome> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.text);
  } catch {
    return {
      status: 'rejected',
      message: 'This file is not valid JSON and cannot be imported.',
      diagnostics: ['JSON.parse failed'],
    };
  }
  const validation = validatePortableBackupFile(parsed);
  if (!validation.ok) {
    return {
      status: 'rejected',
      message: 'This file did not pass validation and was not imported.',
      diagnostics: validation.errors,
    };
  }
  const db = await getDatabase();
  const local = await inspectLocalAccountDataState(db);
  const preview = buildPreview(input.fileName, validation.file, local);
  if (preview.eligibility.kind === 'blocked') {
    return {
      status: 'rejected',
      message: preview.eligibility.message,
      diagnostics:
        preview.eligibility.reason === 'owner_mismatch'
          ? ['owner compatibility: different account']
          : ['destination is not empty'],
    };
  }
  return { status: 'ready', preview, file: validation.file };
}

/**
 * Step 2 — explicit user confirmation. Re-checks emptiness + owner INSIDE the
 * transaction, then imports everything atomically through the side-effect-free
 * Restore V2 paths. A second activation after a successful import is blocked
 * by the in-transaction emptiness re-check (the device is now populated).
 */
export async function confirmPortableImport(input: {
  file: PortableBackupFile;
}): Promise<PortableImportResult> {
  const db = await getDatabase();
  const importedAt = nowIso();

  const blocked = await withSQLiteTransaction(
    db,
    async (
      transactionDb,
    ): Promise<{ reason: 'local_data_present' | 'owner_mismatch'; message: string } | null> => {
      // Re-verify complete emptiness and owner INSIDE the transaction: local
      // rows written between the preview and this point must abort the import.
      const transactionState = await inspectLocalAccountDataState(transactionDb);
      if (!isDeviceEmptyForRestore(transactionState)) {
        return {
          reason: 'local_data_present',
          message:
            'Local data appeared while preparing the import; nothing was imported and your data is unchanged.',
        };
      }
      const owner = evaluateOwnerCompatibility(
        transactionState,
        input.file.source.ownerFingerprint,
      );
      if (owner.blockedReason === 'owner_mismatch') {
        return {
          reason: 'owner_mismatch',
          message:
            'This backup belongs to a different account and cannot be imported on this device.',
        };
      }

      // Dependency order: parents before children (Projects → Goals →
      // Todos/Habits → Daily Plans; workout_session_sets after its session
      // exercises). Rows were runtime-validated and integrity-verified in
      // `preparePortableImport`; the casts apply the validated shapes.
      const entities = input.file.entities;
      const typed = <T>(entity: BackupEntity): T => (entities[entity] ?? []) as unknown as T;
      await applyRemoteProjects(transactionDb, typed<Project[]>('projects'));
      await applyRemoteGoals(transactionDb, typed<Goal[]>('goals'));
      await applyRemoteTodos(transactionDb, typed<Todo[]>('todos'));
      await applyRemoteHabits(transactionDb, typed<Habit[]>('habits'));
      await applyRemoteDailyPlans(transactionDb, typed<DailyPlan[]>('daily_plans'));
      await applyRemoteHabitCompletions(
        transactionDb,
        typed<HabitCompletion[]>('habit_completions'),
      );
      await applyRemoteCalorieEntries(transactionDb, typed<CalorieEntry[]>('calorie_entries'));
      await applyRemoteSavedMeals(transactionDb, typed<SavedMeal[]>('saved_meals'));
      await applyRemoteCustomExercises(transactionDb, typed<CustomExercise[]>('custom_exercises'));
      await applyRemoteWorkoutRoutines(transactionDb, typed<WorkoutRoutine[]>('workout_routines'));
      await applyRemoteRoutineExercises(
        transactionDb,
        typed<RoutineExercise[]>('routine_exercises'),
      );
      await applyRemoteRoutineExerciseSets(
        transactionDb,
        typed<RoutineExerciseSet[]>('routine_exercise_sets'),
      );
      await applyRemoteWorkoutLogs(transactionDb, typed<WorkoutLog[]>('workout_logs'));
      await applyRemoteWorkoutSessionExercises(
        transactionDb,
        typed<WorkoutSessionExercise[]>('workout_session_exercises'),
      );
      await applyRemoteWorkoutSessionSets(
        transactionDb,
        typed<WorkoutSessionSet[]>('workout_session_sets'),
      );
      await applyRemoteWorkoutWeeklyPlan(
        transactionDb,
        typed<WorkoutWeeklyPlanEntry[]>('workout_weekly_plan'),
      );
      await applyRemoteWorkoutScheduleOverrides(
        transactionDb,
        typed<WorkoutScheduleOverride[]>('workout_schedule_overrides'),
      );
      await applyRemoteBodyWeightEntries(
        transactionDb,
        typed<BodyWeightEntry[]>('body_weight_entries'),
      );
      await applyRemotePomodoroSessions(
        transactionDb,
        typed<PomodoroSession[]>('pomodoro_sessions'),
      );
      await applyRemoteLinkedActionRules(
        transactionDb,
        typed<LinkedActionRuleRow[]>('linked_action_rules'),
      );
      await applyRemoteWeeklyReviews(transactionDb, typed<WeeklyReview[]>('weekly_reviews'));

      // Settings: SQLite-backed values join the transaction directly; theme
      // (AsyncStorage) is staged durably here and applied after commit with
      // restart reconciliation. NO file read or network call happens inside.
      await applyRecoverableSettingsToSqlite(transactionDb, input.file.settings);
      await stagePendingThemeApplication(transactionDb, input.file.settings, importedAt);

      // Import-origin metadata (internal, never user settings; the fingerprint
      // is compatibility metadata, never Auth).
      await setAppMetaText(transactionDb, appMetaKeys.portableLastImportAt, importedAt);
      await setAppMetaText(
        transactionDb,
        appMetaKeys.portableLastImportFormatVersion,
        String(input.file.formatVersion),
      );
      await setAppMetaText(
        transactionDb,
        appMetaKeys.portableLastImportOwnerFingerprint,
        input.file.source.ownerFingerprint ?? 'null',
      );

      // Owner binding: a PROVISIONAL anonymous binding on a pristine device is
      // dropped — the device is unclaimed and the imported dataset must not be
      // attached to a throwaway temporary account. Permanent bindings (already
      // verified compatible above) and unbound devices stay untouched. The file
      // never sets the binding.
      const bindingUserId = await getLocalDatasetOwner(transactionDb);
      if (bindingUserId && (await getLocalDatasetOwnerProvisional(transactionDb))) {
        await clearLocalDatasetOwner(transactionDb);
      }

      // The imported rows arrived OUTSIDE the sync outbox. Cloud Backup V2 must
      // not claim completeness for them: reset backfill markers + stale pending
      // snapshots and mark the backup dirty so the next owner-scoped
      // maintenance cycle re-enqueues everything and publishes a fresh
      // checkpoint only after a real push.
      await deleteAppMetaKey(transactionDb, appMetaKeys.backupBackfillDoneEntities);
      await deleteAppMetaKey(transactionDb, appMetaKeys.backupScopeVersion);
      await deleteAppMetaKey(transactionDb, appMetaKeys.backupPendingManifest);
      await deleteAppMetaKey(transactionDb, appMetaKeys.backupPendingSettings);
      await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '1');
      return null;
    },
  );

  if (blocked) {
    return { status: 'blocked', reason: blocked.reason, message: blocked.message, diagnostics: [] };
  }

  // Post-commit reconciliation: apply the staged theme settings to
  // AsyncStorage (durable marker; retried on bootstrap until it succeeds),
  // then ONLY current/future reminder scheduling.
  await applyPendingThemeApplication();
  requestHabitReminderReconciliation();
  requestWorkoutReminderReconciliation();

  // If a durable owner now exists, enqueue the imported state for that
  // owner's cloud backup (never claims completeness; the checkpoint cycle
  // publishes only after the data actually reaches the remote). This is a
  // background concern: the import itself has already committed, so an
  // enqueue failure must not surface as an import failure — the next
  // maintenance cycle retries the backfill.
  const ownerUserId = await getLocalDatasetOwner(db);
  if (ownerUserId) {
    try {
      await ensureBackupBackfill();
    } catch {
      // Backfill retries on the next maintenance cycle; local use is intact.
    }
  }

  const importedCounts = Object.fromEntries(
    BACKUP_ENTITIES.map((entity) => [entity, (input.file.entities[entity] ?? []).length]),
  ) as Partial<Record<BackupEntity, number>>;

  return { status: 'restored', importedAt, importedCounts };
}

/** Human labels + formatted counts for the preview (no raw table names). */
export function describePortableCounts(
  counts: Partial<Record<BackupEntity, number>>,
): { label: string; count: number }[] {
  return BACKUP_ENTITIES.filter((entity) => (counts[entity] ?? 0) > 0).map((entity) => ({
    label: PORTABLE_DOMAIN_LABELS[entity],
    count: counts[entity] ?? 0,
  }));
}
