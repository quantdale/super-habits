import { Text } from '@/core/ui/Text';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Modal } from '@/core/ui/Modal';
import { Card } from '@/core/ui/Card';
import { StatBlock } from '@/core/ui/StatBlock';
import { Button } from '@/core/ui/Button';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { useAppTheme } from '@/core/providers/themeContext';
import type { Habit } from './types';
import { getCompletionHistory, type HabitCompletionRow } from './habits.data';
import {
  buildDayCompletions,
  calculateCurrentStreak,
  calculateLongestStreak,
  formatHabitSchedule,
  getHabitRuleForDate,
  habitCreationDateKey,
} from './habits.domain';
import {
  formatHabitReminderTime,
  parseHabitReminderTime,
} from '@/features/habits/habitReminders.domain';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { toDateKey } from '@/lib/time';

type Props = {
  habit: Habit | null;
  onClose: () => void;
  onOpenInsights?: (habit: Habit) => void;
  onTogglePause?: () => void;
  onToggleArchive?: () => void;
  /** Opens the existing edit flow for this habit (wired by HabitsScreen). */
  onEdit?: (habit: Habit) => void;
};

/**
 * Per-habit history surface: completion heatmap plus current/best streak and
 * 30-day consistency. Read-only; all computation is delegated to the pure
 * domain helpers in habits.domain.ts. Lifecycle state comes from the durable
 * row (`habits.status`, migration 20).
 */
