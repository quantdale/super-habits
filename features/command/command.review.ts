import type { Goal, Habit, Todo, WorkoutRoutine } from '@/core/db/types';
import { getCompletionHistory, listHabits } from '@/features/habits/habits.data';
import {
  getHabitTargetForDate,
  isHabitScheduledOn,
  parseHabitRuleHistory,
} from '@/features/habits/habits.domain';
import { listRoutines } from '@/features/workout/workout.data';
import { listTodos } from '@/features/todos/todos.data';
import { createId } from '@/lib/id';
import { timestampToLocalDateKey, toDateKey } from '@/lib/time';
import { isValidCommandDateKey, validateCommandDraftFields } from './command.validation';
import {
  resolutionMessage,
  resolveHabitReference,
  resolveGoalReference,
  resolveTodoReference,
  resolveWorkoutRoutineReference,
  normalizeEntityReference,
  type EntityResolution,
} from './command.resolver';
import type { DraftAiAction, DraftMissingField, DraftWarning } from './types';

export type CommandPreviewRow = {
  label: string;
  value: string;
};

export type CommandPreview = {
  title: string;
  subtitle: string;
  rows: CommandPreviewRow[];
  warnings: DraftWarning[];
  sideEffect: string | null;
};

export type CommandReviewResolution =
  EntityResolution<Todo> | EntityResolution<Habit> | EntityResolution<WorkoutRoutine> | null;

export type CommandReview = {
  draft: DraftAiAction;
  executionToken: string;
  status: DraftAiAction['status'];
  missingFields: DraftMissingField[];
  resolution: CommandReviewResolution;
  resolvedEntityId: string | null;
  preview: CommandPreview;
};

type ReviewInput = {
  now?: Date;
  /** Local UI choice used to disambiguate duplicate human-facing names. */
  selectedEntityId?: string | null;
};

function uniqueMissingFields(fields: DraftMissingField[]): DraftMissingField[] {
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.field)) return false;
    seen.add(field.field);
    return true;
  });
}

function withStatus(
  draft: DraftAiAction,
  status: DraftAiAction['status'],
  missingFields: DraftMissingField[],
  warnings: DraftWarning[] = draft.warnings,
): DraftAiAction {
  return {
    ...draft,
    status,
    warnings,
    missingFields,
    executionToken: undefined,
  };
}

function makeReview(
  draft: DraftAiAction,
  input: {
    status?: DraftAiAction['status'];
    missingFields?: DraftMissingField[];
    resolution?: CommandReviewResolution;
    resolvedEntityId?: string | null;
    title: string;
    subtitle: string;
    rows: CommandPreviewRow[];
    sideEffect?: string | null;
    warnings?: DraftWarning[];
  },
): CommandReview {
  const missingFields = uniqueMissingFields(input.missingFields ?? draft.missingFields);
  const status = input.status ?? (missingFields.length > 0 ? 'needs_input' : draft.status);
  const nextDraft = withStatus(draft, status, missingFields, input.warnings ?? draft.warnings);
  const executionToken = draft.executionToken ?? createId('cmd');
  nextDraft.executionToken = executionToken;

  return {
    draft: nextDraft,
    executionToken,
    status,
    missingFields,
    resolution: input.resolution ?? null,
    resolvedEntityId: input.resolvedEntityId ?? null,
    preview: {
      title: input.title,
      subtitle: input.subtitle,
      rows: input.rows,
      warnings: input.warnings ?? draft.warnings,
      sideEffect: input.sideEffect ?? null,
    },
  };
}

function fieldMissing(field: string, message: string): DraftMissingField {
  return { field, message };
}

