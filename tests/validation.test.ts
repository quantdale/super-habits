import { describe, it, expect } from 'vitest';
import {
  validateTodo,
  validateHabit,
  validateCalorieEntry,
  validateCalorieComputedKcal,
  validateCalorieGoal,
  validateConsumedDateKey,
  validateRoutineName,
  validateExerciseName,
  validateSetTiming,
  validatePomodoroSettings,
  assertExerciseProgressionWrite,
  assertExerciseSortOrderWrite,
  assertSetPrescriptionWrite,
} from '@/lib/validation';
import { toDateKey } from '@/lib/time';

describe('validateTodo', () => {
  it('rejects empty title', () => {
    expect(validateTodo('', '')).not.toBeNull();
    expect(validateTodo('   ', '')).not.toBeNull();
  });
  it('accepts valid title', () => {
    expect(validateTodo('Buy groceries', '')).toBeNull();
  });
  it('rejects title over 200 chars', () => {
    expect(validateTodo('A'.repeat(201), '')).not.toBeNull();
  });
  it('accepts title of exactly 200 chars', () => {
    expect(validateTodo('A'.repeat(200), '')).toBeNull();
  });
  it('rejects invalid due date format', () => {
    expect(validateTodo('Task', '', '03/23/2025')).not.toBeNull();
  });
  it('accepts valid due date', () => {
    expect(validateTodo('Task', '', '2025-03-23')).toBeNull();
  });
});

describe('validateCalorieEntry', () => {
  it('rejects empty food name', () => {
    expect(validateCalorieEntry('', '0', '0', '0', '0')).not.toBeNull();
  });
  it('rejects negative protein', () => {
    expect(validateCalorieEntry('Chicken', '-1', '0', '0', '0')).not.toBeNull();
  });
  it('rejects protein over 999', () => {
    expect(validateCalorieEntry('Chicken', '1000', '0', '0', '0')).not.toBeNull();
  });
  it('accepts valid entry', () => {
    expect(validateCalorieEntry('Chicken', '30', '0', '5', '0')).toBeNull();
  });

  // The entry form submits whole-gram macros via `parseNumericInput` (no
  // `allowDecimal`), which returns null for decimals — and `handleSubmit`
  // falls back to `?? 0`. Validation must therefore REJECT decimal macro
  // text with a field-named message instead of letting submit silently store
  // 0 (the typed grams vanished from every total).
  it('rejects decimal macro text instead of letting submit store 0', () => {
    expect(validateCalorieEntry('Chicken', '12.5', '50', '10', '0')).toBe(
      'Protein must be a whole number.',
    );
    expect(validateCalorieEntry('Chicken', '12', '50.5', '10', '0')).toBe(
      'Carbs must be a whole number.',
    );
    expect(validateCalorieEntry('Chicken', '12', '50', '10', '0.5')).toBe(
      'Fiber must be a whole number.',
    );
    expect(validateCalorieEntry('Chicken', '12', '50', '.5', '0')).toBe(
      'Fats must be a whole number.',
    );
    // Whitespace-padded decimals are still decimals.
    expect(validateCalorieEntry('Chicken', ' 12.5 ', '50', '10', '0')).toBe(
      'Protein must be a whole number.',
    );
  });

  it('keeps the empty-means-zero and whole-number contracts', () => {
    // Empty macro strings stay valid (treated as 0 by the entry form).
    expect(validateCalorieEntry('Chicken', '', '50', '10', '0')).toBeNull();
    // Whole numbers (including a trailing-dot partial that parses to one)
    // stay valid.
    expect(validateCalorieEntry('Chicken', '12.', '50', '10', '0')).toBeNull();
  });
});

describe('validateCalorieComputedKcal', () => {
  it('rejects zero', () => {
    expect(validateCalorieComputedKcal(0)).not.toBeNull();
  });
  it('rejects over 9999', () => {
    expect(validateCalorieComputedKcal(10000)).not.toBeNull();
  });
});