export function HabitDetailModal({
  habit,
  onClose,
  onOpenInsights,
  onTogglePause,
  onToggleArchive,
  onEdit,
}: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const [completions, setCompletions] = useState<HabitCompletionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!habit) {
        setCompletions([]);
        setLoaded(false);
        return;
      }
      setLoaded(false);
      try {
        const rows = await loadCompletions(habit.id);
        if (!cancelled) {
          setCompletions(rows);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [habit]);

  const lifecycleState = habit?.status ?? 'active';

  const stats = useMemo(() => {
    if (!habit) return null;
    const todayKey = toDateKey();
    const dayCompletions = buildDayCompletions(
      completions.map((row) => ({ date_key: row.date_key, count: row.count })),
      habit.target_per_day,
      undefined,
      habit.rule_history,
      habitCreationDateKey(habit.created_at),
      todayKey,
      habit.lifecycle_history,
    );
    const currentStreak = calculateCurrentStreak(dayCompletions, todayKey);
    const bestStreak = calculateLongestStreak(dayCompletions);
    const last30 = dayCompletions.slice(-30).filter((day) => day.eligible);
    const completed30 = last30.filter((day) => day.completed).length;
    const consistency30 = last30.length === 0 ? 0 : Math.round((completed30 / last30.length) * 100);
    const heatmapDays = dayCompletions.slice(-364).map((day) => ({
      dateKey: day.dateKey,
      value: day.completed ? 3 : day.count > 0 ? 2 : 0,
    }));
    return { currentStreak, bestStreak, consistency30, heatmapDays, totalCompleted: completed30 };
  }, [habit, completions]);

  if (!habit) return null;
  const accent = habit.color || sectionAccents.habits.text;

  // Schedule as of today: the rule active on the current local date drives
  // both the label and whether a reminder line applies.
  const todayRule = getHabitRuleForDate(
    habit.rule_history,
    toDateKey(),
    habit.target_per_day,
    habitCreationDateKey(habit.created_at),
  );
  const scheduleLine = todayRule
    ? { label: formatHabitSchedule(todayRule.weekdays) }
    : { label: 'Not scheduled' };
  const parsedReminderTime = parseHabitReminderTime(habit.reminder_time);
  const reminderLabel = parsedReminderTime ? formatHabitReminderTime(parsedReminderTime) : null;

  return (
    <Modal visible onClose={onClose} title={`${habit.name} history`} scroll>
      {!loaded ? (
        <Card accentColor={accent}>
          <Text variant="bodyMd" tone="muted">
            Loading history...
          </Text>
        </Card>
      ) : !stats ? (
        <EmptyStateCard accentColor={accent} title="No history available" />
      ) : (
        <>
          <Card
            variant="header"
            accentColor={accent}
            headerTitle="Streaks & consistency"
            headerSubtitle="How this habit is trending right now"
          >
            <View className="flex-row flex-wrap gap-3">
              <StatBlock
                accentColor={accent}
                className="min-w-[100px] flex-1"
                icon={<MaterialIcons name="local-fire-department" size={20} color={accent} />}
                value={stats.currentStreak}
                label="Current streak"
                detail="days"
              />
              <StatBlock
                accentColor={accent}
                className="min-w-[100px] flex-1"
                icon={<MaterialIcons name="emoji-events" size={20} color={accent} />}
                value={stats.bestStreak}
                label="Best streak"
                detail="days"
              />
              <StatBlock
                accentColor={accent}
                className="min-w-[100px] flex-1"
                icon={<MaterialIcons name="insights" size={20} color={accent} />}
                value={`${stats.consistency30}%`}
                label="Last 30 days"
                detail="consistency"
              />
            </View>
          </Card>
          <Card
            variant="header"
            accentColor={accent}
            headerTitle="Schedule"
            headerRight={<MaterialIcons name="event-repeat" size={22} color={tokens.onSolid} />}
          >
            <Text variant="titleMd" style={{ color: tokens.text }}>
              {scheduleLine.label}
            </Text>
            {reminderLabel ? (
              <View
                className="mt-1.5 flex-row items-center gap-1.5"
                accessible
                accessibilityLabel={`Reminder at ${reminderLabel}`}
              >
                <MaterialIcons name="notifications-none" size={16} color={accent} />
                <Text variant="bodyMd" style={{ color: tokens.text }}>
                  {reminderLabel}
                </Text>
              </View>
            ) : (
              <Text variant="caption" tone="muted" className="mt-1">
                No reminder set.
              </Text>
            )}
          </Card>
          <Card
            variant="header"
            accentColor={accent}
            headerTitle="Completion calendar"
            headerRight={<MaterialIcons name="calendar-month" size={22} color={tokens.onSolid} />}
          >
            <GitHubHeatmap
              days={stats.heatmapDays}
              color={SECTION_COLORS.habits}
              label="Habit history"
            />
          </Card>
          {onOpenInsights ? (
            <Button
              label="Open detailed insights"
              variant="ghost"
              onPress={() => onOpenInsights(habit)}
            />
          ) : null}
          {onEdit ? (
            <Button label="Edit habit" color={accent} onPress={() => onEdit(habit)} />
          ) : null}
          {onTogglePause || onToggleArchive ? (
            <Card variant="header" accentColor={accent} headerTitle="Lifecycle">
              <Text variant="caption" tone="muted" className="mb-3">
                Paused habits keep their history but are hidden from the active list. Archived
                habits are kept out of sight until restored. This state is saved with your backup.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {onTogglePause ? (
                  <Button
                    label={lifecycleState === 'paused' ? 'Resume' : 'Pause'}
                    variant={lifecycleState === 'paused' ? 'primary' : 'ghost'}
                    onPress={onTogglePause}
                  />
                ) : null}
                {onToggleArchive ? (
                  <Button
                    label={lifecycleState === 'archived' ? 'Restore' : 'Archive'}
                    variant={lifecycleState === 'archived' ? 'primary' : 'ghost'}
                    onPress={onToggleArchive}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}
        </>
      )}
    </Modal>
  );
}

async function loadCompletions(habitId: string): Promise<HabitCompletionRow[]> {
  const rows = await getCompletionHistory(habitId);
  return rows.map((row) => ({ habit_id: row.habit_id, date_key: row.date_key, count: row.count }));
}
