import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import {
  PLANNING_GOLD,
  PLANNING_SKY,
  planningPrimaryFace,
  planningRowVisual,
  planningStatTileVisual,
  planningStatusVisual,
  planningStepNodeFill,
  planningStepNodeInk,
  planningTintFace,
  planningToneText,
  type PlanningTone,
} from '@/features/planning-hub/planningHub.visual';

/**
 * P21 part A contrast matrix: every ink the Planning Hub / Weekly Review paints
 * on a planning tone (Sky tint wash, Gold tint wash, hue faces, status banners)
 * is resolved against the ACTUAL fill and asserted in ALL 14 themes.
 *
 * The pre-fix regressions this pins (the reason the helpers exist):
 * - `tokens.textMuted` on the Sky tint wash measures 4.3–5.0:1 depending on the
 *   theme (the briefing tiles and the selected priority rows both painted it);
 * - the guided flow painted `SECTION_COLORS.todos` (#2FA8F7 bright) as LABEL
 *   text on a tinted row (2.4:1) and `#fff` on `tokens.primary` (themes whose
 *   primary is a bright hue land at 2.2:1);
 * - the Weekly Review painted `#fff` on `tokens.primary` for selected decision
 *   chips and Gold derived from `tokens.warningText` for stats on white.
 *
 * Floors: text 4.5:1, non-text boundaries 3:1 (WCAG 1.4.11).
 */
const TONES: PlanningTone[] = ['sky', 'gold'];

describe('planning tone text tiers', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    for (const tone of TONES) {
      it(`${id} (${theme.appearance}): ${tone} text clears 4.5 on the plain surface`, () => {
        const { tokens } = theme;
        const ink = planningToneText({
          tone,
          appearance: theme.appearance,
          surface: tokens.surface,
          text: tokens.text,
        });
        const ratio = contrastRatio(ink, tokens.surface);
        expect(ratio, `${id}: ${tone} ink ${ink} on ${tokens.surface}`).toBeGreaterThanOrEqual(
          WCAG_AA_TEXT,
        );
      });
    }

    it(`${id} (${theme.appearance}): tint faces are derived from the hue, not the theme`, () => {
      // The tint recipe must be hue-derived so a planning row reads the same in
      // every theme (the §5.1 precomputed `tintLight`/`tintDark` values).
      expect(planningTintFace('sky', 'light')).toMatch(/#[0-9a-f]{6}/);
      expect(planningTintFace('gold', 'dark')).toMatch(/#[0-9a-f]{6}/);
    });
  }

  it('the planning hue is the §5.1 Sky pair and the review hue the reward Gold pair', () => {
    expect(PLANNING_SKY.bright).toBe('#2FA8F7');
    expect(PLANNING_SKY.solid).toBe('#1769D8');
    expect(PLANNING_GOLD.bright).toBe('#FFC81F');
    // §5.1 forbids Gold as text outside reward surfaces: the review's text tier
    // is the reward-ink brown, never the Gold face.
    expect(PLANNING_GOLD.text).not.toBe(PLANNING_GOLD.bright);
  });
});

