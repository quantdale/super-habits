import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinkedActionsEditorSection } from "@/core/linked-actions/LinkedActionsEditorSection";
import {
  buildLinkedActionEditorRowsFromRules,
} from "@/core/linked-actions/linkedActionsEditor.adapter";
import {
  HABIT_LINKED_ACTIONS_EDITOR_CONFIG,
} from "@/core/linked-actions/linkedActionsEditor.config";
import {
  createSaveLinkedActionRuleInputFromEditorRow,
} from "@/core/linked-actions/linkedActionsEditor.model";
import type {
  LinkedActionEditorRowDraft,
  LinkedActionEditorSourceOption,
} from "@/core/linked-actions/linkedActionsEditor.types";
import type {
  LinkedActionFeature,
} from "@/core/linked-actions/linkedActions.types";
import { Screen } from "@/core/ui/Screen";
import { Modal } from "@/core/ui/Modal";
import { Card } from "@/core/ui/Card";
import { EmptyStateCard } from "@/core/ui/EmptyStateCard";
import { PageHeader } from "@/core/ui/PageHeader";
import { ScreenSection } from "@/core/ui/ScreenSection";
import { StatBlock } from "@/core/ui/StatBlock";
import { TextField } from "@/core/ui/TextField";
import { NumberStepperField } from "@/core/ui/NumberStepperField";
import { Button } from "@/core/ui/Button";
import { useConfirmationDialog } from "@/core/ui/useConfirmationDialog";
import { PillChip } from "@/core/ui/PillChip";
import { useInAppNotices } from "@/core/providers/InAppNoticeProvider";
import type { Habit, HabitCategory, HabitIcon } from "./types";
import {
  addHabit,
  decrementHabit,
  deleteHabit,
  getAllHabitCompletionsForRange,
  getCompletionHistory,
  getHabitCountByDate,
  incrementHabit,
  listHabitLinkedActionRules,
  listHabits,
  saveHabitLinkedActionRules,
  updateHabit,
} from "@/features/habits/habits.data";
import {
  buildAggregatedHabitHeatmap,
  buildDayCompletions,
  buildHabitGrid,
  calculateCurrentStreak,
  calculateOverallConsistency,
} from "@/features/habits/habits.domain";
import type { HeatmapDay } from "@/features/shared/activityTypes";
import { HabitCircle } from "@/features/habits/HabitCircle";
import { HabitsOverviewGrid } from "@/features/habits/HabitsOverviewGrid";
import {
  DEFAULT_HABIT_COLOR,
  DEFAULT_HABIT_ICON,
  HABIT_COLORS,
  HABIT_ICONS,
} from "@/features/habits/habitPresets";
import { SECTION_COLORS, SECTION_COLORS_LIGHT, SECTION_TEXT_COLORS } from "@/constants/sectionColors";
import { toDateKey } from "@/lib/time";
import { useFocusForegroundRefresh } from "@/lib/useForegroundRefresh";
import { validateHabit } from "@/lib/validation";
import { ValidationError } from "@/core/ui/ValidationError";

const TIME_GROUPS = [
  { key: "anytime" as const, label: "Anytime", icon: "🔄" },
  { key: "morning" as const, label: "Morning", icon: "☀️" },
  { key: "afternoon" as const, label: "Afternoon", icon: "⛅" },
  { key: "evening" as const, label: "Evening", icon: "🌙" },
] as const;

const COLOR = SECTION_COLORS.habits;
const HABIT_LINKED_ACTION_SOURCE_KEY = "habit-linked-actions-source";

function heatmapDaysEqual(a: HeatmapDay[], b: HeatmapDay[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].dateKey !== b[i].dateKey || a[i].value !== b[i].value) return false;
  }
  return true;
}

