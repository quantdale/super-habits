import { createContext, useContext } from 'react';

export type PomodoroCommandStartResult =
  | { outcome: 'started' | 'queued' }
  | { outcome: 'conflict'; message: string }
  /** Startup was rejected (for example end-notification scheduling threw). */
  | { outcome: 'failed'; message: string };

export type PomodoroTimerRegistration = {
  startFocusSession: (durationMinutes: number) => Promise<PomodoroCommandStartResult>;
  isRunning: boolean;
  isPaused: boolean;
  /**
   * True while a start has been accepted and its end notification is still
   * being scheduled. A startup is a session: a command start must conflict
   * with it instead of queueing a second timer.
   */
  isStarting?: boolean;
};

export type PomodoroCommandBridgeValue = {
  register: (registration: PomodoroTimerRegistration) => () => void;
  requestFocusSession: (durationMinutes: number) => Promise<PomodoroCommandStartResult>;
};

export const PomodoroCommandBridgeContext = createContext<PomodoroCommandBridgeValue | null>(null);

export function usePomodoroCommandBridge(): PomodoroCommandBridgeValue {
  const context = useContext(PomodoroCommandBridgeContext);
  if (!context) {
    throw new Error('usePomodoroCommandBridge must be used within a PomodoroCommandBridgeProvider');
  }
  return context;
}
