import { useCallback, useMemo, useState } from "react";
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
  buildDayCompletions,
  buildGridDateHeaders,
  buildHabitActivityDays,
  buildHabitGrid,
  calculateCurrentStreak,
  calculateOverallConsistency,
  getStreakLabel,
  type GridDateHeader,
  type HabitGridRow,
} from "@/features/habits/habits.domain";
import { ActivityPreviewStrip, type ActivityDay } from "@/features/shared/ActivityPreviewStrip";
import { HabitCircle } from "@/features/habits/HabitCircle";
import { HabitsOverviewGrid } from "@/features/habits/HabitsOverviewGrid";
import {
  DEFAULT_HABIT_COLOR,
  DEFAULT_HABIT_ICON,
  HABIT_COLORS,
  HABIT_ICONS,
} from "@/features/habits/habitPresets";
import { SECTION_COLORS } from "@/constants/sectionColors";

const CATEGORIES: HabitCategory[] = ["anytime", "morning", "afternoon", "evening"];
const CATEGORY_LABELS: Record<HabitCategory, string> = {
  anytime: "Anytime",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];
const COLOR = SECTION_COLORS.habits;

const CATEGORY_ICONS: Record<HabitCategory, MaterialIconName> = {
  anytime: "schedule",
  morning: "wb-sunny",
  afternoon: "wb-cloudy",
  evening: "nights-stay",
};

function groupHabitsByCategory(habits: Habit[]): Record<HabitCategory, Habit[]> {
  const groups: Record<HabitCategory, Habit[]> = {
    anytime: [],
    morning: [],
    afternoon: [],
    evening: [],
  };
  for (const habit of habits) {
    const cat = (habit.category ?? "anytime") as HabitCategory;
    if (groups[cat]) groups[cat].push(habit);
    else groups.anytime.push(habit);
  }
  return groups;
}

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
  const [overviewGrid, setOverviewGrid] = useState<HabitGridRow[]>([]);
  const [overviewHeaders, setOverviewHeaders] = useState<GridDateHeader[]>([]);
  const [consistencyPct, setConsistencyPct] = useState(0);
  const [habitActivityDays, setHabitActivityDays] = useState<ActivityDay[]>([]);
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

    const start = new Date();
    start.setDate(start.getDate() - 29);
    const startKey = (() => {
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, "0");
      const d = String(start.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    })();
    const endKey = (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    })();

    const allCompletions = await getAllHabitCompletionsForRange(startKey, endKey);
    const headers = buildGridDateHeaders(30);
    const gridBuilt = buildHabitGrid(
      list.map((h) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        target_per_day: h.target_per_day,
      })),
      allCompletions,
      30,
    );
    const pct = calculateOverallConsistency(gridBuilt);
    setOverviewHeaders(headers);
    setOverviewGrid(gridBuilt);
    setConsistencyPct(pct);

    const activityDays = buildHabitActivityDays(gridBuilt, 30);
    const bestStreak = Math.max(0, ...Object.values(streaks));
    setHabitActivityDays(activityDays);
    setOverallStreak(bestStreak);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const groups = useMemo(() => groupHabitsByCategory(habits), [habits]);

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

      <View className="bg-habits-light pb-4">
        {habits.length === 0 ? (
          <View className="items-center px-4 py-12">
            <View className="w-full max-w-sm items-center rounded-xl border border-slate-100 bg-white p-4">
              <Text className="text-center text-sm text-slate-500">Add your first habit</Text>
              <Text className="mt-1 text-center text-xs text-slate-400">Track daily consistency.</Text>
              <Pressable
                onPress={() => openAddModal()}
                className="mt-4 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white"
                style={{ width: 80, height: 80 }}
              >
                <MaterialIcons name="add" size={32} color="#94a3b8" />
              </Pressable>
            </View>
          </View>
        ) : (
          CATEGORIES.map((cat) => (
            <View key={cat} className="mb-6">
              <View className="mb-2 flex-row items-center justify-center gap-2">
                <MaterialIcons name={CATEGORY_ICONS[cat]} size={20} color="#94a3b8" />
                <Text className="text-sm font-medium text-slate-600">{CATEGORY_LABELS[cat]}</Text>
              </View>
              <View className="flex-row flex-wrap gap-4">
                {groups[cat].map((habit) => {
                  const todayCount = completionMap[habit.id] ?? 0;
                  if (editMode) {
                    return (
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
                    );
                  }
                  return (
                    <View key={habit.id} className="items-center">
                      <HabitCircle
                        habit={habit}
                        todayCount={todayCount}
                        streak={streakMap[habit.id] ?? 0}
                        onIncrement={() => handleIncrement(habit.id)}
                        onDecrement={() => handleDecrement(habit.id)}
                      />
                      {(streakMap[habit.id] ?? 0) > 0 ? (
                        <View className="mt-1 flex-row items-center justify-center px-1">
                          <View className="flex-row items-center gap-1">
                            <Text className="text-xs text-amber-500">
                              {(streakMap[habit.id] ?? 0) > 2 ? "🔥" : "⚡"}
                            </Text>
                            <Text className="text-xs text-slate-500">
                              {getStreakLabel(streakMap[habit.id] ?? 0)}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                <Pressable
                  onPress={() => openAddModal(cat)}
                  className="items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white"
                  style={{ width: 80, height: 80 }}
                >
                  <MaterialIcons name="add" size={32} color="#94a3b8" />
                </Pressable>
              </View>
            </View>
          ))
        )}

        <ActivityPreviewStrip
          days={habitActivityDays}
          accentColor={COLOR}
          statLabel={
            overallStreak > 0
              ? `${overallStreak} day${overallStreak !== 1 ? "s" : ""} best streak`
              : `${consistencyPct}% consistency`
          }
          emptyLabel="Complete habits to start your streak"
        />
      </View>

      <View className="mt-2 pb-8">
        <Text className="text-xs text-slate-400 mb-2">30-day overview</Text>
        <HabitsOverviewGrid
          grid={overviewGrid}
          headers={overviewHeaders}
          consistencyPercent={consistencyPct}
        />
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
