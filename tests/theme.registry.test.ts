import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import {
  DARK_THEME_IDS,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  LIGHT_THEME_IDS,
  THEME_IDS,
  THEME_REGISTRY,
  getTheme,
  isThemeId,
} from '@/core/theme/registry';

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('THEME_REGISTRY invariants', () => {
  it('every registry key matches its theme definition id', () => {
    for (const [key, theme] of Object.entries(THEME_REGISTRY)) {
      expect(theme.id).toBe(key);
    }
  });

  it('every id is unique and kebab-case', () => {
    expect(new Set(THEME_IDS).size).toBe(THEME_IDS.length);
    for (const id of THEME_IDS) {
      expect(id).toMatch(KEBAB_CASE);
    }
  });

  it('both default theme ids are registered and match their stated appearance', () => {
    expect(THEME_IDS).toContain(DEFAULT_LIGHT_THEME_ID);
    expect(THEME_IDS).toContain(DEFAULT_DARK_THEME_ID);
    expect(getTheme(DEFAULT_LIGHT_THEME_ID).appearance).toBe('light');
    expect(getTheme(DEFAULT_DARK_THEME_ID).appearance).toBe('dark');
  });

  it('partitions every theme into exactly one of LIGHT_THEME_IDS/DARK_THEME_IDS', () => {
    expect(LIGHT_THEME_IDS.length + DARK_THEME_IDS.length).toBe(THEME_IDS.length);
    for (const id of LIGHT_THEME_IDS) {
      expect(THEME_REGISTRY[id].appearance).toBe('light');
    }
    for (const id of DARK_THEME_IDS) {
      expect(THEME_REGISTRY[id].appearance).toBe('dark');
    }
  });

  it('isThemeId narrows correctly, including for unknown/removed ids', () => {
    expect(isThemeId('light')).toBe(true);
    expect(isThemeId('nord-arctic')).toBe(true);
    expect(isThemeId('does-not-exist')).toBe(false);
    expect(isThemeId(42)).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });

  it('ships at least the 14 catalog themes from the design doc', () => {
    expect(THEME_IDS.length).toBeGreaterThanOrEqual(14);
  });
});

// Re-validates the *actual shipped* registry with the same WCAG checks as
// scripts/validate-theme-contrast.mjs, closing the gap the design doc flags:
// "later importing the real registry instead of its embedded copy."
describe('THEME_REGISTRY contrast', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    it(`${id} (${theme.appearance}) meets WCAG AA on every checked pair`, () => {
      const t = theme.tokens;
      const checks: [string, string, string, number][] = [
        ['text on background', t.text, t.background, WCAG_AA_TEXT],
        ['text on surface', t.text, t.surface, WCAG_AA_TEXT],
        ['text on surfaceElevated', t.text, t.surfaceElevated, WCAG_AA_TEXT],
        ['textMuted on surface', t.textMuted, t.surface, WCAG_AA_TEXT],
        ['textMuted on surfaceElevated', t.textMuted, t.surfaceElevated, WCAG_AA_TEXT],
        ['buttonText on button', t.buttonText, t.button, WCAG_AA_TEXT],
        ['buttonText on buttonHover', t.buttonText, t.buttonHover, WCAG_AA_TEXT],
        ['buttonText on buttonActive', t.buttonText, t.buttonActive, WCAG_AA_TEXT],
        ['accent on surface', t.accent, t.surface, WCAG_AA_TEXT],
        ['primary on surface (non-text)', t.primary, t.surface, WCAG_AA_NON_TEXT],
      ];

      for (const [label, fg, bg, min] of checks) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio, `${id}: ${label} — ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      }
    });
  }
});
