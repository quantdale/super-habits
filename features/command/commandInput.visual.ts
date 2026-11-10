import { SECTION_HUES } from '@/constants/sectionColors';

/**
 * Pure visual model for the Command Center's one primary action (P19,
 * docs/ui-ux/16-playful-momentum.md §7 "Command Center", §5.1 hue tiers,
 * §6 Button).
 *
 * The run button is a global action, so it takes **Sprout** — and it follows
 * the §5.1 tier rule every other section CTA in this campaign uses (P15
 * `workoutHeroVisual.ctaFace`, P16 finish): a LIGHT appearance paints the
 * `solid` tier under a white label, a DARK appearance paints the `bright` tier
 * under the §5.1 ink label. `Button` enforces the label floor on whatever face
 * it is handed, so neither appearance can drift below AA.
 *
 * Pure module (no React, no theme read) so the pair is assertable across all
 * 14 themes in `tests/captureAndCommandContrast.test.ts`.
 */
const SPROUT = SECTION_HUES.habits;

export type CommandRunButtonVisual = {
  /** Face handed to `Button`'s `color` prop (`readableSurface`-safe). */
  face: string;
  /** §5.1 lip under that face (Button derives a shade of its own). */
  lip: string;
  /** True when the face carries the ink label rather than white (§5.1 dark). */
  inkLabel: boolean;
};

export function commandRunButtonVisual(input: {
  appearance: 'light' | 'dark';
}): CommandRunButtonVisual {
  const dark = input.appearance === 'dark';
  return {
    face: dark ? SPROUT.bright : SPROUT.solid,
    lip: dark ? SPROUT.solid : SPROUT.lip,
    inkLabel: dark,
  };
}
