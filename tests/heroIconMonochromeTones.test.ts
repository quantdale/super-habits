import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * P10 r2 defect fix — inactive-tab monochrome hero icons.
 *
 * The defect: `app/index.tsx` painted BOTH duotone passes (`bright` + `lip`)
 * with `tokens.iconMuted`, so every inactive hero icon flattened into a
 * silhouette (To Do = plain grey square, Focus = grey blob). This pins the
 * fix's contract:
 *
 * 1. `heroIconMonochromeTones` always returns two distinct colors (including
 *    for themes where `iconMuted` falls back to `textMuted`).
 * 2. Every tab hero icon rendered with the pair paints BOTH tones — the inner
 *    detail survives.
 * 3. Both tones clear the WCAG non-text 3:1 bar against the tab tile in the
 *    light and dark themes.
 * 4. The shell call site uses the helper (and never re-paints both passes with
 *    one token).
 *
 * Harness: the heroIconsSprout.test.ts recorded-jsx pattern.
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

const { heroIconMonochromeTones } = await import('@/core/ui/illustrations/icons');
const { TodayIcon, TodosIcon, HabitsIcon, FocusIcon, WorkoutIcon, CaloriesIcon } =
  await import('@/core/ui/illustrations/icons');
const { contrastRatio, WCAG_AA_NON_TEXT } = await import('@/core/theme/contrast');
const { light } = await import('@/core/theme/themes/light');
const { dark } = await import('@/core/theme/themes/dark');

function walk(node: unknown, visit: (n: Node) => void) {
  if (node == null || typeof node !== 'object') return;
  const n = node as Node;
  visit(n);
  const children = n.props?.children;
  if (Array.isArray(children)) children.forEach((c) => walk(c, visit));
  else if (children) walk(children, visit);
}

/** All fill/stroke colors painted in a rendered icon tree. */
function paintedColors(
  icon: (props: Record<string, unknown>) => unknown,
  props: Record<string, unknown> = {},
): Set<string> {
  const colors = new Set<string>();
  walk(icon(props), (n) => {
    for (const key of ['fill', 'stroke', 'color']) {
      const value = n.props?.[key];
      if (typeof value === 'string' && value !== 'none') colors.add(value.toLowerCase());
    }
  });
  return colors;
}

const TAB_ICONS = { TodayIcon, TodosIcon, HabitsIcon, FocusIcon, WorkoutIcon, CaloriesIcon };

describe('P10 r2: inactive tab hero icons keep their duotone detail', () => {
  it('returns two distinct tones from two muted inputs', () => {
    const tones = heroIconMonochromeTones('#5B6475', '#9AA2B1');
    expect(tones.bright).toBe('#5B6475');
    expect(tones.lip).not.toBe(tones.bright);
    expect(tones.lip.toLowerCase()).not.toBe(tones.bright.toLowerCase());
  });

  it('never collapses to one flat tone when the theme mirrors iconMuted onto textMuted', () => {
    // createTheme mirrors `iconMuted` onto `textMuted` for the 12 brand themes.
    const tones = heroIconMonochromeTones('#b4a8d6', '#b4a8d6');
    expect(tones.lip.toLowerCase()).not.toBe(tones.bright.toLowerCase());
  });

  it('light theme: both tones reach 3:1 against the tab tile', () => {
    const tones = heroIconMonochromeTones(light.tokens.textMuted, light.tokens.iconMuted);
    expect(contrastRatio(tones.bright, light.tokens.tabRail)).toBeGreaterThanOrEqual(
      WCAG_AA_NON_TEXT,
    );
    expect(contrastRatio(tones.lip, light.tokens.tabRail)).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
  });

  it('dark theme: both tones reach 3:1 against the tab tile', () => {
    const tones = heroIconMonochromeTones(dark.tokens.textMuted, dark.tokens.iconMuted);
    expect(contrastRatio(tones.bright, dark.tokens.tabRail)).toBeGreaterThanOrEqual(
      WCAG_AA_NON_TEXT,
    );
    expect(contrastRatio(tones.lip, dark.tokens.tabRail)).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
  });

  it('every tab hero icon paints BOTH monochrome tones (detail survives)', () => {
    const tones = heroIconMonochromeTones(light.tokens.textMuted, light.tokens.iconMuted);
    for (const [name, Icon] of Object.entries(TAB_ICONS)) {
      const colors = paintedColors(Icon, tones);
      expect(colors.has(tones.bright.toLowerCase()), `${name} paints the silhouette`).toBe(true);
      expect(colors.has(tones.lip.toLowerCase()), `${name} paints the detail tone`).toBe(true);
    }
  });

  it('the shell call site uses the helper and never flattens both passes to one token', () => {
    const source = readFileSync(join(__dirname, '..', 'app', 'index.tsx'), 'utf8');
    expect(source).toContain('heroIconMonochromeTones(tokens.textMuted, tokens.iconMuted)');
    // The defect expression must not come back.
    expect(source).not.toMatch(/bright=\{[^}]*iconMuted\}\s*\n\s*lip=\{[^}]*iconMuted\}/);
    expect(source).not.toContain('bright={tokens.iconMuted}');
    expect(source).not.toContain('lip={tokens.iconMuted}');
  });
});
