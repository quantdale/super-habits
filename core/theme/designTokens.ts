/**
 * Non-color design tokens for the v2 "Playful Momentum" design language.
 *
 * Theme-independent by definition: geometry, depth, rhythm, type scale, and
 * motion envelopes. Color semantics live in `ThemeTokens`; features ask for
 * `spacing.lg` or `typography.titleLg`, never for raw numbers.
 *
 * v2's rules of thumb (docs/ui-ux/16-playful-momentum.md):
 * - playful but systematic radii: 8/12/16/20/28, nothing above 28 except
 *   pills and circles (§5.6);
 * - depth comes from a solid lip or a 2px border, **never** from a blur
 *   shadow on a card (§5.7); `elevation` exists only for genuinely floating
 *   surfaces (sheets, dialogs, the capture affordance);
 * - one type family (Nunito) mapped per role, with weight carried by the
 *   family itself rather than `fontWeight` (RN does not reliably synthesise
 *   weight for a custom family). Heavy weights (800/900) are rare enough to
 *   create hierarchy — titles are 800, body 600, 900 only for celebration;
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

/**
 * Corner-radius roles — v2 §5.6. Playful but systematic: every step is used by
 * exactly one weight class, and nothing above 28 except pills and circles
 * (the §9 C2 resolution caps the scale at 28; 26–34pt mid-radii were
 * rejected).
 */
export const radius = {
  /** Checkbox, tag, compact badge. */
  xs: 8,
  /** Inputs, rect chips, small buttons. */
  sm: 12,
  /** Buttons, option rows, list cards. */
  md: 16,
  /** Cards, hero surfaces. */
  lg: 20,
  /** Sheets top, dialogs, celebration card. */
  xl: 28,
  /** Nodes, avatars, pills, capture button. */
  full: 9999,
} as const;

/**
 * Solid-lip depth (v2 §5.7). A pressable reads as a physical slab: a colored
 * lip of `lip` px under the face at rest, collapsing to 0 while the face
 * translates by the same amount. Cards do it with a thicker bottom border
 * instead, and static surfaces get a flat 2px ring with no lip at all.
 *
 * These are *geometry*, not color: the actual lip color is a theme decision
 * (`tokens.buttonLip`, `tokens.borderStrong`). Compose the two through
 * `cardDepth()` / `pressDepth()` below so appearance handling stays in one
 * place.
 */
export const depth = {
  /**
   * Lip thickness per pressable weight: lg 4 (52px buttons, path nodes),
   * md 3 (44px buttons, option rows), sm 2 (compact buttons, toggle chips).
   */
  lip: {
    lg: 4,
    md: 3,
    sm: 2,
  },
  /** Pressable cards: 2px ring all round + a 4px bottom edge in `borderStrong`. */
  card: {
    ring: 2,
    bottom: 4,
  },
  /** Static info cards: 2px ring all round, no lip. */
  flat: 2,
} as const;

/**
 * The minimum theme surface `cardDepth` needs. Structural, not an import of
 * `ThemeTokens`, so the token module stays theme-agnostic and dependency-free.
 */
export type DepthPalette = {
  border: string;
  borderStrong: string;
  surfaceElevated: string;
};

/**
 * Pressable card geometry (`depth.card`): a 2px ring all round plus a 4px
 * bottom edge in `borderStrong`, so a card reads as a lifted slab without a
 * blur shadow. Half-pressed states are the pressable's job (P5 Pressable3D).
 */
export function cardDepth(palette: DepthPalette) {
  return {
    borderWidth: depth.card.ring,
    borderColor: palette.border,
    borderBottomWidth: depth.card.bottom,
    borderBottomColor: palette.borderStrong,
  } as const;
}

/**
 * Static info card geometry (`depth.flat`): the same 2px ring, no lip. This is
 * the *only* card depth a non-interactive surface may claim (§5.7: no blur
 * shadow on cards, ever).
 */
export function flatDepth(palette: DepthPalette) {
  return {
    borderWidth: depth.flat,
    borderColor: palette.border,
  } as const;
}

/**
 * Lip geometry for a pressable face: the visible lip height plus the face
 * travel that consumes it. P5's `Pressable3D` reads these numbers; P3 only
 * declares them so no call site re-derives `4`/`3`/`2` by hand.
 */
