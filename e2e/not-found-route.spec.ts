import { test, expect } from './fixtures';
import { sectionRail } from './helpers/navigation';

/**
 * Regression guard for React hydration error #418 on unmatched URLs.
 *
 * `app.json` exports with `web.output: "static"`, so an unknown path is served
 * from the prerendered not-found document (and deep links are served `/`'s
 * markup by the rewrite in production). Both only match the client when the
 * not-found route renders the same first tree — `app/+not-found.tsx` redirects
 * to `/` instead of letting expo-router's client-only Unmatched view hydrate
 * into a server-empty root.
 */
test('an unknown URL hydrates cleanly and lands in the app', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/some-unknown-path', { waitUntil: 'domcontentloaded' });

  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe('/');
  await expect(sectionRail(page)).toBeVisible();
  await expect(sectionRail(page).getByRole('tab')).toHaveCount(6);

  expect(pageErrors, `unknown URL produced page errors:\n${pageErrors.join('\n')}`).toEqual([]);
});
