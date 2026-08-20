import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-only session metadata (todo association + completion note).
 *
 * The frozen v15 `pomodoro_sessions` table has no column for either value,
 * so both live in AsyncStorage keyed by session id. They are device-local by
 * design: they do not sync, and restore does not carry them.
 */

export const POMODORO_SESSION_ASSOCIATIONS_STORAGE_KEY = 'superhabits.pomodoro.sessionAssociations';
export const POMODORO_SESSION_NOTES_STORAGE_KEY = 'superhabits.pomodoro.sessionNotes';

export type SessionAssociation = {
  todoId: string;
  todoTitle: string;
};

type AssociationMap = Record<string, SessionAssociation>;
type NoteMap = Record<string, string>;

const MAX_NOTE_LENGTH = 500;

async function readJsonMap<T>(key: string): Promise<Record<string, T>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, T>;
  } catch {
    return {};
  }
}

async function writeJsonMap(key: string, value: Record<string, unknown>): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getAllSessionAssociations(): Promise<AssociationMap> {
  return readJsonMap<SessionAssociation>(POMODORO_SESSION_ASSOCIATIONS_STORAGE_KEY);
}

export async function setSessionAssociation(
  sessionId: string,
  association: SessionAssociation | null,
): Promise<void> {
  const map = await getAllSessionAssociations();
  if (association === null) {
    delete map[sessionId];
  } else {
    map[sessionId] = {
      todoId: association.todoId,
      todoTitle: String(association.todoTitle).slice(0, 200),
    };
  }
  await writeJsonMap(POMODORO_SESSION_ASSOCIATIONS_STORAGE_KEY, map);
}

export async function getAllSessionNotes(): Promise<NoteMap> {
  return readJsonMap<string>(POMODORO_SESSION_NOTES_STORAGE_KEY);
}

export async function setSessionNote(sessionId: string, note: string | null): Promise<void> {
  const map = await getAllSessionNotes();
  const trimmed = note?.trim() ?? '';
  if (trimmed.length === 0) {
    delete map[sessionId];
  } else {
    map[sessionId] = trimmed.slice(0, MAX_NOTE_LENGTH);
  }
  await writeJsonMap(POMODORO_SESSION_NOTES_STORAGE_KEY, map);
}
