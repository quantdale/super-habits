import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
import { TextField } from "@/core/ui/TextField";
import { NumberStepperField } from "@/core/ui/NumberStepperField";
import { Button } from "@/core/ui/Button";
import type { Habit, HabitCategory, HabitIcon } from "./types";
import {
  addHabit,
  decrementHabit,
  deleteHabit,
  getAllHabitCompletionsForRange,
  getCompletionHistory,
  getHabitCountByDate,
  incrementHabit,
  listHabits,
  updateHabit,
} from "@/features/habits/habits.data";
import {
  buildAggregatedHabitHeatmap,
  buildDayCompletions,
  buildHabitGrid,
  calculateCurrentStreak,
  calculateOverallConsistency,
} from "@/features/habits/habits.domain";
import type { HeatmapDay } from "@/features/shared/GitHubHeatmap";
import { HabitCircle } from "@/features/habits/HabitCircle";
import { HabitsOverviewGrid } from "@/features/habits/HabitsOverviewGrid";
import {
  DEFAULT_HABIT_COLOR,
  DEFAULT_HABIT_ICON,
  HABIT_COLORS,
  HABIT_ICONS,
} from "@/features/habits/habitPresets";
import { SECTION_COLORS, SECTION_COLORS_LIGHT } from "@/constants/sectionColors";
import { toDateKey } from "@/lib/time";

const TIME_GROUPS = [
  { key: "anytime" as const, label: "Anytime", icon: "🔄" },
  { key: "morning" as const, label: "Morning", icon: "☀️" },
  { key: "afternoon" as const, label: "Afternoon", icon: "⛅" },
  { key: "evening" as const, label: "Evening", icon: "🌙" },
] as const;

const CATEGORIES: HabitCategory[] = ["anytime", "morning", "afternoon", "evening"];
const CATEGORY_LABELS: Record<HabitCategory, string> = {
  anytime: "Anytime",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};
const COLOR = SECTION_COLORS.habits;

