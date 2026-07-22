import { describe, expect, it } from 'vitest';
import {
  SECTION_COLORS,
  SECTION_COLORS_LIGHT,
  SECTION_TEXT_COLORS,
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

  it('uses the fill itself as text and a translucent tint for dark appearance', () => {
    const accents = getSectionAccents('dark');
    expect(accents.habits).toEqual({
      fill: SECTION_COLORS.habits,
      text: SECTION_COLORS.habits,
      tint: `${SECTION_COLORS.habits}1F`,
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
      fill: SECTION_COLORS.habits,
      text: SECTION_COLORS.habits,
      tint: `${SECTION_COLORS.habits}1F`,
    });
  });
});
