import type { SvgProps } from 'react-native-svg';
import { darken, lighten, tintOver } from '@/core/theme/contrast';

/**
 * P9 hero icon contract (docs/ui-ux/16-playful-momentum.md §5.9).
 *
 * Every hero icon is a 2-tone flat duotone on a 32 viewBox that scales cleanly
 * to the 24/32/48 grids used by tabs, cards and hero moments. The two tones are
 * the §5.1 tiers: `bright` (shapes) and `lip` (depth/detail). Colors are props
 * so callers can paint an icon with a section or reward hue; each icon supplies
 * its role-appropriate defaults from `constants/sectionColors`.
 *
 * All hero icon SVGs are decorative: the accessible name lives on the
 * surrounding control/label, so they are hidden from the accessibility tree.
 */
export type HeroIconProps = {
  /** Rendered edge length (24 / 32 / 48 by convention). */
  size?: number;
  /** Primary duotone face — the §5.1 `bright` tier. */
  bright?: string;
  /** Secondary duotone detail — the §5.1 `lip` tier. */
  lip?: string;
};

type DecorativeSvgProps = Pick<
  SvgProps,
  'accessibilityElementsHidden' | 'importantForAccessibility' | 'aria-hidden'
>;

/** Decorative-only a11y wrapper shared by every hero icon and mascot pose. */
export const heroIconDecorative: DecorativeSvgProps = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  'aria-hidden': true,
};

/**
 * P10 inactive-tab monochrome tones (§6 Tabs "monochrome iconMuted version",
 * r2 defect fix).
 *
 * Painting both duotone passes with one color flattens every hero icon into a
 * silhouette (To Do = plain square, Focus = blob). The monochrome mode keeps
 * the duotone structure: the glyph silhouette takes the stronger muted tone
 * and the detail layer takes a LIGHTER muted tone (recording toward the canvas
 * in both appearances), so the icon keeps its inner detail. Both tones stay
 * >= 3:1 against the tab tile (light: 5.96 / 3.82 on white; dark: 7.7 / 5.4
 * on #1A1F2B).
 */
export function heroIconMonochromeTones(
  muted: string,
  soft: string,
): { bright: string; lip: string } {
  if (muted.toLowerCase() !== soft.toLowerCase()) {
    // Midpoint of the two muted tones: distinct from the silhouette, always
    // between it and the softer tone (which sits nearer the canvas).
    return { bright: muted, lip: tintOver(muted, soft, 0.5) };
  }
  // Themes that only supply `textMuted` (createTheme mirrors it into
  // `iconMuted`) collapse the pair — derive a distinct detail tone toward the
  // canvas by luminance so the duotone never flattens there either.
  const lum = luminance(muted);
  return { bright: muted, lip: lum >= 0.4 ? darken(muted, 0.28) : lighten(muted, 0.28) };
}

/** WCAG relative luminance of a #RRGGBB color (for tone direction only). */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
