import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Semantic motion presets ("Warm Momentum" design DNA — docs/ui-ux/02-design-dna.md §10).
 *
 * Durations are guidance, not frame-perfect requirements. Direct-manipulation
 * gestures should track the finger rather than wait on preset timing.
 */

/** Motion duration roles in milliseconds. */
export const MOTION_DURATION = {
  /** Pressed/hover response. */
  instant: 100,
  /** Completion/check/select feedback. */
  feedback: 200,
  /** Sheet/card state change. */
  transition: 280,
  /** Meaningful milestone only. */
  celebration: 450,
} as const;

export type MotionRole = keyof typeof MOTION_DURATION;

/**
 * User motion preference. `system` follows the OS Reduce Motion setting;
 * `reduced` forces reduced motion; `full` allows all motion.
 */
export type MotionPreference = 'system' | 'reduced' | 'full';

const STORAGE_KEY = 'superhabits.motionPreference';

let preference: MotionPreference = 'system';
let hydrated = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function hydratePreference() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      if (stored === 'system' || stored === 'reduced' || stored === 'full') {
        preference = stored;
        notifyListeners();
      }
    })
    .catch(() => {
      // Storage unavailable (e.g. private mode): keep the default.
    });
}

/** Persist and apply the user's motion preference (Settings → Accessibility). */
export function setMotionPreference(next: MotionPreference): void {
  preference = next;
  notifyListeners();
  AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
    // Preference still applies for this session even if persistence fails.
  });
}

export function getMotionPreference(): MotionPreference {
  return preference;
}

/**
 * True when motion should be reduced: large translations, looping ambient
 * animation, and parallax are replaced by opacity/direct state changes.
 * Feedback information must never depend on this being false.
 */
export function useReducedMotion(): boolean {
  const [observedPreference, setObservedPreference] = useState<MotionPreference>(preference);
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    hydratePreference();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };

    function listener() {
      setObservedPreference(preference);
    }
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSystemReduced)
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReduced,
    );
    return () => subscription.remove();
  }, []);

  if (observedPreference === 'reduced') {
    return true;
  }
  if (observedPreference === 'full') {
    return false;
  }
  return systemReduced;
}

/**
 * Resolve a motion role to a concrete duration. Reduced motion collapses
 * durations to ~0 so state changes remain instant while keeping the same
 * end state; callers must never gate information behind the animation.
 */
export function useMotionDuration(role: MotionRole): number {
  const reduced = useReducedMotion();
  return reduced ? 0 : MOTION_DURATION[role];
}
