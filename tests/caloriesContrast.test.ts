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
import { getSectionAccents, SECTION_HUES } from '@/constants/sectionColors';
import {
  CALORIES_HERO_BAR_HEIGHT,
  CALORIES_MINI_BAR_HEIGHT,
  caloriesHeroVisual,
} from '@/features/calories/caloriesHero.visual';

/**
 * P17 Calories contrast matrix (docs/ui-ux/16-playful-momentum.md §7 "Calories",
 * §5.1 "Berry", §5.7 depth, §6 ProgressBar/SegmentedControl).
 *
 * The P17 pass repaints the Calories surface in ONE hue (Berry) on the theme's
 * flat card faces, which reintroduces the exact P13–P16 defect class: a FIXED
 * hue paired with ink borrowed from the ACTIVE theme. §5.1 names the tiers
 * (`bright` = shapes only, `solid` = button face + colored text, `lip` =
 * press depth), and the measured numbers say why the tier must follow the
 * appearance rather than a constant:
 *
 * - `bright` Berry (#FF6FAE) on a white card face = **2.58:1** — under the 3:1
 *   non-text floor, so it can never be the bar/metric fill in light mode;
 * - `solid` Berry (#C02670) on the light card face = **5.60:1**;
 * - in the dark default the roles swap: `bright` on #1A1F2B = **6.38:1**
 *   while `solid` on the same face = **2.94:1**.
 *
 * Every pair the components actually paint is asserted below for all 14 themes,
 * and the source pins prove the components keep consuming the resolved values
 * instead of hardcoding a tier.
 */
const BERRY = SECTION_HUES.calories;

/** The screen's real call (`CaloriesScreen` buildHeroVisual). */
function visualFor(theme: (typeof THEME_REGISTRY)[string]) {
  const { tokens } = theme;
  const accents = getSectionAccents(theme.appearance, theme.sectionOverrides).calories;
  return caloriesHeroVisual({
    appearance: theme.appearance,
    accentFill: accents.fill,
    accentText: accents.text,
    surface: tokens.surface,
    surfaceSunken: tokens.surfaceSunken,
    text: tokens.text,
    textMuted: tokens.textMuted,
  });
}

