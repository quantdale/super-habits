import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { emitRewardFeedback, type RewardFeedbackTier } from '@/lib/rewardFeedback';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import {
  awardGamificationAction,
  ensureStreakFreeze,
  readGamificationSnapshot,
  reconcileGamificationActivity,
} from './gamification.data';
import { GamificationContext } from './gamificationContext';
import type {
  ActionKind,
  Celebration,
  CelebrationTier,
  GamificationSnapshot,
} from './gamification.types';

/**
 * Owns the single gamification read model and the celebration queue.
 *
 * Two responsibilities worth stating out loud:
 *  1. housekeeping (spend a banked freeze on yesterday's gap, backfill rewards
 *     for actions that never reported themselves) runs on mount, on foreground,
 *     and on day rollover — throttled, because it is not user-visible work;
 *  2. `recordAction` is the *fast path* only. Correctness comes from the
 *     ledger's idempotency plus reconciliation, so a missed call from any
 *     screen degrades to a slightly later award instead of a lost one.
 */
/** Celebration tiers map onto the three feedback intensities. */
const FEEDBACK_TIER_BY_CELEBRATION: Record<CelebrationTier, RewardFeedbackTier> = {
  small: 'light',
  quest: 'success',
  streak: 'milestone',
  day: 'milestone',
  badge: 'milestone',
  level: 'milestone',
};

/**
 * Which tiers earn the celebration banner.
 *
 * Only rare milestones do. A quest completion and a routine check-off resolve on
 * the surface that caused them — the quest row flips to a check, the XP bar
 * moves, a haptic and (for a quest) a chime fire. Celebrating every completion
 * with an overlay would put a card in front of the screen the user is actually
 * working in, which is exactly the "no confetti for every checkbox" rule in the
 * design DNA.
 */
const OVERLAY_TIERS: Record<CelebrationTier, boolean> = {
  small: false,
  quest: false,
  day: true,
  badge: true,
  level: true,
  streak: true,
};

/** Housekeeping is cheap but not free; a minute is below any user-noticeable lag. */
const HOUSEKEEPING_MIN_INTERVAL_MS = 60_000;

/**
 * At most this many celebrations wait behind the visible one. Three rewards can
 * land from a single action (badge + complete day + level) and stacking more
 * than that turns a reward into an interruption.
 */
const MAX_QUEUED_CELEBRATIONS = 2;

export function GamificationProvider({ children }: PropsWithChildren) {
  const dayGeneration = useDayRolloverGeneration();
  const [snapshot, setSnapshot] = useState<GamificationSnapshot | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queueRef = useRef<Celebration[]>([]);
  const mountedRef = useRef(true);
  const lastHousekeepingRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const showCelebration = useCallback((next: Celebration) => {
    setCelebration((current) => {
      if (!current) return next;
      if (queueRef.current.length < MAX_QUEUED_CELEBRATIONS) queueRef.current.push(next);
      return current;
    });
  }, []);

  const dismissCelebration = useCallback(() => {
    const [next, ...rest] = queueRef.current;
    queueRef.current = rest;
    setCelebration(next ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const now = Date.now();
      if (now - lastHousekeepingRef.current >= HOUSEKEEPING_MIN_INTERVAL_MS) {
        lastHousekeepingRef.current = now;
        await ensureStreakFreeze();
        await reconcileGamificationActivity();
      }
      const next = await readGamificationSnapshot();
      if (!mountedRef.current) return;
      setSnapshot(next);
    } catch (error) {
      console.error('[gamification] refresh failed', error);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  // Mount, day rollover, and foreground all refresh through the shared hook;
  // it is also the repository pattern for "load on become-active" without a
  // setState-in-effect body.
  useActiveForegroundRefresh(true, refresh, dayGeneration);

  const recordAction = useCallback(
    (kind: ActionKind, entityId?: string) => {
      void (async () => {
        try {
          const outcome = await awardGamificationAction({ kind, entityId });
          if (!outcome) return;
          emitRewardFeedback(
            outcome.celebration ? FEEDBACK_TIER_BY_CELEBRATION[outcome.celebration.tier] : 'light',
          );
          if (!mountedRef.current) return;
          setSnapshot(outcome.snapshot);
          if (outcome.celebration && OVERLAY_TIERS[outcome.celebration.tier]) {
            showCelebration(outcome.celebration);
          }
        } catch (error) {
          // A reward must never break the action that earned it.
          console.error('[gamification] award failed', error);
        }
      })();
    },
    [showCelebration],
  );

  return (
    <GamificationContext.Provider
      value={{ snapshot, isLoading, refresh, recordAction, celebration, dismissCelebration }}
    >
      {children}
    </GamificationContext.Provider>
  );
}
