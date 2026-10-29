import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P7 ProgressBar / ProgressRing contracts (docs/ui-ux/16-playful-momentum.md §6):
 *
 * 1. Clamping — the fill fraction clamps to 0..1 (NaN → 0) everywhere it is
 *    consumed: the animated fill, the ring's `strokeDashoffset`, and the
 *    a11y value.
 * 2. A11y — a `progressbar` role with `accessibilityValue` min 0 / max 1 /
 *    now, mirrored as `aria-valuemin`/`aria-valuemax`/`aria-valuenow` (this
 *    RN-web does not map `accessibilityValue` to the DOM).
 * 3. Reduced motion — P4 `useProgressFill` snaps the width/arc with no fill
 *    easing and no 300ms sweep; only the 120ms opacity cross-fade runs. Full
 *    motion eases the fill over 450ms and sweeps once over 300ms.
 *
 * Harness: `tests/pressable3D.test.ts`'s mocked-hooks + recording
 * react-native-reanimated pattern; the real `useReducedMotion()` drives
 * branch selection via setMotionPreference.
 */

type ReaConfig =
  { duration?: number; easing?: unknown; damping?: number; stiffness?: number } | undefined;

type TimingCall = { api: 'withTiming' | 'withSpring'; toValue: unknown; config: ReaConfig };

const rea = vi.hoisted(() => {
  const calls: TimingCall[] = [];
  return {
    calls,
    reset() {
      calls.length = 0;
    },
  };
});

const storage = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

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
    useContext: () => null,
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

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj['ios'] ?? obj['default'],
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => false,
    addEventListener: () => ({ remove: () => {} }),
  },
}));

vi.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  Animated: { View: 'Animated.View' },
  useSharedValue: (init: unknown) => ({ value: init }),
  useAnimatedStyle: (fn: () => unknown) => {
    const style = fn() as Record<string, unknown>;
    (style as { __fn?: () => unknown }).__fn = fn;
    return style;
  },
  useAnimatedProps: (fn: () => unknown) => {
    const props = fn() as Record<string, unknown>;
    (props as { __fn?: () => unknown }).__fn = fn;
    return props;
  },
  createAnimatedComponent: (component: unknown) => component,
  withTiming: (toValue: unknown, config?: ReaConfig) => {
    rea.calls.push({ api: 'withTiming', toValue, config });
    return toValue;
  },
  withSpring: (toValue: unknown) => toValue,
  withSequence: (...steps: unknown[]) => steps[steps.length - 1],
}));

vi.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
vi.mock('@/core/ui/Text', () => ({ Text: 'Text' }));
vi.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
}));

vi.mock('@/core/providers/themeContext', () => ({
  useAppTheme: () => ({
    resolvedTheme: 'light',
    tokens: {
      accent: '#1769D8',
      primary: '#1A7F2B',
      primaryBright: '#4DC93A',
      buttonLip: '#135B1F',
      surface: '#FFFFFF',
      surfaceSunken: '#F3F5F9',
      border: '#E3E6EE',
      borderStrong: '#D5DAE3',
      text: '#1F2430',
      textMuted: '#5B6475',
      textSubtle: '#656D80',
      onSolid: '#FFFFFF',
    },
  }),
}));

type Element = { type: unknown; props: Record<string, unknown> };

function isElement(node: unknown): node is Element {
  return typeof node === 'object' && node !== null && 'type' in node && 'props' in node;
}

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

function styleArray(node: Element): Record<string, unknown>[] {
  const style = node.props['style'];
  return (Array.isArray(style) ? style : [style]) as Record<string, unknown>[];
}

/** Re-evaluates an animated style/props object recorded with `__fn`. */
function reevaluate(entry: unknown): Record<string, unknown> {
  const fn = (entry as { __fn?: () => Record<string, unknown> }).__fn;
  if (!fn) throw new Error('entry carries no animated function');
  return fn();
}

/** The style entry that carries the reanimated `__fn` (fill / sweep). */
function animatedEntry(node: Element): unknown {
  const entry = styleArray(node).find(
    (item) => typeof (item as { __fn?: unknown }).__fn === 'function',
  );
  if (!entry) throw new Error('node carries no animated style');
  return entry;
}

