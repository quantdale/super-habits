import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/themeContext';
import { SECTION_COLORS } from '@/constants/sectionColors';
import type {
  BodyWeightEntry,
  WorkoutModality,
  WorkoutRoutine,
  WorkoutWeeklyPlanEntry,
} from '@/core/db/types';
import type {
  ScheduleResolution,
  BodyWeightTrend,
  PersonalRecord,
  ExerciseHistoryEntry,
} from './workout.domain';
import {
  buildExerciseHistory,
  computeBodyWeightTrend,
  convertWeight,
  formatWorkoutTime,
} from './workout.domain';
import type { WorkoutPerformanceRow } from './workout.data';

const COLOR = SECTION_COLORS.workout;

function weekdayLabel(weekday: number): string {
  return (
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekday - 1] ??
    `Day ${weekday}`
  );
}

export function WorkoutTodayCard({
  schedule,
  routine,
  lastPerformedAt,
  exerciseCount,
  setCount,
  completedToday,
  draftRoutineName,
  isResumable,
  onStart,
  onPlanWeek,
  onChangeToday,
  onReschedule,
}: {
  schedule: ScheduleResolution | null;
  routine: WorkoutRoutine | null;
  lastPerformedAt: string | null;
  exerciseCount: number;
  setCount: number;
  completedToday: boolean;
  draftRoutineName: string | null;
  isResumable: boolean;
  onStart: () => void;
  onPlanWeek: () => void;
  onChangeToday: () => void;
  onReschedule: () => void;
}) {
  const { tokens } = useAppTheme();
  const restDay = !schedule || schedule.planKind === 'rest' || !routine;
  return (
    <Card
      accentColor={COLOR}
      variant="header"
      headerTitle="Today"
      headerSubtitle="Your local training plan for this date."
      headerRight={<MaterialIcons name="today" size={20} color={tokens.textOnAccent} />}
    >
      {isResumable ? (
        <View>
          <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
            Workout in progress
          </Text>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            {draftRoutineName ?? 'Your workout'} is paused and ready to resume. Your entered sets
            are saved locally.
          </Text>
          <View className="mt-4">
            <Button label="Resume workout" onPress={onStart} color={COLOR} />
          </View>
        </View>
      ) : restDay ? (
        <View>
          <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
            Rest day
          </Text>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            Recover, or choose a different routine for today without changing your weekly template.
          </Text>
        </View>
      ) : (
        <View>
          <Text className="text-lg font-semibold" style={{ color: tokens.text }}>
            {completedToday ? 'Workout completed today' : routine.name}
          </Text>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            {completedToday
              ? `${routine.name} is logged. Train again whenever it suits you.`
              : `${exerciseCount} exercises · ${setCount} prescribed sets`}
            {lastPerformedAt
              ? ` · Last ${new Date(lastPerformedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
              : ''}
          </Text>
          <View className="mt-4">
            <Button
              label={completedToday ? 'Start another session' : "Start today's workout"}
              onPress={onStart}
              color={COLOR}
            />
          </View>
        </View>
      )}
      {!restDay && !isResumable ? (
        <View className="mt-3">
          <Button label="Move workout to another day" variant="ghost" onPress={onReschedule} />
        </View>
      ) : null}
      <View className="mt-3 flex-row gap-2">
        <View className="min-w-0 flex-1">
          <Button label="Change today" variant="ghost" onPress={onChangeToday} />
        </View>
        <View className="min-w-0 flex-1">
          <Button label="Plan week" variant="ghost" onPress={onPlanWeek} />
        </View>
      </View>
    </Card>
  );
}

export function WorkoutWeekCard({
  entries,
  routines,
  onSelect,
}: {
  entries: WorkoutWeeklyPlanEntry[];
  routines: WorkoutRoutine[];
  onSelect: (weekday: number, routineId: string | null) => void;
}) {
  const { tokens } = useAppTheme();
  const entryByDay = new Map(entries.map((entry) => [entry.weekday, entry]));
  return (
    <Card
      accentColor={COLOR}
      variant="header"
      headerTitle="Week"
      headerSubtitle="Tap a day to assign a routine or explicit rest."
      headerRight={<MaterialIcons name="date-range" size={20} color={tokens.textOnAccent} />}
    >
      <View className="gap-2">
        {Array.from({ length: 7 }, (_, index) => index + 1).map((weekday) => {
          const entry = entryByDay.get(weekday);
          const routine = routines.find((item) => item.id === entry?.routine_id);
          return (
            <View
              key={weekday}
              className="flex-row items-center justify-between gap-3 rounded-xl border px-3 py-2"
              style={{ borderColor: tokens.border }}
            >
              <Text className="w-24 text-sm font-semibold" style={{ color: tokens.text }}>
                {weekdayLabel(weekday)}
              </Text>
              <View className="min-w-0 flex-1">
                <Text
                  className="text-sm"
                  style={{ color: entry?.plan_kind === 'workout' ? COLOR : tokens.textMuted }}
                  numberOfLines={1}
                >
                  {routine?.name ?? (entry?.plan_kind === 'rest' ? 'Rest' : 'Not planned')}
                </Text>
              </View>
              <View className="flex-row gap-1">
                {routines.slice(0, 2).map((candidate) => (
                  <Pressable
                    key={candidate.id}
                    onPress={() => onSelect(weekday, candidate.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${weekdayLabel(weekday)} ${candidate.name}`}
                    className="rounded-lg px-2 py-1"
                    style={{
                      backgroundColor:
                        candidate.id === routine?.id ? `${COLOR}22` : tokens.surfaceElevated,
                    }}
                  >
                    <MaterialIcons
                      name={candidate.id === routine?.id ? 'check' : 'add'}
                      size={16}
                      color={candidate.id === routine?.id ? COLOR : tokens.textMuted}
                    />
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => onSelect(weekday, null)}
                  accessibilityRole="button"
                  accessibilityLabel={`${weekdayLabel(weekday)} rest`}
                  className="rounded-lg px-2 py-1"
                  style={{
                    backgroundColor:
                      entry?.plan_kind === 'rest' ? `${COLOR}22` : tokens.surfaceElevated,
                  }}
                >
                  <Text
                    className="text-[11px] font-semibold"
                    style={{ color: entry?.plan_kind === 'rest' ? COLOR : tokens.textMuted }}
                  >
                    Rest
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
      {routines.length > 2 ? (
        <Text className="mt-3 text-xs" style={{ color: tokens.textMuted }}>
          The first two routines are shown here; use the full week editor to choose any routine.
        </Text>
      ) : null}
    </Card>
  );
}

function formatRecord(record: PersonalRecord): string {
  const metrics: string[] = [];
  if (record.bestEstimated1RM > 0) {
    metrics.push(`est. 1RM ${Math.round(record.bestEstimated1RM)}`);
  }
  if (record.bestTopSetWeight > 0) metrics.push(`top ${record.bestTopSetWeight}`);
  if (record.bestRepSet) {
    metrics.push(`best reps ${record.bestRepSet.reps} @ ${record.bestRepSet.weight}`);
  }
  if (record.bestTimedDurationSeconds > 0) {
    metrics.push(`best ${formatWorkoutTime(record.bestTimedDurationSeconds)}`);
  }
  if (record.bestCardioDistance > 0) {
    metrics.push(`best distance ${record.bestCardioDistance}`);
  }
  return metrics.join(' · ') || 'No measurable performance yet';
}

function formatPerformanceLine(row: WorkoutPerformanceRow): string {
  const modality: WorkoutModality | null = row.modality;
  let result: string;
  if (modality === 'timed') {
    result = row.durationSeconds == null ? 'duration —' : `${row.durationSeconds}s`;
  } else if (modality === 'cardio') {
    result =
      [
        row.durationSeconds == null ? null : `${row.durationSeconds}s`,
        row.distance == null ? null : `${row.distance} distance`,
        row.pace == null ? null : `pace ${row.pace}`,
      ]
        .filter((value): value is string => value !== null)
        .join(' · ') || 'not recorded';
  } else if (modality === 'bodyweight') {
    result = `${row.reps ?? '—'} reps${row.weight == null ? '' : ` · +${row.weight} ${row.weightUnit ?? ''}`.trimEnd()}`;
  } else {
    result = `${row.weight ?? '—'} × ${row.reps ?? '—'}`;
  }
  return `${result}${row.effortValue != null ? ` · ${row.effortScale?.toUpperCase()} ${row.effortValue}` : ''}`;
}

export function WorkoutProgressCard({
  rows,
  records,
  bodyAreas,
  onSelectExercise,
  selectedExercise,
}: {
  rows: WorkoutPerformanceRow[];
  records: PersonalRecord[];
  bodyAreas: { area: string; sets: number }[];
  onSelectExercise: (name: string) => void;
  selectedExercise: string | null;
}) {
  const { tokens } = useAppTheme();
  const exerciseNames = [...new Set(rows.map((row) => row.exerciseName))];
  const selectedExerciseRows = selectedExercise
    ? rows.filter((row) => row.exerciseName === selectedExercise)
    : [];
  const selectedRows = selectedExercise
    ? rows.filter((row) => row.exerciseName === selectedExercise).slice(0, 8)
    : [];
  const selectedRecord = records.find((record) => record.exerciseName === selectedExercise);
  const selectedHistory = selectedExercise
    ? buildExerciseHistory(
        selectedExerciseRows.map((row): ExerciseHistoryEntry => ({
          logId: row.logId,
          completedAt: row.completedAt,
          exerciseName: row.exerciseName,
          catalogExerciseId: row.catalogExerciseId,
          modality: row.modality ?? undefined,
          weight: row.weight,
          reps: row.reps,
          durationSeconds: row.durationSeconds,
          distance: row.distance,
          completed: row.completed === 1,
          setNumber: row.setNumber,
        })),
      )
    : null;
  return (
    <Card
      accentColor={COLOR}
      variant="header"
      headerTitle="Progress"
      headerSubtitle="PRs, exercise history, and explainable next steps."
      headerRight={<MaterialIcons name="trending-up" size={20} color={tokens.textOnAccent} />}
    >
      {records.length === 0 ? (
        <Text className="text-sm" style={{ color: tokens.textMuted }}>
          Complete recorded sets to see personal records and trends.
        </Text>
      ) : (
        <View className="gap-2">
          {records.slice(0, 5).map((record) => (
            <Pressable
              key={record.exerciseName}
              onPress={() => onSelectExercise(record.exerciseName)}
              accessibilityRole="button"
              accessibilityLabel={`View progress for ${record.exerciseName}`}
              className="flex-row items-center justify-between rounded-xl border px-3 py-2"
              style={{ borderColor: tokens.border }}
            >
              <View className="min-w-0 flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: tokens.text }}
                  numberOfLines={1}
                >
                  {record.exerciseName}
                </Text>
                <Text className="text-xs" style={{ color: tokens.textMuted }}>
                  {formatRecord(record)}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={tokens.iconMuted} />
            </Pressable>
          ))}
        </View>
      )}
      {exerciseNames.length > 0 ? (
        <View className="mt-4">
          <Text
            className="mb-2 text-xs font-semibold uppercase"
            style={{ color: tokens.textMuted }}
          >
            Exercise history
          </Text>
          <View className="flex-row flex-wrap">
            {exerciseNames.slice(0, 12).map((name) => (
              <PillChip
                key={name}
                label={name}
                active={selectedExercise === name}
                color={COLOR}
                onPress={() => onSelectExercise(name)}
              />
            ))}
          </View>
          {selectedExercise ? (
            <View
              className="mt-2 rounded-xl border px-3 py-2"
              style={{ borderColor: tokens.border }}
            >
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                {selectedExercise}
              </Text>
              {selectedRecord ? (
                <Text className="mt-1 text-xs" style={{ color: COLOR }}>
                  {formatRecord(selectedRecord)}
                </Text>
              ) : null}
              {selectedHistory ? (
                <Text className="mt-2 text-xs" style={{ color: tokens.textMuted }}>
                  {selectedHistory.sessions} session
                  {selectedHistory.sessions === 1 ? '' : 's'} · {selectedHistory.performedSets}{' '}
                  performed sets
                  {selectedHistory.measurableVolume > 0
                    ? ` · volume ${Math.round(selectedHistory.measurableVolume)}`
                    : ''}
                  {selectedHistory.points.length > 1 &&
                  selectedHistory.bestEstimated1RM > 0 &&
                  selectedHistory.points[0]?.bestEstimated1RM !==
                    selectedHistory.points[selectedHistory.points.length - 1]?.bestEstimated1RM
                    ? ` · est. 1RM trend ${Math.round(selectedHistory.points[0]?.bestEstimated1RM ?? 0)} → ${Math.round(selectedHistory.points[selectedHistory.points.length - 1]?.bestEstimated1RM ?? 0)}`
                    : ''}
                  {selectedHistory.bestTimedDurationSeconds > 0
                    ? ` · best timed ${formatWorkoutTime(selectedHistory.bestTimedDurationSeconds)}`
                    : ''}
                  {selectedHistory.bestCardioDistance > 0
                    ? ` · best distance ${selectedHistory.bestCardioDistance}`
                    : ''}
                </Text>
              ) : null}
              {selectedRows.map((row) => (
                <Text
                  key={`${row.logId}-${row.setNumber}`}
                  className="mt-1 text-xs"
                  style={{ color: tokens.textMuted }}
                >
                  {new Date(row.completedAt).toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  · Set {row.setNumber} · {formatPerformanceLine(row)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {bodyAreas.length > 0 ? (
        <View className="mt-4">
          <Text
            className="mb-2 text-xs font-semibold uppercase"
            style={{ color: tokens.textMuted }}
          >
            Body-area distribution
          </Text>
          <View className="gap-2">
            {bodyAreas.slice(0, 8).map((entry) => {
              const maxSets = bodyAreas[0]?.sets ?? entry.sets;
              return (
                <View key={entry.area}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs capitalize" style={{ color: tokens.text }}>
                      {entry.area.replace('-', ' ')}
                    </Text>
                    <Text className="text-xs" style={{ color: tokens.textMuted }}>
                      {entry.sets} set{entry.sets === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View
                    className="mt-1 h-2 overflow-hidden rounded-full"
                    style={{ backgroundColor: tokens.border }}
                  >
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(8, Math.round((entry.sets / Math.max(1, maxSets)) * 100))}%`,
                        backgroundColor: `${COLOR}aa`,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

export function BodyWeightCard({
  entries,
  goalWeight,
  onAdd,
  onEdit,
  onDelete,
}: {
  entries: BodyWeightEntry[];
  goalWeight: { value: number; unit: 'kg' | 'lb' } | null;
  onAdd: () => void;
  onEdit: (entry: BodyWeightEntry) => void;
  onDelete: (entry: BodyWeightEntry) => void;
}) {
  const { tokens } = useAppTheme();
  const trend: BodyWeightTrend = computeBodyWeightTrend(entries);
  const chartUnit = trend.latest?.unit ?? 'kg';
  const chartEntries = entries.slice(0, 7).reverse();
  const chartValues = chartEntries.map((entry) =>
    convertWeight(entry.weight, entry.unit, chartUnit),
  );
  const chartMin = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const chartMax = chartValues.length > 0 ? Math.max(...chartValues) : 1;
  const chartRange = Math.max(0.1, chartMax - chartMin);
  return (
    <Card
      accentColor={COLOR}
      variant="header"
      headerTitle="Body weight"
      headerSubtitle="Measured history stays in the unit you entered."
      headerRight={<MaterialIcons name="monitor-weight" size={20} color={tokens.textOnAccent} />}
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-semibold" style={{ color: tokens.text }}>
            {trend.latest ? `${trend.latest.weight} ${trend.latest.unit}` : '—'}
          </Text>
          <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
            {trend.change == null
              ? 'Add two entries for a trend'
              : `${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)} ${trend.first?.unit ?? ''} since first entry`}
          </Text>
          {goalWeight ? (
            <Text className="mt-1 text-xs font-semibold" style={{ color: COLOR }}>
              Goal · {goalWeight.value} {goalWeight.unit}
            </Text>
          ) : null}
        </View>
        <Button label="Log weight" onPress={onAdd} color={COLOR} />
      </View>
      {chartEntries.length > 0 ? (
        <View className="mt-4 rounded-xl border px-3 pt-3" style={{ borderColor: tokens.border }}>
          <Text
            className="mb-2 text-xs font-semibold uppercase"
            style={{ color: tokens.textMuted }}
          >
            Recent trend · {chartUnit}
          </Text>
          <View className="h-24 flex-row items-end gap-2">
            {chartEntries.map((entry, index) => {
              const value = chartValues[index] ?? chartMin;
              const height = 18 + ((value - chartMin) / chartRange) * 54;
              return (
                <View key={entry.id} className="min-w-0 flex-1 items-center justify-end">
                  <View
                    className="w-full rounded-t-lg"
                    style={{ height, backgroundColor: `${COLOR}88` }}
                  />
                  <Text className="mt-1 text-[10px]" style={{ color: tokens.textMuted }}>
                    {new Date(entry.measured_at).toLocaleDateString('en', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {entries.slice(0, 5).map((entry) => (
        <View key={entry.id} className="mt-2 flex-row items-center gap-2">
          <Text className="min-w-0 flex-1 text-xs" style={{ color: tokens.textMuted }}>
            {new Date(entry.measured_at).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
            })}{' '}
            · {entry.weight} {entry.unit}
            {entry.note ? ` · ${entry.note}` : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit body weight ${entry.measured_at}`}
            onPress={() => onEdit(entry)}
            className="rounded-lg px-2 py-1"
            style={{ backgroundColor: tokens.surfaceElevated }}
          >
            <Text className="text-[11px] font-semibold" style={{ color: COLOR }}>
              Edit
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete body weight ${entry.measured_at}`}
            onPress={() => onDelete(entry)}
            className="rounded-lg px-2 py-1"
            style={{ backgroundColor: tokens.surfaceElevated }}
          >
            <Text className="text-[11px] font-semibold" style={{ color: tokens.dangerText }}>
              Delete
            </Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

export function WorkoutTotalsCard({
  sessions,
  sets,
  durationSeconds,
  volume,
  trainingDays,
}: {
  sessions: number;
  sets: number;
  durationSeconds: number;
  volume: number;
  trainingDays: number;
}) {
  const { tokens } = useAppTheme();
  return (
    <Card accentColor={COLOR}>
      <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
        Training totals
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-3">
        {[
          ['Sessions', sessions],
          ['Completed sets', sets],
          ['Training days', trainingDays],
          ['Training time', formatWorkoutTime(durationSeconds)],
          ['Measurable volume', Math.round(volume)],
        ].map(([label, value]) => (
          <View
            key={String(label)}
            className="min-w-[105px] flex-1 rounded-xl border px-3 py-2"
            style={{ borderColor: tokens.border }}
          >
            <Text className="text-lg font-semibold" style={{ color: COLOR }}>
              {String(value)}
            </Text>
            <Text className="text-[11px]" style={{ color: tokens.textMuted }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
