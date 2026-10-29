/**
 * Section and reward hues — "Playful Momentum" §5.1
 * (docs/ui-ux/16-playful-momentum.md). Every hue has three tiers plus two
 * tints:
 *
 * - `bright` — shapes, nodes, bars, rings, illustrations and icons.
 *   Never put white text on it.
 * - `solid`  — the button face (white label) and the colored-text color in
 *   light mode.
 * - `lip`    — the pressable depth under a solid.
 * - `tintLight` = bright mixed 14% into white; `tintDark` = bright mixed 18%
 *   into `#1A1F2B` (the §5.1 table's precomputed values).
 *
 * Naming boundary:
 * - "pomodoro" remains the canonical internal feature/module key
 * - "focus" remains the user-facing section label and accent namespace
 */

export type SectionHue = {
  bright: string;
  solid: string;
  lip: string;
  tintLight: string;
  tintDark: string;
};

/** §5.1 section hues. Sprout doubles as the app brand and the Habits hue. */
export const SECTION_HUES = {
  todos: {
    bright: '#2FA8F7',
    solid: '#1769D8',
    lip: '#114C9C',
    tintLight: '#E2F3FE',
    tintDark: '#1E3850',
  }, // Sky
  habits: {
    bright: '#4DC93A',
    solid: '#1A7F2B',
    lip: '#135B1F',
    tintLight: '#E6F7E3',
    tintDark: '#233E2E',
  }, // Sprout
  focus: {
    bright: '#A37BFF',
    solid: '#6F45E6',
    lip: '#5032A6',
    tintLight: '#F2EDFF',
    tintDark: '#333051',
  }, // Grape
  workout: {
    bright: '#FF6A4D',
    solid: '#BF351E',
    lip: '#8A2616',
    tintLight: '#FFEAE6',
    tintDark: '#432C31',
  }, // Coral
  calories: {
    bright: '#FF6FAE',
    solid: '#C02670',
    lip: '#8A1B51',
    tintLight: '#FFEBF4',
    tintDark: '#432D43',
  }, // Berry
  health: {
    bright: '#22CCB8',
    solid: '#0B7A72',
    lip: '#085852',
    tintLight: '#E0F8F5',
    tintDark: '#1B3E44',
  }, // Lagoon
} as const satisfies Record<string, SectionHue>;

/** §5.1 danger hue — write failures and destructive confirms only. */
export const DANGER_HUE: SectionHue = {
  bright: '#FF5A5F', // Cherry
  solid: '#C9283A',
  lip: '#911D2A',
  tintLight: '#FFE8E9',
  tintDark: '#432A34',
};

export type SectionKey = keyof typeof SECTION_HUES;

/** User-facing section token used by the pomodoro feature/tab. */
export const POMODORO_SECTION_KEY = 'focus' as const satisfies SectionKey;

/**
 * Shape/border/icon fill per section (the §5.1 `bright` tier — never a
 * white-label button face).
 */
export const SECTION_COLORS = {
  todos: SECTION_HUES.todos.bright,
  habits: SECTION_HUES.habits.bright,
  focus: SECTION_HUES.focus.bright,
  workout: SECTION_HUES.workout.bright,
  calories: SECTION_HUES.calories.bright,
  /** Health parent surface (Workout + Nutrition home). */
  health: SECTION_HUES.health.bright,
} as const;

/**
 * Light tinted background for each section — used for
 * card accent backgrounds and pill chips (the §5.1 `tintLight` tier).
 */
export const SECTION_COLORS_LIGHT = {
  todos: SECTION_HUES.todos.tintLight,
  habits: SECTION_HUES.habits.tintLight,
  focus: SECTION_HUES.focus.tintLight,
  workout: SECTION_HUES.workout.tintLight,
  calories: SECTION_HUES.calories.tintLight,
  health: SECTION_HUES.health.tintLight,
} as const;

/**
 * Light-mode colored-text colors (the §5.1 `solid` tier): also the button face
 * under a white label. Target ≥4.5:1 on white and on the light tint.
 */
