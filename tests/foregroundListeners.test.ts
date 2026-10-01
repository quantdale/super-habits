import { describe, expect, it, vi } from 'vitest';
import {
  createActivationRefresh,
  registerForegroundListeners,
  type ForegroundAppState,
  type ForegroundDocument,
} from '@/lib/foregroundListeners';

/**
 * One foreground transition must produce exactly one refresh per consumer.
 *
 * The defect: on web, react-native-web's `AppState` re-emits `change` from the
 * DOM `visibilitychange` event, so the hook's `AppState` listener and its own
 * `visibilitychange` listener both fired — every mounted section screen and
 * `GamificationProvider` ran its refresh (and its query/aggregate batch) twice.
 *
 * The same duplicate would ALSO have fired for a single DOM event, so these
 * tests assert both entry paths and the listener inventory, and a native
 * foreground (no DOM at all) alongside them.
 */
describe('registerForegroundListeners', () => {
  function fakeAppState() {
    const handlers: ((state: string) => void)[] = [];
    const appState: ForegroundAppState = {
      addEventListener: (_type, handler) => {
        handlers.push(handler);
        return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
      },
    };
    return { appState, handlers };
  }

  function fakeDocument(visibilityState = 'visible') {
    const listeners = new Map<string, Set<() => void>>();
    const document: ForegroundDocument = {
      visibilityState,
      addEventListener: (type, handler) => {
        const set = listeners.get(type) ?? new Set();
        set.add(handler);
        listeners.set(type, set);
      },
      removeEventListener: (type, handler) => {
        listeners.get(type)?.delete(handler);
      },
    };
    return { document, listeners };
  }

  it('delivers exactly ONE refresh for one web foreground routed through AppState', () => {
    // react-native-web re-emits `change` from the DOM visibilitychange event.
    const onForeground = vi.fn();
    const { appState, handlers } = fakeAppState();
    registerForegroundListeners(onForeground, {
      appState,
      appStateIsDomDriven: true,
      document: fakeDocument().document,
    });

    expect(handlers).toHaveLength(1);
    for (const handler of handlers) handler('active');

    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  it('registers no duplicate DOM listener when AppState is DOM-driven', () => {
    const { appState } = fakeAppState();
    const { document, listeners } = fakeDocument();

    registerForegroundListeners(vi.fn(), { appState, appStateIsDomDriven: true, document });

    expect(appState).toBeDefined();
    // The duplicate listener is the defect: one web foreground used to run the
    // consumer's refresh twice.
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0);
  });

  it('still delivers exactly one refresh when a DOM foreground is dispatched on a DOM-driven platform', () => {
    const onForeground = vi.fn();
    const { appState, handlers } = fakeAppState();
    registerForegroundListeners(onForeground, {
      appState,
      appStateIsDomDriven: true,
      document: fakeDocument().document,
    });

    // react-native-web turns this DOM event into the single `change` event.
    for (const handler of handlers) handler('active');
    for (const handler of handlers) handler('active');

    expect(onForeground).toHaveBeenCalledTimes(2);
  });

  it('delivers exactly one refresh for one web foreground on a platform whose AppState is not DOM-driven', () => {
    const onForeground = vi.fn();
    const { appState } = fakeAppState();
    const { document, listeners } = fakeDocument('visible');

    registerForegroundListeners(onForeground, { appState, appStateIsDomDriven: false, document });

    // Both listeners exist on such a platform, and each sees its own event.
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(1);
    for (const handler of listeners.get('visibilitychange') ?? []) handler();

    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  it('ignores a hidden visibilitychange', () => {
    const onForeground = vi.fn();
    const { appState } = fakeAppState();
    const { document, listeners } = fakeDocument('hidden');

    registerForegroundListeners(onForeground, { appState, appStateIsDomDriven: false, document });
    for (const handler of listeners.get('visibilitychange') ?? []) handler();

    expect(onForeground).not.toHaveBeenCalled();
  });

  it('ignores a background AppState change', () => {
    const onForeground = vi.fn();
    const { appState, handlers } = fakeAppState();

    registerForegroundListeners(onForeground, { appState, appStateIsDomDriven: true });
    for (const handler of handlers) handler('background');

    expect(onForeground).not.toHaveBeenCalled();
  });

  it('delivers exactly one refresh for a native foreground (no DOM at all)', () => {
    const onForeground = vi.fn();
    const { appState, handlers } = fakeAppState();

    registerForegroundListeners(onForeground, { appState, appStateIsDomDriven: false });

    expect(handlers).toHaveLength(1);
    for (const handler of handlers) handler('active');

    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  it('cleanup removes every listener it registered and nothing else', () => {
    const { appState, handlers } = fakeAppState();
    const { document, listeners } = fakeDocument('visible');

    const cleanup = registerForegroundListeners(vi.fn(), {
      appState,
      appStateIsDomDriven: false,
      document,
    });
    expect(handlers).toHaveLength(1);
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(1);

    cleanup();
    expect(handlers).toHaveLength(0);
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0);
  });

  it('cleanup on a DOM-driven platform leaves no DOM listener behind', () => {
    const { appState, handlers } = fakeAppState();
    const { document, listeners } = fakeDocument('visible');

    const cleanup = registerForegroundListeners(vi.fn(), {
      appState,
      appStateIsDomDriven: true,
      document,
    });
    cleanup();

    expect(handlers).toHaveLength(0);
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0);
  });
});

describe('createActivationRefresh', () => {
  it('refreshes an active consumer exactly once per signal', () => {
    const onRefresh = vi.fn();
    const run = createActivationRefresh({ isActive: true, onRefresh });

    run();

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes nothing while the consumer is inactive', () => {
    const onRefresh = vi.fn();
    const run = createActivationRefresh({ isActive: false, onRefresh });

    run();

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('is a separate signal from the foreground listeners, so deduplicating those cannot suppress it', () => {
    const onRefresh = vi.fn();
    const appState: ForegroundAppState = { addEventListener: () => ({ remove: () => {} }) };
    // No DOM listener registered at all (web) — the activation signal still works.
    registerForegroundListeners(vi.fn(), { appState, appStateIsDomDriven: true });

    const run = createActivationRefresh({ isActive: true, onRefresh });
    run(); // day-generation bump
    run(); // a second generation bump

    expect(onRefresh).toHaveBeenCalledTimes(2);
  });
});
