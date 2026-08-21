import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
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
} from './habits.domain';
import { GitHubHeatmap } from '@/features/shared/GitHubHeatmap';
import { toDateKey } from '@/lib/time';

type Props = {
  habit: Habit | null;
  onClose: () => void;
  onOpenInsights?: (habit: Habit) => void;
  /** Current local lifecycle state of the habit (device-local preference). */
  lifecycleState?: 'active' | 'paused' | 'archived';
  onTogglePause?: () => void;
  onToggleArchive?: () => void;
};

/**
 * Per-habit history surface: completion heatmap plus current/best streak and
 * 30-day consistency. Read-only; all computation is delegated to the pure
 * domain helpers in habits.domain.ts.
 */
export function HabitDetailModal({
  habit,
  onClose,
  onOpenInsights,
  lifecycleState = 'active',
  onTogglePause,
  onToggleArchive,
}: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const [completions, setCompletions] = useState<HabitCompletionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!habit) {
      setCompletions([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    loadCompletions(habit.id)
      .then((rows) => {
        if (!cancelled) {
          setCompletions(rows);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [habit]);

  const stats = useMemo(() => {
    if (!habit) return null;
    const todayKey = toDateKey();
    const dayCompletions = buildDayCompletions(
      completions.map((row) => ({ date_key: row.date_key, count: row.count })),
      habit.target_per_day,
      undefined,
      habit.rule_history,
      undefined,
      todayKey,
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

  return (
    <Modal visible onClose={onClose} title={`${habit.name} history`} scroll>
      {!loaded ? (
        <Card accentColor={accent}>
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            Loading history...
          </Text>
        </Card>
      ) : !stats ? (
        <EmptyStateCard accentColor={accent} title="No history available" />
      ) : (
        <>
          <Card accentColor={accent}>
            <View className="flex-row flex-wrap gap-3">
              <StatBlock
                accentColor={accent}
                className="min-w-[100px] flex-1"
                icon={<Text style={{ fontSize: 20 }}>🔥</Text>}
                value={stats.currentStreak}
                label="Current streak"
                detail="days"
              />
              <StatBlock
                accentColor={accent}
                className="min-w-[100px] flex-1"
                icon={<Text style={{ fontSize: 20 }}>🏆</Text>}
                value={stats.bestStreak}
                label="Best streak"
                detail="days"
              />
              <StatBlock
                accentColor={accent}
                className="min-w-[100px] flex-1"
                icon={<Text style={{ fontSize: 20 }}>📊</Text>}
                value={`${stats.consistency30}%`}
                label="Last 30 days"
                detail="consistency"
              />
            </View>
          </Card>
          <Card accentColor={accent}>
            <View className="mb-2 flex-row items-center gap-2">
              <MaterialIcons name="calendar-month" size={18} color={accent} />
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                Completion calendar
              </Text>
            </View>
            <GitHubHeatmap days={stats.heatmapDays} color={accent} label="Habit history" />
          </Card>
          {onOpenInsights ? (
            <Button
              label="Open detailed insights"
              variant="ghost"
              onPress={() => onOpenInsights(habit)}
            />
          ) : null}
          {onTogglePause || onToggleArchive ? (
            <Card accentColor={accent}>
              <Text className="mb-2 text-sm font-semibold" style={{ color: tokens.text }}>
                Lifecycle
              </Text>
              <Text className="mb-3 text-xs" style={{ color: tokens.textMuted }}>
                Paused habits keep their history but are hidden from the active list. Archived
                habits are kept out of sight until restored. These states are stored on this device.
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
