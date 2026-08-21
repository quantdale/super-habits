import { addCalorieEntry } from '@/features/calories/calories.data';
import { addHabit, incrementHabit, listHabits } from '@/features/habits/habits.data';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/features/habits/habitPresets';
import type { HabitIcon } from '@/features/habits/types';
import { isHabitScheduledOn, parseHabitRuleHistory } from '@/features/habits/habits.domain';
import { isActiveHabit } from '@/features/overview/overview.domain';
import { completeRoutine, listRoutines } from '@/features/workout/workout.data';
import { addTodo, completeTodo, listTodos } from '@/features/todos/todos.data';
import { addProject } from '@/features/projects/projects.data';
import { listGoals, setGoalProgress } from '@/features/goals/goals.data';
import { getDailyPlan, setDailyPlanTopTodos } from '@/features/daily-plan/dailyPlan.data';
import { parseTopTodoIds } from '@/features/daily-plan/dailyPlan.domain';
import { MAX_TOP_PRIORITIES } from '@/features/daily-plan/dailyPlan.types';
import { validateHabit, validateTodo } from '@/lib/validation';
import { timestampToLocalDateKey, toDateKey } from '@/lib/time';
import {
  resolveGoalReference,
  resolveTodoReference,
  resolveWorkoutRoutineReference,
} from './command.resolver';
import { validateCommandDraftFields } from './command.validation';
import { COMMAND_PROJECT_COLOR_HEX } from './command.v2.domain';
import type {
  CommandExecutionResult,
  DraftAiAction,
  DraftCreateHabit,
  DraftCreateTodo,
} from './types';

export type FocusStartResult =
  { outcome: 'started' | 'queued' } | { outcome: 'conflict'; message: string };

export type CommandExecutionOptions = {
  resolvedEntityId?: string | null;
  executionToken?: string;
  startFocusSession?: (durationMinutes: number) => Promise<FocusStartResult>;
};

/**
 * Process-memory double-submit guard. This is a UX guard only, not a durable
 * exactly-once mechanism: it resets on app restart and grows by one entry per
 * confirmed command for the session. Integrity comes from the idempotent data
 * layer; remote parsers never supply or control the token (see
 * DraftBase.executionToken in types.ts).
 */
const claimedExecutionTokens = new Set<string>();

function resolveHabitDefaults(draft: DraftCreateHabit) {
  return {
    name: draft.fields.name?.trim() ?? '',
    targetPerDay: draft.fields.targetPerDay,
    category: draft.fields.category ?? 'anytime',
    icon: (draft.fields.icon as HabitIcon | null) ?? DEFAULT_HABIT_ICON,
    color: draft.fields.color ?? DEFAULT_HABIT_COLOR,
  };
}

function resolveTodoFields(draft: DraftCreateTodo) {
  const trimmedDueDate = draft.fields.dueDate?.trim() ?? '';

  return {
    title: draft.fields.title?.trim() ?? '',
    notes: draft.fields.notes?.trim() ?? '',
    dueDate: trimmedDueDate.length > 0 ? trimmedDueDate : null,
    priority: draft.fields.priority,
  };
}

async function executeCreateTodo(draft: DraftCreateTodo): Promise<CommandExecutionResult> {
  const fields = resolveTodoFields(draft);
  const validationMessage = validateTodo(fields.title, fields.notes, fields.dueDate);

  if (validationMessage) {
    return {
      outcome: 'validation_error',
      message: validationMessage,
    };
  }

  try {
    const entityId = await addTodo({
      title: fields.title,
      notes: fields.notes || undefined,
      dueDate: fields.dueDate,
      priority: fields.priority,
      recurrence: null,
    });

    return {
      outcome: 'success',
      kind: 'create_todo',
      entityId,
      message: 'Todo saved.',
    };
  } catch (error) {
    return {
      outcome: 'error',
      message: error instanceof Error ? error.message : 'Unable to save the todo.',
    };
  }
}

