import { buildDayCompletions, habitCreationDateKey } from '@/features/habits/habits.domain';
import { dateKeyToLocalDate, isValidDateKey, timestampToLocalDateKey, toDateKey } from '@/lib/time';
import {
  MOMENTUM_DEFAULT_DAYS,
  MOMENTUM_LIMITS,
  MOMENTUM_MAX_DAYS,
  MOMENTUM_SOURCE_LABELS,
  MOMENTUM_SOURCES,
  type MomentumContribution,
  type MomentumDay,
  type MomentumDomainInput,
  type MomentumGardenModel,
  type MomentumMilestone,
  type MomentumMilestoneFact,
  type MomentumSource,
  type MomentumWindow,
} from './momentum.types';

type DateCount = {
  rawCount: number;
  extra: string | null;
};

type DateCountMap = Map<string, DateCount>;

function normalizeDays(days: number | undefined): number {
  const requested = days ?? MOMENTUM_DEFAULT_DAYS;
  if (!Number.isFinite(requested)) return MOMENTUM_DEFAULT_DAYS;
  return Math.max(1, Math.min(MOMENTUM_MAX_DAYS, Math.floor(requested)));
}

/** Build an injected, local-calendar window without depending on wall-clock today. */
export function buildMomentumWindow(
  todayKey = toDateKey(),
  requestedDays = MOMENTUM_DEFAULT_DAYS,
): MomentumWindow {
  const days = normalizeDays(requestedDays);
  const safeTodayKey = isValidDateKey(todayKey) ? todayKey : toDateKey();
  const end = dateKeyToLocalDate(safeTodayKey);
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    keys.push(toDateKey(date));
  }
  return {
    todayKey: safeTodayKey,
    startKey: keys[0] ?? safeTodayKey,
    endKey: keys[keys.length - 1] ?? safeTodayKey,
    days: keys,
  };
}

function safeTimestampToDateKey(value: string | null | undefined): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return timestampToLocalDateKey(value);
}

function isInWindow(dateKey: string | null, window: MomentumWindow): boolean {
  return dateKey !== null && dateKey >= window.startKey && dateKey <= window.endKey;
}

function addCount(map: DateCountMap, dateKey: string, extra?: string): void {
  const current = map.get(dateKey) ?? { rawCount: 0, extra: null };
  current.rawCount += 1;
  if (extra && !current.extra) current.extra = extra;
  map.set(dateKey, current);
}

function addNumericCount(map: DateCountMap, dateKey: string, amount: number): void {
  const current = map.get(dateKey) ?? { rawCount: 0, extra: null };
  current.rawCount += amount;
  map.set(dateKey, current);
}

function clampLevel(rawCount: number, cap: number): 0 | 1 | 2 | 3 {
  return Math.max(0, Math.min(3, Math.min(rawCount, cap))) as 0 | 1 | 2 | 3;
}

