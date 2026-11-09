/**
 * Quick capture destination identity (P19) — the mapping between the overlay's
 * six capture modes and a section hue, plus the resolver that turns theme state
 * into the accent the tiles paint.
 *
 * WHY A MODULE: `features/quick-capture/captureType.visual.ts` needs a
 * `SectionKey`, but the overlay's mode keys are product-destination names
 * (`todo`, `calorie`) while the section palette keys are section names
 * (`todos`, `calories`). Keeping that translation in one small table — and one
 * resolver — means the picker and the contrast matrix cannot drift apart, and
 * it stays out of the pure visual module (which must not import a provider).
 *
 * Planning destinations (Project/Goal) own no section and use the theme accent,
 * exactly as the overlay's pre-P19 type chips did.
 */
import { SECTION_HUES, type SectionAccent, type SectionKey } from '@/constants/sectionColors';
import type { ThemeTokens } from '@/core/theme/tokens';
import type { CaptureTypeAccent, CaptureTypeKey } from './captureType.visual';

/** Section destination of each capture mode; `null` = planning (theme accent). */
export const CAPTURE_MODE_SECTION: Record<CaptureTypeKey, SectionKey | null> = {
  todo: 'todos',
  habit: 'habits',
  calorie: 'calories',
  project: null,
  goal: null,
  focus: 'focus',
};

/**
 * Destination hue for one tile.
 *
 * Section destinations use the resolved section accent (`fill` = bright,
 * `text` = solid in light / lifted bright in dark, which also carries the
 * section's `sectionOverrides`) plus the theme-invariant `lip` tier (§5.1).
 * Planning destinations have no section, so they use the theme accent.
 */
export function resolveCaptureAccent(
  key: CaptureTypeKey,
  tokens: Pick<ThemeTokens, 'primaryBright' | 'accent' | 'buttonLip'>,
  sectionAccents: Record<SectionKey, SectionAccent>,
): CaptureTypeAccent {
  const sectionKey = CAPTURE_MODE_SECTION[key];
  if (sectionKey === null) {
    return { fill: tokens.primaryBright, text: tokens.accent, lip: tokens.buttonLip };
  }
  const section = sectionAccents[sectionKey];
  return { fill: section.fill, text: section.text, lip: SECTION_HUES[sectionKey].lip };
}
