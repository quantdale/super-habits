/**
 * Shared double-submit guard for async create/edit flows.
 *
 * Process-memory on purpose: durable exactly-once is a sync/outbox concern,
 * not a form concern. A form only needs to guarantee that one activation
 * produces one write while it is in flight.
 *
 * Usage:
 *
 *   const submitGuard = useRef(createSubmitGuard());
 *   const onSave = async () => {
 *     if (!submitGuard.current.tryStart()) return;
 *     try { ...validate, persist, close... }
 *     finally { submitGuard.current.finish(); }
 *   };
 *
 * Call finish() from the caller's finally block so validation/errors do
 * not permanently lock the form.
 */
export function createSubmitGuard(): { tryStart: () => boolean; finish: () => void } {
  let inFlight = false;

  return {
    tryStart: () => {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    finish: () => {
      inFlight = false;
    },
  };
}
