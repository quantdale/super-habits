import { createContext, useContext } from 'react';
import type { AskConversationTurn } from './ask.types';

export type AskConversationContextValue = {
  turns: AskConversationTurn[];
  addTurn: (turn: AskConversationTurn) => void;
  clearHistory: () => void;
};

const AskConversationContext = createContext<AskConversationContextValue | null>(null);

export function useAskConversation(): AskConversationContextValue {
  const context = useContext(AskConversationContext);
  if (!context) {
    throw new Error('useAskConversation must be used within AskConversationProvider');
  }
  return context;
}

export { AskConversationContext };
