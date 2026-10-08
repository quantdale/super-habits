import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
import { Text } from '@/core/ui/Text';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { IconButton } from '@/core/ui/IconButton';
import { PageHeader } from '@/core/ui/PageHeader';
import { StatBlock } from '@/core/ui/StatBlock';
import { TextField } from '@/core/ui/TextField';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { Button } from '@/core/ui/Button';
import { SkeletonBlock } from '@/core/ui/SkeletonBlock';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { PillChip } from '@/core/ui/PillChip';
import { SegmentedControl } from '@/core/ui/SegmentedControl';
import { SparkIllustration } from '@/core/ui/illustrations/SparkIllustration';
import { useAppTheme } from '@/core/providers/themeContext';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { useInAppNotices } from '@/core/providers/inAppNoticeContext';
import { useGamification } from '@/features/gamification/gamificationContext';
import type { Habit, HabitCategory, HabitIcon } from './types';
import {
  addHabit,
  archiveHabit,
  decrementHabit,
  deleteHabit,
  getAllHabitCompletions,
  incrementHabit,
  listHabitLinkedActionRules,
  listHabits,
  pauseHabit,
  resumeHabit,
  saveHabitLinkedActionRules,
  unarchiveHabit,
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
  getHabitRuleForDate,
  getHabitSchedulePreset,
  habitCreationDateKey,
  normalizeHabitWeekdays,
  shouldAwardHabitFastPath,
  sortHabits,
  type HabitSchedulePreset,
  type HabitSortMode,
  type HabitStatusFilter,
  type HabitWeekday,
} from '@/features/habits/habits.domain';
import { migrateLegacyHabitLifecycle } from '@/features/habits/habitLifecycle.store';
import type { HeatmapDay } from '@/features/shared/activityTypes';
import { HabitCheckInRow } from '@/features/habits/HabitCheckInRow';
import { HabitEditorChoice } from '@/features/habits/HabitEditorChoice';
import {
  buildHabitCheckInRow,
  groupHabitCheckInRows,
  summarizeHabitsForDate,
  type HabitCheckInRowModel,
} from '@/features/habits/habitCheckIn.domain';
import { HabitDayStrip, type HabitDayStripDay } from '@/features/habits/HabitDayStrip';
import {
  buildHabitDayStrip,
  buildHabitRuleHistoryIndex,
} from '@/features/habits/habitsScreen.derivations';
import { HabitsOverviewGrid } from '@/features/habits/HabitsOverviewGrid';
import { HabitDetailModal } from '@/features/habits/HabitDetailModal';
import {
  DEFAULT_HABIT_COLOR,
  DEFAULT_HABIT_ICON,
  HABIT_COLORS,
  HABIT_ICONS,
} from '@/features/habits/habitPresets';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { toDateKey } from '@/lib/time';
import { parseNumericInput } from '@/lib/numericInput';
import { createSubmitGuard } from '@/lib/submitGuard';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
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

type CheckInListItem =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'habit'; key: string; row: HabitCheckInRowModel };
const EMPTY_COUNTS: Readonly<Record<string, number>> = {};

