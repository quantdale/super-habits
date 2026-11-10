import { test, expect, type Page } from './fixtures';
import { seedFixture, seedSql } from './helpers/seed';
import { returnToApp } from './helpers/dbHarness';
import { auditPage } from './helpers/a11yAudit';

/**
 * Rendered accessibility sweep for the P19–P21 v2 secondary surfaces.
 *
 * `e2e/a11y.spec.ts` audits the six sections plus the Settings and Command
 * Center overlays in light, dark and cyberpunk-neon. The v2 surfaces that
 * received their Playful Momentum restyle in P19–P21 were never audited as
 * surfaces of their own, and never in a theme that is neither the default
 * dark canvas nor a `sectionOverrides` theme — a third canvas tone (Nord's
 * mid-tone slate) changes which of the appearance-resolved section text hues
 * still clear the floor.
 *
 * This file uses the same helper (`e2e/helpers/a11yAudit.ts`: composited
 * ancestor background, WCAG relative luminance against the rendered
 * size/weight) and the same thresholds as `a11y.spec.ts` — it adds surfaces,
 * not rules. Every surface is seeded with the TYPICAL fixture plus one
 * persisted weekly review, so rows/bars/badges render populated instead of
 * their empty states.
 *
 * FINDINGS THIS SWEEP FOUND, AND WHERE THEY WENT:
 * On the Nord Arctic canvas the dark-appearance colour tiers were resolved per
 * APPEARANCE and never validated against a third theme's own surfaces, so
 * four hues missed the 4.5:1 text floor there:
 *   - Sky bright  #2FA8F7 → 3.86:1 on `surface` #3B4252 (`More details −/ +`,
 *     `Filters −`, garden `Tasks`)
 *   - Coral bright #FF6A4D → 3.56:1 on `surface` #3B4252 (garden `Workout`)
 *   - Berry bright #FF6FAE → 3.90:1 on `surface` #3B4252 (garden `Nutrition`)
 *   - lifted Grape #B49BFF → 4.35:1 on `surface` #3B4252 (garden `Focus`)
 * plus one on the derived chip wash: Today's `Plan today` label
 * (`tokens.primary` #88C0D0) read 3.50:1 on `tokens.chipBackground` #4A5B6B.
 *
 * Those were real product contrast defects. They are FIXED rather than
 * quarantined: `getSectionAccents()` now takes the active theme's own neutral
 * faces and resolves each coloured-text tier against them (the surface-aware
 * half of the `readableAccent` contract Settings already used), returning the
 * §5.1 hue unchanged wherever it already clears the floor and lifting only its
 * lightness where it does not — and the Nord `chipBackground` pin makes the
 * `Plan today` label clear its own wash. The four cases are now ordinary
 * passing assertions below, with no threshold lowered and no node excluded.
 * `tests/sectionAccentSurfaces.test.ts` pins the same matrix in all 14 themes
 * and pins light/dark to their previously-shipped values; CG-11 is closed.
 */

const PHONE = { width: 390, height: 844 } as const;

type Appearance = { label: string; mode: 'light' | 'dark'; themeId?: string };

const THEMES: readonly Appearance[] = [
  { label: 'light', mode: 'light' },
  { label: 'dark', mode: 'dark' },
  { label: 'nord', mode: 'dark', themeId: 'nord-arctic' },
  { label: 'cyberpunk-neon', mode: 'dark', themeId: 'cyberpunk-neon' },
];

/** A persisted `WeeklyReviewSummaryV1` payload, shaped like the real one. */
const REVIEW_SUMMARY = JSON.stringify({
  version: 1,
  week: {
    weekKey: '2026-10-19',
    startDateKey: '2026-10-19',
    endDateKey: '2026-10-25',
    nextWeekStartDateKey: '2026-10-26',
    nextWeekEndDateKey: '2026-11-01',
  },
  todos: {
    completedCount: 4,
    incompleteCount: 2,
    overdueCount: 1,
    dueNextWeekCount: 3,
    carryForwardCandidates: [],
  },
  habits: {
    scheduledOccurrences: 7,
    completedOccurrences: 5,
    consistencyPercent: 71,
    attention: [],
  },
  focus: { sessions: 3, minutes: 90, priorWeekMinutes: 60 },
  workouts: { sessions: 2, priorWeekSessions: 1, routines: [] },
  calories: { loggedDays: 5, averageCaloriesOnLoggedDays: 2100, configuredGoal: 2200 },
  wins: [{ kind: 'todo_completion', message: 'Shipped the week' }],
  attention: [],
});

async function applyTheme(page: Page, appearance: Appearance): Promise<void> {
  await page.evaluate((theme) => {
    window.localStorage.setItem('superhabits.theme.mode', theme.mode);
    if (theme.themeId) {
      window.localStorage.setItem(
        'superhabits.theme.slots.v2',
        JSON.stringify({ lightThemeId: 'light', darkThemeId: theme.themeId }),
      );
    } else {
      window.localStorage.removeItem('superhabits.theme.slots.v2');
    }
  }, appearance);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe(appearance.mode);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')))
    .toBe(appearance.themeId ?? appearance.mode);
}

