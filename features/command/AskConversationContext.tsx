import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { AskConversationTurn } from './ask.types';

type AskConversationContextValue = {
  turns: AskConversationTurn[];
  addTurn: (turn: AskConversationTurn) => void;
  clearHistory: () => void;
};

const AskConversationContext = createContext<AskConversationContextValue | null>(null);

/**
 * In-memory only, scoped to the app process — not the command center modal.
 * Turns persist across the modal closing/reopening within the same session
 * and are only cleared by this provider remounting (i.e. app cold start).
 */
export function AskConversationProvider({ children }: PropsWithChildren) {
  const [turns, setTurns] = useState<AskConversationTurn[]>([]);

  const addTurn = useCallback((turn: AskConversationTurn) => {
    setTurns((current) => [...current, turn]);
  }, []);

  const clearHistory = useCallback(() => {
    setTurns([]);
  }, []);

  const value = useMemo(() => ({ turns, addTurn, clearHistory }), [turns, addTurn, clearHistory]);

  return (
    <AskConversationContext.Provider value={value}>{children}</AskConversationContext.Provider>
  );
}

export function useAskConversation() {
  const context = useContext(AskConversationContext);
  if (!context) {
    throw new Error('useAskConversation must be used within AskConversationProvider');
  }
  return context;
}
