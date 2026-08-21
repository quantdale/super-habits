import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { listRecentDailyPlans } from '@/features/daily-plan/dailyPlan.data';
import { parseTopTodoIds, parseTopTodoTitles } from '@/features/daily-plan/dailyPlan.domain';
import { DAILY_PLAN_STATUS_LABELS } from '@/features/daily-plan/dailyPlan.types';
import { listPendingTodos } from '@/features/todos/todos.data';
import type { DailyPlan } from '@/core/db/types';

type PlanHistoryEntry = DailyPlan & { todoTitles: string[] };

/**
 * Read-only browsing of previous days' plans plus a simple adherence
 * streak summary. Selecting an entry expands its detail inline; nothing
 * here mutates data.
 */
export function DailyPlanHistoryView() {
  const { tokens } = useAppTheme();
  const [entries, setEntries] = useState<PlanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [plans, todos] = await Promise.all([listRecentDailyPlans(30), listPendingTodos()]);
      const titleById = new Map(todos.map((t) => [t.id, t.title] as const));
      setEntries(
        plans.map((p) => {
          // Save-time snapshot first (survives deletion), live lookup second;
          // '(removed)' remains the last resort for snapshot-less rows.
          const snapshotTitles = parseTopTodoTitles(p.top_todo_titles);
          return {
            ...p,
            todoTitles: parseTopTodoIds(p.top_todo_ids).map(
              (id, i) => snapshotTitles[i] || titleById.get(id) || '(removed)',
            ),
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <Text className="py-4 text-sm" style={{ color: tokens.textMuted }}>
        Loading plan history…
      </Text>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <Text className="py-3 text-center text-sm" style={{ color: tokens.textMuted }}>
          No past plans yet. Save today&apos;s plan to start your history.
        </Text>
      </Card>
    );
  }

  const committedDays = entries.filter(
    (e) => e.status === 'committed' || e.status === 'completed',
  ).length;
  const completedDays = entries.filter((e) => e.status === 'completed').length;

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <Card className="flex-1">
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            Committed (last 30d)
          </Text>
          <Text className="text-xl font-bold" style={{ color: tokens.text }}>
            {committedDays}
          </Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            Completed (last 30d)
          </Text>
          <Text className="text-xl font-bold" style={{ color: tokens.text }}>
            {completedDays}
          </Text>
        </Card>
      </View>

      {entries.map((entry) => {
        const expanded = expandedId === entry.id;
        return (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            accessibilityLabel={`Plan for ${entry.date_key}, ${DAILY_PLAN_STATUS_LABELS[entry.status]}`}
            accessibilityState={{ expanded }}
            className="rounded-xl border p-3"
            style={{
              borderColor: tokens.border,
              backgroundColor: expanded ? tokens.surfaceElevated : 'transparent',
            }}
            onPress={() => setExpandedId(expanded ? null : entry.id)}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-medium" style={{ color: tokens.text }}>
                {entry.date_key}
              </Text>
              <Text className="text-xs" style={{ color: tokens.textMuted }}>
                {DAILY_PLAN_STATUS_LABELS[entry.status]}
              </Text>
            </View>
            {expanded && (
              <View className="mt-2 gap-1">
                {entry.intention ? (
                  <Text className="text-sm italic" style={{ color: tokens.textMuted }}>
                    &ldquo;{entry.intention}&rdquo;
                  </Text>
                ) : null}
                {entry.todoTitles.length > 0 ? (
                  entry.todoTitles.map((title, i) => (
                    <Text
                      key={`${entry.id}-${i}`}
                      className="text-sm"
                      style={{ color: tokens.text }}
                    >
                      • {title}
                    </Text>
                  ))
                ) : (
                  <Text className="text-sm" style={{ color: tokens.textMuted }}>
                    No priorities recorded.
                  </Text>
                )}
                {entry.focus_target_minutes > 0 ? (
                  <Text className="text-sm" style={{ color: tokens.textMuted }}>
                    Focus target: {entry.focus_target_minutes} min
                  </Text>
                ) : null}
                {entry.energy_score !== null ? (
                  <Text className="text-sm" style={{ color: tokens.textMuted }}>
                    Energy: {entry.energy_score}/5
                  </Text>
                ) : null}
                {entry.reflection ? (
                  <Text className="mt-1 text-sm" style={{ color: tokens.text }}>
                    {entry.reflection}
                  </Text>
                ) : null}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