async function seedReviewHistory(page: Page): Promise<void> {
  await seedSql(
    page,
    `INSERT INTO weekly_reviews
      (id, week_key, week_start_date, week_end_date, next_week_start_date,
       completed_at, status, summary_payload, plan_payload, reflection,
       created_at, updated_at, deleted_at)
     VALUES ('wrev_aa_seed', '2026-10-19', '2026-10-19', '2026-10-25', '2026-10-26',
             '2026-10-25T09:00:00.000Z', 'completed',
             '${REVIEW_SUMMARY.replace(/'/g, "''")}',
             '{"priorities":[{"id":"p1","text":"Protect deep work"}],"todoDecisions":[],"newCommitments":[]}',
             'Steady week', '2026-10-25T09:00:00.000Z', '2026-10-25T09:00:00.000Z', NULL);`,
  );
  await returnToApp(page);
}

/**
 * Every surface starts from its own fresh app load: a sheet left open by the
 * previous surface would intercept the next surface's trigger click, and the
 * audits are meant to measure one surface at a time.
 */
async function openHub(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Plan today' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('tab', { name: 'Progress', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  return dialog;
}

/**
 * `overlay` surfaces are portals above the app shell, so the audit hides the
 * section panels/tab rails for as long as it runs (the same scoping
 * `planning-v2-surfaces.spec.ts` uses) — the shell behind the sheet is today's
 * chrome, not one of the surfaces this file answers for.
 *
 * `panel` surfaces are normal section panels; every OTHER panel is hidden for
 * the same reason (a just-switched panel is still mid cross-fade, so its
 * opacity is non-zero for ~200ms and the helper would otherwise measure Today's
 * chrome while Health is the surface under test).
 */
type Scope = { kind: 'overlay' } | { kind: 'panel'; panelId: string };

type Surface = { name: string; scope: Scope; open: (page: Page) => Promise<void> };

const OVERLAY: Scope = { kind: 'overlay' };

