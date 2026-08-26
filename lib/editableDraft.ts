/**
 * Per-field dirty tracking for editable drafts hydrated from storage/database.
 *
 * Invariant (D3 / F-01): an explicit user edit made after a load/read began
 * MUST outrank that older read when it settles. Untouched fields still hydrate
 * normally. Ownership is scoped to the exact field, so a slow initial refresh
 * can never discard a user's in-progress edit while still populating the
 * fields the user has not touched.
 *
 * Framework-free so the precedence contract is deterministically testable
 * without React timers or sleeps.
 */
export type EditableFieldOwner<T extends string> = {
  markDirty: (field: T) => void;
  isDirty: (field: T) => boolean;
  applyIfPristine: (field: T, apply: () => void) => void;
  clear: () => void;
};

export function createEditableFieldOwner<T extends string>(): EditableFieldOwner<T> {
  const dirty = new Set<T>();
  return {
    markDirty: (field) => {
      dirty.add(field);
    },
    isDirty: (field) => dirty.has(field),
    applyIfPristine: (field, apply) => {
      if (!dirty.has(field)) apply();
    },
    clear: () => {
      dirty.clear();
    },
  };
}