function draftFieldStillMissing(
  draft: DraftAiAction,
  field: string,
  validationMessage: string | null,
): boolean {
  if (field === 'fields') return validationMessage !== null;

  let value: string | number | null | undefined;
  switch (draft.kind) {
    case 'create_todo':
      value = field === 'title' ? draft.fields.title : undefined;
      break;
    case 'create_habit':
      value = field === 'name' ? draft.fields.name : undefined;
      break;
    case 'complete_todo':
      value = field === 'todoTitle' ? draft.fields.todoTitle : undefined;
      break;
    case 'log_habit':
      value = field === 'habitName' ? draft.fields.habitName : undefined;
      break;
    case 'log_calorie_entry':
      value =
        field === 'foodName'
          ? draft.fields.foodName
          : field === 'calories'
            ? draft.fields.calories
            : undefined;
      break;
    case 'log_workout_routine':
      value = field === 'routineName' ? draft.fields.routineName : undefined;
      break;
    case 'start_focus_session':
      value = field === 'durationMinutes' ? draft.fields.durationMinutes : undefined;
      break;
    case 'create_project':
      value = field === 'name' ? draft.fields.name : undefined;
      break;
    case 'update_goal_progress':
      value =
        field === 'goalTitle'
          ? draft.fields.goalTitle
          : field === 'percent'
            ? draft.fields.percent
            : undefined;
      break;
    case 'add_todo_to_daily_plan':
      value = field === 'todoTitle' ? draft.fields.todoTitle : undefined;
      break;
  }
  if (value === undefined) return true;
  return value === null || (typeof value === 'string' && value.trim().length === 0);
}

function prepareCreateReview(draft: DraftAiAction, todayDateKey: string): CommandReview {
  const validationMessage = validateCommandDraftFields(draft);
  const missingFields = [
    ...draft.missingFields.filter((missing) =>
      draftFieldStillMissing(draft, missing.field, validationMessage),
    ),
    ...(validationMessage ? [fieldMissing('fields', validationMessage)] : []),
  ];

  if (draft.kind === 'create_todo') {
    return makeReview(draft, {
      status: missingFields.length > 0 ? 'needs_input' : 'ready',
      missingFields,
      title: 'Create Todo',
      subtitle: 'Nothing has been saved yet.',
      rows: [
        { label: 'Todo', value: draft.fields.title?.trim() || 'Needs a title' },
        { label: 'Due date', value: draft.fields.dueDate ?? 'No due date' },
        { label: 'Priority', value: draft.fields.priority },
      ],
      sideEffect: draft.fields.recurrence
        ? 'Recurring Todo behavior will use the normal Todo path.'
        : null,
    });
  }

  if (draft.kind === 'create_habit') {
    return makeReview(draft, {
      status: missingFields.length > 0 ? 'needs_input' : 'ready',
      missingFields,
      title: 'Create Habit',
      subtitle: 'Nothing has been saved yet.',
      rows: [
        { label: 'Habit', value: draft.fields.name?.trim() || 'Needs a name' },
        { label: 'Target per day', value: String(draft.fields.targetPerDay) },
        { label: 'Category', value: draft.fields.category },
      ],
      sideEffect: 'The normal Habit schedule and reminder defaults will be used.',
    });
  }

  if (draft.kind === 'log_calorie_entry') {
    const consumedOn = draft.fields.consumedOn ?? todayDateKey;
    const mealType = draft.fields.mealType ?? 'breakfast';
    const dateError =
      !isValidCommandDateKey(consumedOn) || consumedOn > todayDateKey
        ? fieldMissing('consumedOn', 'Use today or a valid past local date.')
        : null;
    return makeReview(draft, {
      status: missingFields.length > 0 || dateError ? 'needs_input' : 'ready',
      missingFields: dateError ? [...missingFields, dateError] : missingFields,
      title: 'Log Calories',
      subtitle: 'Only the nutrition values shown here will be recorded.',
      rows: [
        { label: 'Food', value: draft.fields.foodName?.trim() || 'Needs a food name' },
        {
          label: 'Calories',
          value: draft.fields.calories == null ? 'Needs calories' : `${draft.fields.calories} kcal`,
        },
        {
          label: 'Protein',
          value: draft.fields.protein == null ? '0 g (default)' : `${draft.fields.protein} g`,
        },
        {
          label: 'Carbs',
          value: draft.fields.carbs == null ? '0 g (default)' : `${draft.fields.carbs} g`,
        },
        {
          label: 'Fats',
          value: draft.fields.fats == null ? '0 g (default)' : `${draft.fields.fats} g`,
        },
        {
          label: 'Fiber',
          value: draft.fields.fiber == null ? '0 g (default)' : `${draft.fields.fiber} g`,
        },
        { label: 'Meal', value: mealType },
        { label: 'Consumed on', value: consumedOn },
      ],
      sideEffect:
        'The normal calorie ledger and saved-meal maintenance will run after confirmation.',
    });
  }

  if (draft.kind === 'start_focus_session') {
    return makeReview(draft, {
      status: missingFields.length > 0 ? 'needs_input' : 'ready',
      missingFields,
      title: 'Start Focus Session',
      subtitle: 'The live timer has not started yet.',
      rows: [
        {
          label: 'Duration',
          value:
            draft.fields.durationMinutes == null
              ? 'Needs a duration'
              : `${draft.fields.durationMinutes} minutes`,
        },
      ],
      sideEffect: 'The existing Focus timer and notification lifecycle will be used.',
    });
  }

  if (draft.kind === 'create_project') {
    return makeReview(draft, {
      status: missingFields.length > 0 ? 'needs_input' : 'ready',
      missingFields,
      title: 'Create Project',
      subtitle: 'Nothing has been saved yet.',
      rows: [
        { label: 'Project', value: draft.fields.name?.trim() || 'Needs a name' },
        { label: 'Color', value: draft.fields.color ?? 'Default' },
        { label: 'Target date', value: draft.fields.targetDate ?? 'No target date' },
      ],
      sideEffect: null,
    });
  }

  // Entity-backed drafts are prepared in the async path below. This branch is
  // unreachable for the current union, but keeps the function exhaustive if a
  // future create-like action is added.
  return makeReview(draft, {
    status: 'unsupported',
    missingFields: [],
    title: 'Unsupported command',
    subtitle: 'This action is not available in Command Center V2.',
    rows: [],
  });
}

