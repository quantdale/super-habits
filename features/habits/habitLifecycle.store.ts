import AsyncStorage from '@react-native-async-storage/async-storage';
import { archiveHabit, listHabits, pauseHabit } from '@/features/habits/habits.data';

/**
 * One-time migration of the pre-v20 habit lifecycle preference sets.
 *
 * Pause/archive used to be device-local id arrays under
 * `superhabits.habits.pausedIds` / `.archivedIds`. Migration 20 made lifecycle
 * state durable (`habits.status` + `habits.lifecycle_history`, synced with the
 * backup), so this module only imports the legacy sets into the columns once
 * and then retires the keys. It never reads them again afterwards.
 */

const PAUSED_IDS_KEY = 'superhabits.habits.pausedIds';
const ARCHIVED_IDS_KEY = 'superhabits.habits.archivedIds';
const LEGACY_LIFECYCLE_KEYS = [PAUSED_IDS_KEY, ARCHIVED_IDS_KEY];

async function readLegacyIdSet(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

let importPromise: Promise<void> | null = null;

/**
 * Import the legacy AsyncStorage pause/archive sets into the durable status
 * column. Idempotent: the keys are removed after a successful import so later
 * calls are no-ops, re-importing an already-transitioned habit is a no-op at
 * the data layer, and a failed import retries on the next call instead of
 * dropping the user's intent.
 */
export function migrateLegacyHabitLifecycle(): Promise<void> {
  importPromise ??= runLegacyHabitLifecycleImport().catch((error: unknown) => {
    // Allow a later refresh to retry; nothing was retired from AsyncStorage.
    importPromise = null;
    console.error('Legacy habit lifecycle import failed:', error);
  });
  return importPromise;
}

async function runLegacyHabitLifecycleImport(): Promise<void> {
  const [pausedIds, archivedIds] = await Promise.all([
    readLegacyIdSet(PAUSED_IDS_KEY),
    readLegacyIdSet(ARCHIVED_IDS_KEY),
  ]);
  if (pausedIds.length === 0 && archivedIds.length === 0) {
    await removeLegacyKeys();
    return;
  }

  const liveIds = new Set((await listHabits()).map((habit) => habit.id));
  const archivedSet = new Set(archivedIds);
  // Legacy archiving cleared an active pause, so apply archives first and skip
  // ids present in both sets (archive closes any open pause anyway).
  for (const habitId of archivedIds) {
    if (liveIds.has(habitId)) await archiveHabit(habitId);
  }
  for (const habitId of pausedIds) {
    if (liveIds.has(habitId) && !archivedSet.has(habitId)) await pauseHabit(habitId);
  }
  await removeLegacyKeys();
}

async function removeLegacyKeys(): Promise<void> {
  try {
    await Promise.all(LEGACY_LIFECYCLE_KEYS.map((key) => AsyncStorage.removeItem(key)));
  } catch {
    // Removal failures only cost one redundant (no-op) import next launch.
  }
}
