/**
 * Bounds a remote phase of app bootstrap so a hung network connection
 * (captive portal, dropped packets, no fetch timeout in supabase-js) can
 * never wedge the startup gate. The underlying task keeps running — its
 * settled result is adopted by the caller whenever it eventually arrives —
 * only the await is bounded.
 */
export const REMOTE_PHASE_TIMEOUT_MS = 10_000;

export async function withRemoteTimeout<T>(task: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[bootstrap] remote phase "${label}" timed out`)),
      REMOTE_PHASE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