describe('Calories hero: one Berry hue, resolved per appearance', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const visual = visualFor(theme);

    it(`${id} (${theme.appearance}): the bars clear 3:1 on the track AND the card face`, () => {
      for (const [label, background] of [
        ['surfaceSunken track', tokens.surfaceSunken],
        ['surface card face', tokens.surface],
      ] as const) {
        const ratio = contrastRatio(visual.barFill, background);
        expect(
          ratio,
          `${id}: barFill ${visual.barFill} on ${label} ${background} — ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      }
    });

    it(`${id} (${theme.appearance}): the remaining-kcal metric clears 4.5 on the card face`, () => {
      expect(
        contrastRatio(visual.metricInk, tokens.surface),
        `${id}: metric ink ${visual.metricInk} on ${tokens.surface}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it(`${id} (${theme.appearance}): the context caption clears 4.5 on the card face`, () => {
      expect(
        contrastRatio(visual.mutedInk, tokens.surface),
        `${id}: caption ink ${visual.mutedInk} on ${tokens.surface}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it(`${id} (${theme.appearance}): the primary CTA face carries a 4.5:1 label`, () => {
      // `Button` deepens a caller colour with `readableSurface` until the label
      // clears the floor; assert the pair the user actually sees.
      const painted = readableSurface(visual.ctaFace, tokens.buttonText);
      expect(
        contrastRatio(tokens.buttonText, painted),
        `${id}: label ${tokens.buttonText} on CTA face ${painted}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it(`${id} (${theme.appearance}): the Form/Diary segment label clears 4.5 on the white thumb`, () => {
      // SegmentedControl paints the active label on its own thumb face, which
      // is the theme surface inside the sunken tray (never a hardcoded white).
      const thumbFace = tokens.surface;
      expect(
        contrastRatio(visual.segmentedAccent, thumbFace),
        `${id}: segment accent ${visual.segmentedAccent} on thumb ${thumbFace}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it('documents the regression the resolver exists to prevent', () => {
    const light = THEME_REGISTRY.light.tokens;
    const dark = THEME_REGISTRY.dark.tokens;
    // The raw §5.1 bright tier is a SHAPE hue: it cannot carry a text label
    // (2.58:1 on a white card) and misses even the 3:1 non-text floor there.
    expect(contrastRatio(BERRY.bright, light.surface)).toBeLessThan(WCAG_AA_NON_TEXT);
    expect(contrastRatio(BERRY.bright, light.surface)).toBeLessThan(WCAG_AA_TEXT);
    // The light appearance therefore paints the solid tier as its Berry shape.
    expect(visualFor(THEME_REGISTRY.light).barFill).toBe(BERRY.solid);
    // The dark appearance keeps the bright tier, which is the legible pair there.
    expect(visualFor(THEME_REGISTRY.dark).barFill).toBe(BERRY.bright);
    // And the symmetric trap: solid Berry on the dark card face is 2.94:1.
    expect(contrastRatio(BERRY.solid, dark.surface)).toBeLessThan(WCAG_AA_NON_TEXT);
  });

  it('keeps the §6 bar geometry (14px hero bar, 8px macro mini bars)', () => {
    expect(CALORIES_HERO_BAR_HEIGHT).toBe(14);
    expect(CALORIES_MINI_BAR_HEIGHT).toBe(8);
  });
});

/**
 * Wiring pins: the contrast math only protects the UI if the screen keeps
 * passing the resolved values. Source-level because this repository has no
 * React renderer for component tests (the same pattern as
 * `tests/habitsContrast.test.ts` / `tests/workoutSessionContrast.test.ts`).
 */
describe('Calories P17 wiring', () => {
  const screen = readFileSync(
    resolve(__dirname, '../features/calories/CaloriesScreen.tsx'),
    'utf8',
  );
  const hero = readFileSync(
    resolve(__dirname, '../features/calories/CaloriesDailyHero.tsx'),
    'utf8',
  );
  const macros = readFileSync(
    resolve(__dirname, '../features/calories/CaloriesMacroSummary.tsx'),
    'utf8',
  );
  const form = readFileSync(
    resolve(__dirname, '../features/calories/CaloriesFormView.tsx'),
    'utf8',
  );

  it('the screen resolves the Berry pair once from the active theme', () => {
    expect(screen).toContain('const heroVisual = caloriesHeroVisual({');
    expect(screen).toContain('appearance: resolvedTheme,');
    expect(screen).toContain('accentFill: sectionAccents.calories.fill,');
    expect(screen).toContain('accentText: sectionAccents.calories.text,');
    expect(screen).toContain('surfaceSunken: tokens.surfaceSunken,');
    // The hero card and the macro card consume the SAME resolved values, so the
    // surface can never show two different Berry tiers side by side.
    expect(screen).toContain('barFill={heroVisual.barFill}');
    expect(screen.match(/barFill=\{heroVisual\.barFill\}/g)).toHaveLength(2);
  });

  it('the daily bar and the metric/caption inks are the resolved pairs', () => {
    expect(hero).toContain('variant="metric"');
    expect(hero).toContain('style={{ color: metricInk }}');
    expect(hero).toContain('accentColor={barFill}');
    expect(hero).toContain('height={CALORIES_HERO_BAR_HEIGHT}');
    // The W10 fact strings the E2E contract asserts are untouched.
    expect(hero).toContain('{formatDayContext(dateKey)} · {formatKcal(consumed)} of ');
    expect(hero).toContain('kcal logged');
    expect(hero).toContain('accessibilityLabel="Edit daily calorie goal"');
  });

  it('the three macro mini bars share the one Berry fill', () => {
    expect(macros).toContain('backgroundColor: barFill,');
    expect(macros).toContain('height: CALORIES_MINI_BAR_HEIGHT,');
    // Each bar stays decorative: the numbers beside it carry the information.
    expect(macros).toContain('accessibilityElementsHidden');
    expect(macros).toContain('{formatGrams(row.actual)}g / {formatGrams(row.target)}g');
  });

  it('the Form CTA keeps its asserted label and takes the tiered face', () => {
    expect(form).toContain('color={primaryActionColor}');
    expect(form).toContain('accessibilityLabel="Save calorie entry"');
    // The one visible Add label is unchanged (dominance assertion in E2E).
    expect(form).toContain('label="Add entry"');
    expect(screen).toContain('primaryActionColor={heroVisual.ctaFace}');
  });

  it('the segmented control takes the text-safe tier, not the raw fill', () => {
    // `ViewModeSwitch` forwards a resolved accent instead of the module constant
    // (the raw §5.1 bright fill, 2.58:1 on a white thumb).
    expect(screen).toContain('accentColor={heroVisual.segmentedAccent}');
    expect(screen).toContain('<SegmentedControl');
    expect(screen).toContain('accentColor: string;');
    expect(screen).toContain('accentColor={accentColor}');
  });
});
