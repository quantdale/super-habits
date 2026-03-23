import { Page } from "@playwright/test";

function inputAfterLabel(page: Page, label: string) {
  return page
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'mb-3')][1]//input")
    .first();
}

/** Macro labels also exist on `CalorieGoalSheet` (Modal); scope to the entry card that contains the food field. */
function inputAfterLabelInCalorieEntryForm(page: Page, label: string) {
  const foodInput = page.getByPlaceholder("Greek yogurt");
  const entryCard = foodInput.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  return entryCard
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'mb-3')][1]//input")
    .first();
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

export async function fillCaloriesMacros(
  page: Page,
  food: string,
  protein: string,
  carbs: string,
  fats: string,
  fiber: string,
) {
  const foodInput = page.getByPlaceholder("Greek yogurt");
  await foodInput.click();
  await foodInput.fill("");
  await foodInput.fill(food);
  await inputAfterLabelInCalorieEntryForm(page, "Protein (g)").fill(protein);
  await inputAfterLabelInCalorieEntryForm(page, "Carbs (g)").fill(carbs);
  await inputAfterLabelInCalorieEntryForm(page, "Fats (g)").fill(fats);
  await inputAfterLabelInCalorieEntryForm(page, "Fiber (g)").fill(fiber);
}