function resolutionReview(
  draft: DraftAiAction,
  resolution: CommandReviewResolution,
  input: {
    title: string;
    subtitle: string;
    rows: CommandPreviewRow[];
    sideEffect?: string | null;
    warnings?: DraftWarning[];
    missingFields?: DraftMissingField[];
  },
): CommandReview {
  const baseMissing = input.missingFields ?? draft.missingFields;
  if (!resolution) {
    return makeReview(draft, { ...input, status: 'needs_input', missingFields: baseMissing });
  }

  if (resolution.status === 'exact') {
    const resolvedMissing = baseMissing.filter((field) => field.field !== 'reference');
    return makeReview(draft, {
      ...input,
      status: resolvedMissing.length > 0 ? 'needs_input' : 'ready',
      missingFields: resolvedMissing,
      resolution,
      resolvedEntityId: resolution.entity.id,
    });
  }

  if (resolution.status === 'already_satisfied') {
    const resolvedMissing = baseMissing.filter((field) => field.field !== 'reference');
    return makeReview(draft, {
      ...input,
      status: resolvedMissing.length > 0 ? 'needs_input' : 'ready',
      missingFields: resolvedMissing,
      resolution,
      resolvedEntityId: resolution.entity.id,
      warnings: [
        ...(input.warnings ?? draft.warnings),
        { code: 'already_satisfied', message: resolutionMessage(resolution, 'item') },
      ],
    });
  }

  const message = resolutionMessage(resolution, 'item');
  const ambiguousMissing = [fieldMissing('reference', message)];
  return makeReview(draft, {
    ...input,
    status: 'needs_input',
    missingFields: [...baseMissing, ...ambiguousMissing],
    resolution,
  });
}

function selectTodoResolution(
  resolution: EntityResolution<Todo>,
  todos: Todo[],
  reference: string | null,
  selectedEntityId: string | null | undefined,
): EntityResolution<Todo> {
  if (!selectedEntityId || !reference) return resolution;
  const selected = todos.find((todo) => todo.id === selectedEntityId);
  if (
    !selected ||
    normalizeEntityReference(selected.title) !== normalizeEntityReference(reference)
  ) {
    return resolution;
  }
  return selected.completed === 1
    ? { status: 'already_satisfied', entity: selected }
    : { status: 'exact', entity: selected };
}

function selectHabitResolution(
  resolution: EntityResolution<Habit>,
  habits: Habit[],
  reference: string | null,
  selectedEntityId: string | null | undefined,
): EntityResolution<Habit> {
  if (!selectedEntityId || !reference) return resolution;
  const selected = habits.find((habit) => habit.id === selectedEntityId);
  if (
    !selected ||
    normalizeEntityReference(selected.name) !== normalizeEntityReference(reference)
  ) {
    return resolution;
  }
  return { status: 'exact', entity: selected };
}

