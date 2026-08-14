import { createContext, useContext } from 'react';

export type PomodoroCommandStartResult =
  { outcome: 'started' | 'queued' } | { outcome: 'conflict'; message: string };

export type PomodoroTimerRegistration = {
  startFocusSession: (durationMinutes: number) => Promise<PomodoroCommandStartResult>;
  isRunning: boolean;
  isPaused: boolean;
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
