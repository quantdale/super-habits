import { describe, expect, it } from "vitest";
import {
  nextPomodoroState,
  calculateGrowthProgress,
  getPlantStage,
  formatSessionTime,
} from "@/features/pomodoro/pomodoro.domain";

describe("nextPomodoroState", () => {
  it("returns finished at zero", () => {
    expect(nextPomodoroState(0, true)).toBe("finished");
  });

  it("returns running when active", () => {
    expect(nextPomodoroState(300, true)).toBe("running");
  });

  it("returns idle when paused and remaining", () => {
    expect(nextPomodoroState(300, false)).toBe("idle");
  });
});

describe("calculateGrowthProgress", () => {
  it("returns 0 at full remaining (just started)", () => {
    expect(calculateGrowthProgress(1500, 1500)).toBe(0);
  });

  it("returns 1 at 0 remaining (complete)", () => {
    expect(calculateGrowthProgress(0, 1500)).toBe(1);
  });

  it("returns 0.5 at halfway", () => {
    expect(calculateGrowthProgress(750, 1500)).toBe(0.5);
  });

  it("clamps to 0 if remaining exceeds total", () => {
    expect(calculateGrowthProgress(2000, 1500)).toBe(0);
  });

  it("clamps to 1 if remaining is negative", () => {
    expect(calculateGrowthProgress(-10, 1500)).toBe(1);
  });
});

describe("getPlantStage", () => {
  it("seed at 0", () => expect(getPlantStage(0)).toBe("seed"));
  it("sprout at 0.2", () => expect(getPlantStage(0.2)).toBe("sprout"));
  it("seedling at 0.5", () => expect(getPlantStage(0.5)).toBe("seedling"));
  it("growing at 0.8", () => expect(getPlantStage(0.8)).toBe("growing"));
  it("grown at 1", () => expect(getPlantStage(1)).toBe("grown"));
});

describe("formatSessionTime", () => {
  it("returns 'Today HH:MM' for today's session", () => {
    const now = new Date().toISOString();
    expect(formatSessionTime(now)).toMatch(/^Today \d{2}:\d{2}$/);
  });

  it("returns 'Mon DD HH:MM' for past sessions", () => {
    const past = "2025-01-15T09:30:00.000Z";
    const result = formatSessionTime(past);
    expect(result).toMatch(/\d{2}:\d{2}$/);
  });
});
