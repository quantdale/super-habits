import { type PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { AskConversationContext } from './askConversationContextValue';
import type { AskConversationTurn } from './ask.types';

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
