import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, inkOnFill, readableSurface, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK, getSectionAccents } from '@/constants/sectionColors';

/**
 * Habits check-in contrast (Codex P2 on PR #193).
 *
 * Two defects shared one cause: a FIXED hue was painted next to text whose ink
 * came from the ACTIVE theme, so only one appearance was legible.
 *
 * 1. `HabitDayStrip` completed day nodes fill the invariant §5.1 Sprout
 *    `bright` (`#4DC93A`) and used `tokens.text` as the label ink. That reads
 *    7.19:1 in the light default but 2.00:1 in dark (`#F4F6FB` on a mid-tone
 *    green) — below the 4.5 text floor for the weekday + date labels.
 * 2. `HabitCheckInRow` quantitative counts used the fixed `habits.solid`
 *    (`#1A7F2B`). That reads 5.10:1 on the light surface but only 3.23:1 on
 *    the dark `surface` — the theme-resolved `sectionAccents.habits.text`
 *    (`bright`) is the accent text that adapts per appearance.
 *
 * The fix derives the ink from the ACTUAL fill (`inkOnFill`) / from the
 * resolved accent (`getSectionAccents`), so these assertions pin the shipped
 * pairs rather than a hardcoded colour.
 */
const HABITS_HUE = SECTION_HUES.habits;

describe('HabitDayStrip completed-day label ink', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;

    it(`${id} (${theme.appearance}): weekday + date labels clear 4.5 on the completed fill`, () => {
      const ink = inkOnFill(HABITS_HUE.bright, tokens.text, SECTION_ON_BRIGHT_INK);
      const ratio = inkOnFillRatio(ink, HABITS_HUE.bright);
      expect(ratio, `${id}: done-node ink ${ink} on ${HABITS_HUE.bright}`).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
    });

    it(`${id} (${theme.appearance}): selected-day ink clears 4.5 on the selected fill`, () => {
      // Selected nodes fill `readableSurface(bright, onSolid)` and paint
      // `onSolid` — that pair is what the component branches to.
      const selectedFill = readableSurface(HABITS_HUE.bright, tokens.onSolid);
      const ratio = inkOnFillRatio(tokens.onSolid, selectedFill);
      expect(
        ratio,
        `${id}: selected ink ${tokens.onSolid} on ${selectedFill}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it(`${id} (${theme.appearance}): pending-day ink clears 4.5 on the surface face`, () => {
      // Pending nodes keep the theme surface + `tokens.text` (unchanged), and
      // must stay legible so the strip never trades one state's contrast for
      // another's.
      const ratio = inkOnFillRatio(tokens.text, tokens.surface);
      expect(ratio, `${id}: pending ink on surface`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it('documents the regression: the dark default text on Sprout bright is ~2:1', () => {
    const darkText = THEME_REGISTRY.dark.tokens.text;
    expect(inkOnFillRatio(darkText, HABITS_HUE.bright)).toBeLessThan(WCAG_AA_TEXT);
    // And the light default keeps its native ink (no unnecessary churn).
    expect(
      inkOnFill(HABITS_HUE.bright, THEME_REGISTRY.light.tokens.text, SECTION_ON_BRIGHT_INK),
    ).toBe(THEME_REGISTRY.light.tokens.text);
    // The dark default switches to the §5.1 bright-fill ink.
    expect(inkOnFill(HABITS_HUE.bright, darkText, SECTION_ON_BRIGHT_INK)).toBe(
      SECTION_ON_BRIGHT_INK,
    );
  });
});

describe('HabitCheckInRow quantitative count ink', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const accent = getSectionAccents(theme.appearance, theme.sectionOverrides).habits.text;

    it(`${id} (${theme.appearance}): count text clears 4.5 on surface and background`, () => {
      for (const [label, bg] of [
        ['surface', tokens.surface],
        ['background', tokens.background],
      ] as const) {
        const ratio = inkOnFillRatio(accent, bg);
        expect(ratio, `${id}: habits accent ${accent} on ${label} ${bg}`).toBeGreaterThanOrEqual(
          WCAG_AA_TEXT,
        );
      }
    });
  }

  it('dark: the fixed solid tier fails on the dark surface (the shipped bug)', () => {
    expect(inkOnFillRatio(HABITS_HUE.solid, THEME_REGISTRY.dark.tokens.surface)).toBeLessThan(
      WCAG_AA_TEXT,
    );
    // The resolved dark accent is the `bright` tier and clears comfortably.
    expect(getSectionAccents('dark').habits.text).toBe(HABITS_HUE.bright);
  });

  it('light: the resolved accent is still the solid tier at 5.1:1 on white', () => {
    expect(getSectionAccents('light').habits.text).toBe(HABITS_HUE.solid);
    expect(
      inkOnFillRatio(HABITS_HUE.solid, THEME_REGISTRY.light.tokens.surface),
    ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

/** Reads as `ink on fill` at the call sites; delegates to the shared math. */
function inkOnFillRatio(ink: string, fill: string): number {
  return contrastRatio(ink, fill);
}

/**
 * Wiring pins: the contrast math above only protects the UI if the components
 * keep calling it. Source-level because the repository has no React renderer
 * for component tests (same pattern as `habitsScreenDayRollover.test.ts`).
 */
describe('Habits contrast wiring', () => {
  const dayStrip = readFileSync(resolve(__dirname, '../features/habits/HabitDayStrip.tsx'), 'utf8');
  const checkInRow = readFileSync(
    resolve(__dirname, '../features/habits/HabitCheckInRow.tsx'),
    'utf8',
  );

  it('HabitDayStrip derives the completed-node ink from the actual fill', () => {
    expect(dayStrip).toMatch(/inkOnFill\(HUE\.bright, tokens\.text, SECTION_ON_BRIGHT_INK\)/);
    expect(dayStrip).toMatch(/allComplete \? doneInk/);
  });

  it('HabitDayStrip never paints theme text directly on the fixed bright fill', () => {
    expect(dayStrip).not.toMatch(/const contentColor = allComplete \? tokens\.text/);
  });

  it('HabitCheckInRow paints the quantitative count with the resolved accent text', () => {
    expect(checkInRow).toMatch(/const countColor = sectionAccents\.habits\.text;/);
    expect(checkInRow).toMatch(/color: count > 0 \? countColor : tokens\.textMuted/);
    expect(checkInRow).not.toMatch(/color: count > 0 \? HUE\.solid/);
  });
});
