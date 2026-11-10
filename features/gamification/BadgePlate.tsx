import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Hexagon badge plate (docs/ui-ux/16-playful-momentum.md §7 "Badge tiles =
 * hexagon/ribbon hero icons in tier colors with a lip").
 *
 * One SVG hexagon draws both the tier face and its visible bottom lip: the lip
 * path is the same hexagon translated down by `lip` px, drawn first in the
 * tier's darker tone, so the plate reads as a solid slab with an edge — the
 * same depth language as `depth.card`, never a blur shadow (§5.7).
 *
 * Shape: a badge hexagon (point up, point down, vertical sides), 64 × 70 units
 * with a 4-unit lip band, so the face is 66 units tall and the plate is
 * 1.09× taller than it is wide on screen.
 *
 * Purely decorative: the badge name/progress live in text beside it, and the
 * caller hides this subtree from the accessibility tree.
 */

/** Plate geometry in the 64 × 70 viewBox. */
const PLATE = {
  width: 64,
  height: 70,
  lip: 4,
  /** Face height: the lip band consumes the bottom of the box. */
  face: 66,
  /** Vertical distance from the top point to the shoulder (and bottom point). */
  shoulder: 16,
} as const;

export const BADGE_PLATE_SIZE = {
  width: PLATE.width,
  height: PLATE.height,
  lip: PLATE.lip,
} as const;

/**
 * A badge hexagon: top point, two shoulders, vertical sides, bottom point.
 * `height` lets the same shape describe the face and the lip slab.
 */
function hexPath(height: number): string {
  const cx = PLATE.width / 2;
  const topShoulder = PLATE.shoulder;
  const bottomShoulder = height - PLATE.shoulder;
  return [
    `M ${cx} 0`,
    `L ${PLATE.width} ${topShoulder}`,
    `L ${PLATE.width} ${bottomShoulder}`,
    `L ${cx} ${height}`,
    `L 0 ${bottomShoulder}`,
    `L 0 ${topShoulder}`,
    'Z',
  ].join(' ');
}

export type BadgePlateProps = {
  /** Tier face fill (§7 Bronze/Silver/Gold/Platinum). */
  fill: string;
  /** Visible depth edge (4px under the face) — the tier's darker tone. */
  lipColor: string;
  /** Plate outline: the tier lip tone, or a ≥3:1 muted ink when locked. */
  outlineColor: string;
  size?: number;
  /** Centered glyph (the badge family's MaterialIcons glyph). */
  children?: React.ReactNode;
};

export function BadgePlate({ fill, lipColor, outlineColor, size = 64, children }: BadgePlateProps) {
  const height = Math.round((size * PLATE.height) / PLATE.width);
  return (
    <View
      style={{ width: size, height, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={size}
        height={height}
        viewBox={`0 0 ${PLATE.width} ${PLATE.height}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Depth: the same hexagon repeated under the face. */}
        <Path d={hexPath(PLATE.face)} fill={lipColor} transform={`translate(0 ${PLATE.lip})`} />
        <Path d={hexPath(PLATE.face)} fill={fill} stroke={outlineColor} strokeWidth={1.5} />
      </Svg>
      {children ? (
        <View
          style={{
            // The face's optical centre sits 2 units above the box centre
            // because the lip band occupies the bottom.
            marginBottom: PLATE.lip,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}
