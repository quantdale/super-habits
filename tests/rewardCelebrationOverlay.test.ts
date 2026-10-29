import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P8 RewardCelebrationOverlay contract (docs/ui-ux/16-playful-momentum.md §5.8, §8):
 *
 * 1. Never blocks taps — the overlay root is `pointerEvents: 'box-none'` and
 *    confetti is `pointerEvents: 'none'`; a suspended auto-dismiss timer can
 *    never trap the user behind the celebration.
 * 2. Auto-dismiss duration pin — the celebration self-dismisses after 2800ms
 *    ("auto-dismiss 2.8s, dismiss anywhere"). Pinned behaviorally: the effect
 *    must schedule the dismissal with exactly that delay.
 * 3. Reduced motion — no confetti motion: the confetti layer renders zero
 *    particles (opacity-only presentation elsewhere).
 *
 * Harness: `tests/checkNode.test.ts`'s mocked-hooks + JSX-reduction pattern.
 * The overlay drives its confetti with RN `Animated` (not reanimated), so the
 * mock below records enough of `Animated`/`Easing` for the component to render.
 */

const AUTO_DISMISS_EXPECTED_MS = 2800;

const harness = vi.hoisted(() => ({
  reducedMotion: false,
  dismissCelebration: () => {},
  celebration: null as null | {
    tier: string;
    title: string;
    message: string;
    xp: number;
  },
}));

vi.mock('react', () => {
  const hooks = {
    useState: (init: unknown) => [
      typeof init === 'function' ? (init as () => unknown)() : init,
      () => {},
    ],
    useEffect: (effect: () => unknown) => {
      effect();
    },
    useCallback: (fn: unknown) => fn,
    useRef: (init: unknown) => ({ current: init }),
    useMemo: (fn: () => unknown) => fn(),
    createElement: (type: unknown, props: unknown) => ({ type, props }),
  };
  return { ...hooks, default: hooks };
});

const jsxRuntime = vi.hoisted(() => ({
  jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
  jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
  Fragment: 'Fragment',
}));

vi.mock('react/jsx-runtime', () => jsxRuntime);
vi.mock('react/jsx-dev-runtime', () => jsxRuntime);

(globalThis as { React?: unknown }).React = {
  Fragment: 'Fragment',
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => ({
    type,
    props: {
      ...(props ?? {}),
      children: children.length > 1 ? children : children[0],
    },
  }),
};

class FakeAnimatedValue {
  constructor(private value: unknown) {}
  setValue(next: unknown) {
    this.value = next;
  }
  interpolate() {
    return 0;
  }
}

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj['ios'] ?? obj['default'],
  },
  StyleSheet: { absoluteFillObject: {} },
  Easing: { out: (easing: unknown) => easing, quad: 'quad' },
  Animated: {
    Value: FakeAnimatedValue,
    View: 'Animated.View',
    timing: () => ({ start() {}, stop() {} }),
    spring: () => ({ start() {}, stop() {} }),
  },
}));

vi.mock('@/core/theme/motion', () => ({
  useReducedMotion: () => harness.reducedMotion,
}));

vi.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
vi.mock('@/core/ui/Button', () => ({ Button: 'Button' }));

vi.mock('@/core/providers/themeContext', () => ({
  useAppTheme: () => ({
    resolvedTheme: 'light',
    tokens: {
      accent: '#1769D8',
      surface: '#FFFFFF',
      surfaceSunken: '#F3F5F9',
      surfaceElevated: '#FFFFFF',
      border: '#E3E6EE',
      borderStrong: '#D5DAE3',
      text: '#1F2430',
      textMuted: '#5B6475',
      shadowColor: '#10131A',
    },
  }),
}));

vi.mock('@/features/gamification/gamificationContext', () => ({
  useGamification: () => ({
    celebration: harness.celebration,
    dismissCelebration: harness.dismissCelebration,
  }),
}));

type Element = { type: unknown; props: Record<string, unknown> };

function isElement(node: unknown): node is Element {
  return typeof node === 'object' && node !== null && 'type' in node && 'props' in node;
}

/** Expand function-type nodes (the nested `Confetti`) by invoking them. */
function expand(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(expand);
  if (!isElement(node)) return node;
  if (typeof node.type === 'function') {
    return expand((node.type as (props: Record<string, unknown>) => unknown)(node.props));
  }
  return {
    type: node.type,
    props: { ...node.props, children: expand(node.props['children']) },
  };
}

function findAll(node: unknown, type: string, out: Element[] = []): Element[] {
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, type, out);
    return out;
  }
  if (isElement(node)) {
    if (node.type === type) out.push(node);
    findAll(node.props['children'], type, out);
  }
  return out;
}

async function renderOverlay() {
  vi.resetModules();
  const { RewardCelebrationOverlay } =
    await import('@/features/gamification/RewardCelebrationOverlay');
  return expand(RewardCelebrationOverlay()) as Element | null;
}

beforeEach(() => {
  harness.reducedMotion = false;
  harness.dismissCelebration = vi.fn();
  harness.celebration = {
    tier: 'badge',
    title: 'Badge unlocked',
    message: 'You earned a new badge.',
    xp: 25,
  };
});

describe('RewardCelebrationOverlay never blocks taps (§5.8 / §8)', () => {
  it('root overlay is pointerEvents box-none', async () => {
    const tree = await renderOverlay();
    expect(tree).not.toBeNull();
    expect(tree!.type).toBe('View');
    expect(tree!.props['pointerEvents']).toBe('box-none');
  });

  it('renders no confetti at all under reduced motion', async () => {
    harness.reducedMotion = true;
    const tree = await renderOverlay();
    // `Confetti` returns null when inactive: no particle layer exists at all.
    const confettiLayer = findAll(tree, 'View').find(
      (view) => view.props['pointerEvents'] === 'none',
    );
    expect(confettiLayer).toBeUndefined();
    expect(findAll(tree, 'Animated.View')).toHaveLength(0);
  });

  it('full motion renders the confetti particles inside the non-interactive layer', async () => {
    const tree = await renderOverlay();
    const confettiLayer = findAll(tree, 'View').find(
      (view) => view.props['pointerEvents'] === 'none',
    );
    expect(confettiLayer).toBeDefined();
    expect(findAll(tree, 'Animated.View').length).toBeGreaterThan(0);
  });
});

describe('RewardCelebrationOverlay auto-dismiss (§5.8: 2.8s, dismiss anywhere)', () => {
  it('schedules the celebration dismissal at exactly 2800ms', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    try {
      await renderOverlay();
      const dismissCalls = timeoutSpy.mock.calls.filter(
        (call) => call[0] === harness.dismissCelebration,
      );
      expect(dismissCalls).toHaveLength(1);
      expect(dismissCalls[0][1]).toBe(AUTO_DISMISS_EXPECTED_MS);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it('schedules no auto-dismiss when no celebration is queued', async () => {
    harness.celebration = null;
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    try {
      const tree = await renderOverlay();
      expect(tree).toBeNull();
      const dismissCalls = timeoutSpy.mock.calls.filter(
        (call) => call[0] === harness.dismissCelebration,
      );
      expect(dismissCalls).toHaveLength(0);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
