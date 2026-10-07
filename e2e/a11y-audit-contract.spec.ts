import { test, expect, type Page } from '@playwright/test';
import { auditPage } from './helpers/a11yAudit';

/** The shared Button paints its solid face with a full-size absolute sibling.
 * Audit the painted face in both directions: no false positive on a readable
 * face, and no false negative when the face itself has insufficient contrast.
 */
async function buttonFixture(page: Page, canvas: string, face: string) {
  await page.setContent(`
    <body style="background:${canvas}">
      <button style="position:relative;background:transparent;padding:12px;border:0">
        <div style="position:absolute;inset:0;background:${face}"></div>
        <span style="position:relative;color:white;font:16px Arial">Painted action</span>
      </button>
    </body>
  `);
  return page.evaluate(auditPage);
}

test('solid sibling face is measured instead of the white canvas', async ({ page }) => {
  const result = await buttonFixture(page, 'white', '#1d4ed8');
  expect(result.contrast).toEqual([]);
  expect(result.nameless).toEqual([]);
});

test('a low-contrast solid face still fails even over a contrasting canvas', async ({ page }) => {
  const result = await buttonFixture(page, 'black', 'white');
  expect(result.contrast).toHaveLength(1);
  expect(result.contrast[0]).toContain('Painted action 1.00:1 (needs 4.5)');
});
