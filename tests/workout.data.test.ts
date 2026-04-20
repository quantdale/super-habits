import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeRoutine,
  logWorkoutFromLinkedAction,
  logWorkoutSession,
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

describe("features/workout/workout.data linked-actions source dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      mode: "apply",
      sourceEvent: {},
      matchedRuleCount: 0,
      effects: [],
      notices: [],
    });
  });

  it("emits workout.completed after manual quick completion", async () => {
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
    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "workout",
        entityType: "workout_routine",
        entityId: "routine_1",
        triggerType: "workout.completed",
        sourceRecordId: expect.stringMatching(/^wrk_/),
      }),
    );
  });

  it("emits workout.completed after session flow completion", async () => {
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
    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "workout",
        triggerType: "workout.completed",
        entityId: "routine_2",
      }),
    );
  });

  it("does not re-emit from linked_action-origin workout writes", async () => {
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
});
