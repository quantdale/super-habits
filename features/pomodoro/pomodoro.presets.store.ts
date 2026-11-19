import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BUILT_IN_PRESETS,
  findPresetById,
  normalizePomodoroPresets,
  type PomodoroPreset,
} from './pomodoro.domain';
import {
  getPomodoroPresetsState as readPresetsState,
  hasStoredPomodoroPresetsState,
  writePomodoroPresetsState,
  type PomodoroPresetsState,
} from './pomodoro.data';

/**
 * Preset persistence lives in app_meta `pomodoro_presets`
 * (`{ presets, activePresetId }`) — the Recoverable Settings V3 source — so
 * presets survive restore like every other allowlisted preference. The old
 * AsyncStorage keys are imported once, idempotently, then retired. All SQLite
 * access is delegated to the feature data layer.
 */

// Legacy device-local keys (pre-Settings-V3). Kept as constants for the
// one-time import and its tests; no runtime reads remain after migration.
export const POMODORO_PRESETS_STORAGE_KEY = 'superhabits.pomodoro.presets';
export const POMODORO_ACTIVE_PRESET_STORAGE_KEY = 'superhabits.pomodoro.activePresetId';

export { normalizePomodoroPresetsState } from './pomodoro.data';
export type { PomodoroPresetsState } from './pomodoro.data';

async function removeLegacyKeys(): Promise<void> {
  try {
    await AsyncStorage.removeItem(POMODORO_PRESETS_STORAGE_KEY);
    await AsyncStorage.removeItem(POMODORO_ACTIVE_PRESET_STORAGE_KEY);
  } catch {
    // Best effort; leftover keys re-run the guarded no-op import later.
  }
}

/**
 * One-time idempotent import of the legacy AsyncStorage preset storage into
 * app_meta. Runs only when the app_meta key is absent; legacy keys are removed
 * after a successful import so subsequent launches skip straight to app_meta.
 */
export async function importLegacyPresetsIfNeeded(): Promise<void> {
  if (await hasStoredPomodoroPresetsState()) {
    await removeLegacyKeys();
    return;
  }

  let legacyPresetsRaw: string | null = null;
  let legacyActiveRaw: string | null = null;
  try {
    legacyPresetsRaw = await AsyncStorage.getItem(POMODORO_PRESETS_STORAGE_KEY);
    legacyActiveRaw = await AsyncStorage.getItem(POMODORO_ACTIVE_PRESET_STORAGE_KEY);
  } catch {
    return; // AsyncStorage unavailable; defaults apply this launch.
  }
  if (legacyPresetsRaw === null && legacyActiveRaw === null) return;

  let presets = [...BUILT_IN_PRESETS];
  if (legacyPresetsRaw !== null) {
    try {
      presets = normalizePomodoroPresets(JSON.parse(legacyPresetsRaw));
    } catch {
      // Corrupt JSON falls back to built-ins.
    }
  }
  const activePresetId =
    legacyActiveRaw !== null ? (findPresetById(presets, legacyActiveRaw)?.id ?? null) : null;

  await writePomodoroPresetsState({ presets, activePresetId });
  await removeLegacyKeys();
}

export async function getPomodoroPresets(): Promise<PomodoroPreset[]> {
  await importLegacyPresetsIfNeeded();
  return (await readPresetsState()).presets;
}

export async function getPomodoroPresetsState(): Promise<PomodoroPresetsState> {
  await importLegacyPresetsIfNeeded();
  return readPresetsState();
}

/**
 * Serialized turn over the preset state.
 *
 * `app_meta.pomodoro_presets` is a read-modify-write key with THREE writers on
 * independent surfaces: the manager replaces the list
 * (`savePomodoroPresets`), the picker sets the selection
 * (`setActivePresetId`), and manual duration edits detach it
 * (`clearActivePresetId`). Unsynchronized, the late writer restored the state it
 * had read BEFORE the other write landed — a preset created in the manager
 * vanished when the picker's selection resolved second, and a selection was
 * lost when the list write resolved second. Both are durable preferences carried
 * by the recoverable-settings backup, so a lost write is a lost setting.
 *
 * Each writer therefore reads the stored state and writes the merged result
 * inside ONE turn, so the second write always sees the first one's outcome.
 */
let presetStateChain: Promise<void> = Promise.resolve();

function runPresetStateTurn<T>(task: () => Promise<T>): Promise<T> {
  const run = presetStateChain.then(task);
  presetStateChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function withIdlePresetState(): Promise<PomodoroPresetsState> {
  await importLegacyPresetsIfNeeded();
  return readPresetsState();
}

/** Persists the normalized preset list, preserving a still-valid selection. */
export async function savePomodoroPresets(presets: PomodoroPreset[]): Promise<void> {
  return runPresetStateTurn(async () => {
    const prev = await withIdlePresetState();
    await writePomodoroPresetsState({
      presets: normalizePomodoroPresets(presets),
      activePresetId:
        prev.activePresetId !== null
          ? (findPresetById(presets, prev.activePresetId)?.id ?? null)
          : null,
    });
  });
}

/** Stores the active preset id after validating it against the stored preset list. */
export async function setActivePresetId(id: string): Promise<void> {
  return runPresetStateTurn(async () => {
    const state = await withIdlePresetState();
    const resolved = findPresetById(state.presets, id)?.id ?? null;
    if (!resolved || resolved === state.activePresetId) return;
    await writePomodoroPresetsState({ ...state, activePresetId: resolved });
  });
}

/** Clears the stored selection (e.g. after manual duration edits). */
export async function clearActivePresetId(): Promise<void> {
  return runPresetStateTurn(async () => {
    const state = await withIdlePresetState();
    if (state.activePresetId === null) return;
    await writePomodoroPresetsState({ ...state, activePresetId: null });
  });
}