async function loadBar() {
  vi.resetModules();
  const motion = await import('@/core/theme/motion');
  const { ProgressBar } = await import('@/core/ui/ProgressBar');
  return { motion, ProgressBar };
}

async function loadRing() {
  vi.resetModules();
  const motion = await import('@/core/theme/motion');
  const { ProgressRing } = await import('@/core/ui/ProgressRing');
  return { motion, ProgressRing };
}

type BarCtx = Awaited<ReturnType<typeof loadBar>>;
type RingCtx = Awaited<ReturnType<typeof loadRing>>;

function renderBar(ctx: BarCtx, progress: number) {
  return expand(ctx.ProgressBar({ progress, accessibilityLabel: 'Quest progress' })) as Element;
}

function renderRing(ctx: RingCtx, progress: number) {
  return expand(
    ctx.ProgressRing({ progress, accessibilityLabel: 'Quest ring progress' }),
  ) as Element;
}

beforeEach(() => {
  rea.reset();
  storage.store.clear();
});

describe('ProgressBar clamping and a11y (§6)', () => {
  it('clamps above 1: fill 100%, aria-valuenow 1, withTiming target 1', async () => {
    const ctx = await loadBar();
    ctx.motion.setMotionPreference('full');
    const tree = renderBar(ctx, 2);

    expect(tree.props['accessibilityRole']).toBe('progressbar');
    expect(tree.props['role']).toBe('progressbar');
    expect(tree.props['accessibilityLabel']).toBe('Quest progress');
    expect(tree.props['accessibilityValue']).toEqual({ min: 0, max: 1, now: 1 });
    expect(tree.props['aria-valuemin']).toBe(0);
    expect(tree.props['aria-valuemax']).toBe(1);
    expect(tree.props['aria-valuenow']).toBe(1);

    const [fill] = findAll(tree, 'Animated.View');
    expect(reevaluate(animatedEntry(fill))['width']).toBe('100%');
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 1,
      config: expect.objectContaining({ duration: 450 }),
    });
  });

  it('clamps below 0 and NaN to 0', async () => {
    const ctx = await loadBar();
    ctx.motion.setMotionPreference('full');
    const under = renderBar(ctx, -0.5);
    expect(under.props['aria-valuenow']).toBe(0);
    expect(reevaluate(animatedEntry(findAll(under, 'Animated.View')[0]))['width']).toBe('0%');

    rea.reset();
    const nan = renderBar(ctx, Number.NaN);
    expect(nan.props['aria-valuenow']).toBe(0);
    expect(nan.props['accessibilityValue']).toEqual({ min: 0, max: 1, now: 0 });
    expect(reevaluate(animatedEntry(findAll(nan, 'Animated.View')[0]))['width']).toBe('0%');
  });

  it('mid values map to the matching percent width', async () => {
    const ctx = await loadBar();
    ctx.motion.setMotionPreference('full');
    const tree = renderBar(ctx, 0.427);
    expect(tree.props['aria-valuenow']).toBe(0.427);
    expect(reevaluate(animatedEntry(findAll(tree, 'Animated.View')[0]))['width']).toBe('42.7%');
  });
});

describe('ProgressBar motion (§5.8 progress fill)', () => {
  it('full motion: 450ms fill ease plus one 300ms sweep', async () => {
    const ctx = await loadBar();
    ctx.motion.setMotionPreference('full');
    renderBar(ctx, 0.5);

    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 0.5,
      config: expect.objectContaining({ duration: 450 }),
    });
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 1,
      config: expect.objectContaining({ duration: 300 }),
    });
  });

  it('reduced motion: fill snaps — no 450ms ease, no sweep, only the 120ms fade', async () => {
    const ctx = await loadBar();
    ctx.motion.setMotionPreference('reduced');
    const tree = renderBar(ctx, 0.5);

    // The fill width is applied synchronously (no easing call on the width) …
    const [fill, sweep] = findAll(tree, 'Animated.View');
    expect(reevaluate(animatedEntry(fill))['width']).toBe('50%');
    // … the sweep overlay never shows …
    expect(reevaluate(animatedEntry(sweep))['opacity']).toBe(0);
    // … and the only animation is the 120ms opacity cross-fade.
    expect(rea.calls).not.toContainEqual(
      expect.objectContaining({ config: expect.objectContaining({ duration: 450 }) }),
    );
    expect(rea.calls).not.toContainEqual(
      expect.objectContaining({ config: expect.objectContaining({ duration: 300 }) }),
    );
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 1,
      config: expect.objectContaining({ duration: 120 }),
    });
  });
});

