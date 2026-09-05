import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { deleteWeeklyReview, listWeeklyReviews } from '@/features/weekly-review/weeklyReview.data';
import type { WeeklyReview } from '@/features/weekly-review/weeklyReview.types';
import {
  parseSummaryPayload,
  parsePlanPayload,
} from '@/features/weekly-review/weeklyReview.domain';

/**
 * Browsing past weekly reviews. Expanding an entry shows the saved summary
 * insights and plan payload; a confirmed delete removes an erroneous review
 * from history and rollups (soft delete + durable delete intent — the logged
 * entities themselves are never touched).
 */
export function ReviewHistoryView() {
  const { tokens } = useAppTheme();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    const next = await listWeeklyReviews(26);
    setReviews(next);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const reviews = await listWeeklyReviews(26);
        if (active) setReviews(reviews);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = useCallback(
    async (review: WeeklyReview) => {
      const confirmed = await confirm({
        title: 'Delete weekly review',
        message: `Delete the review for ${review.week_start_date} – ${review.week_end_date}? It disappears from history and weekly rollups. Todos, habits, sessions, and entries made that week stay untouched.`,
        confirmLabel: 'Delete review',
        confirmVariant: 'danger',
      });
      if (!confirmed) return;
      setDeletingId(review.id);
      try {
        await deleteWeeklyReview(review.id);
        setExpandedId(null);
        await loadReviews();
      } finally {
        setDeletingId(null);
      }
    },
    [confirm, loadReviews],
  );

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
          <View
            key={review.id}
            className="rounded-xl border"
            style={{
              borderColor: tokens.border,
              backgroundColor: expanded ? tokens.surfaceElevated : 'transparent',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Week of ${review.week_start_date} review`}
              accessibilityState={{ expanded }}
              className="p-3"
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
                        Todos: {summary.todos.completedCount} completed ·{' '}
                        {summary.todos.overdueCount} overdue
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
            {expanded ? (
              <View className="px-3 pb-3">
                <Button
                  label={deletingId === review.id ? 'Deleting…' : 'Delete review'}
                  accessibilityLabel={`Delete review for week ${review.week_start_date}`}
                  variant="danger"
                  disabled={deletingId !== null}
                  onPress={() => void handleDelete(review)}
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
