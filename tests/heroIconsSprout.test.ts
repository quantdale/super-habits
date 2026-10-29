import { describe, expect, it, vi } from 'vitest';

/**
 * P9 hero icon + mascot render contract (docs/ui-ux/16-playful-momentum.md §5.9):
 *
 * 1. Every one of the 14 hero icons renders as a duotone SVG on the 32 grid
 *    and paints both tones (`bright` + `lip`) from its props.
 * 2. Every Sprout pose renders distinct SVG geometry.
 * 3. All of them are decorative: `accessibilityElementsHidden`,
 *    `importantForAccessibility="no-hide-descendants"`, `aria-hidden` — so
 *    accessible labels/names of surrounding controls never change.
 *
 * Harness: the checkNode.test.ts recorded-jsx pattern — react/jsx-runtime is
 * mocked to plain objects and react-native-svg primitives to string tags, so
 * components are invoked as functions and the tree is walked directly.
 */

type Node = { type: unknown; props: Record<string, unknown> };

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

vi.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Ellipse: 'Ellipse',
  Path: 'Path',
  Rect: 'Rect',
  Defs: 'Defs',
  Stop: 'Stop',
}));

const { HERO_ICONS } = await import('@/core/ui/illustrations/icons');
const { Sprout } = await import('@/core/ui/illustrations/Sprout');
const { SPROUT_POSES } = await import('@/core/ui/illustrations/sproutPoses');

function walk(node: unknown, visit: (n: Node) => void) {
  if (node == null || typeof node !== 'object') return;
  const n = node as Node;
  if (typeof n.type === 'string' && n.props) {
    visit(n);
    walk(n.props.children, visit);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (n.props) walk(n.props.children, visit);
}

function collect(node: unknown): Node[] {
  const out: Node[] = [];
  walk(node, (n) => out.push(n));
  return out;
}

function expectDecorativeSvg(node: Node) {
  expect(node.type).toBe('Svg');
  expect(node.props.accessibilityElementsHidden).toBe(true);
  expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(node.props['aria-hidden']).toBe(true);
}

describe('P9 hero icons', () => {
  it('exposes exactly the 14 duotone hero icons', () => {
    expect(Object.keys(HERO_ICONS)).toEqual([
      'TodayIcon',
      'TodosIcon',
      'HabitsIcon',
      'FocusIcon',
      'WorkoutIcon',
      'CaloriesIcon',
      'FlameIcon',
      'XpBoltIcon',
      'FreezeShieldIcon',
      'TrophyIcon',
      'ChestIcon',
      'BadgeRibbonIcon',
      'SeedlingIcon',
      'GardenIcon',
    ]);
  });

  for (const [name, Icon] of Object.entries(HERO_ICONS)) {
    it(`${name}: renders on the 32 grid with both duotone tones and is hidden from accessibility`, () => {
      const tree = Icon({ size: 48, bright: '#BRIGHT', lip: '#LIP' }) as unknown as Node;
      const nodes = collect(tree);

      expectDecorativeSvg(tree);
      expect(tree.props.width).toBe(48);
      expect(tree.props.height).toBe(48);
      expect(tree.props.viewBox).toBe('0 0 32 32');
      expect(nodes.length).toBeGreaterThan(1);

      const painted = nodes.flatMap((n) => [n.props.fill, n.props.stroke]).filter(Boolean);
      expect(painted).toContain('#BRIGHT');
      expect(painted).toContain('#LIP');
    });
  }
});

describe('P9 Sprout mascot', () => {
  it('exposes the 5 poses', () => {
    expect([...SPROUT_POSES]).toEqual(['idle', 'cheer', 'nap', 'think', 'proud']);
  });

  for (const pose of SPROUT_POSES) {
    it(`${pose}: renders distinct geometry and is hidden from accessibility`, () => {
      const tree = Sprout({ pose, size: 120 }) as unknown as Node;
      const nodes = collect(tree);

      expectDecorativeSvg(tree);
      expect(tree.props.width).toBe(120);
      expect(tree.props.viewBox).toBe('0 0 96 96');
      // Every pose draws the round face plus leaves/stem details.
      expect(nodes.length).toBeGreaterThan(8);
    });
  }

  it('poses differ from each other (geometry is pose-driven)', () => {
    const rendered = SPROUT_POSES.map((pose) =>
      JSON.stringify(Sprout({ pose, size: 120 }) as unknown as Node),
    );
    expect(new Set(rendered).size).toBe(SPROUT_POSES.length);
  });
});
