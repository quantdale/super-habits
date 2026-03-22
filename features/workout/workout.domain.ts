/**
 * Format seconds into MM:SS display string.
 * e.g. 90 → "1:30", 45 → "0:45"
 */
export function formatWorkoutTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Parse "MM:SS" or plain seconds string into total seconds.
 * Returns 0 for invalid input.
 */
export function parseWorkoutTime(input: string): number {
  if (input.includes(":")) {
    const [m, s] = input.split(":").map(Number);
    if (Number.isFinite(m) && Number.isFinite(s)) {
      return m * 60 + s;
    }
    return 0;
  }
  const n = Number(input);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Calculate total session duration in seconds.
 * Sum of (active_seconds + rest_seconds) for every set
 * across all exercises — gives an estimate before starting.
 */
export function calculateSessionDuration(
  exercises: Array<{
    sets: Array<{ active_seconds: number; rest_seconds: number }>;
  }>,
): number {
  return exercises.reduce((total, ex) => {
    return (
      total +
      ex.sets.reduce((s, set) => s + set.active_seconds + set.rest_seconds, 0)
    );
  }, 0);
}

/**
 * Build the flat sequence of timer phases for a session.
 * Returns an ordered array that the session screen steps through.
 */
export type TimerPhase = {
  exerciseName: string;
  exerciseIndex: number;
  setNumber: number;
  totalSets: number;
  phase: "active" | "rest";
  durationSeconds: number;
};

export function buildTimerSequence(
  exercises: Array<{
    name: string;
    sets: Array<{
      set_number: number;
      active_seconds: number;
      rest_seconds: number;
    }>;
  }>,
): TimerPhase[] {
  const sequence: TimerPhase[] = [];

  exercises.forEach((exercise, exIndex) => {
    exercise.sets.forEach((set) => {
      sequence.push({
        exerciseName: exercise.name,
        exerciseIndex: exIndex,
        setNumber: set.set_number,
        totalSets: exercise.sets.length,
        phase: "active",
        durationSeconds: set.active_seconds,
      });
      const isLastSet =
        exIndex === exercises.length - 1 &&
        set.set_number === exercise.sets.length;
      if (!isLastSet) {
        sequence.push({
          exerciseName: exercise.name,
          exerciseIndex: exIndex,
          setNumber: set.set_number,
          totalSets: exercise.sets.length,
          phase: "rest",
          durationSeconds: set.rest_seconds,
        });
      }
    });
  });

  return sequence;
}

/**
 * Summarize which exercises were completed and how many sets
 * each had — used when logging the session.
 */
export function summarizeCompletedSets(
  sequence: TimerPhase[],
  completedUpToIndex: number,
): Array<{ exerciseName: string; setsCompleted: number }> {
  const map = new Map<string, number>();
  for (let i = 0; i <= completedUpToIndex; i++) {
    const phase = sequence[i];
    if (!phase || phase.phase !== "active") continue;
    map.set(phase.exerciseName, (map.get(phase.exerciseName) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([exerciseName, setsCompleted]) => ({
    exerciseName,
    setsCompleted,
  }));
}
