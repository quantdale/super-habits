/**
 * Non-color design tokens for the "Calm Momentum" design language (V3).
 *
 * Theme-independent by definition: geometry, rhythm, type scale, and motion
 * envelopes. Color semantics live in `ThemeTokens`; features ask for
 * `spacing.lg` or `typography.titleLg`, never for raw numbers.
 *
 * V3's rules of thumb (docs/ui-ux/13-calm-momentum-design-system.md):
 * - modest radii: controls 8–12, cards 16, sheets/hero 24; pills only for chips;
 * - one type family (Nunito) mapped per role, with weight carried by the
 *   family itself rather than `fontWeight` (RN does not reliably synthesise
 *   weight for a custom family). Heavy weights (800/900) are rare enough to
 *   create hierarchy — titles are 700, body 600, 900 only for celebration;
 * - honest touch targets (44–52pt) and a 16pt phone page gutter, because the
 *   layout must put content first and keep dense screens dense.
 */

/** 4-point base grid spacing scale. */
export const spacing = {
  /** Reset. */
  none: 0,
  /** Icon/text micro-gap. */
  xs: 4,
  /** Tightly related controls. */
  sm: 8,
  /** Row internal spacing. */
  md: 12,
  /** Card padding / standard page rhythm. */
  lg: 16,
  /** Section separation. */
  xl: 24,
  /** Major content groups. */
  xxl: 32,
  /** Hero separation / large empty-state rhythm. */
  xxxl: 48,
} as const;

/** Corner-radius roles. V3 keeps geometry calm: nothing above 24 except pills. */
export const radius = {
  /** Chips, small tags, inline pills, compact buttons. */
  xs: 8,
  /** Inputs and compact controls. */
  sm: 10,
  /** Buttons, list rows, standard controls. */
  md: 12,
  /** Default cards. */
  lg: 16,
  /** Hero panels, sheets, celebration surfaces. */
  xl: 24,
  /** Pills, avatars, circular status. */
  full: 9999,
} as const;

/** Weight-specific families: RN needs the weight baked into the family name. */
export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  semibold: 'Nunito_700Bold',
  bold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export type FontFamilyRole = keyof typeof fonts;

/**
 * Semantic typography roles. `fontWeight` is retained for call sites that read
 * it directly, but rendering is driven by `fontFamily`.
 *
 * V3 weight ladder (docs/ui-ux/13 §5): 800/900 are celebration-scale only;
 * titles are 700; body/labels 600. Heavy weights must stay rare enough to
 * create hierarchy.
 */
export const typography = {
  /** Celebratory values and hero numbers (level up, streak record). */
  display: { fontSize: 34, fontFamily: fonts.bold, fontWeight: '800', letterSpacing: -0.6 },
  /** Rare emphasis title (empty-state art headers). */
  titleXl: { fontSize: 26, fontFamily: fonts.bold, fontWeight: '800', letterSpacing: -0.3 },
  /** Screen title. */
  titleLg: { fontSize: 22, fontFamily: fonts.semibold, fontWeight: '700', letterSpacing: -0.3 },
  /** Card / sheet title. */
  titleMd: { fontSize: 17, fontFamily: fonts.semibold, fontWeight: '700', letterSpacing: -0.2 },
  /** Primary reading text. */
  bodyLg: { fontSize: 16, fontFamily: fonts.medium, fontWeight: '600' },
  /** Standard rows and descriptions. */
  bodyMd: { fontSize: 15, fontFamily: fonts.medium, fontWeight: '600' },
  /** Controls, chips, metadata labels. */
  label: { fontSize: 13, fontFamily: fonts.medium, fontWeight: '600', letterSpacing: 0.1 },
  /** Secondary metadata. */
  caption: { fontSize: 12, fontFamily: fonts.medium, fontWeight: '600' },
  /** Key number/value (timer, totals, kcal). Tabular to avoid jitter. */
  metric: {
    fontSize: 30,
    fontFamily: fonts.bold,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
} as const;

export type TypographyRole = keyof typeof typography;

/**
 * Elevation levels. Calm Momentum keeps elevation neutral and sparing:
 * hierarchy comes from tone and spacing first, borders where necessary — not
 * from shadows on ordinary cards. Shadow tokens exist for genuinely floating
 * surfaces only (capture affordance, active overlays, modals).
 */
export const elevation = {
  /** Page background. */
  level0: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  /** Ordinary card/row surface. */
  level1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  /** Floating action, sticky control, popover, active timer. */
  level2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 5,
  },
  /** Modal/sheet/dialog. */
  level3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 36,
    elevation: 9,
  },
} as const;

/**
 * Press/transition springs in the `Animated.spring` shape (speed/bounciness),
 * so screens can share the same physical feel without re-deriving constants.
 */
export const springs = {
  /** Button and card press-in. */
  press: { speed: 40, bounciness: 6 },
  /** Check-off pop / value change. */
  pop: { speed: 26, bounciness: 12 },
  /** Sheet and card entrance. */
  enter: { speed: 18, bounciness: 8 },
} as const;

/** Component sizing roles. Frequent mobile targets stay ≥ 44–48 logical points. */
export const size = {
  /** Inline metadata icons. */
  iconXs: 16,
  /** Small control icons. */
  iconSm: 20,
  /** Standard control/navigation icons. */
  iconMd: 24,
  /** Feature/empty-state emphasis icons. */
  iconLg: 28,
  iconXl: 32,
  /** Minimum frequent touch target (WCAG/HIG guidance). */
  touchTargetMin: 48,
  /** Standard button height (compact md size). */
  buttonHeight: 44,
  /** Large button height (primary screen-level actions). */
  buttonHeightLg: 52,
  /** Bottom tab bar content height (excluding safe area). */
  tabBarHeight: 64,
  /** Capture affordance diameter (phone center slot / rail header action). */
  fab: 56,
} as const;

/** Layout/content-width roles. */
export const layout = {
  /** Phone horizontal page padding. */
  pagePadding: 16,
  /** Tablet horizontal page padding (768–1279). */
  pagePaddingTablet: 24,
  /** Desktop horizontal page padding (>=1280, alongside the rail). */
  pagePaddingDesktop: 32,
  /** Width at which the gutter steps up from phone to tablet. */
  gutterTabletBreakpoint: 768,
  /** Width at which the gutter steps up from tablet to desktop. */
  gutterDesktopBreakpoint: 1280,
  /** Max reading/content width on tablet/desktop before centering. */
  contentMaxWidth: 760,
  /** Max width for centered modal-style content. */
  modalMaxWidth: 460,
  /** Width at which the shell switches from bottom tabs to a side rail. */
  railBreakpoint: 900,
} as const;

/**
 * Resolves the V3 responsive page gutter (docs/ui-ux/13 §6): 16 on phones,
 * 24 on tablets, 32 on desktop. Screen applies it to scroll content, padded
 * fills, and pinned heroes so all three stay aligned. Centralized here — call
 * sites must not re-derive breakpoints from raw numbers.
 */
export function pageGutterForWidth(width: number): number {
  if (width >= layout.gutterDesktopBreakpoint) return layout.pagePaddingDesktop;
  if (width >= layout.gutterTabletBreakpoint) return layout.pagePaddingTablet;
  return layout.pagePadding;
}

/** Shared opacity states. */
export const opacity = {
  /** Disabled controls. */
  disabled: 0.4,
  /** Pressed feedback on filled surfaces. */
  pressed: 0.7,
  /** Decorative-muted content (never body text). */
  muted: 0.55,
} as const;

/** Z-index layering roles. Keep stacking explicit across overlays. */
export const layers = {
  base: 0,
  content: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
} as const;
