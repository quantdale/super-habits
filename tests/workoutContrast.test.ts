import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  contrastRatio,
  readableSurface,
  tintOver,
  WCAG_AA_NON_TEXT,
  WCAG_AA_TEXT,
} from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';
import {
  DAY_NODE_RING_INSET,
  DAY_NODE_RING_WIDTH,
  quickStartCardVisual,
  workoutDayNodeVisual,
  workoutHeroVisual,
} from '@/features/workout/workoutLanding.visual';

/**
 * P15 Workout landing contrast matrix (the P13/P14 Codex lessons, applied up
 * front): every text or glyph painted on a FIXED hue fill must choose its ink
 * against the ACTUAL fill, in all 14 themes. The Coral hero face (#FF6A4D) does
 * not follow the theme, so `tokens.text` lands at 2.38–2.62:1 on it in the dark
 * themes; the same is true for the done day nodes.
 *
 * Floors: text 4.5:1, non-text (glyph/outline/ring) 3:1 (WCAG 1.4.11).
 */
const CORAL = SECTION_HUES.workout;
const HERO_FILL = CORAL.bright;

describe('Workout hero inks on the Coral face', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const visual = workoutHeroVisual({
      text: tokens.text,
      textMuted: tokens.textMuted,
      button: tokens.button,
      appearance: theme.appearance,
    });

    it(`${id} (${theme.appearance}): headline ink clears 4.5 on the hero`, () => {
      const ratio = contrastRatio(visual.ink, HERO_FILL);
      expect(ratio, `${id}: hero ink ${visual.ink} on ${HERO_FILL}`).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
    });

    it(`${id} (${theme.appearance}): muted detail ink clears 4.5 on the hero`, () => {
      const ratio = contrastRatio(visual.muttedInk, HERO_FILL);
      expect(ratio, `${id}: hero muted ink ${visual.muttedInk}`).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
    });

    it(`${id} (${theme.appearance}): ghost (face-less) label clears 4.5 on the hero`, () => {
      const ratio = contrastRatio(visual.ghostInk, HERO_FILL);
      expect(ratio, `${id}: ghost ink ${visual.ghostInk}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it('the hero face is the fixed §5.1 Coral bright', () => {
    expect(
      workoutHeroVisual({
        text: '#000000',
        textMuted: '#000000',
        button: '#000000',
        appearance: 'light',
      }).fill,
    ).toBe(HERO_FILL);
  });

  it('documents the pre-fix regression: theme text on the Coral face', () => {
    const light = THEME_REGISTRY.light.tokens;
    const dark = THEME_REGISTRY.dark.tokens;
    // Main painted `tokens.text` / `tokens.textMuted` on a white card, which was
    // fine; the hero face is the new constraint, and it fails for theme ink.
    expect(contrastRatio(dark.text, HERO_FILL)).toBeLessThan(WCAG_AA_TEXT);
    expect(contrastRatio(dark.textMuted, HERO_FILL)).toBeLessThan(WCAG_AA_TEXT);
    expect(contrastRatio(light.textMuted, HERO_FILL)).toBeLessThan(WCAG_AA_TEXT);
    // White on Coral (the naive "CTA on hue" pair) also fails the text floor.
    expect(contrastRatio('#FFFFFF', HERO_FILL)).toBeLessThan(WCAG_AA_TEXT);
    // The §5.1 bright-fill ink is what every theme resolves to.
    expect(contrastRatio(SECTION_ON_BRIGHT_INK, HERO_FILL)).toBeGreaterThanOrEqual(4.5);
  });

  it('the hero CTA face follows the §5.1 tier and its label clears 4.5', () => {
    // Light appearances paint the Coral `solid` face with a white label; dark
    // appearances paint the Coral `bright` face with an ink label. Button still
    // enforces the floor on whatever face it is handed (`readableSurface`).
    for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
      const { buttonText } = theme.tokens;
      const face = workoutHeroVisual({
        text: theme.tokens.text,
        textMuted: theme.tokens.textMuted,
        button: theme.tokens.button,
        appearance: theme.appearance,
      }).ctaFace;
      expect(face, `${id}: CTA face tier`).toBe(
        theme.appearance === 'dark' ? CORAL.bright : CORAL.solid,
      );
      const ratio = contrastRatio(buttonText, readableSurface(face, buttonText));
      expect(
        ratio,
        `${id}: CTA label ${buttonText} on ${face} — ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
  });
});