export function HabitsScreen() {
  const { showNotice } = useInAppNotices();
  const { confirm, confirmationDialog } = useConfirmationDialog();
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
  const [habitError, setHabitError] = useState<string | null>(null);
  const [linkedActionRows, setLinkedActionRows] = useState<LinkedActionEditorRowDraft[]>([]);
  const [linkedActionsError, setLinkedActionsError] = useState<string | null>(null);
  const [linkedActionsLoading, setLinkedActionsLoading] = useState(false);

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
    const nextHeatmapDays = buildAggregatedHabitHeatmap(gridBuilt, 364);
    setConsistencyPct((prev) => (prev === pct ? prev : pct));
    setHabitHeatmapDays((prev) =>
      heatmapDaysEqual(prev, nextHeatmapDays) ? prev : nextHeatmapDays,
    );

    const bestStreak = Math.max(0, ...Object.values(streaks));
    setOverallStreak(bestStreak);
  }, []);

  useFocusForegroundRefresh(refresh);

  const openAddModal = (presetCategory?: HabitCategory) => {
    setEditingHabit(null);
    setName("");
    setTarget("1");
    setCategory(presetCategory ?? "anytime");
    setIcon(DEFAULT_HABIT_ICON);
    setColor(DEFAULT_HABIT_COLOR);
    setHabitError(null);
    setLinkedActionRows([]);
    setLinkedActionsError(null);
    setLinkedActionsLoading(false);
    setModalVisible(true);
  };

  const openEditModal = async (habit: Habit) => {
    setHabitError(null);
    setLinkedActionsError(null);
    setLinkedActionRows([]);
    setLinkedActionsLoading(true);
    setEditingHabit(habit);
    setName(habit.name);
    setTarget(String(habit.target_per_day));
    setCategory((habit.category ?? "anytime") as HabitCategory);
    setIcon((HABIT_ICONS.includes(habit.icon as HabitIcon) ? habit.icon : DEFAULT_HABIT_ICON) as HabitIcon);
    setColor(HABIT_COLORS.includes(habit.color) ? habit.color : DEFAULT_HABIT_COLOR);
    setModalVisible(true);

    try {
      const rules = await listHabitLinkedActionRules(habit.id);
      setLinkedActionRows(await buildLinkedActionEditorRowsFromRules(rules));
    } catch (error) {
      setLinkedActionsError(
        error instanceof Error ? error.message : "Could not load linked actions for this habit.",
      );
    } finally {
      setLinkedActionsLoading(false);
    }
  };

  const onSubmit = async () => {
    const targetNum = Number(target);
    const err = validateHabit(name, targetNum);
    if (err) {
      setHabitError(err);
      return;
    }
    setHabitError(null);
    setLinkedActionsError(null);

    let linkedActionRules;
    try {
      linkedActionRules = linkedActionRows.map(createSaveLinkedActionRuleInputFromEditorRow);
    } catch (error) {
      setLinkedActionsError(
        error instanceof Error
          ? error.message
          : "Finish or remove incomplete linked actions before saving this habit.",
      );
      return;
    }

    if (editingHabit) {
      await updateHabit(editingHabit.id, {
        name: name.trim(),
        targetPerDay: targetNum,
        category,
        icon,
        color,
      });
      await saveHabitLinkedActionRules(editingHabit.id, linkedActionRules);
    } else {
      const habitId = await addHabit(name.trim(), targetNum, category, icon, color);
      await saveHabitLinkedActionRules(habitId, linkedActionRules);
    }
    setEditingHabit(null);
    setName("");
    setTarget("1");
    setCategory("anytime");
    setIcon(DEFAULT_HABIT_ICON);
    setColor(DEFAULT_HABIT_COLOR);
    setHabitError(null);
    setLinkedActionRows([]);
    setLinkedActionsError(null);
    setLinkedActionsLoading(false);
    setModalVisible(false);
    refresh();
  };

  const handleIncrement = useCallback(
    async (habitId: string) => {
      const result = await incrementHabit(habitId);
      for (const notice of result.linkedActions.notices) {
        showNotice(notice);
      }
      refresh();
    },
    [refresh, showNotice],
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

  const handleDeleteHabit = useCallback(
    async (habit: Habit) => {
      const confirmed = await confirm({
        title: "Remove habit",
        message: `Remove "${habit.name}"?`,
        confirmLabel: "Delete habit",
        confirmVariant: "danger",
      });
      if (!confirmed) return;

      await deleteHabit(habit.id);
      await refresh();
    },
    [confirm, refresh],
  );

  const resetModal = useCallback(() => {
    setModalVisible(false);
    setEditingHabit(null);
    setHabitError(null);
    setLinkedActionRows([]);
    setLinkedActionsError(null);
    setLinkedActionsLoading(false);
  }, []);

  const linkedActionSource: LinkedActionEditorSourceOption = {
    key: HABIT_LINKED_ACTION_SOURCE_KEY,
    feature: "habits",
    entityType: "habit",
    entityId: editingHabit?.id ?? "draft-habit",
    label: name.trim() || "This habit",
    description: "Rules below run when this habit completes for the day.",
  };

  return (
    <Screen scroll padded>
      <ScreenSection>
        <PageHeader
          title="Habits"
          subtitle="Track daily consistency."
          actions={
            <Pressable
              onPress={() => setEditMode((e) => !e)}
              className={`rounded-xl p-2.5 ${editMode ? "bg-habits-light" : ""}`}
              accessibilityRole="button"
              accessibilityLabel={editMode ? "Exit habit edit mode" : "Enter habit edit mode"}
              accessibilityState={{ selected: editMode }}
            >
              <MaterialIcons
                name={editMode ? "close" : "edit"}
                size={24}
                color={editMode ? SECTION_TEXT_COLORS.habits : "#94a3b8"}
              />
            </Pressable>
          }
        />
      </ScreenSection>

      <ScreenSection>
        <Card accentColor={SECTION_COLORS.habits} className="mb-0" innerClassName="p-0">
          <View className="p-4">
            <View className="flex-row items-start gap-3">
              <View
                className="h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${SECTION_COLORS.habits}18` }}
              >
                <MaterialIcons
                  name="track-changes"
                  size={22}
                  color={SECTION_TEXT_COLORS.habits}
                />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-base font-semibold text-slate-900">Today&apos;s rhythm</Text>
                <Text className="mt-0.5 text-sm text-slate-500">
                  {habits.length} habits across your daily routine
                </Text>
              </View>
            </View>

            <View className="mt-4 flex-row flex-wrap gap-3">
              <StatBlock
                accentColor={SECTION_COLORS.habits}
                className="min-w-[148px] flex-1"
                icon={<Text style={{ fontSize: 20 }}>⚡</Text>}
                value={overallStreak}
                label="Best streak"
                detail="days in a row"
              />
              <StatBlock
                accentColor={SECTION_COLORS.habits}
                className="min-w-[148px] flex-1"
                icon={<Text style={{ fontSize: 20 }}>📊</Text>}
                value={`${consistencyPct}%`}
                label="Consistency"
                detail="over the last year"
              />
            </View>
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection className="gap-4 pb-2" accessibilityLabel="Habit groups">
        {habits.length === 0 ? (
          <EmptyStateCard
            accentColor={SECTION_COLORS.habits}
            title="No habits yet"
            description="Pick a time of day and tap Add to create your first habit."
            icon={
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-habits-light">
                <MaterialIcons name="track-changes" size={22} color={SECTION_TEXT_COLORS.habits} />
              </View>
            }
          />
        ) : null}

        {TIME_GROUPS.map((group) => {
          const groupHabits = habits.filter((h) => (h.category ?? "anytime") === group.key);

          return (
            <Card
              key={group.key}
              accentColor={SECTION_COLORS.habits}
              className="mb-0"
              innerClassName="p-0"
            >
              <View className="p-4">
                <View className="mb-4 flex-row items-center justify-between gap-3">
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-habits-light">
                      <Text style={{ fontSize: 18 }}>{group.icon}</Text>
                    </View>
                    <View>
                      <Text className="text-base font-semibold text-slate-900">{group.label}</Text>
                      <Text className="mt-0.5 text-sm text-slate-500">
                        {groupHabits.length} {groupHabits.length === 1 ? "habit" : "habits"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-5">
                  {editMode
                    ? groupHabits.map((habit) => (
                        <View
                          key={habit.id}
                          className="items-center"
                          style={{ width: 104, alignItems: "center" }}
                        >
                          <Card
                            accentColor={habit.color ?? DEFAULT_HABIT_COLOR}
                            className="mb-0 w-full"
                            innerClassName="items-center px-3 py-4"
                          >
                            <View
                              className="mb-3 h-14 w-14 items-center justify-center rounded-full"
                              style={{ backgroundColor: `${habit.color ?? DEFAULT_HABIT_COLOR}18` }}
                            >
                              <MaterialIcons
                                name={habit.icon ?? DEFAULT_HABIT_ICON}
                                size={24}
                                color={habit.color ?? DEFAULT_HABIT_COLOR}
                              />
                            </View>
                            <Text
                              className="text-center text-xs font-medium text-slate-700"
                              numberOfLines={2}
                            >
                              {habit.name}
                            </Text>
                            <View className="mt-3 flex-row gap-1">
                              <Pressable
                                onPress={() => {
                                  void openEditModal(habit);
                                }}
                                className="rounded-full bg-habits px-3 py-1.5"
                              >
                                <Text className="text-xs font-medium text-white">Edit</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  void handleDeleteHabit(habit);
                                }}
                                className="rounded-full bg-rose-500 px-3 py-1.5"
                              >
                                <Text className="text-xs font-medium text-white">Delete</Text>
                              </Pressable>
                            </View>
                          </Card>
                        </View>
                      ))
                    : groupHabits.map((habit) => {
                        const todayCount = completionMap[habit.id] ?? 0;
                        const streak = streakMap[habit.id] ?? 0;
                        return (
                          <View
                            key={habit.id}
                            className="items-center justify-center"
                            style={{ width: 84, alignItems: "center" }}
                          >
                            <HabitCircle
                              habit={habit}
                              todayCount={todayCount}
                              streak={streak}
                              size={60}
                              showName={false}
                              showStreak={false}
                              onIncrement={() => handleIncrement(habit.id)}
                              onDecrement={() => handleDecrement(habit.id)}
                            />
                            <Text
                              className="mt-2 w-[84px] text-center text-[11px] font-medium leading-4 text-slate-500"
                              numberOfLines={2}
                            >
                              {habit.name}
                            </Text>
                            {streak > 0 ? (
                              <View className="mt-1 flex-row items-center gap-1 rounded-full bg-amber-50 px-2 py-1">
                                <Text style={{ fontSize: 10 }}>{streak > 2 ? "🔥" : "⚡"}</Text>
                                <Text className="text-[10px] font-semibold text-amber-600">{streak}</Text>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}

                  <View className="items-center" style={{ width: editMode ? 104 : 84 }}>
                    <Pressable
                      onPress={() => handleAddHabitToGroup(group.key)}
                      className="h-[68px] w-[68px] shrink-0 grow-0 items-center justify-center rounded-2xl border-2 border-dashed"
                      style={{
                        borderColor: SECTION_COLORS.habits + "60",
                        backgroundColor: SECTION_COLORS_LIGHT.habits,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 24,
                          color: SECTION_TEXT_COLORS.habits,
                          lineHeight: 28,
                        }}
                      >
                        +
                      </Text>
                    </Pressable>
                    <Text
                      className="mt-2 text-[11px] font-semibold"
                      style={{ color: SECTION_TEXT_COLORS.habits }}
                    >
                      Add
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
      </ScreenSection>

      <ScreenSection className="mb-0 pt-1">
        <HabitsOverviewGrid consistencyPercent={consistencyPct} heatmapDays={habitHeatmapDays} />
      </ScreenSection>

      <Modal
        title={editingHabit ? "Edit Habit" : "New Habit"}
        visible={modalVisible}
        onClose={resetModal}
        scroll
      >
        <Card accentColor={SECTION_COLORS.habits}>
          <TextField
            label="Habit name"
            value={name}
            onChangeText={(t) => {
              setHabitError(null);
              setName(t);
            }}
            placeholder="Read 20 minutes"
          />
          <NumberStepperField
            label="Target per day"
            value={target}
            onChange={(t) => {
              setHabitError(null);
              setTarget(t);
            }}
            min={1}
            max={99}
            placeholder="1"
          />
          <Text className="mb-1 text-sm font-medium text-slate-700">Category</Text>
          <View className="mb-3 flex-row flex-wrap">
            {TIME_GROUPS.map((g) => (
              <PillChip
                key={g.key}
                label={g.label}
                icon={g.icon}
                active={category === g.key}
                color={COLOR}
                onPress={() => {
                  setHabitError(null);
                  setCategory(g.key);
                }}
              />
            ))}
          </View>
          <Text className="mb-1 text-sm font-medium text-slate-700">Icon</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {HABIT_ICONS.map((iconName) => (
              <Pressable
                key={iconName}
                onPress={() => {
                  setHabitError(null);
                  setIcon(iconName);
                }}
                className={`items-center justify-center rounded-lg p-2 ${
                  icon === iconName ? "bg-habits" : "bg-slate-200"
                }`}
                style={{ width: 44, height: 44 }}
              >
                <MaterialIcons
                  name={iconName}
                  size={24}
                  color={icon === iconName ? "white" : "#94a3b8"}
                />
              </Pressable>
            ))}
          </View>
          <Text className="mb-1 text-sm font-medium text-slate-700">Color</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {HABIT_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  setHabitError(null);
                  setColor(c);
                }}
                className={`rounded-full ${
                  color === c ? "ring-2 ring-slate-400 ring-offset-2" : ""
                }`}
                style={{ width: 36, height: 36, backgroundColor: c }}
              />
            ))}
          </View>
          <ValidationError message={habitError} />
        </Card>

        <Card
          variant="header"
          accentColor={SECTION_COLORS.habits}
          headerTitle="Linked Actions"
          headerSubtitle="Optional explicit rules that run when this habit completes for the day."
        >
          {linkedActionsLoading ? (
            <Text className="text-sm" style={{ color: SECTION_TEXT_COLORS.habits }}>
              Loading linked actions...
            </Text>
          ) : (
            <LinkedActionsEditorSection
              sourceOptions={[linkedActionSource]}
              selectedSourceKey={HABIT_LINKED_ACTION_SOURCE_KEY}
              rows={linkedActionRows}
              onRowsChange={(rows) => {
                setLinkedActionsError(null);
                setLinkedActionRows(rows);
              }}
              allowSourceSelection={false}
              allowedTargetFeatures={HABIT_LINKED_ACTIONS_EDITOR_CONFIG.allowedTargetFeatures}
              allowedTriggerTypes={HABIT_LINKED_ACTIONS_EDITOR_CONFIG.allowedTriggerTypes}
              allowCreateNewTarget={HABIT_LINKED_ACTIONS_EDITOR_CONFIG.allowCreateNewTarget}
              introTitle="Habit completion rules"
              introDescription="Choose a target item in Todos, Habits, or Workout and the effect that should run when this habit reaches its daily target."
            />
          )}
          <ValidationError message={linkedActionsError} />

          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Button label="Cancel" variant="ghost" onPress={resetModal} />
            </View>
            <View className="flex-1">
              <Button
                label={editingHabit ? "Save changes" : "Create habit"}
                onPress={onSubmit}
                color={COLOR}
              />
            </View>
          </View>
        </Card>
      </Modal>
      {confirmationDialog}
    </Screen>
  );
}