const SURFACES: readonly Surface[] = [
  {
    name: 'quick capture',
    scope: OVERLAY,
    open: async (page) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Quick capture', exact: true }).click();
      await expect(page.getByPlaceholder('What do you want to remember?')).toBeVisible({
        timeout: 20_000,
      });
    },
  },
  {
    name: 'planning hub today + briefing',
    scope: OVERLAY,
    open: async (page) => {
      const dialog = await openHub(page);
      await dialog.getByRole('button', { name: 'Planning briefing' }).click();
      await expect(page.getByText('Yesterday focus', { exact: true })).toBeVisible({
        timeout: 20_000,
      });
    },
  },
  {
    name: 'guided planning step',
    scope: OVERLAY,
    open: async (page) => {
      await openHub(page);
      await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
      await expect(page.getByText(/^Plan your day · Commitments$/)).toBeVisible({
        timeout: 20_000,
      });
    },
  },
  {
    name: 'progress insights',
    scope: OVERLAY,
    open: async (page) => {
      const dialog = await openHub(page);
      await dialog.getByRole('tab', { name: 'Progress', exact: true }).click();
      await expect(page.getByText('Highlights', { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await page.getByRole('button', { name: 'Show metric details' }).click();
      await expect(page.getByText('Active projects', { exact: true })).toBeVisible();
    },
  },
  {
    name: 'momentum garden detail',
    scope: OVERLAY,
    open: async (page) => {
      const dialog = await openHub(page);
      await dialog.getByRole('tab', { name: 'Progress', exact: true }).click();
      await expect(page.getByText('Why each area grows', { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText('Recent growth', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: '28 days', exact: true }).click();
      await expect(page.getByText(/last 28 days ending/)).toBeVisible();
    },
  },
  {
    name: 'activity timeline + filters',
    scope: OVERLAY,
    open: async (page) => {
      const dialog = await openHub(page);
      await dialog.getByRole('tab', { name: 'Timeline', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Timeline filters' })).toBeVisible({
        timeout: 20_000,
      });
      await page.getByRole('button', { name: 'Timeline filters' }).click();
      await expect(page.getByRole('button', { name: 'Filter timeline by Habits' })).toBeVisible();
    },
  },
  {
    name: 'weekly review step 1',
    scope: OVERLAY,
    open: async (page) => {
      const dialog = await openHub(page);
      await dialog.getByRole('tab', { name: 'Progress', exact: true }).click();
      await dialog.getByRole('button', { name: 'Open weekly review' }).click();
      await expect(page.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Show all numbers' }).click();
      await expect(page.getByText('Consistency', { exact: true })).toBeVisible();
    },
  },
  {
    name: 'weekly review history',
    scope: OVERLAY,
    open: async (page) => {
      const dialog = await openHub(page);
      await dialog.getByRole('tab', { name: 'Progress', exact: true }).click();
      await dialog.getByRole('button', { name: 'Open weekly review' }).click();
      await expect(page.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Show past reviews' }).click();
      const row = page.getByRole('button', { name: 'Week of 2026-10-19 review' });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.click();
      await expect(page.getByText('Shipped the week')).toBeVisible();
    },
  },
  {
    name: 'health',
    scope: { kind: 'panel', panelId: 'sh-section-panel-health' },
    open: async (page) => {
      await page.goto('/#health', { waitUntil: 'domcontentloaded' });
      const panel = page.locator('#sh-section-panel-health');
      await expect(panel).not.toHaveAttribute('aria-hidden', 'true');
      await expect(panel.getByText('Health', { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(panel.getByRole('button', { name: 'Open Workout', exact: true })).toBeVisible();
    },
  },
  {
    // Adjacent chrome, not one of the P19–P21 surfaces: the sweep surfaced a
    // Nord-only defect on Today's `Plan today` chip (CG-11, now fixed by the
    // theme's pinned `chipBackground`), and hiding it behind overlay scoping
    // would have deleted real evidence. It is asserted like every other
    // surface here.
    name: 'today header (Plan today chip)',
    scope: { kind: 'panel', panelId: 'sh-section-panel-overview' },
    open: async (page) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: 'Plan today' })).toBeVisible({
        timeout: 20_000,
      });
    },
  },
  {
    name: 'achievements',
    scope: OVERLAY,
    open: async (page) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      // The card renders before the reward snapshot resolves, so the first
      // click can land while the section mounts its children; retry the same
      // trigger instead of extending a timeout (the pattern
      // `gamification-surfaces.spec.ts` established).
      const trigger = page.getByRole('button', {
        name: /Level & Streaks card — open achievements/,
      });
      for (let attempt = 0; attempt < 3; attempt++) {
        await trigger.click({ force: true });
        try {
          await page.getByText('Streak protection').waitFor({ state: 'visible', timeout: 8000 });
          break;
        } catch {
          if (attempt === 2) throw new Error('Achievements overlay did not open');
        }
      }
      await page.getByRole('button', { name: 'Show all badges' }).click();
      await expect(page.getByRole('button', { name: 'Hide all badges' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    },
  },
];

async function auditSurface(page: Page, scope: Scope): Promise<string[]> {
  const hidden =
    scope.kind === 'panel'
      ? `[role="tablist"], [role="tabpanel"]:not(#${scope.panelId})`
      : '[role="tablist"], [role="tabpanel"]';
  await page.evaluate((selector) => {
    const style = document.createElement('style');
    style.id = 'v2-aa-audit-scope';
    style.textContent = `${selector} { display: none !important; }`;
    document.head.appendChild(style);
  }, hidden);
  const result = await page.evaluate(auditPage);
  await page.evaluate(() => document.getElementById('v2-aa-audit-scope')?.remove());

  const findings: string[] = [];
  if (result.contrast.length) findings.push(`contrast ${JSON.stringify(result.contrast)}`);
  if (result.nameless.length) findings.push(`nameless ${JSON.stringify(result.nameless)}`);
  if (result.duplicateIds.length) findings.push(`ids ${JSON.stringify(result.duplicateIds)}`);
  if (result.hiddenFocusable.length)
    findings.push(`hiddenFocus ${JSON.stringify(result.hiddenFocusable)}`);
  return findings;
}

/** Audit every surface of one theme in a single seeded session (grouped for runtime). */
async function auditTheme(page: Page, appearance: Appearance, surfaces: readonly Surface[]) {
  await seedFixture(page, 'TYPICAL');
  await seedReviewHistory(page);
  await applyTheme(page, appearance);

  const perSurface: Record<string, string[]> = {};
  for (const surface of surfaces) {
    // No try/catch: a surface that fails to OPEN must fail the audit loudly
    // instead of reporting an empty finding list for a screen nobody saw.
    await surface.open(page);
    perSurface[surface.name] = await auditSurface(page, surface.scope);
  }
  return perSurface;
}

/**
 * Every surface is asserted in every theme — no quarantine, no exclusion.
 *
 * CG-11 used to hold four of these as `test.fixme` gates (three Nord surfaces
 * plus Today's `Plan today` chip). The gates are released: the surface-aware
 * resolver and the Nord `chipBackground` pin fix the underlying defect, and
 * the assertions below are the same helper, the same thresholds and the same
 * surface set the gates used, so a regression fails here immediately.
 */
test.describe('v2 secondary surfaces AA audit', () => {
  for (const appearance of THEMES) {
    test(`the v2 secondary surfaces are AA-clean (${appearance.label})`, async ({ page }) => {
      test.setTimeout(600_000);
      page.setDefaultNavigationTimeout(90_000);
      await page.setViewportSize({ ...PHONE });
      await page.emulateMedia({ reducedMotion: 'reduce' });

      const perSurface = await auditTheme(page, appearance, SURFACES);
      for (const [surface, findings] of Object.entries(perSurface)) {
        expect.soft(findings, `${appearance.label} / ${surface}`).toEqual([]);
      }
    });
  }
});
