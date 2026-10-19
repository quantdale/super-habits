/** Serialize deliveries and suppress replays only after successful handling. */
export function createNotificationResponseQueue(maxHandled = 64) {
  const handled = new Set<string>();
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue(fingerprint: string, dispatch: () => Promise<void>): Promise<void> {
      const task = tail.then(async () => {
        // Admission belongs inside the queue: two listeners may enqueue the same
        // delivery before either dispatch has settled.
        if (handled.has(fingerprint)) return;
        await dispatch();
        handled.add(fingerprint);
        if (handled.size > maxHandled) {
          const oldest = handled.values().next().value;
          if (oldest !== undefined) handled.delete(oldest);
        }
      });
      // A failed delivery remains retryable and cannot poison later deliveries.
      tail = task.catch(() => undefined);
      return task;
    },
  };
}
