import type { SectionKey } from '@/constants/sectionColors';

export type ThemeAppearance = 'light' | 'dark';

/**
 * All theme-dependent color decisions live here. Components never branch on
 * theme identity or appearance — they read `useAppTheme().tokens` only.
 *
 * The "Pop" roles (`brandGradient`, `canvasTint`, `glow`, `chipBackground`,
 * `surfaceSunken`, `borderStrong`) are the expressive half of the language:
 * tinted surfaces, colored shadows, and chunky outlines. Every one of them is
 * derived in `createTheme`, so a theme author only states the twelve base
 * colors and still gets the full system.
 */
export type ThemeTokens = {
  // ── Brand & interaction ─────────────────────────────────────────────
  primary: string;
  secondary: string;
  accent: string;
  button: string;
  buttonText: string;
  buttonHover: string;
  buttonActive: string;

  // ── Surfaces ────────────────────────────────────────────────────────
  background: string;
  surface: string;
  surfaceElevated: string;
  /** Recessed tray: input wells, progress tracks, inactive segments. */
  surfaceSunken: string;
  surfaceHover: string;
  surfaceActive: string;
  overlayScrim: string;

  // ── Structure ───────────────────────────────────────────────────────
  border: string;
  /** Chunky 2px outline for tactile surfaces. */
  borderStrong: string;
  tabRail: string;
  tabRailBorder: string;
  shadowColor: string;

  // ── Content ─────────────────────────────────────────────────────────
  text: string;
  textMuted: string;
  iconMuted: string;
  textOnAccent: string;
  /** Text/glyph color that must sit on a saturated solid fill. */
  onSolid: string;

  // ── Pop accents (derived) ───────────────────────────────────────────
  /** Two-stop brand gradient for hero surfaces and primary actions. */
  brandGradient: readonly [string, string];
  /** Ambient wash behind the top of a screen, faded into `background`. */
  canvasTint: string;
  /** Colored shadow for brand/primary surfaces. */
  glow: string;
  /** Tinted chip/segment fill derived from the brand hue. */
  chipBackground: string;
  /** Tinted chip/segment outline derived from the brand hue. */
  chipBorder: string;

  // ── Semantic status ─────────────────────────────────────────────────
  dangerBackground: string;
  dangerBorder: string;
  dangerText: string;
  dangerSolid: string;
  warningBackground: string;
  warningBorder: string;
  warningText: string;
  warningSolid: string;
  successBackground: string;
  successBorder: string;
  successText: string;
  successSolid: string;

  // ── Platform ────────────────────────────────────────────────────────
  statusBarStyle: 'light' | 'dark';
  webThemeColor: string;
};

/** Fields a theme author must supply; everything else is derived by createTheme(). */
export type ThemeInput = Pick<
  ThemeTokens,
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'button'
  | 'buttonText'
  | 'buttonHover'
  | 'buttonActive'
  | 'background'
  | 'surface'
  | 'surfaceElevated'
  | 'border'
  | 'tabRail'
  | 'tabRailBorder'
  | 'text'
  | 'textMuted'
> &
  Partial<
    Pick<
      ThemeTokens,
      | 'surfaceSunken'
      | 'surfaceHover'
      | 'surfaceActive'
      | 'overlayScrim'
      | 'borderStrong'
      | 'shadowColor'
      | 'iconMuted'
      | 'textOnAccent'
      | 'onSolid'
      | 'brandGradient'
      | 'canvasTint'
      | 'glow'
      | 'chipBackground'
      | 'chipBorder'
      | 'statusBarStyle'
      | 'webThemeColor'
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
  > & {
    id: string;
    name: string;
    appearance: ThemeAppearance;
    description: string;
    sectionOverrides?: ThemeDefinition['sectionOverrides'];
  };

export type ThemeDefinition = {
  id: string;
  name: string;
  appearance: ThemeAppearance;
  description: string;
  sectionOverrides?: Partial<Record<SectionKey, { fill: string; text: string; tint: string }>>;
  tokens: ThemeTokens;
};
