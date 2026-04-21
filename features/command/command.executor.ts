import { addHabit } from "@/features/habits/habits.data";
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from "@/features/habits/habitPresets";
import type { HabitIcon } from "@/features/habits/types";
import { addTodo } from "@/features/todos/todos.data";
import { validateHabit, validateTodo } from "@/lib/validation";
import type {
  CommandExecutionResult,
  DraftAiAction,
  DraftCreateHabit,
  DraftCreateTodo,
} from "./types";

function resolveHabitDefaults(draft: DraftCreateHabit) {
  return {
    name: draft.fields.name?.trim() ?? "",
    targetPerDay: draft.fields.targetPerDay,
    category: draft.fields.category ?? "anytime",
    icon: (draft.fields.icon as HabitIcon | null) ?? DEFAULT_HABIT_ICON,
    color: draft.fields.color ?? DEFAULT_HABIT_COLOR,
  };
}

function resolveTodoFields(draft: DraftCreateTodo) {
  const trimmedDueDate = draft.fields.dueDate?.trim() ?? "";

  return {
    title: draft.fields.title?.trim() ?? "",
    notes: draft.fields.notes?.trim() ?? "",
    dueDate: trimmedDueDate.length > 0 ? trimmedDueDate : null,
    priority: draft.fields.priority,
  };
}

async function executeCreateTodo(draft: DraftCreateTodo): Promise<CommandExecutionResult> {
  const fields = resolveTodoFields(draft);
  const validationMessage = validateTodo(fields.title, fields.notes, fields.dueDate);

  if (validationMessage) {
    return {
      outcome: "validation_error",
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
      outcome: "success",
      kind: "create_todo",
      entityId,
      message: "Todo saved.",
    };
  } catch (error) {
    return {
      outcome: "error",
      message: error instanceof Error ? error.message : "Unable to save the todo.",
    };
  }
}

async function executeCreateHabit(draft: DraftCreateHabit): Promise<CommandExecutionResult> {
  const fields = resolveHabitDefaults(draft);
  const validationMessage = validateHabit(fields.name, fields.targetPerDay);

  if (validationMessage) {
    return {
      outcome: "validation_error",
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
      outcome: "success",
      kind: "create_habit",
      entityId,
      message: "Habit saved.",
    };
  } catch (error) {
    return {
      outcome: "error",
      message: error instanceof Error ? error.message : "Unable to save the habit.",
    };
  }
}

export async function executeDraftAction(
  draft: DraftAiAction,
): Promise<CommandExecutionResult> {
  return draft.kind === "create_todo"
    ? executeCreateTodo(draft)
    : executeCreateHabit(draft);
}
