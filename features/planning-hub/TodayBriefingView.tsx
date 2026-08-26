import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import {
  buildTodayBriefing,
  type TodayBriefing,
} from '@/features/planning-hub/planningHub.briefing';

function BriefingStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const { tokens } = useAppTheme();
  return (
    <View
      className="min-w-[45%] flex-1 rounded-xl border p-3"
      style={{ borderColor: tokens.border }}
    >
      <Text className="text-xs" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
      <Text
        className="text-lg font-bold"
        style={{ color: warn ? (tokens.warningText ?? '#d97706') : tokens.text }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Cross-surface briefing shown at the top of the Planning Hub Today tab.
 * Read-only; pull-to-refresh via the refresh button.
 */
export function TodayBriefingView() {
  const { tokens } = useAppTheme();
  const [briefing, setBriefing] = useState<TodayBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBriefing(await buildTodayBriefing());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load briefing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const briefing = await buildTodayBriefing();
        if (active) setBriefing(briefing);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load briefing');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading && !briefing) {
    return (
      <Text className="py-2 text-sm" style={{ color: tokens.textMuted }}>
        Loading today&apos;s briefing…
      </Text>
    );
  }

  if (error || !briefing) {
    return (
      <Card>
        <Text className="py-2 text-sm" style={{ color: tokens.dangerText }}>
          {error ?? 'Failed to load briefing'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry briefing"
          onPress={() => void refresh()}
          className="self-start rounded-full border px-3 py-1"
          style={{ borderColor: tokens.border }}
        >
          <Text className="text-sm" style={{ color: tokens.text }}>
            Retry
          </Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-bold" style={{ color: tokens.text }}>
          Today&apos;s briefing
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh briefing"
          onPress={() => void refresh()}
          disabled={loading}
          className="rounded-full border px-3 py-1"
          style={{ borderColor: tokens.border }}
        >
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            {loading ? '…' : 'Refresh'}
          </Text>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <BriefingStat
          label="Overdue todos"
          value={String(briefing.overdueTodoCount)}
          warn={briefing.overdueTodoCount > 0}
        />
        <BriefingStat label="Due today" value={String(briefing.dueTodayTodoCount)} />
        <BriefingStat
          label="Plan progress"
          value={
            briefing.planProgress
              ? `${briefing.planProgress.done}/${briefing.planProgress.total}`
              : 'No plan yet'
          }
        />
        <BriefingStat
          label="Projects · Goals"
          value={`${briefing.activeProjectCount} · ${briefing.activeGoalCount}`}
        />
        <BriefingStat label="Yesterday focus" value={`${briefing.yesterdayFocusMinutes} min`} />
      </View>
    </View>
  );
}
