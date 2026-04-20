import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  logPomodoroSession,
  logPomodoroSessionFromLinkedAction,
} from "@/features/pomodoro/pomodoro.data";

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

describe("features/pomodoro/pomodoro.data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes pomodoro sessions for manual logs", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await logPomodoroSession(
      "2026-04-16T10:00:00.000Z",
      "2026-04-16T10:25:00.000Z",
      1500,
      "focus",
    );

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO pomodoro_sessions"),
      [
        expect.stringMatching(/^pom_/),
        "2026-04-16T10:00:00.000Z",
        "2026-04-16T10:25:00.000Z",
        1500,
        "focus",
        expect.any(String),
      ],
    );
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  it("writes pomodoro break sessions with the provided session type", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await logPomodoroSession(
      "2026-04-16T11:00:00.000Z",
      "2026-04-16T11:05:00.000Z",
      300,
      "short_break",
    );

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO pomodoro_sessions"),
      expect.arrayContaining(["short_break"]),
    );
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  it("applies linked-action pomodoro writes without source re-dispatch", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue(null),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      logPomodoroSessionFromLinkedAction({
        id: "pom_123",
        durationSeconds: 1500,
        type: "focus",
      }),
    ).resolves.toMatchObject({
      status: "applied",
      producedEntityId: "pom_123",
    });
    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });
});
