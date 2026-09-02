/* Temporary WM2.2 a11y focus-order probe (not committed).
 * Verifies whether keyboard focus lands inside hidden (aria-hidden,
 * opacity:0) inactive sections on web, and captures the top-level tab
 * order so the campaign has evidence for the a11y re-audit.
 */
import { chromium } from '@playwright/test';

const PORT = Number(process.env.PROBE_PORT ?? 8096);
const url = `http://localhost:${PORT}/`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByText('Today', { exact: true }).first().waitFor({ state: 'visible', timeout: 60000 });

  const hiddenFocus = [];
  const tabOrder = [];
  // Press Tab up to 30 times from the body and record each focused element.
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60);
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const hidden =
        style.opacity === '0' ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        rect.width === 0 ||
        rect.height === 0;
      const ancestorHidden = el.closest('[aria-hidden="true"]') !== null;
      return { label, hidden, ancestorHidden, role: el.getAttribute('role') };
    });
    if (!info) continue;
    tabOrder.push(info);
    if (info.hidden || info.ancestorHidden) hiddenFocus.push(info);
  }

  console.log('TAB_ORDER:');
  tabOrder.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.role ?? '(none)'} "${entry.label}" hidden=${entry.hidden} ariaHiddenAncestor=${entry.ancestorHidden}`);
  });
  console.log(`\nHIDDEN_FOCUS_COUNT=${hiddenFocus.length}`);
  if (hiddenFocus.length > 0) {
    console.log('HIDDEN_FOCUS_TARGETS:');
    hiddenFocus.forEach((entry) => console.log(`  - ${entry.role} "${entry.label}"`));
  }
  await browser.close();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });