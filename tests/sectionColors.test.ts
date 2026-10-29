import { describe, expect, it } from 'vitest';
import {
  DANGER_HUE,
  SECTION_ON_BRIGHT_INK,
  REWARD_COLORS,
  REWARD_HUES,
  REWARD_TEXT_COLORS,
  SECTION_COLORS,
  SECTION_COLORS_LIGHT,
  SECTION_HUES,
  SECTION_TEXT_COLORS,
  SECTION_TEXT_COLORS_DARK,
  getRewardAccents,
  getSectionAccents,
} from '@/constants/sectionColors';
import { contrastRatio } from '@/core/theme/contrast';

// Playful Momentum §5.1 (docs/ui-ux/16-playful-momentum.md) — the shipped hue
// tiers are pinned to the spec table so a drift here is a spec violation.
describe('SECTION_HUES (§5.1)', () => {
  it('pins every section hue to the spec table', () => {
    expect(SECTION_HUES).toEqual({
      todos: {
        bright: '#2FA8F7',
        solid: '#1769D8',
        lip: '#114C9C',
        tintLight: '#E2F3FE',
        tintDark: '#1E3850',
      },
      habits: {
        bright: '#4DC93A',
        solid: '#1A7F2B',
        lip: '#135B1F',
        tintLight: '#E6F7E3',
        tintDark: '#233E2E',
      },
      focus: {
        bright: '#A37BFF',
        solid: '#6F45E6',
        lip: '#5032A6',
        tintLight: '#F2EDFF',
        tintDark: '#333051',
      },
      workout: {
        bright: '#FF6A4D',
        solid: '#BF351E',
        lip: '#8A2616',
        tintLight: '#FFEAE6',
        tintDark: '#432C31',
      },
      calories: {
        bright: '#FF6FAE',
        solid: '#C02670',
        lip: '#8A1B51',
        tintLight: '#FFEBF4',
        tintDark: '#432D43',
      },
      health: {
        bright: '#22CCB8',
        solid: '#0B7A72',
        lip: '#085852',
        tintLight: '#E0F8F5',
        tintDark: '#1B3E44',
      },
    });
  });

  it('pins the Cherry danger hue', () => {
    expect(DANGER_HUE).toEqual({
      bright: '#FF5A5F',
      solid: '#C9283A',
      lip: '#911D2A',
      tintLight: '#FFE8E9',
      tintDark: '#432A34',
    });
  });

  it('maps the legacy flat maps to the §5.1 tiers', () => {
    // fill = bright (shapes/nodes), light text = solid, dark text = bright.
    expect(SECTION_COLORS.habits).toBe(SECTION_HUES.habits.bright);
    expect(SECTION_TEXT_COLORS.habits).toBe(SECTION_HUES.habits.solid);
    expect(SECTION_TEXT_COLORS_DARK.habits).toBe(SECTION_HUES.habits.bright);
    expect(SECTION_COLORS_LIGHT.habits).toBe(SECTION_HUES.habits.tintLight);
  });
});

describe('REWARD_HUES (§5.1)', () => {
  it('pins every reward hue to the spec table', () => {
    expect(REWARD_HUES.accent).toEqual({
      bright: '#FFC81F',
      lip: '#E0A800',
      tintLight: '#FFF7E0',
      tintDark: '#433D29',
      text: '#1F2430',
    });
    expect(REWARD_HUES.streak).toEqual({
      bright: '#FF9A1F',
      lip: '#D97A00',
      tintLight: '#FFF1E0',
      tintDark: '#433529',
      text: '#B34D00',
    });
    expect(REWARD_HUES.frozen).toEqual({
      bright: '#5CCBFF',
      lip: '#2FA3D9',
      tintLight: '#E8F8FF',
      tintDark: '#263E51',
      text: '#0B6E99',
    });
    // Badge = Gold face with the bronze text tone; day/quest follow Sprout/Grape.
    expect(REWARD_HUES.badge.text).toBe('#9A5B00');
    expect(REWARD_HUES.day).toEqual({ ...SECTION_HUES.habits, text: SECTION_HUES.habits.solid });
    expect(REWARD_HUES.quest).toEqual({ ...SECTION_HUES.focus, text: SECTION_HUES.focus.solid });
  });

  it('maps the legacy flat maps to the §5.1 tiers', () => {
    expect(REWARD_COLORS.accent).toBe('#FFC81F');
    expect(REWARD_COLORS.streak).toBe('#FF9A1F');
    expect(REWARD_COLORS.frozen).toBe('#5CCBFF');
    expect(REWARD_COLORS.badge).toBe('#FFC81F');
    expect(REWARD_COLORS.day).toBe('#4DC93A');
    expect(REWARD_COLORS.quest).toBe('#A37BFF');
    expect(REWARD_TEXT_COLORS).toEqual({
      accent: '#1F2430',
      streak: '#B34D00',
      badge: '#9A5B00',
      frozen: '#0B6E99',
      day: '#1A7F2B',
      quest: '#6F45E6',
    });
  });
});

