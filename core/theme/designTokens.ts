/**
 * Non-color design tokens ("Warm Momentum" design DNA — docs/ui-ux/02-design-dna.md).
 *
 * These values are theme-independent: they describe geometry, rhythm, and
 * hierarchy, not appearance. Color semantics stay in `ThemeTokens`; features
 * should ask for `spacing.lg`, not `16`, and `radius.lg`, not `16`.
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

/** Corner-radius roles. Equivalent components always share radius. */
export const radius = {
  /** Compact inputs / small tags. */
  sm: 8,
  /** List rows / controls. */
  md: 12,
  /** Default cards / buttons. */
  lg: 16,
  /** Hero panels / sheets. */
  xl: 24,
  /** Pills, avatars, circular status. */
  full: 9999,
} as const;

/**
 * Semantic typography roles. Sizes/weights are nominal baselines; RN font
 * scaling still applies. Use weight and size before color for hierarchy.
 */
export const typography = {
  /** Rare hero values / celebratory moments. */
  display: { fontSize: 32, fontWeight: '700' as const },
  /** Primary screen title. */
  titleLg: { fontSize: 24, fontWeight: '700' as const },
  /** Card/section title. */
  titleMd: { fontSize: 20, fontWeight: '700' as const },
  /** Primary reading/body. */
  bodyLg: { fontSize: 16, fontWeight: '400' as const },
  /** Normal rows and descriptions. */
  bodyMd: { fontSize: 14, fontWeight: '400' as const },
  /** Controls, chips, metadata labels. */
  label: { fontSize: 13, fontWeight: '600' as const },
  /** Secondary metadata. */
  caption: { fontSize: 12, fontWeight: '500' as const },
  /** Key number/value. */
  metric: { fontSize: 28, fontWeight: '700' as const },
} as const;

/**
 * Elevation levels. Prefer borders for level-1 surfaces; reserve stronger
 * shadow for floating elements. Dark mode relies more on tonal separation.
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  /** Floating action, sticky control, popover, active timer. */
  level2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  /** Modal/sheet/dialog. */
  level3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

/** Component sizing roles. Frequent mobile targets stay ≥ 44 logical points. */
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
  touchTargetMin: 44,
  /** Standard button height. */
  buttonHeight: 48,
} as const;

/** Layout/content-width roles. */
export const layout = {
  /** Phone horizontal page padding. */
  pagePadding: 16,
  /** Max reading/content width on tablet/desktop before centering. */
  contentMaxWidth: 720,
  /** Max width for centered modal-style content. */
  modalMaxWidth: 448,
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
