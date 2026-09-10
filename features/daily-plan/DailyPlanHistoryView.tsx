import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { listRecentDailyPlans, softDeleteDailyPlan } from '@/features/daily-plan/dailyPlan.data';
import { parseTopTodoIds, parseTopTodoTitles } from '@/features/daily-plan/dailyPlan.domain';
import { DAILY_PLAN_STATUS_LABELS } from '@/features/daily-plan/dailyPlan.types';
import { listPendingTodos } from '@/features/todos/todos.data';
import type { DailyPlan } from '@/core/db/types';

type PlanHistoryEntry = DailyPlan & { todoTitles: string[] };

/**
 * Browsing of previous days' plans plus a simple adherence streak summary.
 * Selecting an entry expands its detail inline; a confirmed danger delete
 * soft-deletes an erroneous plan with a durable delete intent (todos and
 * completions are never touched) and notifies the parent editor so a deleted
 * today-plan cannot linger in the form.
 */
export function DailyPlanHistoryView({ onPlanDeleted }: { onPlanDeleted?: () => void }) {
  const { tokens } = useAppTheme();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [entries, setEntries] = useState<PlanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const buildEntries = useCallback(async (): Promise<PlanHistoryEntry[]> => {
    const [plans, todos] = await Promise.all([listRecentDailyPlans(30), listPendingTodos()]);
    const titleById = new Map(todos.map((t) => [t.id, t.title] as const));
    return plans.map((p) => {
      // Save-time snapshot first (survives deletion), live lookup second;
      // '(removed)' remains the last resort for snapshot-less rows.
      const snapshotTitles = parseTopTodoTitles(p.top_todo_titles);
      return {
        ...p,
        todoTitles: parseTopTodoIds(p.top_todo_ids).map(
          (id, i) => snapshotTitles[i] || titleById.get(id) || '(removed)',
        ),
      };
    });
  }, []);

  const loadEntries = useCallback(async () => {
    setEntries(await buildEntries());
  }, [buildEntries]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await buildEntries();
        if (active) setEntries(next);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [buildEntries]);

  const handleDelete = useCallback(
    async (entry: PlanHistoryEntry) => {
      const confirmed = await confirm({
        title: 'Delete daily plan',
        message: `Delete the plan for ${entry.date_key}? It disappears from plan history and adherence. Tasks and completions are not touched.`,
        confirmLabel: 'Delete plan',
        confirmVariant: 'danger',
      });
      if (!confirmed) return;
      setDeletingId(entry.id);
      try {
        await softDeleteDailyPlan(entry.id);
        setExpandedId(null);
        await loadEntries();
        onPlanDeleted?.();
      } finally {
        setDeletingId(null);
      }
    },
    [confirm, loadEntries, onPlanDeleted],
  );

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
          <View
            key={entry.id}
            className="rounded-xl border"
            style={{
              borderColor: tokens.border,
              backgroundColor: expanded ? tokens.surfaceElevated : 'transparent',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Plan for ${entry.date_key}, ${DAILY_PLAN_STATUS_LABELS[entry.status]}`}
              accessibilityState={{ expanded }}
              className="p-3"
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
            {expanded ? (
              <View className="px-3 pb-3">
                <Button
                  label={deletingId === entry.id ? 'Deleting…' : 'Delete plan'}
                  accessibilityLabel={`Delete plan for ${entry.date_key}`}
                  variant="danger"
                  disabled={deletingId !== null}
                  onPress={() => void handleDelete(entry)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
      {confirmationDialog}
    </View>
  );
}
