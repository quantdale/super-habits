import { useCallback, useRef, type PropsWithChildren } from 'react';
import {
  PomodoroCommandBridgeContext,
  type PomodoroCommandStartResult,
  type PomodoroTimerRegistration,
} from './pomodoroCommandBridgeContext';

type PendingFocusRequest = {
  durationMinutes: number;
  resolve: (result: PomodoroCommandStartResult) => void;
};

export function PomodoroCommandBridgeProvider({ children }: PropsWithChildren) {
  const registrationRef = useRef<PomodoroTimerRegistration | null>(null);
  const pendingRef = useRef<PendingFocusRequest | null>(null);

  const register = useCallback((registration: PomodoroTimerRegistration) => {
    registrationRef.current = registration;
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      void registration.startFocusSession(pending.durationMinutes).then(pending.resolve);
    }

    return () => {
      if (registrationRef.current === registration) {
        registrationRef.current = null;
      }
    };
  }, []);

  const requestFocusSession = useCallback((durationMinutes: number) => {
    const registration = registrationRef.current;
    if (registration) {
      // A startup counts as an active session: the timer owns its clock from
      // the moment the press is accepted, before its end notification has
      // finished scheduling.
      if (registration.isRunning || registration.isPaused || registration.isStarting) {
        return Promise.resolve({
          outcome: 'conflict',
          message: 'A focus session is already running or paused.',
        } satisfies PomodoroCommandStartResult);
      }
      return registration.startFocusSession(durationMinutes);
    }

    if (pendingRef.current) {
      return Promise.resolve({
        outcome: 'conflict',
        message: 'A focus start request is already waiting for the Focus screen.',
      } satisfies PomodoroCommandStartResult);
    }

    return new Promise<PomodoroCommandStartResult>((resolve) => {
      pendingRef.current = { durationMinutes, resolve };
    });
  }, []);

  return (
    <PomodoroCommandBridgeContext.Provider value={{ register, requestFocusSession }}>
      {children}
    </PomodoroCommandBridgeContext.Provider>
  );
}
