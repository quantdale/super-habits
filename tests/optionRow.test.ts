import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * P6 OptionRow contracts (docs/ui-ux/16-playful-momentum.md §6, §5.7/§5.8):
 *
 * 1. Selected state — unselected = white face + 2px border + `borderStrong`
 *    lip; selected = section tint face, 2px section-solid border, solid-color
 *    lip, trailing check badge.
 * 2. A11y — `radio` role with `accessibilityState.selected` plus `aria-checked`
 *    (this RN-web does not map `accessibilityState` to the DOM).
 * 3. Reduced motion — pressing drives the `Pressable3D` opacity-only branch
 *    (120ms cross-fade, no translate); full motion translates by the 3px lip.
 *
 * The vitest unit project is node-environment with no renderer installed, so
 * (following `tests/pressable3D.test.ts`) the component is exercised through
 * mocked hooks + a recording react-native-reanimated mock: JSX is reduced to
 * plain { type, props } nodes via a mocked jsx-runtime, function-type nodes
 * (the nested `Pressable3D`) are expanded by invoking them, and the real
 * `useReducedMotion()` from core/theme/motion drives branch selection via
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

vi.mock('@/core/providers/themeContext', () => ({
  useAppTheme: () => ({
    resolvedTheme: 'light',
    tokens: {
      accent: '#1769D8',
      primary: '#1A7F2B',
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
  const { OptionRow } = await import('@/core/ui/OptionRow');
  return { motion, OptionRow };
}

type Ctx = Awaited<ReturnType<typeof loadComponent>>;

function render(
  ctx: Ctx,
  overrides: Partial<{
    selected: boolean;
    disabled: boolean;
    onPress: () => void;
    label: string;
    description: string | undefined;
    accessibilityLabel: string | undefined;
  }> = {},
) {
  return expand(
    ctx.OptionRow({
      label: 'Morning workout',
      description: 'Push day · 45 min',
      selected: false,
      onPress: () => {},
      accentColor: '#1769D8',
      ...overrides,
    }),
  ) as Element;
}

beforeEach(() => {
  rea.reset();
  storage.store.clear();
});

describe('OptionRow selected state (§6)', () => {
  it('unselected: radio role, selected:false, aria-checked false, neutral face, no badge', async () => {
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = render(ctx);

    const [pressable] = findAll(tree, 'Pressable');
    expect(pressable.props['accessibilityRole']).toBe('radio');
    expect(pressable.props['accessibilityState']).toEqual({ selected: false, disabled: false });
    expect(pressable.props['aria-checked']).toBe(false);

    const [outer] = findAll(tree, 'View');
    expect(mergedStyle(outer)).toMatchObject({ backgroundColor: '#D5DAE3' });

    const [face] = findAll(tree, 'Animated.View');
    const faceStyle = mergedStyle(face);
    expect(faceStyle['backgroundColor']).toBe('#FFFFFF');
    expect(faceStyle['borderColor']).toBe('#E3E6EE');
    expect(faceStyle['borderWidth']).toBe(2);

    expect(findAll(tree, 'MaterialIcons')).toHaveLength(0);
  });

  it('selected: selected:true, aria-checked true, tint face + solid border/lip + check badge', async () => {
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = render(ctx, { selected: true });

    const [pressable] = findAll(tree, 'Pressable');
    expect(pressable.props['accessibilityState']).toEqual({ selected: true, disabled: false });
    expect(pressable.props['aria-checked']).toBe(true);

    const [outer] = findAll(tree, 'View');
    // Solid-color lip under the selected face.
    expect(mergedStyle(outer)).toMatchObject({ backgroundColor: '#1769D8' });

    const [face] = findAll(tree, 'Animated.View');
    const faceStyle = mergedStyle(face);
    // Section tint face (a hue wash, not the raw accent and not white).
    expect(faceStyle['backgroundColor']).not.toBe('#FFFFFF');
    expect(faceStyle['backgroundColor']).not.toBe('#1769D8');
    expect(String(faceStyle['backgroundColor'])).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // 2px section-solid border.
    expect(faceStyle['borderColor']).toBe('#1769D8');

    // Trailing check badge (decorative white check on the solid accent).
    const [badge] = findAll(tree, 'MaterialIcons');
    expect(badge.props['name']).toBe('check');
  });

  it('disabled and custom accessible name pass through to the press target', async () => {
    const onPress = vi.fn();
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = render(ctx, {
      disabled: true,
      onPress,
      accessibilityLabel: 'Theme: Nord',
    });

    const [pressable] = findAll(tree, 'Pressable');
    expect(pressable.props['disabled']).toBe(true);
    expect(pressable.props['accessibilityLabel']).toBe('Theme: Nord');
    expect(pressable.props['accessibilityState']).toEqual({ selected: false, disabled: true });
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('OptionRow press depth (§6 lip 3 via Pressable3D)', () => {
  it('full motion: face travels the 3px lip (80ms down / 120ms up)', async () => {
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = render(ctx);
    const [face] = findAll(tree, 'Animated.View');
    const [pressable] = findAll(tree, 'Pressable');

    (pressable.props['onPressIn'] as () => void)();
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 3,
      config: { duration: 80 },
    });
    expect(reevaluateAnimated(face)['transform']).toEqual([{ translateY: 3 }]);

    (pressable.props['onPressOut'] as () => void)();
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: 0,
      config: expect.objectContaining({ duration: 120 }),
    });
    expect(reevaluateAnimated(face)['transform']).toEqual([{ translateY: 0 }]);
  });

  it('reduced motion: no translate — 120ms opacity cross-fade only', async () => {
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('reduced');
    const tree = render(ctx);
    const [face] = findAll(tree, 'Animated.View');
    const [pressable] = findAll(tree, 'Pressable');

    const restStyle = reevaluateAnimated(face);
    expect(Object.keys(restStyle)).toEqual(['opacity']);
    expect(restStyle['transform']).toBeUndefined();

    (pressable.props['onPressIn'] as () => void)();
    expect(rea.calls).toContainEqual({
      api: 'withTiming',
      toValue: expect.any(Number),
      config: { duration: 120 },
    });
    const pressedStyle = reevaluateAnimated(face);
    expect(Object.keys(pressedStyle)).toEqual(['opacity']);
    expect(pressedStyle['transform']).toBeUndefined();
    expect(pressedStyle['opacity']).toBeLessThan(1);

    (pressable.props['onPressOut'] as () => void)();
    expect(reevaluateAnimated(face)['opacity']).toBe(1);
  });

  it('pressing fires the row callback', async () => {
    const onPress = vi.fn();
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = render(ctx, { onPress });
    const [pressable] = findAll(tree, 'Pressable');
    (pressable.props['onPress'] as () => void)();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
