import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from './fixtures';
import { goToTab, planningHubTab } from './helpers/navigation';
import { resetAll } from './helpers/reset';
import { returnToApp } from './helpers/dbHarness';

/** W11 Before/after screenshots. Both versions use identical deterministic
 * UI-created fixtures; an absent disclosure on baseline is captured as such.
 * Images are evidence, not visual pass assertions. */
const OUT = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w11';
test.skip(process.env.VISUAL_AUDIT !== '1', 'W11 visual evidence is opt-in');
test.setTimeout(300_000);

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
}

async function openHub(page: Page): Promise<void> {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
}

async function switchTo(page: Page, name: 'Today' | 'Projects' | 'Goals'): Promise<void> {
  await planningHubTab(page, name).click();
  await page.waitForTimeout(350);
}

test('W11 planning hierarchy across widths, states and themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAll(page);
  await returnToApp(page);
  await openHub(page);
  await switchTo(page, 'Projects');
  await expect(page.getByText('No projects yet')).toBeVisible({ timeout: 20_000 });
  await shot(page, '390-projects-empty');

  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByPlaceholder('Project name').fill('Plan product launch');
  await shot(page, '390-project-create');
  const projectMore = page.getByRole('button', { name: 'Project more options' });
  if (await projectMore.isVisible().catch(() => false)) {
    await projectMore.click();
    await shot(page, '390-project-create-options');
  }
  await page.getByRole('button', { name: 'Create Project' }).click();
  await expect(page.getByRole('button', { name: /Plan product launch, Active/ })).toBeVisible();
  await shot(page, '390-projects-populated');
  await page.getByRole('button', { name: /Plan product launch, Active/ }).click();
  await shot(page, '390-project-detail');
  const options = page.getByRole('button', { name: 'Project more options' });
  if (await options.isVisible().catch(() => false)) {
    await options.click();
    await shot(page, '390-project-detail-options');
  }
  await page.getByRole('button', { name: 'Back to projects' }).click();

  await switchTo(page, 'Goals');
  await shot(page, '390-goals-empty');
  await page.getByRole('button', { name: 'Create goal' }).click();
  await page.getByPlaceholder('Goal title').fill('Run a first 5K');
  await page.getByRole('button', { name: '+10' }).click();
  await shot(page, '390-goal-create');
  const goalMore = page.getByRole('button', { name: 'Goal more options' });
  if (await goalMore.isVisible().catch(() => false)) {
    await goalMore.click();
    await shot(page, '390-goal-create-options');
  }
  await page.getByRole('button', { name: 'Create Goal' }).click();
  await expect(page.getByRole('button', { name: /Run a first 5K, Active/ })).toBeVisible();
  await shot(page, '390-goals-populated');
  await page.getByRole('button', { name: /Run a first 5K, Active/ }).click();
  await shot(page, '390-goal-detail');
  await page.getByRole('button', { name: 'Back to goals' }).click();

  await switchTo(page, 'Today');
  await shot(page, '390-today-plan');
  const morePlanning = page.getByRole('button', { name: 'More planning options' });
  if (await morePlanning.isVisible().catch(() => false)) {
    await morePlanning.click();
    await shot(page, '390-today-plan-options');
    await morePlanning.click();
  }

  const sizes = [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ];
  for (const vp of sizes) {
    await page.setViewportSize(vp);
    await switchTo(page, 'Projects');
    await shot(page, `${vp.width}-projects`);
    await switchTo(page, 'Goals');
    await shot(page, `${vp.width}-goals`);
    await switchTo(page, 'Today');
    await shot(page, `${vp.width}-today`);
  }

  await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openHub(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  for (const vp of sizes) {
    await page.setViewportSize(vp);
    await switchTo(page, 'Projects');
    await shot(page, `${vp.width}-dark-projects`);
    await switchTo(page, 'Goals');
    await shot(page, `${vp.width}-dark-goals`);
    await switchTo(page, 'Today');
    await shot(page, `${vp.width}-dark-today`);
  }
});
