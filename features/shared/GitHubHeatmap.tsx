import React, { useEffect, useMemo, useState } from 'react';
import { InteractionManager, View, Text, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { HorizontalScrollArea } from '@/core/ui/HorizontalScrollArea';
import type { HeatmapDay } from './activityTypes';
import { buildHeatmapWeekColumns, monthLabelsForHeatmapWeeks } from './githubHeatmap.domain';

type Props = {
  days: HeatmapDay[];
  color: string;
  label?: string;
  /** Number of week columns; days are trimmed to at most `weeks * 7` (default 364 days). */
  weeks?: number;
};

const CELL = 14;
const GAP = 3;
const DAY_LABEL_COL_WIDTH = 28;
const DAY_LABEL_TEXT_WIDTH = 24;
const DAY_LABEL_FONT_SIZE = 10;
const DEFAULT_WEEKS = 52;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Month label row (incl. marginBottom) + 7×day grid — matches real heatmap strip height. */
const HEATMAP_STRIP_MIN_HEIGHT = 4 + 14 + (7 * CELL + 6 * GAP);

/** Stable references for HorizontalScrollArea — avoids new object identity each render. */
const HEATMAP_SCROLL_CONTENT: ViewStyle = {
  justifyContent: 'center',
  alignItems: 'center',
  minWidth: '100%',
};

const HEATMAP_WEB_INNER: ViewStyle = {
  alignSelf: 'stretch',
  width: '100%',
  alignItems: 'center',
};

function getColorForValue(value: number, color: string, emptyColor: string): string {
  if (value === 0) return emptyColor;
  if (value === 1) return color + '55';
  if (value === 2) return color + '99';
  return color;
}

function GitHubHeatmapInner({ days, color, label, weeks = DEFAULT_WEEKS }: Props) {
  const { tokens } = useAppTheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) setIsReady(true);
    }, 100);
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        clearTimeout(timeoutId);
        setIsReady(true);
      }
    });
    return () => {
      cancelled = true;
      interactionHandle.cancel();
      clearTimeout(timeoutId);
    };
  }, []);

  const weekColumns = useMemo(() => buildHeatmapWeekColumns(days, weeks), [days, weeks]);
  const monthLabels = useMemo(() => monthLabelsForHeatmapWeeks(weekColumns), [weekColumns]);

  const footer = label ? (
    <Text
      style={{
        fontSize: 11,
        color: tokens.textMuted,
        marginTop: 6,
      }}
    >
      {label}
    </Text>
  ) : null;

  if (!isReady) {
    return (
      <HorizontalScrollArea
        stripMinHeight={HEATMAP_STRIP_MIN_HEIGHT}
        contentContainerStyle={HEATMAP_SCROLL_CONTENT}
        webInnerStyle={HEATMAP_WEB_INNER}
        footer={footer}
      >
        <View
          style={{
            width: '100%',
            minHeight: HEATMAP_STRIP_MIN_HEIGHT,
            borderRadius: 6,
            backgroundColor: tokens.surfaceElevated,
          }}
          accessibilityLabel="Loading activity heatmap"
        />
      </HorizontalScrollArea>
    );
  }

  const grid = (
    <View style={{ flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <View style={{ flexDirection: 'row', gap: GAP, marginBottom: 4 }}>
        <View style={{ width: DAY_LABEL_COL_WIDTH, marginRight: 2 }} />
        {weekColumns.map((_, wi) => (
          <View key={`m-${wi}`} style={{ width: CELL, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: tokens.textMuted }}>{monthLabels[wi] ?? ''}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: GAP }}>
        <View style={{ width: DAY_LABEL_COL_WIDTH, marginRight: 2 }}>
          {DAY_LABELS.map((d, i) => (
            <View
              key={i}
              style={{
                height: CELL,
                marginBottom: GAP,
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: DAY_LABEL_FONT_SIZE,
                  color: tokens.textMuted,
                  width: DAY_LABEL_TEXT_WIDTH,
                }}
                numberOfLines={1}
              >
                {d}
              </Text>
            </View>
          ))}
        </View>

        {weekColumns.map((week, wi) => (
          <View key={wi} style={{ gap: GAP }}>
            {week.map((day, di) => (
              <View
                key={di}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 3,
                  backgroundColor: day
                    ? getColorForValue(day.value, color, tokens.border)
                    : 'transparent',
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <HorizontalScrollArea
      stripMinHeight={HEATMAP_STRIP_MIN_HEIGHT}
      contentContainerStyle={HEATMAP_SCROLL_CONTENT}
      webInnerStyle={HEATMAP_WEB_INNER}
      footer={footer}
    >
      {grid}
    </HorizontalScrollArea>
  );
}

export const GitHubHeatmap = React.memo(GitHubHeatmapInner);
