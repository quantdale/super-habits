import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  contrastRatio,
  readableSurface,
  WCAG_AA_NON_TEXT,
  WCAG_AA_TEXT,
} from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import { SECTION_HUES } from '@/constants/sectionColors';
import {
  setCheckNodeVisual,
  workoutSessionHeaderVisual,
} from '@/features/workout/workoutSessionSet.visual';

/**
 * P16 Workout session contrast matrix (the P13–P15 review lessons, applied up
 * front): every text or glyph painted on a FIXED hue fill must choose its ink
 * against the ACTUAL fill, in all 14 themes. The completed set node's Coral
 * `bright` face (#FF6A4D) and the Coral Finish face do not follow the theme, so
 * `tokens.onSolid`/white land at 2.83:1 on Coral bright.
 *
 * Floors: text 4.5:1, non-text (glyph/outline/boundary) 3:1 (WCAG 1.4.11).
 */
const CORAL = SECTION_HUES.workout;

/** The 48pt set-node target from the screen (`SET_NODE_TARGET`). */
const SET_NODE_TARGET = 48;

describe('Set completion node', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const node = (checked: boolean) =>
      setCheckNodeVisual({
        checked,
        surface: tokens.surface,
        text: tokens.text,
        textMuted: tokens.textMuted,
        onSolid: tokens.onSolid,
      });

    it(`${id} (${theme.appearance}): the unchecked outline clears 3.0 on its face`, () => {
      const visual = node(false);
      expect(visual.face).toBe(tokens.surface);
      expect(
        contrastRatio(visual.outline, visual.face),
        `${id}: unchecked outline ${visual.outline} on ${visual.face}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      // `tokens.border` is invisible (1.25–1.48:1) and must never be the outline.
      expect(visual.outline).not.toBe(tokens.border);
    });

    it(`${id} (${theme.appearance}): the completed node keeps a visible boundary`, () => {
      const visual = node(true);
      expect(visual.face).toBe(CORAL.bright);
      const ratio = contrastRatio(visual.outline, visual.face);
      expect(
        ratio,
        `${id}: completed outline ${visual.outline} on ${visual.face} — ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    });

    it(`${id} (${theme.appearance}): the ✓ glyph clears 3.0 on the Coral face`, () => {
      const visual = node(true);
      const ratio = contrastRatio(visual.glyphInk, visual.face);
      expect(
        ratio,
        `${id}: glyph ${visual.glyphInk} on ${visual.face} — ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    });

    it(`${id} (${theme.appearance}): unchecked and completed faces stay distinct`, () => {
      expect(node(false).face).not.toBe(node(true).face);
      expect(node(false).outline).not.toBe(node(true).outline);
    });
  }

  it('documents why the glyph cannot be the theme onSolid: white on Coral fails 3:1', () => {
    // Every theme's `onSolid` is white here; it reads 2.83:1 on Coral bright, so
    // the helper resolves the §5.1 bright-fill ink instead.
    for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
      const { tokens } = theme;
      const white = contrastRatio('#FFFFFF', CORAL.bright);
      expect(white, `${id}: white on Coral`).toBeLessThan(WCAG_AA_NON_TEXT);
      const visual = setCheckNodeVisual({
        checked: true,
        surface: tokens.surface,
        text: tokens.text,
        textMuted: tokens.textMuted,
        onSolid: '#FFFFFF',
      });
      expect(visual.glyphInk, `${id}: glyph falls back`).not.toBe('#FFFFFF');
    }
  });
});

describe('Session header', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const header = workoutSessionHeaderVisual({
      surface: tokens.surface,
      text: tokens.text,
      textMuted: tokens.textMuted,
      appearance: theme.appearance,
    });

    it(`${id} (${theme.appearance}): timer + routine inks clear 4.5 on the band`, () => {
      for (const ink of [header.ink, header.mutedInk]) {
        expect(
          contrastRatio(ink, header.canvas),
          `${id}: header ink ${ink} on ${header.canvas}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      }
      expect(header.canvas).toBe(tokens.surface);
    });

    it(`${id} (${theme.appearance}): the Coral Finish label clears 4.5 on its painted face`, () => {
      // `Button` deepens a caller hue with `readableSurface` and paints
      // `tokens.buttonText` on it — this measures the ACTUAL pair.
      const paintedFace = readableSurface(header.finishFace, tokens.buttonText);
      const ratio = contrastRatio(tokens.buttonText, paintedFace);
      expect(
        ratio,
        `${id}: Finish label ${tokens.buttonText} on ${paintedFace} — ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it(`${id} (${theme.appearance}): the Finish face stays a visible control on the band`, () => {
      const paintedFace = readableSurface(header.finishFace, tokens.buttonText);
      const ratio = contrastRatio(paintedFace, header.canvas);
      expect(
        ratio,
        `${id}: Finish face ${paintedFace} on ${header.canvas} — ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    });

    it(`${id} (${theme.appearance}): the Finish face follows the §5.1 tier rule`, () => {
      expect(header.finishFace).toBe(theme.appearance === 'dark' ? CORAL.bright : CORAL.solid);
    });
  }
});

