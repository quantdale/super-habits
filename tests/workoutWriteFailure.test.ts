import { describe, expect, it } from 'vitest';
import { describeStorageFailure, getSaveFailureMessage } from '@/core/storage/storageSafety';
import { workoutWriteFailureCopy } from '@/features/workout/workoutWriteFailure';

/**
 * The Workout write-failure copy helper is the one branch every fixed site
 * shares: a storage-classified rejection must surface the actionable,
 * data-safe sentence from `core/storage/storageSafety`, while every other
 * rejection gets the site's own fixed sentence (never a raw engine message).
 */
describe('workoutWriteFailureCopy', () => {
  const FALLBACK = 'Could not save that day. Try again.';

  it('returns the site sentence for an ordinary rejection', () => {
    expect(workoutWriteFailureCopy(new Error('Error finalizing statement'), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(workoutWriteFailureCopy('a string rejection', FALLBACK)).toBe(FALLBACK);
    expect(workoutWriteFailureCopy(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('classifies a storage rejection by name and surfaces the storage copy', () => {
    const quota = Object.assign(new Error('nope'), { name: 'QuotaExceededError' });
    expect(workoutWriteFailureCopy(quota, FALLBACK)).toBe(describeStorageFailure('quota'));
    // The copy says the change was NOT saved and points at the export path.
    expect(workoutWriteFailureCopy(quota, FALLBACK)).toContain('was not saved');
    expect(workoutWriteFailureCopy(quota, FALLBACK)).toContain('Portable data');
  });

  it('classifies a blocked-storage rejection by message text', () => {
    const blocked = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    expect(workoutWriteFailureCopy(blocked, FALLBACK)).toBe(
      describeStorageFailure('storage-access'),
    );
  });

  it('deliberately differs from the shared helper on ordinary errors', () => {
    // `getSaveFailureMessage` preserves an ordinary error's own message (the
    // pre-existing behaviour other features rely on). Workout fixes ONE sentence
    // per site instead, because an engine sentence such as "Error finalizing
    // statement" is not actionable and cannot be pinned as a contract.
    const ordinary = new Error('Error finalizing statement');
    expect(getSaveFailureMessage(ordinary, FALLBACK)).toBe('Error finalizing statement');
    expect(workoutWriteFailureCopy(ordinary, FALLBACK)).toBe(FALLBACK);
    // Storage failures agree, since both delegate to the same classifier.
    const quota = Object.assign(new Error('nope'), { name: 'QuotaExceededError' });
    expect(workoutWriteFailureCopy(quota, FALLBACK)).toBe(getSaveFailureMessage(quota, FALLBACK));
  });
});