describe('getSectionAccents', () => {
  it('uses bright fills, solid text, and the tintLight wash for light appearance', () => {
    const accents = getSectionAccents('light');
    expect(accents.todos).toEqual({
      fill: SECTION_HUES.todos.bright,
      text: SECTION_HUES.todos.solid,
      tint: SECTION_HUES.todos.tintLight,
    });
  });

  it('uses the bright tier as colored text and the tintDark wash for dark appearance', () => {
    const accents = getSectionAccents('dark');
    expect(accents.habits).toEqual({
      fill: SECTION_HUES.habits.bright,
      text: SECTION_HUES.habits.bright,
      tint: SECTION_HUES.habits.tintDark,
    });
  });

  it('covers every section key for both appearances', () => {
    const keys = Object.keys(SECTION_COLORS);
    for (const appearance of ['light', 'dark'] as const) {
      const accents = getSectionAccents(appearance);
      expect(Object.keys(accents).sort()).toEqual(keys.sort());
    }
  });

  it('lets a theme override individual sections without affecting the rest', () => {
    const override = { fill: '#38BDF8', text: '#38BDF8', tint: '#38BDF81F' };
    const accents = getSectionAccents('dark', { todos: override });
    expect(accents.todos).toEqual(override);
    expect(accents.habits).toEqual({
      fill: SECTION_HUES.habits.bright,
      text: SECTION_HUES.habits.bright,
      tint: SECTION_HUES.habits.tintDark,
    });
  });
});

describe('getRewardAccents', () => {
  it('paints ink/solid text tones on light surfaces', () => {
    const accents = getRewardAccents('light');
    expect(accents.accent).toEqual({ fill: '#FFC81F', text: '#1F2430' });
    expect(accents.streak).toEqual({ fill: '#FF9A1F', text: '#B34D00' });
    expect(accents.frozen).toEqual({ fill: '#5CCBFF', text: '#0B6E99' });
  });

  it('keeps the bright base hue as text on dark surfaces', () => {
    const accents = getRewardAccents('dark');
    expect(accents.day).toEqual({ fill: '#4DC93A', text: '#4DC93A' });
    expect(accents.quest).toEqual({ fill: '#A37BFF', text: '#A37BFF' });
  });
});

