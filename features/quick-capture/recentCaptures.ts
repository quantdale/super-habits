/**
 * Recent-capture list state for the Quick Capture overlay: newest-first and
 * capped, so Undo stays a bounded, glanceable list. Pure list helpers so the
 * cap/ordering/undo contract is unit-testable without rendering the overlay.
 */

export type RecentCapture = {
  /** Stable identity for the entry, e.g. `todo:<id>`. */
  key: string;
  label: string;
  /** Canonical data-API undo; may resolve to a status value, which is ignored. */
  undo: () => Promise<unknown>;
};

export const MAX_RECENT_CAPTURES = 5;

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
