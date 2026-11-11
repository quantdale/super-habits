import { describe, expect, it, vi } from 'vitest';
import {
  focusIsStrayed,
  isFocusableControl,
  isWebDocumentAvailable,
  weeklyReviewFocusTarget,
} from '@/core/providers/weeklyReviewFocusReturn';

/**
 * Regression guard for the Weekly Review focus return (CG-13 in
 * `docs/testing/known-gaps.md`; the E2E release assertion is the now-active
 * case "the Weekly Review returns focus to a control when it is dismissed" in
 * `e2e/v2-keyboard-focus.spec.ts`).
 *
 * React Native Web's `Modal` focus trap restores focus to the element it
 * snapshotted when it mounted, and only while that element is still in the
 * document. The Weekly Review is opened from inside the Planning Hub, which
 * `openWeeklyReview` dismisses in the same commit, so the review's own invoker
 * (`Open weekly review`) is gone by the time the review closes and focus fell to
 * `<body>`. The provider records the control that opened the chain instead and
 * must always resolve to a usable node — never `<body>`, never a removed node,
 * never a throw.
 *
 * These are DOM-shaped fakes, not jsdom: the decision is a small amount of pure
 * logic over `isConnected` / attributes / geometry, so the real production
 * functions can be exercised directly.
 */

type FakeOptions = {
  connected?: boolean;
  attributes?: Record<string, string>;
  width?: number;
  height?: number;
  parent?: FakeNode | null;
  focus?: (() => void) | null;
};

type FakeNode = HTMLElement & { focusCalls: number };

function fakeNode({ connected, attributes, width, height, parent, focus }: FakeOptions = {}) {
  const attrs = new Map(Object.entries(attributes ?? {}));
  const node = {
    focusCalls: 0,
    isConnected: connected ?? true,
    parentElement: parent === undefined ? null : parent,
    hasAttribute: (name: string) => attrs.has(name),
    getAttribute: (name: string) => attrs.get(name) ?? null,
    getBoundingClientRect: () => ({ width: width ?? 120, height: height ?? 44 }),
  } as unknown as FakeNode;
  const focusImpl = focus === undefined ? () => undefined : focus;
  if (focusImpl) {
    (node as unknown as { focus: () => void }).focus = () => {
      node.focusCalls += 1;
      focusImpl();
    };
  }
  return node;
}

/** A document whose single `querySelector` hit is the given node (or nothing). */
function fakeDocument(match: HTMLElement | null) {
  const querySelector = vi.fn(() => match);
  return { querySelector } as unknown as Pick<Document, 'querySelector'> & {
    querySelector: typeof querySelector;
  };
}

describe('weeklyReviewFocusTarget — the recorded opener wins while it is usable', () => {
  it('returns the recorded opener (the control that opened the hub chain)', () => {
    const opener = fakeNode();
    const rail = fakeNode();
    const target = weeklyReviewFocusTarget(opener, fakeDocument(rail));
    expect(target).toBe(opener);
    // The fallback must not even be consulted when the opener is usable.
    expect(fakeDocument(rail).querySelector).not.toHaveBeenCalled();
  });
});

describe('weeklyReviewFocusTarget — falls back instead of landing on <body>', () => {
  it('uses the selected section rail destination when the opener was unmounted', () => {
    // The measured CG-13 case: `Open weekly review` is removed with the hub.
    const removedOpener = fakeNode({ connected: false });
    const rail = fakeNode({ attributes: { role: 'tab', 'aria-selected': 'true' } });
    const root = fakeDocument(rail);

    expect(weeklyReviewFocusTarget(removedOpener, root)).toBe(rail);
    // The fallback is the rail's selected destination on the section tablist,
    // which is the contract the E2E case and `e2e/a11y.spec.ts` both rely on.
    expect(root.querySelector).toHaveBeenCalledWith(
      '[role="tablist"][aria-label="Section tabs"] [role="tab"][aria-selected="true"]',
    );
  });

  it('returns null (leave focus alone) rather than <body> when nothing is usable', () => {
    expect(weeklyReviewFocusTarget(null, fakeDocument(null))).toBeNull();
    expect(weeklyReviewFocusTarget(fakeNode({ connected: false }), fakeDocument(null))).toBeNull();
    // A rail tab that exists but cannot take focus is not a valid fallback.
    expect(
      weeklyReviewFocusTarget(
        null,
        fakeDocument(fakeNode({ attributes: { 'aria-disabled': 'true' } })),
      ),
    ).toBeNull();
    expect(weeklyReviewFocusTarget(null, fakeDocument(fakeNode({ width: 0 })))).toBeNull();
  });
});

