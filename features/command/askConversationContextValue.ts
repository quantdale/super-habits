import { createContext, useContext } from 'react';
import { ASK_MAX_CONVERSATION_TURNS, type AskConversationTurn } from './ask.types';

export type AskConversationContextValue = {
  turns: AskConversationTurn[];
  addTurn: (turn: AskConversationTurn) => void;
  clearHistory: () => void;
};

/**
 * Appends a turn while enforcing the shared client/server conversation bound
 * (ASK_MAX_CONVERSATION_TURNS): the oldest turns are dropped so the provider
 * can never accumulate more than the edge function accepts.
 */
export function appendTurnWithinCap(
  current: AskConversationTurn[],
  turn: AskConversationTurn,
): AskConversationTurn[] {
  const next = [...current, turn];
  return next.length > ASK_MAX_CONVERSATION_TURNS
    ? next.slice(next.length - ASK_MAX_CONVERSATION_TURNS)
    : next;
}

const AskConversationContext = createContext<AskConversationContextValue | null>(null);

export function useAskConversation(): AskConversationContextValue {
  const context = useContext(AskConversationContext);
  if (!context) {
    throw new Error('useAskConversation must be used within AskConversationProvider');
  }
  return context;
}

export { AskConversationContext };