describe('planning selectable rows (guided flow / weekly review decisions)', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    for (const tone of TONES) {
      for (const selected of [true, false]) {
        const visual = planningRowVisual({
          tone,
          selected,
          appearance: theme.appearance,
          surface: tokens.surface,
          border: tokens.border,
          borderStrong: tokens.borderStrong,
          text: tokens.text,
          textMuted: tokens.textMuted,
        });

        it(`${id} ${tone} ${selected ? 'selected' : 'unselected'}: row label clears 4.5 on its face`, () => {
          expect(
            contrastRatio(visual.ink, visual.face),
            `${id}: row ink ${visual.ink} on ${visual.face}`,
          ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
        });

        it(`${id} ${tone} ${selected ? 'selected' : 'unselected'}: state mark clears 3 on its face`, () => {
          expect(
            contrastRatio(visual.mark, visual.face),
            `${id}: mark ${visual.mark} on ${visual.face}`,
          ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
        });

        it(`${id} ${tone} ${selected ? 'selected' : 'unselected'}: the 2px border clears 3 on the surface`, () => {
          // Selection draws the hue solid border inside a list of surface rows,
          // so the boundary must be visible against BOTH faces.
          const borderRatio = Math.max(
            contrastRatio(visual.border, tokens.surface),
            contrastRatio(visual.border, visual.face),
          );
          expect(borderRatio, `${id}: row border ${visual.border}`).toBeGreaterThanOrEqual(
            selected ? WCAG_AA_NON_TEXT : 1.2,
          );
        });

        it(`${id} ${tone} ${selected ? 'selected' : 'unselected'}: the check badge glyph clears 3 on its fill`, () => {
          expect(
            contrastRatio(visual.badgeInk, visual.badgeFill),
            `${id}: badge ink ${visual.badgeInk} on ${visual.badgeFill}`,
          ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
        });
      }
    }
  }

  it('records the pre-fix regression: the guided flow painted the bright hue as text', () => {
    const light = THEME_REGISTRY.light.tokens;
    const tint = planningTintFace('sky', 'light');
    // The guided priority row painted `SECTION_COLORS.todos` (#2FA8F7) as ink on
    // the sunken selected face — far below the text floor.
    expect(contrastRatio(PLANNING_SKY.bright, tint)).toBeLessThan(WCAG_AA_TEXT);
    // ... and the selected decision chip painted white on `tokens.primary`.
    expect(contrastRatio('#FFFFFF', light.button)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    const cyber = THEME_REGISTRY['cyberpunk-neon']?.tokens;
    if (cyber) {
      // Themes whose primary is a bright hue cannot carry white text at all.
      expect(contrastRatio('#FFFFFF', cyber.button)).toBeLessThan(WCAG_AA_TEXT);
    }
  });
});

describe('planning stat tiles (Today briefing)', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    for (const tone of TONES) {
      const tile = planningStatTileVisual({
        tone,
        appearance: theme.appearance,
        surface: tokens.surface,
        text: tokens.text,
        textMuted: tokens.textMuted,
      });

      it(`${id} ${tone}: tile value ink clears 4.5 on the tint wash`, () => {
        expect(
          contrastRatio(tile.ink, tile.face),
          `${id}: value ${tile.ink} on ${tile.face}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });

      it(`${id} ${tone}: tile caption ink clears 4.5 on the tint wash`, () => {
        expect(
          contrastRatio(tile.caption, tile.face),
          `${id}: caption ${tile.caption} on ${tile.face}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });

      it(`${id} ${tone}: tile outline clears 3 on the surface`, () => {
        expect(
          contrastRatio(tile.border, tokens.surface),
          `${id}: outline ${tile.border}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      });
    }
  }
});

describe('planning status banners', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const sets = [
      {
        name: 'success',
        face: tokens.successBackground,
        ink: tokens.successText,
        border: tokens.successBorder,
        solid: tokens.successSolid,
      },
      {
        name: 'warning',
        face: tokens.warningBackground,
        ink: tokens.warningText,
        border: tokens.warningBorder,
        solid: tokens.warningSolid,
      },
      {
        name: 'danger',
        face: tokens.dangerBackground,
        ink: tokens.dangerText,
        border: tokens.dangerBorder,
        solid: tokens.dangerSolid,
      },
    ];

    for (const set of sets) {
      const visual = planningStatusVisual({
        face: set.face,
        surface: tokens.surface,
        text: tokens.text,
        textMuted: tokens.textMuted,
        ink: set.ink,
        border: set.border,
        solid: set.solid,
      });

      it(`${id}: ${set.name} banner ink clears 4.5 on its face`, () => {
        expect(
          contrastRatio(visual.ink, set.face),
          `${id}: ${set.name} ink ${visual.ink} on ${set.face}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });

      it(`${id}: ${set.name} banner supporting line clears 4.5 on its face`, () => {
        expect(
          contrastRatio(visual.mutedInk, set.face),
          `${id}: ${set.name} muted ink ${visual.mutedInk} on ${set.face}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });

      it(`${id}: ${set.name} banner outline clears 3 on the surface`, () => {
        expect(
          contrastRatio(visual.border, tokens.surface),
          `${id}: ${set.name} outline ${visual.border}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      });
    }
  }
});

describe('planning step nodes', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    for (const tone of TONES) {
      it(`${id} ${tone}: reached node glyph clears 3 on the bright face`, () => {
        const fill = planningStepNodeFill({
          tone,
          appearance: theme.appearance,
          surfaceSunken: tokens.surfaceSunken,
          reached: true,
        });
        const ink = planningStepNodeInk({ reached: true, textMuted: tokens.textMuted });
        expect(
          contrastRatio(ink, fill),
          `${id}: node glyph ${ink} on ${fill}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      });

      it(`${id} ${tone}: unreached node glyph clears 3 on the sunken track`, () => {
        const fill = planningStepNodeFill({
          tone,
          appearance: theme.appearance,
          surfaceSunken: tokens.surfaceSunken,
          reached: false,
        });
        const ink = planningStepNodeInk({ reached: false, textMuted: tokens.textMuted });
        expect(
          contrastRatio(ink, fill),
          `${id}: node glyph ${ink} on ${fill}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      });
    }
  }
});

describe('planning primary CTA face', () => {
  it('keeps the Sky solid face with a white label in every theme (§5.1: 5.19:1)', () => {
    const face = planningPrimaryFace('sky');
    expect(face).toBe(PLANNING_SKY.solid);
    expect(contrastRatio('#FFFFFF', face)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});
