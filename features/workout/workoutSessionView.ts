import {
  buildTimerSequence,
  lookupPreviousSet,
  type EnteredSetValues,
  type PhaseDisposition,
  type PreviousSetLookup,
  type PreviousSetRow,
  type TimerPhase,
} from './workout.domain';

/**
 * Pure view models for the live workout session. The engine
 * (`buildTimerSequence`, the phase cursor, dispositions) is authoritative and
 * untouched; these helpers turn that state into the set-logging-first
 * anatomy: accurate progress labels, one row per set of the current
 * exercise, and the session-local Add-set transform with its index remap.
 * No DB, no React.
 */

export type SessionProgress = {
  /** Active phases already performed (natural completion or manual). */
  completedSets: number;
  /** Active phases explicitly skipped — never counted as completed work. */
  skippedSets: number;
  /** completedSets + skippedSets. */
  processedSets: number;
  /** Every active phase in the sequence, including phases not yet reached. */
  totalPrescribedSets: number;
  /** The set the session is on or resting toward. */
  currentExercise: {
    name: string;
    setNumber: number;
    totalSets: number;
    completedInExercise: number;
  } | null;
};

/** A phase counts as processed once the cursor has passed it or it carries a disposition. */
function isProcessed(
  index: number,
  currentIndex: number,
  dispositions: Readonly<Record<number, PhaseDisposition>>,
): boolean {
  return index < currentIndex || dispositions[index] !== undefined;
}

/**
 * Accurate session progress. Rest phases are never counted as sets; the
 * actionable phase at the cursor is not counted until its disposition exists;
 * skipped sets are reported separately from completed ones.
 */
export function buildSessionProgress(
  sequence: readonly TimerPhase[],
  dispositions: Readonly<Record<number, PhaseDisposition>>,
  currentIndex: number,
): SessionProgress {
  let completedSets = 0;
  let skippedSets = 0;
  let totalPrescribedSets = 0;
  const completedByExercise = new Map<number, number>();
  let focusIndex: number | null = null;
  for (let i = 0; i < sequence.length; i++) {
    const phase = sequence[i];
    if (phase.phase !== 'active') continue;
    totalPrescribedSets += 1;
    if (isProcessed(i, currentIndex, dispositions)) {
      if (dispositions[i] === 'skipped') {
        skippedSets += 1;
      } else {
        completedSets += 1;
        completedByExercise.set(
          phase.exerciseIndex,
          (completedByExercise.get(phase.exerciseIndex) ?? 0) + 1,
        );
      }
    }
    if (focusIndex === null && i >= currentIndex) focusIndex = i;
  }
  const focus = focusIndex === null ? undefined : sequence[focusIndex];
  return {
    completedSets,
    skippedSets,
    processedSets: completedSets + skippedSets,
    totalPrescribedSets,
    currentExercise: focus
      ? {
          name: focus.exerciseName,
          setNumber: focus.setNumber,
          totalSets: focus.totalSets,
          completedInExercise: completedByExercise.get(focus.exerciseIndex) ?? 0,
        }
      : null,
  };
}

export type SetRowState = 'completed' | 'skipped' | 'current' | 'upcoming';

export type SetRow = {
  /** Index of this set's active phase in the timer sequence. */
  phaseIndex: number;
  setNumber: number;
  totalSets: number;
  state: SetRowState;
  /** The engine phase — the screen reads modality/target/inputs from it. */
  phase: TimerPhase;
  /** Most recent recorded performance for this set, or null when unknown. */
  previous: PreviousSetRow | null;
  /** Raw input strings for this set (weight/reps/duration/… as applicable). */
  entered: EnteredSetValues;
};

/**
 * One row per prescribed set of an exercise. The row at the session cursor is
 * the only actionable one; rows behind it are read-only records of what was
 * entered, so completed and skipped sets never look interchangeable. Rows
 * ahead of the cursor are upcoming context.
 */