describe('isWebDocumentAvailable — the whole restore is a native no-op', () => {
  it('is inert on native, where React Native defines no DOM document', () => {
    // The unit runtime mocks `Platform.OS = 'ios'` (tests/setup.ts) and has no
    // `document`: neither the platform gate nor the document gate may pass, so
    // `restoreWeeklyReviewFocus` returns before touching any DOM API.
    expect(isWebDocumentAvailable()).toBe(false);
    expect(isWebDocumentAvailable('ios')).toBe(false);
    expect(isWebDocumentAvailable('android')).toBe(false);
    // Web ALSO requires a real document — a static/SSR render must not throw.
    expect(isWebDocumentAvailable('web')).toBe(false);
  });
});

describe('focusIsStrayed — repair only a failed restore, never a real control', () => {
  const fakeDoc = (active: unknown, body = {}, documentElement = {}) =>
    ({ activeElement: active, body, documentElement }) as unknown as Pick<
      Document,
      'activeElement' | 'body' | 'documentElement'
    >;

  it('reports a strayed focus on the page root or on a removed node', () => {
    const body = {};
    const documentElement = {};
    // The measured CG-13 symptom after Escape, and the transient above it.
    expect(focusIsStrayed(fakeDoc(body, body, documentElement))).toBe(true);
    expect(focusIsStrayed(fakeDoc(documentElement, body, documentElement))).toBe(true);
    expect(focusIsStrayed(fakeDoc(null, body, documentElement))).toBe(true);
    expect(focusIsStrayed(fakeDoc({ isConnected: false }, body, documentElement))).toBe(true);
  });

  it('leaves a live control alone, so a restore never steals focus', () => {
    const body = {};
    const documentElement = {};
    const control = { isConnected: true };
    expect(focusIsStrayed(fakeDoc(control, body, documentElement))).toBe(false);
  });
});

describe('isFocusableControl — a real control, not a stale or hidden node', () => {
  it('accepts a connected, painted, enabled node', () => {
    expect(isFocusableControl(fakeNode())).toBe(true);
  });

  it('rejects remover, disabled, unpainted and unfocusable nodes', () => {
    expect(isFocusableControl(null)).toBe(false);
    expect(isFocusableControl(fakeNode({ connected: false }))).toBe(false);
    expect(isFocusableControl(fakeNode({ attributes: { disabled: '' } }))).toBe(false);
    expect(isFocusableControl(fakeNode({ attributes: { 'aria-disabled': 'true' } }))).toBe(false);
    expect(isFocusableControl(fakeNode({ width: 0, height: 0 }))).toBe(false);
    // `focus` is absent: never assume an arbitrary element can take focus.
    expect(isFocusableControl(fakeNode({ focus: null }))).toBe(false);
  });

  it('rejects a control inside an inert or aria-hidden subtree', () => {
    // Every inactive section in `app/index.tsx` carries BOTH markers, so a
    // fallback (or a recorded opener) left behind in one must never be focused.
    const inertAncestor = fakeNode({ attributes: { inert: '' } });
    expect(isFocusableControl(fakeNode({ parent: inertAncestor }))).toBe(false);

    const hiddenAncestor = fakeNode({ attributes: { 'aria-hidden': 'true' } });
    expect(isFocusableControl(fakeNode({ parent: hiddenAncestor }))).toBe(false);

    // ...but a merely *present* `aria-hidden="false"` ancestor is fine.
    const visibleAncestor = fakeNode({ attributes: { 'aria-hidden': 'false' } });
    expect(isFocusableControl(fakeNode({ parent: visibleAncestor }))).toBe(true);
  });
});
