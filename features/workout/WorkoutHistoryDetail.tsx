import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { Modal } from '@/core/ui/Modal';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { computePersonalRecords, computeSessionTotalSets, type LoggedSet } from './workout.domain';
import { getWorkoutLogDetail, type WorkoutLogDetail } from './workout.data';
import { SECTION_COLORS } from '@/constants/sectionColors';

const COLOR = SECTION_COLORS.workout;

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type Props = {
  visible: boolean;
  logId: string | null;
  onClose: () => void;
};

/**
 * Per-session history detail: every logged exercise with its completed sets,
 * session totals, and any personal records recorded in the session.
 */
export function WorkoutHistoryDetailModal({ visible, logId, onClose }: Props) {
  const { tokens } = useAppTheme();
  const [detail, setDetail] = useState<WorkoutLogDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!logId) return;
    setLoading(true);
    try {
      setDetail(await getWorkoutLogDetail(logId));
    } finally {
      setLoading(false);
    }
  }, [logId]);

  useEffect(() => {
    if (!visible || !logId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [visible, logId, refresh]);

  const totalSets = detail
    ? computeSessionTotalSets(detail.exercises.map((e) => ({ setsCompleted: e.sets_completed })))
    : 0;
  // Weight/rep data arrives once per-set weight logging exists; until then
  // this is empty and the PR section renders its empty state.
  const loggedSets: LoggedSet[] = detail
    ? detail.exercises.flatMap((ex) =>
        Array.from({ length: ex.sets_completed }, () => ({
          exerciseName: ex.exercise_name,
          weight: 0,
          reps: 0,
        })),
      )
    : [];
  const prs = computePersonalRecords(loggedSets);

  return (
    <Modal visible={visible} onClose={onClose} title="Session detail" scroll>
      {loading && !detail ? (
        <Text className="text-sm" style={{ color: tokens.textMuted }}>
          Loading session…
        </Text>
      ) : !detail ? (
        <EmptyStateCard
          accentColor={COLOR}
          title="Session not found"
          description="This workout log is no longer available."
          icon={<MaterialIcons name="history" size={24} color={COLOR} />}
        />
      ) : (
        <>
          <View className="mb-4">
            <Text className="text-base font-semibold" style={{ color: tokens.text }}>
              {detail.routineName ?? 'Workout'}
            </Text>
            <Text className="mt-0.5 text-sm" style={{ color: tokens.textMuted }}>
              {formatSessionDate(detail.log.completed_at)}
            </Text>
            {detail.log.notes ? (
              <Text className="mt-2 text-sm italic" style={{ color: tokens.textMuted }}>
                “{detail.log.notes}”
              </Text>
            ) : null}
          </View>

          <View className="mb-4 flex-row gap-3">
            <View
              className="flex-1 rounded-2xl border px-4 py-3"
              style={{ borderColor: `${COLOR}33`, backgroundColor: `${COLOR}14` }}
            >
              <Text className="text-xl font-semibold" style={{ color: COLOR }}>
                {detail.exercises.length}
              </Text>
              <Text className="text-xs" style={{ color: tokens.textMuted }}>
                Exercises
              </Text>
            </View>
            <View
              className="flex-1 rounded-2xl border px-4 py-3"
              style={{ borderColor: `${COLOR}33`, backgroundColor: `${COLOR}14` }}
            >
              <Text className="text-xl font-semibold" style={{ color: COLOR }}>
                {totalSets}
              </Text>
              <Text className="text-xs" style={{ color: tokens.textMuted }}>
                Total sets
              </Text>
            </View>
          </View>

          <View className="gap-3">
            {detail.exercises.map((ex) => (
              <Card key={ex.id} accentColor={COLOR}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-medium" style={{ color: tokens.text }}>
                    {ex.exercise_name}
                  </Text>
                  <Text className="text-sm" style={{ color: tokens.textMuted }}>
                    {ex.sets_completed} set{ex.sets_completed === 1 ? '' : 's'}
                  </Text>
                </View>
                {prs.some((pr) => pr.exerciseName === ex.exercise_name) ? (
                  <View className="mt-2 flex-row items-center gap-1">
                    <MaterialIcons name="emoji-events" size={16} color={COLOR} />
                    <Text className="text-xs font-semibold" style={{ color: COLOR }}>
                      Personal record
                    </Text>
                  </View>
                ) : null}
              </Card>
            ))}
          </View>

          <View className="mt-5">
            <Text className="mb-2 text-sm font-semibold" style={{ color: tokens.text }}>
              Session personal records
            </Text>
            {prs.length === 0 ? (
              <Text className="text-sm" style={{ color: tokens.textMuted }}>
                No weighted sets recorded yet. PR tracking activates once sets record weight and
                reps.
              </Text>
            ) : (
              prs.map((pr) => (
                <View key={pr.exerciseName} className="flex-row items-center justify-between py-1">
                  <Text className="text-sm" style={{ color: tokens.text }}>
                    {pr.exerciseName}
                  </Text>
                  <Text className="text-sm font-semibold" style={{ color: COLOR }}>
                    est. 1RM {Math.round(pr.bestEstimated1RM)} · top {pr.bestTopSetWeight}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </Modal>
  );
}
