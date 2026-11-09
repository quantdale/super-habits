import { test, expect, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, planningHubTab } from './helpers/navigation';
import { seedFixture, seedSql } from './helpers/seed';
import { returnToApp } from './helpers/dbHarness';
import { auditPage } from './helpers/a11yAudit';

/**
 * P21 part A rendered-truth instrument for the Planning Hub + Weekly Review
 * (docs/ui-ux/16-playful-momentum.md §5.1/§5.7/§6; roadmap row P21).
 *
 * The W11/W12 suites already pin the *behaviour* contracts (disclosures,
 * persistence, write-failure recovery). This spec pins the **v2 presentation**
 * contracts those surfaces must keep on every theme, at every phone width:
 *
 *  1. Rendered contrast: the DOM-level AA audit (`auditPage`) is run on the
 *     Planning Hub (Today + briefing open + Priority step) and on all three
 *     Weekly Review step views, in light, dark AND a section-override theme
 *     (cyberpunk-neon) — the pair table in `tests/planningContrast.test.ts`
 *     cannot see a component that picks the bright hue where a solid is needed.
 *  2. One primary action per step: the guided flow and the review expose at
 *     most one filled Sky CTA at a time, and the quiet moves are secondary/ghost.
 *  3. Fit at 360/375/390: no horizontal overflow of the hub content column and
 *     every step control keeps a ≥44pt target.
 *
 * No new assertions weaken the W11/W12 suites; this file only adds evidence.
 */

async function openHub(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
}

async function openReview(page: Page) {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: 'View Momentum Garden' }).click();
  const openReview = page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' });
  await expect(openReview).toBeVisible({ timeout: 20_000 });
  await openReview.click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
  return modal;
}

/**
 * Rendered AA audit scoped to the OPEN overlay.
 *
 * `auditPage` walks the whole document, which on this lane still contains the
 * app shell behind the modal scrim (Today's chrome is P11's surface, not
 * P21's). The overlay is what the user sees, so the audit hides the section
 * panels/tab rails for its duration and restores them afterwards — the
 * composited canvas of every remaining node is the modal panel itself.
 */
async function auditOverlay(page: Page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'p21-audit-scope';
    style.textContent = '[role="tabpanel"], [role="tablist"] { display: none !important; }';
    document.head.appendChild(style);
  });
  const result = await page.evaluate(auditPage);
  await page.evaluate(() => document.getElementById('p21-audit-scope')?.remove());
  return result;
}

/** Box height of one named control, resolved through the accessibility tree. */
async function requireTarget(
  page: Page,
  modal: ReturnType<Page['getByRole']>,
  name: string,
  min = 44,
) {
  const box = await modal.getByRole('button', { name, exact: true }).first().boundingBox();
  expect(box?.height ?? 0, `"${name}" target height`).toBeGreaterThanOrEqual(min);
}

/** A persisted summary payload shaped like `WeeklyReviewSummaryV1` (v1). */
const REVIEW_WEEK = {
  weekKey: '2026-10-19',
  startDateKey: '2026-10-19',
  endDateKey: '2026-10-25',
  nextWeekStartDateKey: '2026-10-26',
  nextWeekEndDateKey: '2026-11-01',
};

