import type { SectionKey } from '@/constants/sectionColors';

export type ThemeAppearance = 'light' | 'dark';

/**
 * All theme-dependent color decisions live here. Components never branch on
 * theme identity or appearance — they read `useAppTheme().tokens` only.
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
  surfaceHover: string;
  surfaceActive: string;
  overlayScrim: string;

  // ── Structure ───────────────────────────────────────────────────────
  border: string;
  tabRail: string;
  tabRailBorder: string;
  shadowColor: string;

  // ── Content ─────────────────────────────────────────────────────────
  text: string;
  textMuted: string;
  iconMuted: string;
  textOnAccent: string;

  // ── Semantic status ─────────────────────────────────────────────────
  dangerBackground: string;
  dangerBorder: string;
  dangerText: string;
  dangerSolid: string;
  warningBackground: string;
  warningBorder: string;
  warningText: string;
  successBackground: string;
  successBorder: string;
  successText: string;

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
      | 'surfaceHover'
      | 'surfaceActive'
      | 'overlayScrim'
      | 'shadowColor'
      | 'iconMuted'
      | 'textOnAccent'
      | 'statusBarStyle'
      | 'webThemeColor'
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
  tokens: ThemeTokens;
  /** Optional remap when the default section accents clash or fail contrast against this theme. */
  sectionOverrides?: Partial<Record<SectionKey, { fill: string; text: string; tint: string }>>;
};
