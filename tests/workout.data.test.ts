import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeRoutine,
  logWorkoutFromLinkedAction,
  logWorkoutSession,
} from "@/features/workout/workout.data";

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/core/db/client", () => ({
  getDatabase,
}));

describe("features/workout/workout.data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes a workout log for manual quick completion", async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          id: "routine_1",
          name: "Push day",
          deleted_at: null,
        })
        .mockResolvedValueOnce(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await completeRoutine("routine_1", "Solid session");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO workout_logs"),
      [
        expect.stringMatching(/^wrk_/),
        "routine_1",
        "Solid session",
        expect.any(String),
        expect.any(String),
      ],
    );
  });

  it("writes workout session exercise rows for session flow completion", async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          id: "routine_2",
          name: "Leg day",
          deleted_at: null,
        })
        .mockResolvedValueOnce(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await logWorkoutSession({
      routineId: "routine_2",
      notes: "Felt strong",
      exercises: [
        { exerciseName: "Squat", setsCompleted: 3 },
        { exerciseName: "Lunge", setsCompleted: 2 },
      ],
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO workout_session_exercises"),
      [
        expect.stringMatching(/^wsex_/),
        expect.stringMatching(/^wrk_/),
        "Squat",
        3,
        expect.any(String),
      ],
    );
  });

  it("applies linked-action workout log writes without source re-dispatch", async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          id: "routine_3",
          name: "Core day",
          deleted_at: null,
        })
        .mockResolvedValueOnce(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      logWorkoutFromLinkedAction({
        id: "wrk_123",
        routineId: "routine_3",
        notes: null,
      }),
    ).resolves.toMatchObject({
      status: "applied",
      producedEntityId: "wrk_123",
    });
  });
});
