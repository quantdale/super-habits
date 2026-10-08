import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { Modal } from '@/core/ui/Modal';
import { Button } from '@/core/ui/Button';
import { SegmentedControl } from '@/core/ui/SegmentedControl';
import { useAppTheme } from '@/core/providers/themeContext';
import type { Habit } from './types';
import {
  buildDayCompletions,
  formatHabitSchedule,
  getHabitRuleForDate,
  habitCreationDateKey,
} from './habits.domain';
import { calculateHabitProgressInsights } from './habitInsights.domain';
import type { HabitCheckInRowModel } from './habitCheckIn.domain';
import { formatHabitCheckInDatePhrase } from './habitCheckIn.domain';
import { HabitProgressInsightsContent } from './HabitProgressInsightsModal';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';

type Props = {
  habit: Habit | null;
  row: HabitCheckInRowModel | null;
  countsByDate: Readonly<Record<string, number>>;
  selectedDateKey: string;
  todayKey: string;
  busy?: boolean;
  /** Suspend the web portal while destructive confirmation owns the overlay. */
  visible?: boolean;
  checkInError?: string | null;
  onClose: () => void;
  onTogglePause: () => void;
  onToggleArchive: () => void;
  onEdit: (habit: Habit) => void;
  onDelete: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
};

type DetailSection = 'today' | 'progress' | 'settings';

/** One detail surface, derived from the same refreshed snapshot as the list. */
export function HabitDetailModal({
  habit,
  row,
  countsByDate,
  selectedDateKey,
  todayKey,
  busy = false,
  visible = true,
  checkInError,
  onClose,
  onTogglePause,
  onToggleArchive,
  onEdit,
  onDelete,
  onIncrement,
  onDecrement,
}: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const [section, setSection] = useState<DetailSection>('today');
  const history = useMemo(() => {
    if (!habit) return null;
    const completions = Object.entries(countsByDate).map(([date_key, count]) => ({
      date_key,
      count,
    }));
    const insights = calculateHabitProgressInsights(habit, completions, todayKey);
    const days = buildDayCompletions(
      completions,
      habit.target_per_day,
      undefined,
      habit.rule_history,
      habitCreationDateKey(habit.created_at),
      todayKey,
      habit.lifecycle_history,
    );
    return {
      insights,
      heatmapDays: days.slice(-364).map((day) => ({
        dateKey: day.dateKey,
        value: !day.eligible ? 0 : day.completed ? 3 : day.count > 0 ? 2 : 0,
      })),
    };
  }, [habit, countsByDate, todayKey]);

  if (!habit || !row) return null;
  const accent = sectionAccents.habits.text;
  const lifecycleState = habit.status ?? 'active';
  const phrase = formatHabitCheckInDatePhrase(selectedDateKey, todayKey);
  const todayRule = getHabitRuleForDate(
    habit.rule_history,
    todayKey,
    habit.target_per_day,
    habitCreationDateKey(habit.created_at),
  );
  const blockedReason = row.actionable ? null : row.actionLabel.replace(`${row.name}: `, '');

  return (
    <Modal visible={visible} onClose={onClose} title={habit.name} scroll>
      <SegmentedControl
        options={[
          { value: 'today', label: 'Today' },
          { value: 'progress', label: 'Progress' },
          { value: 'settings', label: 'Settings' },
        ]}
        value={section}
        onChange={setSection}
        accentColor={accent}
        accessibilityLabel="Habit detail sections"
      />
      <View className="mt-4 gap-4">
        {checkInError ? (
          <Text accessibilityRole="alert" variant="bodyMd" style={{ color: tokens.dangerText }}>
            {checkInError}
          </Text>
        ) : null}
        {section === 'today' ? (
          <>
            <View accessible accessibilityLabel={row.actionLabel} className="gap-1">
              <Text variant="titleMd">Check-in {phrase}</Text>
              <Text variant="bodyLg">
                {row.count} of {row.target}
                {row.state === 'complete' ? ' · Complete' : ''}
              </Text>
              <Text variant="caption" tone="muted">
                {blockedReason ?? row.scheduleLabel}
              </Text>
              {row.reminderLabel ? (
                <Text variant="caption" tone="muted">
                  Reminder {row.reminderLabel}
                </Text>
              ) : null}
            </View>
            <View className="gap-2">
              <Button
                label={
                  row.quantitative
                    ? `Add one ${phrase}`
                    : row.state === 'complete'
                      ? `Undo check-in ${phrase}`
                      : `Check in ${phrase}`
                }
                onPress={!row.quantitative && row.state === 'complete' ? onDecrement : onIncrement}
                disabled={!row.actionable || busy}
                color={accent}
              />
              {row.quantitative ? (
                <>
                  <Button
                    label={`Remove one ${phrase}`}
                    variant="ghost"
                    onPress={onDecrement}
                    disabled={!row.actionable || busy || row.count <= 0}
                  />
                  {row.count <= 0 ? (
                    <Text variant="caption" tone="muted">
                      Nothing to remove yet.
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
            {history?.insights ? (
              <Text variant="caption" tone="muted">
                Current streak: {history.insights.currentStreak} scheduled occurrences. Open
                Progress for history and consistency.
              </Text>
            ) : null}
          </>
        ) : section === 'progress' ? (
          history?.insights ? (
            <>
              <View className="gap-2">
                <Text variant="titleMd">Completion calendar</Text>
                <GitHubHeatmap days={history.heatmapDays} color={accent} label="Habit history" />
              </View>
              <HabitProgressInsightsContent insights={history.insights} />
            </>
          ) : (
            <Text variant="bodyMd" tone="muted">
              No eligible history yet.
            </Text>
          )
        ) : (
          <>
            <View className="gap-1">
              <Text variant="titleMd">Schedule & reminder</Text>
              <Text variant="bodyMd">
                {todayRule ? formatHabitSchedule(todayRule.weekdays) : 'Not scheduled'}
              </Text>
              <Text variant="caption" tone="muted">
                Current schedule ·{' '}
                {row.reminderLabel ? `Reminder ${row.reminderLabel}` : 'No reminder set'}
              </Text>
            </View>
            <Button label="Edit habit" variant="ghost" onPress={() => onEdit(habit)} />
            <View className="gap-2">
              <Text variant="titleMd">Lifecycle</Text>
              <Text variant="caption" tone="muted">
                Paused and archived habits keep their history and backup. Check-ins on those dates
                stay unavailable.
              </Text>
              {lifecycleState !== 'archived' ? (
                <Button
                  label={lifecycleState === 'paused' ? 'Resume' : 'Pause'}
                  variant="ghost"
                  onPress={onTogglePause}
                />
              ) : null}
              <Button
                label={lifecycleState === 'archived' ? 'Restore' : 'Archive'}
                variant="ghost"
                onPress={onToggleArchive}
              />
            </View>
            <View className="border-t pt-4" style={{ borderColor: tokens.border }}>
              <Button label={`Delete ${habit.name}`} variant="ghost" onPress={onDelete} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
