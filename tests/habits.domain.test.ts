import { describe, expect, it } from "vitest";
import {
  calculateHabitProgress,
  buildDayCompletions,
  calculateCurrentStreak,
  calculateLongestStreak,
  getStreakLabel,
  buildGridDateHeaders,
  buildHabitGrid,
  calculateOverallConsistency,
  buildHabitActivityDays,
  buildAggregatedHabitHeatmap,
  type DayCompletion,
} from "@/features/habits/habits.domain";
import type { HabitCompletionRow } from "@/features/habits/habits.data";

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

describe("buildGridDateHeaders", () => {
  it("returns 30 headers by default", () => {
    expect(buildGridDateHeaders(30)).toHaveLength(30);
  });

  it("last header is today", () => {
    const headers = buildGridDateHeaders(30);
    const last = headers[headers.length - 1];
    expect(last.isToday).toBe(true);
  });

  it("sets monthLabel only on the 1st of month", () => {
    const headers = buildGridDateHeaders(30);
    for (const h of headers) {
      if (h.monthLabel !== null) {
        expect(Number(h.dayLabel)).toBe(1);
      }
    }
  });
});

describe("buildHabitGrid", () => {
  const habits = [
    { id: "h1", name: "Run", color: "#4f79ff", target_per_day: 1 },
    { id: "h2", name: "Read", color: "#22c55e", target_per_day: 2 },
  ];

  it("returns one row per habit", () => {
    expect(buildHabitGrid(habits, [], 30)).toHaveLength(2);
  });

  it("returns 30 cells per row", () => {
    const grid = buildHabitGrid(habits, [], 30);
    grid.forEach((row) => expect(row.cells).toHaveLength(30));
  });

  it("marks cell as completed when count >= target", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const completions: HabitCompletionRow[] = [{ habit_id: "h1", date_key: todayKey, count: 1 }];
    const grid = buildHabitGrid(habits, completions, 30);
    const h1Row = grid.find((r) => r.habit.id === "h1")!;
    const todayCell = h1Row.cells.find((c) => c.dateKey === todayKey)!;
    expect(todayCell.completed).toBe(true);
    expect(todayCell.partial).toBe(false);
  });

  it("marks cell as partial when 0 < count < target", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const completions: HabitCompletionRow[] = [{ habit_id: "h2", date_key: todayKey, count: 1 }];
    const grid = buildHabitGrid(habits, completions, 30);
    const h2Row = grid.find((r) => r.habit.id === "h2")!;
    const todayCell = h2Row.cells.find((c) => c.dateKey === todayKey)!;
    expect(todayCell.completed).toBe(false);
    expect(todayCell.partial).toBe(true);
  });
});

describe("buildHabitActivityDays", () => {
  it("returns inactive days when grid is empty", () => {
    const days = buildHabitActivityDays([], 14);
    expect(days).toHaveLength(14);
    expect(days.every((d) => !d.active)).toBe(true);
  });

  it("sets active and value from fraction of habits completed that day", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const habits = [
      { id: "h1", name: "Run", color: "#4f79ff", target_per_day: 1 },
      { id: "h2", name: "Read", color: "#22c55e", target_per_day: 1 },
    ];
    const grid = buildHabitGrid(
      habits,
      [{ habit_id: "h1", date_key: todayKey, count: 1 }],
      30,
    );
    const activity = buildHabitActivityDays(grid, 30);
    const todayEntry = activity.find((a) => a.dateKey === todayKey);
    expect(todayEntry?.active).toBe(true);
    expect(todayEntry?.value).toBe(0.5);
  });
});

describe("buildAggregatedHabitHeatmap", () => {
  it("returns all zeros for empty grid with requested length", () => {
    const heat = buildAggregatedHabitHeatmap([], 14);
    expect(heat).toHaveLength(14);
    expect(heat.every((d) => d.value === 0)).toBe(true);
  });

  it("returns value 3 when the single habit is completed that day", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const habits = [{ id: "h1", name: "Run", color: "#4f79ff", target_per_day: 1 }];
    const grid = buildHabitGrid(
      habits,
      [{ habit_id: "h1", date_key: todayKey, count: 1 }],
      30,
    );
    const heat = buildAggregatedHabitHeatmap(grid, 30);
    const todayEntry = heat.find((h) => h.dateKey === todayKey);
    expect(todayEntry?.value).toBe(3);
  });

  it("returns value 1 when fewer than half of habits are completed", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const habits = [
      { id: "h1", name: "Run", color: "#4f79ff", target_per_day: 1 },
      { id: "h2", name: "Read", color: "#22c55e", target_per_day: 1 },
      { id: "h3", name: "Meditate", color: "#f00", target_per_day: 1 },
    ];
    const grid = buildHabitGrid(
      habits,
      [{ habit_id: "h1", date_key: todayKey, count: 1 }],
      30,
    );
    const heat = buildAggregatedHabitHeatmap(grid, 30);
    const todayEntry = heat.find((h) => h.dateKey === todayKey);
    expect(todayEntry?.value).toBe(1);
  });

  it("returns value 2 when exactly half of habits are completed (boundary)", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const habits = [
      { id: "h1", name: "Run", color: "#4f79ff", target_per_day: 1 },
      { id: "h2", name: "Read", color: "#22c55e", target_per_day: 1 },
    ];
    const grid = buildHabitGrid(
      habits,
      [{ habit_id: "h1", date_key: todayKey, count: 1 }],
      30,
    );
    const heat = buildAggregatedHabitHeatmap(grid, 30);
    const todayEntry = heat.find((h) => h.dateKey === todayKey);
    expect(todayEntry?.value).toBe(2);
  });

  it("returns value 2 when both of three habits are completed", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const habits = [
      { id: "h1", name: "A", color: "#4f79ff", target_per_day: 1 },
      { id: "h2", name: "B", color: "#22c55e", target_per_day: 1 },
      { id: "h3", name: "C", color: "#f00", target_per_day: 1 },
    ];
    const grid = buildHabitGrid(
      habits,
      [
        { habit_id: "h1", date_key: todayKey, count: 1 },
        { habit_id: "h2", date_key: todayKey, count: 1 },
      ],
      30,
    );
    const heat = buildAggregatedHabitHeatmap(grid, 30);
    const todayEntry = heat.find((h) => h.dateKey === todayKey);
    expect(todayEntry?.value).toBe(2);
  });
});

describe("calculateOverallConsistency", () => {
  it("returns 0 for empty grid", () => {
    expect(calculateOverallConsistency([])).toBe(0);
  });

  it("calculates percentage of completed past cells", () => {
    const grid = [
      {
        habit: { id: "h1", name: "Run", color: "#fff", target_per_day: 1 },
        cells: [
          { dateKey: "2000-01-01", count: 1, completed: true, partial: false },
          { dateKey: "2000-01-02", count: 0, completed: false, partial: false },
        ],
      },
    ];
    expect(calculateOverallConsistency(grid)).toBe(50);
  });
});
