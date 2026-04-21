import { parseCommandDraft } from "./command.domain";
import type { AiCommandParser, ParseCommandInput, ParseCommandResult } from "./types";

export class MockRuleBasedAiCommandParser implements AiCommandParser {
  async parse(input: ParseCommandInput): Promise<ParseCommandResult> {
    return parseCommandDraft(input);
  }
}

export const mockCommandParser = new MockRuleBasedAiCommandParser();
