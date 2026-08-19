export type ProgressPeriodStat = {
  current: number;
  previous: number;
  delta: number;
};

export type ProgressSummary = {
  range: {
    currentStart: string;
    currentEnd: string;
    previousStart: string;
    previousEnd: string;
  };
  todosCompleted: ProgressPeriodStat;
  habitCompletions: ProgressPeriodStat;
  focusMinutes: ProgressPeriodStat;
  focusSessions: ProgressPeriodStat;
  workoutSessions: ProgressPeriodStat;
  calorieTrackingDays: ProgressPeriodStat;
  calorieGoal: number;
  weeklyReviewsCompleted: ProgressPeriodStat;
  activeProjects: number;
  activeGoals: number;
  goalsAverageProgress: number;
};
