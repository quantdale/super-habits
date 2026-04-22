import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParseCommandInput, ParseCommandResult } from "@/features/command/types";

const {
  mockParse,
  remoteParse,
  getAiCommandParseConfig,
  isAiCommandRemoteModeEnabled,
} = vi.hoisted(() => ({
  mockParse: vi.fn<(input: ParseCommandInput) => Promise<ParseCommandResult>>(),
  remoteParse: vi.fn<(input: ParseCommandInput) => Promise<ParseCommandResult>>(),
  getAiCommandParseConfig: vi.fn(),
  isAiCommandRemoteModeEnabled: vi.fn(),
}));

vi.mock("@/features/command/mockCommandParser", () => ({
  mockCommandParser: {
    parse: mockParse,
  },
}));

vi.mock("@/features/command/realCommandParser", () => ({
  realCommandParser: {
    parse: remoteParse,
  },
}));

vi.mock("@/features/command/commandConfig", () => ({
  getAiCommandParseConfig,
  isAiCommandRemoteModeEnabled,
}));

import { CommandParserFacade } from "@/features/command/commandParser";

const PARSE_INPUT_BASE: ParseCommandInput = {
  rawText: "Add a todo to call mom tomorrow",
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: "en-US",
  timeZone: "Asia/Manila",
  todayDateKey: "2026-04-21",
  tomorrowDateKey: "2026-04-22",
};

function buildMockDraftResult(): ParseCommandResult {
  return {
    outcome: "draft",
    draft: {
      kind: "create_todo",
      rawText: PARSE_INPUT_BASE.rawText,
      parserKind: "mock_rules",
      parserVersion: "v1",
      confidence: 0.82,
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
  };
}

describe("features/command/commandParser facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiCommandParseConfig.mockReturnValue({
      mode: "mock",
      backendHost: "supabase_edge",
      supabaseFunctionName: "parse-ai-command",
      customProxyUrl: null,
    });
  });

  it("uses the existing rule parser when remote mode is disabled", async () => {
    isAiCommandRemoteModeEnabled.mockReturnValue(false);
    mockParse.mockResolvedValue(buildMockDraftResult());

    const parser = new CommandParserFacade();
    const result = await parser.parse(PARSE_INPUT_BASE);

    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(remoteParse).not.toHaveBeenCalled();
    expect(result).toEqual(buildMockDraftResult());
  });

  it("falls back to the rule parser when remote parsing is unavailable", async () => {
    isAiCommandRemoteModeEnabled.mockReturnValue(true);
    remoteParse.mockResolvedValue({
      outcome: "unavailable",
      rawText: PARSE_INPUT_BASE.rawText,
      message: "Remote command parsing timed out.",
    });
    mockParse.mockResolvedValue(buildMockDraftResult());

    const parser = new CommandParserFacade();
    const result = await parser.parse(PARSE_INPUT_BASE);
    const mockResult = buildMockDraftResult();
    if (mockResult.outcome !== "draft") {
      throw new Error("Expected a draft result in the facade fallback test.");
    }

    expect(remoteParse).toHaveBeenCalledTimes(1);
    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      outcome: "draft",
      draft: {
        ...mockResult.draft,
        parserKind: "model_proxy_fallback",
      },
    });
  });

  it("keeps remote unsupported separate and does not force a fallback parse", async () => {
    isAiCommandRemoteModeEnabled.mockReturnValue(true);
    remoteParse.mockResolvedValue({
      outcome: "unsupported",
      rawText: PARSE_INPUT_BASE.rawText,
      reason: "Use one create command at a time in this version.",
    });

    const parser = new CommandParserFacade();
    const result = await parser.parse(PARSE_INPUT_BASE);

    expect(remoteParse).toHaveBeenCalledTimes(1);
    expect(mockParse).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: "unsupported",
      rawText: PARSE_INPUT_BASE.rawText,
      reason: "Use one create command at a time in this version.",
    });
  });
});
