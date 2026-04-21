import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from "@/features/habits/habitPresets";
import type { DraftCreateHabit, DraftCreateTodo } from "@/features/command/types";

const { addTodo } = vi.hoisted(() => ({
  addTodo: vi.fn(),
}));

const { addHabit } = vi.hoisted(() => ({
  addHabit: vi.fn(),
}));

const { validateTodo, validateHabit } = vi.hoisted(() => ({
  validateTodo: vi.fn(),
  validateHabit: vi.fn(),
}));

vi.mock("@/features/todos/todos.data", () => ({
  addTodo,
}));

vi.mock("@/features/habits/habits.data", () => ({
  addHabit,
}));

vi.mock("@/lib/validation", () => ({
  validateTodo,
  validateHabit,
}));

import { executeDraftAction } from "@/features/command/command.executor";

function buildTodoDraft(
  overrides: Partial<DraftCreateTodo["fields"]> = {},
): DraftCreateTodo {
  return {
    kind: "create_todo",
    rawText: "Add a todo to call mom tomorrow",
    parserKind: "mock_rules",
    parserVersion: "v1",
    confidence: 0.92,
    status: "ready",
    warnings: [],
    missingFields: [],
    fields: {
      title: "call mom",
      notes: null,
      dueDate: "2026-04-22",
      priority: "normal",
      recurrence: null,
      ...overrides,
    },
  };
}

function buildHabitDraft(
  overrides: Partial<DraftCreateHabit["fields"]> = {},
): DraftCreateHabit {
  return {
    kind: "create_habit",
    rawText: "Create a habit to drink water every morning",
    parserKind: "mock_rules",
    parserVersion: "v1",
    confidence: 0.9,
    status: "ready",
    warnings: [],
    missingFields: [],
    fields: {
      name: "drink water",
      targetPerDay: 1,
      category: "morning",
      icon: null,
      color: null,
      ...overrides,
    },
  };
}

describe("features/command/command.executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addTodo.mockResolvedValue("todo_1");
    addHabit.mockResolvedValue("habit_1");
    validateTodo.mockReturnValue(null);
    validateHabit.mockReturnValue(null);
  });

  it("does not write anything before confirm executes the draft", () => {
    buildTodoDraft();
    buildHabitDraft();

    expect(addTodo).not.toHaveBeenCalled();
    expect(addHabit).not.toHaveBeenCalled();
  });

  it("maps create_todo through validateTodo and addTodo", async () => {
    const result = await executeDraftAction(buildTodoDraft());

    expect(validateTodo).toHaveBeenCalledWith("call mom", "", "2026-04-22");
    expect(addTodo).toHaveBeenCalledWith({
      title: "call mom",
      notes: undefined,
      dueDate: "2026-04-22",
      priority: "normal",
      recurrence: null,
    });
    expect(result).toEqual({
      outcome: "success",
      kind: "create_todo",
      entityId: "todo_1",
      message: "Todo saved.",
    });
  });

  it("uses edited todo values and normalizes empty notes/dueDate", async () => {
    await executeDraftAction(
      buildTodoDraft({
        title: "  call mom now  ",
        notes: "   ",
        dueDate: "",
        priority: "urgent",
      }),
    );

    expect(validateTodo).toHaveBeenCalledWith("call mom now", "", null);
    expect(addTodo).toHaveBeenCalledWith({
      title: "call mom now",
      notes: undefined,
      dueDate: null,
      priority: "urgent",
      recurrence: null,
    });
  });

  it("maps create_habit through validateHabit and addHabit", async () => {
    const result = await executeDraftAction(buildHabitDraft());

    expect(validateHabit).toHaveBeenCalledWith("drink water", 1);
    expect(addHabit).toHaveBeenCalledWith(
      "drink water",
      1,
      "morning",
      DEFAULT_HABIT_ICON,
      DEFAULT_HABIT_COLOR,
    );
    expect(result).toEqual({
      outcome: "success",
      kind: "create_habit",
      entityId: "habit_1",
      message: "Habit saved.",
    });
  });

  it("uses edited habit values in validateHabit and addHabit", async () => {
    await executeDraftAction(
      buildHabitDraft({
        name: "  stretch  ",
        targetPerDay: 3,
        category: "evening",
      }),
    );

    expect(validateHabit).toHaveBeenCalledWith("stretch", 3);
    expect(addHabit).toHaveBeenCalledWith(
      "stretch",
      3,
      "evening",
      DEFAULT_HABIT_ICON,
      DEFAULT_HABIT_COLOR,
    );
  });

  it("does not coerce invalid edited habit targets before validation", async () => {
    validateHabit.mockImplementation((name: string, targetPerDay: number) => {
      if (!name.trim()) return "Habit name is required.";
      if (!Number.isInteger(targetPerDay) || targetPerDay < 1) {
        return "Daily target must be at least 1.";
      }
      return null;
    });

    const result = await executeDraftAction(
      buildHabitDraft({
        targetPerDay: 0,
      }),
    );

    expect(validateHabit).toHaveBeenCalledWith("drink water", 0);
    expect(addHabit).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: "validation_error",
      message: "Daily target must be at least 1.",
    });
  });

  it("blocks execution when validation fails", async () => {
    validateTodo.mockReturnValue("Task title is required.");

    const result = await executeDraftAction(buildTodoDraft({ title: "" }));

    expect(addTodo).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: "validation_error",
      message: "Task title is required.",
    });
  });
});