// Codex P2 on #139: brightened §5.1 fills broke white-label consumers. §5.1
// Rule 1 — `bright` is never under white text. These pairs are the exact
// combinations shipped by the fixed consumers, asserted against the WCAG
// floors (4.5 for text, 3.0 for non-text glyphs/borders).
describe('§5.1 fill/label contrast (bright is never under white)', () => {
  const SECTION_KEYS = Object.keys(SECTION_HUES) as (keyof typeof SECTION_HUES)[];

  it('ink labels on every bright fill clear the 4.5 text floor', () => {
    for (const key of SECTION_KEYS) {
      const ratio = contrastRatio(SECTION_ON_BRIGHT_INK, SECTION_HUES[key].bright);
      expect(ratio, `${key}: ink on bright — ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the ink glyph on a bright fill clears the 3.0 non-text floor', () => {
    for (const key of SECTION_KEYS) {
      const ratio = contrastRatio(SECTION_ON_BRIGHT_INK, SECTION_HUES[key].bright);
      expect(ratio, `${key}: ink glyph on bright`).toBeGreaterThanOrEqual(3);
    }
  });

  it('every bright fill fails a white label, so white must never be used on it', () => {
    // The regression guard: if a future edit re-introduces white on bright,
    // this documents why the consumer crashed. `focus` sits closest to the
    // floor (3.07) and would still fail the 4.5 text requirement.
    for (const key of SECTION_KEYS) {
      const ratio = contrastRatio('#FFFFFF', SECTION_HUES[key].bright);
      expect(ratio, `${key}: white on bright — ${ratio.toFixed(2)}:1`).toBeLessThan(4.5);
    }
  });

  it('white labels on the solid tier clear the 4.5 text floor (the alternative fix)', () => {
    for (const key of SECTION_KEYS) {
      const ratio = contrastRatio('#FFFFFF', SECTION_HUES[key].solid);
      expect(ratio, `${key}: white on solid — ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reward labels on their bright faces clear the floors (ink on Gold/Flame)', () => {
    // §5.1 gives Gold and Flame an ink label (`#1F2430`), not white. The
    // reward *text* tones (`#B34D00`, `#0B6E99`, …) are for painting small text
    // on surfaces/washes — never on the bright face itself.
    for (const key of ['accent', 'streak', 'frozen', 'badge'] as const) {
      const ratio = contrastRatio(SECTION_ON_BRIGHT_INK, REWARD_HUES[key].bright);
      expect(ratio, `${key}: ink on bright — ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reward text tones clear 4.5 on the light surfaces they are painted on', () => {
    for (const key of Object.keys(REWARD_TEXT_COLORS) as (keyof typeof REWARD_TEXT_COLORS)[]) {
      const ratio = contrastRatio(REWARD_TEXT_COLORS[key], '#FFFFFF');
      expect(ratio, `${key}: text tone on white — ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

// Codex P2 on #139 (round 2): a section's colored TEXT must clear 4.5:1 on the
// section's own TINT wash — that pair is what selected chips/rows paint. Grape
// shipped 4.06:1 on its dark tint, so this now covers every section, both
// appearances.
describe('§5.1 section text on section tint (light + dark)', () => {
  const SECTION_KEYS = Object.keys(SECTION_HUES) as (keyof typeof SECTION_HUES)[];

  it('light: the solid text tone clears 4.5 on the tintLight wash', () => {
    for (const key of SECTION_KEYS) {
      const { solid, tintLight } = SECTION_HUES[key];
      const ratio = contrastRatio(solid, tintLight);
      expect(ratio, `${key}: solid on tintLight — ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('dark: the resolved dark text tone clears 4.5 on the tintDark wash', () => {
    for (const key of SECTION_KEYS) {
      const text = SECTION_TEXT_COLORS_DARK[key];
      const { tintDark } = SECTION_HUES[key];
      const ratio = contrastRatio(text, tintDark);
      expect(ratio, `${key}: dark text on tintDark — ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('resolves those text tones through getSectionAccents for both appearances', () => {
    for (const appearance of ['light', 'dark'] as const) {
      const accents = getSectionAccents(appearance);
      for (const key of SECTION_KEYS) {
        const ratio = contrastRatio(accents[key].text, accents[key].tint);
        expect(
          ratio,
          `${appearance} ${key}: resolved text on resolved tint — ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

// Codex P2 on #139 (round 2): WeekStrip paints weekday initials on the reward
// accent (Gold) supplied by GamificationCard / AchievementsScreen.
describe('WeekStrip active-day initials', () => {
  it('use ink, not white, on the reward accent face', () => {
    const ink = contrastRatio(SECTION_ON_BRIGHT_INK, REWARD_COLORS.accent);
    expect(ink, `ink on reward accent — ${ink.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    // The regression this pins: white on Gold is 1.55:1.
    const white = contrastRatio('#FFFFFF', REWARD_COLORS.accent);
    expect(white, `white on reward accent — ${white.toFixed(2)}:1`).toBeLessThan(4.5);
  });
});
