import { parseCommandDraft } from './command.domain';
import type { AiCommandParser, ParseCommandInput, ParseCommandResult } from './types';

export class MockRuleBasedAiCommandParser implements AiCommandParser {
  parse(input: ParseCommandInput): Promise<ParseCommandResult> {
    return Promise.resolve(parseCommandDraft(input));
  }
}

export const mockCommandParser = new MockRuleBasedAiCommandParser();
