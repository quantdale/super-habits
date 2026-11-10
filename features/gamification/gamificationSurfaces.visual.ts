import { inkOnFill, tintOver, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { REWARD_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';
import type { ThemeTokens } from '@/core/theme';
import type { BadgeTier } from './gamification.types';

/**
 * P20 reward-surface visual models (docs/ui-ux/16-playful-momentum.md §7
 * "Gamification surfaces" + §10 P20).
 *
 * Every ink here is resolved against the ACTUAL fill it is painted on. The
 * badge tier hues and the reward hues are fixed (`constants/sectionColors`),
 * so a theme's own `text` can land at ~2:1 on a bright tier fill (e.g. white
 * text on Silver `#AAB2C3` is 2.13:1) while ink clears 6.4–11.98:1. Locked
 * badges never use "missing" language: they are a sunken monochrome tile with
 * the same geometry.
 *
 * Pure module: no React, no theme read — callers pass resolved tokens so every
 * pair is unit-testable across the 14 themes
 * (`tests/gamificationSurfaces.test.ts`).
 */

/** §7 badge tier fills: Bronze, Silver, Gold, Platinum. */
export type BadgeTierHue = { bright: string; lip: string };

export const BADGE_TIER_HUES: Record<BadgeTier, BadgeTierHue> = {
  1: { bright: '#D0874A', lip: '#A5642C' }, // Bronze
  2: { bright: '#AAB2C3', lip: '#7C8698' }, // Silver
  3: { bright: '#FFC81F', lip: '#E0A800' }, // Gold
  4: { bright: '#5CCBFF', lip: '#2FA3D9' }, // Platinum
};

export type BadgeTileVisual = {
  fill: string;
  /** Visible depth edge under the tile (§5.7 lip, not a blur shadow). */
  lip: string;
  /** Ribbon glyph face/detail inks (duotone hero icon). */
  glyphBright: string;
  glyphLip: string;
  /** Badge name ink against the panel surface (text floor). */
  labelInk: string;
  /** Progress/"Earned" ink against the panel surface. */
  metaInk: string;
  /** Tile outline for the locked (sunken monochrome) state. */
  outline: string;
  unlocked: boolean;
};

/**
 * One badge tile.
 *
 * - Unlocked: the tier's bright fill with the §5.1 bright-fill ink glyph and a
 *   tier-lip edge (ink glyph on tier fill is 6.41:1 Bronze … 11.98:1 Gold).
 * - Locked: `surfaceSunken` face, no lip (a disabled pressable), monochrome
 *   glyph in `textMuted` and a ≥3:1 outline — a collection slot, never
 *   "missing".
 *
 * `outlineSurface` is the surface the tile label sits on; the locked outline
 * is chosen against it because `tokens.border` is only 1.25–1.48:1.
 */
export function badgeTileVisual(input: {
  tier: BadgeTier;
  unlocked: boolean;
  tokens: Pick<ThemeTokens, 'surface' | 'surfaceSunken' | 'text' | 'textMuted' | 'border'>;
}): BadgeTileVisual {
  const { tier, unlocked, tokens } = input;
  const hue = BADGE_TIER_HUES[tier];
  const outline = inkOnFill(tokens.surface, tokens.textMuted, tokens.text, WCAG_AA_NON_TEXT);

  if (unlocked) {
    // §5.1 rule 1: `bright` is never under white text. Ink on the tier faces is
    // 6.41:1 Bronze … 11.98:1 Gold; white is 2.90 / 2.13 / 1.55 / 1.84.
    const glyphInk = inkOnFill(hue.bright, SECTION_ON_BRIGHT_INK, '#FFFFFF');
    return {
      fill: hue.bright,
      lip: hue.lip,
      glyphBright: glyphInk,
      glyphLip: glyphInk,
      labelInk: tokens.text,
      metaInk: tokens.textMuted,
      outline: hue.lip,
      unlocked: true,
    };
  }

  return {
    fill: tokens.surfaceSunken,
    lip: tokens.border,
    glyphBright: tokens.textMuted,
    glyphLip: tokens.textMuted,
    labelInk: tokens.textMuted,
    metaInk: tokens.textMuted,
    outline,
    unlocked: false,
  };
}

export type WeekDayState = 'active' | 'frozen' | 'empty';

export type WeekDayNodeVisual = {
  fill: string;
  borderColor: string;
  borderWidth: number;
  /** Weekday-initial ink inside the node. */
  ink: string;
  /** State glyph ink (flame / shield / neutral dot) under the node. */
  markInk: string;
  mark: 'flame' | 'shield' | 'dot';
};

/**
 * One week-strip node (§7: "7 Flame/Ice nodes, frozen day = Ice shield").
 *
 * - active → Flame bright face with the §5.1 bright-fill ink initial
 *   (`ink` on Flame = 8.76:1); the flame mark sits under it in the
 *   appearance-resolved Flame text tone (5.28:1 light / 6.84:1 dark on surface).
 * - frozen → Ice tint face, Ice ring, Ice shield glyph (`#0B6E99` on
 *   `#E8F8FF` = 5.21:1 light; Ice bright on `#263E51` = 6.05:1 dark). A saved
 *   day reads as care, never as a gap.
 * - empty → sunken neutral face with a ≥3:1 outline.
 *
 * Today keeps its 2px ring in an ink resolved against the node's own fill, so
 * it stays visible on Flame (where `tokens.border` is invisible) and on Ice.
 */
export function weekDayNodeVisual(input: {
  state: WeekDayState;
  isToday: boolean;
  appearance: 'light' | 'dark';
  tokens: Pick<ThemeTokens, 'surface' | 'surfaceSunken' | 'text' | 'textMuted' | 'border'>;
  /** Appearance-resolved reward text tones (`useAppTheme().rewardAccents`). */
  rewardText: { streak: string; frozen: string };
}): WeekDayNodeVisual {
  const { state, isToday, appearance, tokens, rewardText } = input;
  const outline = inkOnFill(tokens.surface, tokens.textMuted, tokens.text, WCAG_AA_NON_TEXT);

  if (state === 'active') {
    const fill = REWARD_HUES.streak.bright;
    const ink = inkOnFill(fill, tokens.text, SECTION_ON_BRIGHT_INK);
    return {
      fill,
      borderColor: isToday ? ink : fill,
      borderWidth: isToday ? 2 : 1,
      ink,
      markInk: rewardText.streak,
      mark: 'flame',
    };
  }

  if (state === 'frozen') {
    const fill = appearance === 'dark' ? REWARD_HUES.frozen.tintDark : REWARD_HUES.frozen.tintLight;
    const ink = inkOnFill(
      fill,
      appearance === 'dark' ? REWARD_HUES.frozen.bright : REWARD_HUES.frozen.text,
      SECTION_ON_BRIGHT_INK,
    );
    const ring = appearance === 'dark' ? REWARD_HUES.frozen.bright : REWARD_HUES.frozen.text;
    return {
      fill,
      borderColor: ring,
      borderWidth: 2,
      ink,
      markInk: rewardText.frozen,
      mark: 'shield',
    };
  }

  // The empty node keeps the ≥3:1 outline (never `tokens.border`, which is
  // 1.25–1.48:1): an empty day is a rest day, not an invisible one.
  return {
    fill: tokens.surfaceSunken,
    borderColor: outline,
    borderWidth: isToday ? 2 : 1,
    ink: inkOnFill(tokens.surfaceSunken, tokens.textMuted, tokens.text),
    markInk: outline,
    mark: 'dot',
  };
}

export type QuestRowVisual = {
  /** Leading state tile face (§5.1 reward apex wash / sunken). */
  iconTile: string;
  /** Glyph ink on that tile (≥4.5:1, chosen against the tile). */
  iconInk: string;
  /** Gold progress bar fill. */
  barColor: string;
  /** Reward chest tile + chest glyph ink (chest stays Gold in both states). */
  chestTile: string;
  chestInk: string;
  /** Pressable-card depth (`depth.card`: 2px ring + 4px `borderStrong` lip). */
  cardBorder: string;
  cardLip: string;
};

/**
 * One daily quest row (§7 "QuestRow = depth.card with a Gold progress bar +
 * chest").
 *
 * The chest is a reward object, so it keeps Gold in both states; only the
 * leading state tile moves between the Gold apex wash (complete) and the
 * sunken neutral (in progress). The chest glyph is resolved against its own
 * tile — Gold bright on `#FFF7E0` would be 1.55:1, so light mode paints the
 * bronze warp tone `#9A5B00` (5.07:1) and dark mode paints Gold bright on the
 * Gold tint wash (10.62:1).
 */
export function questRowVisual(input: {
  complete: boolean;
  appearance: 'light' | 'dark';
  tokens: Pick<
    ThemeTokens,
    'surface' | 'surfaceSunken' | 'text' | 'textMuted' | 'border' | 'borderStrong'
  >;
}): QuestRowVisual {
  const { complete, appearance, tokens } = input;
  const iconTile = complete
    ? tintOver(tokens.surface, REWARD_HUES.accent.bright, appearance === 'dark' ? 0.22 : 0.2)
    : tokens.surfaceSunken;
  // The complete tile is an apex wash, so its glyph is resolved against that
  // wash (Nord Arctic's dark surface leaves Gold bright at 4.11:1 there) with
  // the theme text ink as the floor fallback.
  const iconInk = complete
    ? inkOnFill(
        iconTile,
        appearance === 'dark' ? REWARD_HUES.accent.bright : REWARD_HUES.accent.text,
        tokens.text,
        WCAG_AA_TEXT,
      )
    : inkOnFill(tokens.surfaceSunken, tokens.textMuted, tokens.text, WCAG_AA_TEXT);
  const chestTile =
    appearance === 'dark' ? REWARD_HUES.badge.tintDark : REWARD_HUES.badge.tintLight;
  const chestInk =
    appearance === 'dark'
      ? inkOnFill(chestTile, REWARD_HUES.badge.bright, SECTION_ON_BRIGHT_INK)
      : inkOnFill(chestTile, REWARD_HUES.badge.text, SECTION_ON_BRIGHT_INK);

  return {
    iconTile,
    iconInk,
    barColor: REWARD_HUES.accent.bright,
    chestTile,
    chestInk,
    cardBorder: tokens.border,
    cardLip: tokens.borderStrong,
  };
}

export type LevelRingVisual = {
  arcColor: string;
  trackColor: string;
  lipColor: string;
};

/**
 * Level ring (§7 "LevelHero / XpBar / XpRing polish per tokens"): Gold arc on
 * the sunken track with a Gold-lip depth band under the stroke. Gold is a
 * reward hue and appears only on reward elements.
 */
export function levelRingVisual(
  tokens: Pick<ThemeTokens, 'surfaceSunken' | 'surfaceActive'>,
): LevelRingVisual {
  return {
    arcColor: REWARD_HUES.accent.bright,
    trackColor: tokens.surfaceSunken,
    lipColor: REWARD_HUES.accent.lip,
  };
}