function pluralize(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function cappedCountText(rawCount: number, cap: number, noun: string): string {
  if (rawCount === 0) return `No ${noun} yet`;
  return rawCount > cap ? `${cap}+ ${noun}` : pluralize(rawCount, noun);
}

function createContribution(
  source: MomentumSource,
  count: number,
  cap: number,
  detail: string,
): MomentumContribution {
  return {
    source,
    label: MOMENTUM_SOURCE_LABELS[source],
    count: Math.min(count, cap),
    level: clampLevel(count, cap),
    detail,
  };
}

function collectTaskDates(input: MomentumDomainInput, window: MomentumWindow): DateCountMap {
  const dates: DateCountMap = new Map();
  for (const task of input.tasks) {
    if (task.deleted_at !== null && task.deleted_at !== undefined) continue;
    if (task.completed !== 1) continue;
    const dateKey = safeTimestampToDateKey(task.completed_at);
    if (isInWindow(dateKey, window)) addCount(dates, dateKey!);
  }
  return dates;
}

function collectHabitDates(input: MomentumDomainInput, window: MomentumWindow): DateCountMap {
  const dates: DateCountMap = new Map();
  const completionsByHabit = new Map<string, { date_key: string; count: number }[]>();
  for (const completion of input.habitCompletions) {
    if (!isValidDateKey(completion.date_key)) continue;
    if (!isInWindow(completion.date_key, window)) continue;
    const rows = completionsByHabit.get(completion.habit_id) ?? [];
    rows.push({ date_key: completion.date_key, count: completion.count });
    completionsByHabit.set(completion.habit_id, rows);
  }

  for (const habit of input.habits) {
    if (habit.deleted_at !== null && habit.deleted_at !== undefined) continue;
    const completions = completionsByHabit.get(habit.id) ?? [];
    // Use the canonical rule/lifecycle resolver while explicitly bounding the
    // generated local dates to the Garden window.
    const dayCompletions = buildDayCompletions(
      completions,
      habit.target_per_day,
      undefined,
      habit.rule_history,
      habitCreationDateKey(habit.created_at),
      input.todayKey,
      habit.lifecycle_history,
      window.startKey,
    );
    for (const day of dayCompletions) {
      if (day.completed && isInWindow(day.dateKey, window)) {
        addCount(dates, day.dateKey);
      }
    }
  }
  return dates;
}

function collectFocusDates(input: MomentumDomainInput, window: MomentumWindow): DateCountMap {
  const dates: DateCountMap = new Map();
  for (const session of input.focus) {
    if (session.session_type !== 'focus') continue;
    if (!session.ended_at || Number.isNaN(Date.parse(session.ended_at))) continue;
    if (!Number.isFinite(session.duration_seconds) || session.duration_seconds <= 0) continue;
    const dateKey = safeTimestampToDateKey(session.started_at);
    if (isInWindow(dateKey, window)) {
      addNumericCount(dates, dateKey!, 1);
      const current = dates.get(dateKey!)!;
      const minutes = Math.max(1, Math.round(session.duration_seconds / 60));
      current.extra = current.extra ? `${current.extra}, ${minutes} min` : `${minutes} min`;
    }
  }
  return dates;
}

function collectWorkoutDates(input: MomentumDomainInput, window: MomentumWindow): DateCountMap {
  const dates: DateCountMap = new Map();
  for (const workout of input.workouts) {
    const dateKey = safeTimestampToDateKey(workout.completed_at);
    if (isInWindow(dateKey, window)) addCount(dates, dateKey!);
  }
  return dates;
}

function collectNutritionDates(input: MomentumDomainInput, window: MomentumWindow): DateCountMap {
  const dates: DateCountMap = new Map();
  const seen = new Set<string>();
  for (const entry of input.nutrition) {
    if (entry.deleted_at !== null && entry.deleted_at !== undefined) continue;
    if (!isValidDateKey(entry.consumed_on)) continue;
    if (!isInWindow(entry.consumed_on, window) || seen.has(entry.consumed_on)) continue;
    seen.add(entry.consumed_on);
    addCount(dates, entry.consumed_on);
  }
  return dates;
}

function collectPlanningDates(input: MomentumDomainInput, window: MomentumWindow): DateCountMap {
  const dates: DateCountMap = new Map();
  for (const plan of input.dailyPlans) {
    if (plan.deleted_at !== null && plan.deleted_at !== undefined) continue;
    if (plan.status !== 'completed') continue;
    const dateKey = safeTimestampToDateKey(plan.completed_at);
    if (isInWindow(dateKey, window)) addCount(dates, dateKey!);
  }
  return dates;
}

function collectReviewDates(input: MomentumDomainInput, window: MomentumWindow): DateCountMap {
  const dates: DateCountMap = new Map();
  for (const review of input.reviews) {
    if (review.deleted_at !== null && review.deleted_at !== undefined) continue;
    if (review.status !== 'completed') continue;
    const dateKey = safeTimestampToDateKey(review.completed_at);
    if (isInWindow(dateKey, window)) addCount(dates, dateKey!);
  }
  return dates;
}

function buildMilestones(
  facts: readonly MomentumMilestoneFact[],
  window: MomentumWindow,
): MomentumMilestone[] {
  return facts
    .filter((fact) => {
      if (fact.deleted_at !== null && fact.deleted_at !== undefined) return false;
      if (fact.status !== 'completed') return false;
      return isInWindow(safeTimestampToDateKey(fact.completed_at), window);
    })
    .map((fact) => ({
      id: fact.id,
      label: fact.label,
      dateKey: safeTimestampToDateKey(fact.completed_at)!,
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.id.localeCompare(b.id));
}

function sourceContribution(
  source: MomentumSource,
  dateKey: string,
  dates: DateCountMap,
): MomentumContribution {
  const entry = dates.get(dateKey);
  const rawCount = entry?.rawCount ?? 0;
  const extra = entry?.extra;
  switch (source) {
    case 'tasks': {
      const cap = MOMENTUM_LIMITS.tasksPerDay;
      return createContribution(
        source,
        rawCount,
        cap,
        rawCount === 0
          ? 'No completed tasks'
          : `${cappedCountText(rawCount, cap, 'task')} completed`,
      );
    }
    case 'habits': {
      const cap = MOMENTUM_LIMITS.habitsPerDay;
      return createContribution(
        source,
        rawCount,
        cap,
        rawCount === 0
          ? 'No scheduled habit completions'
          : `${cappedCountText(rawCount, cap, 'habit completion')}`,
      );
    }
    case 'focus': {
      const cap = MOMENTUM_LIMITS.focusSessionsPerDay;
      const sessionText = cappedCountText(rawCount, cap, 'focus session');
      return createContribution(
        source,
        rawCount,
        cap,
        rawCount === 0
          ? 'No completed focus sessions'
          : `${sessionText}${extra ? ` · ${extra}` : ''}`,
      );
    }
    case 'workout': {
      const cap = MOMENTUM_LIMITS.workoutSessionsPerDay;
      return createContribution(
        source,
        rawCount,
        cap,
        rawCount === 0
          ? 'No completed workout session'
          : `${cappedCountText(rawCount, cap, 'workout session')} completed`,
      );
    }
    case 'nutrition':
      return createContribution(
        source,
        rawCount,
        MOMENTUM_LIMITS.nutritionDaysPerDay,
        rawCount === 0 ? 'No nutrition tracking yet' : 'Nutrition tracked',
      );
    case 'planning':
      return createContribution(
        source,
        rawCount,
        MOMENTUM_LIMITS.planningCompletionsPerDay,
        rawCount === 0 ? 'No completed Daily Plan' : 'Daily Plan completed',
      );
    case 'review':
      return createContribution(
        source,
        rawCount,
        MOMENTUM_LIMITS.reviewCompletionsPerDay,
        rawCount === 0 ? 'No completed Weekly Review' : 'Weekly Review completed',
      );
  }
}

function formatDayAccessibilityLabel(day: MomentumDay): string {
  if (day.activeSources.length === 0) {
    return day.isToday
      ? 'Today: no contributions yet. Your garden is ready for today.'
      : `${day.dateKey}: no recorded contributions.`;
  }
  const details = day.activeSources.map((source) => day.contributions[source].detail).join('; ');
  return `${day.isToday ? 'Today' : day.dateKey}: activity from ${day.activeSources
    .map((source) => MOMENTUM_SOURCE_LABELS[source])
    .join(', ')}. ${details}.`;
}

function formatRecentAccessibilityLabel(days: readonly MomentumDay[], todayKey: string): string {
  const sourceDays = new Map<MomentumSource, number>();
  for (const day of days) {
    for (const source of day.activeSources) {
      sourceDays.set(source, (sourceDays.get(source) ?? 0) + 1);
    }
  }
  if (sourceDays.size === 0) {
    return `Momentum Garden, last ${days.length} days: no contributions yet. Your garden is ready for today.`;
  }
  const summary = [...sourceDays.entries()]
    .map(([source, count]) => `${MOMENTUM_SOURCE_LABELS[source]} on ${pluralize(count, 'day')}`)
    .join(', ');
  return `Momentum Garden, last ${days.length} days ending ${todayKey}: activity from ${summary}.`;
}

function emptyContributionMap(): Record<MomentumSource, MomentumContribution> {
  return Object.fromEntries(
    MOMENTUM_SOURCES.map((source) => [source, sourceContribution(source, '', new Map())]),
  ) as Record<MomentumSource, MomentumContribution>;
}

export function buildMomentumGarden(input: MomentumDomainInput): MomentumGardenModel {
  const window = buildMomentumWindow(input.todayKey, input.days);
  const todayKey = window.todayKey;

  const sourceDates: Record<MomentumSource, DateCountMap> = {
    tasks: collectTaskDates(input, window),
    habits: collectHabitDates(input, window),
    focus: collectFocusDates(input, window),
    workout: collectWorkoutDates(input, window),
    nutrition: collectNutritionDates(input, window),
    planning: collectPlanningDates(input, window),
    review: collectReviewDates(input, window),
  };

  const days = window.days.map((dateKey) => {
    const contributions = emptyContributionMap();
    for (const source of MOMENTUM_SOURCES) {
      contributions[source] = sourceContribution(source, dateKey, sourceDates[source]);
    }
    const activeSources = MOMENTUM_SOURCES.filter((source) => contributions[source].level > 0);
    const day: MomentumDay = {
      dateKey,
      isToday: dateKey === todayKey,
      contributions,
      activeSources,
      hasGrowth: activeSources.length > 0,
      accessibilityLabel: '',
    };
    day.accessibilityLabel = formatDayAccessibilityLabel(day);
    return day;
  });

  const today = days[days.length - 1] ?? {
    dateKey: todayKey,
    isToday: true,
    contributions: emptyContributionMap(),
    activeSources: [],
    hasGrowth: false,
    accessibilityLabel: 'Today: no contributions yet. Your garden is ready for today.',
  };
  const milestones = buildMilestones(input.milestones, window);
  return {
    todayKey,
    days,
    today,
    milestones,
    activeDays: days.filter((day) => day.hasGrowth).length,
    hasPriorGrowth: days.some((day) => !day.isToday && day.hasGrowth),
    accessibilityLabel: formatRecentAccessibilityLabel(days, todayKey),
  };
}

export function buildMomentumSourceExplanations(
  model: MomentumGardenModel,
): { source: MomentumSource; label: string; explanation: string }[] {
  return MOMENTUM_SOURCES.map((source) => {
    const contribution = model.today.contributions[source];
    const activeDays = model.days.filter((day) => day.contributions[source].level > 0).length;
    const detail =
      activeDays > 0
        ? `${contribution.detail} today; active on ${pluralize(activeDays, 'day')} in this window.`
        : `No ${MOMENTUM_SOURCE_LABELS[source].toLowerCase()} contribution in this window.`;
    return { source, label: MOMENTUM_SOURCE_LABELS[source], explanation: detail };
  });
}

export function formatMomentumTodaySummary(model: MomentumGardenModel): string {
  const sources = model.today.activeSources;
  if (sources.length === 0) return 'Your garden is ready for today.';
  return `Today: activity from ${sources.map((source) => MOMENTUM_SOURCE_LABELS[source]).join(', ')}.`;
}

/** Small helper for tests and UI copy; no source writes or hidden score. */
export function getMomentumGrowthSources(day: MomentumDay): MomentumSource[] {
  return [...day.activeSources];
}
