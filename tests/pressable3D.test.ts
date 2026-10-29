import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P5 Pressable3D contracts (docs/ui-ux/16-playful-momentum.md §5.7/§5.8):
 *
 * 1. Lip geometry — the outer slab is the lip color + radius; the animated face
 *    sits on `marginBottom: lip` and carries the face color + radius.
 * 2. Pressed translate = lip — pressing drives the face down by exactly the lip
 *    (80ms down / 120ms up), so the face covers the lip band.
 * 3. Reduced motion — no translate; a 120ms opacity cross-fade only.
 *
 * The vitest unit project is node-environment with no renderer installed, so
 * (following `tests/motionHooks.test.ts`) the component is exercised through
 * mocked hooks + a recording react-native-reanimated mock: JSX is reduced to
 * plain { type, props } nodes via a mocked jsx-runtime, and the component is
 * invoked as an ordinary function. The real `useReducedMotion()` from
 * core/theme/motion drives branch selection via setMotionPreference.
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

// Vitest's esbuild compiles this TSX with the classic JSX pragma, so the
// component's `React.createElement` calls resolve against the global.
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
    // Keep the worklet re-evaluable so a test can press and re-read the style.
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

vi.mock('@/core/providers/themeContext', () => ({
  useAppTheme: () => ({ tokens: { accent: '#1769D8' } }),
}));

type Element = { type: unknown; props: Record<string, unknown> };