export function HabitsScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
  const { consumePendingHabitFocus } = useAppNavigation();
  const dayGeneration = useDayRolloverGeneration();
  const { showNotice } = useInAppNotices();
  const { recordAction } = useGamification();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { begin: beginRefresh } = useGuardedAsyncRefresh();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitsLoaded, setHabitsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // habitId → dateKey → count for every loaded completion row; today's and
  // past-day views (day strip) both read from this one map.
  const [countsByHabitDate, setCountsByHabitDate] = useState<
    Record<string, Record<string, number>>
  >({});
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey());
  // Day rollover: the strip selection is captured at mount, so without this
  // snap the ring/check-ins would keep targeting yesterday after midnight.
  useEffect(() => {
    queueMicrotask(() => setSelectedDateKey(toDateKey()));
  }, [dayGeneration]);
  const [streakMap, setStreakMap] = useState<Record<string, number>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
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
  const [habitError, setHabitError] = useState<string | null>(null);
  const [isSavingHabit, setIsSavingHabit] = useState(false);
  const habitSubmitGuard = useRef(createSubmitGuard());
  const [linkedActionRows, setLinkedActionRows] = useState<LinkedActionEditorRowDraft[]>([]);
  const [linkedActionsError, setLinkedActionsError] = useState<string | null>(null);
  const [linkedActionsLoading, setLinkedActionsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<HabitStatusFilter>('active');
  const [sortMode, setSortMode] = useState<HabitSortMode>('default');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);
  const [detailConfirmationOpen, setDetailConfirmationOpen] = useState(false);
  const deletionPending = useRef(false);
  const binaryWrites = useRef(new Set<string>());
  const [busyHabitIds, setBusyHabitIds] = useState<ReadonlySet<string>>(new Set());

  const displayedHabits = useMemo(
    () => sortHabits(filterHabits(habits, { status: statusFilter }), sortMode, streakMap),
    [habits, statusFilter, sortMode, streakMap],
  );

  const refresh = useCallback(async () => {
    // Rollover/foreground races: an older run must never overwrite newer
    // day-keyed state after a newer refresh started or the screen unmounted.
    const isCurrent = beginRefresh();
    try {
      // One-time import of the pre-v20 AsyncStorage pause/archive sets.
      await migrateLegacyHabitLifecycle();
      const list = await listHabits();
      if (!isCurrent()) return;
      setHabits(list);
      const todayKey = toDateKey();
      // F13: one full completion scan feeds the per-day counts, streaks (full
      // history), and the 364-day grid slice — no second overlapping query.
      const allHabitCompletions = await getAllHabitCompletions();
      if (!isCurrent()) return;
      const completionsByHabit = new Map<string, typeof allHabitCompletions>();
      const nextCountsByHabitDate: Record<string, Record<string, number>> = {};
      for (const completion of allHabitCompletions) {
        const habitRows = completionsByHabit.get(completion.habit_id) ?? [];
        habitRows.push(completion);
        completionsByHabit.set(completion.habit_id, habitRows);
        (nextCountsByHabitDate[completion.habit_id] ??= {})[completion.date_key] = completion.count;
      }
      setCountsByHabitDate(nextCountsByHabitDate);

      const streaks: Record<string, number> = {};
      for (const habit of list) {
        const completions = completionsByHabit.get(habit.id) ?? [];
        const dayCompletions = buildDayCompletions(
          completions,
          habit.target_per_day,
          undefined,
          habit.rule_history,
          habitCreationDateKey(habit.created_at),
          todayKey,
          habit.lifecycle_history,
        );
        streaks[habit.id] = calculateCurrentStreak(dayCompletions, todayKey);
      }
      setStreakMap(streaks);

      setHabitsLoaded(true);
      setLoadError(null);
    } catch {
      if (isCurrent()) setLoadError('Could not load habits. Try again.');
    }
  }, [beginRefresh]);

  useActiveForegroundRefresh(isActive, refresh, dayGeneration);

  const handleTogglePause = useCallback(
    async (habit: Habit) => {
      if ((habit.status ?? 'active') === 'paused') {
        await resumeHabit(habit.id);
      } else {
        await pauseHabit(habit.id);
      }
      await refresh();
    },
    [refresh],
  );

  const handleToggleArchive = useCallback(
    async (habit: Habit) => {
      if ((habit.status ?? 'active') === 'archived') {
        await unarchiveHabit(habit.id);
      } else {
        await archiveHabit(habit.id);
      }
      await refresh();
    },
    [refresh],
  );

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
    if (!habitSubmitGuard.current.tryStart()) return;
    setIsSavingHabit(true);
    try {
      await runHabitSubmit();
    } finally {
      habitSubmitGuard.current.finish();
      setIsSavingHabit(false);
    }
  };

  const runHabitSubmit = async () => {
    const targetNum = parseNumericInput(target) ?? 0;
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
    async (habitId: string, dateKey: string, binary = false) => {
      if (binary && binaryWrites.current.has(habitId)) return;
      if (binary) {
        binaryWrites.current.add(habitId);
        setBusyHabitIds(new Set(binaryWrites.current));
      }
      try {
        const result = await incrementHabit(habitId, dateKey);
        for (const notice of result.linkedActions.notices) {
          showNotice(notice);
        }
        if (result.count <= 0) {
          setCheckInError('Check-in did not save. Try again.');
        } else {
          setCheckInError(null);
        }
        // Fast path only for confirmed TODAY writes (idempotent per day+habit,
        // so a replay can never double-award). Backdated day-strip check-ins
        // and refused writes (count 0) degrade to reconcile backfill with the
        // action-day key — a today-keyed award for either would mis-attribute.
        if (shouldAwardHabitFastPath(dateKey, result.count, toDateKey())) {
          recordAction('habit', habitId);
        }
        await refresh();
      } catch {
        setCheckInError('Check-in did not save. Try again.');
      } finally {
        binaryWrites.current.delete(habitId);
        setBusyHabitIds(new Set(binaryWrites.current));
      }
    },
    [recordAction, refresh, showNotice],
  );

  const handleDecrement = useCallback(
    async (habitId: string, dateKey: string, binary = false) => {
      if (binary && binaryWrites.current.has(habitId)) return;
      if (binary) {
        binaryWrites.current.add(habitId);
        setBusyHabitIds(new Set(binaryWrites.current));
      }
      try {
        await decrementHabit(habitId, dateKey);
        setCheckInError(null);
        await refresh();
      } catch {
        setCheckInError('Could not remove that check-in. Try again.');
      } finally {
        binaryWrites.current.delete(habitId);
        setBusyHabitIds(new Set(binaryWrites.current));
      }
    },
    [refresh],
  );

  const handleDeleteHabit = useCallback(
    async (habit: Habit) => {
      if (deletionPending.current) return;
      deletionPending.current = true;
      // RN Web portals mount in creation order. The newly opened detail can
      // otherwise cover the older confirmation host even while it is visible.
      // Preserve the detail's section state so Cancel returns to Settings.
      setDetailConfirmationOpen(Platform.OS === 'web');
      setCheckInError(null);
      try {
        const confirmed = await confirm({
          title: 'Remove habit',
          message: `Remove "${habit.name}"?`,
          confirmLabel: 'Delete habit',
          confirmVariant: 'danger',
        });
        if (!confirmed) return;
        await deleteHabit(habit.id);
        setDetailHabit((current) => (current?.id === habit.id ? null : current));
        await refresh();
      } catch {
        setCheckInError('Could not delete this habit. Try again.');
      } finally {
        deletionPending.current = false;
        setDetailConfirmationOpen(false);
      }
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
  // Paused/archived habits carry no obligation today (F1): only durable-active
  // rows count toward the scheduled/completed denominators. Memoized on the
  // source list so a re-render with unchanged data recomputes nothing, and so
  // the strip memo below has a referentially stable dependency.
  const activeHabits = useMemo<Habit[]>(
    () => habits.filter((habit) => (habit.status ?? 'active') === 'active'),
    [habits],
  );

  // Each active habit's rule history is parsed once per data change: the day
  // loop used to re-parse it for every habit on every strip day, on every
  // render, because `activeHabits` had a fresh identity each render.
  const ruleHistoryById = useMemo(() => buildHabitRuleHistoryIndex(activeHabits), [activeHabits]);

  const selectedSummary = useMemo(
    () =>
      summarizeHabitsForDate({
        habits: activeHabits,
        countsByHabitDate,
        dateKey: selectedDateKey,
        todayKey,
      }),
    [activeHabits, countsByHabitDate, selectedDateKey, todayKey],
  );
  const checkInRows = useMemo(
    () =>
      displayedHabits.map((habit) =>
        buildHabitCheckInRow({
          habit,
          dateKey: selectedDateKey,
          todayKey,
          count: countsByHabitDate[habit.id]?.[selectedDateKey] ?? 0,
          currentStreak: streakMap[habit.id] ?? 0,
        }),
      ),
    [countsByHabitDate, displayedHabits, selectedDateKey, streakMap, todayKey],
  );
  const checkInGroups = useMemo(() => groupHabitCheckInRows(checkInRows), [checkInRows]);
  const habitsById = useMemo(() => new Map(habits.map((habit) => [habit.id, habit])), [habits]);

  // Last 7 days ending at today (today anchored last), with per-day
  // scheduled/completed aggregates over durable-active habits only.
  const stripDays = useMemo<HabitDayStripDay[]>(
    () =>
      buildHabitDayStrip({ activeHabits, ruleHistoryById, countsByHabitDate, today: new Date() }),
    [activeHabits, ruleHistoryById, countsByHabitDate],
  );

  const listItems = useMemo<CheckInListItem[]>(
    () =>
      checkInGroups.flatMap((group) => [
        { kind: 'header' as const, key: `group-${group.key}`, title: group.label },
        ...group.rows.map((row) => ({ kind: 'habit' as const, key: row.habitId, row })),
      ]),
    [checkInGroups],
  );
  // Reflection is computed only when opened; no yearly heatmap on a normal check-in.
  const trendsGrid = useMemo(() => {
    if (!trendsOpen) return [];
    const completions = Object.entries(countsByHabitDate).flatMap(([habit_id, counts]) =>
      Object.entries(counts).map(([date_key, count]) => ({ habit_id, date_key, count })),
    );
    return buildHabitGrid(habits, completions, 364, todayKey);
  }, [countsByHabitDate, habits, todayKey, trendsOpen]);
  const consistencyPct = useMemo(() => calculateOverallConsistency(trendsGrid), [trendsGrid]);
  const habitHeatmapDays = useMemo<HeatmapDay[]>(
    () => (trendsOpen ? buildAggregatedHabitHeatmap(trendsGrid, 364) : []),
    [trendsGrid, trendsOpen],
  );
  const overallStreak = Math.max(0, ...Object.values(streakMap));
  const filterCount = (statusFilter === 'active' ? 0 : 1) + (sortMode === 'default' ? 0 : 1);
  const currentDetailHabit = detailHabit ? (habitsById.get(detailHabit.id) ?? null) : null;
  const detailRow = currentDetailHabit
    ? buildHabitCheckInRow({
        habit: currentDetailHabit,
        dateKey: selectedDateKey,
        todayKey,
        count: countsByHabitDate[currentDetailHabit.id]?.[selectedDateKey] ?? 0,
        currentStreak: streakMap[currentDetailHabit.id] ?? 0,
      })
    : null;

  return (
    <Screen
      scroll={false}
      padded
      contentMaxWidth={720}
      hero={
        <View className="gap-2">
          <PageHeader
            eyebrow="Daily check-in"
            title="Habits"
            subtitle={habitsLoaded ? selectedSummary.label : 'Loading check-ins…'}
            actions={
              <View className="flex-row items-center gap-2">
                <IconButton
                  icon="add"
                  onPress={() => openAddModal('anytime')}
                  accessibilityLabel="Add habit"
                  accentColor={sectionAccents.habits.text}
                />
                <IconButton
                  icon="tune"
                  onPress={() => setFilterSheetOpen(true)}
                  accessibilityLabel={
                    filterCount > 0 ? `Filter and sort, ${filterCount} active` : 'Filter and sort'
                  }
                  selected={filterCount > 0}
                  accentColor={sectionAccents.habits.text}
                />
              </View>
            }
          />
          {habitsLoaded ? (
            <View accessibilityLabel="Check-in day">
              <HabitDayStrip
                days={stripDays}
                selectedDateKey={selectedDateKey}
                todayKey={todayKey}
                onSelect={setSelectedDateKey}
              />
            </View>
          ) : null}
          {checkInError ? (
            <Text accessibilityRole="alert" variant="caption" style={{ color: tokens.dangerText }}>
              {checkInError}
            </Text>
          ) : null}
        </View>
      }
    >
      {loadError ? (
        <View className="gap-3">
          <Text accessibilityRole="alert" variant="bodyMd" style={{ color: tokens.dangerText }}>
            {loadError}
          </Text>
          <Button label="Retry loading habits" variant="ghost" onPress={() => void refresh()} />
        </View>
      ) : !habitsLoaded ? (
        <View className="gap-3" accessibilityLabel="Loading habits">
          <SkeletonBlock height={56} radius={12} />
          <SkeletonBlock height={56} radius={12} />
          <SkeletonBlock height={56} radius={12} />
        </View>
      ) : habits.length === 0 ? (
        <View>
          <EmptyStateCard
            accentColor={SECTION_COLORS.habits}
            title="No habits yet"
            description="Add a habit to start today's check-in."
            illustration={<SparkIllustration color={SECTION_COLORS.habits} />}
          >
            <Button
              label="Add a habit"
              color={SECTION_COLORS.habits}
              onPress={() => openAddModal('anytime')}
            />
          </EmptyStateCard>
          <View className="pt-4">
            <Button label="Trends" variant="ghost" onPress={() => setTrendsOpen(true)} />
          </View>
        </View>
      ) : (
        <FlashList
          data={listItems}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          ListEmptyComponent={
            <Text variant="bodyMd" tone="muted" className="py-6">
              No habits in this view.
            </Text>
          }
          renderItem={({ item }) => {
            if (item.kind === 'header')
              return (
                <Text variant="label" tone="muted" className="pb-1 pt-4">
                  {item.title}
                </Text>
              );
            const habit = habitsById.get(item.row.habitId);
            if (!habit) return null;
            return (
              <HabitCheckInRow
                habit={habit}
                row={item.row}
                busy={busyHabitIds.has(habit.id)}
                onIncrement={() => {
                  void handleIncrement(habit.id, selectedDateKey, !item.row.quantitative);
                }}
                onDecrement={() => {
                  void handleDecrement(habit.id, selectedDateKey, !item.row.quantitative);
                }}
                onOpen={() => setDetailHabit(habit)}
              />
            );
          }}
          ListFooterComponent={
            <View className="pt-4">
              <Button label="Trends" variant="ghost" onPress={() => setTrendsOpen(true)} />
            </View>
          }
        />
      )}

      <Modal
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filter and sort"
        modalLayout="bottom-sheet"
      >
        <Text variant="label" tone="muted" className="mb-2">
          Status
        </Text>
        <SegmentedControl
          options={(
            [
              { key: 'active', label: 'Active' },
              { key: 'paused', label: 'Paused' },
              { key: 'archived', label: 'Archived' },
              { key: 'all', label: 'All' },
            ] as { key: HabitStatusFilter; label: string }[]
          ).map((option) => ({
            value: option.key,
            label: option.label,
            accessibilityLabel: `Filter habits: ${option.label}`,
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
          accentColor={COLOR}
          accessibilityLabel="Habit status filter"
        />
        <Text variant="label" tone="muted" className="mb-2 mt-4">
          Sort
        </Text>
        <View className="flex-row flex-wrap">
          {(
            [
              { key: 'default', label: 'Default order' },
              { key: 'name', label: 'Name' },
              { key: 'streak', label: 'Streak' },
            ] as { key: HabitSortMode; label: string }[]
          ).map((option) => (
            <PillChip
              key={option.key}
              label={option.label}
              accessibilityLabel={`Sort habits by ${option.label}`}
              active={sortMode === option.key}
              color={COLOR}
              onPress={() => setSortMode(option.key)}
            />
          ))}
        </View>
      </Modal>

      <Modal visible={trendsOpen} onClose={() => setTrendsOpen(false)} title="Trends" scroll>
        <Text variant="bodyMd" tone="muted" className="mb-3">
          {habits.length} habits across your daily routine
        </Text>
        <View
          accessible
          accessibilityLabel={
            selectedSummary.isToday
              ? selectedSummary.scheduledCount === 0
                ? 'No habits scheduled today.'
                : `Today: ${selectedSummary.completedCount} of ${selectedSummary.scheduledCount} scheduled habits complete.`
              : selectedSummary.accessibilityLabel
          }
        >
          <Text variant="bodyLg">
            {selectedSummary.scheduledCount === 0
              ? 'Rest day'
              : `${selectedSummary.completedCount} of ${selectedSummary.scheduledCount} scheduled`}
          </Text>
        </View>
        <View className="mt-4 flex-row flex-wrap gap-3">
          <StatBlock
            accentColor={SECTION_COLORS.habits}
            className="min-w-[140px] flex-1"
            value={overallStreak}
            label="Highest current streak"
            detail="scheduled occurrences"
          />
          <StatBlock
            accentColor={SECTION_COLORS.habits}
            className="min-w-[140px] flex-1"
            value={`${consistencyPct}%`}
            label="Consistency"
            detail="over the last year"
          />
        </View>
        <View className="mt-4">
          <HabitsOverviewGrid consistencyPercent={consistencyPct} heatmapDays={habitHeatmapDays} />
        </View>
      </Modal>

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
          <Text variant="label" className="mb-1">
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
            <View className="mb-3 flex-row flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((weekday) => {
                const selected = weekdays.includes(weekday.value);
                return (
                  <HabitEditorChoice
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
                    role="checkbox"
                    label={`${weekday.fullLabel} scheduled`}
                    selected={selected}
                  >
                    <Text
                      variant="caption"
                      style={{ color: selected ? tokens.onSolid : tokens.textMuted }}
                    >
                      {weekday.label}
                    </Text>
                  </HabitEditorChoice>
                );
              })}
            </View>
          ) : null}
          <View className="mb-3 mt-1 rounded-2xl border p-3" style={{ borderColor: tokens.border }}>
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text variant="label">Reminder</Text>
                <Text variant="caption" tone="muted" className="mt-0.5">
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
                aria-checked={reminderEnabled}
                hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
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
                      <Text variant="bodyMd" tone="muted">
                        Time
                      </Text>
                      <Text variant="titleMd" style={{ color: tokens.text }}>
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
                variant="caption"
                className="mt-1"
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
          <Text variant="label" className="mb-1">
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
          <Text variant="label" className="mb-1">
            Icon
          </Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {HABIT_ICONS.map((iconName) => (
              <HabitEditorChoice
                key={iconName}
                onPress={() => {
                  setHabitError(null);
                  setIcon(iconName);
                }}
                label={`Select ${iconName.replace('-', ' ')} icon`}
                selected={icon === iconName}
              >
                <MaterialIcons
                  name={iconName}
                  size={24}
                  color={icon === iconName ? tokens.onSolid : tokens.iconMuted}
                />
              </HabitEditorChoice>
            ))}
          </View>
          <Text variant="label" className="mb-1">
            Color
          </Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {HABIT_COLORS.map((c) => (
              <HabitEditorChoice
                key={c}
                onPress={() => {
                  setHabitError(null);
                  setColor(c);
                }}
                label={`Select habit color ${c}`}
                selected={color === c}
                swatch={c}
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
            <Text variant="bodyMd" style={{ color: sectionAccents.habits.text }}>
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
                loading={isSavingHabit}
              />
            </View>
          </View>
        </Card>
      </Modal>
      {currentDetailHabit && detailRow ? (
        <HabitDetailModal
          key={currentDetailHabit.id}
          habit={currentDetailHabit}
          row={detailRow}
          countsByDate={countsByHabitDate[currentDetailHabit.id] ?? EMPTY_COUNTS}
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          busy={busyHabitIds.has(currentDetailHabit.id)}
          visible={!detailConfirmationOpen}
          checkInError={checkInError}
          onClose={() => setDetailHabit(null)}
          onIncrement={() =>
            void handleIncrement(currentDetailHabit.id, selectedDateKey, !detailRow.quantitative)
          }
          onDecrement={() =>
            void handleDecrement(currentDetailHabit.id, selectedDateKey, !detailRow.quantitative)
          }
          onDelete={() => void handleDeleteHabit(currentDetailHabit)}
          onEdit={(habit) => {
            setDetailHabit(null);
            void openEditModal(habit);
          }}
          onTogglePause={() => {
            void handleTogglePause(currentDetailHabit);
            setDetailHabit(null);
          }}
          onToggleArchive={() => {
            void handleToggleArchive(currentDetailHabit);
            setDetailHabit(null);
          }}
        />
      ) : null}
      {confirmationDialog}
    </Screen>
  );
}