export const SECTION_TEXT_COLORS = {
  todos: SECTION_HUES.todos.solid,
  habits: SECTION_HUES.habits.solid,
  focus: SECTION_HUES.focus.solid,
  workout: SECTION_HUES.workout.solid,
  calories: SECTION_HUES.calories.solid,
  health: SECTION_HUES.health.solid,
} as const;

/**
 * Dark-appearance text variants. On dark surfaces the §5.1 `bright` tier is
 * the readable colored text (the table's "bright on surface D" column, ≥5.3:1).
 */
export const SECTION_TEXT_COLORS_DARK = {
  todos: SECTION_HUES.todos.bright,
  habits: SECTION_HUES.habits.bright,
  focus: SECTION_HUES.focus.bright,
  workout: SECTION_HUES.workout.bright,
  calories: SECTION_HUES.calories.bright,
  health: SECTION_HUES.health.bright,
} as const;

export type SectionAccent = { fill: string; text: string; tint: string };

/**
 * Reward-layer accents (gamification). These are semantic, not section
 * identities: XP/level, streak, badges, and streak-freeze each keep one color
 * everywhere — dashboard card, achievements screen, and celebration overlay —
 * so a reward reads the same wherever it appears.
 */
export type RewardHue = {
  bright: string;
  lip: string;
  tintLight: string;
  tintDark: string;
  /** Light-mode colored text / ink label on a bright face. */
  text: string;
};

/** §5.1 reward hues. Gold and Flame appear only on reward elements. */
export const REWARD_HUES = {
  /** XP, levels, and quest progress — Gold. Ink label `#1F2430` on its face. */
  accent: {
    bright: '#FFC81F',
    lip: '#E0A800',
    tintLight: '#FFF7E0',
    tintDark: '#433D29',
    text: '#1F2430',
  },
  /** Streak — Flame. */
  streak: {
    bright: '#FF9A1F',
    lip: '#D97A00',
    tintLight: '#FFF1E0',
    tintDark: '#433529',
    text: '#B34D00',
  },
  /** A freeze-protected day — Ice. */
  frozen: {
    bright: '#5CCBFF',
    lip: '#2FA3D9',
    tintLight: '#E8F8FF',
    tintDark: '#263E51',
    text: '#0B6E99',
  },
  /** Badge faces use Gold with a bronze text tone. */
  badge: {
    bright: '#FFC81F',
    lip: '#E0A800',
    tintLight: '#FFF7E0',
    tintDark: '#433D29',
    text: '#9A5B00',
  },
  /** Complete-day celebration — Sprout. */
  day: { ...SECTION_HUES.habits, text: SECTION_HUES.habits.solid },
  /** Quest completion — Grape. */
  quest: { ...SECTION_HUES.focus, text: SECTION_HUES.focus.solid },
} as const satisfies Record<string, RewardHue>;

export const REWARD_COLORS = {
  accent: REWARD_HUES.accent.bright,
  streak: REWARD_HUES.streak.bright,
  badge: REWARD_HUES.badge.bright,
  frozen: REWARD_HUES.frozen.bright,
  day: REWARD_HUES.day.bright,
  quest: REWARD_HUES.quest.bright,
} as const;

/**
 * Light-appearance text variants for the reward hues (the §5.1 table's text /
 * ink-label column). Dark themes keep the bright base hues as text.
 */
export const REWARD_TEXT_COLORS = {
  accent: REWARD_HUES.accent.text,
  streak: REWARD_HUES.streak.text,
  badge: REWARD_HUES.badge.text,
  frozen: REWARD_HUES.frozen.text,
  day: REWARD_HUES.day.text,
  quest: REWARD_HUES.quest.text,
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
 * Sky in every theme) — but `text`/`tint` must adapt to appearance:
 * light mode paints the `solid` tier as colored text over the `tintLight`
 * wash; dark mode paints the `bright` tier over `tintDark` (the §5.1 table's
 * "bright on surface D" column). `overrides` lets a theme replace the whole
 * set for cases where even the fill clashes (e.g. Cyberpunk Neon).
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
    const hue = SECTION_HUES[key];
    result[key] =
      appearance === 'dark'
        ? { fill: hue.bright, text: hue.bright, tint: hue.tintDark }
        : { fill: hue.bright, text: hue.solid, tint: hue.tintLight };
  }
  return result;
}
