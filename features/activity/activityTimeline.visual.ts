import { readableAccent, tintOver, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { SECTION_HUES, type SectionAccent, type SectionKey } from '@/constants/sectionColors';
import type { ActivityTimelineItem, ActivityTimelineSource } from './activityTimeline.types';

/**
 * Pure visual models for the Activity Timeline (P21b, §5.1/§6 `ListRow`).
 *
 * The timeline is a merged cross-feature feed, so it is the one place where
 * per-row colour is *informative*: a row's leading 40px tile takes the hue of
 * the area that produced the event (Sky for todos/planning, Sprout for habits,
 * Grape for focus, Coral for workouts, Berry for calories). Chrome — the title,
 * the Filters control, the chips — stays Sky, so the surface still reads as one
 * place rather than a rainbow (the P21 "one hue per surface" rule §5.1).
 *
 * Two non-negotiables encoded here:
 *
 * 1. **Never colour alone.** The category word (`Productivity` / `Health` /
 *    `Planning`) stays in every row's metadata line, so the tile is redundancy,
 *    not the only carrier of meaning.
 * 2. **Ink is resolved against the ACTUAL tile fill.** A theme's
 *    `sectionOverrides` can repaint a hue (Cyberpunk Neon paints six of them in
 *    neon), and the §5.1 dark `tint` is a different wash than the light one,
 *    so the glyph ink is floored against the resolved tint instead of trusting
 *    the accent's `text` tier to land on it.
 *
 * Pure module: no React, no DB, no theme read — callers pass the already
 * resolved `sectionAccents`, which keeps every pair unit-testable across the
 * 14 themes (`tests/secondarySurfaceVisual.test.ts`).
 */

/**
 * Which section hue owns a timeline source.
 *
 * `planning` sources (daily plans, weekly reviews, projects, goals) deliberately
 * take Sky: the timeline itself lives in the Planning Hub drawer whose chrome
 * is Sky, and the hub's own entities are that surface's subject. A second
 * "planning" hue does not exist in the §5.1 table, and inventing one here would
 * put a non-spec colour on screen.
 */
export const ACTIVITY_SOURCE_SECTION: Record<ActivityTimelineSource, SectionKey> = {
  todo: 'todos',
  project: 'todos',
  goal: 'todos',
  focus: 'focus',
  habit: 'habits',
  workout: 'workout',
  calories: 'calories',
  daily_plan: 'todos',
  weekly_review: 'todos',
};

/** Section key for one event, resolved through its source. */
export function resolveActivitySource(source: ActivityTimelineSource): SectionKey {
  return ACTIVITY_SOURCE_SECTION[source] ?? 'todos';
}

export type ActivitySourceTileVisual = {
  /** MaterialIcons glyph name for the event source (unchanged from the data layer). */
  glyph: string;
  /** Tile face: the section's appearance-resolved `tint`. */
  face: string;
  /** Glyph ink floored at 4.5:1 on `face`. */
  ink: string;
};

/**
 * The face colour a tile actually paints, resolved to a 6-digit hex.
 *
 * §5.1's shipped tints are 6-digit (`#E2F3FE` / `#1E3850`), but a theme
 * `sectionOverride` may hand back an 8-digit tint carrying its own alpha
 * (Cyberpunk Neon writes `#FB923C1F`). That value is an *overlay*, not a fill:
 * painted as-is it renders as the composite over the surface, and
 * `contrastRatio()` (like `readableAccent()`) only understands 6-digit hex and
 * would silently skip the floor. Compositing here keeps the ink guarantee real
 * on every theme instead of only on the themes with spec-format tints.
 */
export function resolveTileFace(tint: string, surface: string): string {
  const tintMatch = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/.exec(tint);
  if (!tintMatch) return tint;
  const alpha = Number.parseInt(tintMatch[2], 16) / 255;
  return tintOver(surface, `#${tintMatch[1]}`, alpha);
}

/**
 * Leading tile for a row rendered in a `ListGroup`.
 *
 * `accent.tint` is already the §5.1 tint for the active appearance, and
 * `accent.text` is the matching colored-text tier. The latter is an *intent*,
 * not a guarantee — a theme override can pair a fill with a tint where the
 * solid tier does not reach 4.5:1 — so `readableAccent` nudges the glyph ink
 * against the actual tint, giving a 4.5:1 floor on every theme.
 */
export function activitySourceTileVisual(
  section: SectionKey,
  accents: Record<SectionKey, SectionAccent>,
  glyph: string,
  surface: string,
): ActivitySourceTileVisual {
  const accent = accents[section];
  const face = resolveTileFace(accent.tint, surface);
  return {
    glyph,
    face,
    ink: readableAccent(accent.text, face, WCAG_AA_TEXT),
  };
}

/** Tile for one loaded item, deriving its source hue from the item itself. */
export function activityItemTileVisual(
  item: ActivityTimelineItem,
  accents: Record<SectionKey, SectionAccent>,
  surface: string,
): ActivitySourceTileVisual {
  return activitySourceTileVisual(resolveActivitySource(item.source), accents, item.icon, surface);
}

export type ActivityChromeVisual = {
  /** Tinted face for a selected filter chip (Sky tint over the card face). */
  selectedFill: string;
  /**
   * Selected chip outline. P6 `Chip` paints its `color` prop as the active
   * border and this screen hands it the Sky **bright** tier, so the model
   * mirrors what renders instead of inventing a second boundary tier.
   */
  selectedBorder: string;
  /** Selected chip label floored at 4.5:1 on that tint. */
  selectedInk: string;
};

/**
 * Chrome chips. Every source/range/day chip is Sky regardless of which source
 * it selects, because the control belongs to the surface, not to the data.
 * (`Chip`/`PillChip` derives the same values inline; this model exists so the
 * contrast matrix pins the pairs the screen renders.)
 */
export function activityChromeChipVisual(input: {
  appearance: 'light' | 'dark';
}): ActivityChromeVisual {
  const sky = SECTION_HUES.todos;
  const tintBase = input.appearance === 'dark' ? '#1A1F2B' : '#FFFFFF';
  const selectedFill = tintOver(tintBase, sky.bright, input.appearance === 'dark' ? 0.18 : 0.14);
  return {
    selectedFill,
    selectedBorder: sky.bright,
    selectedInk: readableAccent(sky.bright, selectedFill, WCAG_AA_TEXT),
  };
}
