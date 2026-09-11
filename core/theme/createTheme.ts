import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import type {
  ThemeAppearance,
  ThemeDefinition,
  ThemeInput,
  ThemeTokens,
} from '@/core/theme/tokens';

/**
 * Default semantic-status sets per appearance. Themes override these only when
 * their own primary hue would collide with a status meaning (e.g. a red-primary
 * theme overriding `danger*` — see Crimson Red).
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
    | 'warningSolid'
    | 'successBackground'
    | 'successBorder'
    | 'successText'
    | 'successSolid'
  >
> = {
  light: {
    dangerBackground: '#FFF1F0',
    dangerBorder: '#FFC9C4',
    dangerText: '#B42318',
    dangerSolid: '#E5484D',
    warningBackground: '#FFF7E6',
    warningBorder: '#FFD699',
    warningText: '#8A4B00',
    warningSolid: '#F5A524',
    successBackground: '#E9FBF1',
    successBorder: '#A7EFC8',
    successText: '#0B6B44',
    successSolid: '#12B76A',
  },
  dark: {
    dangerBackground: '#3A1620',
    dangerBorder: '#7A2230',
    dangerText: '#FFC9C9',
    dangerSolid: '#E5484D',
    warningBackground: '#3A2A10',
    warningBorder: '#8A5A13',
    warningText: '#FFE0A3',
    warningSolid: '#F5A524',
    successBackground: '#122E22',
    successBorder: '#1B5C40',
    successText: '#BBF7D0',
    successSolid: '#12B76A',
  },
};

/** Blends `hex` toward `towardHex` by `amount` (0-1). Used for derived surfaces. */
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

function assertContrast(id: string, input: ThemeTokens): void {
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
 *
 * The Pop layer (tinted canvas, brand gradient, colored glow, chip tints) is
 * derived here on purpose: adding it must never require touching 14 theme
 * files, and every theme — old or new — gets the same expressive surface
 * language from its own primary hue.
 */
export function createTheme(input: ThemeInput): ThemeDefinition {
  const { id, name, appearance, description, sectionOverrides, ...rest } = input;
  const dark = appearance === 'dark';

  const tokens: ThemeTokens = {
    ...DEFAULT_STATUS_TOKENS[appearance],
    ...rest,
    surfaceSunken: input.surfaceSunken ?? blend(input.surface, input.text, dark ? 0.06 : 0.045),
    surfaceHover: input.surfaceHover ?? blend(input.surface, input.text, 0.06),
    surfaceActive: input.surfaceActive ?? blend(input.surface, input.text, 0.1),
    borderStrong: input.borderStrong ?? blend(input.border, input.text, 0.18),
    overlayScrim: input.overlayScrim ?? (dark ? 'rgba(6, 4, 20, 0.72)' : 'rgba(20, 14, 60, 0.45)'),
    shadowColor: input.shadowColor ?? (dark ? '#04021A' : '#2A1E6B'),
    iconMuted: input.iconMuted ?? input.textMuted,
    textOnAccent: input.textOnAccent ?? input.buttonText,
    onSolid: input.onSolid ?? '#FFFFFF',
    brandGradient: input.brandGradient ?? [
      blend(input.primary, '#ffffff', dark ? 0.06 : 0.16),
      input.primary,
    ],
    canvasTint: input.canvasTint ?? blend(input.background, input.primary, dark ? 0.24 : 0.1),
    glow: input.glow ?? input.primary,
    chipBackground: input.chipBackground ?? blend(input.surface, input.primary, dark ? 0.2 : 0.1),
    chipBorder: input.chipBorder ?? blend(input.border, input.primary, dark ? 0.4 : 0.3),
    statusBarStyle: input.statusBarStyle ?? (dark ? 'light' : 'dark'),
    webThemeColor: input.webThemeColor ?? (dark ? input.background : input.primary),
  };

  if (__DEV__) assertContrast(id, tokens);

  return { id, name, appearance, description, sectionOverrides, tokens };
}
