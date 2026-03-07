import { describe, expect, it } from "vitest";
import { nextPomodoroState } from "@/features/pomodoro/pomodoro.domain";

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
