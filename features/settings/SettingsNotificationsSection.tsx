import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { getNotificationPermissionState } from '@/lib/notifications';
import {
  getDailyPlanReminderTime,
  getTodoRemindersEnabled,
  setDailyPlanReminderTime,
  setTodoRemindersEnabled,
} from '@/core/notifications/notificationPreferences';
import { normalizeTimeOfDayInput } from '@/core/notifications/reminderPlanning';
import { syncDailyPlanReminder } from '@/core/notifications/dailyPlanReminderScheduler';
import { Card } from '@/core/ui/Card';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { ValidationError } from '@/core/ui/ValidationError';
import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { SettingsRow, SettingsSectionHeading, SettingsStatusPill } from './SettingsSharedUi';

const ACCENT = SECTION_COLORS[POMODORO_SECTION_KEY];

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
  const [permissionLabel, setPermissionLabel] = useState('Checking…');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [enabled, time, permission] = await Promise.all([
        getTodoRemindersEnabled(),
        getDailyPlanReminderTime(),
        getNotificationPermissionState(),
      ]);
      setTodoRemindersEnabledState(enabled);
      setDailyPlanTimeInput(
        `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`,
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
      await setTodoRemindersEnabled(enabled);
      setTodoRemindersEnabledState(enabled);
      await syncDailyPlanReminder();
      setSavedNote(enabled ? 'Todo reminders on.' : 'Todo reminders off.');
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
      await syncDailyPlanReminder();
      setDailyPlanTimeInput(normalized);
      setSavedNote(`Daily plan reminder saved for ${normalized}.`);
    } catch (err) {
      console.error('[SettingsNotificationsSection] save daily-plan time failed', err);
      setError('Unable to save the daily plan reminder time right now.');
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
              editable={!loading && !saving}
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
              style={{ backgroundColor: `${ACCENT}18` }}
              disabled={loading || saving}
              onPress={() => void handleSaveDailyPlanTime()}
            >
              <Text className="text-sm font-semibold" style={{ color: ACCENT }}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
            <SettingsStatusPill label="Daily" tone="accent" accentColor={ACCENT} />
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
