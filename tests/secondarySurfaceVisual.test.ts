import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import {
  getSectionAccents,
  SECTION_COLORS,
  SECTION_HUES,
  SECTION_ON_BRIGHT_INK,
} from '@/constants/sectionColors';
import {
  HEALTH_TILE_SIZE,
  healthEntryTileVisual,
  healthHeroVisual,
  healthStatusMarkVisual,
} from '@/features/health/health.visual';
import {
  comparisonPercent,
  progressBarVisual,
  progressChipVisual,
} from '@/features/progress/progress.visual';
import {
  ACTIVITY_SOURCE_SECTION,
  activityChromeChipVisual,
  activityItemTileVisual,
  activitySourceTileVisual,
  resolveActivitySource,
  resolveTileFace,
} from '@/features/activity/activityTimeline.visual';
import { SOURCE_FILTER_SOURCES, SOURCE_ICON } from '@/features/activity/activityTimeline.domain';

/**
 * P21b contrast + visual-model matrix for the secondary surfaces
 * (docs/ui-ux/16-playful-momentum.md §5.1/§6), following the P13–P16 lesson:
 * every ink painted on a FIXED hue fill must be chosen against the ACTUAL
 * fill, in all 14 themes, not against the theme's own palette.
 *
 * Two classes of failure are pinned here:
 *
 * 1. **Fixed-hue fills.** Health's hero is the §5.1 Lagoon `bright`
 *    (`#22CCB8`); theme text on it measures 1.87:1 (dark) and 2.02:1 (white),
 *    and Lagoon's own `textMuted` lands at 1.05–3.64:1 — so the hero's quiet
 *    line may not use `tokens.textMuted` at all.
 * 2. **Theme-override tints.** Cyberpunk Neon's `sectionOverrides` return
 *    8-digit tints (`#FB923C1F`) which are overlays, not fills: a 6-digit-only
 *    contrast helper silently skips the floor and a glyph painted in the
 *    override's own text tier measures 1.00:1 on its own tint. The tile models
 *    composite first, then floor.
 */
const LAGOON = SECTION_HUES.health;

