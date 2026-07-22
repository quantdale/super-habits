import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import type {
  ThemeAppearance,
  ThemeDefinition,
  ThemeInput,
  ThemeTokens,
} from '@/core/theme/tokens';

/**
 * Default semantic-status sets per appearance, carried over verbatim from
 * the app's existing Light/Dark tokens. Themes only override these when the
 * theme's own primary hue would otherwise collide with a status meaning
 * (e.g. a red-primary theme overriding `danger*` — see Crimson Red).
 */
const DEFAULT_STATUS_TOKENS: Record<
  ThemeAppearance,
  Pick<
    ThemeTokens,
    | 'dangerBackground'
    | 'dangerBorder'
    | 'dangerText'
    | 'dangerSolid'
    | 'warningBackground'
    | 'warningBorder'
    | 'warningText'
    | 'successBackground'
    | 'successBorder'
    | 'successText'
  >
> = {
  light: {
    dangerBackground: '#fef2f2',
    dangerBorder: '#fecaca',
    dangerText: '#b91c1c',
    dangerSolid: '#dc2626',
    warningBackground: '#fffbeb',
    warningBorder: '#fcd34d',
    warningText: '#92400e',
    successBackground: '#ecfdf5',
    successBorder: '#bbf7d0',
    successText: '#166534',
  },
  dark: {
    dangerBackground: '#3f1d24',
    dangerBorder: '#7f1d1d',
    dangerText: '#fecaca',
    dangerSolid: '#b91c1c',
    warningBackground: '#3a2a10',
    warningBorder: '#8a5a13',
    warningText: '#fde68a',
    successBackground: '#163223',
    successBorder: '#166534',
    successText: '#bbf7d0',
  },
};

/** Blends `hex` toward `towardHex` by `amount` (0-1). Used for hover/active surface derivation. */
function blend(hex: string, towardHex: string, amount: number): string {
  const from = hex.replace('#', '');
  const to = towardHex.replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const a = parseInt(from.slice(i, i + 2), 16);
    const b = parseInt(to.slice(i, i + 2), 16);
    return Math.round(a + (b - a) * amount);
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function assertContrast(id: string, input: ThemeInput): void {
  const checks: [string, string, string, number][] = [
    ['text on background', input.text, input.background, WCAG_AA_TEXT],
    ['text on surface', input.text, input.surface, WCAG_AA_TEXT],
    ['text on surfaceElevated', input.text, input.surfaceElevated, WCAG_AA_TEXT],
    ['textMuted on surface', input.textMuted, input.surface, WCAG_AA_TEXT],
    ['textMuted on surfaceElevated', input.textMuted, input.surfaceElevated, WCAG_AA_TEXT],
    ['buttonText on button', input.buttonText, input.button, WCAG_AA_TEXT],
    ['buttonText on buttonHover', input.buttonText, input.buttonHover, WCAG_AA_TEXT],
    ['buttonText on buttonActive', input.buttonText, input.buttonActive, WCAG_AA_TEXT],
    ['accent on surface', input.accent, input.surface, WCAG_AA_TEXT],
    ['primary on surface (non-text)', input.primary, input.surface, WCAG_AA_NON_TEXT],
  ];

  for (const [label, fg, bg, min] of checks) {
    const ratio = contrastRatio(fg, bg);
    if (ratio < min) {
      // Non-fatal: a single mis-authored theme must not crash every screen
      // that reads the registry. Surfaced loudly so it's caught in review/QA.
      console.error(
        `[theme] ${id}: ${label} fails WCAG contrast — ${ratio.toFixed(2)}:1 (needs >= ${min}:1)`,
      );
    }
  }
}

/**
 * Fills derived tokens (§4 of docs/multi-theme-system-design.md) so theme
 * authors only specify the roles that meaningfully vary per theme.
 */
export function createTheme(input: ThemeInput): ThemeDefinition {
  const { id, name, appearance, description, sectionOverrides, ...rest } = input;

  const tokens = {
    ...DEFAULT_STATUS_TOKENS[appearance],
    ...rest,
    surfaceHover: input.surfaceHover ?? blend(input.surface, input.text, 0.06),
    surfaceActive: input.surfaceActive ?? blend(input.surface, input.text, 0.1),
    overlayScrim:
      input.overlayScrim ??
      (appearance === 'dark' ? 'rgba(2, 6, 23, 0.76)' : 'rgba(15, 23, 42, 0.5)'),
    shadowColor: input.shadowColor ?? (appearance === 'dark' ? '#020617' : '#0f172a'),
    iconMuted: input.iconMuted ?? input.textMuted,
    textOnAccent: input.textOnAccent ?? input.buttonText,
    statusBarStyle: input.statusBarStyle ?? (appearance === 'dark' ? 'light' : 'dark'),
    webThemeColor:
      input.webThemeColor ?? (appearance === 'dark' ? input.background : input.primary),
  };

  if (__DEV__) assertContrast(id, { ...input, ...tokens });

  return { id, name, appearance, description, sectionOverrides, tokens: tokens };
}