/**
 * Wiring pins: the contrast math only protects the session UI if the screen
 * keeps calling it. Source-level because the repository has no React renderer
 * for component tests.
 */
describe('Workout session wiring', () => {
  const screen = readFileSync(
    resolve(__dirname, '../features/workout/WorkoutSessionScreen.tsx'),
    'utf8',
  );

  it('the set node is a 48pt target with resolved inks', () => {
    expect(screen).toMatch(new RegExp(`const SET_NODE_TARGET = ${SET_NODE_TARGET};`));
    // §accessibility floor: the set control's target clears 44pt.
    expect(SET_NODE_TARGET).toBeGreaterThanOrEqual(44);
    expect(screen).toMatch(/const SET_NODE_FACE = 32;/);
    expect(screen).toMatch(/width: SET_NODE_TARGET, height: SET_NODE_TARGET/);
    expect(screen).toMatch(/const visual = setCheckNodeVisual\(\{/);
    expect(screen).toMatch(/borderColor: visual\.outline/);
    expect(screen).toMatch(/backgroundColor: visual\.face/);
    expect(screen).toMatch(/color=\{visual\.glyphInk\}/);
  });

  it('the set node stays an honest button with its existing label', () => {
    expect(screen).toMatch(/accessibilityRole="button"\n\s+accessibilityLabel=\{label\}/);
    expect(screen).toMatch(/label=\{`Complete set \$\{row\.setNumber\}`\}/);
    expect(screen).toMatch(/onPress=\{handleCompleteSet\}/);
  });

  it('set completion is a light pop + haptic only — no XP float or mascot mid-session', () => {
    expect(screen).toMatch(/emitRewardFeedback\('light'\)/);
    expect(screen).toMatch(/useCheckBurst\(\)/);
    expect(screen).not.toMatch(/useXpFloat/);
    expect(screen).not.toMatch(/Sprout/);
  });

  it('the header keeps the tabular 800 timer, End workout, and a Coral Finish', () => {
    expect(screen).toMatch(/const headerVisual = workoutSessionHeaderVisual\(\{/);
    expect(screen).toMatch(/fontFamily: fonts\.bold/);
    expect(screen).toMatch(/fontVariant: \['tabular-nums'\]/);
    expect(screen).toMatch(/accessibilityLabel="End workout"/);
    expect(screen).toMatch(/label="Finish"/);
    expect(screen).toMatch(/color=\{headerVisual\.finishFace\}/);
  });

  it('Finish routes into the existing completion summary (no new save path)', () => {
    expect(screen).toMatch(/const handleFinishEarly = \(\) => \{[\s\S]*?setIsComplete\(true\)/);
    expect(screen).toMatch(/onPress=\{handleFinishEarly\}/);
    // The summary keeps its one save authority.
    expect(screen).toMatch(
      /label=\{isSaving \? 'Saving…' : saveError \? 'Try saving again' : 'Save and finish'\}/,
    );
  });

  it('set rows are 48 high', () => {
    expect(screen).toMatch(/minHeight: 48,\n\s+borderTopColor: tokens\.border/);
  });
});
