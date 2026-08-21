import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { listWeeklyReviews } from '@/features/weekly-review/weeklyReview.data';
import {
  parseSummaryPayload,
  parsePlanPayload,
} from '@/features/weekly-review/weeklyReview.domain';

/**
 * Read-only browsing of past weekly reviews. Expanding an entry shows the
 * saved summary insights and plan payload; nothing here mutates data.
 */
export function ReviewHistoryView() {
  const { tokens } = useAppTheme();
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof listWeeklyReviews>>>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setReviews(await listWeeklyReviews(26));
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
        Loading past reviews…
      </Text>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <Text className="py-3 text-center text-sm" style={{ color: tokens.textMuted }}>
          No past reviews yet. Complete this week&apos;s review to start your history.
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-2">
      {reviews.map((review) => {
        const expanded = expandedId === review.id;
        const summary = expanded ? parseSummaryPayload(review.summary_payload) : null;
        const plan = expanded ? parsePlanPayload(review.plan_payload) : null;
        return (
          <Pressable
            key={review.id}
            accessibilityRole="button"
            accessibilityLabel={`Week of ${review.week_start_date} review`}
            accessibilityState={{ expanded }}
            className="rounded-xl border p-3"
            style={{
              borderColor: tokens.border,
              backgroundColor: expanded ? tokens.surfaceElevated : 'transparent',
            }}
            onPress={() => setExpandedId(expanded ? null : review.id)}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-medium" style={{ color: tokens.text }}>
                {review.week_start_date} – {review.week_end_date}
              </Text>
              <Text className="text-xs" style={{ color: tokens.textMuted }}>
                {review.status === 'completed' ? 'Completed' : 'Draft'}
              </Text>
            </View>
            {expanded && (
              <View className="mt-2 gap-1">
                {summary ? (
                  <>
                    <Text className="text-sm" style={{ color: tokens.textMuted }}>
                      Todos: {summary.todos.completedCount} completed · {summary.todos.overdueCount}{' '}
                      overdue
                    </Text>
                    <Text className="text-sm" style={{ color: tokens.textMuted }}>
                      Focus: {summary.focus.minutes} min in {summary.focus.sessions} sessions
                    </Text>
                    {summary.wins.slice(0, 3).map((w, i) => (
                      <Text key={`w-${i}`} className="text-sm" style={{ color: tokens.text }}>
                        ✓ {w.message}
                      </Text>
                    ))}
                  </>
                ) : null}
                {plan && plan.priorities.length > 0 ? (
                  <View className="mt-1">
                    {plan.priorities.map((p, i) => (
                      <Text key={p.id} className="text-sm" style={{ color: tokens.text }}>
                        {i + 1}. {p.text}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {review.reflection ? (
                  <Text className="mt-1 text-sm italic" style={{ color: tokens.textMuted }}>
                    {review.reflection}
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
