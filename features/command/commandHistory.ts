import AsyncStorage from '@react-native-async-storage/async-storage';

export const COMMAND_HISTORY_STORAGE_KEY = 'superhabits.command.history';
export const COMMAND_HISTORY_MAX_ENTRIES = 8;

export type CommandHistoryEntry = {
  rawText: string;
  at: string;
};

/**
 * Pure history reducer: moves a matching entry to the front (refreshed) or
 * prepends a new one, then caps the list. Unit-testable without AsyncStorage.
 */
export function pushCommandHistoryEntry(
  entries: CommandHistoryEntry[],
  rawText: string,
  atIso: string,
  maxEntries: number = COMMAND_HISTORY_MAX_ENTRIES,
): CommandHistoryEntry[] {
  const trimmed = rawText.replace(/\s+/g, ' ').trim();
  if (!trimmed) return entries;
  const next = [
    { rawText: trimmed, at: atIso },
    ...entries.filter(
      (entry) => entry.rawText.replace(/\s+/g, ' ').trim().toLowerCase() !== trimmed.toLowerCase(),
    ),
  ];
  return next.slice(0, Math.max(1, maxEntries));
}

export function normalizeStoredHistory(value: unknown): CommandHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is CommandHistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as CommandHistoryEntry).rawText === 'string' &&
        typeof (entry as CommandHistoryEntry).at === 'string',
    )
    .slice(0, COMMAND_HISTORY_MAX_ENTRIES);
}

export async function getCommandHistory(): Promise<CommandHistoryEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(COMMAND_HISTORY_STORAGE_KEY);
    if (!stored) return [];
    return normalizeStoredHistory(JSON.parse(stored));
  } catch {
    return [];
  }
}

export async function recordCommandInvocation(rawText: string, now: Date = new Date()): Promise<void> {
  try {
    const current = await getCommandHistory();
    const next = pushCommandHistoryEntry(current, rawText, now.toISOString());
    await AsyncStorage.setItem(COMMAND_HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // History is best-effort; never block a command on persistence failure.
  }
}

export async function clearCommandHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(COMMAND_HISTORY_STORAGE_KEY);
  } catch {
    // Best-effort clear.
  }
}
