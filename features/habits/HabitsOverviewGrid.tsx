import React from "react";
import { View, Text, ScrollView } from "react-native";
import type { HabitGridRow, GridDateHeader } from "./habits.domain";

type Props = {
  grid: HabitGridRow[];
  headers: GridDateHeader[];
  consistencyPercent: number;
};

const CELL_SIZE = 24;
const CELL_GAP = 3;
const NAME_WIDTH = 96;
/** Header row height — matches left spacer so date labels align with habit names */
const HEADER_ROW_HEIGHT = 32;

/**
 * Combined habits × days grid: sticky habit names (left) + one horizontal
 * ScrollView for date headers and all day cells so columns stay aligned.
 * (Ref-syncing multiple row ScrollViews is unreliable; single scroll avoids that.)
 */
export function HabitsOverviewGrid({ grid, headers, consistencyPercent }: Props) {
  if (grid.length === 0) {
    return (
      <View className="items-center py-12">
        <Text className="text-slate-400 text-sm text-center">Add habits to see your overview</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2 mb-4 px-1">
        <Text className="text-2xl font-semibold text-slate-800">{consistencyPercent}%</Text>
        <Text className="text-sm text-slate-400">consistency — last 30 days</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View className="flex-row">
          <View style={{ width: NAME_WIDTH }}>
            <View style={{ height: HEADER_ROW_HEIGHT }} />
            {grid.map((row) => (
              <View
                key={row.habit.id}
                className="mb-1 pr-2 justify-center"
                style={{ height: CELL_SIZE + CELL_GAP }}
              >
                <Text className="text-xs text-slate-600" numberOfLines={1}>
                  {row.habit.name}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            style={{ flex: 1 }}
          >
            <View>
              <View className="flex-row mb-1" style={{ gap: CELL_GAP, minHeight: HEADER_ROW_HEIGHT }}>
                {headers.map((h) => (
                  <View key={h.dateKey} style={{ width: CELL_SIZE }} className="items-center justify-end pb-0.5">
                    {h.monthLabel ? (
                      <Text style={{ fontSize: 8 }} className="text-slate-300" numberOfLines={1}>
                        {h.monthLabel}
                      </Text>
                    ) : null}
                    <Text
                      style={{ fontSize: 9 }}
                      className={h.isToday ? "text-brand-500 font-semibold" : "text-slate-300"}
                    >
                      {h.dayLabel}
                    </Text>
                  </View>
                ))}
              </View>

              {grid.map((row) => (
                <View key={row.habit.id} className="flex-row mb-1 items-center" style={{ gap: CELL_GAP }}>
                  {row.cells.map((cell) => (
                    <View
                      key={cell.dateKey}
                      style={{
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        borderRadius: 4,
                        backgroundColor: cell.completed
                          ? row.habit.color
                          : cell.partial
                            ? `${row.habit.color}55`
                            : "#e2e8f0",
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <View className="flex-row items-center gap-3 mt-4 px-1">
        <View className="flex-row items-center gap-1">
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: "#e2e8f0",
            }}
          />
          <Text className="text-xs text-slate-400">None</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: "#4f79ff55",
            }}
          />
          <Text className="text-xs text-slate-400">Partial</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: "#4f79ff",
            }}
          />
          <Text className="text-xs text-slate-400">Done</Text>
        </View>
      </View>
    </View>
  );
}
