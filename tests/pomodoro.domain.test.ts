import { describe, expect, it } from "vitest";
import {
  nextPomodoroState,
  calculateGrowthProgress,
  getPlantStage,
  formatSessionTime,
  getModeDuration,
  getNextMode,
  getModeLabel,
  parseMinutesSeconds,
  DEFAULT_SETTINGS,
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

describe("getModeDuration", () => {
  it("returns focus duration in seconds", () => {
    expect(getModeDuration("focus", DEFAULT_SETTINGS)).toBe(25 * 60);
  });
  it("returns short break duration in seconds", () => {
    expect(getModeDuration("short_break", DEFAULT_SETTINGS)).toBe(5 * 60);
  });
  it("returns long break duration in seconds", () => {
    expect(getModeDuration("long_break", DEFAULT_SETTINGS)).toBe(15 * 60);
  });
  it("respects custom settings", () => {
    const custom = { ...DEFAULT_SETTINGS, focusMinutes: 50 };
    expect(getModeDuration("focus", custom)).toBe(50 * 60);
  });
});

describe("getNextMode", () => {
  it("focus → short_break when not at long break threshold", () => {
    expect(getNextMode("focus", 1, DEFAULT_SETTINGS)).toBe("short_break");
  });
  it("focus → long_break after 4 focus sessions", () => {
    expect(getNextMode("focus", 4, DEFAULT_SETTINGS)).toBe("long_break");
  });
  it("short_break → focus", () => {
    expect(getNextMode("short_break", 1, DEFAULT_SETTINGS)).toBe("focus");
  });
  it("long_break → focus", () => {
    expect(getNextMode("long_break", 4, DEFAULT_SETTINGS)).toBe("focus");
  });
  it("respects custom sessionsBeforeLongBreak", () => {
    const custom = { ...DEFAULT_SETTINGS, sessionsBeforeLongBreak: 2 };
    expect(getNextMode("focus", 2, custom)).toBe("long_break");
    expect(getNextMode("focus", 1, custom)).toBe("short_break");
  });
});

describe("getModeLabel", () => {
  it("returns correct labels", () => {
    expect(getModeLabel("focus")).toBe("Focus");
    expect(getModeLabel("short_break")).toBe("Short Break");
    expect(getModeLabel("long_break")).toBe("Long Break");
  });
});

describe("parseMinutesSeconds", () => {
  it("parses valid MM:SS", () => {
    expect(parseMinutesSeconds("25:00")).toEqual({ minutes: 25, seconds: 0 });
    expect(parseMinutesSeconds("5:30")).toEqual({ minutes: 5, seconds: 30 });
  });
  it("returns null for invalid input", () => {
    expect(parseMinutesSeconds("abc")).toBeNull();
    expect(parseMinutesSeconds("25")).toBeNull();
    expect(parseMinutesSeconds("5:99")).toBeNull();
  });
});
