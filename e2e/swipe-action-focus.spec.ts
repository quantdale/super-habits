import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, sectionTab } from './helpers/navigation';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await goToTab(page, 'todos');
  await clearDatabase(page);
  await goToTab(page, 'todos');
});

test('revealed swipe actions keep the whole keyboard outline inside the row clip', async ({
  page,
}) => {
  await page.getByRole('textbox', { name: 'Quick add task title' }).fill('Focus ring review');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByText('Focus ring review', { exact: true })).toBeVisible();

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((mode) => localStorage.setItem('superhabits.theme.mode', mode), theme);
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await sectionTab(page, 'To Do').click();
      await expect(page.getByRole('button', { name: 'Edit item' })).toHaveCount(0);
      const row = page.getByRole('button', { name: 'Edit task: Focus ring review', exact: true });
      await row.scrollIntoViewIfNeeded();
      const box = (await row.boundingBox())!;
      // Browser-generated touch events keep the original gesture target. The
      // legacy synthetic helper retargets moves and can leave the row closed.
      const touch = await page.context().newCDPSession(page);
      const y = box.y + box.height / 2;
      const start = box.x + box.width - 24;
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: start, y }],
      });
      for (let i = 1; i <= 20; i++) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: start - i * 10, y }],
        });
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
      for (const name of ['Edit item', 'Delete item']) {
        const action = page.getByRole('button', { name, exact: true });
        await expect(action).toBeVisible();
        await expect(action).toHaveAttribute('tabindex', '0');
        await page.keyboard.press('Tab');
        await action.focus();
        await expect(action).toBeFocused();
        await expect
          .poll(() => action.evaluate((node) => getComputedStyle(node).outlineStyle))
          .toBe('solid');
        const ring = await action.evaluate((node) => {
          const style = getComputedStyle(node);
          const b = node.getBoundingClientRect();
          const thickness = Number.parseFloat(style.outlineWidth);
          const outside = Math.max(0, Number.parseFloat(style.outlineOffset) + thickness);
          const clipped: string[] = [];
          for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const s = getComputedStyle(parent);
            const p = parent.getBoundingClientRect();
            if (
              /hidden|clip/.test(s.overflowX) &&
              (b.left - outside < p.left - 1 || b.right + outside > p.right + 1)
            )
              clipped.push('horizontal');
            if (
              /hidden|clip/.test(s.overflowY) &&
              (b.top - outside < p.top - 1 || b.bottom + outside > p.bottom + 1)
            )
              clipped.push('vertical');
          }
          return { thickness, outside, clipped };
        });
        if (process.env.CX_UI_SHOTS) {
          await page.screenshot({
            path: `${process.env.CX_UI_SHOTS}/swipe-${theme}-${width}-${name.replace(' ', '-')}.png`,
          });
        }
        expect.soft(ring.thickness, `${theme} ${width} ${name}`).toBeGreaterThanOrEqual(2);
        expect.soft(ring.clipped, `${theme} ${width} ${name}: ${JSON.stringify(ring)}`).toEqual([]);
      }
    }
  }
});
