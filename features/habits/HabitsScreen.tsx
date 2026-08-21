import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinkedActionsEditorSection } from '@/core/linked-actions/LinkedActionsEditorSection';
import { buildLinkedActionEditorRowsFromRules } from '@/core/linked-actions/linkedActionsEditor.adapter';
import { HABIT_LINKED_ACTIONS_EDITOR_CONFIG } from '@/core/linked-actions/linkedActionsEditor.config';
import { createSaveLinkedActionRuleInputFromEditorRow } from '@/core/linked-actions/linkedActionsEditor.model';
import type {
  LinkedActionEditorRowDraft,
  LinkedActionEditorSourceOption,
} from '@/core/linked-actions/linkedActionsEditor.types';

import { Screen } from '@/core/ui/Screen';
import { Modal } from '@/core/ui/Modal';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { IconButton } from '@/core/ui/IconButton';
import { PageHeader } from '@/core/ui/PageHeader';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { StatBlock } from '@/core/ui/StatBlock';
import { TextField } from '@/core/ui/TextField';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { Button } from '@/core/ui/Button';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/themeContext';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { useInAppNotices } from '@/core/providers/inAppNoticeContext';
import type { Habit, HabitCategory, HabitIcon } from './types';
import {
  addHabit,
  decrementHabit,
  deleteHabit,
  getAllHabitCompletions,
  getAllHabitCompletionsForRange,
  incrementHabit,
  listHabitLinkedActionRules,
  listHabits,
  saveHabitLinkedActionRules,
  updateHabit,
} from '@/features/habits/habits.data';
import {
  ALL_HABIT_WEEKDAYS,
  WEEKDAY_HABIT_WEEKDAYS,
  WEEKEND_HABIT_WEEKDAYS,
  buildAggregatedHabitHeatmap,
  buildDayCompletions,
  buildHabitGrid,
  calculateCurrentStreak,
  calculateOverallConsistency,
  filterHabits,
  formatHabitSchedule,
  getHabitRuleForDate,
  getHabitSchedulePreset,
  isHabitScheduledOn,
  normalizeHabitWeekdays,
  sortHabits,
  toggleHabitLifecycleId,
  type HabitSchedulePreset,
  type HabitSortMode,
  type HabitStatusFilter,
  type HabitWeekday,
} from '@/features/habits/habits.domain';
import {
  loadHabitLifecycleSets,
  saveHabitArchivedIds,
  saveHabitPausedIds,
} from '@/features/habits/habitLifecycle.store';
import type { HeatmapDay } from '@/features/shared/activityTypes';
import { HabitCircle } from '@/features/habits/HabitCircle';
import { HabitsOverviewGrid } from '@/features/habits/HabitsOverviewGrid';
import { HabitProgressInsightsModal } from '@/features/habits/HabitProgressInsightsModal';
import { HabitDetailModal } from '@/features/habits/HabitDetailModal';
import {
  DEFAULT_HABIT_COLOR,
  DEFAULT_HABIT_ICON,
  HABIT_COLORS,
  HABIT_ICONS,
} from '@/features/habits/habitPresets';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { toDateKey } from '@/lib/time';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import { validateHabit } from '@/lib/validation';
import { ValidationError } from '@/core/ui/ValidationError';
import {
  formatHabitReminderTime,
  parseHabitReminderTime,
  getHabitReminderIdentifier,
  HABIT_REMINDER_DATA_KIND,
  HABIT_REMINDER_DATA_VERSION,
  HABIT_REMINDER_MARK_COMPLETE_ACTION,
  HABIT_REMINDER_SNOOZE_ACTION,
} from '@/features/habits/habitReminders.domain';
import { injectNotificationResponseForTesting } from '@/core/notifications/notificationResponseBridge';
import { setHabitDataRefreshHandler } from '@/core/notifications/habitDataSignals';
import {
  getNotificationPermissionState,
  requestHabitReminderPermission,
  scheduleTestHabitReminderNotification,
  type NotificationPermissionState,
} from '@/lib/notifications';

const TIME_GROUPS = [
  { key: 'anytime' as const, label: 'Anytime', icon: '🔄' },
  { key: 'morning' as const, label: 'Morning', icon: '☀️' },
  { key: 'afternoon' as const, label: 'Afternoon', icon: '⛅' },
  { key: 'evening' as const, label: 'Evening', icon: '🌙' },
] as const;

const COLOR = SECTION_COLORS.habits;
const HABIT_LINKED_ACTION_SOURCE_KEY = 'habit-linked-actions-source';
const HABIT_REMINDER_E2E_TEST = process.env.EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST === 'true';
const SCHEDULE_OPTIONS: { value: HabitSchedulePreset; label: string; weekdays: HabitWeekday[] }[] =
  [
    { value: 'every_day', label: 'Every day', weekdays: [...ALL_HABIT_WEEKDAYS] },
    { value: 'weekdays', label: 'Weekdays', weekdays: [...WEEKDAY_HABIT_WEEKDAYS] },
    { value: 'weekends', label: 'Weekends', weekdays: [...WEEKEND_HABIT_WEEKDAYS] },
  ];
