import type {
  GoalProgressFacts,
  ProjectStatusFacts,
  TodayFocusFacts,
} from './ask.types';

/**
 * Deterministic answer formatting for planning Ask questions. Pure functions:
 * no DB, no React. Retrieval lives in ask.retrieval.ts; these only shape text.
 */
export function formatProjectStatusAnswer(facts: ProjectStatusFacts): string {
  if (facts.projects.length === 0) return 'No active Projects were found.';
  if (facts.scope === 'single') {
    const project = facts.projects[0];
    const target = project.targetDate ? ` Target date is ${project.targetDate}.` : '';
    return `${project.name} is ${project.status} with ${project.openTodoCount} open Todo${project.openTodoCount === 1 ? '' : 's'}.${target}`;
  }
  return facts.projects
    .map(
      (project) =>
        `${project.name}: ${project.status}, ${project.openTodoCount} open Todo${project.openTodoCount === 1 ? '' : 's'}`,
    )
    .join('; ');
}

export function formatGoalProgressAnswer(facts: GoalProgressFacts): string {
  if (facts.goals.length === 0) return 'No active Goals were found.';
  if (facts.scope === 'single') {
    const goal = facts.goals[0];
    return `${goal.title}: ${goal.progressPercent}% complete (${goal.status}).`;
  }
  return facts.goals.map((goal) => `${goal.title}: ${goal.progressPercent}%`).join('; ');
}

export function formatTodayFocusAnswer(facts: TodayFocusFacts): string {
  const parts: string[] = [];
  if (facts.planIntention) parts.push(`Intention: ${facts.planIntention}.`);
  if (facts.topTodos.length > 0) {
    parts.push(`Top priorities: ${facts.topTodos.map((todo) => todo.title).join(', ')}.`);
  } else {
    parts.push('No top priorities are set for today yet.');
  }
  parts.push(`${facts.pendingTodoCount} pending Todo${facts.pendingTodoCount === 1 ? '' : 's'} today.`);
  return parts.join(' ');
}