async function executeCreateHabit(draft: DraftCreateHabit): Promise<CommandExecutionResult> {
  const fields = resolveHabitDefaults(draft);
  const validationMessage = validateHabit(fields.name, fields.targetPerDay);

  if (validationMessage) {
    return {
      outcome: 'validation_error',
      message: validationMessage,
    };
  }

  try {
    const entityId = await addHabit(
      fields.name,
      fields.targetPerDay,
      fields.category,
      fields.icon,
      fields.color,
    );

    return {
      outcome: 'success',
      kind: 'create_habit',
      entityId,
      message: 'Habit saved.',
    };
  } catch (error) {
    return {
      outcome: 'error',
      message: error instanceof Error ? error.message : 'Unable to save the habit.',
    };
  }
}

async function executeCompleteTodo(
  draft: Extract<DraftAiAction, { kind: 'complete_todo' }>,
  options: CommandExecutionOptions,
): Promise<CommandExecutionResult> {
  let todoId = options.resolvedEntityId ?? null;
  if (!todoId) {
    const todos = await listTodos();
    const resolution = resolveTodoReference(draft.fields.todoTitle, todos, todos);
    if (resolution.status === 'already_satisfied') {
      return {
        outcome: 'success',
        kind: draft.kind,
        entityId: resolution.entity.id,
        message: 'Todo was already complete.',
      };
    }
    if (resolution.status !== 'exact') {
      return { outcome: 'validation_error', message: 'Choose one active Todo before confirming.' };
    }
    todoId = resolution.entity.id;
  }

  const result = await completeTodo(todoId);
  if (result.completed !== 1) {
    return { outcome: 'validation_error', message: 'That Todo is no longer available.' };
  }
  return {
    outcome: 'success',
    kind: draft.kind,
    entityId: todoId,
    message:
      result.linkedActions.matchedRuleCount > 0
        ? 'Todo completed. Linked actions were applied.'
        : 'Todo completed.',
  };
}

async function executeLogHabit(
  draft: Extract<DraftAiAction, { kind: 'log_habit' }>,
  options: CommandExecutionOptions,
): Promise<CommandExecutionResult> {
  const dateKey = draft.fields.dateKey ?? toDateKey();
  if (dateKey !== toDateKey()) {
    return { outcome: 'validation_error', message: 'Habit logging is limited to today.' };
  }
  const habitId = options.resolvedEntityId;
  if (!habitId)
    return { outcome: 'validation_error', message: 'Choose one active Habit before confirming.' };

  const habit = (await listHabits()).find((candidate) => candidate.id === habitId);
  if (!habit) {
    return { outcome: 'validation_error', message: 'That Habit is no longer available.' };
  }
  // Paused/archived habits are not actionable (Area 1 F3): logging against
  // them is refused with the same validation-error contract.
  if (!isActiveHabit(habit)) {
    return {
      outcome: 'validation_error',
      message: `"${habit.name}" is ${habit.status === 'archived' ? 'archived' : 'paused'} — resume it before logging.`,
    };
  }
  if (
    !isHabitScheduledOn(
      parseHabitRuleHistory(habit.rule_history),
      dateKey,
      habit.target_per_day,
      timestampToLocalDateKey(habit.created_at),
    )
  ) {
    return {
      outcome: 'validation_error',
      message: 'This Habit is not scheduled for today.',
    };
  }

  const result = await incrementHabit(habitId, dateKey);
  if (result.count < 1) {
    return { outcome: 'validation_error', message: 'That Habit is no longer available.' };
  }
  return {
    outcome: 'success',
    kind: draft.kind,
    entityId: habitId,
    message:
      result.linkedActions.matchedRuleCount > 0
        ? 'Habit progress logged. Linked actions were applied.'
        : 'Habit progress logged.',
  };
}