describe('ProgressRing clamping and a11y (§6)', () => {
  it('clamps above 1: zero strokeDashoffset, aria-valuenow 1', async () => {
    const ctx = await loadRing();
    ctx.motion.setMotionPreference('full');
    const tree = renderRing(ctx, 3);

    expect(tree.props['accessibilityRole']).toBe('progressbar');
    expect(tree.props['role']).toBe('progressbar');
    expect(tree.props['accessibilityLabel']).toBe('Quest ring progress');
    expect(tree.props['accessibilityValue']).toEqual({ min: 0, max: 1, now: 1 });
    expect(tree.props['aria-valuenow']).toBe(1);

    // size 64 / stroke 10 → r 27 → circumference 2π·27.
    const circumference = 2 * Math.PI * 27;
    const fill = findAll(tree, 'Circle').find((circle) => circle.props['stroke'] === '#4DC93A');
    expect(fill).toBeDefined();
    const props = fill!.props as Record<string, unknown> & { animatedProps?: unknown };
    expect(reevaluate(props.animatedProps)['strokeDashoffset']).toBeCloseTo(0, 5);
    expect(props['strokeWidth']).toBe(10);
    expect(props['strokeLinecap']).toBe('round');
    const dash = String(props['strokeDasharray']).split(' ').map(Number);
    expect(dash[0]).toBeCloseTo(circumference, 5);
    expect(dash[1]).toBeCloseTo(circumference, 5);
  });

  it('clamps below 0 and NaN to a full-lap offset', async () => {
    const ctx = await loadRing();
    ctx.motion.setMotionPreference('full');
    const circumference = 2 * Math.PI * 27;

    const under = renderRing(ctx, -4);
    expect(under.props['aria-valuenow']).toBe(0);
    expect(under.props['accessibilityValue']).toEqual({ min: 0, max: 1, now: 0 });
    const underFill = findAll(under, 'Circle').find((c) => c.props['stroke'] === '#4DC93A');
    expect(
      reevaluate((underFill!.props as { animatedProps?: unknown }).animatedProps)?.[
        'strokeDashoffset'
      ],
    ).toBeCloseTo(circumference, 5);

    const nan = renderRing(ctx, Number.NaN);
    expect(nan.props['aria-valuenow']).toBe(0);
    const nanFill = findAll(nan, 'Circle').find((c) => c.props['stroke'] === '#4DC93A');
    expect(
      reevaluate((nanFill!.props as { animatedProps?: unknown }).animatedProps)?.[
        'strokeDashoffset'
      ],
    ).toBeCloseTo(circumference, 5);
  });
});

describe('ProgressRing motion (§5.8 progress fill)', () => {
  it('full motion: the arc eases over 450ms', async () => {
    const ctx = await loadRing();
    ctx.motion.setMotionPreference('full');
    renderRing(ctx, 0.25);
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 0.25,
      config: expect.objectContaining({ duration: 450 }),
    });
  });

  it('reduced motion: the arc snaps with only the 120ms fade — no fill easing', async () => {
    const ctx = await loadRing();
    ctx.motion.setMotionPreference('reduced');
    const tree = renderRing(ctx, 0.25);

    // Snapped: the shared value holds the target directly (no eased call …
    const fill = findAll(tree, 'Circle').find((c) => c.props['stroke'] === '#4DC93A');
    const circumference = 2 * Math.PI * 27;
    expect(
      reevaluate((fill!.props as { animatedProps?: unknown }).animatedProps)?.['strokeDashoffset'],
    ).toBeCloseTo(circumference * 0.75, 5);
    // … only the 120ms opacity cross-fade runs).
    expect(rea.calls).not.toContainEqual(
      expect.objectContaining({ config: expect.objectContaining({ duration: 450 }) }),
    );
    expect(rea.calls).not.toContainEqual(
      expect.objectContaining({ config: expect.objectContaining({ duration: 300 }) }),
    );
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 1,
      config: expect.objectContaining({ duration: 120 }),
    });
  });
});