export function buildExerciseSetRows(
  sequence: readonly TimerPhase[],
  exerciseIndex: number,
  dispositions: Readonly<Record<number, PhaseDisposition>>,
  enteredSets: Readonly<Record<number, EnteredSetValues>>,
  currentIndex: number,
  previousLookup: PreviousSetLookup | null,
): SetRow[] {
  const rows: SetRow[] = [];
  for (let i = 0; i < sequence.length; i++) {
    const phase = sequence[i];
    if (phase.phase !== 'active' || phase.exerciseIndex !== exerciseIndex) continue;
    let state: SetRowState;
    if (i === currentIndex) {
      state = 'current';
    } else if (i < currentIndex || dispositions[i] !== undefined) {
      state = dispositions[i] === 'skipped' ? 'skipped' : 'completed';
    } else {
      state = 'upcoming';
    }
    rows.push({
      phaseIndex: i,
      setNumber: phase.setNumber,
      totalSets: phase.totalSets,
      state,
      phase,
      previous: lookupPreviousSet(
        previousLookup,
        phase.exerciseName,
        phase.setNumber,
        phase.catalogExerciseId,
      ),
      entered: enteredSets[i] ?? { weight: '', reps: '' },
    });
  }
  return rows;
}

/** The engine's own exercise input shape, referenced without duplicating it. */
type SequenceExercise = Parameters<typeof buildTimerSequence>[0][number];

/**
 * Whether the live session may append a set to an exercise. Superset
 * partners are excluded: their rest rule belongs to the group, and appending
 * inside one would silently rewrite superset ordering.
 */
export function canAddSetToExercise(
  exercises: readonly SequenceExercise[],
  exerciseIndex: number,
): boolean {
  const exercise = exercises[exerciseIndex];
  if (!exercise) return false;
  if (exercise.superset_group) return false;
  return exercise.sets.length > 0;
}

/**
 * Session-local Add set: appends `addedSets[exerciseIndex]` sets after the
 * exercise's prescribed sets, inheriting the last prescribed set's timing so
 * the added sets pace like the rest of the exercise. The engine's own
 * last-set rule (no trailing rest) still applies to the new final set. The
 * recurring routine is never written — this only composes the live sequence.
 */
export function appendAddedSets(
  exercises: readonly SequenceExercise[],
  addedSets: Readonly<Record<number, number>>,
): SequenceExercise[] {
  return exercises.map((exercise, index) => {
    const count = addedSets[index] ?? 0;
    if (count <= 0) return exercise;
    const template = exercise.sets[exercise.sets.length - 1];
    if (!template) return exercise;
    const added = Array.from({ length: count }, (_, offset) => ({
      ...template,
      set_number: template.set_number + 1 + offset,
      // The new final set runs back-to-back like every exercise-final set;
      // inherited rest keeps the added sets paced like the prescription.
      rest_seconds: offset === count - 1 ? 0 : template.rest_seconds,
    }));
    return { ...exercise, sets: [...exercise.sets, ...added] };
  });
}

/** Stable identity for a phase inside one sequence: exercise, set, and kind. */
function phaseKey(phase: TimerPhase): string {
  return `${phase.exerciseIndex}::${phase.setNumber}::${phase.phase}`;
}

/**
 * Map each old phase index to its index after `appendAddedSets`. Appended
 * phases only ever shift later phases, so every original key still exists in
 * the new sequence exactly once.
 */
export function remapPhaseIndices(
  before: readonly TimerPhase[],
  after: readonly TimerPhase[],
): Map<number, number> {
  const positionByKey = new Map<string, number>();
  after.forEach((phase, index) => {
    const key = phaseKey(phase);
    if (!positionByKey.has(key)) positionByKey.set(key, index);
  });
  const remap = new Map<number, number>();
  before.forEach((phase, index) => {
    const next = positionByKey.get(phaseKey(phase));
    if (next !== undefined) remap.set(index, next);
  });
  return remap;
}

/** Session maps re-keyed through a phase-indices remap. */
export function remapSessionMaps<T>(
  map: Readonly<Record<number, T>>,
  remap: Readonly<Map<number, number>>,
): Record<number, T> {
  const out: Record<number, T> = {};
  for (const [oldIndex, value] of Object.entries(map)) {
    const next = remap.get(Number(oldIndex));
    if (next !== undefined) out[next] = value;
  }
  return out;
}

/**
 * Shift the cursor through a remap, keeping it on the same phase. A cursor at
 * an appended-toward position resolves to the nearest earlier original phase.
 */
export function remapCurrentIndex(
  currentIndex: number,
  remap: Readonly<Map<number, number>>,
): number {
  const direct = remap.get(currentIndex);
  if (direct !== undefined) return direct;
  let best: number | null = null;
  for (const [oldIndex, next] of remap) {
    if (oldIndex < currentIndex && (best === null || next < best)) best = next;
  }
  return best ?? currentIndex;
}
