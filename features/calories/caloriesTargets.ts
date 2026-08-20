import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeMacroTargets } from './calories.domain';
import type { MacroTargets } from './calories.domain';

/**
 * Local-only daily macro targets. Deliberately not app_meta/synced: this is
 * a device preference, keyed like the other calories preferences.
 */
export const CALORIES_TARGETS_STORAGE_KEY = 'superhabits.calories.targets';

export async function loadMacroTargets(): Promise<MacroTargets | null> {
  try {
    const raw = await AsyncStorage.getItem(CALORIES_TARGETS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeMacroTargets(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveMacroTargets(targets: MacroTargets): Promise<void> {
  await AsyncStorage.setItem(CALORIES_TARGETS_STORAGE_KEY, JSON.stringify(targets));
}
