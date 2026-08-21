import { describe, expect, it } from 'vitest';
import { appendTurnWithinCap } from '@/features/command/askConversationContextValue';
import { ASK_MAX_CONVERSATION_TURNS, type AskConversationTurn } from '@/features/command/ask.types';

function buildTurn(index: number): AskConversationTurn {
  return { question: `q${index}`, answer: `a${index}` };
}

function buildTurns(count: number): AskConversationTurn[] {
  return Array.from({ length: count }, (_, index) => buildTurn(index));
}

describe('appendTurnWithinCap (Ask conversation history bound)', () => {
  it('appends a turn to an empty history', () => {
    expect(appendTurnWithinCap([], buildTurn(1))).toEqual([buildTurn(1)]);
  });

  it('keeps every turn while under the shared cap', () => {
    const turns = buildTurns(ASK_MAX_CONVERSATION_TURNS - 1);
    const next = appendTurnWithinCap(turns, buildTurn(19));

    expect(next).toHaveLength(ASK_MAX_CONVERSATION_TURNS);
    expect(next[0]).toEqual(buildTurn(0));
    expect(next[next.length - 1]).toEqual(buildTurn(19));
  });

  it('drops the oldest turns once the cap is exceeded', () => {
    const turns = buildTurns(ASK_MAX_CONVERSATION_TURNS);
    const next = appendTurnWithinCap(turns, buildTurn(20));

    expect(next).toHaveLength(ASK_MAX_CONVERSATION_TURNS);
    expect(next[0]).toEqual(buildTurn(1));
    expect(next[next.length - 1]).toEqual(buildTurn(20));
    expect(next.map((turn) => turn.question)).not.toContain('q0');
  });

  it('never exceeds the server conversation bound across many appends', () => {
    let turns: AskConversationTurn[] = [];
    for (let index = 0; index < ASK_MAX_CONVERSATION_TURNS * 3; index += 1) {
      turns = appendTurnWithinCap(turns, buildTurn(index));
    }

    expect(turns).toHaveLength(ASK_MAX_CONVERSATION_TURNS);
    expect(turns[0]?.question).toBe(
      `q${ASK_MAX_CONVERSATION_TURNS * 3 - ASK_MAX_CONVERSATION_TURNS}`,
    );
  });

  it('does not mutate the current history array', () => {
    const turns = buildTurns(2);
    const snapshot = [...turns];

    appendTurnWithinCap(turns, buildTurn(2));

    expect(turns).toEqual(snapshot);
  });
});
