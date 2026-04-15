import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinkedActionsEditorSection } from "@/core/linked-actions/LinkedActionsEditorSection";
import {
  createLinkedActionEditorRowFromRule,
  createSaveLinkedActionRuleInputFromEditorRow,
} from "@/core/linked-actions/linkedActionsEditor.model";
import type {
  LinkedActionEditorRowDraft,
  LinkedActionEditorSourceOption,
} from "@/core/linked-actions/linkedActionsEditor.types";
import {
  createLinkedActionTargetExistingSelection,
  type LinkedActionTargetPickerCandidate,
} from "@/core/linked-actions/linkedActionsTargetPicker.types";
import {
  getLinkedActionTargetPickerProvider,
} from "@/core/linked-actions/linkedActionsTargetProviders";
import type {
  LinkedActionFeature,
  LinkedActionRuleDefinition,
} from "@/core/linked-actions/linkedActions.types";
import { Screen } from "@/core/ui/Screen";
import { Modal } from "@/core/ui/Modal";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Card } from "@/core/ui/Card";
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
const HABIT_LINKED_ACTION_ALLOWED_TARGETS: LinkedActionFeature[] = [
  "todos",
  "habits",
  "workout",
];
const HABIT_LINKED_ACTION_ALLOWED_TRIGGERS = ["habit.completed_for_day"] as const;

function heatmapDaysEqual(a: HeatmapDay[], b: HeatmapDay[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].dateKey !== b[i].dateKey || a[i].value !== b[i].value) return false;
  }
  return true;
}

async function buildLinkedActionEditorRows(
  rules: LinkedActionRuleDefinition[],
): Promise<LinkedActionEditorRowDraft[]> {
  const candidatesByFeature = new Map<
    LinkedActionFeature,
    Promise<LinkedActionTargetPickerCandidate[]>
  >();

  return Promise.all(
    rules.map(async (rule) => {
      let targetSelection = null;

      if (!rule.isUnsupported && rule.target.entityId) {
        const provider = getLinkedActionTargetPickerProvider(rule.target.feature);
        if (provider.existing.supported) {
          let candidatesPromise = candidatesByFeature.get(rule.target.feature);
          if (!candidatesPromise) {
            candidatesPromise = provider.existing.loadCandidates();
            candidatesByFeature.set(rule.target.feature, candidatesPromise);
          }
          const candidates = await candidatesPromise;
          const candidate = candidates.find((item) => item.id === rule.target.entityId) ?? null;
          targetSelection = candidate
            ? createLinkedActionTargetExistingSelection(provider, candidate)
            : null;
        }
      }

      return createLinkedActionEditorRowFromRule({
        rule,
        targetSelection,
      });
    }),
  );
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
      setLinkedActionRows(await buildLinkedActionEditorRows(rules));
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
      <View className="flex-row justify-between items-start">
        <SectionTitle title="Habits" subtitle="Track daily consistency." />
        <Pressable
          onPress={() => setEditMode((e) => !e)}
          className="rounded-lg p-2"
        >
          <MaterialIcons name={editMode ? "close" : "edit"} size={24} color="#94a3b8" />
        </Pressable>
      </View>

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Card variant="stat" accentColor={SECTION_COLORS.habits} className="mb-0">
            <View className="items-center py-1">
              <Text style={{ fontSize: 22 }}>⚡</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: SECTION_TEXT_COLORS.habits,
                  marginTop: 2,
                }}
              >
                {overallStreak} days
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400">best streak</Text>
            </View>
          </Card>
        </View>
        <View className="flex-1">
          <Card variant="stat" accentColor={SECTION_COLORS.habits} className="mb-0">
            <View className="items-center py-1">
              <Text style={{ fontSize: 22 }}>📊</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: SECTION_TEXT_COLORS.habits,
                  marginTop: 2,
                }}
              >
                {consistencyPct}%
              </Text>
              <Text className="mt-0.5 text-xs text-slate-400">consistent</Text>
            </View>
          </Card>
        </View>
      </View>

      <View className="bg-habits-light pb-4" accessibilityLabel="Habit groups">
        {habits.length === 0 ? (
          <Text className="mb-4 px-4 text-center text-sm text-slate-500">
            Pick a time of day and tap Add to create your first habit.
          </Text>
        ) : null}

        {TIME_GROUPS.map((group) => {
          const groupHabits = habits.filter((h) => (h.category ?? "anytime") === group.key);

          return (
            <Card
              key={group.key}
              variant="header"
              accentColor={SECTION_COLORS.habits}
              className="mb-3"
              headerTitle={group.label.toUpperCase()}
              headerRight={<Text style={{ fontSize: 18 }}>{group.icon}</Text>}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 16,
                }}
              >
                {editMode
                  ? groupHabits.map((habit) => (
                      <View key={habit.id} className="items-center" style={{ width: 88, alignItems: "center" }}>
                        <View
                          className="items-center justify-center rounded-full bg-slate-200"
                          style={{ width: 80, height: 80 }}
                        >
                          <Text className="text-center text-xs font-medium text-slate-700">
                            {habit.name}
                          </Text>
                          <View className="mt-1 flex-row gap-1">
                            <Pressable
                              onPress={() => {
                                void openEditModal(habit);
                              }}
                              className="rounded bg-habits px-2 py-1"
                            >
                              <Text className="text-xs font-medium text-white">Edit</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                void handleDeleteHabit(habit);
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
                        <View
                          key={habit.id}
                          className="items-center justify-center"
                          style={{ width: 72, alignItems: "center" }}
                        >
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
                            className="mt-1 w-[72px] text-center text-[11px] text-slate-400"
                            numberOfLines={2}
                          >
                            {habit.name}
                          </Text>
                          {streak > 0 ? (
                            <View className="mt-0.5 flex-row items-center gap-0.5">
                              <Text style={{ fontSize: 10 }}>{streak > 2 ? "🔥" : "⚡"}</Text>
                              <Text className="text-[10px] text-slate-400">{streak}</Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}

                <View className="items-center" style={{ width: editMode ? 88 : 72 }}>
                  <Pressable
                    onPress={() => handleAddHabitToGroup(group.key)}
                    className="w-14 h-14 shrink-0 grow-0 items-center justify-center rounded-full border-2 border-dashed"
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
                    style={{
                      fontSize: 11,
                      color: SECTION_TEXT_COLORS.habits,
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    Add
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <View className="mt-2 pb-8">
        <HabitsOverviewGrid consistencyPercent={consistencyPct} heatmapDays={habitHeatmapDays} />
      </View>

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
              allowedTargetFeatures={HABIT_LINKED_ACTION_ALLOWED_TARGETS}
              allowedTriggerTypes={[...HABIT_LINKED_ACTION_ALLOWED_TRIGGERS]}
              allowCreateNewTarget={false}
              introTitle="Habit completion rules"
              introDescription="Choose a target item in Todos, Habits, or Workout and the effect that should run when this habit reaches its daily target."
            />
          )}
          <ValidationError message={linkedActionsError} />

          <View className="mt-3 flex-row gap-2">
            <Button label="Cancel" variant="ghost" onPress={resetModal} />
            <Button
              label={editingHabit ? "Save changes" : "Create habit"}
              onPress={onSubmit}
              color={COLOR}
            />
          </View>
        </Card>
      </Modal>
      {confirmationDialog}
    </Screen>
  );
}
