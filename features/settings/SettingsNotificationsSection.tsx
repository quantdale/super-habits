import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { getNotificationPermissionState, requestTodoReminderPermission } from '@/lib/notifications';
import {
  getDailyPlanReminderTime,
  getTodoRemindersEnabled,
  getWeeklyReviewReminder,
  setDailyPlanReminderTime,
  setTodoRemindersEnabled,
  setWeeklyReviewReminder,
} from '@/core/notifications/notificationPreferences';
import { normalizeTimeOfDayInput } from '@/core/notifications/reminderPlanning';
import { syncDailyPlanReminder } from '@/core/notifications/dailyPlanReminderScheduler';
import { syncWeeklyReviewReminder } from '@/core/notifications/weeklyReviewReminderScheduler';
import type { WeeklyReviewWeekday } from '@/features/weekly-review/weeklyReviewReminder.domain';
import { reconcileTodoReminders } from '@/core/notifications/todoReminderScheduler';
import { reconcileWorkoutDayReminder } from '@/core/notifications/workoutReminderScheduler';
import {
  getWorkoutPreferences,
  saveWorkoutPreferences,
  type WorkoutPreferences,
} from '@/features/workout/workout.data';
import type { WorkoutEffortScale } from '@/core/db/types';
import { Card } from '@/core/ui/Card';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { ValidationError } from '@/core/ui/ValidationError';
import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { SettingsRow, SettingsSectionHeading, SettingsStatusPill } from './SettingsSharedUi';

const ACCENT = SECTION_COLORS[POMODORO_SECTION_KEY];

