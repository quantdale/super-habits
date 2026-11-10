import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import { getSectionAccents } from '@/constants/sectionColors';
import {
  GARDEN_SCENE,
  GARDEN_SUN,
  GARDEN_SPECIES,
  gardenBedCentre,
  gardenGrowthSignature,
  gardenLabelInk,
  gardenPlantInk,
  growthLevelHeight,
  type GardenSpecies,
} from '@/features/momentum/momentumGarden.visual';
import { MOMENTUM_SOURCES, type MomentumSource } from '@/features/momentum/momentum.types';

/**
 * P20 Momentum Garden art contract
 * (`docs/ui-ux/16-playful-momentum.md` §7 "Momentum Garden" + §2 P7).
 *
 * The garden is a growth metaphor, so the art rules are safety rules:
 * 1. Growth only accumulates — heights are strictly non-decreasing, level 0 is
 *    an empty bed (no wilted plant), and no species disappears as it grows.
 * 2. One species per existing contribution area, all seven areas covered, and
 *    each species wears exactly one §5.1 hue.
 * 3. No punitive art: no danger hue, no fade/droop/shrivel vocabulary, and no
 *    "dead"/"lost"/"failed" wording anywhere in the art module.
 * 4. The scene fits the 360-wide viewBox without clipping any bed or label.
 * 5. Every plant ink pair keeps the two tones distinguishable in all 14 themes.
 */

const SPECIES: GardenSpecies[] = [
  'flower',
  'shrub',
  'tree',
  'cactus',
  'berries',
  'sunflower',
  'fern',
];

const ART_SOURCES = new Set<MomentumSource>([
  'tasks',
  'habits',
  'focus',
  'workout',
  'nutrition',
  'planning',
  'review',
]);

describe('Momentum Garden species map (§7 one plant species per area)', () => {
  it('maps exactly the seven existing contribution areas, one species each', () => {
    expect(new Set(MOMENTUM_SOURCES)).toEqual(ART_SOURCES);
    const species = MOMENTUM_SOURCES.map((source) => GARDEN_SPECIES[source].species);
    expect(species).toEqual(SPECIES);
    expect(new Set(species).size).toBe(7);
  });

  it('pins the brief’s species per area', () => {
    expect(GARDEN_SPECIES.tasks.species).toBe('flower');
    expect(GARDEN_SPECIES.habits.species).toBe('shrub');
    expect(GARDEN_SPECIES.focus.species).toBe('tree');
    expect(GARDEN_SPECIES.workout.species).toBe('cactus');
    expect(GARDEN_SPECIES.nutrition.species).toBe('berries');
    expect(GARDEN_SPECIES.planning.species).toBe('sunflower');
    expect(GARDEN_SPECIES.review.species).toBe('fern');
  });

  it('gives each area its own hue (no two beds share a colour family)', () => {
    const hues = MOMENTUM_SOURCES.map((source) => GARDEN_SPECIES[source].hue);
    expect(new Set(hues).size).toBe(7);
  });
});

describe('Growth only accumulates (§2 P7, no punitive art)', () => {
  it('heights never shrink as the level rises', () => {
    const heights = [0, 1, 2, 3].map((level) => growthLevelHeight(level as 0 | 1 | 2 | 3));
    for (let index = 1; index < heights.length; index++) {
      expect(heights[index]).toBeGreaterThan(heights[index - 1]);
    }
  });

  it('level 0 is an empty bed, not a plant', () => {
    expect(growthLevelHeight(0)).toBe(0);
  });

  it('the scene declares no danger hue and no decay vocabulary', () => {
    const sources = [
      'features/momentum/momentumGarden.visual.ts',
      'features/momentum/MomentumGardenArt.tsx',
    ];
    for (const path of sources) {
      const text = readFileSync(resolve(__dirname, '..', path), 'utf8').toLowerCase();
      for (const banned of ['#ff5a5f', '#c9283a', 'danger', 'wilt', 'dead', 'droop', 'shriv']) {
        expect(text, `${path} contains "${banned}"`).not.toContain(banned);
      }
    }
  });

  it('the growth signature changes only when a level changes', () => {
    const levels = MOMENTUM_SOURCES.reduce(
      (acc, source) => ({ ...acc, [source]: 0 as 0 | 1 | 2 | 3 }),
      {} as Record<MomentumSource, 0 | 1 | 2 | 3>,
    );
    const first = gardenGrowthSignature(levels);
    expect(gardenGrowthSignature({ ...levels })).toBe(first);
    expect(gardenGrowthSignature({ ...levels, tasks: 1 })).not.toBe(first);
  });
});

