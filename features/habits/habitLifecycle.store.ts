import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local (device-only) habit lifecycle preference sets. Habits have no
 * paused/archived columns in the frozen v15 schema, so pause/archive is a
 * local UI-layer state: archived habits are hidden from the default list and
 * paused habits stay visible but are excluded from "today" progress.
 */

const PAUSED_IDS_KEY = 'superhabits.habits.pausedIds';
const ARCHIVED_IDS_KEY = 'superhabits.habits.archivedIds';

async function readIdSet(key: string): Promise<string[]> {
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

async function writeIdSet(key: string, ids: readonly string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Preference write failures must never break the habit flow.
  }
}

export function loadHabitLifecycleSets(): Promise<{ pausedIds: string[]; archivedIds: string[] }> {
  return (async () => ({
    pausedIds: await readIdSet(PAUSED_IDS_KEY),
    archivedIds: await readIdSet(ARCHIVED_IDS_KEY),
  }))();
}

export function saveHabitPausedIds(ids: readonly string[]): Promise<void> {
  return writeIdSet(PAUSED_IDS_KEY, ids);
}

export function saveHabitArchivedIds(ids: readonly string[]): Promise<void> {
  return writeIdSet(ARCHIVED_IDS_KEY, ids);
}
