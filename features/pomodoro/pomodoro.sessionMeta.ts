import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  backfillLegacyPomodoroSessionMeta,
  filterExistingPomodoroSessionIds,
} from './pomodoro.data';

/**
 * Legacy session-metadata migration.
 *
 * Before migration 20, the todo association and completion note for a focus
 * session lived in device-local AsyncStorage maps keyed by session id; they
 * did not sync and restore dropped them. The v20 `pomodoro_sessions` columns
 * (`linked_todo_id`, `linked_todo_title`, `note`) are the durable home —
 * written atomically with the row, carried by backup/portable, and editable
 * via `setPomodoroSessionMeta`. This module backfills the legacy maps onto
 * matching rows exactly once, then retires the AsyncStorage keys. All SQLite
 * access is delegated to the feature data layer.
 */

export const POMODORO_SESSION_ASSOCIATIONS_STORAGE_KEY = 'superhabits.pomodoro.sessionAssociations';
export const POMODORO_SESSION_NOTES_STORAGE_KEY = 'superhabits.pomodoro.sessionNotes';

export type SessionAssociation = {
  todoId: string;
  todoTitle: string;
};

const MAX_TITLE_LENGTH = 200;
export const MAX_SESSION_NOTE_LENGTH = 500;

/**
 * Validate one legacy association entry: both fields must be non-empty
 * strings; the title is truncated to its write-time cap. Invalid entries are
 * dropped rather than failing the whole migration.
 */
export function normalizeLegacyAssociation(value: unknown): SessionAssociation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.todoId !== 'string' || candidate.todoId.trim().length === 0) return null;
  if (typeof candidate.todoTitle !== 'string' || candidate.todoTitle.trim().length === 0) {
    return null;
  }
  return {
    todoId: candidate.todoId.trim(),
    todoTitle: candidate.todoTitle.trim().slice(0, MAX_TITLE_LENGTH),
  };
}

/** Validate one legacy note entry: non-empty after trim, capped at 500 chars. */
export function normalizeLegacyNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_SESSION_NOTE_LENGTH);
}

async function readJsonMap(key: string): Promise<Record<string, unknown>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function removeLegacyKeys(): Promise<void> {
  // Keys are removed only after every backfill UPDATE succeeded, so a crash
  // mid-migration simply re-runs the idempotent pass on next launch.
  try {
    await AsyncStorage.removeItem(POMODORO_SESSION_ASSOCIATIONS_STORAGE_KEY);
    await AsyncStorage.removeItem(POMODORO_SESSION_NOTES_STORAGE_KEY);
  } catch {
    // Best effort; a leftover key re-runs the guarded no-op pass later.
  }
}

export type LegacySessionMetaMigrationResult = {
  associationsApplied: number;
  notesApplied: number;
  droppedEntries: number;
};

/**
 * Backfill legacy AsyncStorage association/note maps onto `pomodoro_sessions`
 * rows by EXACT session-id match (keys are `createId('pom')` ids; local
 * pomodoro rows are never deleted, so presence is a reliable join). Only
 * currently-NULL cells are filled so newer row data is never clobbered.
 * Idempotent: the keys are removed on success, making re-runs a no-op.
 */
export async function migrateLegacySessionMeta(): Promise<LegacySessionMetaMigrationResult> {
  const [rawAssociations, rawNotes] = await Promise.all([
    readJsonMap(POMODORO_SESSION_ASSOCIATIONS_STORAGE_KEY),
    readJsonMap(POMODORO_SESSION_NOTES_STORAGE_KEY),
  ]);

  if (Object.keys(rawAssociations).length === 0 && Object.keys(rawNotes).length === 0) {
    return { associationsApplied: 0, notesApplied: 0, droppedEntries: 0 };
  }

  const associations = new Map<string, SessionAssociation>();
  let droppedEntries = 0;
  for (const [sessionId, value] of Object.entries(rawAssociations)) {
    const association = normalizeLegacyAssociation(value);
    if (association) associations.set(sessionId, association);
    else droppedEntries += 1;
  }

  const notes = new Map<string, string>();
  for (const [sessionId, value] of Object.entries(rawNotes)) {
    const note = normalizeLegacyNote(value);
    if (note) notes.set(sessionId, note);
    else droppedEntries += 1;
  }

  // Exact-id join against existing rows; orphans are dropped, not fatal.
  const candidateIds = [...new Set([...associations.keys(), ...notes.keys()])];
  const existingIds = await filterExistingPomodoroSessionIds(candidateIds);

  const associationUpdates = [...associations.entries()]
    .filter(([sessionId]) => existingIds.has(sessionId))
    .map(([sessionId, association]) => ({
      sessionId,
      todoId: association.todoId,
      todoTitle: association.todoTitle,
    }));
  const noteUpdates = [...notes.entries()]
    .filter(([sessionId]) => existingIds.has(sessionId))
    .map(([sessionId, note]) => ({ sessionId, note }));

  droppedEntries += associations.size - associationUpdates.length;
  droppedEntries += notes.size - noteUpdates.length;

  await backfillLegacyPomodoroSessionMeta({
    associations: associationUpdates,
    notes: noteUpdates,
  });

  await removeLegacyKeys();
  return {
    associationsApplied: associationUpdates.length,
    notesApplied: noteUpdates.length,
    droppedEntries,
  };
}
