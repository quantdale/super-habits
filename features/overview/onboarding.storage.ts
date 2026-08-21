import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lightweight first-run onboarding marker (docs/ui-ux/03-feature-blueprints.md §13).
 * Device-local by design: once the flag exists, the overview onboarding card
 * never renders again — no wizard, no blocking, no guilt.
 */
const ONBOARDING_FLAG_KEY = 'superhabits.onboarding.v1';

/** True when the user already finished (or skipped) first-run onboarding. */
export async function loadOnboardingCompleted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_FLAG_KEY)) !== null;
  } catch {
    return false;
  }
}

/** Persist the completion flag. Failures are non-fatal: the card may reappear. */
export async function saveOnboardingCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_FLAG_KEY, 'completed');
  } catch (err) {
    console.error('[onboarding.storage] save failed', err);
  }
}
