import { describe, expect, it } from "vitest";
import { normalizeRemoteParseResponse } from "@/features/command/realCommandParser";

const PARSE_INPUT_BASE = {
  rawText: "Add a todo to call mom tomorrow",
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: "en-US",
  timeZone: "Asia/Manila",
  todayDateKey: "2026-04-21",
  tomorrowDateKey: "2026-04-22",
};

describe("features/command/realCommandParser normalization", () => {
  it("maps model-backed today due dates to the provided todayDateKey", () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: "draft",
        kind: "create_todo",
        status: "ready",
        confidence: 0.91,
        parserVersion: "gpt-test",
        warnings: [],
        missingFields: [],
        fields: {
          title: "call mom",
          notes: null,
          dueDate: "1999-01-01",
          priority: "normal",
        },
      },
      {
        ...PARSE_INPUT_BASE,
        rawText: "Add a todo to call mom today",
      },
    );

    expect(result).toEqual({
      outcome: "draft",
      draft: {
        kind: "create_todo",
        rawText: "Add a todo to call mom today",
        parserKind: "model_proxy",
        parserVersion: "gpt-test",
        confidence: 0.91,
        status: "ready",
        warnings: [],
        missingFields: [],
        fields: {
          title: "call mom",
          notes: null,
          dueDate: "2026-04-21",
          priority: "normal",
          recurrence: null,
        },
      },
    });
  });

  it("maps model-backed tomorrow due dates to the provided tomorrowDateKey", () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: "draft",
        kind: "create_todo",
        status: "ready",
        confidence: 0.91,
        parserVersion: "gpt-test",
        warnings: [],
        missingFields: [],
        fields: {
          title: "call mom",
          notes: null,
          dueDate: "2026-04-22",
          priority: "normal",
        },
      },
      PARSE_INPUT_BASE,
    );

    expect(result).toEqual({
      outcome: "draft",
      draft: {
        kind: "create_todo",
        rawText: "Add a todo to call mom tomorrow",
        parserKind: "model_proxy",
        parserVersion: "gpt-test",
        confidence: 0.91,
        status: "ready",
        warnings: [],
        missingFields: [],
        fields: {
          title: "call mom",
          notes: null,
          dueDate: "2026-04-22",
          priority: "normal",
          recurrence: null,
        },
      },
    });
  });

  it("keeps explicit YYYY-MM-DD due dates authoritative from the raw command text", () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: "draft",
        kind: "create_todo",
        status: "ready",
        confidence: 0.87,
        parserVersion: "gpt-test",
        warnings: [],
        missingFields: [],
        fields: {
          title: "call mom",
          notes: null,
          dueDate: "2026-04-30",
          priority: "normal",
        },
      },
      {
        ...PARSE_INPUT_BASE,
        rawText: "Add a todo to call mom 2026-04-25",
      },
    );

    expect(result).toEqual({
      outcome: "draft",
      draft: {
        kind: "create_todo",
        rawText: "Add a todo to call mom 2026-04-25",
        parserKind: "model_proxy",
        parserVersion: "gpt-test",
        confidence: 0.87,
        status: "ready",
        warnings: [],
        missingFields: [],
        fields: {
          title: "call mom",
          notes: null,
          dueDate: "2026-04-25",
          priority: "normal",
          recurrence: null,
        },
      },
    });
  });

  it("preserves time warnings while resolving authoritative due dates", () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: "draft",
        kind: "create_todo",
        status: "ready",
        confidence: 0.84,
        parserVersion: "gpt-test",
        warnings: [
          {
            code: "todo_time_not_supported",
            message: "Time will not be saved in this version.",
          },
        ],
        missingFields: [],
        fields: {
          title: "call mom",
          notes: null,
          dueDate: null,
          priority: "normal",
        },
      },
      {
        ...PARSE_INPUT_BASE,
        rawText: "Add a todo to call mom tomorrow at 7pm",
      },
    );

    expect(result).toEqual({
      outcome: "draft",
      draft: {
        kind: "create_todo",
        rawText: "Add a todo to call mom tomorrow at 7pm",
        parserKind: "model_proxy",
        parserVersion: "gpt-test",
        confidence: 0.84,
        status: "ready",
        warnings: [
          {
            code: "todo_time_not_supported",
            message: "Time will not be saved in this version.",
          },
        ],
        missingFields: [],
        fields: {
          title: "call mom",
          notes: null,
          dueDate: "2026-04-22",
          priority: "normal",
          recurrence: null,
        },
      },
    });
  });

  it("keeps unsupported separate from technical failure", () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: "unsupported",
        reason: "Use one create command at a time in this version.",
      },
      PARSE_INPUT_BASE,
    );

    expect(result).toEqual({
      outcome: "unsupported",
      rawText: "Add a todo to call mom tomorrow",
      reason: "Use one create command at a time in this version.",
      reasonCode: "unsupported",
    });
  });

  it("rejects invented todo due dates when the command text did not authorize one", () => {
    expect(() =>
      normalizeRemoteParseResponse(
        {
          outcome: "draft",
          kind: "create_todo",
          status: "ready",
          confidence: 0.8,
          warnings: [],
          missingFields: [],
          fields: {
            title: "call mom",
            notes: null,
            dueDate: "2026-04-22",
            priority: "normal",
          },
        },
        {
          ...PARSE_INPUT_BASE,
          rawText: "Add a todo to call mom",
        },
      ),
    ).toThrow("only allowed when the command uses today, tomorrow, or YYYY-MM-DD");
  });

  it("rejects ambiguous supported date directives before accepting a model-backed todo draft", () => {
    expect(() =>
      normalizeRemoteParseResponse(
        {
          outcome: "draft",
          kind: "create_todo",
          status: "ready",
          confidence: 0.8,
          warnings: [],
          missingFields: [],
          fields: {
            title: "call mom",
            notes: null,
            dueDate: "2026-04-22",
            priority: "normal",
          },
        },
        {
          ...PARSE_INPUT_BASE,
          rawText: "Add a todo to call mom today 2026-04-22",
        },
      ),
    ).toThrow("Use at most one due date");
  });
});
