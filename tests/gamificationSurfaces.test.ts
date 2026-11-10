import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import { SECTION_ON_BRIGHT_INK, getRewardAccents } from '@/constants/sectionColors';
import {
  BADGE_TIER_HUES,
  badgeTileVisual,
  levelRingVisual,
  questRowVisual,
  weekDayNodeVisual,
} from '@/features/gamification/gamificationSurfaces.visual';

/**
 * P20 reward-surface contrast + state matrix
 * (`docs/ui-ux/16-playful-momentum.md` §7 "Gamification surfaces").
 *
 * The badge tier fills, the Flame/Ice reward hues and the Gold bar are FIXED
 * colours that do not follow the theme, so every ink painted on them must be
 * chosen against the ACTUAL fill — otherwise one appearance is legible and the
 * other is not (the P13/P14/P15 Codex lesson). Floors: text 4.5:1, non-text
 * (glyph/outline/ring) 3:1.
 *
 * Every theme in the registry is covered so a future palette edit cannot
 * silently regress a surface that only renders in one appearance.
 */

const TEXT_TIERS = [1, 2, 3, 4] as const;

describe('Badge tier plates (§7 hexagon/ribbon tiles)', () => {
  it('pins the four tier fills from the brief', () => {
    expect(BADGE_TIER_HUES[1].bright).toBe('#D0874A'); // Bronze
    expect(BADGE_TIER_HUES[2].bright).toBe('#AAB2C3'); // Silver
    expect(BADGE_TIER_HUES[3].bright).toBe('#FFC81F'); // Gold
    expect(BADGE_TIER_HUES[4].bright).toBe('#5CCBFF'); // Platinum
  });

  it('white text on any tier fill fails the floor (so the ink is never white)', () => {
    for (const tier of TEXT_TIERS) {
      const ratio = contrastRatio('#FFFFFF', BADGE_TIER_HUES[tier].bright);
      expect(ratio, `white on tier ${tier}`).toBeLessThan(WCAG_AA_TEXT);
    }
  });

  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;

    for (const tier of TEXT_TIERS) {
      it(`${id}: unlocked tier ${tier} glyph clears 4.5 on its own fill`, () => {
        const visual = badgeTileVisual({ tier, unlocked: true, tokens });
        const glyphRatio = contrastRatio(visual.glyphBright, visual.fill);
        const where = `${id} tier ${tier}: ${visual.glyphBright} on ${visual.fill}`;
        expect(glyphRatio, where).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });

      it(`${id}: unlocked tier ${tier} label + meta clear 4.5 on the panel`, () => {
        const visual = badgeTileVisual({ tier, unlocked: true, tokens });
        const labelRatio = contrastRatio(visual.labelInk, tokens.surface);
        const metaRatio = contrastRatio(visual.metaInk, tokens.surface);
        expect(labelRatio).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
        expect(metaRatio).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });

      it(`${id}: locked tier ${tier} is sunken monochrome with a >=3:1 outline`, () => {
        const visual = badgeTileVisual({ tier, unlocked: false, tokens });
        expect(visual.unlocked).toBe(false);
        expect(visual.fill).toBe(tokens.surfaceSunken);
        // Monochrome: the glyph and its detail are the same muted ink.
        expect(visual.glyphBright).toBe(tokens.textMuted);
        expect(visual.glyphLip).toBe(tokens.textMuted);
        expect(contrastRatio(visual.outline, tokens.surface)).toBeGreaterThanOrEqual(
          WCAG_AA_NON_TEXT,
        );
        // A locked tile never borrows the tier hue.
        expect(visual.fill).not.toBe(BADGE_TIER_HUES[tier].bright);
      });
    }
  }
});

