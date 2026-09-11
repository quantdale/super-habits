/**
 * Non-color design tokens for the "Pop" design language.
 *
 * Theme-independent by definition: geometry, rhythm, type scale, and motion
 * envelopes. Color semantics live in `ThemeTokens`; features ask for
 * `spacing.lg` or `typography.titleLg`, never for raw numbers.
 *
 * Pop's rules of thumb:
 * - big radii (nothing below 10, cards at 24–32) so every surface reads soft;
 * - one type family (Nunito) mapped per role, with weight carried by the
 *   family itself rather than `fontWeight` (RN does not reliably synthesise
 *   weight for a custom family);
 * - chunky touch targets (56pt buttons) and generous page gutters, because the
 *   layout should feel like a native app, not a dense dashboard.
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

/** Corner-radius roles. Pop keeps every surface generously rounded. */
export const radius = {
  /** Chips, small tags, inline pills. */
  xs: 10,
  /** Inputs and compact controls. */
  sm: 14,
  /** List rows and standard controls. */
  md: 20,
  /** Default cards and buttons. */
  lg: 26,
  /** Hero panels, sheets, celebration surfaces. */
  xl: 34,
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
 */
export const typography = {
  /** Screen hero values and celebratory numbers. */
  display: { fontSize: 38, fontFamily: fonts.black, fontWeight: '900', letterSpacing: -0.8 },
  /** Section hero title. */
  titleXl: { fontSize: 30, fontFamily: fonts.black, fontWeight: '900', letterSpacing: -0.5 },
  /** Screen title. */
  titleLg: { fontSize: 25, fontFamily: fonts.bold, fontWeight: '800', letterSpacing: -0.3 },
  /** Card / sheet title. */
  titleMd: { fontSize: 20, fontFamily: fonts.bold, fontWeight: '800', letterSpacing: -0.2 },
  /** Primary reading text. */
  bodyLg: { fontSize: 16, fontFamily: fonts.medium, fontWeight: '600' },
  /** Standard rows and descriptions. */
  bodyMd: { fontSize: 15, fontFamily: fonts.medium, fontWeight: '600' },
  /** Controls, chips, metadata labels. */
  label: { fontSize: 13, fontFamily: fonts.bold, fontWeight: '700', letterSpacing: 0.2 },
  /** Secondary metadata. */
  caption: { fontSize: 12, fontFamily: fonts.semibold, fontWeight: '700' },
  /** Key number/value. */
  metric: { fontSize: 34, fontFamily: fonts.black, fontWeight: '900', letterSpacing: -0.5 },
} as const;

export type TypographyRole = keyof typeof typography;

/**
 * Elevation levels. Pop uses *colored* shadows: components pass the surface's
 * own accent as `shadowColor`, so a card floats in its own hue instead of grey.
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

/** Component sizing roles. Frequent mobile targets stay ≥ 48 logical points. */
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
  /** Standard button height. */
  buttonHeight: 56,
  /** Bottom tab bar content height (excluding safe area). */
  tabBarHeight: 66,
  /** Floating action button diameter. */
  fab: 60,
} as const;

/** Layout/content-width roles. */
export const layout = {
  /** Phone horizontal page padding. */
  pagePadding: 20,
  /** Max reading/content width on tablet/desktop before centering. */
  contentMaxWidth: 760,
  /** Max width for centered modal-style content. */
  modalMaxWidth: 460,
  /** Width at which the shell switches from bottom tabs to a side rail. */
  railBreakpoint: 900,
} as const;

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
