import AsyncStorage from '@react-native-async-storage/async-storage';

export type CommandMode = 'ask' | 'create' | 'auto';

const COMMAND_MODE_STORAGE_KEY = 'superhabits.command.last-used-mode';
const DEFAULT_COMMAND_MODE: CommandMode = 'auto';

let cachedCommandMode: CommandMode | null = null;

function normalizeStoredMode(value: string | null): CommandMode {
  if (value === 'ask' || value === 'create' || value === 'auto') {
    return value;
  }
  return DEFAULT_COMMAND_MODE;
}

export async function getLastUsedCommandMode(): Promise<CommandMode> {
  if (cachedCommandMode !== null) {
    return cachedCommandMode;
  }

  try {
    const storedValue = await AsyncStorage.getItem(COMMAND_MODE_STORAGE_KEY);
    const nextValue = normalizeStoredMode(storedValue);
    cachedCommandMode = nextValue;
    return nextValue;
  } catch {
    cachedCommandMode = DEFAULT_COMMAND_MODE;
    return DEFAULT_COMMAND_MODE;
  }
}

export async function setLastUsedCommandMode(mode: CommandMode): Promise<void> {
  cachedCommandMode = mode;

  try {
    await AsyncStorage.setItem(COMMAND_MODE_STORAGE_KEY, mode);
  } catch (error) {
    // Keep the runtime cache in sync with the user's last selection even if persistence fails.
    throw error;
  }
}

export function resetLastUsedCommandModeCache(): void {
  cachedCommandMode = null;
}
