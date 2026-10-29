import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P6 CheckNode contracts (docs/ui-ux/16-playful-momentum.md §6, §5.7/§5.8):
 *
 * 1. Checked state — undone = neutral face + 2px border + `borderStrong` lip;
 *    done = section bright fill, white ✓ glyph, lip = the section solid.
 * 2. A11y — `checkbox` role with `accessibilityState.checked` plus
 *    `aria-checked` (this RN-web does not map `accessibilityState` to the DOM).
 * 3. Reduced motion — the check-in burst (`useCheckBurst`) settles as a 120ms
 *    opacity cross-fade only: no scale transform, `burstCount` 0 (no dots).
 *    Full motion pops 1→1.2→1 and renders the 6-dot burst.
 *
 * Harness: `tests/pressable3D.test.ts`'s mocked-hooks + recording
 * react-native-reanimated pattern; the nested `Pressable3D` is expanded by
 * invoking it, and the real `useReducedMotion()` drives branch selection via
 * setMotionPreference.
 */

type ReaConfig = { duration?: number; easing?: unknown } | undefined;

type TimingCall = { api: 'withTiming'; toValue: unknown; config: ReaConfig };

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

/** Expand function-type nodes (the nested `Pressable3D`) by invoking them. */
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

function mergedStyle(node: Element): Record<string, unknown> {
  return Object.assign({}, ...styleArray(node));
}

function reevaluateAnimated(node: Element): Record<string, unknown> {
  const animated = styleArray(node).find(
    (entry) => typeof (entry as { __fn?: unknown }).__fn === 'function',
  ) as { __fn: () => Record<string, unknown> } | undefined;
  if (!animated) throw new Error('node carries no animated style');
  return animated.__fn();
}

async function loadComponent() {
  vi.resetModules();
  const motion = await import('@/core/theme/motion');
  const { CheckNode } = await import('@/core/ui/CheckNode');
  return { motion, CheckNode };
}

type Ctx = Awaited<ReturnType<typeof loadComponent>>;

function render(
  ctx: Ctx,
  overrides: Partial<{
    checked: boolean;
    disabled: boolean;
    onPress: () => void;
    accessibilityLabel: string;
    progress: number | undefined;
  }> = {},
) {
  return expand(
    ctx.CheckNode({
      checked: false,
      onPress: () => {},
      accessibilityLabel: 'Mark complete: Read',
      ...overrides,
    }),
  ) as Element;
}

/** The node wrapper carries `burst.nodeStyle` as a bare animated style object. */
function nodeAnimated(tree: Element): Element {
  const node = findAll(tree, 'Animated.View').find((view) => !Array.isArray(view.props['style']));
  if (!node) throw new Error('node wrapper not found');
  return node;
}

beforeEach(() => {
  rea.reset();
  storage.store.clear();
});

describe('CheckNode checked state (§6)', () => {
  it('unchecked: checkbox role, checked:false, aria-checked false, neutral face, no glyph', async () => {
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = render(ctx);

    const [pressable] = findAll(tree, 'Pressable');
    expect(pressable.props['accessibilityRole']).toBe('checkbox');
    expect(pressable.props['accessibilityLabel']).toBe('Mark complete: Read');
    expect(pressable.props['accessibilityState']).toEqual({ checked: false, disabled: false });
    expect(pressable.props['aria-checked']).toBe(false);

    const [face] = findAll(tree, 'Animated.View', []);
    const faces = findAll(tree, 'Animated.View');
    const faceStyle = mergedStyle(faces[faces.length - 1]);
    expect(faceStyle['backgroundColor']).toBe('#FFFFFF');
    expect(faceStyle['borderColor']).toBe('#E3E6EE');
    expect(faceStyle['borderWidth']).toBe(2);
    expect(face).toBeDefined();

    expect(findAll(tree, 'MaterialIcons')).toHaveLength(0);
  });

  it('checked: checked:true, aria-checked true, bright face + solid lip + white ✓ glyph', async () => {
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = render(ctx, {
      checked: true,
      accessibilityLabel: 'Mark incomplete: Read',
    });

    const [pressable] = findAll(tree, 'Pressable');
    expect(pressable.props['accessibilityLabel']).toBe('Mark incomplete: Read');
    expect(pressable.props['accessibilityState']).toEqual({ checked: true, disabled: false });
    expect(pressable.props['aria-checked']).toBe(true);

    // Lip slab = section solid under the done face (brand default `buttonLip`).
    // The slab is the 32px node View (the 48px hit container comes first).
    const [slab] = findAll(tree, 'View').filter(
      (view) => mergedStyle(view)['width'] === 32 && mergedStyle(view)['height'] === 32,
    );
    expect(mergedStyle(slab)).toMatchObject({ backgroundColor: '#135B1F' });

    const faces = findAll(tree, 'Animated.View');
    const faceStyle = mergedStyle(faces[faces.length - 1]);
    // Done = section bright fill (brand default `primaryBright`).
    expect(faceStyle['backgroundColor']).toBe('#4DC93A');
    expect(faceStyle['borderColor']).toBe('#4DC93A');

    const [glyph] = findAll(tree, 'MaterialIcons');
    expect(glyph.props['name']).toBe('check');
    expect(glyph.props['color']).toBe('#FFFFFF');
  });
});