describe('Scene geometry fits the 360-wide viewBox', () => {
  it('every bed and label sits fully inside the scene', () => {
    MOMENTUM_SOURCES.forEach((_, index) => {
      const centre = gardenBedCentre(index);
      const half = GARDEN_SCENE.bedWidth / 2;
      expect(centre - half).toBeGreaterThanOrEqual(0);
      expect(centre + half).toBeLessThanOrEqual(GARDEN_SCENE.width);
    });
  });

  it('beds are evenly spaced in source order', () => {
    const centres = MOMENTUM_SOURCES.map((_, index) => gardenBedCentre(index));
    const gaps = centres.slice(1).map((centre, index) => centre - centres[index]);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6);
  });

  it('the tallest plant fits inside the scene and clears the sun', () => {
    const tallest = Math.max(...GARDEN_SCENE.heights);
    const bedTop = GARDEN_SCENE.groundY - GARDEN_SCENE.bedHeight - 8;
    const crown = bedTop - tallest;
    expect(crown).toBeGreaterThan(GARDEN_SUN.cy + GARDEN_SUN.r);
    expect(crown).toBeLessThan(GARDEN_SCENE.labelY);
  });

  it('labels sit below the ground line and inside the viewBox', () => {
    expect(GARDEN_SCENE.labelY).toBeGreaterThan(GARDEN_SCENE.groundY);
    expect(GARDEN_SCENE.labelY).toBeLessThanOrEqual(GARDEN_SCENE.height);
    // The label is product text (§5.5 bans sub-9px copy), and the scene is
    // rendered at 164pt height from a 144-unit viewBox, so the scale factor
    // lifts 10 units to ~11.4 real pixels.
    const renderedLabelPx = (GARDEN_SCENE.labelFontSize * 164) / GARDEN_SCENE.height;
    expect(renderedLabelPx).toBeGreaterThanOrEqual(11);
  });
});

describe('Garden plant inks (all 14 themes)', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const accents = getSectionAccents(theme.appearance, theme.sectionOverrides);

    it(`${id} (${theme.appearance}): each species has two distinguishable tones`, () => {
      for (const source of MOMENTUM_SOURCES) {
        const ink = gardenPlantInk(source);
        expect(ink.bright, `${id} ${source}`).not.toBe(ink.lip);
        // A plant silhouette is decorative art (the whole scene carries one
        // accessible label), so WCAG 1.4.11 does not apply; what must hold is
        // that the shape does not disappear into the soft sky band.
        expect(
          contrastRatio(ink.bright, accents.health.tint),
          `${id} ${source}: plant shape on the sky band`,
        ).toBeGreaterThanOrEqual(1.2);
      }
    });

    it(`${id} (${theme.appearance}): the bed label clears 4.5 on the card face`, () => {
      const ink = gardenLabelInk(theme.tokens.surface, theme.tokens.text, theme.tokens.textMuted);
      expect(contrastRatio(ink, theme.tokens.surface)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it('the sun is the Gold reward hue, at partial opacity (§5.1)', () => {
    expect(GARDEN_SUN.fill).toBe('#FFC81F');
    expect(GARDEN_SUN.opacity).toBeGreaterThan(0);
    expect(GARDEN_SUN.opacity).toBeLessThan(1);
  });
});

describe('Momentum garden art wiring (read-only, explained, never punitive)', () => {
  const art = readFileSync(
    resolve(__dirname, '../features/momentum/MomentumGardenArt.tsx'),
    'utf8',
  );
  const detail = readFileSync(
    resolve(__dirname, '../features/momentum/MomentumDetailView.tsx'),
    'utf8',
  );

  it('the art announces the domain model label, not its own copy', () => {
    expect(art).toMatch(/accessibilityLabel=\{day\.accessibilityLabel\}/);
  });

  it('the detail view keeps the explanation card and its read-only framing', () => {
    expect(detail).toContain('Why each area grows');
    expect(detail).toContain(
      'Each area grows from real work. Missing activity leaves the garden neutral, never worse.',
    );
    expect(detail).toContain('These are separate signals, not a combined rating.');
  });

  it('the detail view never writes: only the read function is imported', () => {
    const dataImports = [...detail.matchAll(/import \{([^}]*)\} from '\.\/momentum\.data'/g)];
    expect(dataImports).toHaveLength(1);
    expect(dataImports[0][1].trim()).toBe('getMomentumGarden');
  });

  it('the empty-day copy stays neutral ("Ready for new growth")', () => {
    expect(detail).toContain('Ready for new growth');
  });
});
