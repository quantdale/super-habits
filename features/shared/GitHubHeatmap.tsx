import React, { useEffect, useMemo, useState } from "react";
import { InteractionManager, View, Text, type ViewStyle } from "react-native";
import { HorizontalScrollArea } from "@/core/ui/HorizontalScrollArea";
import { useAppTheme } from "@/core/theme";

export type HeatmapDay = {
  dateKey: string;
  value: number;
};

type Props = {
  days: HeatmapDay[];
  color: string;
  label?: string;
  weeks?: number;
};

const CELL = 14;
const GAP = 3;
const DAY_LABEL_COL_WIDTH = 28;
const DAY_LABEL_TEXT_WIDTH = 24;
const DAY_LABEL_FONT_SIZE = 10;
const DEFAULT_WEEKS = 52;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_STRIP_MIN_HEIGHT = 4 + 14 + (7 * CELL + 6 * GAP);

<<<<<<< HEAD
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month label row (incl. marginBottom) + 7×day grid — matches real heatmap strip height. */
const HEATMAP_STRIP_MIN_HEIGHT =
  4 + 14 + (7 * CELL + 6 * GAP);

/** Stable references for HorizontalScrollArea — avoids new object identity each render. */
=======
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
const HEATMAP_SCROLL_CONTENT: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
  minWidth: "100%",
};

const HEATMAP_WEB_INNER: ViewStyle = {
  alignSelf: "stretch",
  width: "100%",
  alignItems: "center",
};

function parseLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function buildCalendarGrid(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  if (days.length === 0) return [];

  const firstDate = parseLocalDate(days[0].dateKey);
  const firstDow = (firstDate.getDay() + 6) % 7;

  const padded: (HeatmapDay | null)[] = [...Array(firstDow).fill(null), ...days];

  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    const week = padded.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function firstDayInWeek(week: (HeatmapDay | null)[]): HeatmapDay | null {
  for (const d of week) {
    if (d) return d;
  }
  return null;
}

function monthLabelsForWeeks(weeksGrid: (HeatmapDay | null)[][]): string[] {
  let prevKey: string | null = null;
  return weeksGrid.map((week) => {
    const first = firstDayInWeek(week);
    if (!first) return "";
    const dt = parseLocalDate(first.dateKey);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    if (key !== prevKey) {
      prevKey = key;
      return dt.toLocaleDateString("en", { month: "short" });
    }
    return "";
  });
}

function GitHubHeatmapInner({ days, color, label, weeks = DEFAULT_WEEKS }: Props) {
  const { colors } = useAppTheme();
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

  const getColorForValue = (value: number): string => {
    if (value === 0) return colors.progressTrack;
    if (value === 1) return color + "55";
    if (value === 2) return color + "99";
    return color;
  };

  const maxDays = weeks * 7;
  const trimmedDays = useMemo(() => (days.length > maxDays ? days.slice(-maxDays) : days), [days, maxDays]);
  const weekColumns = useMemo(() => buildCalendarGrid(trimmedDays), [trimmedDays]);
  const monthLabels = useMemo(() => monthLabelsForWeeks(weekColumns), [weekColumns]);

  const footer = label ? (
    <Text style={{ fontSize: 11, color: colors.textSubtle, marginTop: 6 }}>{label}</Text>
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
            width: "100%",
            minHeight: HEATMAP_STRIP_MIN_HEIGHT,
            borderRadius: 6,
            backgroundColor: colors.surfaceMuted,
          }}
          accessibilityLabel="Loading activity heatmap"
        />
      </HorizontalScrollArea>
    );
  }

<<<<<<< HEAD
  const grid = (
    <View style={{ flexDirection: "column", alignItems: "center", width: "100%" }}>
      <View style={{ flexDirection: "row", gap: GAP, marginBottom: 4 }}>
        <View style={{ width: DAY_LABEL_COL_WIDTH, marginRight: 2 }} />
        {weekColumns.map((_, wi) => (
          <View key={`m-${wi}`} style={{ width: CELL, alignItems: "center" }}>
            <Text style={{ fontSize: 9, color: "#94a3b8" }}>{monthLabels[wi] ?? ""}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: DAY_LABEL_COL_WIDTH, marginRight: 2 }}>
          {DAY_LABELS.map((d, i) => (
            <View
              key={i}
              style={{
                height: CELL,
                marginBottom: GAP,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: DAY_LABEL_FONT_SIZE,
                  color: "#94a3b8",
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
                  backgroundColor: day ? getColorForValue(day.value, color) : "transparent",
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );

=======
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
  return (
    <HorizontalScrollArea
      stripMinHeight={HEATMAP_STRIP_MIN_HEIGHT}
      contentContainerStyle={HEATMAP_SCROLL_CONTENT}
      webInnerStyle={HEATMAP_WEB_INNER}
      footer={footer}
    >
      <View style={{ flexDirection: "column", alignItems: "center", width: "100%" }}>
        <View style={{ flexDirection: "row", gap: GAP, marginBottom: 4 }}>
          <View style={{ width: DAY_LABEL_COL_WIDTH, marginRight: 2 }} />
          {weekColumns.map((_, wi) => (
            <View key={`m-${wi}`} style={{ width: CELL, alignItems: "center" }}>
              <Text style={{ fontSize: 9, color: colors.textSubtle }}>{monthLabels[wi] ?? ""}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: GAP }}>
          <View style={{ width: DAY_LABEL_COL_WIDTH, marginRight: 2 }}>
            {DAY_LABELS.map((d, i) => (
              <View key={i} style={{ height: CELL, marginBottom: GAP, justifyContent: "center" }}>
                <Text
                  style={{ fontSize: DAY_LABEL_FONT_SIZE, color: colors.textSubtle, width: DAY_LABEL_TEXT_WIDTH }}
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
                    backgroundColor: day ? getColorForValue(day.value) : "transparent",
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </HorizontalScrollArea>
  );
}

export const GitHubHeatmap = React.memo(GitHubHeatmapInner);
