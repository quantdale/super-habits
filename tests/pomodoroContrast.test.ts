import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, inkOnFill, readableAccent, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK, SECTION_COLORS } from '@/constants/sectionColors';

/**
 * Focus hero ghost-action contrast (Codex P2 on PR #192).
 *
 * The Focus timer hero (`<Card variant="hero" accentColor={COLOR}>`) paints a
 * FIXED Grape face (`SECTION_HUES.focus.bright` = `#A37BFF`) that does not
 * follow the theme. The `End` action that replaces Start while the timer is
 * running/paused is a `ghost` Button, i.e. a transparent face — its label is
 * painted directly on that hero fill. `Button` derived the label with
 * `readableAccent(tokens.button, tokens.background)`, so the ink was resolved
 * against the CANVAS instead of the surface actually behind it:
 *
 * - light: `#1A7F2B` on `#A37BFF` → **1.66:1**
 * - dark:  `#4DC93A` on `#A37BFF` → **1.42:1**
 *
 * The fix threads the real behind-surface through `Button`'s new `onColor`
 * prop (`onColor={COLOR}` on the hero's End / Starting controls) and derives
 * the ink for THAT fill: nudge the theme accent toward legibility on the fill,
 * then enforce the floor with `inkOnFill(..., SECTION_ON_BRIGHT_INK)` — the
 * same §5.1 bright-fill ink the hero Card already forces on its own text.
 *
 * Defaults are untouched: a Button without `onColor` resolves against the
 * theme background (ghost) / surface, so no other surface changes.
 */

/** The Focus hero face — `accentColor={COLOR}` is theme-invariant. */
const HERO_FILL = SECTION_COLORS.focus;

/** The ink `Button` now derives for a face-less control on the hero fill. */
function heroGhostInk(buttonHue: string): string {
  return inkOnFill(HERO_FILL, readableAccent(buttonHue, HERO_FILL), SECTION_ON_BRIGHT_INK);
}

/** The ink `Button` produced BEFORE the fix (resolved against the canvas). */
function preFixGhostInk(buttonHue: string, background: string): string {
  return readableAccent(buttonHue, background);
}

describe('Focus hero ghost action label ink (all themes)', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;

    it(`${id} (${theme.appearance}): End/Starting label clears 4.5 on the hero face`, () => {
      const ink = heroGhostInk(tokens.button);
      const ratio = contrastRatio(ink, HERO_FILL);
      expect(ratio, `${id}: hero ghost ink ${ink} on ${HERO_FILL}`).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
    });
  }

  it('the hero face is the fixed §5.1 Focus bright, not a theme token', () => {
    expect(HERO_FILL).toBe(SECTION_HUES.focus.bright);
  });

  it('documents the shipped regression: background-derived ink on the hero face', () => {
    const light = THEME_REGISTRY.light.tokens;
    const dark = THEME_REGISTRY.dark.tokens;
    const lightRatio = contrastRatio(preFixGhostInk(light.button, light.background), HERO_FILL);
    const darkRatio = contrastRatio(preFixGhostInk(dark.button, dark.background), HERO_FILL);
    expect(lightRatio, `light pre-fix ${lightRatio.toFixed(2)}:1`).toBeLessThan(WCAG_AA_TEXT);
    expect(darkRatio, `dark pre-fix ${darkRatio.toFixed(2)}:1`).toBeLessThan(WCAG_AA_TEXT);
    // The two measured values from the finding, pinned so the floor is real.
    expect(lightRatio).toBeCloseTo(1.66, 2);
    expect(darkRatio).toBeCloseTo(1.42, 2);
  });

  it('every theme needed the fix (no theme passed before it)', () => {
    for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
      const { tokens } = theme;
      const ratio = contrastRatio(preFixGhostInk(tokens.button, tokens.background), HERO_FILL);
      expect(ratio, `${id}: pre-fix hero ghost ink — ${ratio.toFixed(2)}:1`).toBeLessThan(
        WCAG_AA_TEXT,
      );
    }
  });
});

describe('Button ink defaults are unchanged (no global behaviour change)', () => {
  const button = readFileSync(resolve(__dirname, '../core/ui/Button.tsx'), 'utf8');

  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;

    it(`${id} (${theme.appearance}): a ghost Button without onColor still derives from the canvas`, () => {
      // The exported derivation for the no-`onColor` path is literally the
      // pre-fix expression, so existing surfaces keep their exact ink.
      expect(readableAccent(tokens.button, tokens.background)).toBe(
        preFixGhostInk(tokens.button, tokens.background),
      );
    });
  }

  it('the no-onColor branch is still the original background/surface derivation', () => {
    // The opt-in branch is guarded by `onColor ?`, so the fallthrough expression
    // is byte-identical to the pre-fix one: no other Button can change ink.
    const fallthrough = [
      '          : readableAccent(',
      '              color ?? tokens.button,',
      "              variant === 'ghost' ? tokens.background : tokens.surface,",
      '            );',
    ].join('\n');
    expect(button).toContain(fallthrough);
    expect(button).toContain('  onColor?: string;');
    // Exactly one optional prop + one destructure + one guard + three uses.
    expect([...button.matchAll(/onColor/g)]).toHaveLength(6);
  });

  it('onColor is optional and defaults to the previous behaviour', () => {
    // `inkOnFill(fill, preferred)` with a real preferred ink keeps it when the
    // floor already passes, so opting in cannot silently re-ink a caller whose
    // pair was already legible.
    const light = THEME_REGISTRY.light.tokens;
    const preferred = readableAccent(light.button, light.surface);
    expect(inkOnFill(light.surface, preferred, SECTION_ON_BRIGHT_INK)).toBe(preferred);
  });
});

/**
 * Wiring pins: the contrast math only protects the UI if the hero controls
 * keep passing the real surface. Source-level because the repository has no
 * React renderer for component tests (same pattern as
 * `habitsScreenDayRollover.test.ts` on main).
 */
describe('Pomodoro hero ghost-action wiring', () => {
  const screen = readFileSync(
    resolve(__dirname, '../features/pomodoro/PomodoroScreen.tsx'),
    'utf8',
  );

  it('the running and paused End buttons paint on the hero face', () => {
    expect(screen).toMatch(/label="End"\s+variant="ghost"\s+onColor=\{COLOR\}/g);
    expect([...screen.matchAll(/onColor=\{COLOR\}/g)]).toHaveLength(3);
  });

  it('the hero Card still owns the face colour the fix derives from', () => {
    expect(screen).toMatch(/<Card variant="hero" accentColor=\{COLOR\}/);
    expect(screen).toMatch(/const COLOR = SECTION_COLORS\[POMODORO_SECTION_KEY\]/);
  });

  it('the idle Start path is untouched (it is not a ghost control)', () => {
    // The idle gate stays a solid primary, so its label never needed the fill.
    const idleBlock = screen.slice(screen.indexOf('{idleUntouched ? ('));
    const idleButton = idleBlock.slice(0, idleBlock.indexOf('/>'));
    expect(idleButton).toContain('color={SOLID}');
    expect(idleButton).not.toContain('onColor=');
  });
});
