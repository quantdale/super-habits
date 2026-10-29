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
  // Playful Momentum §5.1/§5.2: success = Sprout, warning = Gold,
  // danger = Cherry. Light uses the tintLight wash + solid text; dark uses
  // the tintDark wash + bright text/solid (dark buttons are bright fill with
  // an ink label).
  light: {
    dangerBackground: '#FFE8E9',
    dangerBorder: '#FFC9C4',
    dangerText: '#C9283A',
    dangerSolid: '#C9283A',
    warningBackground: '#FFF7E0',
    warningBorder: '#FFD699',
    warningText: '#9A5B00',
    warningSolid: '#FFC81F',
    successBackground: '#E6F7E3',
    successBorder: '#A7EFC8',
    successText: '#1A7F2B',
    successSolid: '#1A7F2B',
  },
  dark: {
    dangerBackground: '#432A34',
    dangerBorder: '#911D2A',
    // Text on the tintDark wash needs a lifted Cherry: the §5.1 bright
    // `#FF5A5F` lands at 4.25:1 there (needs 4.5); `#FF8A8F` keeps the hue at
    // 5.73:1. `dangerSolid` keeps the exact §5.1 bright for fills/marks.
    dangerText: '#FF8A8F',
    dangerSolid: '#FF5A5F',
    warningBackground: '#433D29',
    warningBorder: '#E0A800',
    warningText: '#FFC81F',
    warningSolid: '#FFC81F',
    successBackground: '#233E2E',
    successBorder: '#1A7F2B',
    successText: '#4DC93A',
    successSolid: '#4DC93A',
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
    ['textSubtle on surface', input.textSubtle, input.surface, WCAG_AA_TEXT],
    // The lip shows as the press depth *under* the face (adjacent color, not
    // the label resting place) — WCAG 1.4.11 non-text minimum.
    ['buttonText on buttonLip (press depth)', input.buttonText, input.buttonLip, WCAG_AA_NON_TEXT],
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
 * The V3 layer (brand gradient, glow, chip tints) is derived here on purpose:
 * adding it must never require touching 14 theme files, and every theme — old
 * or new — gets the same interaction language from its own primary hue.
 * Pop's tinted-canvas wash (`canvasTint`) was removed in V3: a neutral canvas
 * plus spacing does the separating (see docs/ui-ux/13 §3).
 */
export function createTheme(input: ThemeInput): ThemeDefinition {
  const { id, name, appearance, description, sectionOverrides, ...rest } = input;
  const dark = appearance === 'dark';

  const tokens: ThemeTokens = {
    ...DEFAULT_STATUS_TOKENS[appearance],
    ...rest,
    primaryBright: input.primaryBright ?? input.primary,
    buttonLip: input.buttonLip ?? input.buttonActive,
    textSubtle: input.textSubtle ?? input.textMuted,
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
    glow: input.glow ?? input.primary,
    chipBackground: input.chipBackground ?? blend(input.surface, input.primary, dark ? 0.2 : 0.1),
    chipBorder: input.chipBorder ?? blend(input.border, input.primary, dark ? 0.4 : 0.3),
    statusBarStyle: input.statusBarStyle ?? (dark ? 'light' : 'dark'),
    webThemeColor: input.webThemeColor ?? (dark ? input.background : input.primary),
  };

  if (__DEV__) assertContrast(id, tokens);

  return { id, name, appearance, description, sectionOverrides, tokens };
}
