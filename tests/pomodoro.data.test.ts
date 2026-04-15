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

describe("features/pomodoro/pomodoro.data linked-actions source dispatch", () => {
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

  it("emits pomodoro.focus_completed for manual focus sessions", async () => {
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
    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "pomodoro",
        entityType: "pomodoro_timer",
        triggerType: "pomodoro.focus_completed",
      }),
    );
  });

  it("does not emit for manual break sessions", async () => {
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

    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
  });

  it("does not re-emit for linked_action-origin sessions", async () => {
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
