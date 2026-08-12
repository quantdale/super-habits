let habitDataRefreshHandler: (() => void) | null = null;

export function setHabitDataRefreshHandler(handler: (() => void) | null): void {
  habitDataRefreshHandler = handler;
}

export function requestHabitDataRefresh(): void {
  habitDataRefreshHandler?.();
}
