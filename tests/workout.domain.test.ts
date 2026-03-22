import { describe, expect, it } from "vitest";
import {
  formatWorkoutTime,
  parseWorkoutTime,
  calculateSessionDuration,
  buildTimerSequence,
  summarizeCompletedSets,
} from "@/features/workout/workout.domain";

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
