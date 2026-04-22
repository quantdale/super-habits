import AsyncStorage from "@react-native-async-storage/async-storage";

const AI_COMMAND_INTERNAL_ROLLOUT_STORAGE_KEY =
  "superhabits.command.internal-rollout.remote-enabled";

let cachedInternalRolloutPreference: boolean | null = null;

function normalizeStoredPreference(value: string | null): boolean {
  return value === "enabled";
}

export async function getAiCommandInternalRolloutPreference(): Promise<boolean> {
  if (cachedInternalRolloutPreference !== null) {
    return cachedInternalRolloutPreference;
  }

  try {
    const storedValue = await AsyncStorage.getItem(AI_COMMAND_INTERNAL_ROLLOUT_STORAGE_KEY);
    const nextValue = normalizeStoredPreference(storedValue);
    cachedInternalRolloutPreference = nextValue;
    return nextValue;
  } catch {
    cachedInternalRolloutPreference = false;
    return false;
  }
}

export async function setAiCommandInternalRolloutPreference(enabled: boolean): Promise<void> {
  cachedInternalRolloutPreference = enabled;

  try {
    if (enabled) {
      await AsyncStorage.setItem(AI_COMMAND_INTERNAL_ROLLOUT_STORAGE_KEY, "enabled");
      return;
    }

    await AsyncStorage.removeItem(AI_COMMAND_INTERNAL_ROLLOUT_STORAGE_KEY);
  } catch (error) {
    // Keep the runtime cache in sync with the user's last selection even if persistence fails.
    throw error;
  }
}

export function resetAiCommandInternalRolloutPreferenceCache(): void {
  cachedInternalRolloutPreference = null;
}
