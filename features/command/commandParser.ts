import { preflightCommandDraft } from "./command.domain";
import { getAiCommandParseConfig, isAiCommandRemoteModeEnabled } from "./commandConfig";
import { mockCommandParser } from "./mockCommandParser";
import { realCommandParser } from "./realCommandParser";
import type { AiCommandParser, ParseCommandInput, ParseCommandResult } from "./types";

function annotateFallbackResult(result: ParseCommandResult): ParseCommandResult {
  if (result.outcome !== "draft") {
    return result;
  }

  return {
    outcome: "draft",
    draft: {
      ...result.draft,
      parserKind: "model_proxy_fallback",
    },
  };
}

export class CommandParserFacade implements AiCommandParser {
  async parse(input: ParseCommandInput): Promise<ParseCommandResult> {
    const preflight = preflightCommandDraft(input);
    if (preflight) {
      return preflight;
    }

    const config = getAiCommandParseConfig();
    if (!isAiCommandRemoteModeEnabled(config)) {
      return mockCommandParser.parse(input);
    }

    const remoteResult = await realCommandParser.parse(input);
    if (remoteResult.outcome !== "unavailable") {
      return remoteResult;
    }

    try {
      return annotateFallbackResult(await mockCommandParser.parse(input));
    } catch {
      return remoteResult;
    }
  }
}

export const commandParser = new CommandParserFacade();

