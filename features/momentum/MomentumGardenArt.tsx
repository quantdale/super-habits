import { useEffect, useMemo, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '@/core/providers/themeContext';
import { MOTION_DURATION, useReducedMotion } from '@/core/theme/motion';
import {
  GARDEN_SCENE,
  GARDEN_SPECIES,
  GARDEN_SUN,
  gardenBedCentre,
  gardenGrowthSignature,
  gardenLabelInk,
  gardenPlantInk,
  gardenSkyFill,
  growthLevelHeight,
  type GardenSpecies,
} from './momentumGarden.visual';
import type { MomentumDay, MomentumSource } from './momentum.types';

type MomentumGardenArtProps = {
  day: MomentumDay;
  height?: number;
};

const SOURCE_LABELS: Record<MomentumSource, string> = {
  tasks: 'Tasks',
  habits: 'Habits',
  focus: 'Focus',
  workout: 'Train',
  nutrition: 'Food',
  planning: 'Plan',
  review: 'Review',
};

const SOURCE_ORDER: MomentumSource[] = [
  'tasks',
  'habits',
  'focus',
  'workout',
  'nutrition',
  'planning',
  'review',
];

type BedGeometry = {
  centre: number;
  /** Stem top; equals the bed top (no plant) at level 0. */
  top: number;
  level: 0 | 1 | 2 | 3;
};

function bedGeometry(source: MomentumSource, index: number, level: 0 | 1 | 2 | 3): BedGeometry {
  const centre = gardenBedCentre(index);
  const bedTop = GARDEN_SCENE.groundY - GARDEN_SCENE.bedHeight - 8;
  return { centre, top: bedTop - growthLevelHeight(level), level };
}

/**
 * One flat plant species (§7 "one plant species per contributing area").
 *
 * Every species grows by getting **taller only**: no shape ever bends down,
 * drains, or empties out. A level-0 bed simply stands empty with a soft seed
 * mark, so an untouched area reads as "ready", never as failure.
 */
function GardenPlant({
  species,
  geometry,
  ink,
  label,
  labelInk,
  outline,
  seed,
}: {
  species: GardenSpecies;
  geometry: BedGeometry;
  ink: { bright: string; lip: string };
  label: string;
  labelInk: string;
  outline: string;
  seed: string;
}) {
  const { centre, top, level } = geometry;
  const stemBottom = GARDEN_SCENE.groundY - GARDEN_SCENE.bedHeight;
  const stemHeight = Math.max(0, stemBottom - top);

  return (
    <>
      {/* The bed: a stable soil slab in the sunken neutral (no per-area tint). */}
      <Rect
        x={centre - GARDEN_SCENE.bedWidth / 2}
        y={GARDEN_SCENE.groundY - GARDEN_SCENE.bedHeight}
        width={GARDEN_SCENE.bedWidth}
        height={GARDEN_SCENE.bedHeight}
        rx={GARDEN_SCENE.bedHeight / 2}
        fill={outline}
      />

      {level === 0 ? (
        // Empty bed: two seed marks. Rest, not absence.
        <>
          <Circle cx={centre - 5} cy={stemBottom - 2} r={1.8} fill={seed} opacity={0.55} />
          <Circle cx={centre + 5} cy={stemBottom - 2} r={1.8} fill={seed} opacity={0.55} />
        </>
      ) : (
        <>
          <Line
            x1={centre}
            y1={stemBottom}
            x2={centre}
            y2={top}
            stroke={ink.lip}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {species === 'flower' ? (
            <>
              <Circle cx={centre} cy={top} r={6} fill={ink.bright} />
              <Circle cx={centre} cy={top} r={2.2} fill={ink.lip} />
              {level >= 2 ? (
                <Circle cx={centre - 8} cy={top + 10} r={4.2} fill={ink.bright} />
              ) : null}
              {level >= 3 ? (
                <Circle cx={centre + 8} cy={top + 8} r={4.2} fill={ink.bright} />
              ) : null}
            </>
          ) : species === 'shrub' ? (
            <>
              <Circle cx={centre - 5} cy={top + 5} r={7} fill={ink.bright} />
              <Circle cx={centre + 5} cy={top + 5} r={7} fill={ink.bright} />
              {level >= 2 ? <Circle cx={centre} cy={top} r={7} fill={ink.bright} /> : null}
              {level >= 3 ? (
                <Circle cx={centre} cy={top - 4} r={5.5} fill={ink.lip} opacity={0.85} />
              ) : null}
            </>
          ) : species === 'tree' ? (
            <>
              <Circle cx={centre} cy={top} r={level >= 3 ? 10 : 8} fill={ink.bright} />
              <Ellipse
                cx={centre - 7}
                cy={top + 5}
                rx={5}
                ry={3}
                fill={ink.bright}
                opacity={0.85}
              />
              {level >= 2 ? (
                <Ellipse
                  cx={centre + 7}
                  cy={top + 5}
                  rx={5}
                  ry={3}
                  fill={ink.bright}
                  opacity={0.85}
                />
              ) : null}
            </>
          ) : species === 'cactus' ? (
            <>
              <Rect x={centre - 4} y={top} width={8} height={stemHeight} rx={4} fill={ink.bright} />
              {level >= 2 ? (
                <Rect x={centre - 11} y={top + 12} width={7} height={4} rx={2} fill={ink.bright} />
              ) : null}
              {level >= 3 ? (
                <Rect x={centre + 4} y={top + 20} width={7} height={4} rx={2} fill={ink.bright} />
              ) : null}
            </>
          ) : species === 'berries' ? (
            <>
              <Circle cx={centre - 5} cy={top + 4} r={4.6} fill={ink.bright} />
              <Circle cx={centre + 5} cy={top + 4} r={4.6} fill={ink.bright} />
              {level >= 2 ? <Circle cx={centre} cy={top + 10} r={4.6} fill={ink.bright} /> : null}
              {level >= 3 ? <Circle cx={centre} cy={top - 2} r={4.2} fill={ink.lip} /> : null}
            </>
          ) : species === 'sunflower' ? (
            <>
              <Circle cx={centre} cy={top} r={level >= 3 ? 8 : 6.5} fill={ink.bright} />
              <Circle cx={centre} cy={top} r={3} fill={ink.lip} />
              {level >= 2 ? (
                <Ellipse
                  cx={centre - 9}
                  cy={top + 4}
                  rx={4.5}
                  ry={2.6}
                  fill={ink.bright}
                  transform={`rotate(-24 ${centre - 9} ${top + 4})`}
                />
              ) : null}
              {level >= 3 ? (
                <Ellipse
                  cx={centre + 9}
                  cy={top + 4}
                  rx={4.5}
                  ry={2.6}
                  fill={ink.bright}
                  transform={`rotate(24 ${centre + 9} ${top + 4})`}
                />
              ) : null}
            </>
          ) : (
            // fern — a frond of leaves, the tallest silhouette at level 3
            <>
              <Path
                d={`M ${centre} ${stemBottom} C ${centre - 8} ${top + 10}, ${centre - 10} ${top + 6}, ${centre - 11} ${top + 2}`}
                fill="none"
                stroke={ink.bright}
                strokeWidth={3.4}
                strokeLinecap="round"
              />
              <Path
                d={`M ${centre} ${stemBottom} C ${centre + 8} ${top + 10}, ${centre + 10} ${top + 6}, ${centre + 11} ${top + 2}`}
                fill="none"
                stroke={ink.bright}
                strokeWidth={3.4}
                strokeLinecap="round"
              />
              {level >= 2 ? (
                <Ellipse cx={centre} cy={top + 4} rx={7} ry={4} fill={ink.bright} />
              ) : null}
            </>
          )}
        </>
      )}

      <SvgText
        x={centre}
        y={GARDEN_SCENE.labelY}
        fill={labelInk}
        fontSize={GARDEN_SCENE.labelFontSize}
        fontWeight="700"
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </>
  );
}

/**
 * The Momentum Garden illustration (Refero: Roots landscape).
 *
 * P20 (`docs/ui-ux/16-playful-momentum.md` §7 "Momentum Garden"): a flat
 * illustrated garden on a **soft sky band**, one plant species per existing
 * contribution area, a single ground line, and beds that only ever grow.
 * Read-only: the `day` model is produced by `momentum.domain.ts`, and the art
 * announces exactly that model's `accessibilityLabel` — the same label the
 * caller already surfaced, so assistive tech hears unchanged text.
 *
 * Motion (§5.8 "Garden grows" row): a new contribution fades the scene in over
 * the standard feedback duration; reduced motion renders the final scene with no
 * animation at all. No ambient loop, no leaf sway (cap: one grow-in per change).
 */
export function MomentumGardenArt({ day, height = 154 }: MomentumGardenArtProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const levels = useMemo(() => {
    const next = {} as Record<MomentumSource, 0 | 1 | 2 | 3>;
    for (const source of SOURCE_ORDER) next[source] = day.contributions[source].level;
    return next;
  }, [day]);
  const growthSignature = useMemo(() => gardenGrowthSignature(levels), [levels]);

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.7);
    Animated.timing(opacity, {
      toValue: 1,
      duration: MOTION_DURATION.feedback * 2,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [growthSignature, opacity, reducedMotion]);

  const labelInk = gardenLabelInk(tokens.surface, tokens.text, tokens.textMuted);
  const seedInk = tokens.textMuted;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={day.accessibilityLabel}
      className="w-full"
    >
      <Animated.View importantForAccessibility="no-hide-descendants" style={{ opacity }}>
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${GARDEN_SCENE.width} ${GARDEN_SCENE.height}`}
        >
          {/* Soft sky band: one flat slab, no gradient (§5.7). */}
          <Rect
            x={0}
            y={GARDEN_SCENE.sky.top}
            width={GARDEN_SCENE.width}
            height={GARDEN_SCENE.sky.height}
            rx={GARDEN_SCENE.sky.radius}
            fill={gardenSkyFill({ health: sectionAccents.health.tint })}
          />
          {/* A quiet sun in the sky band — the one decoration beyond the beds. */}
          <Circle
            cx={GARDEN_SUN.cx}
            cy={GARDEN_SUN.cy}
            r={GARDEN_SUN.r}
            fill={GARDEN_SUN.fill}
            opacity={GARDEN_SUN.opacity}
          />
          {/* The single ground line (§6 charts: one baseline only). */}
          <Line
            x1={10}
            y1={GARDEN_SCENE.groundY}
            x2={GARDEN_SCENE.width - 10}
            y2={GARDEN_SCENE.groundY}
            stroke={tokens.border}
            strokeWidth={2}
          />
          {SOURCE_ORDER.map((source, index) => {
            const inkAndLabel = gardenPlantInk(source);
            return (
              <GardenPlant
                key={source}
                species={GARDEN_SPECIES[source].species}
                geometry={bedGeometry(source, index, levels[source])}
                ink={inkAndLabel}
                label={SOURCE_LABELS[source]}
                outline={tokens.surfaceSunken}
                seed={seedInk}
                // The label ink resolves against the card face, not the plant.
                labelInk={labelInk}
              />
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
}
