let reconciliationInFlight: Promise<void> | null = null;
let reconciliationRequestedWhileBusy = false;
let reconciliationHandler: (() => Promise<void>) | null = null;

export function setHabitReminderReconciliationHandler(handler: (() => Promise<void>) | null): void {
  reconciliationHandler = handler;
}

/** Coalesce mutation/lifecycle signals into serialized reconciliation passes. */
export function requestHabitReminderReconciliation(): void {
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
