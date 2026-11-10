import { REWARD_HUES, SECTION_HUES, type SectionHue } from '@/constants/sectionColors';
import { inkOnFill, WCAG_AA_TEXT } from '@/core/theme/contrast';
import type { MomentumSource } from './momentum.types';

/**
 * P20 Momentum Garden visual model (docs/ui-ux/16-playful-momentum.md §7
 * "Momentum Garden" + §10 P20).
 *
 * The garden is a **flat illustrated world**: a soft sky band above a single
 * ground line, with one plant species per existing contribution area
 * (Tasks = Sky flowers, Habits = Sprout shrubs, Focus = Grape trees,
 * Workout = Coral cacti, Nutrition = Berry berries, Planning = Gold
 * sunflowers, Weekly Review = Lagoon ferns).
 *
 * Rules this module encodes (all pinned by `tests/momentumGardenVisual.test.ts`):
 * - **Growth only accumulates.** Level 0..3 maps to a strictly taller plant and
 *   never to a shorter or drained variant; no species ever shrinks back and
 *   there is no punitive hue anywhere in the garden (§2 "never imply moral
 *   failure").
 * - **One species per area, one hue per species** (§5.1): the plant's `bright`
 *   tier paints the shape and its `lip` tier paints the stem/detail, so the
 *   garden speaks the same two-tone flat language as the P9 hero icons.
 * - **Read-only.** This module only describes geometry and colour; the art
 *   never writes, orders, or re-derives garden facts (that stays in
 *   `momentum.domain.ts` and is pinned by
 *   `openspec/specs/momentum-garden-hardening`).
 *
 * Pure module: no React, no DB, no theme read. Callers pass resolved accents so
 * every colour pair is unit-testable across all 14 themes.
 */

/** Plant species identifiers, one per contribution area. */
export type GardenSpecies =
  'flower' | 'shrub' | 'tree' | 'cactus' | 'berries' | 'sunflower' | 'fern';

type SpeciesDefinition = {
  species: GardenSpecies;
  /** The area hue that paints this species. */
  hue: 'todos' | 'habits' | 'focus' | 'workout' | 'calories' | 'gold' | 'health';
};

/** Exactly one species per existing momentum source. */
export const GARDEN_SPECIES: Record<MomentumSource, SpeciesDefinition> = {
  tasks: { species: 'flower', hue: 'todos' },
  habits: { species: 'shrub', hue: 'habits' },
  focus: { species: 'tree', hue: 'focus' },
  workout: { species: 'cactus', hue: 'workout' },
  nutrition: { species: 'berries', hue: 'calories' },
  planning: { species: 'sunflower', hue: 'gold' },
  review: { species: 'fern', hue: 'health' },
};

/** Garden scene geometry in the art's 360 × 144 viewBox. */
export const GARDEN_SCENE = {
  width: 360,
  height: 144,
  /** Soft sky band behind the plants (a flat slab, never a gradient). */
  sky: { top: 0, height: 92, radius: 18 },
  /** The single ground line every bed stands on. */
  groundY: 110,
  bedWidth: 44,
  bedHeight: 12,
  /** Bed label baseline; the label font size is a product label (>=11 real px). */
  labelY: 139,
  labelFontSize: 10,
  /** Plant height per growth level. Level 0 = empty bed (no plant at all). */
  heights: [0, 26, 40, 52] as [number, number, number, number],
  /** Bed centres, edge to edge inside the 360-wide scene (no clipping). */
  bedStep: (360 - 24 - 44) / 6,
  bedFirstCentre: 12 + 22,
} as const;

/** Centre x of the bed for each source, in source order. */
export function gardenBedCentre(index: number): number {
  return GARDEN_SCENE.bedFirstCentre + index * GARDEN_SCENE.bedStep;
}

/**
 * Growth scale per contribution level: strictly non-decreasing, and level 0
 * renders an *empty bed* rather than a depleted plant.
 */
export function growthLevelHeight(level: 0 | 1 | 2 | 3): number {
  return GARDEN_SCENE.heights[level];
}

/**
 * Growth signature used by the art to retrigger its grow-in fade only when a
 * real contribution level changes, so unrelated re-renders stay still.
 */
export function gardenGrowthSignature(levels: Record<MomentumSource, 0 | 1 | 2 | 3>): string {
  return (Object.keys(GARDEN_SPECIES) as MomentumSource[])
    .map((source) => `${source}:${levels[source]}`)
    .join('|');
}

export type PlantInk = { bright: string; lip: string };

/**
 * Plant colours for one species: the §5.1 `bright` tier paints the shape (never
 * text on it) and the `lip` tier paints the stem/detail.
 *
 * Planning is the one Gold bed — §5.1 reserves Gold for rewards, and the daily
 * plan is the garden's reward mirror. `accentText` is the appearance-resolved
 * section text tone for the species' own hue, used as the dark-mode detail so
 * the two tones stay distinguishable on the dark canvas.
 */
export function gardenPlantInk(source: MomentumSource): PlantInk {
  const hueKey = GARDEN_SPECIES[source].hue;
  if (hueKey === 'gold') {
    return { bright: REWARD_HUES.accent.bright, lip: REWARD_HUES.accent.lip };
  }
  const hue: SectionHue = SECTION_HUES[hueKey];
  return { bright: hue.bright, lip: hue.lip };
}

/** Sky-band hue: the Lagoon (health) tint reads as a soft sky in both appearances. */
export function gardenSkyFill(tints: { health: string }): string {
  return tints.health;
}

/**
 * The one sun in the sky band: the Gold reward hue at reduced opacity, sized
 * and placed so it clears the tallest plant's crown (sun bottom 32 < plant top
 * 40) instead of colliding with the last bed.
 */
export const GARDEN_SUN = {
  cx: 322,
  cy: 16,
  r: 10,
  fill: REWARD_HUES.accent.bright,
  opacity: 0.75,
} as const;

/**
 * Bed label ink: the label sits on the card face below the ground line, so the
 * theme's own ink clears the text floor there in both appearances; the muted
 * tone is floored against that face for themes where it would not.
 */
export function gardenLabelInk(surface: string, text: string, textMuted: string): string {
  return inkOnFill(surface, textMuted, text, WCAG_AA_TEXT);
}
