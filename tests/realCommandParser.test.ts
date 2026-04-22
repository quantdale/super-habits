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
  it("normalizes a remote todo draft into the existing DraftAiAction contract", () => {
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
    });
  });

  it("rejects malformed remote output before it can reach the executor flow", () => {
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
            dueDate: "tomorrow",
            priority: "normal",
          },
        },
        PARSE_INPUT_BASE,
      ),
    ).toThrow("valid YYYY-MM-DD");
  });
});

