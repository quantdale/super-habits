import { describe, expect, it } from 'vitest';
import {
  SECTION_COLORS,
  SECTION_COLORS_LIGHT,
  SECTION_TEXT_COLORS,
  SECTION_TEXT_COLORS_DARK,
  getSectionAccents,
} from '@/constants/sectionColors';

describe('getSectionAccents', () => {
  it('uses the 700-level text and pastel tint for light appearance', () => {
    const accents = getSectionAccents('light');
    expect(accents.todos).toEqual({
      fill: SECTION_COLORS.todos,
      text: SECTION_TEXT_COLORS.todos,
      tint: SECTION_COLORS_LIGHT.todos,
    });
  });

  it('uses the brighter 300/400 text variant and a translucent tint for dark appearance', () => {
    const accents = getSectionAccents('dark');
    expect(accents.habits).toEqual({
      fill: SECTION_COLORS.habits,
      text: SECTION_TEXT_COLORS_DARK.habits,
      tint: `${SECTION_COLORS.habits}1F`,
    });
    // The mid-tone fill itself is not readable as text on dark surfaces.
    expect(accents.habits.text).not.toBe(accents.habits.fill);
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
      fill: SECTION_COLORS.habits,
      text: SECTION_TEXT_COLORS_DARK.habits,
      tint: `${SECTION_COLORS.habits}1F`,
    });
  });
});
