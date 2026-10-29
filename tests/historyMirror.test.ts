import { describe, expect, it } from 'vitest';
import { isHistoryMirrorAvailable } from '@/core/providers/historyMirror';

/**
 * Regression guard for the native crash this helper exists to prevent.
 *
 * The browser history mirror used to be gated on `typeof window === 'undefined'`
 * only. React Native DEFINES `window` (it aliases the global object) but gives it
 * no `location`, no `history`, and no `addEventListener` — so that guard passed
 * on iOS/Android and the very next property access threw. On native the mirror
 * must be inert; only a real browser window with a usable `history.pushState`
 * may run it.
 */

/** A window shaped like React Native's: defined, but with no DOM APIs. */
const reactNativeWindow = { nativeModuleProxy: {} };

/** A minimal real-browser window surface for the positive cases. */
const webWindow = {
  location: { hash: '#habits' },
  history: {
    state: null,
    pushState: () => undefined,
    replaceState: () => undefined,
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

describe('isHistoryMirrorAvailable', () => {
  it('is inert on native even though React Native defines `window`', () => {
    // This is the exact shape that crashed: a defined window with no DOM APIs.
    expect(isHistoryMirrorAvailable('ios', reactNativeWindow)).toBe(false);
    expect(isHistoryMirrorAvailable('android', reactNativeWindow)).toBe(false);
    // Even a browser-complete window must not enable the mirror off-web.
    expect(isHistoryMirrorAvailable('ios', webWindow)).toBe(false);
    expect(isHistoryMirrorAvailable('android', webWindow)).toBe(false);
  });

  it('is inert on web when there is no window or no usable history', () => {
    expect(isHistoryMirrorAvailable('web', undefined)).toBe(false);
    expect(isHistoryMirrorAvailable('web', null)).toBe(false);
    // A React-Native-shaped window on the web platform (SSR/static render) is
    // still not usable: no history property at all.
    expect(isHistoryMirrorAvailable('web', reactNativeWindow)).toBe(false);
    expect(isHistoryMirrorAvailable('web', { history: {} })).toBe(false);
    expect(isHistoryMirrorAvailable('web', { history: { pushState: 'nope' } })).toBe(false);
  });

  it('is enabled only for a web platform with a real history.pushState', () => {
    expect(isHistoryMirrorAvailable('web', webWindow)).toBe(true);
  });

  it('defaults to the mocked native platform in the unit environment', () => {
    // tests/setup.ts mocks Platform.OS to 'ios', and the vitest environment has
    // no browser window — so the default call must be inert, never throwing.
    expect(() => isHistoryMirrorAvailable()).not.toThrow();
    expect(isHistoryMirrorAvailable()).toBe(false);
  });
});