describe('CheckNode check-in burst (§5.8 light tier)', () => {
  it('full motion: press pops 1→1.2→1 and renders the 6-dot burst', async () => {
    const onPress = vi.fn();
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = render(ctx, { checked: true, onPress });

    // 6 burst dots around the node (burst geometry lives in the node).
    const dots = findAll(tree, 'View').filter(
      (view) => mergedStyle(view)['width'] === 5 && mergedStyle(view)['height'] === 5,
    );
    expect(dots).toHaveLength(6);

    const [pressable] = findAll(tree, 'Pressable');
    (pressable.props['onPress'] as () => void)();
    expect(onPress).toHaveBeenCalledTimes(1);

    // The pop peak is the light-tier 1.2 scale inside the burst budget.
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 1.2,
      config: { duration: 200 },
    });
    // The node wrapper animates scale in the full-motion branch.
    expect(reevaluateAnimated(nodeAnimated(tree))['transform']).toEqual([{ scale: 1 }]);
  });

  it('reduced motion: opacity cross-fade only — no scale, no dots', async () => {
    const onPress = vi.fn();
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('reduced');
    const tree = render(ctx, { checked: true, onPress });

    // No burst dots at all under reduced motion.
    const dots = findAll(tree, 'View').filter(
      (view) => mergedStyle(view)['width'] === 5 && mergedStyle(view)['height'] === 5,
    );
    expect(dots).toHaveLength(0);

    const nodeStyle = reevaluateAnimated(nodeAnimated(tree));
    expect(Object.keys(nodeStyle)).toEqual(['opacity']);
    expect(nodeStyle['transform']).toBeUndefined();

    (findAll(tree, 'Pressable')[0].props['onPress'] as () => void)();
    expect(onPress).toHaveBeenCalledTimes(1);

    // Settled state cross-fades in over the reduced-motion 120ms.
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 1,
      config: { duration: 120 },
    });
    // No pop peak was spent in the reduced branch.
    expect(rea.calls).not.toContainEqual({
      api: 'withTiming',
      toValue: 1.2,
      config: { duration: 200 },
    });
    expect(Object.keys(reevaluateAnimated(nodeAnimated(tree)))).toEqual(['opacity']);
  });

  it('disabled passes through to the press target', async () => {
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = render(ctx, { disabled: true });
    const [pressable] = findAll(tree, 'Pressable');
    expect(pressable.props['disabled']).toBe(true);
    expect(pressable.props['accessibilityState']).toEqual({ checked: false, disabled: true });
  });
});

describe('CheckNode quantitative ring (§6)', () => {
  it('renders the progress ring only when a progress value is given', async () => {
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');

    const withRing = render(ctx, { progress: 0.5 });
    const circles = findAll(withRing, 'Circle');
    expect(circles).toHaveLength(2);
    // The progress arc offsets its dash by the remaining fraction.
    const arc = circles[1];
    const dash = Number(arc.props['strokeDasharray']);
    expect(Number(arc.props['strokeDashoffset'])).toBeCloseTo(dash * 0.5, 5);

    const withoutRing = render(ctx);
    expect(findAll(withoutRing, 'Circle')).toHaveLength(0);
  });
});