export function HabitsScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const modalMaxHeight = windowHeight * 0.88;
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completionMap, setCompletionMap] = useState<Record<string, number>>({});
  const [streakMap, setStreakMap] = useState<Record<string, number>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("1");
  const [category, setCategory] = useState<HabitCategory>("anytime");
  const [icon, setIcon] = useState<HabitIcon>(DEFAULT_HABIT_ICON);
  const [color, setColor] = useState(DEFAULT_HABIT_COLOR);
  const [habitHeatmapDays, setHabitHeatmapDays] = useState<HeatmapDay[]>([]);
  const [consistencyPct, setConsistencyPct] = useState(0);
  const [overallStreak, setOverallStreak] = useState(0);

  const refresh = useCallback(async () => {
    const list = await listHabits();
    setHabits(list);
    const counts = await Promise.all(list.map((h) => getHabitCountByDate(h.id)));
    setCompletionMap(Object.fromEntries(list.map((h, i) => [h.id, counts[i]])));

    const streaks: Record<string, number> = {};
    for (const habit of list) {
      const completions = await getCompletionHistory(habit.id, 30);
      const dayCompletions = buildDayCompletions(completions, habit.target_per_day, 30);
      streaks[habit.id] = calculateCurrentStreak(dayCompletions);
    }
    setStreakMap(streaks);

    const start364 = new Date();
    start364.setDate(start364.getDate() - 363);
    const startKey = toDateKey(start364);
    const endKey = toDateKey(new Date());

    const allCompletions = await getAllHabitCompletionsForRange(startKey, endKey);
    const gridBuilt = buildHabitGrid(
      list.map((h) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        target_per_day: h.target_per_day,
      })),
      allCompletions,
      364,
    );
    const pct = calculateOverallConsistency(gridBuilt);
    setConsistencyPct(pct);
    setHabitHeatmapDays(buildAggregatedHabitHeatmap(gridBuilt, 364));

    const bestStreak = Math.max(0, ...Object.values(streaks));
    setOverallStreak(bestStreak);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const openAddModal = (presetCategory?: HabitCategory) => {
    setEditingHabit(null);
    setName("");
    setTarget("1");
    setCategory(presetCategory ?? "anytime");
    setIcon(DEFAULT_HABIT_ICON);
    setColor(DEFAULT_HABIT_COLOR);
    setModalVisible(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setName(habit.name);
    setTarget(String(habit.target_per_day));
    setCategory((habit.category ?? "anytime") as HabitCategory);
    setIcon((HABIT_ICONS.includes(habit.icon as HabitIcon) ? habit.icon : DEFAULT_HABIT_ICON) as HabitIcon);
    setColor(HABIT_COLORS.includes(habit.color) ? habit.color : DEFAULT_HABIT_COLOR);
    setModalVisible(true);
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Enter a habit name.");
      return;
    }
    const targetNum = Math.max(1, Number(target) || 1);
    if (editingHabit) {
      await updateHabit(editingHabit.id, {
        name: name.trim(),
        targetPerDay: targetNum,
        category,
        icon,
        color,
      });
    } else {
      await addHabit(name.trim(), targetNum, category, icon, color);
    }
    setEditingHabit(null);
    setName("");
    setTarget("1");
    setCategory("anytime");
    setIcon(DEFAULT_HABIT_ICON);
    setColor(DEFAULT_HABIT_COLOR);
    setModalVisible(false);
    refresh();
  };

  const handleIncrement = useCallback(
    async (habitId: string) => {
      await incrementHabit(habitId);
      refresh();
    },
    [refresh],
  );

  const handleDecrement = useCallback(
    async (habitId: string) => {
      await decrementHabit(habitId);
      refresh();
    },
    [refresh],
  );

  const handleAddHabitToGroup = (timeOfDay: HabitCategory) => {
    openAddModal(timeOfDay);
  };

  return (
    <Screen scroll padded>
      <View className="mb-4 flex-row items-center justify-between">
        <SectionTitle title="Habits" subtitle={habits.length === 0 ? undefined : "Track daily consistency."} />
        <Pressable
          onPress={() => setEditMode((e) => !e)}
          className="rounded-lg p-2"
        >
          <MaterialIcons name={editMode ? "close" : "edit"} size={24} color="#64748b" />
        </Pressable>
      </View>

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Card className="mb-0">
            <View className="items-center py-1">
              <Text style={{ fontSize: 22 }}>⚡</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: SECTION_COLORS.habits,
                  marginTop: 2,
                }}
              >
                {overallStreak} days
              </Text>
              <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>best streak</Text>
            </View>
          </Card>
        </View>
        <View className="flex-1">
          <Card className="mb-0">
            <View className="items-center py-1">
              <Text style={{ fontSize: 22 }}>📊</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: SECTION_COLORS.habits,
                  marginTop: 2,
                }}
              >
                {consistencyPct}%
              </Text>
              <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>consistent</Text>
            </View>
          </Card>
        </View>
      </View>

      <View className="bg-habits-light pb-4">
        {habits.length === 0 ? (
          <Text className="mb-4 px-4 text-center text-sm text-slate-500">
            Pick a time of day and tap Add to create your first habit.
          </Text>
        ) : null}

        {TIME_GROUPS.map((group) => {
          const groupHabits = habits.filter((h) => (h.category ?? "anytime") === group.key);

          return (
            <View key={group.key} className="mb-6">
              <View className="mb-3 flex-row items-center gap-2 px-1">
                <Text style={{ fontSize: 16 }}>{group.icon}</Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {group.label}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  paddingHorizontal: 4,
                  gap: 16,
                }}
              >
                {editMode
                  ? groupHabits.map((habit) => (
                      <View key={habit.id} className="items-center" style={{ width: 88 }}>
                        <View
                          className="items-center justify-center rounded-full bg-slate-200"
                          style={{ width: 80, height: 80 }}
                        >
                          <Text className="text-center text-xs font-medium text-slate-700">
                            {habit.name}
                          </Text>
                          <View className="mt-1 flex-row gap-1">
                            <Pressable
                              onPress={() => openEditModal(habit)}
                              className="rounded bg-habits px-2 py-1"
                            >
                              <Text className="text-xs font-medium text-white">Edit</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                Alert.alert(
                                  "Delete habit",
                                  `Remove "${habit.name}"?`,
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                      text: "Delete",
                                      style: "destructive",
                                      onPress: async () => {
                                        await deleteHabit(habit.id);
                                        refresh();
                                      },
                                    },
                                  ],
                                );
                              }}
                              className="rounded bg-rose-500 px-2 py-1"
                            >
                              <Text className="text-xs font-medium text-white">Delete</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ))
                  : groupHabits.map((habit) => {
                      const todayCount = completionMap[habit.id] ?? 0;
                      const streak = streakMap[habit.id] ?? 0;
                      return (
                        <View key={habit.id} className="items-center">
                          <HabitCircle
                            habit={habit}
                            todayCount={todayCount}
                            streak={streak}
                            size={56}
                            showName={false}
                            showStreak={false}
                            onIncrement={() => handleIncrement(habit.id)}
                            onDecrement={() => handleDecrement(habit.id)}
                          />
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#64748b",
                              marginTop: 4,
                              textAlign: "center",
                              maxWidth: 64,
                            }}
                            numberOfLines={2}
                          >
                            {habit.name}
                          </Text>
                          {streak > 0 ? (
                            <View className="mt-0.5 flex-row items-center gap-0.5">
                              <Text style={{ fontSize: 10 }}>{streak > 2 ? "🔥" : "⚡"}</Text>
                              <Text style={{ fontSize: 10, color: "#94a3b8" }}>{streak}</Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}

                <Pressable
                  onPress={() => handleAddHabitToGroup(group.key)}
                  className="items-center justify-center"
                  style={{ width: 64 }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      borderWidth: 2,
                      borderColor: `${SECTION_COLORS.habits}60`,
                      borderStyle: "dashed",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: SECTION_COLORS_LIGHT.habits,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 24,
                        color: SECTION_COLORS.habits,
                        lineHeight: 28,
                      }}
                    >
                      +
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      color: SECTION_COLORS.habits,
                      marginTop: 4,
                    }}
                  >
                    Add
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          );
        })}
      </View>

      <View className="mt-2 pb-8">
        <HabitsOverviewGrid consistencyPercent={consistencyPct} heatmapDays={habitHeatmapDays} />
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setModalVisible(false);
          setEditingHabit(null);
        }}
      >
        <Pressable
          className="flex-1 justify-center bg-black/50 p-4"
          onPress={() => {
            setModalVisible(false);
            setEditingHabit(null);
          }}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{ maxHeight: modalMaxHeight, width: "100%" }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              style={{ maxHeight: modalMaxHeight }}
            >
              <Card accentColor={COLOR}>
              <Text className="mb-3 text-lg font-semibold text-slate-900">
                {editingHabit ? "Edit habit" : "Add habit"}
              </Text>
              <TextField
                label="Habit name"
                value={name}
                onChangeText={setName}
                placeholder="Read 20 minutes"
              />
              <NumberStepperField
                label="Target per day"
                value={target}
                onChange={setTarget}
                min={1}
                placeholder="1"
              />
              <Text className="mb-1 text-sm font-medium text-slate-700">Category</Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    className={`rounded-lg px-3 py-2 ${
                      category === c ? "bg-habits" : "bg-slate-200"
                    }`}
                  >
                    <Text className={`text-sm font-medium ${category === c ? "text-white" : "text-slate-700"}`}>
                      {CATEGORY_LABELS[c]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="mb-1 text-sm font-medium text-slate-700">Icon</Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {HABIT_ICONS.map((iconName) => (
                  <Pressable
                    key={iconName}
                    onPress={() => setIcon(iconName)}
                    className={`items-center justify-center rounded-lg p-2 ${
                      icon === iconName ? "bg-habits" : "bg-slate-200"
                    }`}
                    style={{ width: 44, height: 44 }}
                  >
                    <MaterialIcons
                      name={iconName}
                      size={24}
                      color={icon === iconName ? "white" : "#64748b"}
                    />
                  </Pressable>
                ))}
              </View>
              <Text className="mb-1 text-sm font-medium text-slate-700">Color</Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {HABIT_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className={`rounded-full ${
                      color === c ? "ring-2 ring-slate-400 ring-offset-2" : ""
                    }`}
                    style={{ width: 36, height: 36, backgroundColor: c }}
                  />
                ))}
              </View>
              <View className="flex-row gap-2">
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setModalVisible(false);
                    setEditingHabit(null);
                  }}
                />
                <Button
                  label={editingHabit ? "Save changes" : "Create habit"}
                  onPress={onSubmit}
                  color={COLOR}
                />
              </View>
              </Card>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
