import { test, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { resetAll } from './helpers/reset';
import { ensureAppContext, returnToApp } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';

/**
 * W10 rendered-truth instrument for the Calories / Health surfaces.
 *
 * Opt-in like the W7/W8/W9/W9.5 audits (`VISUAL_AUDIT=1`). It captures the
 * same named states before and after the W10 reconstruction so the evidence
 * directories can be compared one-to-one:
 *
 *   VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w10/before \
 *     npx playwright test e2e/calories-w10-audit.spec.ts
 *   VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w10 \
 *     npx playwright test e2e/calories-w10-audit.spec.ts
 *
 * Selectors are deliberately tolerant: the harness runs on the pre-W10 tree
 * (SYS-06 doc-copy, StatBlock trio, donut, flat swipe rows, three history
 * sections) and on the reconstructed tree (remaining-kcal hero, macro
 * summary, meal groups, history disclosure). Tolerant probes record which
 * variant they saw; screenshots are evidence, never assertions.
 */
const OUT = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w10';
test.skip(process.env.VISUAL_AUDIT !== '1', 'Opt-in rendered audit; run with VISUAL_AUDIT=1');
test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

type Seed = {
  name: string;
  p: number;
  c: number;
  f: number;
  fi: number;
  meal: string;
  kcal: number;
};

const DAY: Seed[] = [
  { name: 'Oatmeal with berries', p: 10, c: 54, f: 6, fi: 8, meal: 'breakfast', kcal: 294 },
  { name: 'Greek yogurt', p: 15, c: 12, f: 4, fi: 0, meal: 'breakfast', kcal: 136 },
  { name: 'Chicken breast salad', p: 45, c: 20, f: 14, fi: 5, meal: 'lunch', kcal: 402 },
  { name: 'Salmon rice bowl', p: 40, c: 62, f: 20, fi: 6, meal: 'dinner', kcal: 604 },
  { name: 'Almonds', p: 6, c: 6, f: 16, fi: 4, meal: 'snack', kcal: 192 },
];

const SAVED_MEALS: { name: string; kcal: number; p: number; c: number; f: number; fi: number }[] = [
  { name: 'Oatmeal with berries', kcal: 294, p: 10, c: 54, f: 6, fi: 8 },
  { name: 'Chicken breast salad', kcal: 402, p: 45, c: 20, f: 14, fi: 5 },
  { name: 'Salmon rice bowl', kcal: 604, p: 40, c: 62, f: 20, fi: 6 },
  { name: 'Greek yogurt', kcal: 136, p: 15, c: 12, f: 4, fi: 0 },
  {
    name: 'Grilled chicken and quinoa power bowl with avocado',
    kcal: 511,
    p: 42,
    c: 48,
    f: 16,
    fi: 9,
  },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoAtLocal(key: string, hour: number, minute = 0): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
}

/** Seed a realistic logging day (or an over-goal day) directly through SQL. */
async function seedDay(page: Page, opts: { over: boolean }) {
  await resetAll(page);
  await ensureAppContext(page);
  const key = todayKey();
  const rows = [...DAY];
  if (opts.over) {
    rows.push({
      name: 'Chocolate cake slice',
      p: 5,
      c: 70,
      f: 24,
      fi: 2,
      meal: 'snack',
      kcal: 546,
    });
  }
  const entryRows = rows
    .map(
      (row, i) =>
        `('cal_w10_${i}','${row.name.replace(/'/g, "''")}',${row.kcal},${row.p},${row.c},${row.f},${row.fi},'${row.meal}','${key}','${isoAtLocal(key, 8 + i)}','${isoAtLocal(key, 8 + i)}',null)`,
    )
    .join(',\n');
  const mealRows = SAVED_MEALS.map(
    (meal, i) =>
      `('smeal_w10_${i}','${meal.name.replace(/'/g, "''")}',${meal.kcal},${meal.p},${meal.c},${meal.f},${meal.fi},'lunch',${3 + i},'${isoAtLocal(key, 7 + i)}','${isoAtLocal(key, 7 + i)}')`,
  ).join(',\n');
  await seedSql(
    page,
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('calorie_goal', '{"calories":2000,"protein":150,"carbs":200,"fats":65}');
     INSERT INTO calorie_entries (id,food_name,calories,protein,carbs,fats,fiber,meal_type,consumed_on,created_at,updated_at,deleted_at) VALUES
     ${entryRows};
     INSERT INTO saved_meals (id,food_name,calories,protein,carbs,fats,fiber,meal_type,use_count,last_used_at,created_at) VALUES
     ${mealRows};`,
  );
  await returnToApp(page);
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
}

/** Click the first control whose accessible name matches one of `names`. */
async function clickAny(page: Page, names: string[]): Promise<string | null> {
  for (const name of names) {
    const locator = page.getByRole('button', { name, exact: true }).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ force: true }).catch(() => undefined);
      return name;
    }
  }
  return null;
}

async function caloriesSection(page: Page) {
  await goToTab(page, 'calories');
  await page.waitForTimeout(900);
}

test.describe('W10 Calories rendered surfaces', () => {
  test('form mode: populated, empty, over goal, dark, and widths', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await seedDay(page, { over: false });
    await caloriesSection(page);
    await shot(page, '390-calories-form-populated');

    await seedDay(page, { over: true });
    await caloriesSection(page);
    await shot(page, '390-calories-form-over-goal');

    // Empty device: one sentence + one action on the day log.
    await resetAll(page);
    await returnToApp(page);
    await caloriesSection(page);
    await shot(page, '390-calories-form-empty');

    await seedDay(page, { over: false });
    // Set the theme AFTER the reset/seed: resetAll wipes every superhabits.*
    // localStorage key, so a pre-set theme would be erased before boot.
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await caloriesSection(page);
    await shot(page, '390-dark-calories-form');
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'light'));

    await page.setViewportSize({ width: 360, height: 800 });
    await caloriesSection(page);
    await shot(page, '360-calories-form');

    await page.setViewportSize({ width: 412, height: 915 });
    await caloriesSection(page);
    await shot(page, '412-calories-form');

    await page.setViewportSize({ width: 768, height: 1024 });
    await caloriesSection(page);
    await shot(page, '768-calories-form');

    await page.setViewportSize({ width: 1280, height: 800 });
    await caloriesSection(page);
    await shot(page, '1280-calories-form');
  });

  test('diary mode: populated, empty, dark', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedDay(page, { over: false });
    await caloriesSection(page);
    await page.evaluate(() => {
      window.localStorage.setItem('superhabits.calories.viewMode', 'diary');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await caloriesSection(page);
    await shot(page, '390-calories-diary-populated');

    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await caloriesSection(page);
    await shot(page, '390-dark-calories-diary');
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'light'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await caloriesSection(page);

    // Empty device: resetAll wipes the view-mode preference too, so re-assert
    // the diary mode before capturing the empty diary state.
    await resetAll(page);
    await page.evaluate(() => {
      window.localStorage.setItem('superhabits.calories.viewMode', 'diary');
    });
    await returnToApp(page);
    await caloriesSection(page);
    await shot(page, '390-calories-diary-empty');
  });

  test('entry flows: manual add, saved-meal search, macro targets, history, keyboard', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedDay(page, { over: false });
    await caloriesSection(page);

    // Manual add / edit entry modal (diary mode's primary, form mode inline).
    await page.evaluate(() => {
      window.localStorage.setItem('superhabits.calories.viewMode', 'diary');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await caloriesSection(page);
    const manualAdd = await clickAny(page, ['Manual add', 'Add entry']);
    if (manualAdd) {
      await page.waitForTimeout(500);
      await shot(page, '390-calories-manual-add');
      await page.keyboard.press('Escape').catch(() => undefined);
      await clickAny(page, ['Close']);
    }

    // Saved-meal search modal.
    const browse = await clickAny(page, ['Browse saved meals', 'Browse saved']);
    if (browse) {
      await page.waitForTimeout(500);
      await shot(page, '390-calories-saved-meal-search');
      const search = page.getByRole('textbox', { name: /Search saved meals/i }).first();
      if (await search.isVisible().catch(() => false)) {
        await search.fill('chicken');
        await page.waitForTimeout(400);
        await shot(page, '390-calories-saved-meal-search-query');
      }
      await page.keyboard.press('Escape').catch(() => undefined);
      await clickAny(page, ['Close']);
    }

    // Macro targets modal.
    const targets = await clickAny(page, ['Edit daily macro targets', 'Edit targets']);
    if (targets) {
      await page.waitForTimeout(500);
      await shot(page, '390-calories-targets-modal');
      await page.keyboard.press('Escape').catch(() => undefined);
      await clickAny(page, ['Close']);
    }

    // History: collapsed disclosure (post-W10) or always-visible sections
    // (pre-W10). Capture the trend/heatmap region either way.
    const disclosure = page.getByRole('button', { name: 'History and insights' }).first();
    if (await disclosure.isVisible().catch(() => false)) {
      await disclosure.click({ force: true });
      await page.waitForTimeout(700);
    } else {
      const historyCard = page.getByText('Calories history', { exact: true }).first();
      await historyCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(500);
    }
    await shot(page, '390-calories-history');

    // Keyboard interaction on the manual form.
    await clickAny(page, ['Manual add', 'Add entry']);
    const foodField = page.getByRole('textbox', { name: /food/i }).first();
    if (await foodField.isVisible().catch(() => false)) {
      await foodField.click({ force: true });
      await page.waitForTimeout(400);
      await shot(page, '390-calories-keyboard');
    }
    await page.keyboard.press('Escape').catch(() => undefined);
    await clickAny(page, ['Close']);
  });
});
