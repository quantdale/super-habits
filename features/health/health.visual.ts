import {
  inkOnFill,
  readableAccent,
  tintOver,
  WCAG_AA_NON_TEXT,
  WCAG_AA_TEXT,
} from '@/core/theme/contrast';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';

/**
 * Pure visual models for the Health parent surface (P21b, §5.1/§5.7).
 *
 * Health is one of the two v2 section hues the shell does not render as a
 * destination (Workout and Calories own their destinations), so this screen is
 * the only place `SECTION_HUES.health` (Lagoon) appears. Two rules follow:
 *
 * 1. The hero face is the FIXED §5.1 Lagoon `bright` (`#22CCB8`), which does
 *    not follow the active theme. Theme ink on it lands at 1.87:1 (dark
 *    `text`), 2.02:1 (white) and 1.05–3.64:1 (`textMuted`), so every ink is
 *    resolved against the ACTUAL fill (`inkOnFill` → the §5.1 bright-fill ink
 *    `#10131A`, which reads 9.20:1 there) — the same lesson P15/P16 applied to
 *    Coral.
 * 2. The routing rows take their child section's accent (Coral for Workout,
 *    Berry for Calories) from `sectionAccents`, so a theme's `sectionOverrides`
 *    still win. A 40px tint tile plus a solid-tier glyph (≥4.5:1 on the tint)
 *    is the `ListRow` grammar (§6) — never a white-label face on `bright`.
 *
 * Pure module: no React, no DB, no theme read. Callers pass resolved tokens so
 * every pair is unit-testable across the 14 themes
 * (`tests/secondarySurfaceVisual.test.ts`).
 */
const LAGOON = SECTION_HUES.health;

/** Also the `ListRow` leading-tile size (§6 "leading 40px icon tile"). */
export const HEALTH_TILE_SIZE = 40;

export type HealthHeroVisual = {
  /** The hero face (§6 bright Lagoon). */
  fill: string;
  /** Headline ink on the hero face (≥4.5:1). */
  ink: string;
  /** Quiet second line ink on the hero face (≥4.5:1). */
  mutedInk: string;
};

/**
 * Hero face + inks, resolved against the fixed Lagoon face.
 *
 * `tokens.textMuted` never clears the text floor on Lagoon (best case 3.64:1),
 * so the quiet line falls back to the same §5.1 bright-fill ink; hierarchy
 * comes from the type role, not from a lighter grey. The hero face carries no
 * blur shadow and no border: the `hero` Card variant paints the hue flat
 * (§5.7), and on a charcoal canvas the bright face is its own edge.
 */
export function healthHeroVisual(input: { text: string; textMuted: string }): HealthHeroVisual {
  return {
    fill: LAGOON.bright,
    ink: inkOnFill(LAGOON.bright, input.text, SECTION_ON_BRIGHT_INK),
    mutedInk: inkOnFill(LAGOON.bright, input.textMuted, SECTION_ON_BRIGHT_INK),
  };
}

export type HealthEntryTileVisual = {
  /** Tint wash behind the glyph (§5.1 tint for the active appearance). */
  tile: string;
  /** Glyph ink on that tile — the accent's own `text` tier. */
  ink: string;
};

/**
 * Leading tile for one routing row. `accent` is the child section's resolved
 * `SectionAccent`, so the fill/glyph/tint triple respects theme overrides.
 */
export function healthEntryTileVisual(
  accent: { fill: string; text: string; tint: string },
  surface: string,
): HealthEntryTileVisual {
  // §5.1 tints are 6-digit, but a theme `sectionOverride` may return an
  // 8-digit tint carrying its own alpha (Cyberpunk Neon writes `#FB923C1F`).
  // That is an overlay, not a fill: painted as-is it composites over the row
  // surface, and a 6-digit-only contrast helper would skip the floor entirely
  // (measured: neon Coral text on its own neon tint = 1.00:1). Composite first,
  // then floor the glyph against the colour actually painted.
  const face = compositeTint(accent.tint, surface);
  return {
    tile: face,
    // `accent.text` is the appearance-resolved colored-text tier (solid in
    // light, bright/lifted in dark); the raw `fill` measures ~1.4–2.8:1 on the
    // tint, so it is never the glyph ink.
    ink: readableAccent(accent.text, face, WCAG_AA_TEXT),
  };
}

/** Composite an 8-digit tint overlay onto `surface`; 6-digit input passes through. */
function compositeTint(tint: string, surface: string): string {
  const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/.exec(tint);
  if (!match) return tint;
  const alpha = Number.parseInt(match[2], 16) / 255;
  return tintOver(surface, `#${match[1]}`, alpha);
}

export type HealthStatusVisual = {
  /** Icon name for the day's workout state. */
  icon: 'check-circle' | 'radio-button-unchecked';
  /** State ink: the theme's success ink for "done", the bright-fill ink otherwise. */
  ink: string;
};

/**
 * The hero's trailing state mark. "Done" paints the theme success ink (a
 * status mark, not text) and the pending state paints an ink that clears the
 * 3:1 non-text floor against the Lagoon face.
 *
 * The pending ink is derived from the FILL ITSELF, not from the theme: Lagoon
 * `bright` is a fixed hue that no theme palette can clear 3:1 against (theme
 * text 1.87:1, `textMuted` 1.05–3.64:1, white 2.02:1). `contrastRatio` only
 * understands 6-digit hex, so the floor has to be claimed explicitly on the
 * resolved ink rather than delegated to an `inkOnFill` fallback chain.
 */
export function healthStatusMarkVisual(input: {
  done: boolean;
  accentText: string;
  fill: string;
}): HealthStatusVisual {
  const { done, accentText, fill } = input;
  if (done) {
    return { icon: 'check-circle', ink: accentText };
  }
  return {
    icon: 'radio-button-unchecked',
    // §5.1 bright-fill ink: 9.20:1 on Lagoon, the only tier that clears the
    // non-text floor in every appearance.
    ink: inkOnFill(fill, SECTION_ON_BRIGHT_INK, SECTION_ON_BRIGHT_INK, WCAG_AA_NON_TEXT),
  };
}
