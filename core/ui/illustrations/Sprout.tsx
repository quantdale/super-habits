import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { SECTION_HUES } from '@/constants/sectionColors';
import { heroIconDecorative } from './icons/heroIconCommon';
import type { SproutPose } from './sproutPoses';

/**
 * "Sprout" — the app mascot (docs/ui-ux/16-playful-momentum.md §5.9): a
 * seedling with a round face growing out of the Momentum Garden, built from
 * simple SVG geometry (no bitmap assets). Five poses:
 *
 * - `idle`  — default standing pose
 * - `cheer` — celebration, leaves up, open smile
 * - `nap`   — rest / empty state (never sad): drooped leaves, closed eyes
 * - `think` — empty search / command: eyes glancing up
 * - `proud` — milestone: hands on hips, broad smile
 *
 * Used at most once per screen and only in hero, empty or celebration contexts.
 * Like every hero illustration it is decorative: the text beside it carries the
 * meaning, so it is hidden from the accessibility tree.
 */

export type { SproutPose } from './sproutPoses';

export type SproutProps = {
  pose?: SproutPose;
  size?: number;
  /** Leaf/face hue — defaults to the Sprout (brand/habits) bright tier. */
  color?: string;
  /** Detail hue (stem, eyes, mouth) — defaults to the Sprout lip tier. */
  detailColor?: string;
};

type PoseArt = {
  /** Left/right leaf petiole angles, in degrees off vertical. */
  leafSpread: 'low' | 'mid' | 'high' | 'droop' | 'hips';
  eyes: 'open' | 'happy' | 'closed' | 'up';
  mouth: 'smile' | 'beam' | 'o' | 'line' | 'grin';
};

const POSE_ART: Record<SproutPose, PoseArt> = {
  idle: { leafSpread: 'mid', eyes: 'open', mouth: 'smile' },
  cheer: { leafSpread: 'high', eyes: 'happy', mouth: 'beam' },
  nap: { leafSpread: 'droop', eyes: 'closed', mouth: 'o' },
  think: { leafSpread: 'mid', eyes: 'up', mouth: 'line' },
  proud: { leafSpread: 'hips', eyes: 'open', mouth: 'grin' },
};

const LEAF_ROTATION: Record<PoseArt['leafSpread'], { left: number; right: number }> = {
  low: { left: -20, right: 20 },
  mid: { left: -35, right: 35 },
  high: { left: -62, right: 62 },
  droop: { left: -8, right: 8 },
  hips: { left: -50, right: 50 },
};

function Eyes({ kind, detail }: { kind: PoseArt['eyes']; detail: string }) {
  if (kind === 'closed') {
    return (
      <>
        <Path
          d="M36 48q3.4 3 6.8 0"
          stroke={detail}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M53.2 48q3.4 3 6.8 0"
          stroke={detail}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      </>
    );
  }
  if (kind === 'happy') {
    return (
      <>
        <Path
          d="M35.5 50q3.9-4.6 7.8 0"
          stroke={detail}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M52.7 50q3.9-4.6 7.8 0"
          stroke={detail}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
      </>
    );
  }
  if (kind === 'up') {
    return (
      <>
        <Circle cx={39.5} cy={46.2} r={2.9} fill={detail} />
        <Circle cx={56.5} cy={46.2} r={2.9} fill={detail} />
      </>
    );
  }
  return (
    <>
      <Circle cx={39.5} cy={48.5} r={2.9} fill={detail} />
      <Circle cx={56.5} cy={48.5} r={2.9} fill={detail} />
    </>
  );
}

function Mouth({ kind, detail }: { kind: PoseArt['mouth']; detail: string }) {
  switch (kind) {
    case 'beam':
      return <Path d="M41 58.5q7 7.5 14 0-7 12-14 0Z" fill={detail} />;
    case 'grin':
      return (
        <Path
          d="M42 58q6 6.5 12 0"
          stroke={detail}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'o':
      return <Ellipse cx={48} cy={59.5} rx={2.6} ry={3.2} fill={detail} />;
    case 'line':
      return (
        <Path d="M43.5 60h9" stroke={detail} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      );
    default:
      return (
        <Path
          d="M42.5 57.5q5.5 5 11 0"
          stroke={detail}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}

/**
 * Sprout mascot. Decorative-only (`accessibilityElementsHidden` +
 * `importantForAccessibility="no-hide-descendants"` + `aria-hidden`), so it
 * never contributes an accessible name.
 */
export function Sprout({ pose = 'idle', size = 120, color, detailColor }: SproutProps) {
  const leaf = color ?? SECTION_HUES.habits.bright;
  const detail = detailColor ?? SECTION_HUES.habits.lip;
  const face = SECTION_HUES.habits.tintLight;
  const art = POSE_ART[pose];
  const spread = LEAF_ROTATION[art.leafSpread];

  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" {...heroIconDecorative}>
      {/* stem + soil mound: Sprout grows out of the garden */}
      <Path d="M48 88V60" stroke={detail} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Ellipse cx={48} cy={88} rx={20} ry={5} fill={detail} opacity={0.25} />

      {/* leaves (arms): rotation carries the pose */}
      <Ellipse
        cx={22}
        cy={56}
        rx={13}
        ry={7}
        fill={leaf}
        transform={`rotate(${spread.left} 22 56)`}
      />
      <Ellipse
        cx={74}
        cy={56}
        rx={13}
        ry={7}
        fill={leaf}
        transform={`rotate(${spread.right} 74 56)`}
      />

      {/* round face */}
      <Circle cx={48} cy={50} r={24} fill={face} />
      <Circle cx={48} cy={50} r={24} stroke={detail} strokeWidth={2.5} fill="none" />

      {/* face detail */}
      <Eyes kind={art.eyes} detail={detail} />
      <Mouth kind={art.mouth} detail={detail} />

      {/* sprout hat: two new leaves on top */}
      <Ellipse cx={41} cy={22.5} rx={8} ry={4.2} fill={leaf} transform="rotate(-32 41 22.5)" />
      <Ellipse cx={55} cy={22.5} rx={8} ry={4.2} fill={leaf} transform="rotate(32 55 22.5)" />
      <Path d="M48 30V21" stroke={detail} strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