describe('validateConsumedDateKey', () => {
  function shiftKey(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toDateKey(d);
  }

  it('rejects a future date with the data-layer message', () => {
    expect(validateConsumedDateKey(shiftKey(1))).toBe(
      'Calorie logging is limited to today or a past local date.',
    );
  });

  it('rejects malformed dates with the format message', () => {
    expect(validateConsumedDateKey('2026-13-40')).toBe(
      'Consumed date must be a valid calendar date (YYYY-MM-DD).',
    );
    expect(validateConsumedDateKey('tomorrow')).toBe(
      'Consumed date must be a valid calendar date (YYYY-MM-DD).',
    );
    expect(validateConsumedDateKey('')).toBe(
      'Consumed date must be a valid calendar date (YYYY-MM-DD).',
    );
  });

  it('accepts today and past dates', () => {
    expect(validateConsumedDateKey(shiftKey(0))).toBeNull();
    expect(validateConsumedDateKey(shiftKey(-1))).toBeNull();
    expect(validateConsumedDateKey(shiftKey(-365))).toBeNull();
  });

  it('compares against an explicit today override', () => {
    expect(validateConsumedDateKey('2026-09-21', '2026-09-20')).toBe(
      'Calorie logging is limited to today or a past local date.',
    );
    expect(validateConsumedDateKey('2026-09-20', '2026-09-20')).toBeNull();
  });
});

describe('validatePomodoroSettings', () => {
  it('rejects focus duration of 0', () => {
    expect(validatePomodoroSettings('0', '5', '15', '4')).not.toBeNull();
  });
  it('rejects focus duration over 120', () => {
    expect(validatePomodoroSettings('121', '5', '15', '4')).not.toBeNull();
  });
  it('rejects sessions < 2', () => {
    expect(validatePomodoroSettings('25', '5', '15', '1')).not.toBeNull();
  });
  it('accepts valid settings', () => {
    expect(validatePomodoroSettings('25', '5', '15', '4')).toBeNull();
  });
});

describe('validateHabit', () => {
  it('rejects empty name', () => {
    expect(validateHabit('', 1)).not.toBeNull();
  });
  it('rejects target_per_day of 0', () => {
    expect(validateHabit('Run', 0)).not.toBeNull();
  });
  it('rejects target_per_day over 99', () => {
    expect(validateHabit('Run', 100)).not.toBeNull();
  });
  it('accepts valid habit', () => {
    expect(validateHabit('Run', 1)).toBeNull();
  });
});

describe('validateRoutineName', () => {
  it('rejects empty', () => {
    expect(validateRoutineName('  ')).not.toBeNull();
  });
  it('accepts valid', () => {
    expect(validateRoutineName('Push Day')).toBeNull();
  });
});

describe('validateExerciseName', () => {
  it('rejects empty', () => {
    expect(validateExerciseName('')).not.toBeNull();
  });
});

describe('assertExerciseProgressionWrite', () => {
  it('rejects an unsupported progression mode', () => {
    expect(() => assertExerciseProgressionWrite({ progressionMode: 'bogus' })).toThrow(
      'Progression mode must be Manual, Linear, or Double.',
    );
  });

  it.each([-1, Number.NaN, Infinity])(
    'rejects the increment %s instead of letting SQLite coerce it',
    (progressionIncrement) => {
      expect(() => assertExerciseProgressionWrite({ progressionIncrement })).toThrow(
        'Progression increment must be a finite number 0 or greater.',
      );
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Infinity])(
    'rejects the rep bounds %s (whole numbers 1 or greater)',
    (value) => {
      expect(() => assertExerciseProgressionWrite({ progressionMinReps: value })).toThrow(
        /whole number 1 or greater/,
      );
      expect(() => assertExerciseProgressionWrite({ progressionMaxReps: value })).toThrow(
        /whole number 1 or greater/,
      );
    },
  );

  it('rejects a reversed range supplied by one write', () => {
    expect(() =>
      assertExerciseProgressionWrite({ progressionMinReps: 12, progressionMaxReps: 8 }),
    ).toThrow('Progression minimum reps cannot exceed maximum reps.');
  });

  it('checks a partial update against the stored sibling bound', () => {
    expect(() =>
      assertExerciseProgressionWrite({ progressionMinReps: 13 }, { min: 8, max: 12 }),
    ).toThrow('Progression minimum reps cannot exceed maximum reps.');
    expect(() =>
      assertExerciseProgressionWrite({ progressionMaxReps: 7 }, { min: 8, max: 12 }),
    ).toThrow('Progression minimum reps cannot exceed maximum reps.');
  });

  it('keeps an already-reversed recovered row editable unless its range is edited', () => {
    const stored = { min: 12, max: 8 };
    expect(() =>
      assertExerciseProgressionWrite({ progressionMode: 'linear' }, stored),
    ).not.toThrow();
    expect(() => assertExerciseProgressionWrite({ progressionMinReps: 13 }, stored)).toThrow(
      'Progression minimum reps cannot exceed maximum reps.',
    );
    expect(() =>
      assertExerciseProgressionWrite({ progressionMinReps: 12, progressionMaxReps: 20 }, stored),
    ).not.toThrow();
  });

  it('accepts the writer-valid corpus (manual, decimals, zero, single bounds, equal bounds)', () => {
    for (const input of [
      {},
      { progressionMode: 'none' },
      { progressionMode: 'linear', progressionIncrement: 1.25 },
      { progressionIncrement: 0 },
      { progressionMinReps: 8 },
      { progressionMaxReps: 20 },
      { progressionMinReps: 10, progressionMaxReps: 10 },
      { progressionIncrement: null, progressionMinReps: null, progressionMaxReps: null },
    ]) {
      expect(() => assertExerciseProgressionWrite(input)).not.toThrow();
    }
  });
});

