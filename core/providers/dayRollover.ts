/** Return true only when the local calendar day has changed. */
export function didLocalDayRollOver(previousDayKey: string, currentDayKey: string): boolean {
  return previousDayKey !== currentDayKey;
}

/** Compute the next local midnight using Date's timezone/DST rules. */
export function getNextLocalMidnight(now = new Date()): Date {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
}

export function getMillisecondsUntilNextLocalMidnight(now = new Date()): number {
  return Math.max(1, getNextLocalMidnight(now).getTime() - now.getTime());
}
