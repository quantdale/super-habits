import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { Modal } from '@/core/ui/Modal';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import {
  computePersonalRecords,
  computeSessionTotalSets,
  computeSessionTotalVolume,
  formatWorkoutTime,
  type LoggedSet,
} from './workout.domain';
import { getWorkoutLogDetail, type WorkoutLogDetail } from './workout.data';
import { SECTION_COLORS } from '@/constants/sectionColors';
import type { WorkoutModality, WorkoutSessionSet } from '@/core/db/types';

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

function formatSetLine(weight: number | null, reps: number | null): string {
  if (weight === null && reps === null) return 'not recorded';
  const weightText = weight === null ? '?' : String(weight);
  const repsText = reps === null ? '?' : String(reps);
  return `${weightText} × ${repsText}`;
}

function formatHistoricalSetLine(
  set: WorkoutSessionSet,
  modality: WorkoutModality | null | undefined,
): string {
  if (set.completed !== 1) return 'skipped';

  const effort =
    set.effort_value != null && set.effort_scale
      ? ` · ${set.effort_scale.toUpperCase()} ${set.effort_value}`
      : '';

  if (modality === 'timed') {
    return `${set.duration_seconds == null ? 'duration not recorded' : `${set.duration_seconds}s`}${effort}`;
  }

  if (modality === 'cardio') {
    const details = [
      set.duration_seconds == null ? null : `${set.duration_seconds}s`,
      set.distance == null ? null : `${set.distance} distance`,
      set.pace == null ? null : `pace ${set.pace}`,
    ].filter((value): value is string => value !== null);
    return `${details.length > 0 ? details.join(' · ') : 'not recorded'}${effort}`;
  }

  if (modality === 'bodyweight') {
    const reps = set.reps == null ? 'reps not recorded' : `${set.reps} reps`;
    const load = set.weight == null ? '' : ` · +${set.weight} ${set.weight_unit ?? ''}`.trimEnd();
    return `${reps}${load}${effort}`;
  }

  return `${formatSetLine(set.weight, set.reps)}${effort}`;
}

/** Whole numbers stay bare; fractional totals keep one decimal. */
function formatMetricNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

type Props = {
  visible: boolean;
  logId: string | null;
  onClose: () => void;
};

/**
 * Per-session history detail: every logged exercise with its recorded sets,
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
  // Real per-set provenance: skipped sets are excluded from PR math; sets
  // without recorded weight/reps stay unknown (null), never zero.
  const exerciseNameById = new Map(
    (detail?.exercises ?? []).map((ex) => [ex.id, ex.exercise_name]),
  );
  const modalityByExerciseId = new Map(
    (detail?.exercises ?? []).map((ex) => [ex.id, ex.modality ?? null]),
  );
  const catalogExerciseIdByExerciseId = new Map(
    (detail?.exercises ?? []).map((ex) => [ex.id, ex.catalog_exercise_id ?? null]),
  );
  const loggedSets: LoggedSet[] = (detail?.sets ?? [])
    .filter((set) => set.completed === 1)
    .flatMap((set) => {
      const exerciseName = exerciseNameById.get(set.session_exercise_id);
      if (!exerciseName) return [];
      return [
        {
          exerciseName,
          catalogExerciseId: catalogExerciseIdByExerciseId.get(set.session_exercise_id) ?? null,
          modality: modalityByExerciseId.get(set.session_exercise_id) ?? undefined,
          weight: set.weight,
          reps: set.reps,
          durationSeconds: set.duration_seconds,
          distance: set.distance,
        },
      ];
    });
  const prs = computePersonalRecords(loggedSets);
  const totalVolume = computeSessionTotalVolume(
    (detail?.sets ?? []).map((set) => ({
      weight: set.weight,
      reps: set.reps,
      completed: set.completed === 1,
      modality: modalityByExerciseId.get(set.session_exercise_id) ?? undefined,
    })),
  );

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
            {detail.exercises.length === 0 ? (
              <Text className="mt-2 text-sm italic" style={{ color: tokens.textMuted }}>
                Quick log — no exercises recorded.
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
            <View
              className="flex-1 rounded-2xl border px-4 py-3"
              style={{ borderColor: `${COLOR}33`, backgroundColor: `${COLOR}14` }}
            >
              <Text className="text-xl font-semibold" style={{ color: COLOR }}>
                {formatMetricNumber(totalVolume)}
              </Text>
              <Text className="text-xs" style={{ color: tokens.textMuted }}>
                Volume
              </Text>
            </View>
            {detail.log.duration_seconds != null ? (
              <View
                className="flex-1 rounded-2xl border px-4 py-3"
                style={{ borderColor: `${COLOR}33`, backgroundColor: `${COLOR}14` }}
              >
                <Text className="text-xl font-semibold" style={{ color: COLOR }}>
                  {formatWorkoutTime(detail.log.duration_seconds)}
                </Text>
                <Text className="text-xs" style={{ color: tokens.textMuted }}>
                  Duration
                </Text>
              </View>
            ) : null}
          </View>

          <View className="gap-3">
            {detail.exercises.map((ex) => {
              const exerciseSets = detail.sets.filter((s) => s.session_exercise_id === ex.id);
              return (
                <Card key={ex.id} accentColor={COLOR}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-medium" style={{ color: tokens.text }}>
                      {ex.exercise_name}
                      {ex.unilateral === 1 ? ' · per side' : ''}
                    </Text>
                    <Text className="text-sm" style={{ color: tokens.textMuted }}>
                      {ex.sets_completed} set{ex.sets_completed === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {exerciseSets.length > 0 ? (
                    <View className="mt-2">
                      {exerciseSets.map((set) => (
                        <Text key={set.id} className="text-xs" style={{ color: tokens.textMuted }}>
                          Set {set.set_number}: {formatHistoricalSetLine(set, ex.modality)}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {prs.some((pr) => pr.exerciseName === ex.exercise_name) ? (
                    <View className="mt-2 flex-row items-center gap-1">
                      <MaterialIcons name="emoji-events" size={16} color={COLOR} />
                      <Text className="text-xs font-semibold" style={{ color: COLOR }}>
                        Personal record
                      </Text>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>

          <View className="mt-5">
            <Text className="mb-2 text-sm font-semibold" style={{ color: tokens.text }}>
              Session personal records
            </Text>
            {prs.length === 0 ? (
              <Text className="text-sm" style={{ color: tokens.textMuted }}>
                No measurable performance recorded yet. Strength, timed, and cardio records appear
                when the corresponding set data is present.
              </Text>
            ) : (
              prs.map((pr) => (
                <View key={pr.exerciseName} className="flex-row items-center justify-between py-1">
                  <Text className="text-sm" style={{ color: tokens.text }}>
                    {pr.exerciseName}
                  </Text>
                  <Text className="text-sm font-semibold" style={{ color: COLOR }}>
                    {[
                      pr.bestTimedDurationSeconds > 0
                        ? `best ${formatWorkoutTime(pr.bestTimedDurationSeconds)}`
                        : null,
                      pr.bestEstimated1RM > 0
                        ? `est. 1RM ${Math.round(pr.bestEstimated1RM)}`
                        : null,
                      pr.bestTopSetWeight > 0 ? `top ${pr.bestTopSetWeight}` : null,
                      pr.bestRepSet ? `reps ${pr.bestRepSet.reps} @ ${pr.bestRepSet.weight}` : null,
                      pr.bestCardioDistance > 0 ? `distance ${pr.bestCardioDistance}` : null,
                    ]
                      .filter((value): value is string => value !== null)
                      .join(' · ')}
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
