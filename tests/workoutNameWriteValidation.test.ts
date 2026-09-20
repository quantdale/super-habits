import { describe, expect, it } from 'vitest';
import {
  assertExerciseWrite,
  assertRoutineWrite,
  validateExerciseName,
  validateRoutineName,
} from '@/lib/validation';

/**
 * Workout name write contract: the throwing data-layer asserts expose the
 * exact same messages as the UI validators (single source of truth), so
 * non-UI writers and the unvalidated rename path can never land an invalid
 * row with a divergent error.
 */
describe('assertRoutineWrite mirrors validateRoutineName', () => {
  it('throws the exact UI message for empty and over-long names', () => {
    expect(() => assertRoutineWrite({ name: '   ' })).toThrow('Routine name is required.');
    expect(() => assertRoutineWrite({ name: 'R'.repeat(101) })).toThrow(
      'Routine name must be 100 characters or less.',
    );
    expect(validateRoutineName('   ')).toBe('Routine name is required.');
    expect(validateRoutineName('R'.repeat(101))).toBe(
      'Routine name must be 100 characters or less.',
    );
  });

  it('accepts valid names', () => {
    expect(() => assertRoutineWrite({ name: 'Push Day' })).not.toThrow();
    expect(() => assertRoutineWrite({ name: 'R'.repeat(100) })).not.toThrow();
  });
});

describe('assertExerciseWrite mirrors validateExerciseName', () => {
  it('throws the exact UI message for empty and over-long names', () => {
    expect(() => assertExerciseWrite({ name: '' })).toThrow('Exercise name is required.');
    expect(() => assertExerciseWrite({ name: 'E'.repeat(101) })).toThrow(
      'Exercise name must be 100 characters or less.',
    );
    expect(validateExerciseName('')).toBe('Exercise name is required.');
    expect(validateExerciseName('E'.repeat(101))).toBe(
      'Exercise name must be 100 characters or less.',
    );
  });

  it('accepts valid names', () => {
    expect(() => assertExerciseWrite({ name: 'Bench Press' })).not.toThrow();
    expect(() => assertExerciseWrite({ name: 'E'.repeat(100) })).not.toThrow();
  });
});
