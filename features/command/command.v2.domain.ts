import type {
  DraftAiAction,
  DraftCompleteTodo,
  DraftLogCalorieEntry,
  DraftLogHabit,
  DraftLogWorkoutRoutine,
  DraftStartFocusSession,
  DraftWarning,
  ParseCommandInput,
  ParseCommandResult,
} from './types';

const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const CALORIE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:kcal|cal(?:ories)?|cals?)\b/i;
const MACRO_PATTERN =
  /(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(protein|carbs?|carbohydrates|fat|fats|fiber)\b/gi;

function clean(value: string): string | null {
  const result = value
    .replace(/\s+/g, ' ')
    .replace(/^[\s:,-]+|[\s:,-]+$/g, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .trim();
  return result.length > 0 ? result : null;
}

function baseDraft<T extends DraftAiAction>(
  draft: Pick<T, 'kind' | 'fields'> & {
    rawText: string;
    status: T['status'];
    warnings?: DraftWarning[];
    missingFields?: T['missingFields'];
  },
): T {
  return {
    ...draft,
    parserKind: 'mock_rules',
    parserVersion: 'v2',
    confidence: draft.status === 'ready' ? 0.9 : 0.45,
    warnings: draft.warnings ?? [],
    missingFields: draft.missingFields ?? [],
  } as T;
}

function parseTodoCompletion(input: ParseCommandInput): DraftCompleteTodo | null {
  const text = input.rawText.trim();
  const match = text.match(
    /^(?:please\s+)?(?:complete|mark)\s+(.+?)(?:\s+(?:done|complete|completed))?$/i,
  );
  if (!match) return null;

  const todoTitle = clean(match[1].replace(/^(?:a\s+)?(?:todo|task)\s+(?:called\s+)?/i, ''));
  return baseDraft<DraftCompleteTodo>({
    kind: 'complete_todo',
    rawText: input.rawText,
    status: todoTitle ? 'ready' : 'needs_input',
    fields: { todoTitle },
    missingFields: todoTitle
      ? []
      : [{ field: 'todoTitle', message: 'Which Todo should be completed?' }],
  });
}

function parseHabitLog(input: ParseCommandInput): DraftLogHabit | null {
  const text = input.rawText.trim();
  const match = text.match(
    /^(?:please\s+)?(?:did|log|mark|add\s+(?:one|1)\s+to)\s+(.+?)(?:\s+(?:done|complete|completed))?$/i,
  );
  if (!match) return null;
  if (/\b(?:calories?|kcal|workout|routine|focus)\b/i.test(match[1])) return null;

  let habitName = match[1].replace(/\b(?:habit)\b/gi, ' ');
  habitName = habitName.replace(/\b(?:today)\b/gi, ' ');
  const dateMatch = habitName.match(DATE_PATTERN);
  const dateKey = dateMatch?.[0] ?? null;
  if (dateMatch) habitName = habitName.replace(dateMatch[0], ' ');
  const normalizedName = clean(habitName.replace(/^\d+\s+/, ''));
  return baseDraft<DraftLogHabit>({
    kind: 'log_habit',
    rawText: input.rawText,
    status: normalizedName ? 'ready' : 'needs_input',
    fields: { habitName: normalizedName, dateKey },
    missingFields: normalizedName
      ? []
      : [{ field: 'habitName', message: 'Which Habit should be logged?' }],
  });
}

function parseCalorieEntry(input: ParseCommandInput): DraftLogCalorieEntry | null {
  const text = input.rawText.trim();
  if (!/\b(?:ate|had|add|log|record)\b/i.test(text)) return null;
  if (
    !CALORIE_PATTERN.test(text) &&
    !/\b(?:calories?|kcal|nutrition)\b/i.test(text) &&
    !/\b(?:ate|had)\b/i.test(text)
  ) {
    return null;
  }

  const calorieMatch = text.match(CALORIE_PATTERN);
  const calories = calorieMatch ? Number(calorieMatch[1]) : null;
  const macros: Record<'protein' | 'carbs' | 'fats' | 'fiber', number | null> = {
    protein: null,
    carbs: null,
    fats: null,
    fiber: null,
  };
  for (const match of text.matchAll(MACRO_PATTERN)) {
    const key = match[2].toLowerCase();
    const normalizedKey = key.startsWith('protein')
      ? 'protein'
      : key.startsWith('carb')
        ? 'carbs'
        : key.startsWith('fat')
          ? 'fats'
          : 'fiber';
    macros[normalizedKey] = Number(match[1]);
  }

  const lowerText = text.toLowerCase();
  const mealType =
    (['breakfast', 'lunch', 'dinner', 'snack'] as const).find((value) =>
      lowerText.includes(value),
    ) ?? null;
  let foodText = text
    .replace(/^(?:please\s+)?(?:i\s+)?(?:ate|had|add|log|record)\s*/i, '')
    .replace(/^(?:a|an)\s+/, '')
    .replace(/^(?:breakfast|lunch|dinner|snack)\s*:?\s*/i, '');
  foodText = foodText.replace(CALORIE_PATTERN, ' ');
  foodText = foodText.replace(MACRO_PATTERN, ' ');
  foodText = foodText.replace(
    /\b(?:calories?|kcal|cals?|protein|carbs?|carbohydrates|fat|fats|fiber)\b/gi,
    ' ',
  );
  const foodName = clean(foodText);
  const missingFields = [];
  const warnings: DraftWarning[] = [];
  if (!foodName) missingFields.push({ field: 'foodName', message: 'What food should be logged?' });
  if (calories === null) {
    missingFields.push({ field: 'calories', message: 'How many calories?' });
    warnings.push({
      code: 'missing_nutrition',
      message: 'Calories must be supplied; they are never estimated.',
    });
  }

  return baseDraft<DraftLogCalorieEntry>({
    kind: 'log_calorie_entry',
    rawText: input.rawText,
    status: missingFields.length === 0 ? 'ready' : 'needs_input',
    warnings,
    missingFields,
    fields: {
      foodName,
      calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fats: macros.fats,
      fiber: macros.fiber,
      mealType,
      consumedOn: DATE_PATTERN.exec(text)?.[0] ?? null,
    },
  });
}

function parseWorkoutLog(input: ParseCommandInput): DraftLogWorkoutRoutine | null {
  const text = input.rawText.trim();
  const match = text.match(
    /^(?:please\s+)?(?:log\s+(.+?)\s+(?:workout|routine)|i\s+finished\s+(.+)|finished\s+(.+))$/i,
  );
  if (!match) return null;
  const routineName = clean(match[1] ?? match[2] ?? match[3] ?? '');
  return baseDraft<DraftLogWorkoutRoutine>({
    kind: 'log_workout_routine',
    rawText: input.rawText,
    status: routineName ? 'ready' : 'needs_input',
    fields: { routineName, completedOn: null },
    missingFields: routineName
      ? []
      : [{ field: 'routineName', message: 'Which workout routine did you finish?' }],
  });
}

function parseFocusStart(input: ParseCommandInput): DraftStartFocusSession | null {
  const text = input.rawText.trim();
  const hasExplicitStart = /\b(?:start|begin)\b/i.test(text) && /\bfocus\b/i.test(text);
  const hasFocusFor = /^\s*(?:please\s+)?focus\s+for\b/i.test(text);
  if (!hasExplicitStart && !hasFocusFor) return null;
  const durationMatch = text.match(/\b(\d+)\s*(?:minute|minutes|min|mins)\b/i);
  const durationMinutes = durationMatch ? Number(durationMatch[1]) : null;
  return baseDraft<DraftStartFocusSession>({
    kind: 'start_focus_session',
    rawText: input.rawText,
    status: durationMinutes === null ? 'needs_input' : 'ready',
    fields: { durationMinutes },
    missingFields:
      durationMinutes === null
        ? [{ field: 'durationMinutes', message: 'How many minutes should the focus session run?' }]
        : [],
  });
}

function parseProjectCreation(input: ParseCommandInput): DraftCreateProject | null {
  const text = input.rawText.trim();
  const match = text.match(
    /^(?:please\s+)?(?:create|make|add|new)\s+(?:a\s+)?project(?:\s+(?:called|named))?\s+(.+)$/i,
  );
  if (!match) return null;

  let workingText = match[1];
  const dateMatch = workingText.match(DATE_PATTERN);
  let targetDate: string | null = null;
  if (dateMatch) {
    targetDate = dateMatch[0];
    workingText = workingText.replace(dateMatch[0], ' ');
  }
  workingText = workingText.replace(/\b(?:due|by|target(?:\s+date)?)\b/gi, ' ');

  const colorMatch = workingText.match(
    /\b(blue|green|violet|orange|amber|pink|teal|red|indigo|lime)\b/i,
  );
  let color: string | null = null;
  if (colorMatch) {
    color = colorMatch[1].toLowerCase();
    workingText = workingText.replace(colorMatch[0], ' ');
  }

  const name = clean(workingText.replace(/[.,!?;:]+$/g, ''));
  return baseDraft<DraftCreateProject>({
    kind: 'create_project',
    rawText: input.rawText,
    status: name ? 'ready' : 'needs_input',
    fields: { name, color, targetDate },
    missingFields: name ? [] : [{ field: 'name', message: 'What should the project be called?' }],
  });
}

function parseGoalProgressUpdate(input: ParseCommandInput): DraftUpdateGoalProgress | null {
  const text = input.rawText.trim();
  const match = text.match(
    /^(?:please\s+)?(?:set|update)\s+goal\s+(.+?)\s+(?:to|at)\s+(\d{1,3})\s*%$/i,
  );
  if (!match) return null;

  const rawPercent = Number(match[2]);
  const warnings: DraftWarning[] = [];
  if (rawPercent > 100) {
    warnings.push({
      code: 'percent_clamped',
      message: 'Progress was clamped to the 0–100 range.',
    });
  }
  const goalTitle = clean(match[1]);
  return baseDraft<DraftUpdateGoalProgress>({
    kind: 'update_goal_progress',
    rawText: input.rawText,
    status: goalTitle ? 'ready' : 'needs_input',
    warnings,
    fields: { goalTitle, percent: Math.min(100, Math.max(0, rawPercent)) },
    missingFields: goalTitle
      ? []
      : [{ field: 'goalTitle', message: 'Which Goal should be updated?' }],
  });
}

function parseDailyPlanAddition(input: ParseCommandInput): DraftAddTodoToDailyPlan | null {
  const text = input.rawText.trim();
  const match = text.match(
    /^(?:please\s+)?add\s+(.+?)\s+to\s+(?:my\s+)?plan(?:\s+for\s+(today|tomorrow))?$/i,
  );
  if (!match) return null;

  let dateKey: string | null = null;
  if (match[2]) {
    if (match[2].toLowerCase() === 'tomorrow') {
      const nextDay = new Date(input.now);
      nextDay.setDate(nextDay.getDate() + 1);
      dateKey = toDateKey(nextDay);
    } else {
      dateKey = toDateKey(input.now);
    }
  }

  const todoTitle = clean(match[1]);
  return baseDraft<DraftAddTodoToDailyPlan>({
    kind: 'add_todo_to_daily_plan',
    rawText: input.rawText,
    status: todoTitle ? 'ready' : 'needs_input',
    fields: { todoTitle, dateKey },
    missingFields: todoTitle
      ? []
      : [{ field: 'todoTitle', message: 'Which Todo should be added to the plan?' }],
  });
}

export function parseV2CommandDraft(input: ParseCommandInput): ParseCommandResult | null {
  const text = input.rawText.trim();
  if (!text) return null;

  const parsed =
    parseFocusStart(input) ??
    parseCalorieEntry(input) ??
    parseWorkoutLog(input) ??
    parseTodoCompletion(input) ??
    parseHabitLog(input) ??
    parseGoalProgressUpdate(input) ??
    parseDailyPlanAddition(input) ??
    parseProjectCreation(input);
  if (parsed) return { outcome: 'draft', draft: parsed };

  // Preserve existing V1 create parsing for all other text. This branch is
  // intentionally not a catch-all unsupported result.
  return null;
}
