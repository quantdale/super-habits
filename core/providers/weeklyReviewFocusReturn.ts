import { Platform } from 'react-native';

/**
 * Focus return for the Weekly Review overlay (web only).
 *
 * §5.7 requires every overlay to hand focus back to the control that opened it.
 * The other overlays get that for free from React Native Web's own `Modal` focus
 * trap: it snapshots `document.activeElement` when the modal mounts and
 * refocuses that same node on unmount, but only while the node is still in the
 * document.
 *
 * The Weekly Review is the one overlay opened *through another overlay*.
 * `openWeeklyReview` (`core/providers/NavigationProvider.tsx`) dismisses the
 * Planning Hub in the same commit, so the hub's `Open weekly review` control —
 * the node RN-Web snapshotted — is unmounted with the hub, RN-Web's restore has
 * nothing to focus, and focus falls to `<body>` (CG-13, measured in
 * `e2e/v2-keyboard-focus.spec.ts`).
 *
 * So the hub chain records the control that opened the hub and re-asserts it
 * once the review's dialog is gone. This reuses RN-Web's node-identity restore
 * rather than introducing a second focus system: the target is exactly the kind
 * of live DOM control RN-Web would have restored. When the recorded opener no
 * longer exists, the selected section rail destination is the stable fallback, so
 * focus never lands on `<body>`, on a stale/removed node, or throws.
 *
 * Kept out of the provider module because a file exporting components must not
 * also export plain functions (`react-refresh/only-export-components`); same
 * shape as its sibling `core/providers/historyMirror.ts`.
 */

/**
 * Bounded re-check schedule (ms) while the review's dialog is still unmounting
 * and after the first focus attempt. RN-Web keeps its portal in the document
 * for a commit or two after `onClose`, so a single synchronous focus call can
 * run against a dialog that has not gone yet; the tail also re-asserts the
 * target past a late paint. Measured locally: the dialog is gone within ~20ms.
 */
export const WEEKLY_REVIEW_FOCUS_RETURN_DELAYS_MS = [0, 30, 80, 150, 250, 400, 700];

/** Web-only: native defines no `document`, and RN's `window` has no DOM API. */
export function isWebDocumentAvailable(platformOs: string = Platform.OS): boolean {
  return platformOs === 'web' && typeof document !== 'undefined';
}

/** The focused control, or `null` when focus is on the page root / nothing. */
export function focusedControl(
  doc: Pick<Document, 'activeElement' | 'body' | 'documentElement'> = document,
): HTMLElement | null {
  const active = doc.activeElement as HTMLElement | null;
  if (!active || active === doc.body || active === doc.documentElement) return null;
  return active;
}

/**
 * Whether a node can take focus as-is: still in the document, not disabled, not
 * inside an `inert` / `aria-hidden` subtree (every inactive section carries both
 * markers — `app/index.tsx` `SectionContainer`), and painted.
 *
 * Takes a DOM-shaped node, so a fake object is enough — no jsdom needed.
 */
export function isFocusableControl(node: HTMLElement | null): node is HTMLElement {
  if (!node || !node.isConnected || typeof node.focus !== 'function') return false;
  if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') return false;
  for (let element: HTMLElement | null = node; element; element = element.parentElement) {
    if (element.hasAttribute('inert')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
  }
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Where focus should go when the review is dismissed: the recorded opener, or —
 * when that control is gone, which is the documented hub case — the stable rail
 * fallback. `null` means "leave focus alone", which is what keeps this a
 * no-throw, never-`<body>` guarantee.
 *
 * `root` is injectable so the query is covered without a live DOM.
 */
export function weeklyReviewFocusTarget(
  opener: HTMLElement | null,
  root: Pick<Document, 'querySelector'>,
): HTMLElement | null {
  if (isFocusableControl(opener)) return opener;
  // Stable fallback: the selected section rail destination, which exists on
  // every section (bottom bar on phones, side rail on wide layouts) and is a
  // real tab stop.
  const tab = root.querySelector<HTMLElement>(
    '[role="tablist"][aria-label="Section tabs"] [role="tab"][aria-selected="true"]',
  );
  return isFocusableControl(tab) ? tab : null;
}

/**
 * Whether focus has strayed from any control — to the page root, or to a node
 * already removed from the document (Chromium briefly reports the removed
 * element, then `<body>`). A strayed focus is the failed restore this module
 * exists to repair; anything else is a control the user has legitimately
 * reached, which must never be stolen.
 */
export function focusIsStrayed(
  doc: Pick<Document, 'activeElement' | 'body' | 'documentElement'> = document,
): boolean {
  const active = doc.activeElement as HTMLElement | null;
  return !active || active === doc.body || active === doc.documentElement || !active.isConnected;
}
