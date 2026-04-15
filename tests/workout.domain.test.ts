import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatWorkoutTime,
  parseWorkoutTime,
  calculateSessionDuration,
  buildTimerSequence,
  summarizeCompletedSets,
  buildWorkoutActivityDays,
  buildWorkoutFrequency,
  buildWorkoutHeatmapDays,
  computeWorkoutStreakFromHeatmapDays,
} from "@/features/workout/workout.domain";
import type { HeatmapDay } from "@/features/shared/activityTypes";
import type { WorkoutLog } from "@/core/db/types";
import { toDateKey } from "@/lib/time";

function workoutLog(completedAt: string): WorkoutLog {
  return {
    id: "wrk_test1",
    routine_id: "routine_test",
    notes: null,
    completed_at: completedAt,
    created_at: completedAt,
  };
}

describe("formatWorkoutTime", () => {
  it("formats 90 seconds as 1:30", () => {
    expect(formatWorkoutTime(90)).toBe("1:30");
  });
  it("formats 45 seconds as 0:45", () => {
    expect(formatWorkoutTime(45)).toBe("0:45");
  });
  it("formats 0 as 0:00", () => {
    expect(formatWorkoutTime(0)).toBe("0:00");
  });
  it("pads single-digit seconds", () => {
    expect(formatWorkoutTime(65)).toBe("1:05");
  });
});

describe("parseWorkoutTime", () => {
  it('returns 0 for malformed/undefined/null input', () => {
    expect(parseWorkoutTime('abc')).toBe(0);
    expect(parseWorkoutTime(undefined as any)).toBe(0);
    expect(parseWorkoutTime(null as any)).toBe(0);
  });
  it("parses MM:SS string", () => {
    expect(parseWorkoutTime("1:30")).toBe(90);
  });
  it("parses plain seconds string", () => {
    expect(parseWorkoutTime("45")).toBe(45);
  });
  it("returns 0 for invalid input", () => {
    expect(parseWorkoutTime("abc")).toBe(0);
  });
});

describe("calculateSessionDuration", () => {
  it("sums active + rest across all sets and exercises", () => {
    const exercises = [
      { sets: [{ active_seconds: 40, rest_seconds: 20 }] },
      {
        sets: [
          { active_seconds: 30, rest_seconds: 15 },
          { active_seconds: 30, rest_seconds: 15 },
        ],
      },
    ];
    expect(calculateSessionDuration(exercises)).toBe(150);
  });

  it("returns 0 for empty exercises", () => {
    expect(calculateSessionDuration([])).toBe(0);
  });
});

describe("buildTimerSequence", () => {
  const exercises = [
    {
      name: "Rows",
      sets: [
        { set_number: 1, active_seconds: 40, rest_seconds: 20 },
        { set_number: 2, active_seconds: 40, rest_seconds: 20 },
      ],
    },
    {
      name: "Curls",
      sets: [{ set_number: 1, active_seconds: 30, rest_seconds: 15 }],
    },
  ];

  it("builds correct number of phases", () => {
    expect(buildTimerSequence(exercises)).toHaveLength(5);
  });

  it("last phase is active (no rest after final set)", () => {
    const seq = buildTimerSequence(exercises);
    expect(seq[seq.length - 1].phase).toBe("active");
  });

  it("first phase is active", () => {
    expect(buildTimerSequence(exercises)[0].phase).toBe("active");
  });
});

describe("buildWorkoutActivityDays", () => {
  it("marks a day active when a log falls on that local date", () => {
    const iso = new Date().toISOString();
    const logs = [workoutLog(iso)];
    const days = buildWorkoutActivityDays(logs, 30);
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    const d = String(new Date().getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;
    const todayEntry = days.find((x) => x.dateKey === todayKey);
    expect(todayEntry?.active).toBe(true);
  });
});

describe("buildWorkoutFrequency", () => {
  it("returns zero sessions per day when logs are empty", () => {
    const freq = buildWorkoutFrequency([], 14);
    expect(freq).toHaveLength(14);
    expect(freq.every((f) => f.value === 0)).toBe(true);
  });

  it("counts multiple sessions on the same day", () => {
    const iso = new Date().toISOString();
    const freq = buildWorkoutFrequency([workoutLog(iso), workoutLog(iso)], 7);
    expect(freq[0].value).toBe(2);
  });
});

describe("buildWorkoutHeatmapDays", () => {
  it("returns 30 entries and caps intensity at 3", () => {
    const iso = new Date().toISOString();
    const logs = [workoutLog(iso), workoutLog(iso), workoutLog(iso), workoutLog(iso)];
    const heat = buildWorkoutHeatmapDays(logs, 30);
    expect(heat).toHaveLength(30);
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    const d = String(new Date().getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;
    expect(heat.find((h) => h.dateKey === todayKey)?.value).toBe(3);
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 12, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps logs on opposite sides of local midnight on separate days", () => {
    const jan1Key = toDateKey(new Date(2026, 0, 1, 12, 0, 0, 0));
    const jan2Key = toDateKey(new Date(2026, 0, 2, 12, 0, 0, 0));
    const heat = buildWorkoutHeatmapDays(
      [
        workoutLog(new Date(2026, 0, 1, 23, 30, 0, 0).toISOString()),
        workoutLog(new Date(2026, 0, 2, 0, 30, 0, 0).toISOString()),
      ],
      2,
    );

    expect(heat).toEqual([
      { dateKey: jan1Key, value: 1 },
      { dateKey: jan2Key, value: 1 },
    ]);
  });
});

describe("computeWorkoutStreakFromHeatmapDays", () => {
  const days = (...values: number[]): HeatmapDay[] =>
    values.map((value, i) => ({ dateKey: `2025-01-${String(i + 1).padStart(2, "0")}`, value }));

  it("returns 0 for empty heatmap", () => {
    expect(computeWorkoutStreakFromHeatmapDays([])).toBe(0);
  });

  it("counts consecutive active days from the last element (today)", () => {
    expect(computeWorkoutStreakFromHeatmapDays(days(0, 0, 1, 1))).toBe(2);
  });

  it("returns 1 when only the last day is active", () => {
    expect(computeWorkoutStreakFromHeatmapDays(days(0, 0, 1, 0, 1))).toBe(1);
  });

  it("returns 0 when the last day is inactive even if yesterday was active", () => {
    expect(computeWorkoutStreakFromHeatmapDays(days(1, 0))).toBe(0);
  });

  it("treats any value > 0 as active (e.g. intensity 3)", () => {
    expect(computeWorkoutStreakFromHeatmapDays(days(0, 3))).toBe(1);
  });
});

describe("summarizeCompletedSets", () => {
  const exercises = [
    {
      name: "Rows",
      sets: [
        { set_number: 1, active_seconds: 40, rest_seconds: 20 },
        { set_number: 2, active_seconds: 40, rest_seconds: 20 },
      ],
    },
  ];

  it("counts completed active phases per exercise", () => {
    const seq = buildTimerSequence(exercises);
    const summary = summarizeCompletedSets(seq, 0);
    expect(summary).toEqual([{ exerciseName: "Rows", setsCompleted: 1 }]);
  });
});
