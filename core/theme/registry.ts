import { light } from '@/core/theme/themes/light';
import { dark } from '@/core/theme/themes/dark';
import { midnightBlue } from '@/core/theme/themes/midnight-blue';
import { forestGreen } from '@/core/theme/themes/forest-green';
import { oceanTeal } from '@/core/theme/themes/ocean-teal';
import { royalPurple } from '@/core/theme/themes/royal-purple';
import { crimsonRed } from '@/core/theme/themes/crimson-red';
import { sunsetOrange } from '@/core/theme/themes/sunset-orange';
import { rosePink } from '@/core/theme/themes/rose-pink';
import { cyberpunkNeon } from '@/core/theme/themes/cyberpunk-neon';
import { nordArctic } from '@/core/theme/themes/nord-arctic';
import { solarized } from '@/core/theme/themes/solarized';
import { emeraldDark } from '@/core/theme/themes/emerald-dark';
import { coffeeBrown } from '@/core/theme/themes/coffee-brown';
import type { ThemeDefinition } from '@/core/theme/tokens';

/**
 * Adding a theme = one file in `themes/` + one import/registration line here.
 * `ThemeId` derives from the registry, so the picker, persistence validation,
 * and typechecking all pick up a new theme automatically.
 */
export const THEME_REGISTRY = {
  [light.id]: light,
  [dark.id]: dark,
  [midnightBlue.id]: midnightBlue,
  [forestGreen.id]: forestGreen,
  [oceanTeal.id]: oceanTeal,
  [royalPurple.id]: royalPurple,
  [crimsonRed.id]: crimsonRed,
  [sunsetOrange.id]: sunsetOrange,
  [rosePink.id]: rosePink,
  [cyberpunkNeon.id]: cyberpunkNeon,
  [nordArctic.id]: nordArctic,
  [solarized.id]: solarized,
  [emeraldDark.id]: emeraldDark,
  [coffeeBrown.id]: coffeeBrown,
} as const satisfies Record<string, ThemeDefinition>;

// Not `keyof typeof THEME_REGISTRY`: the registry is built from computed
// keys (`[theme.id]: theme`), which TS treats as an index signature — its
// `keyof` widens to `string | number`, not the literal id union, and fails
// `Element.setAttribute`'s `string`-only parameter. Runtime safety instead
// comes from `isThemeId()` below.
export type ThemeId = string;

export const THEME_IDS = Object.keys(THEME_REGISTRY);

export const LIGHT_THEME_IDS = THEME_IDS.filter((id) => THEME_REGISTRY[id].appearance === 'light');
export const DARK_THEME_IDS = THEME_IDS.filter((id) => THEME_REGISTRY[id].appearance === 'dark');

export const DEFAULT_LIGHT_THEME_ID: ThemeId = 'light';
export const DEFAULT_DARK_THEME_ID: ThemeId = 'dark';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEME_REGISTRY;
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEME_REGISTRY[id];
}
