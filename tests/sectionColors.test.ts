import { describe, expect, it } from 'vitest';
import {
  DANGER_HUE,
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
