import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BUILT_IN_PRESETS,
  findPresetById,
  normalizePomodoroPresets,
  type PomodoroPreset,
} from './pomodoro.domain';

export const POMODORO_PRESETS_STORAGE_KEY = 'superhabits.pomodoro.presets';
export const POMODORO_ACTIVE_PRESET_STORAGE_KEY = 'superhabits.pomodoro.activePresetId';

export async function getPomodoroPresets(): Promise<PomodoroPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(POMODORO_PRESETS_STORAGE_KEY);
    if (!raw) return [...BUILT_IN_PRESETS];
    return normalizePomodoroPresets(JSON.parse(raw));
  } catch {
    return [...BUILT_IN_PRESETS];
  }
}

export async function savePomodoroPresets(presets: PomodoroPreset[]): Promise<void> {
  await AsyncStorage.setItem(
    POMODORO_PRESETS_STORAGE_KEY,
    JSON.stringify(normalizePomodoroPresets(presets)),
  );
}

/** Returns the stored active preset id, or null when unset/invalid. */
export async function getActivePresetId(presets: PomodoroPreset[]): Promise<string | null> {
  try {
    const id = await AsyncStorage.getItem(POMODORO_ACTIVE_PRESET_STORAGE_KEY);
    return findPresetById(presets, id)?.id ?? null;
  } catch {
    return null;
  }
}

export async function setActivePresetId(id: string): Promise<void> {
  await AsyncStorage.setItem(POMODORO_ACTIVE_PRESET_STORAGE_KEY, id);
}
