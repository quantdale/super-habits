import { createContext, useContext } from 'react';
import type { ActionKind, Celebration, GamificationSnapshot } from './gamification.types';

/**
 * Gamification is app-wide state: the Today dashboard, the achievements
 * overlay, and every section's completion handler all read or write the same
 * XP ledger. The provider owns that single copy.
 */
export type GamificationContextValue = {
  /** Latest read model; `null` until the first read resolves. */
  snapshot: GamificationSnapshot | null;
  isLoading: boolean;
  /** Re-read the snapshot and run the day's housekeeping (freeze, backfill). */
  refresh: () => Promise<void>;
  /**
   * Reward one real action. Idempotent — a replayed call for the same action
   * returns without awarding, so callers may invoke it optimistically.
   * `entityId` may be omitted when only the kind is known.
   */
  recordAction: (kind: ActionKind, entityId?: string) => void;
  /** Celebration currently on screen, if any. */
  celebration: Celebration | null;
  dismissCelebration: () => void;
};

export const GamificationContext = createContext<GamificationContextValue | null>(null);

export function useGamification(): GamificationContextValue {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}
