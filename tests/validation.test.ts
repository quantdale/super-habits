import { describe, it, expect } from "vitest";
import {
  validateTodo,
  validateHabit,
  validateCalorieEntry,
  validateCalorieComputedKcal,
  validateCalorieGoal,
  validateRoutineName,
  validateExerciseName,
  validateSetTiming,
  validatePomodoroSettings,
} from "@/lib/validation";

describe("validateTodo", () => {
  it("rejects empty title", () => {
    expect(validateTodo("", "")).not.toBeNull();
    expect(validateTodo("   ", "")).not.toBeNull();
  });
  it("accepts valid title", () => {
    expect(validateTodo("Buy groceries", "")).toBeNull();
  });
  it("rejects title over 200 chars", () => {
    expect(validateTodo("A".repeat(201), "")).not.toBeNull();
  });
  it("accepts title of exactly 200 chars", () => {
    expect(validateTodo("A".repeat(200), "")).toBeNull();
  });
  it("rejects invalid due date format", () => {
    expect(validateTodo("Task", "", "03/23/2025")).not.toBeNull();
  });
  it("accepts valid due date", () => {
    expect(validateTodo("Task", "", "2025-03-23")).toBeNull();
  });
});

describe("validateCalorieEntry", () => {
  it("rejects empty food name", () => {
    expect(validateCalorieEntry("", "0", "0", "0", "0")).not.toBeNull();
  });
  it("rejects negative protein", () => {
    expect(validateCalorieEntry("Chicken", "-1", "0", "0", "0")).not.toBeNull();
  });
  it("rejects protein over 999", () => {
    expect(validateCalorieEntry("Chicken", "1000", "0", "0", "0")).not.toBeNull();
  });
  it("accepts valid entry", () => {
    expect(validateCalorieEntry("Chicken", "30", "0", "5", "0")).toBeNull();
  });
});

describe("validateCalorieComputedKcal", () => {
  it("rejects zero", () => {
    expect(validateCalorieComputedKcal(0)).not.toBeNull();
  });
  it("rejects over 9999", () => {
    expect(validateCalorieComputedKcal(10000)).not.toBeNull();
  });
});

describe("validatePomodoroSettings", () => {
  it("rejects focus duration of 0", () => {
    expect(validatePomodoroSettings("0", "5", "15", "4")).not.toBeNull();
  });
  it("rejects focus duration over 120", () => {
    expect(validatePomodoroSettings("121", "5", "15", "4")).not.toBeNull();
  });
  it("rejects sessions < 2", () => {
    expect(validatePomodoroSettings("25", "5", "15", "1")).not.toBeNull();
  });
  it("accepts valid settings", () => {
    expect(validatePomodoroSettings("25", "5", "15", "4")).toBeNull();
  });
});

describe("validateHabit", () => {
  it("rejects empty name", () => {
    expect(validateHabit("", 1)).not.toBeNull();
  });
  it("rejects target_per_day of 0", () => {
    expect(validateHabit("Run", 0)).not.toBeNull();
  });
  it("rejects target_per_day over 99", () => {
    expect(validateHabit("Run", 100)).not.toBeNull();
  });
  it("accepts valid habit", () => {
    expect(validateHabit("Run", 1)).toBeNull();
  });
});

describe("validateRoutineName", () => {
  it("rejects empty", () => {
    expect(validateRoutineName("  ")).not.toBeNull();
  });
  it("accepts valid", () => {
    expect(validateRoutineName("Push Day")).toBeNull();
  });
});

describe("validateExerciseName", () => {
  it("rejects empty", () => {
    expect(validateExerciseName("")).not.toBeNull();
  });
});

describe("validateSetTiming", () => {
  it("rejects active under 5 seconds", () => {
    expect(validateSetTiming(4, 0)).not.toBeNull();
  });
  it("accepts default-like values", () => {
    expect(validateSetTiming(40, 20)).toBeNull();
  });
});

describe("validateCalorieGoal", () => {
  it("rejects calories under 500", () => {
    expect(validateCalorieGoal("400", "0", "0", "0")).not.toBeNull();
  });
  it("accepts valid goal", () => {
    expect(validateCalorieGoal("2000", "150", "200", "65")).toBeNull();
  });
});