async function executeLogCalories(
  draft: Extract<DraftAiAction, { kind: 'log_calorie_entry' }>,
): Promise<CommandExecutionResult> {
  const fields = draft.fields;
  const consumedOn = fields.consumedOn ?? toDateKey();
  if (consumedOn > toDateKey()) {
    return {
      outcome: 'validation_error',
      message: 'Calorie logging is limited to today or a past local date.',
    };
  }
  const validationMessage = validateCommandDraftFields({
    ...draft,
    fields: { ...fields, consumedOn },
  });
  if (validationMessage) return { outcome: 'validation_error', message: validationMessage };

  try {
    await addCalorieEntry({
      foodName: fields.foodName?.trim() ?? '',
      calories: fields.calories ?? 0,
      protein: fields.protein ?? undefined,
      carbs: fields.carbs ?? undefined,
      fats: fields.fats ?? undefined,
      fiber: fields.fiber ?? undefined,
      mealType: fields.mealType ?? 'breakfast',
      consumedOn,
    });
    return {
      outcome: 'success',
      kind: draft.kind,
      entityId: null,
      message: 'Calorie entry logged.',
    };
  } catch (error) {
    return {
      outcome: 'error',
      message: error instanceof Error ? error.message : 'Unable to log the calorie entry.',
    };
  }
}

async function executeLogWorkout(
  draft: Extract<DraftAiAction, { kind: 'log_workout_routine' }>,
  options: CommandExecutionOptions,
): Promise<CommandExecutionResult> {
  if (draft.fields.completedOn !== null && draft.fields.completedOn !== toDateKey()) {
    return {
      outcome: 'validation_error',
      message: 'Workout logging uses the current local context.',
    };
  }
  let routineId = options.resolvedEntityId ?? null;
  if (!routineId) {
    const routines = await listRoutines();
    const resolution = resolveWorkoutRoutineReference(draft.fields.routineName, routines, routines);
    if (resolution.status !== 'exact') {
      return {
        outcome: 'validation_error',
        message: 'Choose one active workout routine before confirming.',
      };
    }
    routineId = resolution.entity.id;
  }
  try {
    const result = await completeRoutine(routineId);
    if (result.status !== 'applied') {
      return {
        outcome: 'validation_error',
        message: 'That workout routine is no longer available.',
      };
    }
    return {
      outcome: 'success',
      kind: draft.kind,
      entityId: routineId,
      message: 'Workout logged.',
    };
  } catch (error) {
    return {
      outcome: 'error',
      message: error instanceof Error ? error.message : 'Unable to log the workout.',
    };
  }
}

async function executeStartFocus(
  draft: Extract<DraftAiAction, { kind: 'start_focus_session' }>,
  options: CommandExecutionOptions,
): Promise<CommandExecutionResult> {
  if (!options.startFocusSession || draft.fields.durationMinutes === null) {
    return { outcome: 'validation_error', message: 'Focus duration is required.' };
  }
  const result = await options.startFocusSession(draft.fields.durationMinutes);
  if (result.outcome === 'conflict') {
    return { outcome: 'conflict', message: result.message };
  }
  return {
    outcome: 'success',
    kind: draft.kind,
    entityId: null,
    message:
      result.outcome === 'queued' ? 'Focus session queued to start.' : 'Focus session started.',
  };
}

// Hex map keyed by the canonical color vocabulary exported from
// command.v2.domain.ts so parser and executor share one list.
function resolveProjectColor(colorName: string | null): string | undefined {
  if (!colorName) return undefined;
  return COMMAND_PROJECT_COLOR_HEX[colorName.trim().toLowerCase()];
}

async function executeCreateProject(
  draft: Extract<DraftAiAction, { kind: 'create_project' }>,
): Promise<CommandExecutionResult> {
  const name = draft.fields.name?.trim() ?? '';
  if (!name) {
    return { outcome: 'validation_error', message: 'Add the project name before continuing.' };
  }

  try {
    const entityId = await addProject({
      name,
      color: resolveProjectColor(draft.fields.color),
      targetDate: draft.fields.targetDate,
    });
    return {
      outcome: 'success',
      kind: draft.kind,
      entityId,
      message: 'Project created.',
    };
  } catch (error) {
    return {
      outcome: 'error',
      message: error instanceof Error ? error.message : 'Unable to create the project.',
    };
  }
}

