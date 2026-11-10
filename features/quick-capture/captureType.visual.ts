import {
  contrastRatio,
  inkOnFill,
  readableAccent,
  tintOver,
  WCAG_AA_NON_TEXT,
  WCAG_AA_TEXT,
} from '@/core/theme/contrast';
import { SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';
import type { HeroIconName } from '@/core/ui/illustrations/icons';

/**
 * Pure visual model for the Quick capture destination picker (P19,
 * docs/ui-ux/16-playful-momentum.md §7 "Command Center + Quick capture",
 * §6 OptionRow).
 *
 * WHY A MODULE: the selected tile paints a FIXED section hue in its icon chip,
 * so every ink on that chip must be chosen against the ACTUAL fill — the
 * theme's `text` lands at ~2:1 on Sprout bright in the light default, and no
 * theme's `textMuted` clears 3:1 on a mid-tone bright hue. The repo has no
 * component renderer, so the derivation lives here as values and is asserted in
 * `tests/captureAndCommandContrast.test.ts` across all 14 themes.
 *
 * Selection follows §6 exactly as `OptionRow` does: selected = section tint
 * face (hue mixed 14% into white / 18% into the dark face), 2px section-solid
 * border, solid-color lip, plus a trailing check badge. Section
 * `sectionOverrides` (e.g. Cyberpunk Neon's translucent tints) are expressed
 * through the resolved accent's `fill`/`text`, never by compositing an
 * 8-digit alpha hex by hand — `tintOver` is 6-digit only.
 */

/** The six capture destinations. Labels are product strings (pinned by E2E). */
export type CaptureTypeKey = 'todo' | 'habit' | 'calorie' | 'project' | 'goal' | 'focus';

export type CaptureTypeOption = {
  key: CaptureTypeKey;
  label: string;
  /** Duotone hero icon from the P9 set — no new icon assets (§5.9). */
  icon: HeroIconName;
};

export const CAPTURE_TYPE_OPTIONS: readonly CaptureTypeOption[] = [
  { key: 'todo', label: 'Task', icon: 'TodosIcon' },
  { key: 'habit', label: 'Habit', icon: 'HabitsIcon' },
  { key: 'calorie', label: 'Calorie', icon: 'CaloriesIcon' },
  { key: 'project', label: 'Project', icon: 'GardenIcon' },
  { key: 'goal', label: 'Goal', icon: 'TrophyIcon' },
  { key: 'focus', label: 'Focus', icon: 'FocusIcon' },
];

/** Resolved destination hue: section accent, or the theme accent for planning. */
export type CaptureTypeAccent = {
  /** `bright` tier — the icon chip face while the tile is selected. */
  fill: string;
  /** `solid`/lifted tier — colored text, selected border and selected lip. */
  text: string;
  /** `lip` tier — the detail pass of the duotone icon. */
  lip: string;
};

export type CaptureTypeTileVisual = {
  selected: boolean;
  /** Tile face: theme surface when idle, section tint when selected (§6). */
  face: string;
  borderColor: string;
  borderWidth: number;
  /** Lip slab under the tile (§5.7 md = 3). */
  lipColor: string;
  /** Label ink resolved against `face` (text floor 4.5). */
  labelInk: string;
  /** Icon chip face: sunken when idle, the destination hue when selected. */
  iconChipFace: string;
  /** Duotone passes on the chip (both floored at the 3:1 non-text minimum). */
  iconBright: string;
  iconLip: string;
  /**
   * Non-text contrast of the trailing check badge ring against the face:
   * returned so the contract test can assert the badge stays visible on a
   * tinted face in every theme.
   */
  badgeInk: string;
};

/** Lip depth of the tile (§5.7 `depth.lip.md` = 3, same as OptionRow). */
export const TILE_LIP = 3;
/** 2px outline (§6 option/tile grammar). */
export const TILE_BORDER = 2;
/** Tile minimum height: two 72px rows keep every target >= 44 on a 360 phone. */
export const TILE_MIN_HEIGHT = 72;

/**
 * Duotone passes for an icon painted on `fill`.
 *
 * The §5.1 rule "bright is never under white text" generalises to glyphs: ink
 * on a bright fill is 6.05–9.20:1 while white is 2.02–3.07:1. So the shape
 * pass is the bright-fill ink, and the detail pass keeps the hue's `lip` nudged
 * until it clears 3:1 — falling back to the ink when a hue cannot get there.
 * When the two collapse (a hue whose `lip` is already dark against its own
 * bright fill cannot be lightened past the ink), the detail pass is a
 * luminance-shifted ink so the icon never flattens into a silhouette (the P10
 * r2 defect).
 */
export function duotoneOnFill(input: { fill: string; lip: string; ink?: string }): {
  bright: string;
  lip: string;
} {
  const ink = input.ink ?? SECTION_ON_BRIGHT_INK;
  const shape = inkOnFill(input.fill, ink, ink, WCAG_AA_NON_TEXT);
  const detail = inkOnFill(
    input.fill,
    readableAccent(input.lip, input.fill, WCAG_AA_NON_TEXT),
    ink,
    WCAG_AA_NON_TEXT,
  );
  if (detail !== shape) return { bright: shape, lip: detail };
  // Same-tone collision: move the detail pass away from the shape pass by
  // luminance, keeping it over the 3:1 floor on the fill.
  const candidates = ['#FFFFFF', ink, '#000000'];
  const distinct = candidates.find(
    (candidate) =>
      candidate !== shape &&
      contrastRatio(candidate, input.fill) >= WCAG_AA_NON_TEXT &&
      contrastRatio(candidate, shape) >= 1.4,
  );
  return { bright: shape, lip: distinct ?? shape };
}

/** Derive the six tile states for the active appearance and theme. */
export function captureTypeTileVisual(input: {
  selected: boolean;
  accent: CaptureTypeAccent;
  appearance: 'light' | 'dark';
  surface: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  iconMuted: string;
}): CaptureTypeTileVisual {
  const { selected, accent, appearance, surface, surfaceSunken, border, borderStrong, text } =
    input;
  // §5.1 tint: 14% of the hue into white (light) / 18% into the dark face.
  const tintBase = appearance === 'dark' ? '#1A1F2B' : '#FFFFFF';
  const selectedFace = tintOver(tintBase, accent.fill, appearance === 'dark' ? 0.18 : 0.14);

  if (selected) {
    const icon = duotoneOnFill({ fill: accent.fill, lip: accent.lip });
    return {
      selected,
      face: selectedFace,
      borderColor: accent.text,
      borderWidth: TILE_BORDER,
      lipColor: accent.text,
      labelInk: readableAccent(accent.text, selectedFace, WCAG_AA_TEXT),
      iconChipFace: accent.fill,
      iconBright: icon.bright,
      iconLip: icon.lip,
      badgeInk: accent.text,
    };
  }

  // Idle: a neutral chip. Both duotone passes clear 3:1 on the sunken chip,
  // and stay distinct so the icon keeps its detail.
  const monoShape = readableAccent(input.textMuted, surfaceSunken, WCAG_AA_NON_TEXT);
  const monoDetail = readableAccent(input.iconMuted, surfaceSunken, WCAG_AA_NON_TEXT);
  return {
    selected,
    face: surface,
    borderColor: border,
    borderWidth: TILE_BORDER,
    lipColor: borderStrong,
    labelInk: readableAccent(text, surface, WCAG_AA_TEXT),
    iconChipFace: surfaceSunken,
    iconBright: monoShape,
    iconLip: monoDetail === monoShape ? autoDetail(monoShape, surfaceSunken) : monoDetail,
    badgeInk: accent.text,
  };
}

/** A distinct detail tone for the idle chip when the two muted tokens collapse. */
function autoDetail(tone: string, fill: string): string {
  const candidates = ['#FFFFFF', '#10131A'];
  return (
    candidates.find(
      (candidate) => candidate !== tone && contrastRatio(candidate, fill) >= WCAG_AA_NON_TEXT,
    ) ?? tone
  );
}