describe('This week day nodes', () => {
  const STATES = ['done', 'rest', 'planned', 'unassigned'] as const;

  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const node = (state: (typeof STATES)[number], selected = false) =>
      workoutDayNodeVisual({
        state,
        selected,
        surface: tokens.surface,
        surfaceSunken: tokens.surfaceSunken,
        text: tokens.text,
        textMuted: tokens.textMuted,
        onSolid: tokens.onSolid,
      });

    it(`${id} (${theme.appearance}): done node label + glyph clear their floors`, () => {
      const done = node('done');
      expect(contrastRatio(done.ink, done.fill), `${id}: done label`).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
      expect(contrastRatio(done.markInk, done.fill), `${id}: done glyph`).toBeGreaterThanOrEqual(
        WCAG_AA_NON_TEXT,
      );
    });

    it(`${id} (${theme.appearance}): every node outline clears 3.0 on its own fill`, () => {
      for (const state of STATES) {
        const visual = node(state);
        const ratio = contrastRatio(visual.borderColor, visual.fill);
        // A `done` node's border is its own bright fill (the lip slab carries
        // the depth), so only the non-done faces have a boundary to measure.
        if (state === 'done') {
          expect(visual.borderColor).toBe(visual.fill);
          continue;
        }
        expect(
          ratio,
          `${id}/${state}: outline ${visual.borderColor} on ${visual.fill}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      }
    });

    it(`${id} (${theme.appearance}): rest + planned marks clear 3.0 on their fill`, () => {
      for (const state of ['rest', 'planned'] as const) {
        const visual = node(state);
        expect(
          contrastRatio(visual.markInk, visual.fill),
          `${id}/${state}: mark`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      }
    });

    it(`${id} (${theme.appearance}): day label under the node clears 4.5`, () => {
      // The weekday caption is painted on the page surface.
      for (const color of [tokens.text, tokens.textMuted]) {
        expect(
          contrastRatio(color, tokens.surface),
          `${id}: caption ${color}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      }
    });

    it(`${id} (${theme.appearance}): selected+done stays distinct and the ring is visible`, () => {
      const plain = node('done');
      const picked = node('done', true);
      expect(picked).not.toEqual(plain);
      expect(plain.selectionRing).toBeNull();
      expect(picked.selectionRing).not.toBeNull();
      const ringRatio = contrastRatio(picked.selectionRing ?? '', picked.fill);
      expect(
        ringRatio,
        `${id}: ring ${picked.selectionRing} on ${picked.fill} — ${ringRatio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      // Ring geometry hugs the edge so it cannot crowd the glyphs.
      expect(picked.selectionRingWidth).toBe(DAY_NODE_RING_WIDTH);
      expect(picked.selectionRingInset).toBe(DAY_NODE_RING_INSET);
      expect(picked.selectionRingWidth + picked.selectionRingInset).toBeLessThanOrEqual(3);
      // Selection never changes the completion identity.
      expect(picked.fill).toBe(plain.fill);
      expect(picked.ink).toBe(plain.ink);
    });

    it(`${id} (${theme.appearance}): states are shape-coded, not colour-only`, () => {
      expect(node('done').mark).toBe('check');
      expect(node('rest').mark).toBe('moon');
      expect(node('planned').mark).toBe('dot');
      expect(node('unassigned').mark).toBe('none');
    });
  }

  it('never uses tokens.border as the outline (1.25–1.48:1 on surface)', () => {
    for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
      const visual = workoutDayNodeVisual({
        state: 'unassigned',
        selected: false,
        surface: theme.tokens.surface,
        surfaceSunken: theme.tokens.surfaceSunken,
        text: theme.tokens.text,
        textMuted: theme.tokens.textMuted,
        onSolid: theme.tokens.onSolid,
      });
      expect(visual.borderColor, `${id}: outline must not be tokens.border`).not.toBe(
        theme.tokens.border,
      );
      expect(
        contrastRatio(theme.tokens.border, theme.tokens.surface),
        `${id}: tokens.border on surface`,
      ).toBeLessThan(WCAG_AA_NON_TEXT);
    }
  });
});

describe('Quick start cards', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const accentText = theme.sectionOverrides?.workout?.text ?? theme.tokens.primary;
    const visual = quickStartCardVisual({ accentText });

    it(`${id} (${theme.appearance}): the dumbbell glyph ink is the accent text tier`, () => {
      expect(visual.iconInk).toBe(accentText);
      // The tile is the Coral tint wash, not a solid Coral fill.
      expect(visual.iconTile).toBe(`${CORAL.bright}22`);
    });
  }

  it('documents why the glyph is the accent text tier, not Coral bright', () => {
    // On LIGHT surfaces Coral bright is 2.76-2.83:1 — an invisible glyph.
    for (const id of Object.keys(THEME_REGISTRY).filter(
      (key) => THEME_REGISTRY[key as keyof typeof THEME_REGISTRY].appearance === 'light',
    )) {
      const tokens = THEME_REGISTRY[id as keyof typeof THEME_REGISTRY].tokens;
      expect(contrastRatio(CORAL.bright, tokens.surface), `${id}: Coral on surface`).toBeLessThan(
        WCAG_AA_TEXT,
      );
    }
    // And on its OWN tint wash over a LIGHT surface Coral fails badly (2.46:1 on
    // white). On dark washes the bright hue happens to clear the floor, so this
    // is the *reason* the light lanes cannot use Coral ink, not a claim about
    // every theme.
    const lightThemes = Object.entries(THEME_REGISTRY).filter(
      ([, theme]) => theme.appearance === 'light',
    );
    for (const [id, theme] of lightThemes) {
      const wash = tintOver(theme.tokens.surface, CORAL.bright, 0.13);
      const ratio = contrastRatio(CORAL.bright, wash);
      expect(ratio, `${id}: Coral on its wash — ${ratio.toFixed(2)}:1`).toBeLessThan(WCAG_AA_TEXT);
    }
  });
});

/**
 * Wiring pins: the contrast math only protects the UI if the landing keeps
 * calling it. Source-level because the repository has no React renderer for
 * component tests.
 */
describe('Workout landing wiring', () => {
  const screen = readFileSync(resolve(__dirname, '../features/workout/WorkoutScreen.tsx'), 'utf8');

  it('the status hero is a Coral hero Card with resizeable inks from the helper', () => {
    expect(screen).toMatch(/<Card variant="hero" accentColor=\{COLOR\}/);
    expect(screen).toMatch(/const heroVisual = workoutHeroVisual\(\{/);
    expect(screen).toMatch(/style=\{\{ color: heroInk \}\}/);
    expect(screen).toMatch(/style=\{\{ color: heroMutedInk \}\}/);
  });

  it('every face-less control on the hero states the hero face', () => {
    const heroStart = screen.indexOf('<Card variant="hero" accentColor={COLOR}');
    const heroEnd = screen.indexOf('</Card>', heroStart);
    const heroBlock = screen.slice(heroStart, heroEnd);
    const ghosts = [...heroBlock.matchAll(/variant="ghost"/g)].length;
    const onColors = [...heroBlock.matchAll(/onColor=\{COLOR\}/g)].length;
    expect(ghosts).toBeGreaterThan(0);
    // Every ghost states the hero face, and no non-ghost control does.
    expect(onColors).toBe(ghosts);
  });

  it('the hero CTA is one Coral lg primary', () => {
    expect(screen).toMatch(
      /size="lg"\s+onPress=\{handlePrimaryAction\}\s+color=\{heroVisual\.ctaFace\}/,
    );
    expect([...screen.matchAll(/size="lg"/g)]).toHaveLength(1);
  });

  it('this week renders 7 day nodes above the compact assignment rows', () => {
    expect(screen).toMatch(/<WeekDayNodesRow/);
    expect(screen).toMatch(/const node = workoutDayNodeVisual\(\{/);
    expect(screen).toMatch(/\{node\.selectionRing \? \(/);
    // The day sheet is still the assign path for a node press.
    expect(screen).toMatch(/onOpenDay=\{\(cell\) =>[\s\S]{0,200}?setDaySheet\(/);
    // Assignment labels and the W16 aria label are preserved on the rows.
    expect(screen).toMatch(
      /accessibilityLabel=\{`\$\{weekdayLabel\(cell\.weekday\)\}: \$\{assignment\}`\}/,
    );
  });

  it('quick-start cards carry the dumbbell hero icon', () => {
    expect(screen).toMatch(/const cardVisual = quickStartCardVisual\(\{/);
    expect(screen).toMatch(
      /<MaterialIcons name="fitness-center" size=\{22\} color=\{cardVisual\.iconInk\} \/>/,
    );
  });
});
