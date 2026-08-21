export type { MacroTargets } from './calories.domain';

/**
 * Legacy device-local key (pre recoverable-settings V3). Targets now live in
 * app_meta `calorie_targets` so Backup V2 / portable restore carries them.
 * The app_meta-backed store and the one-time idempotent legacy import live in
 * the data layer (`calories.data.ts`); this module stays a pure barrel so UI
 * consumers keep a stable, DB-free import site.
 */
export const CALORIES_TARGETS_STORAGE_KEY = 'superhabits.calories.targets';

export {
  loadMacroTargetsData as loadMacroTargets,
  saveMacroTargetsData as saveMacroTargets,
} from './calories.data';
