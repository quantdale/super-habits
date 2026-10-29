import type { SvgProps } from 'react-native-svg';

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
