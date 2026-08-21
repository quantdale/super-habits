/**
 * Recent-capture list state for the Quick Capture overlay: newest-first and
 * capped, so Undo stays a bounded, glanceable list. Pure list helpers so the
 * cap/ordering/undo contract is unit-testable without rendering the overlay.
 *
 * Persistence: the recent list and the last-used destination survive reloads
 * via AsyncStorage. Undo closures cannot be serialized, so entries are stored
 * as plain records (`key` + `label` + optional calorie match fields) and the
 * overlay rebuilds the closures when it restores the list on open.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecentCapture = {
  /** Stable identity for the entry, e.g. `todo:<id>`. */
  key: string;
  label: string;
  /**
   * Calorie-only match fields. `addCalorieEntry` does not return the row id,
   * so undo re-resolves the entry from today's newest-first list by content.
   */
  calorieRef?: { foodName: string; calories: number; mealType: string };
  /** Canonical data-API undo; may resolve to a status value, which is ignored. */
  undo: () => Promise<unknown>;
};

export const MAX_RECENT_CAPTURES = 5;

/** AsyncStorage keys follow the app-wide `superhabits.<area>.<name>` convention. */
export const RECENT_CAPTURES_STORAGE_KEY = 'superhabits.quickCapture.recents';
export const LAST_CAPTURE_MODE_STORAGE_KEY = 'superhabits.quickCapture.lastMode';

/** Serializable snapshot of one recent capture (the undo closure is rebuilt by the caller). */
export type PersistedRecentCapture = Pick<RecentCapture, 'key' | 'label' | 'calorieRef'>;

/** Prepend a capture, keeping only the most recent `MAX_RECENT_CAPTURES`. */
export function pushRecentCapture(list: RecentCapture[], entry: RecentCapture): RecentCapture[] {
  return [entry, ...list].slice(0, MAX_RECENT_CAPTURES);
}

/** Drop the entry with the given key; unknown keys leave the list unchanged. */
export function removeRecentCapture(list: RecentCapture[], key: string): RecentCapture[] {
  return list.filter((entry) => entry.key !== key);
}

/**
 * Run one entry's undo. Returns whether the entry should be removed from the
 * list afterwards: false for an unknown key; a rejecting undo propagates so
 * the caller keeps the entry and can surface the failure.
 */
export async function undoRecentCapture(
  list: RecentCapture[],
  key: string,
): Promise<{ removed: boolean }> {
  const entry = list.find((candidate) => candidate.key === key);
  if (!entry) return { removed: false };
  await entry.undo();
  return { removed: true };
}

/** Best-effort persistence; storage failures never break the capture flow. */
export function persistRecentCaptures(list: RecentCapture[]): void {
  const snapshot: PersistedRecentCapture[] = list
    .slice(0, MAX_RECENT_CAPTURES)
    .map(({ key, label, calorieRef }) =>
      calorieRef ? { key, label, calorieRef } : { key, label },
    );
  AsyncStorage.setItem(RECENT_CAPTURES_STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {
    // The in-memory list still works for this session.
  });
}

/** Restore persisted captures; missing or malformed data degrades to []. */
export async function loadPersistedRecentCaptures(): Promise<PersistedRecentCapture[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_CAPTURES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (candidate): candidate is PersistedRecentCapture =>
        typeof candidate === 'object' &&
        candidate !== null &&
        typeof (candidate as PersistedRecentCapture).key === 'string' &&
        typeof (candidate as PersistedRecentCapture).label === 'string',
    );
  } catch {
    return [];
  }
}

/** Remember the last-used destination mode for the next open. */
export function persistLastCaptureMode(mode: string): void {
  AsyncStorage.setItem(LAST_CAPTURE_MODE_STORAGE_KEY, mode).catch(() => {
    // Best-effort; the choice still applies for this session.
  });
}

/** Restore the last-used destination mode; null when unset or unreadable. */
export async function loadLastCaptureMode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_CAPTURE_MODE_STORAGE_KEY);
  } catch {
    return null;
  }
}