async function executeUpdateGoalProgress(
  draft: Extract<DraftAiAction, { kind: 'update_goal_progress' }>,
  options: CommandExecutionOptions,
): Promise<CommandExecutionResult> {
  let goalId = options.resolvedEntityId ?? null;
  if (!goalId) {
    const goals = await listGoals();
    const resolution = resolveGoalReference(draft.fields.goalTitle, goals, goals);
    if (resolution.status !== 'exact') {
      return { outcome: 'validation_error', message: 'Choose one active Goal before confirming.' };
    }
    goalId = resolution.entity.id;
  }

  const percent = draft.fields.percent;
  if (percent === null) {
    return { outcome: 'validation_error', message: 'Goal progress percent is required.' };
  }

  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));
  try {
    await setGoalProgress(goalId, clampedPercent);
    return {
      outcome: 'success',
      kind: draft.kind,
      entityId: goalId,
      message: `Goal progress set to ${clampedPercent}%.`,
    };
  } catch (error) {
    return {
      outcome: 'error',
      message: error instanceof Error ? error.message : 'Unable to update the goal.',
    };
  }
}

async function executeAddTodoToDailyPlan(
  draft: Extract<DraftAiAction, { kind: 'add_todo_to_daily_plan' }>,
  options: CommandExecutionOptions,
): Promise<CommandExecutionResult> {
  const dateKey = draft.fields.dateKey ?? toDateKey();
  let todoId = options.resolvedEntityId ?? null;
  if (!todoId) {
    const todos = await listTodos();
    const resolution = resolveTodoReference(draft.fields.todoTitle, todos, todos);
    if (resolution.status !== 'exact') {
      return { outcome: 'validation_error', message: 'Choose one active Todo before confirming.' };
    }
    todoId = resolution.entity.id;
  }

  const plan = await getDailyPlan(dateKey);
  const existingIds = plan ? parseTopTodoIds(plan.top_todo_ids) : [];
  if (existingIds.includes(todoId)) {
    return { outcome: 'duplicate', message: 'That Todo is already on the daily plan.' };
  }
  if (existingIds.length >= MAX_TOP_PRIORITIES) {
    return {
      outcome: 'validation_error',
      message: `The daily plan already has ${MAX_TOP_PRIORITIES} top priorities.`,
    };
  }

  await setDailyPlanTopTodos(dateKey, [...existingIds, todoId]);
  return {
    outcome: 'success',
    kind: draft.kind,
    entityId: todoId,
    message: 'Todo added to the daily plan.',
  };
}

export async function executeDraftAction(
  draft: DraftAiAction,
  options: CommandExecutionOptions = {},
): Promise<CommandExecutionResult> {
  if (draft.status !== 'ready') {
    return {
      outcome: 'validation_error',
      message: 'Review and complete the missing command details first.',
    };
  }

  const validationMessage = validateCommandDraftFields(draft);
  if (validationMessage) return { outcome: 'validation_error', message: validationMessage };

  const token = options.executionToken ?? draft.executionToken;
  if (token && claimedExecutionTokens.has(token)) {
    return { outcome: 'duplicate', message: 'This command has already been submitted.' };
  }
  if (token) claimedExecutionTokens.add(token);

  try {
    let result: CommandExecutionResult;
    switch (draft.kind) {
      case 'create_todo':
        result = await executeCreateTodo(draft);
        break;
      case 'create_habit':
        result = await executeCreateHabit(draft);
        break;
      case 'complete_todo':
        result = await executeCompleteTodo(draft, options);
        break;
      case 'log_habit':
        result = await executeLogHabit(draft, options);
        break;
      case 'log_calorie_entry':
        result = await executeLogCalories(draft);
        break;
      case 'log_workout_routine':
        result = await executeLogWorkout(draft, options);
        break;
      case 'start_focus_session':
        result = await executeStartFocus(draft, options);
        break;
      case 'create_project':
        result = await executeCreateProject(draft);
        break;
      case 'update_goal_progress':
        result = await executeUpdateGoalProgress(draft, options);
        break;
      case 'add_todo_to_daily_plan':
        result = await executeAddTodoToDailyPlan(draft, options);
        break;
    }

    if (token && result.outcome !== 'success' && result.outcome !== 'duplicate') {
      claimedExecutionTokens.delete(token);
    }
    return result;
  } catch (error) {
    if (token) claimedExecutionTokens.delete(token);
    return {
      outcome: 'error',
      message: error instanceof Error ? error.message : 'Unable to execute this command.',
    };
  }
}
