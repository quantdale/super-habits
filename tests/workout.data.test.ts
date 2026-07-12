import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSet,
  completeRoutine,
  logWorkoutFromLinkedAction,
  logWorkoutSession,
  updateSet,
} from "@/features/workout/workout.data";

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { linkedActionsEngine } = vi.hoisted(() => ({
  linkedActionsEngine: {
    processSourceAction: vi.fn(),
  },
}));

vi.mock("@/core/db/client", () => ({
  getDatabase,
}));

vi.mock("@/core/linked-actions/linkedActions.engine", () => ({
  linkedActionsEngine,
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
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
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
      expect.stringContaining("INSERT INTO workout_logs"),
      [
        expect.stringMatching(/^wrk_/),
        "routine_2",
        "Felt strong",
        expect.any(String),
        expect.any(String),
      ],
    );
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
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
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
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  // COR-003: the data layer used to swallow timing-validation failures
  // (addSet returned "" as the id; updateSet silently no-oped), so callers
  // could not distinguish success from rejection.

  it("addSet throws on invalid timing and writes nothing", async () => {
    const db = {
      getFirstAsync: vi.fn(),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      addSet({ exerciseId: "ex_1", setNumber: 1, activeSeconds: 2, restSeconds: 20 }),
    ).rejects.toThrow("Active time must be at least 5 seconds.");
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it("addSet returns a real id for valid timing", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValueOnce({ routine_id: "routine_1" }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const id = await addSet({
      exerciseId: "ex_1",
      setNumber: 1,
      activeSeconds: 40,
      restSeconds: 20,
    });

    expect(id).toMatch(/^eset_/);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO routine_exercise_sets"),
      [id, "ex_1", 1, 40, 20, expect.any(String), expect.any(String)],
    );
  });

  it("updateSet throws on invalid resulting timing and does not update", async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({ active_seconds: 40, rest_seconds: 20 }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(updateSet("eset_1", { restSeconds: 5000 })).rejects.toThrow(
      "Rest time cannot exceed 30 minutes.",
    );
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it("updateSet stays a silent no-op for a missing set (different semantic: target vanished)", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValueOnce(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(updateSet("eset_missing", { activeSeconds: 30 })).resolves.toBeUndefined();
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});
