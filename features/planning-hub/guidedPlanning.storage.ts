/**
 * Local UI preference for the Planning Hub guided planning flow.
 * AsyncStorage-only (device-local preference, not synced app data).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUIDED_DISMISSED_STORAGE_KEY = 'superhabits.planningHub.guidedDismissed';

/** True when the user chose "Use simple view" and the flow should stay hidden. */
export async function isGuidedPlanningDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GUIDED_DISMISSED_STORAGE_KEY)) === 'true';
  } catch {
    // Unreadable preference degrades to showing the flow; it is dismissible again.
    return false;
  }
}

export async function setGuidedPlanningDismissed(dismissed: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(GUIDED_DISMISSED_STORAGE_KEY, dismissed ? 'true' : 'false');
  } catch {
    // Best-effort persistence: the session-level dismiss already applied.
  }
}
