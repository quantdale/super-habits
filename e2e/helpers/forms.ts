import { Page } from "@playwright/test";

function inputAfterLabel(page: Page, label: string) {
  return page
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
  const foodInput = page.getByText("Food", { exact: true }).locator("..").locator("input").first();
  await foodInput.click();
  await foodInput.fill("");
  await foodInput.type(food, { delay: 15 });
  await inputAfterLabel(page, "Protein (g)").fill(protein);
  await inputAfterLabel(page, "Carbs (g)").fill(carbs);
  await inputAfterLabel(page, "Fats (g)").fill(fats);
  await inputAfterLabel(page, "Fiber (g)").fill(fiber);
}
