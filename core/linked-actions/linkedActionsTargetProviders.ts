import type { Href } from "expo-router";
import type {
  LinkedActionFeature,
  LinkedActionTargetEntityType,
} from "@/core/linked-actions/linkedActions.types";
import type {
  LinkedActionTargetCreateNewHandoff,
  LinkedActionTargetPickerCandidate,
  LinkedActionTargetPickerProvider,
} from "@/core/linked-actions/linkedActionsTargetPicker.types";
import { listHabits } from "@/features/habits/habits.data";
import { listTodos } from "@/features/todos/todos.data";
import { listRoutines } from "@/features/workout/workout.data";

const TARGET_FEATURE_HREFS: Record<LinkedActionFeature, Href> = {
  todos: "/(tabs)/todos",
  habits: "/(tabs)/habits",
  calories: "/(tabs)/calories",
  workout: "/(tabs)/workout",
  pomodoro: "/(tabs)/pomodoro",
};

function capitalizeLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createModuleHandoff(input: {
  feature: LinkedActionFeature;
  entityType: LinkedActionTargetEntityType;
  title: string;
  description: string;
  ctaLabel: string;
}): LinkedActionTargetCreateNewHandoff {
  return {
    kind: "module_handoff",
    feature: input.feature,
    entityType: input.entityType,
    title: input.title,
    description: input.description,
    ctaLabel: input.ctaLabel,
    destinationHref: TARGET_FEATURE_HREFS[input.feature],
  };
}

function formatTodoCandidateSubtitle(input: {
  notes: string | null;
  dueDate: string | null;
  priority: "urgent" | "normal" | "low";
  recurrence: "daily" | null;
}) {
  if (input.notes?.trim()) {
    return input.notes.trim();
  }

  const details: string[] = [];
  if (input.priority !== "normal") {
    details.push(capitalizeLabel(input.priority));
  }
  if (input.dueDate) {
    details.push(`Due ${input.dueDate}`);
  }
  if (input.recurrence === "daily") {
    details.push("Repeats daily");
  }

  return details.join(" · ") || undefined;
}

async function loadTodoCandidates(): Promise<LinkedActionTargetPickerCandidate[]> {
  const todos = await listTodos();
  return todos
    .filter((todo) => todo.completed === 0)
    .map((todo) => ({
      id: todo.id,
      title: todo.title,
      subtitle: formatTodoCandidateSubtitle({
        notes: todo.notes,
        dueDate: todo.due_date,
        priority: todo.priority,
        recurrence: todo.recurrence,
      }),
    }));
}

async function loadHabitCandidates(): Promise<LinkedActionTargetPickerCandidate[]> {
  const habits = await listHabits();
  return habits.map((habit) => ({
    id: habit.id,
    title: habit.name,
    subtitle: `${capitalizeLabel(habit.category)} · target ${habit.target_per_day}/day`,
  }));
}

async function loadWorkoutRoutineCandidates(): Promise<LinkedActionTargetPickerCandidate[]> {
  const routines = await listRoutines();
  return routines.map((routine) => ({
    id: routine.id,
    title: routine.name,
    subtitle: routine.description ?? "No description yet",
  }));
}

