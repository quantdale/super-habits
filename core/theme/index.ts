export type { ThemeAppearance, ThemeDefinition, ThemeTokens } from '@/core/theme/tokens';
export {
  THEME_REGISTRY,
  THEME_IDS,
  LIGHT_THEME_IDS,
  DARK_THEME_IDS,
  DEFAULT_LIGHT_THEME_ID,
  DEFAULT_DARK_THEME_ID,
  isThemeId,
  getTheme,
  type ThemeId,
} from '@/core/theme/registry';
export {
  spacing,
  radius,
  typography,
  elevation,
  size,
  layout,
  opacity,
  layers,
} from '@/core/theme/designTokens';
export {
  MOTION_DURATION,
  useMotionDuration,
  useReducedMotion,
  setMotionPreference,
  getMotionPreference,
  type MotionPreference,
  type MotionRole,
} from '@/core/theme/motion';