describe('Health hero inks on the fixed Lagoon face', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    const visual = healthHeroVisual({ text: tokens.text, textMuted: tokens.textMuted });

    it(`${id} (${theme.appearance}): headline ink clears 4.5 on Lagoon`, () => {
      const ratio = contrastRatio(visual.ink, LAGOON.bright);
      expect(ratio, `${id}: hero ink ${visual.ink} on ${LAGOON.bright}`).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
    });

    it(`${id} (${theme.appearance}): quiet line clears 4.5 on Lagoon`, () => {
      const ratio = contrastRatio(visual.mutedInk, LAGOON.bright);
      expect(
        ratio,
        `${id}: hero muted ink ${visual.mutedInk} on ${LAGOON.bright}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it('paints the §5.1 Lagoon bright as the hero face in every theme', () => {
    for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
      expect(
        healthHeroVisual({ text: theme.tokens.text, textMuted: theme.tokens.textMuted }).fill,
        `${id}: hero face`,
      ).toBe(LAGOON.bright);
    }
  });

  it('documents the pre-fix regression: dark ink, muted ink and white all fail on Lagoon', () => {
    const light = THEME_REGISTRY.light.tokens;
    const dark = THEME_REGISTRY.dark.tokens;
    // A dark theme's own text is a light ink: it disappears on the fixed Lagoon
    // bright face. (Light mode's near-black text happens to survive — which is
    // exactly why the ink must be resolved per fill, not per appearance.)
    expect(contrastRatio(dark.text, LAGOON.bright)).toBeLessThan(WCAG_AA_TEXT);
    expect(contrastRatio(light.textMuted, LAGOON.bright)).toBeLessThan(WCAG_AA_TEXT);
    expect(contrastRatio(dark.textMuted, LAGOON.bright)).toBeLessThan(WCAG_AA_TEXT);
    // The naive "white on the hue" pair fails both floors.
    expect(contrastRatio('#FFFFFF', LAGOON.bright)).toBeLessThan(WCAG_AA_TEXT);
    // The §5.1 bright-fill ink is what every theme resolves to.
    expect(contrastRatio(SECTION_ON_BRIGHT_INK, LAGOON.bright)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
  });

  it('the pending status mark clears the 3:1 non-text floor on the hero face', () => {
    for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
      const { tokens } = theme;
      const mark = healthStatusMarkVisual({
        done: false,
        accentText: tokens.successText,
        fill: LAGOON.bright,
      });
      expect(mark.icon, `${id}: pending glyph`).toBe('radio-button-unchecked');
      const ratio = contrastRatio(mark.ink, LAGOON.bright);
      expect(ratio, `${id}: pending mark ${mark.ink} on Lagoon`).toBeGreaterThanOrEqual(
        WCAG_AA_NON_TEXT,
      );
    }
  });
});

describe('Health routing tiles', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const accents = getSectionAccents(theme.appearance, theme.sectionOverrides);

    for (const key of ['workout', 'calories'] as const) {
      it(`${id} (${theme.appearance}): ${key} glyph clears 4.5 on its tile`, () => {
        const tile = healthEntryTileVisual(accents[key], theme.tokens.surface);
        const ratio = contrastRatio(tile.ink, tile.tile);
        expect(ratio, `${id}: ${key} glyph ${tile.ink} on ${tile.tile}`).toBeGreaterThanOrEqual(
          WCAG_AA_TEXT,
        );
      });
    }
  }

  it('keeps the child section hue, not the Health hue, on each tile', () => {
    const light = getSectionAccents('light');
    expect(healthEntryTileVisual(light.workout, '#FFFFFF').tile).toBe(
      SECTION_HUES.workout.tintLight,
    );
    expect(healthEntryTileVisual(light.calories, '#FFFFFF').tile).toBe(
      SECTION_HUES.calories.tintLight,
    );
    // Never Lagoon: the hero owns that hue, the rows belong to the children.
    expect(healthEntryTileVisual(light.workout, '#FFFFFF').tile).not.toBe(
      SECTION_HUES.health.tintLight,
    );
  });

  it('composites an 8-digit override tint before resolving the glyph ink', () => {
    // Cyberpunk Neon's override is an overlay (`#FB923C1F` over `#0e1020`): the
    // naive "paint the tint, use its text tier" pair measures 1.00:1 there.
    const neon = THEME_REGISTRY['cyberpunk-neon'];
    const accents = getSectionAccents(neon.appearance, neon.sectionOverrides);
    const tile = healthEntryTileVisual(accents.workout, neon.tokens.surface);
    expect(tile.tile).not.toBe(accents.workout.tint);
    expect(contrastRatio(tile.ink, tile.tile)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    // The un-composited pair is exactly what the model exists to prevent.
    expect(contrastRatio(accents.workout.text, accents.workout.tint)).toBeLessThan(WCAG_AA_TEXT);
  });

  it('pins the 40px §6 leading tile size', () => {
    expect(HEALTH_TILE_SIZE).toBe(40);
  });
});

describe('Progress comparison bar and chips', () => {
  it('clamps the bar to 0..100 and refuses to fabricate a share from zero', () => {
    expect(comparisonPercent(0, 0)).toBe(0);
    expect(comparisonPercent(5, 0)).toBe(100);
    expect(comparisonPercent(3, 12)).toBe(25);
    expect(comparisonPercent(12, 3)).toBe(100);
    expect(comparisonPercent(Number.NaN, 5)).toBe(0);
    expect(comparisonPercent(2, 2)).toBe(100);
  });

  it('fills with the §5.1 Sky bright over the theme sunken rail', () => {
    for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
      const bar = progressBarVisual({ surfaceSunken: theme.tokens.surfaceSunken });
      expect(bar.fill, `${id}: fill`).toBe(SECTION_COLORS.todos);
      expect(bar.track, `${id}: rail`).toBe(theme.tokens.surfaceSunken);
    }
  });

  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    it(`${id} (${theme.appearance}): selected window chip label clears 4.5 on its tint`, () => {
      const chip = progressChipVisual({ appearance: theme.appearance });
      const ratio = contrastRatio(chip.selectedInk, chip.selectedFill);
      expect(
        ratio,
        `${id}: chip label ${chip.selectedInk} on ${chip.selectedFill}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      // The outline is P6 `Chip`'s own affordance and is not the sole carrier
      // of the selected state (tint face + solid-hue label + aria-pressed all
      // say it), so P21b pins the label ink and leaves the component's
      // boundary decision to its owning phase.
      expect(chip.selectedBorder).toBe(SECTION_HUES.todos.bright);
    });
  }
});

describe('Activity source tiles and chrome', () => {
  const ALL_SOURCES = Object.values(SOURCE_FILTER_SOURCES).flat();

  it('covers every timeline source and reuses the data layer glyphs', () => {
    for (const source of ALL_SOURCES) {
      expect(ACTIVITY_SOURCE_SECTION[source], `source ${source}`).toBeDefined();
      expect(
        activityItemTileVisual(
          {
            id: `${source}:x`,
            occurredAt: '2026-10-13T08:00:00.000Z',
            dateKey: '2026-10-13',
            category: 'productivity',
            source,
            title: 'x',
            icon: SOURCE_ICON[source],
          },
          getSectionAccents('light'),
          '#FFFFFF',
        ).glyph,
        `glyph ${source}`,
      ).toBe(SOURCE_ICON[source]);
    }
  });

  it('routes each source to its owning section hue, and planning to Sky', () => {
    expect(resolveActivitySource('todo')).toBe('todos');
    expect(resolveActivitySource('habit')).toBe('habits');
    expect(resolveActivitySource('focus')).toBe('focus');
    expect(resolveActivitySource('workout')).toBe('workout');
    expect(resolveActivitySource('calories')).toBe('calories');
    // The hub's own entities take the hub's hue: there is no "planning" hue in §5.1.
    expect(resolveActivitySource('daily_plan')).toBe('todos');
    expect(resolveActivitySource('weekly_review')).toBe('todos');
    expect(resolveActivitySource('project')).toBe('todos');
    expect(resolveActivitySource('goal')).toBe('todos');
  });

  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const accents = getSectionAccents(theme.appearance, theme.sectionOverrides);

    it(`${id} (${theme.appearance}): every source tile glyph clears 4.5 on its face`, () => {
      for (const section of Object.keys(SECTION_HUES) as (keyof typeof SECTION_HUES)[]) {
        const tile = activitySourceTileVisual(
          section,
          accents,
          'check-circle',
          theme.tokens.surface,
        );
        const ratio = contrastRatio(tile.ink, tile.face);
        expect(ratio, `${id}: ${section} glyph ${tile.ink} on ${tile.face}`).toBeGreaterThanOrEqual(
          WCAG_AA_TEXT,
        );
      }
    });

    it(`${id} (${theme.appearance}): selected filter chip clears 4.5 on its tint`, () => {
      const chip = activityChromeChipVisual({ appearance: theme.appearance });
      const ratio = contrastRatio(chip.selectedInk, chip.selectedFill);
      expect(ratio, `${id}: chip label`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      expect(chip.selectedBorder).toBe(SECTION_HUES.todos.bright);
    });
  }

  it('keeps the un-composited override tint distinguishable from its face', () => {
    // `resolveTileFace` is a no-op for spec-format 6-digit tints…
    expect(resolveTileFace(SECTION_HUES.todos.tintLight, '#FFFFFF')).toBe(
      SECTION_HUES.todos.tintLight,
    );
    // …and composites an 8-digit overlay onto the row surface.
    const neon = THEME_REGISTRY['cyberpunk-neon'];
    const accents = getSectionAccents(neon.appearance, neon.sectionOverrides);
    expect(accents.todos.tint).toMatch(/^#[0-9a-fA-F]{8}$/);
    expect(resolveTileFace(accents.todos.tint, neon.tokens.surface)).not.toBe(accents.todos.tint);
  });
});