const LINKED_ACTION_TARGET_PICKER_PROVIDERS: LinkedActionTargetPickerProvider[] = [
  {
    feature: "todos",
    entityType: "todo",
    moduleLabel: "Todos",
    targetLabel: "task",
    existing: {
      supported: true,
      title: "Choose an existing task",
      emptyTitle: "No pending tasks yet",
      emptyDescription: "Create a task first, then come back to select it as the linked target.",
      loadCandidates: loadTodoCandidates,
    },
    createNew: {
      title: "Create a new task",
      description:
        "Version 1 uses an explicit handoff: open Todos, add the task there, then return and pick it.",
      buildHandoff: () =>
        createModuleHandoff({
          feature: "todos",
          entityType: "todo",
          title: "Create a new task",
          description:
            "Open Todos, create the task you want to target, then return here and select it from the existing task list.",
          ctaLabel: "Open Todos",
        }),
    },
  },
  {
    feature: "habits",
    entityType: "habit",
    moduleLabel: "Habits",
    targetLabel: "habit",
    existing: {
      supported: true,
      title: "Choose an existing habit",
      emptyTitle: "No habits yet",
      emptyDescription: "Create a habit first, then select it as the linked target.",
      loadCandidates: loadHabitCandidates,
    },
    createNew: {
      title: "Create a new habit",
      description:
        "Version 1 hands off to the Habits module instead of opening the creation modal from inside Linked Actions.",
      buildHandoff: () =>
        createModuleHandoff({
          feature: "habits",
          entityType: "habit",
          title: "Create a new habit",
          description:
            "Open Habits, create the habit you want to target, then return here and choose it from the existing habit list.",
          ctaLabel: "Open Habits",
        }),
    },
  },
  {
    feature: "workout",
    entityType: "workout_routine",
    moduleLabel: "Workout",
    targetLabel: "routine",
    existing: {
      supported: true,
      title: "Choose an existing workout routine",
      emptyTitle: "No routines yet",
      emptyDescription: "Create a workout routine first, then come back and select it here.",
      loadCandidates: loadWorkoutRoutineCandidates,
    },
    createNew: {
      title: "Create a new workout routine",
      description:
        "Version 1 keeps the workout routine editor in the Workout module and only hands off to it from Linked Actions.",
      buildHandoff: () =>
        createModuleHandoff({
          feature: "workout",
          entityType: "workout_routine",
          title: "Create a new workout routine",
          description:
            "Open Workout, add the routine there, then return here and choose it from the existing routine list.",
          ctaLabel: "Open Workout",
        }),
    },
  },
  {
    feature: "calories",
    entityType: "calorie_log",
    moduleLabel: "Calories",
    targetLabel: "calorie log",
    existing: {
      supported: false,
      title: "Choose an existing calorie log",
      emptyTitle: "This target creates a new log entry",
      emptyDescription:
        "Calorie targets do not point at a long-lived existing item in Version 1. The linked action will create a fresh calorie entry.",
      loadCandidates: async () => [],
    },
    createNew: {
      title: "Start a calorie-entry handoff",
      description:
        "Version 1 keeps calorie entry creation inside the Calories screen and exposes that step as an explicit handoff.",
      buildHandoff: () =>
        createModuleHandoff({
          feature: "calories",
          entityType: "calorie_log",
          title: "Start a calorie-entry handoff",
          description:
            "Open Calories to create the entry details. Full inline creation is intentionally deferred from this first linked-actions scaffold.",
          ctaLabel: "Open Calories",
        }),
    },
  },
  {
    feature: "pomodoro",
    entityType: "pomodoro_session",
    moduleLabel: "Pomodoro",
    targetLabel: "session",
    existing: {
      supported: false,
      title: "Choose an existing session",
      emptyTitle: "This target creates a new session log",
      emptyDescription:
        "Pomodoro targets create a new session record, so there is no reusable existing target item in Version 1.",
      loadCandidates: async () => [],
    },
    createNew: {
      title: "Start a pomodoro handoff",
      description:
        "Version 1 keeps session creation in the Pomodoro module and makes the handoff explicit here.",
      buildHandoff: () =>
        createModuleHandoff({
          feature: "pomodoro",
          entityType: "pomodoro_session",
          title: "Start a pomodoro handoff",
          description:
            "Open Pomodoro to define or run the session context. Full inline creation is intentionally deferred from this first linked-actions scaffold.",
          ctaLabel: "Open Pomodoro",
        }),
    },
  },
];

export function getLinkedActionTargetPickerProviders() {
  return LINKED_ACTION_TARGET_PICKER_PROVIDERS;
}

export function getLinkedActionTargetPickerProvider(
  feature: LinkedActionFeature,
): LinkedActionTargetPickerProvider {
  const provider = LINKED_ACTION_TARGET_PICKER_PROVIDERS.find(
    (candidate) => candidate.feature === feature,
  );

  if (!provider) {
    throw new Error(`No linked action target picker provider registered for ${feature}`);
  }

  return provider;
}
