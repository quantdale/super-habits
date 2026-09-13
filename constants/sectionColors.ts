/**
 * Per-section accent colors — based on color psychology
 * for productivity applications.
 *
 * Todos:    Calm Blue   — focus, clarity, orderly thinking
 * Habits:   Fresh Green — growth, consistency, balance
 * Focus:    Deep Purple — concentration, calm, introspection
 * Workout:  Red-Orange  — physical energy, drive, power
 * Calories: Warm Amber  — warmth, nutrition, appetite awareness
 *
 * Naming boundary:
 * - "pomodoro" remains the canonical internal feature/module key
 * - "focus" remains the user-facing section label and accent namespace
 */
export const SECTION_COLORS = {
  todos: '#3B82F6', // Calm Blue
  habits: '#10B981', // Fresh Green
  focus: '#8B5CF6', // Deep Purple
  workout: '#F97316', // Red-Orange
  calories: '#F59E0B', // Warm Amber
} as const;

export type SectionKey = keyof typeof SECTION_COLORS;

/** User-facing section token used by the pomodoro feature/tab. */
export const POMODORO_SECTION_KEY = 'focus' as const satisfies SectionKey;

/**
 * Light tinted background for each section — used for
 * card accent backgrounds and pill chips.
 * 15% opacity version of each section color on white.
 */
export const SECTION_COLORS_LIGHT = {
  todos: '#EFF6FF', // blue-50
  habits: '#ECFDF5', // emerald-50
  focus: '#F5F3FF', // violet-50
  workout: '#FFF7ED', // orange-50
  calories: '#FFFBEB', // amber-50
} as const;

/**
 * Darker same-family hues for text and icons on white, `SECTION_COLORS_LIGHT`,
 * or app surface (#f8f7ff). Keeps `SECTION_COLORS` for fills, borders, and
 * solid headers. Target ~4.5:1 contrast on light backgrounds.
 */
export const SECTION_TEXT_COLORS = {
  todos: '#1D4ED8', // blue-700
  habits: '#047857', // emerald-700
  focus: '#6D28D9', // violet-700
  workout: '#C2410C', // orange-700
  calories: '#92400E', // amber-800 (deeper for yellow-50 / warm surface)
} as const;

/**
 * Dark-appearance text variants. The base `SECTION_COLORS` are mid-tone fills;
 * painted as small text over a dark surface or a 12% tint of themselves they
 * land near 2:1 (measured). These 300/400-level hues keep the section identity
 * and clear WCAG AA on dark surfaces.
 */
export const SECTION_TEXT_COLORS_DARK = {
  todos: '#60A5FA', // blue-400
  habits: '#34D399', // emerald-400
  focus: '#A78BFA', // violet-400
  workout: '#FB923C', // orange-400
  calories: '#FCD34D', // amber-300
} as const;

export type SectionAccent = { fill: string; text: string; tint: string };

/**
 * Reward-layer accents (gamification). These are semantic, not section
 * identities: XP/level, streak, badges, and streak-freeze each keep one color
 * everywhere — dashboard card, achievements screen, and celebration overlay —
 * so a reward reads the same wherever it appears.
 */
export const REWARD_COLORS = {
  /** XP, levels, and quest progress. */
  accent: '#6366F1',
  streak: '#F97316',
  badge: '#F59E0B',
  /** A freeze-protected day, matching the "saved" state in the week strip. */
  frozen: '#38BDF8',
  /** Complete-day celebration, aligned with the Habits section green. */
  day: '#10B981',
  /** Quest completion. */
  quest: '#8B5CF6',
} as const;

/**
 * Light-appearance text variants for the reward hues. The base
 * `REWARD_COLORS` are fills and marks; painted as small text on a light
 * surface they land between 1.8:1 and 2.7:1. These 700/800-level hues keep
 * the reward identity and clear WCAG AA on the app's light surfaces, while
 * dark themes keep the bright base hues.
 */
export const REWARD_TEXT_COLORS = {
  accent: '#4338CA',
  streak: '#C2410C',
  badge: '#92400E',
  frozen: '#0369A1',
  day: '#047857',
  quest: '#6D28D9',
} as const;

export type RewardKey = keyof typeof REWARD_COLORS;
export type RewardAccent = { fill: string; text: string };

/**
 * Reward accents resolved for the current appearance: `fill` paints bars,
 * rings, and solid chips; `text` paints small text and glyphs on surfaces.
 */
export function getRewardAccents(appearance: 'light' | 'dark'): Record<RewardKey, RewardAccent> {
  const keys = Object.keys(REWARD_COLORS) as RewardKey[];
  const result = {} as Record<RewardKey, RewardAccent>;
  for (const key of keys) {
    const fill = REWARD_COLORS[key];
    result[key] =
      appearance === 'dark' ? { fill, text: fill } : { fill, text: REWARD_TEXT_COLORS[key] };
  }
  return result;
}

/**
 * Section identity colors are theme-invariant by default (a Todos card is
 * blue in every theme) — but `text`/`tint` must adapt to appearance: the
 * light-mode 700-level text and *-50 pastel tints go muddy or illegible on
 * dark surfaces. `overrides` lets a theme replace the whole set for cases
 * where even the fill clashes (e.g. Cyberpunk Neon, Crimson Red).
 */
export function getSectionAccents(
  appearance: 'light' | 'dark',
  overrides?: Partial<Record<SectionKey, SectionAccent>>,
): Record<SectionKey, SectionAccent> {
  const keys = Object.keys(SECTION_COLORS) as SectionKey[];
  const result = {} as Record<SectionKey, SectionAccent>;
  for (const key of keys) {
    const override = overrides?.[key];
    if (override) {
      result[key] = override;
      continue;
    }
    const fill = SECTION_COLORS[key];
    result[key] =
      appearance === 'dark'
        ? { fill, text: SECTION_TEXT_COLORS_DARK[key], tint: `${fill}1F` }
        : { fill, text: SECTION_TEXT_COLORS[key], tint: SECTION_COLORS_LIGHT[key] };
  }
  return result;
}
