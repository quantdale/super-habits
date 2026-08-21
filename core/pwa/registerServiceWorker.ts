import { Platform } from 'react-native';
import { Workbox } from 'workbox-window';

let registered = false;
let workboxInstance: Workbox | null = null;

type UpdateListener = () => void;

const updateListeners = new Set<UpdateListener>();
const appliedListeners = new Set<UpdateListener>();

function notify(listeners: Set<UpdateListener>) {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error('[pwa] service-worker listener failed', error);
    }
  }
}

/**
 * Web-only. Registers `/sw.js` and watches for a waiting service-worker
 * update. Consumers subscribe with `onServiceWorkerUpdateAvailable` and apply
 * the update via `applyServiceWorkerUpdate` (which posts `SKIP_WAITING` and
 * reloads once the new worker takes control).
 */
export function registerServiceWorker() {
  if (registered || Platform.OS !== 'web') return;
  if (!('serviceWorker' in navigator)) return;

  const wb = new Workbox('/sw.js');

  wb.addEventListener('waiting', () => {
    notify(updateListeners);
  });
  wb.addEventListener('controlling', () => {
    // The new worker took over; reload so the app shell matches the cache.
    notify(appliedListeners);
  });

  void wb.register();
  workboxInstance = wb;
  registered = true;
}

/** Subscribe to "a waiting service-worker update exists". Returns unsubscribe. */
export function onServiceWorkerUpdateAvailable(listener: UpdateListener): () => void {
  if (Platform.OS !== 'web') return () => undefined;
  updateListeners.add(listener);
  return () => {
    updateListeners.delete(listener);
  };
}

/** Subscribe to "the updated service-worker is now controlling the page". */
export function onServiceWorkerUpdateApplied(listener: UpdateListener): () => void {
  if (Platform.OS !== 'web') return () => undefined;
  appliedListeners.add(listener);
  return () => {
    appliedListeners.delete(listener);
  };
}

/**
 * Tells the waiting worker to take over. The reload itself is driven by the
 * `onServiceWorkerUpdateApplied` subscriber (see UpdateAvailableBanner).
 * No-op when there is no registration or no waiting worker.
 */
export function applyServiceWorkerUpdate(): void {
  if (Platform.OS !== 'web' || !workboxInstance) return;
  try {
    void workboxInstance.messageSkipWaiting();
  } catch (error) {
    console.error('[pwa] messageSkipWaiting failed', error);
  }
}
