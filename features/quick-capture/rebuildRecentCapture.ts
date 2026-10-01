/**
 * Undo-closure rebuild for persisted recent captures.
 *
 * The recent-capture list survives reloads, but undo closures cannot be
 * serialized: each persisted record is rehydrated into a closure here. The
 * rehydration must resolve the EXACT row a capture created, never a value
 * match — two identical captures in one session are indistinguishable by
 * content, so matching by food name/calories/meal type deleted the newer row
 * when the user undid the older one. Entries persisted before
 * `addCalorieEntry` returned the row id carry no identity, so their undo
 * reports an explicit no-op instead of guessing.
 */

import { deleteCalorieEntry } from '@/features/calories/calories.data';
import { removeTodo } from '@/features/todos/todos.data';
import { deleteHabit } from '@/features/habits/habits.data';
import { softDeleteProject } from '@/features/projects/projects.data';
import { softDeleteGoal } from '@/features/goals/goals.data';
import type {
  PersistedRecentCapture,
  RecentCapture,
} from '@/features/quick-capture/recentCaptures';

/** Thrown by an undo whose captured row identity is unavailable. */
export const LEGACY_CAPTURE_UNDO_MESSAGE =
  'This capture was saved before undo could identify its exact entry, so it cannot be undone safely. Delete it from the Calories diary instead.';

/**
 * Rebuild a persisted capture's undo closure after a reload. Entries from an
 * unknown/older schema, or kinds without a resolvable target, restore
 * without undo instead of breaking the list.
 */
export function rebuildRecentCapture(record: PersistedRecentCapture): RecentCapture | null {
  const separatorIndex = record.key.indexOf(':');
  if (separatorIndex <= 0) return null;
  const kind = record.key.slice(0, separatorIndex);
  const entityId = record.key.slice(separatorIndex + 1);
  let undo: () => Promise<unknown>;
  switch (kind) {
    case 'todo':
      undo = () => removeTodo(entityId);
      break;
    case 'habit':
      undo = () => deleteHabit(entityId);
      break;
    case 'project':
      undo = () => softDeleteProject(entityId);
      break;
    case 'goal':
      undo = () => softDeleteGoal(entityId);
      break;
    case 'calorie': {
      const entryId = record.calorieEntryId;
      if (!entryId) {
        // Legacy record from before `addCalorieEntry` returned the row id: it
        // carries no identity, so deleting by value match could remove a
        // different, identically described row. Report a no-op instead.
        undo = () => Promise.reject(new Error(LEGACY_CAPTURE_UNDO_MESSAGE));
        break;
      }
      undo = () => deleteCalorieEntry(entryId);
      break;
    }
    default:
      return null;
  }
  return {
    key: record.key,
    label: record.label,
    calorieEntryId: record.calorieEntryId,
    calorieRef: record.calorieRef,
    undo,
  };
}
