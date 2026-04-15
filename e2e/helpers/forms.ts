import { type Page } from "@playwright/test";

function inputAfterLabel(page: Page, label: string) {
  return page
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::*[contains(@class,'mb-3')][1]//input")
    .first();
}

/**
 * Fill a calorie-entry TextField by its nativeID (becomes id= on web).
 * After the hydration fix in goToTab the inputs are React-controlled, so
 * force:true fills now fire onChange correctly. Using #id (direct CSS selector)
 * rather than getByLabel saves ~250ms per fill — critical for the 20-entry
 * boundary test (100 fill operations, 120 s budget).
 */
async function fillById(page: Page, id: string, value: string) {
  await page.locator(`#${id}`).fill(value, { force: true });
}

export async function fillCalorieMacrosOnly(
  page: Page,
  protein: string,
  carbs: string,
  fats: string,
  fiber: string,
) {
  await fillById(page, "cal-entry-protein", protein);
  await fillById(page, "cal-entry-carbs", carbs);
  await fillById(page, "cal-entry-fat", fats);
  await fillById(page, "cal-entry-fiber", fiber);
}

/**
 * Clicks the calories "Add entry" primary button.
 * RN Web exposes the submit Pressable as a generic clickable node, not a semantic button.
 * The header title matches the same copy, so target the last exact text match.
 */
export async function clickCaloriesAddEntry(page: Page) {
  await page.getByText("Add entry", { exact: true }).last().click({
    force: true,
    timeout: 30_000,
  });
}

export async function fillCaloriesMacros(
  page: Page,
  food: string,
  protein: string,
  carbs: string,
  fats: string,
  fiber: string,
) {
  await fillById(page, "cal-entry-protein", protein);
  await fillById(page, "cal-entry-carbs", carbs);
  await fillById(page, "cal-entry-fat", fats);
  await fillById(page, "cal-entry-fiber", fiber);
  await fillById(page, "cal-entry-food", food);
}

/**
 * RN Web TextField DOM: label div + input under a shared wrapper; avoid global input.nth
 * so hidden/offscreen tab inputs do not steal indices.
 */
export async function fillRoutineName(page: Page, name: string) {
  const input = inputAfterLabel(page, "Routine name");
  await input.click();
  await input.fill("");
  await input.type(name, { delay: 15 });
}