const WEEKDAY_OPTIONS: { value: HabitWeekday; label: string; fullLabel: string }[] = [
  { value: 1, label: 'M', fullLabel: 'Monday' },
  { value: 2, label: 'T', fullLabel: 'Tuesday' },
  { value: 3, label: 'W', fullLabel: 'Wednesday' },
  { value: 4, label: 'T', fullLabel: 'Thursday' },
  { value: 5, label: 'F', fullLabel: 'Friday' },
  { value: 6, label: 'S', fullLabel: 'Saturday' },
  { value: 7, label: 'S', fullLabel: 'Sunday' },
];
const DEFAULT_HABIT_REMINDER_TIME = '18:00';

function heatmapDaysEqual(a: HeatmapDay[], b: HeatmapDay[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].dateKey !== b[i].dateKey || a[i].value !== b[i].value) return false;
  }
  return true;
}

export function HabitsScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
  const { consumePendingHabitFocus } = useAppNavigation();
  const dayGeneration = useDayRolloverGeneration();
  const { showNotice } = useInAppNotices();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitsLoaded, setHabitsLoaded] = useState(false);
  const [completionMap, setCompletionMap] = useState<Record<string, number>>({});
  const [streakMap, setStreakMap] = useState<Record<string, number>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [insightsHabit, setInsightsHabit] = useState<Habit | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('1');
  const [category, setCategory] = useState<HabitCategory>('anytime');
  const [icon, setIcon] = useState<HabitIcon>(DEFAULT_HABIT_ICON);
  const [color, setColor] = useState(DEFAULT_HABIT_COLOR);
  const [schedulePreset, setSchedulePreset] = useState<HabitSchedulePreset>('every_day');
  const [weekdays, setWeekdays] = useState<HabitWeekday[]>([...ALL_HABIT_WEEKDAYS]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(DEFAULT_HABIT_REMINDER_TIME);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [reminderPermission, setReminderPermission] =
    useState<NotificationPermissionState>('not_determined');
  const [reminderPermissionBusy, setReminderPermissionBusy] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [habitHeatmapDays, setHabitHeatmapDays] = useState<HeatmapDay[]>([]);
  const [consistencyPct, setConsistencyPct] = useState(0);
  const [overallStreak, setOverallStreak] = useState(0);
  const [habitError, setHabitError] = useState<string | null>(null);
  const [linkedActionRows, setLinkedActionRows] = useState<LinkedActionEditorRowDraft[]>([]);
  const [linkedActionsError, setLinkedActionsError] = useState<string | null>(null);
  const [linkedActionsLoading, setLinkedActionsLoading] = useState(false);
  const [pausedHabitIds, setPausedHabitIds] = useState<string[]>([]);
  const [archivedHabitIds, setArchivedHabitIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<HabitStatusFilter>('active');
  const [sortMode, setSortMode] = useState<HabitSortMode>('default');
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);

  const displayedHabits = useMemo(
    () =>
      sortHabits(
        filterHabits(habits, { status: statusFilter }, pausedHabitIds, archivedHabitIds),
        sortMode,
        streakMap,
      ),
    [habits, statusFilter, pausedHabitIds, archivedHabitIds, sortMode, streakMap],
  );

  const handleTogglePause = useCallback(
    async (habitId: string) => {
      const next = toggleHabitLifecycleId(pausedHabitIds, habitId);
      setPausedHabitIds(next);
      await saveHabitPausedIds(next);
    },
    [pausedHabitIds],
  );

  const handleToggleArchive = useCallback(
    async (habitId: string) => {
      const nextArchived = toggleHabitLifecycleId(archivedHabitIds, habitId);
      setArchivedHabitIds(nextArchived);
      await saveHabitArchivedIds(nextArchived);
      // Archiving also clears an active pause so the states stay exclusive.
      if (nextArchived.includes(habitId) && pausedHabitIds.includes(habitId)) {
        const nextPaused = pausedHabitIds.filter((id) => id !== habitId);
        setPausedHabitIds(nextPaused);
        await saveHabitPausedIds(nextPaused);
      }
    },
    [archivedHabitIds, pausedHabitIds],
  );

  const refresh = useCallback(async () => {
    const [list, lifecycle] = await Promise.all([
      listHabits(),
      loadHabitLifecycleSets().catch(() => ({ pausedIds: [], archivedIds: [] })),
    ]);
    setHabits(list);
    setHabitsLoaded(true);
    setPausedHabitIds(lifecycle.pausedIds);
    setArchivedHabitIds(lifecycle.archivedIds);
    const todayKey = toDateKey();
    const allHabitCompletions = await getAllHabitCompletions();
    const completionsByHabit = new Map<string, typeof allHabitCompletions>();
    const todayCounts = new Map<string, number>();
    for (const completion of allHabitCompletions) {
      const habitRows = completionsByHabit.get(completion.habit_id) ?? [];
      habitRows.push(completion);
      completionsByHabit.set(completion.habit_id, habitRows);
      if (completion.date_key === todayKey) {
        todayCounts.set(completion.habit_id, completion.count);
      }
    }
    setCompletionMap(
      Object.fromEntries(list.map((habit) => [habit.id, todayCounts.get(habit.id) ?? 0])),
    );

    const streaks: Record<string, number> = {};
    for (const habit of list) {
      const completions = completionsByHabit.get(habit.id) ?? [];
      const dayCompletions = buildDayCompletions(
        completions,
        habit.target_per_day,
        undefined,
        habit.rule_history,
        undefined,
        todayKey,
      );
      streaks[habit.id] = calculateCurrentStreak(dayCompletions, todayKey);
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
        rule_history: h.rule_history,
        created_at: h.created_at,
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

  useActiveForegroundRefresh(isActive, refresh, dayGeneration);

  useEffect(() => {
    setHabitDataRefreshHandler(() => void refresh());
    return () => setHabitDataRefreshHandler(null);
  }, [isActive, refresh]);

  const refreshReminderPermission = useCallback(async () => {
    const state = await getNotificationPermissionState();
    setReminderPermission(state);
    return state;
  }, []);

  const openAddModal = (presetCategory?: HabitCategory) => {
    setEditingHabit(null);
    setName('');
    setTarget('1');
    setCategory(presetCategory ?? 'anytime');
    setIcon(DEFAULT_HABIT_ICON);
    setColor(DEFAULT_HABIT_COLOR);
    setSchedulePreset('every_day');
    setWeekdays([...ALL_HABIT_WEEKDAYS]);
    setReminderEnabled(false);
    setReminderTime(DEFAULT_HABIT_REMINDER_TIME);
    setShowReminderTimePicker(false);
    setReminderPermission('not_determined');
    setReminderError(null);
    setHabitError(null);
    setLinkedActionRows([]);
    setLinkedActionsError(null);
    setLinkedActionsLoading(false);
    setModalVisible(true);
    void refreshReminderPermission();
  };

  const openEditModal = useCallback(
    async (habit: Habit) => {
      setHabitError(null);
      setLinkedActionsError(null);
      setLinkedActionRows([]);
      setLinkedActionsLoading(true);
      setEditingHabit(habit);
      setName(habit.name);
      setTarget(String(habit.target_per_day));
      setCategory(habit.category ?? 'anytime');
      setIcon(HABIT_ICONS.includes(habit.icon) ? habit.icon : DEFAULT_HABIT_ICON);
      setColor(HABIT_COLORS.includes(habit.color) ? habit.color : DEFAULT_HABIT_COLOR);
      const existingReminder = parseHabitReminderTime(habit.reminder_time);
      setReminderEnabled(existingReminder !== null);
      setReminderTime(
        existingReminder ? formatHabitReminderTime(existingReminder) : DEFAULT_HABIT_REMINDER_TIME,
      );
      setShowReminderTimePicker(false);
      setReminderPermission('not_determined');
      setReminderError(null);
      const currentRule = getHabitRuleForDate(
        habit.rule_history,
        toDateKey(),
        habit.target_per_day,
      );
      const currentWeekdays = currentRule?.weekdays ?? [...ALL_HABIT_WEEKDAYS];
      setWeekdays(currentWeekdays);
      setSchedulePreset(getHabitSchedulePreset(currentWeekdays));
      setModalVisible(true);
      void refreshReminderPermission();

      try {
        const rules = await listHabitLinkedActionRules(habit.id);
        setLinkedActionRows(await buildLinkedActionEditorRowsFromRules(rules));
      } catch (error) {
        setLinkedActionsError(
          error instanceof Error ? error.message : 'Could not load linked actions for this habit.',
        );
      } finally {
        setLinkedActionsLoading(false);
      }
    },
    [refreshReminderPermission],
  );

  useEffect(() => {
    if (!isActive || !habitsLoaded) return;
    const pendingHabitId = consumePendingHabitFocus();
    if (!pendingHabitId) return;
    const habit = habits.find((candidate) => candidate.id === pendingHabitId);
    if (!habit) return;

    // Pending focus is an external navigation response. Schedule the modal
    // state transition after the effect callback so React does not cascade a
    // synchronous render while it is reconciling the mounted screen.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void openEditModal(habit);
    });
    return () => {
      cancelled = true;
    };
  }, [consumePendingHabitFocus, habits, habitsLoaded, isActive, openEditModal]);

  const handleReminderToggle = async () => {
    if (reminderEnabled) {
      setReminderEnabled(false);
      setReminderError(null);
      return;
    }
    if (Platform.OS === 'web') {
      setReminderPermission('unsupported');
      setReminderError('Native habit reminders are available on Android and iOS only.');
      return;
    }

    setReminderPermissionBusy(true);
    setReminderError(null);
    try {
      let state = await getNotificationPermissionState();
      if (state === 'not_determined') {
        state = await requestHabitReminderPermission();
      }
      setReminderPermission(state);
      if (state !== 'granted') {
        setReminderEnabled(false);
        setReminderError(
          state === 'denied'
            ? 'Notifications are blocked. Enable them in system settings before saving a reminder.'
            : 'Notifications are unavailable on this device.',
        );
        return;
      }
      setReminderEnabled(true);
    } finally {
      setReminderPermissionBusy(false);
    }
  };

  const ensureReminderPermissionForSave = async (): Promise<boolean> => {
    if (!reminderEnabled) return true;
    if (Platform.OS === 'web') {
      setReminderPermission('unsupported');
      setReminderError('Native habit reminders are available on Android and iOS only.');
      return false;
    }

    let state = reminderPermission;
    if (state !== 'granted') {
      state = await getNotificationPermissionState();
      if (state === 'not_determined') state = await requestHabitReminderPermission();
      setReminderPermission(state);
    }
    if (state !== 'granted') {
      setReminderError(
        state === 'denied'
          ? 'Notifications are blocked. Disable this reminder or enable notifications in system settings.'
          : 'Notifications are unavailable on this device.',
      );
      return false;
    }
    return true;
  };

  const scheduleTestReminder = async () => {
    if (!editingHabit) return;
    const identifier = await scheduleTestHabitReminderNotification({
      habitId: editingHabit.id,
      title: editingHabit.name,
      dateKey: toDateKey(),
      occurrenceId: getHabitReminderIdentifier(editingHabit.id, toDateKey()),
    });
    setReminderError(
      identifier
        ? 'Test notification scheduled for about 20 seconds.'
        : 'The test notification is available only in the native E2E build.',
    );
  };

  const injectTestReminderResponse = (actionIdentifier: string) => {
    if (!editingHabit) return;
    const dateKey = toDateKey();
    injectNotificationResponseForTesting({
      actionIdentifier,
      notification: {
        date: Date.now(),
        request: {
          identifier: getHabitReminderIdentifier(editingHabit.id, dateKey),
          content: {
            title: editingHabit.name,
            body: 'Time to complete your habit.',
            data: {
              kind: HABIT_REMINDER_DATA_KIND,
              version: HABIT_REMINDER_DATA_VERSION,
              habitId: editingHabit.id,
              dateKey,
              occurrenceId: getHabitReminderIdentifier(editingHabit.id, dateKey),
            },
            sound: 'default',
          },
          trigger: null,
        },
      },
    } as never);
    setReminderError(`Injected ${actionIdentifier} response.`);
  };

  const onSubmit = async () => {
    const targetNum = Number(target);
    const err = validateHabit(name, targetNum);
    if (err) {
      setHabitError(err);
      return;
    }
    if (weekdays.length === 0) {
      setHabitError('Choose at least one day for this habit.');
      return;
    }
    const parsedReminder = reminderEnabled ? parseHabitReminderTime(reminderTime) : null;
    if (reminderEnabled && !parsedReminder) {
      setReminderError('Enter a reminder time in HH:MM format.');
      return;
    }
    if (!(await ensureReminderPermissionForSave())) return;
    setHabitError(null);
    setReminderError(null);
    setLinkedActionsError(null);

    let linkedActionRules;
    try {
      linkedActionRules = linkedActionRows.map(createSaveLinkedActionRuleInputFromEditorRow);
    } catch (error) {
      setLinkedActionsError(
        error instanceof Error
          ? error.message
          : 'Finish or remove incomplete linked actions before saving this habit.',
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
        weekdays,
        reminderTime: parsedReminder ? formatHabitReminderTime(parsedReminder) : null,
      });
      await saveHabitLinkedActionRules(editingHabit.id, linkedActionRules);
    } else {
      const habitId = await addHabit(
        name.trim(),
        targetNum,
        category,
        icon,
        color,
        weekdays,
        parsedReminder ? formatHabitReminderTime(parsedReminder) : null,
      );
      await saveHabitLinkedActionRules(habitId, linkedActionRules);
    }
    setEditingHabit(null);
    setName('');
    setTarget('1');
    setCategory('anytime');
    setIcon(DEFAULT_HABIT_ICON);
    setColor(DEFAULT_HABIT_COLOR);
    setSchedulePreset('every_day');
    setWeekdays([...ALL_HABIT_WEEKDAYS]);
    setReminderEnabled(false);
    setReminderTime(DEFAULT_HABIT_REMINDER_TIME);
    setShowReminderTimePicker(false);
    setReminderPermission('not_determined');
    setReminderError(null);
    setHabitError(null);
    setLinkedActionRows([]);
    setLinkedActionsError(null);
    setLinkedActionsLoading(false);
    setModalVisible(false);
    void refresh();
  };

  const handleIncrement = useCallback(
    async (habitId: string) => {
      const result = await incrementHabit(habitId);
      for (const notice of result.linkedActions.notices) {
        showNotice(notice);
      }
      void refresh();
    },
    [refresh, showNotice],
  );

  const handleDecrement = useCallback(
    async (habitId: string) => {
      await decrementHabit(habitId);
      void refresh();
    },
    [refresh],
  );

  const handleAddHabitToGroup = (timeOfDay: HabitCategory) => {
    openAddModal(timeOfDay);
  };

  const handleDeleteHabit = useCallback(
    async (habit: Habit) => {
      const confirmed = await confirm({
        title: 'Remove habit',
        message: `Remove "${habit.name}"?`,
        confirmLabel: 'Delete habit',
        confirmVariant: 'danger',
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
    setSchedulePreset('every_day');
    setWeekdays([...ALL_HABIT_WEEKDAYS]);
    setReminderEnabled(false);
    setReminderTime(DEFAULT_HABIT_REMINDER_TIME);
    setShowReminderTimePicker(false);
    setReminderPermission('not_determined');
    setReminderError(null);
  }, []);

  const linkedActionSource: LinkedActionEditorSourceOption = {
    key: HABIT_LINKED_ACTION_SOURCE_KEY,
    feature: 'habits',
    entityType: 'habit',
    entityId: editingHabit?.id ?? 'draft-habit',
    label: name.trim() || 'This habit',
    description: 'Rules below run when this habit completes for the day.',
  };

  const todayKey = toDateKey();
  const scheduledTodayCount = habits.filter((habit) =>
    isHabitScheduledOn(habit.rule_history, todayKey, habit.target_per_day),
  ).length;
  const completedTodayCount = habits.filter(
    (habit) =>
      isHabitScheduledOn(habit.rule_history, todayKey, habit.target_per_day) &&
      (completionMap[habit.id] ?? 0) >= habit.target_per_day,
  ).length;
  const todayProgress =
    scheduledTodayCount === 0
      ? null
      : Math.round((completedTodayCount / scheduledTodayCount) * 100);

  return (
    <Screen scroll padded>
      <ScreenSection>
        <PageHeader
          title="Habits"
          subtitle="Track daily consistency."
          actions={
            <IconButton
              icon={editMode ? 'close' : 'edit'}
              onPress={() => setEditMode((e) => !e)}
              accessibilityLabel={editMode ? 'Exit habit edit mode' : 'Enter habit edit mode'}
              selected={editMode}
              accentColor={sectionAccents.habits.text}
            />
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
                <MaterialIcons name="track-changes" size={22} color={sectionAccents.habits.text} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                  Today&apos;s rhythm
                </Text>
                <Text className="mt-0.5 text-sm" style={{ color: tokens.textMuted }}>
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
              <StatBlock
                accentColor={SECTION_COLORS.habits}
                className="min-w-[148px] flex-1"
                icon={<Text style={{ fontSize: 20 }}>🗓️</Text>}
                value={todayProgress === null ? 'Rest' : `${todayProgress}%`}
                label="Today"
                detail={
                  todayProgress === null
                    ? 'no habits scheduled'
                    : `${completedTodayCount} of ${scheduledTodayCount} scheduled`
                }
              />
            </View>
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection className="gap-2" accessibilityLabel="Habit list filters">
        <View className="flex-row flex-wrap gap-2">
          {(
            [
              { key: 'active', label: 'Active' },
              { key: 'paused', label: 'Paused' },
              { key: 'archived', label: 'Archived' },
              { key: 'all', label: 'All' },
            ] as { key: HabitStatusFilter; label: string }[]
          ).map((option) => {
            const active = statusFilter === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={`Filter habits: ${option.label}`}
                accessibilityState={{ selected: active }}
                className="rounded-full border px-3 py-1.5"
                style={
                  active
                    ? { backgroundColor: COLOR, borderColor: COLOR }
                    : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
                }
                onPress={() => setStatusFilter(option.key)}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: active ? tokens.textOnAccent : tokens.textMuted }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="flex-row flex-wrap gap-2">
          {(
            [
              { key: 'default', label: 'Default order' },
              { key: 'name', label: 'Name' },
              { key: 'streak', label: 'Streak' },
            ] as { key: HabitSortMode; label: string }[]
          ).map((option) => {
            const active = sortMode === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={`Sort habits by ${option.label}`}
                accessibilityState={{ selected: active }}
                className="rounded-full border px-3 py-1.5"
                style={
                  active
                    ? { backgroundColor: tokens.textMuted, borderColor: tokens.textMuted }
                    : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
                }
                onPress={() => setSortMode(option.key)}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: active ? (tokens.surface ?? '#fff') : tokens.textMuted }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScreenSection>

      <ScreenSection className="gap-4 pb-2" accessibilityLabel="Habit groups">
        {habits.length === 0 ? (
          <EmptyStateCard
            accentColor={SECTION_COLORS.habits}
            title="No habits yet"
            description="Pick a time of day and tap Add to create your first habit."
            icon={
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-habits-light">
                <MaterialIcons name="track-changes" size={22} color={sectionAccents.habits.text} />
              </View>
            }
          />
        ) : null}

        {TIME_GROUPS.map((group) => {
          const groupHabits = displayedHabits.filter(
            (h) => (h.category ?? 'anytime') === group.key,
          );

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
                      <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                        {group.label}
                      </Text>
                      <Text className="mt-0.5 text-sm" style={{ color: tokens.textMuted }}>
                        {groupHabits.length} {groupHabits.length === 1 ? 'habit' : 'habits'}
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
                          style={{ width: 104, alignItems: 'center' }}
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
                              className="text-center text-xs font-medium"
                              style={{ color: tokens.text }}
                              numberOfLines={2}
                            >
                              {habit.name}
                            </Text>
                            <View className="mt-3 flex-row gap-1">
                              <Pressable
                                onPress={() => {
                                  void openEditModal(habit);
                                }}
                                className="rounded-full px-3 py-1.5"
                                style={{ backgroundColor: COLOR }}
                              >
                                <Text
                                  className="text-xs font-medium"
                                  style={{ color: tokens.textOnAccent }}
                                >
                                  Edit
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  void handleDeleteHabit(habit);
                                }}
                                className="rounded-full px-3 py-1.5"
                                style={{ backgroundColor: tokens.dangerSolid }}
                              >
                                <Text
                                  className="text-xs font-medium"
                                  style={{ color: tokens.textOnAccent }}
                                >
                                  Delete
                                </Text>
                              </Pressable>
                            </View>
                          </Card>
                        </View>
                      ))
                    : groupHabits.map((habit) => {
                        const todayCount = completionMap[habit.id] ?? 0;
                        const streak = streakMap[habit.id] ?? 0;
                        const scheduledToday = isHabitScheduledOn(
                          habit.rule_history,
                          todayKey,
                          habit.target_per_day,
                        );
                        const currentRule = getHabitRuleForDate(
                          habit.rule_history,
                          todayKey,
                          habit.target_per_day,
                        );
                        return (
                          <View
                            key={habit.id}
                            className="items-center justify-center"
                            style={{ width: 84, alignItems: 'center' }}
                          >
                            <HabitCircle
                              habit={habit}
                              todayCount={todayCount}
                              streak={streak}
                              size={60}
                              showName={false}
                              showStreak={false}
                              scheduledToday={scheduledToday}
                              onIncrement={() => handleIncrement(habit.id)}
                              onDecrement={() => handleDecrement(habit.id)}
                            />
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Open ${habit.name} history`}
                              className="mt-2 w-[84px] items-center"
                              onPress={() => setDetailHabit(habit)}
                            >
                              <Text
                                className="text-center text-[11px] font-medium leading-4"
                                style={{ color: tokens.textMuted }}
                                numberOfLines={2}
                              >
                                {habit.name}
                              </Text>
                            </Pressable>
                            <Text
                              className="mt-0.5 w-[84px] text-center text-[10px] leading-4"
                              style={{ color: tokens.textMuted }}
                              numberOfLines={1}
                            >
                              {formatHabitSchedule(currentRule?.weekdays ?? ALL_HABIT_WEEKDAYS)}
                            </Text>
                            {parseHabitReminderTime(habit.reminder_time) ? (
                              <Text
                                className="mt-0.5 w-[84px] text-center text-[10px] leading-4"
                                style={{ color: sectionAccents.habits.text }}
                                accessibilityLabel={`Reminder ${formatHabitReminderTime(parseHabitReminderTime(habit.reminder_time)!)}`}
                              >
                                🔔{' '}
                                {formatHabitReminderTime(
                                  parseHabitReminderTime(habit.reminder_time)!,
                                )}
                              </Text>
                            ) : null}
                            {streak > 0 ? (
                              <View className="mt-1 flex-row items-center gap-1 rounded-full bg-amber-50 px-2 py-1">
                                <Text style={{ fontSize: 10 }}>{streak > 2 ? '🔥' : '⚡'}</Text>
                                <Text className="text-[10px] font-semibold text-amber-600">
                                  {streak}
                                </Text>
                              </View>
                            ) : null}
                            <Pressable
                              onPress={() => setInsightsHabit(habit)}
                              accessibilityRole="button"
                              accessibilityLabel={`View progress for ${habit.name}`}
                              className="mt-1 min-h-[36px] w-[84px] items-center justify-center rounded-full border px-2 py-1"
                              style={{
                                borderColor: SECTION_COLORS.habits,
                                backgroundColor: tokens.surfaceElevated,
                              }}
                            >
                              <Text
                                className="text-[10px] font-semibold"
                                style={{ color: sectionAccents.habits.text }}
                              >
                                Progress
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}

                  <View className="items-center" style={{ width: editMode ? 104 : 84 }}>
                    <Pressable
                      onPress={() => handleAddHabitToGroup(group.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${group.label.toLowerCase()} habit`}
                      className="h-[68px] w-[68px] shrink-0 grow-0 items-center justify-center rounded-2xl border-2 border-dashed"
                      style={{
                        borderColor: SECTION_COLORS.habits + '60',
                        backgroundColor: `${SECTION_COLORS.habits}18`,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 24,
                          color: sectionAccents.habits.text,
                          lineHeight: 28,
                        }}
                      >
                        +
                      </Text>
                    </Pressable>
                    <Text
                      className="mt-2 text-[11px] font-semibold"
                      style={{ color: sectionAccents.habits.text }}
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
        title={editingHabit ? 'Edit Habit' : 'New Habit'}
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
          <Text className="mb-1 text-sm font-medium" style={{ color: tokens.text }}>
            Schedule
          </Text>
          <View className="mb-2 flex-row flex-wrap">
            {SCHEDULE_OPTIONS.map((option) => (
              <PillChip
                key={option.value}
                label={option.label}
                active={schedulePreset === option.value}
                color={COLOR}
                onPress={() => {
                  setHabitError(null);
                  setSchedulePreset(option.value);
                  setWeekdays([...option.weekdays]);
                }}
              />
            ))}
            <PillChip
              label="Custom"
              active={schedulePreset === 'custom'}
              color={COLOR}
              onPress={() => {
                setHabitError(null);
                setSchedulePreset('custom');
              }}
            />
          </View>
          {schedulePreset === 'custom' ? (
            <View className="mb-3 flex-row justify-between gap-2">
              {WEEKDAY_OPTIONS.map((weekday) => {
                const selected = weekdays.includes(weekday.value);
                return (
                  <Pressable
                    key={`${weekday.value}-${weekday.fullLabel}`}
                    onPress={() => {
                      setHabitError(null);
                      setSchedulePreset('custom');
                      setWeekdays((current) =>
                        normalizeHabitWeekdays(
                          selected
                            ? current.filter((value) => value !== weekday.value)
                            : [...current, weekday.value],
                        ),
                      );
                    }}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${weekday.fullLabel} scheduled`}
                    accessibilityState={{ checked: selected }}
                    className="h-11 min-w-[36px] flex-1 items-center justify-center rounded-xl border"
                    style={{
                      borderColor: selected ? COLOR : tokens.border,
                      backgroundColor: selected ? COLOR : tokens.surfaceElevated,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: selected ? tokens.textOnAccent : tokens.textMuted }}
                    >
                      {weekday.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View className="mb-3 mt-1 rounded-2xl border p-3" style={{ borderColor: tokens.border }}>
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                  Reminder
                </Text>
                <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                  {Platform.OS === 'web'
                    ? 'Native reminders are available on Android and iOS only.'
                    : reminderPermission === 'denied'
                      ? 'Notifications are blocked in system settings.'
                      : reminderEnabled
                        ? 'One reminder on each scheduled day.'
                        : 'Off'}
                </Text>
              </View>
              <Pressable
                onPress={() => void handleReminderToggle()}
                disabled={reminderPermissionBusy || Platform.OS === 'web'}
                accessibilityRole="switch"
                accessibilityLabel="Enable habit reminder"
                accessibilityState={{ checked: reminderEnabled, disabled: Platform.OS === 'web' }}
                className="h-8 w-14 justify-center rounded-full px-1"
                style={{
                  backgroundColor: reminderEnabled ? COLOR : tokens.border,
                  opacity: reminderPermissionBusy || Platform.OS === 'web' ? 0.55 : 1,
                }}
              >
                <View
                  className="h-6 w-6 rounded-full"
                  style={{
                    alignSelf: reminderEnabled ? 'flex-end' : 'flex-start',
                    backgroundColor: tokens.surface,
                  }}
                />
              </Pressable>
            </View>
            {reminderEnabled ? (
              <>
                {Platform.OS === 'web' ? (
                  <TextField
                    label="Reminder time (HH:MM)"
                    value={reminderTime}
                    onChangeText={(value) => {
                      setReminderError(null);
                      setReminderTime(value);
                    }}
                    placeholder="18:00"
                    accessibilityLabel="Reminder time"
                  />
                ) : (
                  <>
                    <Pressable
                      onPress={() => setShowReminderTimePicker(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Reminder time"
                      className="mt-3 flex-row items-center justify-between rounded-xl border px-4 py-3"
                      style={{
                        borderColor: tokens.border,
                        backgroundColor: tokens.surfaceElevated,
                      }}
                    >
                      <Text className="text-sm" style={{ color: tokens.textMuted }}>
                        Time
                      </Text>
                      <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                        {reminderTime}
                      </Text>
                    </Pressable>
                    {showReminderTimePicker ? (
                      <DateTimePicker
                        value={(() => {
                          const parsed = parseHabitReminderTime(reminderTime) ?? {
                            hour: 18,
                            minute: 0,
                          };
                          const date = new Date();
                          date.setHours(parsed.hour, parsed.minute, 0, 0);
                          return date;
                        })()}
                        mode="time"
                        display="default"
                        is24Hour
                        onChange={(event, selectedDate) => {
                          setShowReminderTimePicker(false);
                          if (event.type === 'set' && selectedDate) {
                            setReminderError(null);
                            setReminderTime(
                              formatHabitReminderTime({
                                hour: selectedDate.getHours(),
                                minute: selectedDate.getMinutes(),
                              }),
                            );
                          }
                        }}
                      />
                    ) : null}
                    {HABIT_REMINDER_E2E_TEST && editingHabit ? (
                      <View className="gap-2">
                        <Button
                          label="Schedule test notification"
                          variant="ghost"
                          onPress={() => void scheduleTestReminder()}
                        />
                        <Button
                          label="Inject habit reminder tap"
                          variant="ghost"
                          onPress={() =>
                            injectTestReminderResponse('expo.modules.notifications.actions.DEFAULT')
                          }
                        />
                        <Button
                          label="Inject Mark complete response"
                          variant="ghost"
                          onPress={() =>
                            injectTestReminderResponse(HABIT_REMINDER_MARK_COMPLETE_ACTION)
                          }
                        />
                        <Button
                          label="Inject Snooze response"
                          variant="ghost"
                          onPress={() => injectTestReminderResponse(HABIT_REMINDER_SNOOZE_ACTION)}
                        />
                      </View>
                    ) : null}
                  </>
                )}
              </>
            ) : null}
            {reminderPermission === 'denied' || reminderPermission === 'unsupported' ? (
              <Text
                className="mt-1 text-xs"
                style={{ color: tokens.dangerText }}
                accessibilityRole="alert"
                accessibilityLabel="Notification permission error"
              >
                {reminderError ??
                  (reminderPermission === 'denied'
                    ? 'Allow notifications in system settings to enable reminders.'
                    : 'Native reminders are unavailable on this platform.')}
              </Text>
            ) : null}
          </View>
          <Text className="mb-1 text-sm font-medium" style={{ color: tokens.text }}>
            Category
          </Text>
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
          <Text className="mb-1 text-sm font-medium" style={{ color: tokens.text }}>
            Icon
          </Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {HABIT_ICONS.map((iconName) => (
              <Pressable
                key={iconName}
                onPress={() => {
                  setHabitError(null);
                  setIcon(iconName);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select ${iconName.replace('-', ' ')} icon`}
                accessibilityState={{ selected: icon === iconName }}
                className="items-center justify-center rounded-lg p-2"
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: icon === iconName ? COLOR : tokens.surfaceElevated,
                }}
              >
                <MaterialIcons
                  name={iconName}
                  size={24}
                  color={icon === iconName ? tokens.textOnAccent : tokens.iconMuted}
                />
              </Pressable>
            ))}
          </View>
          <Text className="mb-1 text-sm font-medium" style={{ color: tokens.text }}>
            Color
          </Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {HABIT_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  setHabitError(null);
                  setColor(c);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select habit color ${c}`}
                accessibilityState={{ selected: color === c }}
                className="rounded-full"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: c,
                  borderWidth: color === c ? 2 : 0,
                  borderColor: color === c ? tokens.textMuted : 'transparent',
                }}
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
            <Text className="text-sm" style={{ color: sectionAccents.habits.text }}>
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
                label={editingHabit ? 'Save changes' : 'Create habit'}
                onPress={onSubmit}
                color={COLOR}
              />
            </View>
          </View>
        </Card>
      </Modal>
      {insightsHabit ? (
        <HabitProgressInsightsModal
          visible
          habit={insightsHabit}
          onClose={() => setInsightsHabit(null)}
        />
      ) : null}
      <HabitDetailModal
        habit={detailHabit}
        onClose={() => setDetailHabit(null)}
        onOpenInsights={(habit) => {
          setDetailHabit(null);
          setInsightsHabit(habit);
        }}
        lifecycleState={
          detailHabit === null
            ? 'active'
            : archivedHabitIds.includes(detailHabit.id)
              ? 'archived'
              : pausedHabitIds.includes(detailHabit.id)
                ? 'paused'
                : 'active'
        }
        onTogglePause={
          detailHabit
            ? () => {
                void handleTogglePause(detailHabit.id);
                setDetailHabit(null);
              }
            : undefined
        }
        onToggleArchive={
          detailHabit
            ? () => {
                void handleToggleArchive(detailHabit.id);
                setDetailHabit(null);
              }
            : undefined
        }
      />
      {confirmationDialog}
    </Screen>
  );
}
