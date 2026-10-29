import { describe, expect, it } from 'vitest';
import type { TimerPhase } from '@/features/workout/workout.domain';
import {
  resolveTimerExpiry,
  tickCountdown,
  type TimerExpiryOutcome,
} from '@/features/workout/workoutTimerTick';

const phase = (overrides: Partial<TimerPhase> = {}): TimerPhase => ({
  exerciseName: 'Bench press',
  exerciseIndex: 0,
  setNumber: 1,
  totalSets: 3,
  phase: 'active',
  durationSeconds: 45,
  modality: 'weighted_strength',
  ...overrides,
});

describe('resolveTimerExpiry', () => {
  it('pauses at zero for typed strength sets (manual logging event)', () => {
    const outcome = resolveTimerExpiry(0, [phase(), phase()]);
    expect(outcome).toEqual({
      kind: 'pause-at-zero',
      finishedIndex: 0,
      nextRemaining: 0,
    });
  });

  it('auto-enters the target duration and advances for timed phases', () => {
    const seq = [
      phase({ modality: 'timed', durationSeconds: 120 }),
      phase({ phase: 'rest', durationSeconds: 30, modality: undefined }),
    ];
    expect(resolveTimerExpiry(0, seq)).toEqual({
      kind: 'advance',
      finishedIndex: 0,
      nextIndex: 1,
      nextRemaining: 30,
      autoEnterDurationSeconds: 120,
    });
  });

  it('finishes the session when the last timer-driven phase hits zero', () => {
    const outcome = resolveTimerExpiry(1, [
      phase({ modality: 'timed', durationSeconds: 120 }),
      phase({ modality: 'timed', durationSeconds: 60 }),
    ]);
    expect(outcome).toEqual({
      kind: 'finish-session',
      finishedIndex: 1,
      nextRemaining: 0,
      autoEnterDurationSeconds: 60,
    });
  });
});

describe('tickCountdown', () => {
  /**
   * Regression guard for bughunt31 F1 / bughunt35: React may invoke a state
   * updater twice (StrictMode double-invoke, concurrent retry). The second
   * call used to run the phase-advancement side effects again against the
   * already-advanced index ref and silently skip a whole phase.
   */
  it('advances exactly once per tick even when React double-invokes the updater', () => {
    // Mirrors the screen: the expiry handler advances the live index ref.
    // `modality: undefined` = legacy free-text phase: timer-driven, advances.
    const sequence: TimerPhase[] = [
      phase({ modality: undefined }),
      phase({ modality: undefined }),
      phase({ modality: undefined }),
    ];
    const indexRef = { current: 0 };
    const remainingRef = { current: 1 };
    const expiries: TimerExpiryOutcome[] = [];
    const updaterResults: number[] = [];

    tickCountdown({
      remaining: remainingRef,
      setRemaining: (updater) => {
        // React StrictMode / concurrent retry: the updater can run twice
        // with the same input; one result is discarded.
        updaterResults.push(updater(1));
        updaterResults.push(updater(1));
      },
      getCurrentIndex: () => indexRef.current,
      getSequence: () => sequence,
      onPhaseExpired: (outcome) => {
        expiries.push(outcome);
        if (outcome.kind === 'advance') indexRef.current = outcome.nextIndex;
      },
    });

    // A single tick must advance exactly one phase: index 0 -> 1.
    expect(expiries).toEqual([
      { kind: 'advance', finishedIndex: 0, nextIndex: 1, nextRemaining: 45 },
    ]);
    expect(indexRef.current).toBe(1);
    expect(updaterResults).toEqual([45, 45]);
  });

  it('decrements with a pure updater while the countdown is running', () => {
    const expiries: TimerExpiryOutcome[] = [];
    const remainingRef = { current: 5 };
    let captured!: (prev: number) => number;
    tickCountdown({
      remaining: remainingRef,
      setRemaining: (updater) => {
        captured = updater;
      },
      getCurrentIndex: () => 0,
      getSequence: () => [phase(), phase()],
      onPhaseExpired: (outcome) => expiries.push(outcome),
    });
    // Pure: invoking the updater any number of times only decrements.
    expect(captured(5)).toBe(4);
    expect(captured(5)).toBe(4);
    expect(remainingRef.current).toBe(4);
    expect(expiries).toEqual([]);
  });
});
