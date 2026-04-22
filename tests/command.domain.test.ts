import { describe, expect, it } from "vitest";
import {
  parseCommandDraft,
  preflightCommandDraft,
} from "@/features/command/command.domain";

const PARSE_INPUT_BASE = {
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: "en-US",
  timeZone: "Asia/Manila",
  todayDateKey: "2026-04-21",
  tomorrowDateKey: "2026-04-22",
};

describe("features/command/command.domain (v1 rules hardened)", () => {
  it("preflight blocks destructive verbs before any deeper parse path runs", () => {
    const result = preflightCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Delete my todo",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("preflight blocks obvious multi-action commands", () => {
    const result = preflightCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to call mom and pay bills tomorrow",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("preflight blocks recurring phrasing without becoming a full parser", () => {
    const result = preflightCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Create a habit to stretch every day",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("preflight leaves ordinary supported commands alone", () => {
    const result = preflightCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to call mom tomorrow",
    });

    expect(result).toBeNull();
  });

  it("keeps a known-good todo command parsing as ready", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to call mom tomorrow",
    });

    expect(result.outcome).toBe("draft");
    if (result.outcome !== "draft") return;

    expect(result.draft.kind).toBe("create_todo");
    if (result.draft.kind !== "create_todo") return;
    expect(result.draft.status).toBe("ready");
    expect(result.draft.fields.title).toBe("call mom");
    expect(result.draft.fields.dueDate).toBe("2026-04-22");
  });

  it("keeps a known-good habit command parsing as ready", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Create a habit to drink water every morning",
    });

    expect(result.outcome).toBe("draft");
    if (result.outcome !== "draft") return;

    expect(result.draft.kind).toBe("create_habit");
    if (result.draft.kind !== "create_habit") return;
    expect(result.draft.status).toBe("ready");
    expect(result.draft.fields.name).toBe("drink water");
    expect(result.draft.fields.category).toBe("morning");
    expect(result.draft.fields.targetPerDay).toBe(1);
  });

  it.each([
    "Create a habit",
    "Create a habit to",
  ])("treats scaffold-only habit command %p as needs_input", (rawText) => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText,
    });

    expect(result.outcome).toBe("draft");
    if (result.outcome !== "draft") return;

    expect(result.draft.kind).toBe("create_habit");
    if (result.draft.kind !== "create_habit") return;
    expect(result.draft.status).toBe("needs_input");
    expect(result.draft.fields.name).toBeNull();
    expect(result.draft.missingFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "name",
        }),
      ]),
    );
  });

  it.each([
    "Add a todo",
    "Add a task",
    "Create a task",
    "Remind me to",
  ])("treats scaffold-only todo command %p as needs_input", (rawText) => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText,
    });

    expect(result.outcome).toBe("draft");
    if (result.outcome !== "draft") return;

    expect(result.draft.kind).toBe("create_todo");
    if (result.draft.kind !== "create_todo") return;
    expect(result.draft.status).toBe("needs_input");
    expect(result.draft.fields.title).toBeNull();
    expect(result.draft.missingFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "title",
        }),
      ]),
    );
  });

  it("keeps todo-with-time behavior as warning-only when date is supported", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to call mom tomorrow at 7pm",
    });

    expect(result.outcome).toBe("draft");
    if (result.outcome !== "draft") return;

    expect(result.draft.kind).toBe("create_todo");
    if (result.draft.kind !== "create_todo") return;
    expect(result.draft.status).toBe("ready");
    expect(result.draft.fields.title).toBe("call mom");
    expect(result.draft.fields.dueDate).toBe("2026-04-22");
    expect(result.draft.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "todo_time_not_supported",
        }),
      ]),
    );
  });

  it("uses i need to as a guarded todo inference when phrase is task-like", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "I need to call mom tomorrow",
    });

    expect(result.outcome).toBe("draft");
    if (result.outcome !== "draft") return;
    expect(result.draft.kind).toBe("create_todo");
    if (result.draft.kind !== "create_todo") return;
    expect(result.draft.status).toBe("ready");
    expect(result.draft.fields.title).toBe("call mom");
    expect(result.draft.fields.dueDate).toBe("2026-04-22");
  });

  it("rejects i need to phrasing when cadence language makes it habit-like", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "I need to drink water every morning",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("rejects vague i need to phrasing", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "I need to be healthier",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("strips only command-start prefixes and does not strip mid-sentence content", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Remind me to call mom about remind me to buy milk tomorrow",
    });

    expect(result.outcome).toBe("draft");
    if (result.outcome !== "draft") return;
    expect(result.draft.kind).toBe("create_todo");
    if (result.draft.kind !== "create_todo") return;
    expect(result.draft.fields.title).toBe("call mom about remind me to buy milk");
    expect(result.draft.fields.dueDate).toBe("2026-04-22");
  });

  it("returns needs_input when the todo title is missing", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo tomorrow",
    });

    expect(result.outcome).toBe("draft");
    if (result.outcome !== "draft") return;

    expect(result.draft.kind).toBe("create_todo");
    if (result.draft.kind !== "create_todo") return;
    expect(result.draft.status).toBe("needs_input");
    expect(result.draft.fields.title).toBeNull();
    expect(result.draft.missingFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "title",
        }),
      ]),
    );
  });

  it("rejects obvious multi-action commands", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to call mom and pay bills tomorrow",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("rejects mixed todo and habit cues", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Remind me to drink water every morning",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("rejects destructive commands even with polite prefix scaffolding", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Can you delete my todo",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("rejects recurring todo phrasing", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to stretch every day",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("rejects weekday schedule todo phrasing", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to submit report every weekday",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("rejects explicit weekday scheduling phrasing", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to call mom on Monday",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("rejects ambiguous dates like next Friday", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to call mom next Friday",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("rejects ambiguous date words like later", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to call mom later",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("rejects ambiguous date words like someday", () => {
    const result = parseCommandDraft({
      ...PARSE_INPUT_BASE,
      rawText: "Add a todo to call mom someday",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "unsupported",
      }),
    );
  });

  it("parses habit target phrase variants", () => {
    const cases: Array<{ rawText: string; expectedTarget: number }> = [
      { rawText: "Create a habit to stretch once", expectedTarget: 1 },
      { rawText: "Create a habit to stretch once a day", expectedTarget: 1 },
      { rawText: "Create a habit to stretch twice", expectedTarget: 2 },
      { rawText: "Create a habit to stretch 2 times", expectedTarget: 2 },
      { rawText: "Create a habit to stretch 2x", expectedTarget: 2 },
      { rawText: "Create a habit to stretch three times", expectedTarget: 3 },
      { rawText: "Create a habit to stretch 3 times", expectedTarget: 3 },
      { rawText: "Create a habit to stretch 3x", expectedTarget: 3 },
    ];

    for (const testCase of cases) {
      const result = parseCommandDraft({
        ...PARSE_INPUT_BASE,
        rawText: testCase.rawText,
      });

      expect(result.outcome).toBe("draft");
      if (result.outcome !== "draft") continue;
      expect(result.draft.kind).toBe("create_habit");
      if (result.draft.kind !== "create_habit") continue;
      expect(result.draft.status).toBe("ready");
      expect(result.draft.fields.name).toBe("stretch");
      expect(result.draft.fields.targetPerDay).toBe(testCase.expectedTarget);
    }
  });
});
