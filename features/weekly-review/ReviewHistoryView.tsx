import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { ValidationError } from '@/core/ui/ValidationError';
import { radius, spacing } from '@/core/theme/designTokens';
import { deleteWeeklyReview, listWeeklyReviews } from '@/features/weekly-review/weeklyReview.data';
import type { WeeklyReview } from '@/features/weekly-review/weeklyReview.types';
import {
  parseSummaryPayload,
  parsePlanPayload,
} from '@/features/weekly-review/weeklyReview.domain';
import { planningRowVisual } from '@/features/planning-hub/planningHub.visual';

/**
 * Browsing past weekly reviews. Expanding an entry shows the saved summary
 * insights and plan payload; a confirmed delete removes an erroneous review
 * from history and rollups (soft delete + durable delete intent — the logged
 * entities themselves are never touched).
 *
 * v2 P21 part A: each entry is one `depth.card` surface (2px ring + 4px
 * `borderStrong` lip) whose whole header is the expand target; the expanded
 * body sits on the same face with a hairline divider so no card nests inside a
 * card. The `Week of … review` accessible name and the expanded `Delete review
 * for week …` control are unchanged.
 */
export function ReviewHistoryView() {
  const { tokens, resolvedTheme } = useAppTheme();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      setDeleteError(null);
      try {
        await deleteWeeklyReview(review.id);
        setExpandedId(null);
        await loadReviews();
      } catch (e) {
        // A rejected delete keeps the history row and the retriable button;
        // the failure surfaces with the review's own message when present.
        setDeleteError(
          e instanceof Error && e.message
            ? e.message
            : 'Could not delete the review. Please try again.',
        );
      } finally {
        setDeletingId(null);
      }
    },
    [confirm, loadReviews],
  );

  if (loading) {
    return (
      <Text variant="bodyMd" tone="muted" style={{ paddingVertical: spacing.lg }}>
        Loading past reviews…
      </Text>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <Text
          variant="bodyMd"
          tone="muted"
          style={{ textAlign: 'center', paddingVertical: spacing.md }}
        >
          No past reviews yet. Complete this week&apos;s review to start your history.
        </Text>
      </Card>
    );
  }

  const row = planningRowVisual({
    tone: 'sky',
    selected: false,
    appearance: resolvedTheme,
    surface: tokens.surface,
    border: tokens.border,
    borderStrong: tokens.borderStrong,
    text: tokens.text,
    textMuted: tokens.textMuted,
  });

  return (
    <View style={{ gap: spacing.sm }}>
      {deleteError ? <ValidationError message={deleteError} /> : null}
      {reviews.map((review) => {
        const expanded = expandedId === review.id;
        const summary = expanded ? parseSummaryPayload(review.summary_payload) : null;
        const plan = expanded ? parsePlanPayload(review.plan_payload) : null;
        return (
          <View
            key={review.id}
            style={{
              borderRadius: radius.lg,
              backgroundColor: row.face,
              borderWidth: 2,
              borderColor: row.border,
              borderBottomWidth: 4,
              borderBottomColor: row.lip,
              overflow: 'hidden',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Week of ${review.week_start_date} review`}
              accessibilityState={{ expanded }}
              aria-expanded={expanded}
              onPress={() => setExpandedId(expanded ? null : review.id)}
              style={{ minHeight: 52, padding: spacing.md, gap: spacing.xs }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <MaterialIcons
                  name={expanded ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={row.mark}
                />
                <Text
                  variant="bodyMd"
                  style={{ color: row.ink, fontWeight: '700', flex: 1 }}
                  numberOfLines={1}
                >
                  {review.week_start_date} – {review.week_end_date}
                </Text>
                <Text
                  variant="label"
                  style={{ color: review.status === 'completed' ? row.ink : tokens.textMuted }}
                >
                  {review.status === 'completed' ? 'Completed' : 'Draft'}
                </Text>
              </View>
              {expanded && (
                <View
                  style={{
                    marginTop: spacing.sm,
                    paddingTop: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: tokens.border,
                    gap: spacing.xs,
                  }}
                >
                  {summary ? (
                    <>
                      <Text variant="caption" tone="muted">
                        Todos: {summary.todos.completedCount} completed ·{' '}
                        {summary.todos.overdueCount} overdue
                      </Text>
                      <Text variant="caption" tone="muted">
                        Focus: {summary.focus.minutes} min in {summary.focus.sessions} sessions
                      </Text>
                      {summary.wins.slice(0, 3).map((w, i) => (
                        <View
                          key={`w-${i}`}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                        >
                          <MaterialIcons name="check" size={14} color={tokens.successText} />
                          <Text variant="bodyMd" style={{ color: tokens.text, flex: 1 }}>
                            {w.message}
                          </Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                  {plan && plan.priorities.length > 0 ? (
                    <View style={{ marginTop: spacing.xs, gap: 2 }}>
                      {plan.priorities.map((p, i) => (
                        <Text key={p.id} variant="bodyMd" style={{ color: tokens.text }}>
                          {i + 1}. {p.text}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {review.reflection ? (
                    <Text
                      variant="bodyMd"
                      tone="muted"
                      style={{ marginTop: spacing.xs, fontStyle: 'italic' }}
                    >
                      {review.reflection}
                    </Text>
                  ) : null}
                </View>
              )}
            </Pressable>
            {expanded ? (
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                <Button
                  label={deletingId === review.id ? 'Deleting…' : 'Delete review'}
                  accessibilityLabel={`Delete review for week ${review.week_start_date}`}
                  variant="danger"
                  icon="delete-outline"
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