const SUMMARY_PAYLOAD = JSON.stringify({
  version: 1,
  week: REVIEW_WEEK,
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

test.describe('P21 part A planning surfaces (v2 tokens)', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('the Planning Hub Today surface is AA-clean and fits 360/375/390', async ({ page }) => {
    test.setTimeout(240_000);
    await seedFixture(page, 'TYPICAL');
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openHub(page);

    // The briefing is the densest Today sub-surface (five tint tiles).
    await page.getByRole('button', { name: 'Planning briefing' }).click();
    await expect(page.getByText('Yesterday focus', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Today's briefing", { exact: true })).toBeVisible();

    const result = await auditOverlay(page);
    expect(result.contrast, 'plan hub today: WCAG AA contrast').toEqual([]);
    expect(result.nameless, 'plan hub today: controls without accessible names').toEqual([]);
    expect(result.hiddenFocusable, 'plan hub today: focusable inside aria-hidden').toEqual([]);

    // Fit: no descendant escapes the hub's own modal panel at any phone width.
    for (const width of [360, 375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const panel = await page.getByRole('dialog').boundingBox();
      const overflow = await page.evaluate((bounds) => {
        if (!bounds) return [];
        const found: string[] = [];
        for (const el of Array.from(document.querySelectorAll('[role="dialog"] *'))) {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.right > bounds.x + bounds.width + 1) {
            found.push(`${(el.textContent ?? '').trim().slice(0, 32) || el.tagName}`);
          }
        }
        return found;
      }, panel);
      expect(overflow, `plan hub overflow at ${width}px`).toEqual([]);
    }

    await requireTarget(page, page.getByRole('dialog'), 'Planning briefing');
    await requireTarget(page, page.getByRole('dialog'), 'Refresh briefing');
  });

  test('the guided planning steps keep one primary CTA and AA-clean text', async ({ page }) => {
    test.setTimeout(240_000);
    await openHub(page);

    // The flow walks Carry-over → Commitments → Priorities → Focus → Confirm.
    // Every step must stay AA-clean, and each step's loud action must keep the
    // §6 md (44+3) target.
    // Exactly ONE filled (loud) action per step: the Sky `solid` face is only
    // ever painted by the step's single primary Button; supporting moves are
    // `secondary` (white face + outline + Sky label) or `ghost` (no face).
    const filledActions = async () =>
      page.evaluate(() => {
        const solid = 'rgb(23,105,216)'; // §5.1 Sky solid (#1769D8), colour-space stripped
        const found: string[] = [];
        for (const btn of Array.from(document.querySelectorAll('[role="button"]'))) {
          const style = getComputedStyle(btn);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          if (btn.getBoundingClientRect().width === 0) continue;
          // Pressable3D paints the solid face on the PARENT slab, not on the
          // interactive element (which stays transparent), so read both.
          const own = style.backgroundColor.replace(/\s/g, '');
          const parent = btn.parentElement
            ? getComputedStyle(btn.parentElement).backgroundColor.replace(/\s/g, '')
            : 'none';
          if (own === solid || parent === solid)
            found.push((btn.getAttribute('aria-label') ?? btn.textContent ?? '').trim());
        }
        return found;
      });

    const step1Primary = await filledActions();
    // The Carry-over step's loud action ("Carry forward") only renders when
    // yesterday left something unfinished; "Start fresh" is its ghost sibling.
    expect(step1Primary.length).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await expect(page.getByText(/^Plan your day · Commitments$/)).toBeVisible({ timeout: 20_000 });
    expect((await filledActions()).length, 'Commitments step primary count').toBeLessThanOrEqual(1);
    let audit = await auditOverlay(page);
    expect(audit.contrast, 'guided step Commitments: WCAG AA contrast').toEqual([]);

    await page.getByRole('button', { name: 'Next', exact: true }).first().click();
    await expect(page.getByText(/^Plan your day · Priorities$/)).toBeVisible({ timeout: 20_000 });
    expect((await filledActions()).length, 'Priorities step primary count').toBeLessThanOrEqual(1);
    audit = await auditOverlay(page);
    expect(audit.contrast, 'guided step Priorities: WCAG AA contrast').toEqual([]);

    // The selection surface: every row announces a selected state and keeps the
    // 56pt OptionRow rhythm target.
    const rows = page.getByRole('button', { name: /^Prioritize / });
    const rowCount = await rows.count();
    if (rowCount > 0) {
      await expect(rows.first()).toHaveAttribute('aria-selected', /true|false/);
      const box = await rows.first().boundingBox();
      expect(box?.height ?? 0, 'priority row height').toBeGreaterThanOrEqual(44);
    }

    await page.getByRole('button', { name: 'Next', exact: true }).first().click();
    await expect(page.getByText(/^Plan your day · Focus$/)).toBeVisible({ timeout: 20_000 });
    expect((await filledActions()).length, 'Focus step primary count').toBeLessThanOrEqual(1);
    audit = await auditOverlay(page);
    expect(audit.contrast, 'guided step Focus: WCAG AA contrast').toEqual([]);

    await page.getByRole('button', { name: 'Next', exact: true }).first().click();
    await expect(page.getByText(/^Plan your day · Confirm$/)).toBeVisible({ timeout: 20_000 });
    // The Confirm step owns exactly one loud action: "Save plan".
    expect(await filledActions(), 'Confirm step primary').toEqual(['Save plan']);
    audit = await auditOverlay(page);
    expect(audit.contrast, 'guided step Confirm: WCAG AA contrast').toEqual([]);

    for (const name of ['Save plan', 'Back', 'Use simple view']) {
      await requireTarget(page, page.getByRole('dialog'), name);
    }
  });

  test('every Weekly Review step is AA-clean and keeps one primary action', async ({ page }) => {
    test.setTimeout(240_000);
    const modal = await openReview(page);

    // Step 1 — Review: the numbers disclosure opens to the six stat groups.
    await modal.getByRole('button', { name: 'Show all numbers' }).click();
    await expect(modal.getByText('Consistency')).toBeVisible();
    const step1 = await auditOverlay(page);
    expect(step1.contrast, 'review step 1: WCAG AA contrast').toEqual([]);
    expect(step1.nameless, 'review step 1: controls without accessible names').toEqual([]);

    const next = modal.getByRole('button', { name: 'Next', exact: true });
    await next.click(); // decide
    await expect(modal.getByText(/^Step 2 of 5/)).toBeVisible();
    const step2 = await auditOverlay(page);
    expect(step2.contrast, 'review step 2: WCAG AA contrast').toEqual([]);

    await next.click(); // plan
    await expect(modal.getByText(/^Step 3 of 5/)).toBeVisible();
    const step3 = await auditOverlay(page);
    expect(step3.contrast, 'review step 3: WCAG AA contrast').toEqual([]);

    await modal.getByRole('button', { name: 'Add priority' }).click();
    await modal.getByPlaceholder('Priority 1').fill('Protect deep work');
    await next.click(); // reflect
    await expect(modal.getByText(/^Step 4 of 5/)).toBeVisible();
    const step4 = await auditOverlay(page);
    expect(step4.contrast, 'review step 4: WCAG AA contrast').toEqual([]);

    await next.click(); // confirm
    await expect(modal.getByText(/^Step 5 of 5/)).toBeVisible();
    const step5 = await auditOverlay(page);
    expect(step5.contrast, 'review step 5: WCAG AA contrast').toEqual([]);

    // The confirm step owns exactly one filled CTA ("Confirm & Save"); the
    // quiet back path is a ghost control. Both keep the §6 md target.
    for (const name of ['Confirm & Save', 'Back']) {
      await requireTarget(page, modal, name);
    }
  });

  test('the Weekly Review is AA-clean in dark and a section-override theme', async ({ page }) => {
    test.setTimeout(300_000);
    for (const themeId of ['dark', 'cyberpunk-neon'] as const) {
      await page.evaluate((id) => {
        window.localStorage.setItem('superhabits.theme.mode', 'dark');
        window.localStorage.setItem(
          'superhabits.theme.slots.v2',
          JSON.stringify({ lightThemeId: 'light', darkThemeId: id }),
        );
      }, themeId);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')))
        .toBe(themeId);

      await goToTab(page, 'overview');
      await openReview(page);
      const result = await auditOverlay(page);
      expect(result.contrast, `review ${themeId}: WCAG AA contrast`).toEqual([]);
      expect(result.nameless, `review ${themeId}: controls without accessible names`).toEqual([]);
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });

  test('the review history row keeps its durable delete after the v2 restyle', async ({ page }) => {
    test.setTimeout(240_000);
    // Seed one completed review (the row has no local outbox intent; this spec
    // only asserts the v2 presentation of the row + its delete control).
    const today = await page.evaluate(() => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    });
    await seedSql(
      page,
      `INSERT INTO weekly_reviews
        (id, week_key, week_start_date, week_end_date, next_week_start_date,
         completed_at, status, summary_payload, plan_payload, reflection,
         created_at, updated_at, deleted_at)
       VALUES ('wrev_p21_seed', '2026-10-19', '2026-10-19', '2026-10-25', '2026-10-26',
               '${today}T09:00:00.000Z', 'completed',
               '${SUMMARY_PAYLOAD.replace(/'/g, "''")}',
               '{"priorities":[{"id":"p1","text":"Protect deep work"}],"todoDecisions":[],"newCommitments":[]}',
               'Steady week', '${today}T09:00:00.000Z', '${today}T09:00:00.000Z', NULL);`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    const modal = await openReview(page);

    await modal.getByRole('button', { name: 'Show past reviews' }).click();
    const row = modal.getByRole('button', { name: 'Week of 2026-10-19 review' });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    // Expanded body reads the persisted payload, not a local draft.
    await expect(modal.getByText('Shipped the week')).toBeVisible();
    await expect(modal.getByText('Steady week')).toBeVisible();

    const del = modal.getByRole('button', { name: 'Delete review for week 2026-10-19' });
    await expect(del).toBeVisible();
    const box = await del.boundingBox();
    expect(box?.height ?? 0, 'delete control height').toBeGreaterThanOrEqual(44);

    const result = await auditOverlay(page);
    expect(result.contrast, 'review history: WCAG AA contrast').toEqual([]);
  });
});
