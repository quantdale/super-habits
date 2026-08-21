import AsyncStorage from '@react-native-async-storage/async-storage';

/** User-configurable default rest between sets, persisted locally. */
export const WORKOUT_REST_SECONDS_KEY = 'superhabits.workout.restSeconds';

export const REST_SECONDS_MIN = 5;
export const REST_SECONDS_MAX = 600;
export const REST_SECONDS_STEP = 15;
/** Fallback when nothing is stored or the stored value is unusable. */
export const DEFAULT_REST_SECONDS = 60;

export function clampRestSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REST_SECONDS;
  return Math.min(REST_SECONDS_MAX, Math.max(REST_SECONDS_MIN, Math.round(value)));
}

export async function loadRestSecondsDefault(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(WORKOUT_REST_SECONDS_KEY);
    if (raw === null) return DEFAULT_REST_SECONDS;
    return clampRestSeconds(Number(raw));
  } catch {
    return DEFAULT_REST_SECONDS;
  }
}

export async function saveRestSecondsDefault(seconds: number): Promise<void> {
  try {
    await AsyncStorage.setItem(WORKOUT_REST_SECONDS_KEY, String(clampRestSeconds(seconds)));
  } catch {
    // Preference persistence is best-effort; the session keeps working.
  }
}
