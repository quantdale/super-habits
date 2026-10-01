/**
 * Foreground signal registration shared by `useForegroundRefresh`.
 *
 * Why this module exists: on web, react-native-web's `AppState` re-emits
 * `change` from the very same `visibilitychange` DOM event. Registering BOTH
 * therefore invokes a consumer's refresh twice for one foreground transition —
 * every mounted section screen plus `GamificationProvider` doubles its query and
 * aggregate batch on the J8 section-switch hot path. The DOM listener is only
 * useful on a platform that has a `document` whose `AppState` is NOT derived
 * from that event, so it is registered behind exactly that condition.
 *
 * Extracted from the hook so the registration contract (how many listeners, and
 * how many refreshes one foreground produces) is executable without a React
 * renderer — the repository has none, and this is behavioural coverage, not a
 * render-count assertion.
 */

/** Minimal `AppState` surface the registration needs. */
export type ForegroundAppState = {
  addEventListener: (type: 'change', handler: (state: string) => void) => { remove: () => void };
};

/** Minimal `document` surface the registration needs. */
export type ForegroundDocument = {
  visibilityState: string;
  addEventListener: (type: string, handler: () => void) => void;
  removeEventListener: (type: string, handler: () => void) => void;
};

export type ForegroundListenerDeps = {
  appState: ForegroundAppState;
  /**
   * True when this platform's `AppState` is itself driven by the DOM
   * `visibilitychange` event (web). On such a platform the DOM listener is a
   * duplicate of the `AppState` listener and must not be registered.
   */
  appStateIsDomDriven: boolean;
  /** Present on web-like platforms only. */
  document?: ForegroundDocument;
};

/**
 * Register the foreground listeners for one consumer and return the cleanup.
 *
 * Exactly ONE refresh is delivered per foreground transition: the `AppState`
 * listener always, plus the DOM listener only when `AppState` is not already
 * DOM-driven.
 */
export function registerForegroundListeners(
  onForeground: () => void,
  deps: ForegroundListenerDeps,
): () => void {
  const appStateSubscription = deps.appState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      onForeground();
    }
  });

  const handleVisibilityChange = () => {
    if (deps.document?.visibilityState === 'visible') {
      onForeground();
    }
  };

  const usesDomListener = !deps.appStateIsDomDriven && deps.document !== undefined;
  if (usesDomListener) {
    deps.document?.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return () => {
    appStateSubscription.remove();
    if (usesDomListener) {
      deps.document?.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
}

/**
 * One refresh for an activation signal, kept OUTSIDE the foreground listener
 * registration so deduplicating those listeners can never suppress a
 * day-rollover or section-activation refresh. The hook's effect runs this once
 * per generation bump (or activation change); a re-run only happens when one of
 * those inputs actually changed.
 */
export function createActivationRefresh(input: {
  isActive: boolean;
  onRefresh: () => void;
}): () => void {
  return () => {
    if (input.isActive) {
      input.onRefresh();
    }
  };
}
