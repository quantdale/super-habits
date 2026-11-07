import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  contrastRatio,
  inkOnFill,
  readableSurface,
  WCAG_AA_NON_TEXT,
  WCAG_AA_TEXT,
} from '@/core/theme/contrast';
import { habitDayNodeVisual } from '@/features/habits/habitDayNode.visual';
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

  it('HabitDayStrip derives its node visuals from the shared derivation', () => {
    // The ink/selection rules moved into habitDayNode.visual.ts (pure, so they
    // are asserted directly below); the component must not reimplement them.
    expect(dayStrip).toMatch(/const visual = habitDayNodeVisual\(\{/);
    expect(dayStrip).toMatch(/style=\{\{ color: visual\.ink \}\}/);
  });

  it('HabitDayStrip never paints theme text directly on the fixed bright fill', () => {
    expect(dayStrip).not.toMatch(/color: allComplete \? tokens\.text/);
    expect(dayStrip).not.toMatch(/contentColor/);
  });

  it('HabitCheckInRow paints the quantitative count with the resolved accent text', () => {
    expect(checkInRow).toMatch(/const countColor = sectionAccents\.habits\.text;/);
    expect(checkInRow).toMatch(/color: count > 0 \? countColor : tokens\.textMuted/);
    expect(checkInRow).not.toMatch(/color: count > 0 \? HUE\.solid/);
  });
});

/**
 * Codex P2: a SELECTED COMPLETED day must stay visibly distinct. Completion
 * used to win fill, border and label ink, so selecting a done day changed
 * nothing on screen. The derivation now adds a shape-coded selection ring
 * (Sprout `lip`, drawn inside the completed `bright` face) only for that
 * combination — a selected non-completed day already changes fill, and an
 * unselected day is untouched, so the goldens and the other states are
 * unchanged.
 */
describe('HabitDayStrip selected + completed state', () => {
  const SURFACE_BY_THEME = (id: string) => THEME_REGISTRY[id as keyof typeof THEME_REGISTRY].tokens;

  const visual = (
    tokens: { surface: string; border: string; text: string; onSolid: string },
    allComplete: boolean,
    selected: boolean,
    isToday = false,
  ) =>
    habitDayNodeVisual({
      allComplete,
      selected,
      isToday,
      surface: tokens.surface,
      border: tokens.border,
      text: tokens.text,
      onSolid: tokens.onSolid,
    });

  for (const id of Object.keys(THEME_REGISTRY)) {
    const tokens = SURFACE_BY_THEME(id);

    it(`${id}: selected+completed differs from unselected+completed`, () => {
      const plain = visual(tokens, true, false);
      const picked = visual(tokens, true, true);
      // Something visible must change: the completed face keeps its fill and
      // ink, so the difference is the selection ring itself.
      expect(picked).not.toEqual(plain);
      expect(plain.selectionRing).toBeNull();
      expect(picked.selectionRing).not.toBeNull();
      // The ring is a real shape, not a hairline, and it is its own token.
      expect(picked.selectionRingWidth).toBeGreaterThanOrEqual(2);
      // Selected+completed keeps the completion identity (fill, ink, lip).
      expect(picked.fill).toBe(plain.fill);
      expect(picked.ink).toBe(plain.ink);
      expect(picked.lip).toBe(plain.lip);
    });

    it(`${id}: the selection ring is distinguishable from the completed fill`, () => {
      const picked = visual(tokens, true, true);
      const ratio = contrastRatio(picked.selectionRing ?? '', picked.fill);
      // Non-text adjacent-shape floor (WCAG 1.4.11): the ring must be a
      // perceivable boundary on the bright face, not a near-tone.
      expect(
        ratio,
        `${id}: ring ${picked.selectionRing} on fill ${picked.fill} — ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    });

    it(`${id}: selected+completed labels still clear 4.5 on their fill`, () => {
      const picked = visual(tokens, true, true);
      const ratio = contrastRatio(picked.ink, picked.fill);
      expect(ratio, `${id}: label ${picked.ink} on ${picked.fill}`).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
    });

    it(`${id}: selected+completed today (2px ring-free face) is still distinct`, () => {
      const plainToday = visual(tokens, true, false, true);
      const pickedToday = visual(tokens, true, true, true);
      expect(pickedToday).not.toEqual(plainToday);
      expect(pickedToday.selectionRing).not.toBeNull();
      expect(contrastRatio(pickedToday.ink, pickedToday.fill)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it(`${id}: the other three states are byte-identical to before`, () => {
      // Unselected+incomplete: surface face, theme ink, no ring.
      const idle = visual(tokens, false, false);
      expect(idle.fill).toBe(tokens.surface);
      expect(idle.ink).toBe(tokens.text);
      expect(idle.selectionRing).toBeNull();
      // Unselected+complete: no ring (golden safety).
      expect(visual(tokens, true, false).selectionRing).toBeNull();
      // Selected+incomplete: keeps the readableSurface fill, no ring.
      const pickedIncomplete = visual(tokens, false, true);
      expect(pickedIncomplete.selectionRing).toBeNull();
      expect(pickedIncomplete.fill).toBe(
        readableSurface(SECTION_HUES.habits.bright, tokens.onSolid),
      );
      expect(contrastRatio(pickedIncomplete.ink, pickedIncomplete.fill)).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
    });
  }

  it('the ring uses the theme-invariant Sprout lip in every theme', () => {
    for (const id of Object.keys(THEME_REGISTRY)) {
      expect(visual(SURFACE_BY_THEME(id), true, true).selectionRing).toBe(SECTION_HUES.habits.lip);
    }
  });
});
