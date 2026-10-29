import type { TimerPhase } from './workout.domain';

/**
 * Countdown-tick logic for the guided session timer, extracted so the
 * phase-advancement contract is unit-testable outside the screen.
 *
 * The invariant under test (bughunt35 / bughunt31 F1): advancing a phase is a
 * SIDE EFFECT that must happen at most once per tick, no matter how many
 * times React invokes a state updater (StrictMode double-invoke, concurrent
 * retry). An updater must therefore never carry the advancement itself.
 */

/** What should happen when a phase's countdown reaches zero. */
export type TimerExpiryOutcome =
  | {
      /** Typed strength set hit zero: stop the timer, let the user log manually. */
      kind: 'pause-at-zero';
      finishedIndex: number;
      nextRemaining: number;
    }
  | {
      /** The last phase of the session hit zero. */
      kind: 'finish-session';
      finishedIndex: number;
      nextRemaining: number;
      /** Timed/cardio phases auto-enter their target duration as the result. */
      autoEnterDurationSeconds?: number;
    }
  | {
      /** Advance to the next phase. */
      kind: 'advance';
      finishedIndex: number;
      nextIndex: number;
      nextRemaining: number;
      /** Timed/cardio phases auto-enter their target duration as the result. */
      autoEnterDurationSeconds?: number;
    };

/**
 * Pure decision for a countdown reaching zero. Mirrors the phase semantics:
 * weighted/bodyweight strength sets are manual logging events (a configured
 * active duration is a pacing aid only), legacy free-text routines stay
 * timer-driven, and typed timed/cardio modalities complete at target.
 */
export function resolveTimerExpiry(
  currentIndex: number,
  sequence: readonly TimerPhase[],
): TimerExpiryOutcome {
  const finishedIndex = currentIndex;
  const finishedPhase = sequence[finishedIndex];
  if (
    finishedPhase?.phase === 'active' &&
    finishedPhase.modality !== undefined &&
    finishedPhase.modality !== 'timed' &&
    finishedPhase.modality !== 'cardio'
  ) {
    return { kind: 'pause-at-zero', finishedIndex, nextRemaining: 0 };
  }
  let autoEnterDurationSeconds: number | undefined;
  if (
    finishedPhase?.phase === 'active' &&
    (finishedPhase.modality === 'timed' || finishedPhase.modality === 'cardio')
  ) {
    autoEnterDurationSeconds = Math.max(0, Math.round(finishedPhase.durationSeconds));
  }
  const nextIndex = finishedIndex + 1;
  if (nextIndex >= sequence.length) {
    return {
      kind: 'finish-session',
      finishedIndex,
      nextRemaining: 0,
      ...(autoEnterDurationSeconds !== undefined ? { autoEnterDurationSeconds } : {}),
    };
  }
  return {
    kind: 'advance',
    finishedIndex,
    nextIndex,
    nextRemaining: sequence[nextIndex].durationSeconds,
    ...(autoEnterDurationSeconds !== undefined ? { autoEnterDurationSeconds } : {}),
  };
}

export type MutableRef<T> = { current: T };

export interface CountdownTickDeps {
  /** Live countdown value; the tick keeps it in sync with the state setter. */
  remaining: MutableRef<number>;
  setRemaining: (updater: (prev: number) => number) => void;
  getCurrentIndex: () => number;
  getSequence: () => readonly TimerPhase[];
  /** Applied at most once per tick — never from inside a state updater. */
  onPhaseExpired: (outcome: TimerExpiryOutcome) => void;
}

/**
 * One wall-clock second of the guided-session countdown.
 *
 * The state updater stays PURE (decrement/clamp only). React may invoke an
 * updater twice (StrictMode double-invoke, concurrent retry), so the on-zero
 * phase advancement is decided from the refs and applied exactly once per
 * tick, outside the updater (bughunt31 F1 / bughunt35).
 */
export function tickCountdown(deps: CountdownTickDeps): void {
  const prev = deps.remaining.current;
  if (prev > 1) {
    deps.remaining.current = prev - 1;
    deps.setRemaining((p) => (p > 1 ? p - 1 : 0));
    return;
  }

  // Phase just hit zero: advance immediately instead of waiting for
  // a second effect to notice `remaining === 0` on the next render.
  const outcome = resolveTimerExpiry(deps.getCurrentIndex(), deps.getSequence());
  deps.remaining.current = outcome.nextRemaining;
  deps.setRemaining(() => outcome.nextRemaining);
  deps.onPhaseExpired(outcome);
}