function selectRoutineResolution(
  resolution: EntityResolution<WorkoutRoutine>,
  routines: WorkoutRoutine[],
  reference: string | null,
  selectedEntityId: string | null | undefined,
): EntityResolution<WorkoutRoutine> {
  if (!selectedEntityId || !reference) return resolution;
  const selected = routines.find((routine) => routine.id === selectedEntityId);
  if (
    !selected ||
    normalizeEntityReference(selected.name) !== normalizeEntityReference(reference)
  ) {
    return resolution;
  }
  return { status: 'exact', entity: selected };
}

function selectGoalResolution(
  resolution: EntityResolution<Goal>,
  goals: Goal[],
  reference: string | null,
  selectedEntityId: string | null | undefined,
): EntityResolution<Goal> {
  if (!selectedEntityId || !reference) return resolution;
  const selected = goals.find((goal) => goal.id === selectedEntityId);
  if (!selected || normalizeEntityReference(selected.title) !== normalizeEntityReference(reference)) {
    return resolution;
  }
  return { status: 'exact', entity: selected };
}

export async function prepareCommandReview(
  draft: DraftAiAction,
  input: ReviewInput = {},
): Promise<CommandReview> {
  const now = input.now ?? new Date();
  const todayDateKey = toDateKey(now);
  const fieldError = validateCommandDraftFields(draft);
  if (fieldError && draft.kind !== 'log_calorie_entry') {
    return makeReview(draft, {
      status: 'needs_input',
      missingFields: [fieldMissing('fields', fieldError)],
      title: 'Needs input',
      subtitle: 'Correct the highlighted command details before confirming.',
      rows: [],
    });
  }

  if (
    draft.kind === 'create_todo' ||
    draft.kind === 'create_habit' ||
    draft.kind === 'log_calorie_entry' ||
    draft.kind === 'start_focus_session' ||
    draft.kind === 'create_project'
  ) {
    return prepareCreateReview(draft, todayDateKey);
  }

  if (draft.kind === 'complete_todo') {
    const todos = await listTodos();
    const resolution = selectTodoResolution(
      resolveTodoReference(draft.fields.todoTitle, todos, todos),
      todos,
      draft.fields.todoTitle,
      input.selectedEntityId,
    );
    const entity =
      resolution.status === 'exact' || resolution.status === 'already_satisfied'
        ? resolution.entity
        : null;
    return resolutionReview(draft, resolution, {
      title: 'Complete Todo',
      subtitle: 'The Todo remains unchanged until confirmation.',
      rows: [
        { label: 'Todo', value: entity?.title ?? draft.fields.todoTitle ?? 'Needs a title' },
        { label: 'Current state', value: entity?.completed === 1 ? 'Complete' : 'Incomplete' },
        { label: 'Result', value: entity?.completed === 1 ? 'No change needed' : 'Complete' },
      ],
      sideEffect:
        entity?.recurrence === 'daily'
          ? 'Completing this recurring Todo may create its next occurrence.'
          : 'Normal Todo Linked Actions will run if configured.',
    });
  }

  if (draft.kind === 'log_habit') {
    const habits = await listHabits();
    const resolution = selectHabitResolution(
      resolveHabitReference(draft.fields.habitName, habits, habits),
      habits,
      draft.fields.habitName,
      input.selectedEntityId,
    );
    if (resolution.status !== 'exact') {
      return resolutionReview(draft, resolution, {
        title: 'Log Habit Progress',
        subtitle: 'The Habit remains unchanged until confirmation.',
        rows: [
          { label: 'Habit', value: draft.fields.habitName ?? 'Needs a Habit name' },
          { label: 'Date', value: todayDateKey },
        ],
      });
    }

    const habit = resolution.entity;
    const requestedDate = draft.fields.dateKey ?? todayDateKey;
    const dateMissing =
      requestedDate !== todayDateKey
        ? fieldMissing('dateKey', 'Habit logging is limited to the current local day.')
        : null;
    const creationDateKey = timestampToLocalDateKey(habit.created_at);
    const target = getHabitTargetForDate(
      parseHabitRuleHistory(habit.rule_history),
      todayDateKey,
      habit.target_per_day,
      creationDateKey,
    );
    const scheduled = isHabitScheduledOn(
      parseHabitRuleHistory(habit.rule_history),
      todayDateKey,
      habit.target_per_day,
      creationDateKey,
    );
    const history = await getCompletionHistory(habit.id, 1);
    const currentCount = history.find((row) => row.date_key === todayDateKey)?.count ?? 0;
    const warnings: DraftWarning[] = [];
    if (!scheduled) {
      warnings.push({ code: 'off_day', message: 'This Habit is not scheduled for today.' });
    }
    const missingFields = [
      ...(dateMissing ? [dateMissing] : []),
      ...(!scheduled
        ? [
            fieldMissing(
              'schedule',
              'This Habit is not scheduled today. The normal UI treats this as a rest day.',
            ),
          ]
        : []),
    ];
    const blocked = !scheduled || dateMissing !== null;
    return makeReview(draft, {
      status: blocked ? 'needs_input' : 'ready',
      missingFields,
      resolution,
      resolvedEntityId: habit.id,
      title: 'Log Habit Progress',
      subtitle: 'The Habit remains unchanged until confirmation.',
      rows: [
        { label: 'Habit', value: habit.name },
        { label: 'Date', value: todayDateKey },
        { label: 'Current', value: `${currentCount} / ${target}` },
        { label: 'After', value: `${currentCount + 1} / ${target}` },
      ],
      warnings,
      sideEffect:
        currentCount < target && currentCount + 1 >= target
          ? 'Completing today’s target may trigger normal Linked Actions and reminder reconciliation.'
          : 'Normal reminder reconciliation will run after confirmation.',
    });
  }

  if (draft.kind === 'log_workout_routine') {
    const routines = await listRoutines();
    const resolution = selectRoutineResolution(
      resolveWorkoutRoutineReference(draft.fields.routineName, routines, routines),
      routines,
      draft.fields.routineName,
      input.selectedEntityId,
    );
    const completedDate = draft.fields.completedOn ?? todayDateKey;
    const dateMissing =
      completedDate !== todayDateKey
        ? [fieldMissing('completedOn', 'Workout logging uses the current local context.')]
        : [];
    const entity = resolution.status === 'exact' ? resolution.entity : null;
    return resolutionReview(draft, resolution, {
      title: 'Log Workout',
      subtitle: 'The routine log is created only after confirmation.',
      rows: [
        {
          label: 'Routine',
          value: entity?.name ?? draft.fields.routineName ?? 'Needs a routine name',
        },
        { label: 'Date/time', value: 'Current local context' },
      ],
      missingFields: dateMissing,
      sideEffect: 'No exercise, set, weight, or rep details will be invented.',
    });
  }

  if (draft.kind === 'update_goal_progress') {
    const goals = await listGoals();
    const resolution = selectGoalResolution(
      resolveGoalReference(draft.fields.goalTitle, goals, goals),
      goals,
      draft.fields.goalTitle,
      input.selectedEntityId,
    );
    const entity = resolution.status === 'exact' ? resolution.entity : null;
    return resolutionReview(draft, resolution, {
      title: 'Update Goal Progress',
      subtitle: 'The Goal remains unchanged until confirmation.',
      rows: [
        { label: 'Goal', value: entity?.title ?? draft.fields.goalTitle ?? 'Needs a goal title' },
        {
          label: 'Progress',
          value:
            entity === null
              ? `${draft.fields.percent ?? '?'}%`
              : `${entity.progress_percent}% → ${draft.fields.percent}%`,
        },
      ],
      sideEffect: 'Normal Goal completion status reconciliation will run after confirmation.',
    });
  }

  if (draft.kind === 'add_todo_to_daily_plan') {
    const todos = await listTodos();
    const resolution = selectTodoResolution(
      resolveTodoReference(draft.fields.todoTitle, todos, todos),
      todos,
      draft.fields.todoTitle,
      input.selectedEntityId,
    );
    const entity =
      resolution.status === 'exact' || resolution.status === 'already_satisfied'
        ? resolution.entity
        : null;
    const plannedDate = draft.fields.dateKey ?? todayDateKey;
    return resolutionReview(draft, resolution, {
      title: 'Add Todo to Daily Plan',
      subtitle: 'The plan remains unchanged until confirmation.',
      rows: [
        { label: 'Todo', value: entity?.title ?? draft.fields.todoTitle ?? 'Needs a Todo title' },
        { label: 'Plan date', value: plannedDate },
      ],
      sideEffect: 'The plan keeps at most three top priorities; existing entries are preserved.',
    });
  }

  return makeReview(draft, {
    status: 'unsupported',
    missingFields: [],
    title: 'Unsupported command',
    subtitle: 'This action is not available in Command Center V2.',
    rows: [],
  });
}
