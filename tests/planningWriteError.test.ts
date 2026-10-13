import { describe, expect, it } from 'vitest';
import { describePlanningWriteError } from '@/features/planning-hub/planningWriteError';

const FALLBACK = 'Could not save the plan. Please try again.';

describe('describePlanningWriteError', () => {
  it('maps engine noise to the curated fallback', () => {
    // wa-sqlite surfaces a RAISE(ABORT) trigger as this opaque message.
    expect(describePlanningWriteError(new Error('Error finalizing statement'), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(describePlanningWriteError(new Error('database is locked'), FALLBACK)).toBe(FALLBACK);
    expect(describePlanningWriteError(new Error('SQLITE_CORRUPT'), FALLBACK)).toBe(FALLBACK);
    expect(describePlanningWriteError(new Error('database or disk is full'), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(describePlanningWriteError(new Error('unable to open database file'), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(
      describePlanningWriteError(new Error('attempt to write a readonly database'), FALLBACK),
    ).toBe(FALLBACK);
  });

  it('passes validation copy written for users through unchanged', () => {
    expect(describePlanningWriteError(new Error('Goal title is required.'), FALLBACK)).toBe(
      'Goal title is required.',
    );
    expect(describePlanningWriteError(new Error('Invalid date key.'), FALLBACK)).toBe(
      'Invalid date key.',
    );
  });

  it('falls back for non-errors, empty messages and stack-shaped text', () => {
    expect(describePlanningWriteError(undefined, FALLBACK)).toBe(FALLBACK);
    expect(describePlanningWriteError('plain string', FALLBACK)).toBe(FALLBACK);
    expect(describePlanningWriteError(new Error(''), FALLBACK)).toBe(FALLBACK);
    expect(
      describePlanningWriteError(new Error('boom at Object.save (file.ts:12:3)'), FALLBACK),
    ).toBe(FALLBACK);
  });
});
