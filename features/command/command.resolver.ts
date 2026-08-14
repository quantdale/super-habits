import type { Habit, Todo, WorkoutRoutine } from '@/core/db/types';

export type EntityResolutionStatus =
  'exact' | 'ambiguous' | 'not_found' | 'deleted' | 'already_satisfied' | 'conflict';

export type EntityResolution<T> =
  | { status: 'exact'; entity: T }
  | { status: 'already_satisfied'; entity: T }
  | { status: 'ambiguous'; reference: string; matches: T[] }
  | { status: 'not_found'; reference: string }
  | { status: 'deleted'; reference: string }
  | { status: 'conflict'; reference: string; message: string };

export function normalizeEntityReference(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function resolveNamedEntity<T extends { deleted_at?: string | null }>(
  reference: string | null,
  activeEntities: T[],
  allEntities: T[] = activeEntities,
  getName: (entity: T) => string,
): EntityResolution<T> {
  const normalizedReference = normalizeEntityReference(reference ?? '');
  if (!normalizedReference) {
    return { status: 'not_found', reference: reference ?? '' };
  }

  const matches = activeEntities.filter(
    (entity) => normalizeEntityReference(getName(entity)) === normalizedReference,
  );
  if (matches.length > 1) {
    return { status: 'ambiguous', reference: reference ?? '', matches };
  }
  if (matches.length === 1) {
    return { status: 'exact', entity: matches[0] };
  }

  const deletedMatch = allEntities.some(
    (entity) =>
      entity.deleted_at !== null &&
      entity.deleted_at !== undefined &&
      normalizeEntityReference(getName(entity)) === normalizedReference,
  );
  return deletedMatch
    ? { status: 'deleted', reference: reference ?? '' }
    : { status: 'not_found', reference: reference ?? '' };
}

export function resolveTodoReference(
  reference: string | null,
  activeTodos: Todo[],
  allTodos: Todo[] = activeTodos,
): EntityResolution<Todo> {
  const resolution = resolveNamedEntity(reference, activeTodos, allTodos, (todo) => todo.title);
  if (resolution.status !== 'exact') return resolution;
  return resolution.entity.completed === 1
    ? { status: 'already_satisfied', entity: resolution.entity }
    : resolution;
}

export function resolveHabitReference(
  reference: string | null,
  activeHabits: Habit[],
  allHabits: Habit[] = activeHabits,
): EntityResolution<Habit> {
  return resolveNamedEntity(reference, activeHabits, allHabits, (habit) => habit.name);
}

export function resolveWorkoutRoutineReference(
  reference: string | null,
  activeRoutines: WorkoutRoutine[],
  allRoutines: WorkoutRoutine[] = activeRoutines,
): EntityResolution<WorkoutRoutine> {
  return resolveNamedEntity(reference, activeRoutines, allRoutines, (routine) => routine.name);
}

export function resolutionMessage(resolution: EntityResolution<unknown>, label: string): string {
  switch (resolution.status) {
    case 'ambiguous':
      return `I found multiple matching ${label}s. Choose one to continue.`;
    case 'deleted':
      return `That ${label} is deleted and cannot be changed.`;
    case 'not_found':
      return `No active ${label} named "${resolution.reference}" was found.`;
    case 'already_satisfied':
      return `That ${label} is already complete.`;
    case 'conflict':
      return `That ${label} cannot be changed right now.`;
    case 'exact':
      return '';
  }
}
