import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, tintOver, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import { getRewardAccents, getSectionAccents } from '@/constants/sectionColors';
import { GARDEN_SUN } from '@/features/momentum/momentumGarden.visual';

/**
 * P20 Momentum detail — Planning (Gold) label ink
 * (`docs/ui-ux/16-playful-momentum.md` §7 "Momentum Garden", §5.1 hue tiers).
 *
 * `MomentumDetailView` paints every area label with its appearance-resolved
 * TEXT tier. Planning is the one Gold (reward) bed, so its ink is
 * `rewardAccents.badge.text` (`getRewardAccents` → bronze `#9A5B00` in light,
 * Gold bright in dark).
 *
 * Codex P2 on PR #202: the view returned the decorative `GARDEN_SUN.fill`
 * (`#FFC81F`) as text instead, which measures 1.55:1 on the white card and
 * 1.35:1 on the Focus-tinted chip — invisible to a sighted reader and far
 * below the §5.1 text floor. The two label surfaces are:
 * - the "Why each area grows" heading, on the card face (`tokens.surface`);
 * - the recent-history contribution chips, on the Focus tint the planning
 *   species paints with (`sectionAccents.focus.tint`, `accentKeyFor()`).
 *
 * Floors: text 4.5:1 (WCAG AA, 11–15px labels). Every theme in the registry is
 * covered so a palette edit cannot silently regress a surface that only renders
 * in one appearance.
 */

/** Effective face under an accent tint: opaque tints paint themselves, translucent ones (Cyberpunk Neon) composite onto the card. */
function tintFace(surface: string, tint: string): string {
  const hex = tint.replace('#', '');
  if (hex.length < 8) return tint;
  return tintOver(surface, `#${hex.slice(0, 6)}`, Number.parseInt(hex.slice(6, 8), 16) / 255);
}

describe('Planning (Gold) label ink clears the text floor on both label surfaces', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const accents = getSectionAccents(theme.appearance, theme.sectionOverrides);
    // The ink the production view resolves for the Gold bed — the resolved
    // token, never a hardcoded copy.
    const ink = getRewardAccents(theme.appearance).badge.text;
    // `accentKeyFor()`: Planning wears the Focus tint (it has no section slot).
    const chip = tintFace(tokens.surface, accents.focus.tint);

    it(`${id} (${theme.appearance}): Planning heading clears 4.5 on the card surface`, () => {
      const ratio = contrastRatio(ink, tokens.surface);
      expect(ratio, `${id}: Planning ink ${ink} on ${tokens.surface}`).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
    });

    it(`${id} (${theme.appearance}): Planning chip label clears 4.5 on the Focus tint`, () => {
      const ratio = contrastRatio(ink, chip);
      expect(ratio, `${id}: Planning ink ${ink} on ${chip}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }
});

describe('the Gold text tone resolves in BOTH appearances', () => {
  const cases = [
    { appearance: 'light', surface: THEME_REGISTRY.light.tokens.surface },
    { appearance: 'dark', surface: THEME_REGISTRY.dark.tokens.surface },
  ] as const;

  for (const { appearance, surface } of cases) {
    it(`${appearance}: the resolved Gold text tone is readable on the card face`, () => {
      const accent = getRewardAccents(appearance).badge;
      // `getRewardAccents` keeps the bright tier as *text* only where it is
      // readable: light swaps in the bronze ink (#9A5B00), dark keeps the Gold
      // bright (fill and text are the same hex there BY DESIGN, 10.62:1 on
      // #1A1F2B). The label always paints `text` — never the raw fill — so
      // both appearances stay above the floor.
      expect(accent.text).toMatch(/^#[0-9a-fA-F]{6}$/);
      if (appearance === 'light') expect(accent.text).not.toBe(accent.fill);
      expect(contrastRatio(accent.text, surface)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it('light and dark resolve DIFFERENT text tones (appearance-aware, not a fixed fill)', () => {
    const light = getRewardAccents('light').badge.text;
    const dark = getRewardAccents('dark').badge.text;
    expect(light).not.toBe(dark);
    expect(light).not.toBe(GARDEN_SUN.fill);
  });
});

describe('the pre-fix regression (§5.1 forbids Gold as text)', () => {
  it('records why the decorative sun fill cannot paint a label', () => {
    const lightSurfaces = Object.entries(THEME_REGISTRY).filter(
      ([, theme]) => theme.appearance === 'light',
    );
    for (const [id, theme] of lightSurfaces) {
      const accents = getSectionAccents(theme.appearance, theme.sectionOverrides);
      const chip = tintFace(theme.tokens.surface, accents.focus.tint);
      // The regression the P2 reported: GARDEN_SUN.fill as TEXT ink.
      expect(
        contrastRatio(GARDEN_SUN.fill, theme.tokens.surface),
        `${id}: sun fill on the card face`,
      ).toBeLessThan(WCAG_AA_TEXT);
      expect(
        contrastRatio(GARDEN_SUN.fill, chip),
        `${id}: sun fill on the Focus tint`,
      ).toBeLessThan(WCAG_AA_TEXT);
    }
  });
});

/**
 * Wiring pins: the contrast math only protects the UI if the view keeps
 * resolving through it. Source-level because the repository has no React
 * renderer for component tests (the detail view pulls in Reanimated/vector
 * icons, which the node unit environment cannot load).
 */
describe('Momentum detail wiring', () => {
  const source = readFileSync(
    resolve(__dirname, '../features/momentum/MomentumDetailView.tsx'),
    'utf8',
  );
  const sourceColorBody = /function sourceColor\([\s\S]*?\n}/.exec(source)?.[0] ?? '';

  it('sourceColor() paints the appearance-resolved Gold text tone', () => {
    expect(sourceColorBody, 'sourceColor() must exist at module scope').toContain(
      'function sourceColor(',
    );
    expect(sourceColorBody).toContain('rewardAccents.badge.text');
  });

  it('sourceColor() never returns the decorative sun fill as text ink', () => {
    // The exact old behaviour: `if (hue === 'gold') return GARDEN_SUN.fill;`
    expect(sourceColorBody).not.toContain('GARDEN_SUN');
    expect(sourceColorBody).not.toMatch(/REWARD_HUES\.accent\.bright/);
  });

  it('no text color in the view resolves to a bright Gold fill', () => {
    const textColors = [...source.matchAll(/\bcolor:\s*([^,}]+)/g)].map((match) => match[1].trim());
    expect(textColors.length).toBeGreaterThan(0);
    for (const expression of textColors) {
      expect(expression, `text color: ${expression}`).not.toContain('GARDEN_SUN');
      expect(expression, `text color: ${expression}`).not.toMatch(/accent\.bright/);
    }
  });

  it('both Planning label surfaces route through sourceColor()', () => {
    // The "Why each area grows" heading ...
    expect(source).toMatch(/color:\s*sourceColor\(explanation\.source/);
    // ... and the recent-history chip label.
    expect(source).toMatch(/const ink = sourceColor\(source/);
    expect(source).toMatch(/color: ink/);
  });

  it('Planning chips still wear the Focus tint (accentKeyFor: Gold → Focus)', () => {
    expect(source).toContain("'gold' ? 'focus' :");
  });

  it('the sun fill survives only as decorative art (a Card accent)', () => {
    // The milestones card keeps the Gold edge; that is a 22%-alpha border, not text.
    const sunUses = [...source.matchAll(/GARDEN_SUN\[?[^;]*/g)].map((match) => match[0]);
    expect(sunUses.length).toBeGreaterThan(0);
    expect(source).toContain('accentColor={GARDEN_SUN.fill}');
  });
});
