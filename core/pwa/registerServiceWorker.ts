import { Platform } from 'react-native';
import { Workbox } from 'workbox-window';

let registered = false;
let workboxInstance: Workbox | null = null;

/** Payload for "the updated service-worker now controls this page". */
export type ServiceWorkerUpdateAppliedEvent = {
  /** True when the controlling worker is an update (not a first claim). */
  isUpdate: boolean;
  /** True when the worker was activated by another tab/instance. */
  isExternal: boolean;
};

type UpdateListener = () => void;
type AppliedListener = (event: ServiceWorkerUpdateAppliedEvent) => void;

const updateListeners = new Set<UpdateListener>();
const appliedListeners = new Set<AppliedListener>();

/**
 * Reload gate (audit AREA 9 F1): set only while THIS tab has asked the
 * waiting worker to take over. workbox-window dispatches `controlling` for
 * *any* controllerchange — first-visit clients.claim() and cross-tab
 * activations included — so listeners may only act when this tab requested
 * the update AND the event is an actual update taking control.
 */
let applyRequested = false;

/** Mirrors registration.waiting between the `waiting` event and apply time. */
let waitingWorkerDetected = false;

/** Long-lived sessions probe for updates at most once per hour (audit F6). */
const UPDATE_CHECK_THROTTLE_MS = 60 * 60 * 1000;
let lastUpdateCheckAt = 0;

function notifyUpdate() {
  for (const listener of updateListeners) {
    try {
      listener();
    } catch (error) {
      console.error('[pwa] service-worker listener failed', error);
    }
  }
}

function notifyApplied(event: ServiceWorkerUpdateAppliedEvent) {
  for (const listener of appliedListeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[pwa] service-worker listener failed', error);
    }
  }
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  if (!workboxInstance) return;
  const now = Date.now();
  if (now - lastUpdateCheckAt < UPDATE_CHECK_THROTTLE_MS) return;
  lastUpdateCheckAt = now;
  workboxInstance.update().catch((error) => {
    console.error('[pwa] update check failed', error);
  });
}

/**
 * Web-only. Registers `/sw.js` and watches for a waiting service-worker
 * update. Consumers subscribe with `onServiceWorkerUpdateAvailable` and apply
 * the update via `applyServiceWorkerUpdate`; the resulting reload happens
 * only in the tab that called it (see the applyRequested gate below).
 */
export function registerServiceWorker() {
  if (registered || Platform.OS !== 'web') return;
  if (!('serviceWorker' in navigator)) return;

  const wb = new Workbox('/sw.js');

  wb.addEventListener('waiting', () => {
    waitingWorkerDetected = true;
    notifyUpdate();
  });
  wb.addEventListener('controlling', (event) => {
    waitingWorkerDetected = false;
    // Reload only for a real update that THIS tab requested. First-visit
    // clients.claim() (isUpdate false) and cross-tab activations
    // (applyRequested false) keep running without interruption; their next
    // load is served by the new worker anyway.
    const requested = applyRequested;
    applyRequested = false;
    if (!requested || event.isUpdate !== true) return;
    notifyApplied({ isUpdate: true, isExternal: event.isExternal === true });
  });

  void wb
    .register()
    .then((registration) => {
      // Reload-during-registration race (WM2.4): register() can resolve
      // undefined; workbox's internal `this._registration.waiting` access
      // then rejects inside this chain. Treated as a retryable noop — the
      // next page load re-attempts registration. No unhandled rejection.
      if (!registration) {
        console.warn(
          '[pwa] service-worker registration resolved undefined (reload race); will retry on next load',
        );
      }
    })
    .catch((error) => {
      // Registration failures (offline, quota, races) must never escape as
      // an unhandled rejection; the next load retries.
      console.error('[pwa] service-worker registration failed', error);
    });
  workboxInstance = wb;
  registered = true;
  // register() already performed an update check; start the throttle window.
  lastUpdateCheckAt = Date.now();

  // Single-page app: after the initial load there are no navigations, so the
  // browser's automatic update checks rarely run for a standalone-PWA window
  // left open for days. Probe for a new worker whenever the document becomes
  // visible again, throttled to once per hour.
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/** Subscribe to "a waiting service-worker update exists". Returns unsubscribe. */
export function onServiceWorkerUpdateAvailable(listener: UpdateListener): () => void {
  if (Platform.OS !== 'web') return () => undefined;
  updateListeners.add(listener);
  if (waitingWorkerDetected) {
    // Replay for subscribers that mounted after the event fired. The
    // register-time dispatch can land before late-mounted UI subscribes on a
    // fast service-worker-cached reload, and a one-shot event would be lost —
    // the banner would never appear until yet another visit.
    try {
      listener();
    } catch (error) {
      console.error('[pwa] service-worker listener failed', error);
    }
  }
  return () => {
    updateListeners.delete(listener);
  };
}

/** Subscribe to "the requested update is now controlling this page". */
export function onServiceWorkerUpdateApplied(listener: AppliedListener): () => void {
  if (Platform.OS !== 'web') return () => undefined;
  appliedListeners.add(listener);
  return () => {
    appliedListeners.delete(listener);
  };
}

/**
 * Tells the waiting worker to take over. Returns whether a waiting worker was
 * actually present — `messageSkipWaiting()` is a silent no-op otherwise
 * (audit AREA 9 F4), and callers use the boolean to fall back to a plain
 * reload instead of wedging on "Updating…". The reload itself is driven by
 * the `onServiceWorkerUpdateApplied` subscriber (see UpdateAvailableBanner)
 * and fires only in the tab that called this function.
 */
export function applyServiceWorkerUpdate(): boolean {
  if (Platform.OS !== 'web' || !workboxInstance) return false;
  if (!waitingWorkerDetected) return false;
  applyRequested = true;
  try {
    workboxInstance.messageSkipWaiting();
  } catch (error) {
    console.error('[pwa] messageSkipWaiting failed', error);
    applyRequested = false;
    return false;
  }
  return true;
}
