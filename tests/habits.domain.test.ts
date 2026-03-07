import { describe, expect, it } from "vitest";
import { calculateHabitProgress } from "@/features/habits/habits.domain";

describe("calculateHabitProgress", () => {
  it("returns complete progress when count exceeds target", () => {
    expect(calculateHabitProgress(4, 3)).toBe(1);
  });

  it("returns partial progress when below target", () => {
    expect(calculateHabitProgress(1, 4)).toBe(0.25);
  });
});
