import { useEffect, useMemo, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '@/core/providers/themeContext';
import { MOTION_DURATION, useReducedMotion } from '@/core/theme/motion';
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

function leafPath(cx: number, cy: number, side: 'left' | 'right'): string {
  const direction = side === 'left' ? -1 : 1;
  return `M ${cx} ${cy} C ${cx + direction * 2} ${cy - 10}, ${cx + direction * 14} ${cy - 12}, ${cx + direction * 15} ${cy - 4} C ${cx + direction * 12} ${cy + 2}, ${cx + direction * 4} ${cy + 3}, ${cx} ${cy}`;
}

function sourceColor(
  source: MomentumSource,
  sectionAccents: ReturnType<typeof useAppTheme>['sectionAccents'],
  tokens: ReturnType<typeof useAppTheme>['tokens'],
): string {
  switch (source) {
    case 'tasks':
      return sectionAccents.todos.fill;
    case 'habits':
      return sectionAccents.habits.fill;
    case 'focus':
      return sectionAccents.focus.fill;
    case 'workout':
      return sectionAccents.workout.fill;
    case 'nutrition':
      return sectionAccents.calories.fill;
    case 'planning':
      return tokens.accent;
    case 'review':
      return sectionAccents.focus.fill;
  }
}

function GardenPlant({
  source,
  level,
  x,
  color,
  tokens,
}: {
  source: MomentumSource;
  level: 0 | 1 | 2 | 3;
  x: number;
  color: string;
  tokens: ReturnType<typeof useAppTheme>['tokens'];
}) {
  const center = x + 20;
  const stemTop = level >= 3 ? 46 : level === 2 ? 57 : level === 1 ? 70 : 87;
  return (
    <>
      <Rect
        x={x}
        y={111}
        width={40}
        height={13}
        rx={6.5}
        fill={tokens.surfaceElevated}
        stroke={tokens.border}
        strokeWidth={1}
      />
      {level > 0 ? (
        <>
          <Line
            x1={center}
            y1={112}
            x2={center}
            y2={stemTop}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Path d={leafPath(center, stemTop + 18, 'left')} fill={color} opacity={0.78} />
          {level >= 2 ? (
            <Path d={leafPath(center, stemTop + 7, 'right')} fill={color} opacity={0.9} />
          ) : null}
          {level >= 3 ? (
            <>
              <Circle cx={center} cy={stemTop - 2} r={8} fill={color} opacity={0.94} />
              <Ellipse
                cx={center - 8}
                cy={stemTop + 2}
                rx={6}
                ry={3.5}
                fill={color}
                opacity={0.8}
              />
              <Ellipse
                cx={center + 8}
                cy={stemTop + 2}
                rx={6}
                ry={3.5}
                fill={color}
                opacity={0.8}
              />
            </>
          ) : null}
        </>
      ) : (
        <Circle cx={center} cy={106} r={2.5} fill={tokens.textMuted} opacity={0.55} />
      )}
      <SvgText
        x={center}
        y={143}
        fill={tokens.textMuted}
        fontSize={8}
        fontWeight="500"
        textAnchor="middle"
      >
        {SOURCE_LABELS[source]}
      </SvgText>
    </>
  );
}

export function MomentumGardenArt({ day, height = 154 }: MomentumGardenArtProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const growthSignature = useMemo(
    () => SOURCE_ORDER.map((source) => `${source}:${day.contributions[source].level}`).join('|'),
    [day],
  );

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.82);
    Animated.timing(opacity, {
      toValue: 1,
      duration: MOTION_DURATION.feedback,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [growthSignature, opacity, reducedMotion]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={day.accessibilityLabel}
      className="w-full"
    >
      <Animated.View importantForAccessibility="no-hide-descendants" style={{ opacity }}>
        <Svg width="100%" height={height} viewBox="0 0 360 150">
          <Line x1={10} y1={126} x2={350} y2={126} stroke={tokens.border} strokeWidth={1} />
          {SOURCE_ORDER.map((source, index) => (
            <GardenPlant
              key={source}
              source={source}
              level={day.contributions[source].level}
              x={8 + index * 49}
              color={sourceColor(source, sectionAccents, tokens)}
              tokens={tokens}
            />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}