function isElement(node: unknown): node is Element {
  return typeof node === 'object' && node !== null && 'type' in node && 'props' in node;
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

function reevaluate(face: Element): Record<string, unknown> {
  const style = face.props['style'] as Record<string, unknown>[];
  const animated = style.find(
    (entry) => typeof (entry as { __fn?: unknown }).__fn === 'function',
  ) as { __fn: () => Record<string, unknown> } | undefined;
  if (!animated) throw new Error('face carries no animated style');
  return animated.__fn();
}

async function loadComponent() {
  vi.resetModules();
  const motion = await import('@/core/theme/motion');
  const { Pressable3D } = await import('@/core/ui/Pressable3D');
  return { motion, Pressable3D };
}

type Ctx = Awaited<ReturnType<typeof loadComponent>>;

function render(ctx: Ctx, lip: 2 | 3 | 4) {
  return ctx.Pressable3D({
    lip,
    faceColor: '#FFFFFF',
    lipColor: '#D5DAE3',
    radius: 14,
    onPress: () => {},
    children: null,
  }) as Element;
}

function styleArray(node: Element): Record<string, unknown>[] {
  return node.props['style'] as Record<string, unknown>[];
}

function mergedStyle(node: Element): Record<string, unknown> {
  return Object.assign({}, ...styleArray(node));
}

beforeEach(() => {
  rea.reset();
  storage.store.clear();
});

describe('Pressable3D lip slab geometry (§5.7)', () => {
  it.each([2, 3, 4] as const)(
    'lip %i: outer = lip color + radius, face on marginBottom = lip',
    async (lip) => {
      const ctx = await loadComponent();
      ctx.motion.setMotionPreference('full');
      const tree = render(ctx, lip);

      const [outer] = findAll(tree, 'View');
      expect(mergedStyle(outer)).toMatchObject({
        backgroundColor: '#D5DAE3',
        borderRadius: 14,
      });

      const [face] = findAll(tree, 'Animated.View');
      expect(mergedStyle(face)).toMatchObject({
        marginBottom: lip,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
      });
    },
  );
});

describe('Pressable3D press travel (§5.8 "Press" row)', () => {
  it.each([2, 3, 4] as const)(
    'lip %i: pressed translate = lip (80ms down / 120ms up)',
    async (lip) => {
      const ctx = await loadComponent();
      ctx.motion.setMotionPreference('full');
      const tree = render(ctx, lip);
      const [face] = findAll(tree, 'Animated.View');
      const [pressable] = findAll(tree, 'Pressable');

      expect(reevaluate(face)['transform']).toEqual([{ translateY: 0 }]);

      (pressable.props['onPressIn'] as () => void)();
      expect(rea.calls).toContainEqual({
        api: 'withTiming',
        toValue: lip,
        config: { duration: 80 },
      });
      // The face travels down by exactly the lip and covers the lip band.
      expect(reevaluate(face)['transform']).toEqual([{ translateY: lip }]);

      (pressable.props['onPressOut'] as () => void)();
      expect(rea.calls).toContainEqual({
        api: 'withTiming',
        toValue: 0,
        config: expect.objectContaining({ duration: 120 }),
      });
      expect(reevaluate(face)['transform']).toEqual([{ translateY: 0 }]);
    },
  );

  it('wires accessibility and disabled through to the press target', async () => {
    const ctx = await loadComponent();
    ctx.motion.setMotionPreference('full');
    const tree = ctx.Pressable3D({
      lip: 3,
      faceColor: '#FFFFFF',
      lipColor: '#D5DAE3',
      radius: 16,
      disabled: true,
      onPress: () => {},
      accessibilityRole: 'button',
      accessibilityLabel: 'Save',
      accessibilityState: { disabled: true, busy: true },
      hitSlop: { top: 4, bottom: 4 },
      children: null,
    }) as Element;
    const [pressable] = findAll(tree, 'Pressable');
    expect(pressable.props['disabled']).toBe(true);
    expect(pressable.props['accessibilityRole']).toBe('button');
    expect(pressable.props['accessibilityLabel']).toBe('Save');
    expect(pressable.props['accessibilityState']).toEqual({ disabled: true, busy: true });
    expect(pressable.props['hitSlop']).toEqual({ top: 4, bottom: 4 });
  });
});

describe('Pressable3D reduced motion (§5.8 fallback)', () => {
  it.each([2, 3, 4] as const)(
    'lip %i: no translate — 120ms opacity cross-fade only',
    async (lip) => {
      const ctx = await loadComponent();
      ctx.motion.setMotionPreference('reduced');
      const tree = render(ctx, lip);
      const [face] = findAll(tree, 'Animated.View');
      const [pressable] = findAll(tree, 'Pressable');

      const restStyle = reevaluate(face);
      expect(Object.keys(restStyle)).toEqual(['opacity']);
      expect(restStyle['transform']).toBeUndefined();

      (pressable.props['onPressIn'] as () => void)();
      expect(rea.calls).toContainEqual({
        api: 'withTiming',
        toValue: expect.any(Number),
        config: { duration: 120 },
      });
      // No translateY anywhere in the reduced branch.
      const pressedStyle = reevaluate(face);
      expect(Object.keys(pressedStyle)).toEqual(['opacity']);
      expect(pressedStyle['transform']).toBeUndefined();
      expect(pressedStyle['opacity']).toBeLessThan(1);

      (pressable.props['onPressOut'] as () => void)();
      expect(reevaluate(face)['opacity']).toBe(1);
    },
  );
});

describe('P5 callers keep the §5.7/§6 lip mapping (source contract)', () => {
  const CORE_UI = join(__dirname, '..', 'core', 'ui');

  it('Button maps sm/md/lg to lips 2/3/4 and radii 12/16', () => {
    const source = readFileSync(join(CORE_UI, 'Button.tsx'), 'utf8');
    expect(source).toMatch(/sm:\s*\{\s*height:\s*36,\s*lip:\s*2,/);
    expect(source).toMatch(/md:\s*\{\s*height:\s*size\.buttonHeight,\s*lip:\s*3,/);
    expect(source).toMatch(/lg:\s*\{\s*height:\s*size\.buttonHeightLg,\s*lip:\s*4,/);
    expect(source).toMatch(/sizeRole === 'sm'\s*\?\s*radius\.sm\s*:\s*radius\.md/);
    // The gradient is gone: Button rides the single depth primitive.
    expect(source).not.toMatch(/LinearGradient|expo-linear-gradient/);
    expect(source).toMatch(/<Pressable3D/);
  });

  it('IconButton is the 44×44 + 2 lip slab with a lip-free flat variant', () => {
    const source = readFileSync(join(CORE_UI, 'IconButton.tsx'), 'utf8');
    expect(source).toMatch(/<Pressable3D/);
    expect(source).toMatch(/lip=\{2\}/);
    expect(source).toMatch(/radius=\{14\}/);
    expect(source).toMatch(/'flat'[\s\S]{0,80}'transparent'/);
  });
});
