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
  runPomodoroPresetStateTurn,
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
  // The import is itself a read-modify-write of `pomodoro_presets` (check for
  // stored state, otherwise read the legacy keys and write the imported set),
  // so it takes the same turn as every other writer of that record.
  await runPomodoroPresetStateTurn(importLegacyPresetsInOwnedTurn);
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
 * The boundary lives in the data layer (`runPomodoroPresetStateTurn`) because
 * `savePomodoroSettings` reconciles the stored selection from INSIDE its
 * settings transaction: the duration save and the store writers are writers of
 * the same record on different surfaces. `withSQLiteWriter` alone serialized
 * their writes, so a list save that read `activePresetId` before the detach
 * committed wrote the stale selection back — a preset the clock no longer ran,
 * still highlighted, still imposing its auto-start flags.
 *
 * Every writer below therefore reads and writes inside ONE turn
 * (`runPomodoroPresetStateTurn`), never a bare read followed by a later write.
 */

/** Reads the current state; caller must already own a preset-state turn. */
async function withIdlePresetState(): Promise<PomodoroPresetsState> {
  // Caller already owns a preset-state turn: run the import inline, because
  // awaiting `importLegacyPresetsIfNeeded` (which takes its own turn) here
  // would deadlock the chain against itself.
  await importLegacyPresetsInOwnedTurn();
  return readPresetsState();
}

/** Performs the one-time import; the caller already owns a preset-state turn. */
async function importLegacyPresetsInOwnedTurn(): Promise<void> {
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

/** Persists the normalized preset list, preserving a still-valid selection. */
export async function savePomodoroPresets(presets: PomodoroPreset[]): Promise<void> {
  return runPomodoroPresetStateTurn(async () => {
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
  return runPomodoroPresetStateTurn(async () => {
    const state = await withIdlePresetState();
    const resolved = findPresetById(state.presets, id)?.id ?? null;
    if (!resolved || resolved === state.activePresetId) return;
    await writePomodoroPresetsState({ ...state, activePresetId: resolved });
  });
}

/** Clears the stored selection (e.g. after manual duration edits). */
export async function clearActivePresetId(): Promise<void> {
  return runPomodoroPresetStateTurn(async () => {
    const state = await withIdlePresetState();
    if (state.activePresetId === null) return;
    await writePomodoroPresetsState({ ...state, activePresetId: null });
  });
}
