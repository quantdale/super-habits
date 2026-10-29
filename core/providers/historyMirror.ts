import { Platform } from 'react-native';

/**
 * Whether the browser history mirror may run at all.
 *
 * `typeof window === 'undefined'` is NOT a sufficient guard: React Native
 * defines `window` (it aliases the global object) but gives it no `location`,
 * no `history`, and no `addEventListener`. A window-only check therefore
 * passes on iOS/Android and the very next property access throws — at mount
 * and on every section change. The mirror is web-only, and even on web it
 * needs a usable `history.pushState`.
 *
 * Exported for the regression test: the arguments are injectable so the
 * React-Native-shaped window can be exercised without a native runtime.
 */
export function isHistoryMirrorAvailable(
  platformOs: string = Platform.OS,
  win: unknown = typeof window === 'undefined' ? undefined : window,
): boolean {
  if (platformOs !== 'web' || !win || typeof win !== 'object') return false;
  const history = (win as { history?: { pushState?: unknown } }).history;
  return typeof history?.pushState === 'function';
}
