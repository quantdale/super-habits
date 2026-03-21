import { describe, expect, it } from "vitest";
import {
  calculateHabitProgress,
  buildDayCompletions,
  calculateCurrentStreak,
  calculateLongestStreak,
  getStreakLabel,
  type DayCompletion,
} from "@/features/habits/habits.domain";

describe("calculateHabitProgress", () => {
  it("returns complete progress when count exceeds target", () => {
    expect(calculateHabitProgress(4, 3)).toBe(1);
  });

  it("returns partial progress when below target", () => {
    expect(calculateHabitProgress(1, 4)).toBe(0.25);
  });
});

function day(dateKey: string, count: number, target: number): DayCompletion {
  return { dateKey, count, completed: target > 0 && count >= target };
}

describe("buildDayCompletions", () => {
  it("returns 30 entries for 30 days", () => {
    const result = buildDayCompletions([], 1, 30);
    expect(result).toHaveLength(30);
  });

  it("marks completed days correctly (strict)", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const fakeCompletion = {
      id: "hcmp_test",
      habit_id: "habit_test",
      date_key: todayKey,
      count: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = buildDayCompletions([fakeCompletion], 2, 30);
    const todayEntry = result.find((d) => d.dateKey === todayKey);
    expect(todayEntry?.completed).toBe(true);
    expect(todayEntry?.count).toBe(2);
  });

  it("marks day as not completed when count < target (strict)", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const fakeCompletion = {
      id: "hcmp_test",
      habit_id: "habit_test",
      date_key: todayKey,
      count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = buildDayCompletions([fakeCompletion], 3, 30);
    const todayEntry = result.find((d) => d.dateKey === todayKey);
    expect(todayEntry?.completed).toBe(false);
  });
});

describe("calculateCurrentStreak", () => {
  it("returns 0 for empty completions", () => {
    expect(calculateCurrentStreak([])).toBe(0);
  });

  it("counts consecutive completed days", () => {
    const days: DayCompletion[] = [
      day("2025-03-18", 1, 1),
      day("2025-03-19", 1, 1),
      day("2025-03-20", 1, 1),
      day("2025-03-21", 0, 1), // today — not yet logged (grace day)
    ];
    expect(calculateCurrentStreak(days)).toBe(3);
  });

  it("breaks streak on missed day", () => {
    const days: DayCompletion[] = [
      day("2025-03-18", 1, 1),
      day("2025-03-19", 0, 1), // missed
      day("2025-03-20", 1, 1),
      day("2025-03-21", 1, 1),
    ];
    expect(calculateCurrentStreak(days)).toBe(2);
  });

  it("returns 0 if no completions at all", () => {
    const days: DayCompletion[] = [
      day("2025-03-20", 0, 1),
      day("2025-03-21", 0, 1),
    ];
    expect(calculateCurrentStreak(days)).toBe(0);
  });
});

describe("calculateLongestStreak", () => {
  it("returns longest run of completed days", () => {
    const days: DayCompletion[] = [
      day("2025-03-15", 1, 1),
      day("2025-03-16", 1, 1),
      day("2025-03-17", 1, 1),
      day("2025-03-18", 0, 1), // break
      day("2025-03-19", 1, 1),
      day("2025-03-20", 1, 1),
    ];
    expect(calculateLongestStreak(days)).toBe(3);
  });

  it("returns 0 for all incomplete days", () => {
    const days: DayCompletion[] = [
      day("2025-03-20", 0, 1),
      day("2025-03-21", 0, 1),
    ];
    expect(calculateLongestStreak(days)).toBe(0);
  });
});

describe("getStreakLabel", () => {
  it("returns empty string for 0 streak", () => {
    expect(getStreakLabel(0)).toBe("");
  });
  it("returns '1 day' for streak of 1", () => {
    expect(getStreakLabel(1)).toBe("1 day");
  });
  it("returns 'N days' for streak > 1", () => {
    expect(getStreakLabel(7)).toBe("7 days");
  });
});
