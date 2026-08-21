import { type PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { AskConversationContext, appendTurnWithinCap } from './askConversationContextValue';
import type { AskConversationTurn } from './ask.types';

/**
 * In-memory only, scoped to the app process — not the command center modal.
 * Turns persist across the modal closing/reopening within the same session
 * and are only cleared by this provider remounting (i.e. app cold start).
 * History is capped at ASK_MAX_CONVERSATION_TURNS (oldest dropped) so requests
 * never exceed the edge function's conversation bound.
 */
export function AskConversationProvider({ children }: PropsWithChildren) {
  const [turns, setTurns] = useState<AskConversationTurn[]>([]);

  const addTurn = useCallback((turn: AskConversationTurn) => {
    setTurns((current) => appendTurnWithinCap(current, turn));
  }, []);

  const clearHistory = useCallback(() => {
    setTurns([]);
  }, []);

  const value = useMemo(() => ({ turns, addTurn, clearHistory }), [turns, addTurn, clearHistory]);

  return (
    <AskConversationContext.Provider value={value}>{children}</AskConversationContext.Provider>
  );
}