export function pressDepth(lip: number) {
  return { lip, travel: lip } as const;
}

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
 * Semantic typography roles — the v2 "Playful Momentum" type scale
 * (docs/ui-ux/16-playful-momentum.md §5.5). Nunito stays the only family
 * (§5.5 decision: no new dependency); fun comes from weight and size
 * discipline, not more faces.
 *
 * `fontWeight` is retained for call sites that read it directly, but rendering
 * is driven by `fontFamily` (RN does not synthesise weights for a custom
 * family). Weight ladder, per §5.5:
 *
 * - 900 (`display`) — celebration numbers only (streak 30, Level 4).
 * - 800 — headings, buttons, metric numbers.
 * - 700 — chips, tabs, badges, `label`.
 * - 600 — body copy.
 * - 400 — banned: it reads thin next to 800 and destroys the hierarchy.
 *
 * Every role carries its own `lineHeight` so vertical rhythm is a token, not a
 * per-call-site accident (`size / line` in the §5.5 table).
 */
export const typography = {
  /** Celebration number (streak 30, Level 4). 900, reserved for rewards. */
  display: {
    fontSize: 40,
    lineHeight: 48,
    fontFamily: fonts.black,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  /** Idle-timer scale hero number (56/68). Tabular so the digits do not jitter. */
  metricLg: {
    fontSize: 56,
    lineHeight: 68,
    fontFamily: fonts.bold,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  /** Key number/value (kcal left, timer, totals). Tabular to avoid jitter. */
  metric: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: fonts.bold,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  /** Hero titles, empty-state headline. */
  titleXl: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fonts.bold,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  /** Screen title. */
  titleLg: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fonts.bold,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  /** Card, sheet and group titles. */
  titleMd: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.bold,
    fontWeight: '800',
    letterSpacing: 0,
  },
  /** Inputs and primary reading text. */
  bodyLg: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: fonts.medium,
    fontWeight: '600',
    letterSpacing: 0,
  },
  /** Rows and descriptions (row titles may set 700 locally). */
  bodyMd: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.medium,
    fontWeight: '600',
    letterSpacing: 0,
  },
  /**
   * Button label. Sentence case — never a CSS `uppercase` transform, so
   * accessible names and asserted copy stay identical (§5.5). Large buttons
   * step to 17 (see `core/ui/Button.tsx`).
   */
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.bold,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'none',
  },
  /** Controls, chips, tabs (12/16), badges. */
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semibold,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  /** Secondary metadata. */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
    fontWeight: '600',
    letterSpacing: 0,
  },
} as const;

export type TypographyRole = keyof typeof typography;

/**
 * Elevation levels — v2 §5.7. There are **no blur shadows on cards**: cards
 * are defined by their 2px ring (or lip) and nothing else. `level3` is
 * reserved for genuinely floating surfaces (sheets, dialogs, the celebration
 * card); `level0` is the page. `level1`/`level2` stay declared for the few
 * floating controls that predate this phase (capture affordance, sticky
 * banners) and are not a licence to shadow a card.
 *
 * §5.7 gives the light-mode `level3` spec as `0 12 32 rgba(16,19,26,0.18)`;
 * the RN shadow fields below are that shadow in RN's vocabulary (offset 12,
 * radius 32, opacity 0.18). Dark mode may instead use `surfaceElevated` + a 2px
 * border — `deepSheet()` below composes that.
 */
export const elevation = {
  /** Page background. */
  level0: {
    shadowColor: '#10131A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  /** Floating control (capture affordance, sticky banner) — not for cards. */
  level1: {
    shadowColor: '#10131A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  /** Active overlay / popover above a surface. */
  level2: {
    shadowColor: '#10131A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 5,
  },
  /** Sheets, dialogs, celebration card **only** (§5.7). */
  level3: {
    shadowColor: '#10131A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
} as const;

/**
 * Floating-surface composition for sheets/dialogs/celebration cards (§5.7):
 * light mode lifts with `elevation.level3`; dark mode lifts with
 * `surfaceElevated` + a 2px border instead of a blur shadow, which reads as
 * depth on a blue-charcoal canvas without a muddy halo.
 *
 * Kept out of the `elevation` const because it depends on appearance, and this
 * module never reads the active theme.
 */
export function sheetDepth(palette: DepthPalette, appearance: 'light' | 'dark') {
  if (appearance === 'dark') {
    return {
      backgroundColor: palette.surfaceElevated,
      borderWidth: depth.card.ring,
      borderColor: palette.border,
    } as const;
  }
  return elevation.level3;
}

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
  /**
   * Max content width on tablet/desktop before centering — a phone-like 640
   * column (§5.6), so a desktop window keeps the same reading rhythm as a
   * phone instead of stretching rows to 760. */
  contentMaxWidth: 640,
  /**
   * Dashboard grid cap (≥1280 two-column, §5.6). Separate from
   * `contentMaxWidth` because the dashboard is a composed layout, not a
   * single reading column. */
  dashboardMaxWidth: 1040,
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