const WEEKDAY_LABELS: Record<WeeklyReviewWeekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};
const WEEKDAYS: WeeklyReviewWeekday[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * Notification preferences beyond habits, in the Notifications / Timer
 * defaults bucket. Preferences persist to AsyncStorage under
 * `superhabits.notifications.*`; scheduling itself is native-only and degrades
 * silently on web.
 */
export function SettingsNotificationsSection() {
  const { tokens } = useAppTheme();
  const [todoRemindersEnabled, setTodoRemindersEnabledState] = useState(false);
  const [dailyPlanTimeInput, setDailyPlanTimeInput] = useState('08:00');
  const [weeklyEnabled, setWeeklyEnabledState] = useState(false);
  const [weeklyWeekday, setWeeklyWeekday] = useState<WeeklyReviewWeekday>(0);
  const [weeklyTimeInput, setWeeklyTimeInput] = useState('18:00');
  const [workoutReminderEnabled, setWorkoutReminderEnabled] = useState(false);
  const [workoutReminderTimeInput, setWorkoutReminderTimeInput] = useState('07:00');
  const [effortScale, setEffortScale] = useState<WorkoutEffortScale>('off');
  const [workoutPreferences, setWorkoutPreferences] = useState<WorkoutPreferences | null>(null);
  const [permissionLabel, setPermissionLabel] = useState('Checking…');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [enabled, time, permission, weekly, workout] = await Promise.all([
        getTodoRemindersEnabled(),
        getDailyPlanReminderTime(),
        getNotificationPermissionState(),
        getWeeklyReviewReminder(),
        getWorkoutPreferences(),
      ]);
      setTodoRemindersEnabledState(enabled);
      setWeeklyEnabledState(weekly.enabled);
      setWeeklyWeekday(weekly.weekday);
      setWeeklyTimeInput(
        `${String(weekly.hour).padStart(2, '0')}:${String(weekly.minute).padStart(2, '0')}`,
      );
      setDailyPlanTimeInput(
        `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`,
      );
      setWorkoutPreferences(workout);
      setEffortScale(workout.effortScale);
      setWorkoutReminderEnabled(workout.workoutReminder?.enabled ?? false);
      setWorkoutReminderTimeInput(
        `${String(workout.workoutReminder?.time.hour ?? 7).padStart(2, '0')}:${String(workout.workoutReminder?.time.minute ?? 0).padStart(2, '0')}`,
      );
      setPermissionLabel(
        permission === 'granted'
          ? 'Allowed'
          : permission === 'denied'
            ? 'Blocked in system settings'
            : permission === 'not_determined'
              ? 'Not requested yet'
              : 'Web — native reminders unavailable',
      );
      setError(null);
    } catch (err) {
      console.error('[SettingsNotificationsSection] load failed', err);
      setError('Unable to load notification preferences right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const handleToggleTodoReminders = async (enabled: boolean) => {
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      if (enabled) {
        // Request from an interactive context (audit F8): the OS prompt must
        // be triggered by this tap, not by a later background schedule call.
        const permission = await requestTodoReminderPermission();
        if (permission !== 'granted') {
          setError(
            permission === 'denied'
              ? 'Notifications are blocked. Enable them in system settings, then turn reminders on again.'
              : 'Native reminders are available on Android and iOS only.',
          );
          return;
        }
      }
      await setTodoRemindersEnabled(enabled);
      setTodoRemindersEnabledState(enabled);
      // Reconcile the whole todo-reminder namespace so toggle-off cancels
      // live reminders and toggle-on schedules existing due todos (audit F3).
      const reconcile = await reconcileTodoReminders();
      if (!enabled) {
        setSavedNote(
          reconcile.status === 'reconciled' && reconcile.cancelled > 0
            ? `Todo reminders off. ${reconcile.cancelled} scheduled reminder(s) cancelled.`
            : 'Todo reminders off.',
        );
      } else if (reconcile.status === 'permission_denied') {
        setSavedNote('Todo reminders on, but notification access is blocked in system settings.');
      } else if (reconcile.status === 'unsupported') {
        setSavedNote('Todo reminders on. Native reminders are unavailable on this platform.');
      } else if (reconcile.status === 'failed') {
        setError('Todo reminders turned on, but scheduling failed. Try toggling off and on.');
      } else {
        setSavedNote(
          reconcile.scheduled > 0
            ? `Todo reminders on. ${reconcile.scheduled} reminder(s) scheduled.`
            : 'Todo reminders on.',
        );
      }
      // The daily-plan nudge follows this toggle; keep it in sync.
      await syncDailyPlanReminder();
    } catch (err) {
      console.error('[SettingsNotificationsSection] toggle failed', err);
      setError('Unable to update the todo reminders toggle right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDailyPlanTime = async () => {
    const normalized = normalizeTimeOfDayInput(dailyPlanTimeInput);
    if (!normalized) {
      setError('Enter a valid time as HH:mm (24-hour), e.g. 08:30.');
      return;
    }
    const [hour, minute] = normalized.split(':').map(Number);
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      await setDailyPlanReminderTime({ hour, minute });
      const result = await syncDailyPlanReminder();
      setDailyPlanTimeInput(normalized);
      // Report what actually happened instead of an unconditional success
      // note (audit F6): the nudge is gated by the master todo toggle.
      if (result.status === 'scheduled') {
        setSavedNote(`Daily plan reminder saved for ${normalized}.`);
      } else if (result.status === 'cancelled') {
        setSavedNote(`Saved for ${normalized}. Turn on todo due-date reminders to schedule it.`);
      } else if (result.reason === 'permission-denied') {
        setError('Notification access is blocked in system settings.');
      } else {
        setSavedNote(`Saved for ${normalized}. Native reminders are unavailable here.`);
      }
    } catch (err) {
      console.error('[SettingsNotificationsSection] save daily-plan time failed', err);
      setError('Unable to save the daily plan reminder time right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWeeklyReminder = async (enabled: boolean) => {
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      if (enabled && Platform.OS !== 'web') {
        const permission = await requestTodoReminderPermission();
        if (permission !== 'granted') {
          setError(
            permission === 'denied'
              ? 'Notifications are blocked. Enable them in system settings, then turn the reminder on again.'
              : 'Native reminders are available on Android and iOS only.',
          );
          return;
        }
      }
      const parts = normalizeTimeOfDayInput(weeklyTimeInput);
      const [hour, minute] = parts ? (parts.split(':').map(Number) as [number, number]) : [18, 0];
      await setWeeklyReviewReminder({ enabled, weekday: weeklyWeekday, hour, minute });
      setWeeklyEnabledState(enabled);
      const result = await syncWeeklyReviewReminder();
      const when = `${WEEKDAY_LABELS[weeklyWeekday]} ${parts ?? weeklyTimeInput}`;
      if (result.status === 'scheduled') {
        setSavedNote(`Weekly review reminder saved for ${when}.`);
      } else if (result.status === 'cancelled') {
        setSavedNote('Weekly review reminder off.');
      } else if (result.reason === 'permission-denied') {
        setError('Notification access is blocked in system settings.');
      } else {
        setSavedNote(`Saved for ${when}. Native reminders are unavailable here.`);
      }
    } catch (err) {
      console.error('[SettingsNotificationsSection] weekly toggle failed', err);
      setError('Unable to update the weekly review reminder right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeeklyTime = async () => {
    const normalized = normalizeTimeOfDayInput(weeklyTimeInput);
    if (!normalized) {
      setError('Enter a valid time as HH:mm (24-hour), e.g. 18:00.');
      return;
    }
    const [hour, minute] = normalized.split(':').map(Number) as [number, number];
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      await setWeeklyReviewReminder({
        enabled: true,
        weekday: weeklyWeekday,
        hour,
        minute,
      });
      setWeeklyEnabledState(true);
      setWeeklyTimeInput(normalized);
      const result = await syncWeeklyReviewReminder();
      const when = `${WEEKDAY_LABELS[weeklyWeekday]} ${normalized}`;
      if (result.status === 'scheduled') {
        setSavedNote(`Weekly review reminder saved for ${when}.`);
      } else if (result.status === 'cancelled') {
        setSavedNote(`Saved for ${when}. Turn the reminder on to schedule it.`);
      } else if (result.reason === 'permission-denied') {
        setError('Notification access is blocked in system settings.');
      } else {
        setSavedNote(`Saved for ${when}. Native reminders are unavailable here.`);
      }
    } catch (err) {
      console.error('[SettingsNotificationsSection] save weekly time failed', err);
      setError('Unable to save the weekly review reminder right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEffortScale = async (nextScale: WorkoutEffortScale) => {
    const current = workoutPreferences;
    if (!current) return;
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      const next = { ...current, effortScale: nextScale };
      await saveWorkoutPreferences(next);
      setWorkoutPreferences(next);
      setEffortScale(nextScale);
      setSavedNote(
        nextScale === 'off'
          ? 'Effort tracking off.'
          : `${nextScale.toUpperCase()} tracking enabled.`,
      );
    } catch (err) {
      console.error('[SettingsNotificationsSection] effort scale save failed', err);
      setError('Unable to save the effort scale right now.');
    } finally {
      setSaving(false);
    }
  };

  const reconcileWorkoutReminder = async (enabled: boolean, timeInput: string) => {
    const normalized = normalizeTimeOfDayInput(timeInput);
    if (!normalized) {
      setError('Enter a valid workout reminder time as HH:mm (24-hour), e.g. 07:00.');
      return;
    }
    const [hour, minute] = normalized.split(':').map(Number) as [number, number];
    const current = workoutPreferences;
    if (!current) return;
    const next: WorkoutPreferences = {
      ...current,
      workoutReminder: { enabled, time: { hour, minute } },
    };
    await saveWorkoutPreferences(next);
    setWorkoutPreferences(next);
    setWorkoutReminderEnabled(enabled);
    setWorkoutReminderTimeInput(normalized);
    const result = await reconcileWorkoutDayReminder();
    if (result.status === 'permission_denied') {
      setError('Notification access is blocked in system settings.');
    } else if (result.status === 'unsupported') {
      setSavedNote('Saved on this device. Native workout reminders are unavailable on web.');
    } else if (result.status === 'disabled') {
      setSavedNote('Workout-day reminders off.');
    } else {
      setSavedNote(
        result.scheduled > 0
          ? `Workout-day reminders on. ${result.scheduled} upcoming reminder(s) scheduled.`
          : 'Workout-day reminders on. No upcoming training days are in the scheduling window.',
      );
    }
  };

  const handleToggleWorkoutReminder = async (enabled: boolean) => {
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      if (enabled && Platform.OS !== 'web') {
        const permission = await requestTodoReminderPermission();
        if (permission !== 'granted') {
          setError(
            permission === 'denied'
              ? 'Notifications are blocked. Enable them in system settings, then turn the workout reminder on again.'
              : 'Native reminders are available on Android and iOS only.',
          );
          return;
        }
      }
      await reconcileWorkoutReminder(enabled, workoutReminderTimeInput);
    } catch (err) {
      console.error('[SettingsNotificationsSection] workout reminder toggle failed', err);
      setError('Unable to update the workout-day reminder right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkoutReminderTime = async () => {
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      await reconcileWorkoutReminder(workoutReminderEnabled, workoutReminderTimeInput);
    } catch (err) {
      console.error('[SettingsNotificationsSection] workout reminder time save failed', err);
      setError('Unable to save the workout-day reminder time right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="Notifications / Timer defaults"
        title="Reminders"
        subtitle="Due-date reminders for todos and a daily plan nudge. Native apps only; web keeps working without them."
        icon="notifications-active"
        accentColor={ACCENT}
      />
      <Card accentColor={ACCENT} className="mb-0">
        <SettingsRow
          first
          label="Notification permission"
          description={
            loading ? 'Checking notification access...' : `System status: ${permissionLabel}`
          }
          statusLabel={loading ? 'Loading' : permissionLabel === 'Allowed' ? 'On' : 'Check'}
          statusTone={loading ? 'neutral' : permissionLabel === 'Allowed' ? 'accent' : 'warning'}
          accentColor={ACCENT}
        />

        <View className="flex-row items-center justify-between pt-3">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Todo due-date reminders
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              Notify when a todo with a due date comes due. Completing or deleting a todo cancels
              its reminder.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Todo due-date reminders"
            value={todoRemindersEnabled}
            disabled={loading || saving}
            onValueChange={(value) => void handleToggleTodoReminders(value)}
            trackColor={{ true: ACCENT, false: tokens.surfaceElevated }}
          />
        </View>

        <View className="border-t pt-3" style={{ borderColor: tokens.border }}>
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Daily plan reminder time
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            A daily nudge to review your plan. Uses 24-hour HH:mm.
          </Text>
          {!todoRemindersEnabled ? (
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              Follows the todo due-date reminders toggle — turn it on to schedule this nudge.
            </Text>
          ) : null}
          <View className="mt-2 flex-row items-center gap-2">
            <TextInput
              accessibilityLabel="Daily plan reminder time"
              className="w-24 rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: tokens.border,
                backgroundColor: tokens.surfaceElevated,
                color: tokens.text,
              }}
              value={dailyPlanTimeInput}
              placeholder="08:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              editable={!loading && !saving && todoRemindersEnabled}
              onChangeText={(value) => {
                setError(null);
                setSavedNote(null);
                setDailyPlanTimeInput(value);
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save daily plan reminder time"
              className="rounded-full px-4 py-2"
              style={{ backgroundColor: `${ACCENT}18`, opacity: todoRemindersEnabled ? 1 : 0.5 }}
              disabled={loading || saving || !todoRemindersEnabled}
              onPress={() => void handleSaveDailyPlanTime()}
            >
              <Text className="text-sm font-semibold" style={{ color: ACCENT }}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
            <SettingsStatusPill label="Daily" tone="accent" accentColor={ACCENT} />
          </View>
        </View>

        <View className="border-t pt-3" style={{ borderColor: tokens.border }}>
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Weekly review reminder
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            A weekly nudge to close out your week and plan the next one. Opening it goes straight to
            the review.
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            {Platform.OS === 'web'
              ? 'Saved on this device. Native notification delivery is unavailable on web.'
              : 'Native apps schedule this reminder; notification access is controlled by the system.'}
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Switch
              accessibilityLabel="Weekly review reminder"
              value={weeklyEnabled}
              disabled={loading || saving}
              onValueChange={(value) => void handleToggleWeeklyReminder(value)}
              trackColor={{ true: ACCENT, false: tokens.surfaceElevated }}
            />
            <View className="flex-row gap-1">
              {WEEKDAYS.map((day) => {
                const active = weeklyWeekday === day;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={`Weekly review on ${WEEKDAY_LABELS[day]}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setError(null);
                      setSavedNote(null);
                      setWeeklyWeekday(day);
                    }}
                    className="rounded-lg border px-2 py-1"
                    style={{
                      borderColor: active ? ACCENT : tokens.border,
                      backgroundColor: active ? `${ACCENT}18` : tokens.surfaceElevated,
                    }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: active ? ACCENT : tokens.textMuted }}
                    >
                      {WEEKDAY_LABELS[day]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View className="mt-2 flex-row items-center gap-2">
            <TextInput
              accessibilityLabel="Weekly review reminder time"
              className="w-24 rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: tokens.border,
                backgroundColor: tokens.surfaceElevated,
                color: tokens.text,
              }}
              value={weeklyTimeInput}
              placeholder="18:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              editable={!loading && !saving}
              onChangeText={(value) => {
                setError(null);
                setSavedNote(null);
                setWeeklyTimeInput(value);
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save weekly review reminder time"
              className="rounded-full px-4 py-2"
              style={{ backgroundColor: `${ACCENT}18`, opacity: loading || saving ? 0.5 : 1 }}
              disabled={loading || saving}
              onPress={() => void handleSaveWeeklyTime()}
            >
              <Text className="text-sm font-semibold" style={{ color: ACCENT }}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
            <SettingsStatusPill label="Weekly" tone="accent" accentColor={ACCENT} />
          </View>
        </View>

        <View className="border-t pt-3" style={{ borderColor: tokens.border }}>
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Workout-day reminder
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            Optional reminders follow your weekly plan and date overrides. Rest days never schedule
            a reminder.
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            {Platform.OS === 'web'
              ? 'Saved locally, but browser notification delivery is unavailable here.'
              : 'Native apps schedule upcoming training days; notification access is controlled by the system.'}
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Switch
              accessibilityLabel="Workout-day reminder"
              value={workoutReminderEnabled}
              disabled={loading || saving || workoutPreferences === null}
              onValueChange={(value) => void handleToggleWorkoutReminder(value)}
              trackColor={{ true: ACCENT, false: tokens.surfaceElevated }}
            />
            <SettingsStatusPill
              label={workoutReminderEnabled ? 'On' : 'Off'}
              tone={workoutReminderEnabled ? 'accent' : 'neutral'}
              accentColor={ACCENT}
            />
          </View>
          <View className="mt-2 flex-row items-center gap-2">
            <TextInput
              accessibilityLabel="Workout reminder time"
              className="w-24 rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: tokens.border,
                backgroundColor: tokens.surfaceElevated,
                color: tokens.text,
              }}
              value={workoutReminderTimeInput}
              placeholder="07:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              editable={!loading && !saving && workoutPreferences !== null}
              onChangeText={(value) => {
                setError(null);
                setSavedNote(null);
                setWorkoutReminderTimeInput(value);
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save workout reminder time"
              className="rounded-full px-4 py-2"
              style={{ backgroundColor: `${ACCENT}18`, opacity: loading || saving ? 0.5 : 1 }}
              disabled={loading || saving || workoutPreferences === null}
              onPress={() => void handleSaveWorkoutReminderTime()}
            >
              <Text className="text-sm font-semibold" style={{ color: ACCENT }}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="border-t pt-3" style={{ borderColor: tokens.border }}>
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Set effort scale
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            Choose an optional scale to record with each guided set. Historical entries keep their
            scale.
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {(['off', 'rir', 'rpe'] as WorkoutEffortScale[]).map((scale) => {
              const active = effortScale === scale;
              return (
                <Pressable
                  key={scale}
                  accessibilityRole="button"
                  accessibilityLabel={`Set effort scale ${scale.toUpperCase()}`}
                  accessibilityState={{ selected: active }}
                  disabled={loading || saving || workoutPreferences === null}
                  onPress={() => void handleChangeEffortScale(scale)}
                  className="rounded-xl border px-3 py-2"
                  style={{
                    borderColor: active ? ACCENT : tokens.border,
                    backgroundColor: active ? `${ACCENT}18` : tokens.surfaceElevated,
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: active ? ACCENT : tokens.textMuted }}
                  >
                    {scale === 'off' ? 'Off' : scale.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ValidationError message={error} />
        {savedNote ? (
          <Text className="mt-2 text-sm" style={{ color: tokens.textMuted }}>
            {savedNote}
          </Text>
        ) : null}
      </Card>
    </ScreenSection>
  );
}
