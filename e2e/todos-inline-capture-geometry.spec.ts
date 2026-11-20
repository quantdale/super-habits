import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, sectionTab } from './helpers/navigation';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await goToTab(page, 'todos');
  await clearDatabase(page);
  await goToTab(page, 'todos');
});

test('inline task add glyph stays centred inside its web hit area', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((mode) => localStorage.setItem('superhabits.theme.mode', mode), theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await sectionTab(page, 'To Do').click();
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      // Exercise both the disabled empty draft and the enabled submit button.
      for (const title of ['', 'A centred add control']) {
        await page.getByRole('textbox', { name: 'Quick add task title' }).fill(title);
        const add = page.getByRole('button', { name: 'Add task', exact: true });
        await expect(add).toBeVisible();
        if (!title) {
          await expect(add).toBeDisabled();
          await expect(add).toHaveAttribute('tabindex', '-1');
        } else {
          await expect(add).toBeEnabled();
          await expect(add).toHaveAttribute('tabindex', '0');
        }
        const geometry = await add.evaluate((node) => {
          const box = node.getBoundingClientRect();
          const glyphRange = document.createRange();
          glyphRange.selectNodeContents(node.firstElementChild!);
          const glyph = glyphRange.getBoundingClientRect();
          return {
            width: box.width,
            height: box.height,
            dx: Math.abs(glyph.x + glyph.width / 2 - (box.x + box.width / 2)),
            dy: Math.abs(glyph.y + glyph.height / 2 - (box.y + box.height / 2)),
          };
        });
        const label = `${theme} ${width} ${title ? 'enabled' : 'disabled'}: ${JSON.stringify(geometry)}`;
        expect.soft(geometry.width, label).toBeGreaterThanOrEqual(44);
        expect.soft(geometry.height, label).toBeGreaterThanOrEqual(44);
        expect.soft(geometry.dx, label).toBeLessThanOrEqual(1);
        expect.soft(geometry.dy, label).toBeLessThanOrEqual(1);
        if (title && process.env.CX_UI_SHOTS) {
          await page.screenshot({ path: `${process.env.CX_UI_SHOTS}/add-${theme}-${width}.png` });
        }
      }
    }
  }
});