describe('WeekStrip Flame/Ice nodes (§7)', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const rewardText = getRewardAccents(theme.appearance);

    it(`${id} (${theme.appearance}): active day initial clears 4.5 on Flame`, () => {
      const visual = weekDayNodeVisual({
        state: 'active',
        isToday: true,
        appearance: theme.appearance,
        tokens,
        rewardText: { streak: rewardText.streak.text, frozen: rewardText.frozen.text },
      });
      expect(contrastRatio(visual.ink, visual.fill)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      expect(visual.mark).toBe('flame');
    });

    it(`${id} (${theme.appearance}): frozen day is an Ice shield with a readable ring`, () => {
      const visual = weekDayNodeVisual({
        state: 'frozen',
        isToday: false,
        appearance: theme.appearance,
        tokens,
        rewardText: { streak: rewardText.streak.text, frozen: rewardText.frozen.text },
      });
      expect(visual.mark).toBe('shield');
      expect(contrastRatio(visual.borderColor, visual.fill)).toBeGreaterThanOrEqual(
        WCAG_AA_NON_TEXT,
      );
      expect(contrastRatio(visual.ink, visual.fill)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it(`${id} (${theme.appearance}): empty day keeps a >=3:1 outline (never tokens.border)`, () => {
      const visual = weekDayNodeVisual({
        state: 'empty',
        isToday: false,
        appearance: theme.appearance,
        tokens,
        rewardText: { streak: rewardText.streak.text, frozen: rewardText.frozen.text },
      });
      expect(visual.mark).toBe('dot');
      expect(contrastRatio(visual.borderColor, visual.fill)).toBeGreaterThanOrEqual(
        WCAG_AA_NON_TEXT,
      );
      expect(visual.borderColor).not.toBe(tokens.border);
    });

    it(`${id} (${theme.appearance}): three node states are distinguishable`, () => {
      const base = {
        isToday: false,
        appearance: theme.appearance,
        tokens,
        rewardText: { streak: rewardText.streak.text, frozen: rewardText.frozen.text },
      } as const;
      const active = weekDayNodeVisual({ ...base, state: 'active' });
      const frozen = weekDayNodeVisual({ ...base, state: 'frozen' });
      const empty = weekDayNodeVisual({ ...base, state: 'empty' });
      expect(active.fill).not.toBe(frozen.fill);
      expect(frozen.fill).not.toBe(empty.fill);
      expect(active.mark).not.toBe(frozen.mark);
      expect(frozen.mark).not.toBe(empty.mark);
    });
  }
});

describe('QuestRow Gold bar + chest (§7 depth.card)', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;

    it(`${id} (${theme.appearance}): chest glyph clears 4.5 on its own Gold tile`, () => {
      const visual = questRowVisual({
        complete: false,
        appearance: theme.appearance,
        tokens,
      });
      const chestRatio = contrastRatio(visual.chestInk, visual.chestTile);
      expect(chestRatio).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it(`${id} (${theme.appearance}): state-tile glyph clears 4.5 in both quest states`, () => {
      for (const complete of [false, true]) {
        const visual = questRowVisual({ complete, appearance: theme.appearance, tokens });
        const iconRatio = contrastRatio(visual.iconInk, visual.iconTile);
        const where = `${id} complete=${complete}`;
        expect(iconRatio, where).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      }
    });

    it(`${id} (${theme.appearance}): the card lip is a visible depth edge`, () => {
      const visual = questRowVisual({
        complete: false,
        appearance: theme.appearance,
        tokens,
      });
      expect(visual.cardBorder).toBe(tokens.border);
      expect(visual.cardLip).toBe(tokens.borderStrong);
      expect(visual.barColor).toBe('#FFC81F');
    });
  }

  it('the complete state and the in-progress state are visually distinct', () => {
    const tokens = THEME_REGISTRY.light.tokens;
    const inProgress = questRowVisual({ complete: false, appearance: 'light', tokens });
    const complete = questRowVisual({ complete: true, appearance: 'light', tokens });
    expect(inProgress.iconTile).not.toBe(complete.iconTile);
    expect(inProgress.iconInk).not.toBe(complete.iconInk);
  });
});

describe('LevelHero ring (§7 Gold polish)', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    it(`${id}: the ring arc is Gold on the sunken track`, () => {
      const ring = levelRingVisual(theme.tokens);
      expect(ring.arcColor).toBe('#FFC81F');
      expect(ring.trackColor).toBe(theme.tokens.surfaceSunken);
      expect(ring.lipColor).toBe('#E0A800');
      // The arc is a progress fill, not a component boundary: the §5.6 bar
      // language is a bright fill on the sunken track (the same pair
      // `core/ui/ProgressBar` ships). What must stay legible is the level
      // number *inside* the ring, which the theme's own text ink paints.
      expect(contrastRatio(theme.tokens.text, theme.tokens.surface)).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
      expect(ring.arcColor).not.toBe(ring.trackColor);
    });
  }
});

describe('Reward ink direction (§5.1: bright never under white text)', () => {
  it('uses the bright-fill ink, not white, on every reward bright face', () => {
    const ratio = contrastRatio(SECTION_ON_BRIGHT_INK, '#FFC81F');
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});
