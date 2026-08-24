let reconciliationInFlight: Promise<void> | null = null;
let reconciliationRequestedWhileBusy = false;
let reconciliationHandler: (() => Promise<void>) | null = null;

export function setWorkoutReminderReconciliationHandler(
  handler: (() => Promise<void>) | null,
): void {
  reconciliationHandler = handler;
}

export function requestWorkoutReminderReconciliation(): void {
  if (!reconciliationHandler) return;
  if (reconciliationInFlight) {
    reconciliationRequestedWhileBusy = true;
    return;
  }
  reconciliationInFlight = (async () => {
    do {
      reconciliationRequestedWhileBusy = false;
      await reconciliationHandler?.();
    } while (reconciliationRequestedWhileBusy);
  })().finally(() => {
    reconciliationInFlight = null;
  });
}