describe('assertExerciseSortOrderWrite', () => {
  it('requires a whole number 0 or greater', () => {
    for (const value of [-1, 1.5, Number.NaN, Infinity]) {
      expect(() => assertExerciseSortOrderWrite(value)).toThrow(
        'Exercise order must be a whole number 0 or greater.',
      );
    }
    expect(() => assertExerciseSortOrderWrite(0)).not.toThrow();
    expect(() => assertExerciseSortOrderWrite(3)).not.toThrow();
  });
});

describe('assertSetPrescriptionWrite', () => {
  it('rejects a reversed range the write supplies', () => {
    expect(() => assertSetPrescriptionWrite({ targetRepsMin: 15, targetRepsMax: 10 })).toThrow(
      'Target reps minimum cannot exceed maximum reps.',
    );
  });

  it('rejects a reversed range only when this write edits an endpoint', () => {
    // Unrelated edit on an already-reversed recovered row stays allowed.
    expect(() =>
      assertSetPrescriptionWrite(
        { targetRepsMin: 15, targetRepsMax: 10, targetLoad: 60 },
        { storedRepRange: { min: 15, max: 10 }, repRangeEdited: false },
      ),
    ).not.toThrow();
    // An endpoint edit must repair it.
    expect(() =>
      assertSetPrescriptionWrite(
        { targetRepsMin: 16, targetRepsMax: 10 },
        { storedRepRange: { min: 15, max: 10 }, repRangeEdited: true },
      ),
    ).toThrow('Target reps minimum cannot exceed maximum reps.');
  });
});

describe('validateSetTiming', () => {
  it('rejects active under 5 seconds', () => {
    expect(validateSetTiming(4, 0)).not.toBeNull();
  });
  it('accepts default-like values', () => {
    expect(validateSetTiming(40, 20)).toBeNull();
  });
});

describe('validateCalorieGoal', () => {
  it('rejects calories under 500', () => {
    expect(validateCalorieGoal('400', '0', '0', '0')).not.toBeNull();
  });
  it('accepts valid goal', () => {
    expect(validateCalorieGoal('2000', '150', '200', '65')).toBeNull();
  });
  it('rejects empty macro fields instead of saving 0', () => {
    expect(validateCalorieGoal('2000', '', '200', '65')).toBe(
      'Enter a value for every goal field.',
    );
    expect(validateCalorieGoal('2000', '150', '', '65')).toBe(
      'Enter a value for every goal field.',
    );
    expect(validateCalorieGoal('2000', '150', '200', '')).toBe(
      'Enter a value for every goal field.',
    );
  });
  it('rejects whitespace-only fields instead of saving 0', () => {
    expect(validateCalorieGoal('2000', '   ', '200', '65')).toBe(
      'Enter a value for every goal field.',
    );
    expect(validateCalorieGoal('   ', '150', '200', '65')).toBe(
      'Enter a value for every goal field.',
    );
  });
  it('rejects empty calories with a clear error', () => {
    expect(validateCalorieGoal('', '150', '200', '65')).toBe('Enter a value for every goal field.');
  });
  it('accepts explicit zero macros', () => {
    expect(validateCalorieGoal('2000', '0', '0', '0')).toBeNull();
  });
});
