export type PomodoroState = "idle" | "running" | "finished";

export function nextPomodoroState(remainingSeconds: number, isRunning: boolean): PomodoroState {
  if (remainingSeconds <= 0) return "finished";
  if (isRunning) return "running";
  return "idle";
}
