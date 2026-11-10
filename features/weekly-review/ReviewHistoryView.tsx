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
import { describePlanningWriteError } from '@/features/planning-hub/planningWriteError';

/** Curated read-failure copy (never the raw engine message). */
const HISTORY_LOAD_ERROR = 'Could not load past reviews. Try again.';

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
  // A rejected READ is its own state: it must never fall through to the empty
  // state, which would tell the user their review history is gone.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadReviews = useCallback(async () => {
    const next = await listWeeklyReviews(26);
    setReviews(next);
    // A successful read invalidates any read-failure notice still on screen.
    setLoadError(null);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const reviews = await listWeeklyReviews(26);
        if (active) setReviews(reviews);
      } catch {
        // A rejected initial read stays visible and retriable instead of
        // becoming an unhandled rejection behind a false "no reviews" state.
        if (active) setLoadError(HISTORY_LOAD_ERROR);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleRetryLoad = useCallback(async () => {
    setRetrying(true);
    // The failure surface stays mounted for the whole retry: clearing the error
    // here would leave an empty `reviews` list with no error, which renders as
    // the false claim "No past reviews yet" until the read settles.
    try {
      const next = await listWeeklyReviews(26);
      setReviews(next);
      setLoadError(null);
    } catch {
      setLoadError(HISTORY_LOAD_ERROR);
    } finally {
      setRetrying(false);
    }
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
      } catch (e) {
        // A rejected delete keeps the history row and the retriable button.
        // The copy goes through the shared planning helper so a storage/engine
        // failure ('Error finalizing statement') is reported in a sentence the
        // user can act on instead of leaking raw SQLite noise.
        setDeleteError(
          describePlanningWriteError(e, 'Could not delete the review. Please try again.'),
        );
        return;
      } finally {
        setDeletingId(null);
      }

      // The delete committed: drop the row locally so the list can never show a
      // review the database no longer has, then re-read for the rest.
      setExpandedId(null);
      setReviews((current) => current.filter((item) => item.id !== review.id));
      try {
        await loadReviews();
      } catch {
        // The local removal above already matches the committed state, so a
        // failed re-read must never be reported as a failed delete.
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

  // The failure surface REPLACES the empty state: rendering both would claim
  // the user has no reviews at the same moment the read failed (or while its
  // retry is still in flight). Only a SUCCESSFUL read clears the notice.
  if ((loadError || retrying) && reviews.length === 0) {
    return (
      <Card>
        <View style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
          {loadError ? <ValidationError message={loadError} /> : null}
          <Button
            label="Retry loading past reviews"
            variant="ghost"
            loading={retrying}
            onPress={() => void handleRetryLoad()}
          />
        </View>
      </Card>
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
      {/* A failed refresh keeps every review already on screen; only the error
          is added, so a rejected re-read can never blank the list. */}
      {loadError ? (
        <View style={{ gap: spacing.sm }}>
          <ValidationError message={loadError} />
          <Button
            label="Retry loading past reviews"
            variant="ghost"
            loading={retrying}
            onPress={() => void handleRetryLoad()}
          />
        </View>
      ) : null}
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
