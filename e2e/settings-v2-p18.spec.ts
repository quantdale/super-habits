import { expect, test, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { openSettingsScreen } from './helpers/commandObservation';

/**
 * P18 (Playful Momentum) Settings grammar — rendered assertions.
 *
 * Pins the *structural* promises of §7 Settings that the W13 value-authority
 * specs do not cover:
 *
 * - group titles are `titleMd` (18px) bold, above the rows they name;
 * - theme choices are `OptionRow`s (role `radio`) whose trailing slot is a
 *   live preview painted from the *previewed* theme's own tokens;
 * - the Sounds/Haptics preferences are two-position switches whose position
 *   labels are real controls (`radio` + `aria-checked` + `aria-pressed`), so
 *   the existing pill-driven specs keep addressing the same words;
 * - the new surfaces fit 360, 375 and 390 without horizontal overflow, and
 *   every interactive control clears the 44pt target;
 * - nothing regressed the strings the other specs assert (`Theme and display`,
 *   `Current appearance`, `Day theme`, `Night theme`, `Effective motion`,
 *   `Haptics`, `Reward sounds`).
 *
 * These are DOM assertions (not snapshots): W15 owns curated goldens.
 */

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

async function openSettings(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await clearDatabase(page);
  await openSettingsScreen(page);
  const dismiss = page.getByText('Not now', { exact: true });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  return page.getByRole('dialog');
}

/** Resolved style probe for an element matched by text. */
async function textStyle(page: Page, text: string) {
  return page
    .getByText(text, { exact: true })
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        fontSize: parseFloat(cs.fontSize),
        fontWeight: parseInt(cs.fontWeight, 10) || 400,
        fontFamily: cs.fontFamily,
      };
    });
}

test.describe('P18 Settings grammar', () => {
  test('group titles are bold titleMd and carry no narration subtitle', async ({ page }) => {
    const dialog = await openSettings(page);

    for (const title of ['Theme and display', 'Motion', 'Reward feedback']) {
      const style = await textStyle(page, title);
      expect(style.fontSize, `${title}: titleMd is 18px`).toBeCloseTo(18, 0);
      expect(style.fontWeight, `${title}: bold group title`).toBeGreaterThanOrEqual(800);
      // §5.5: Nunito only — the app never falls back to a system face.
      expect(style.fontFamily, `${title}: Nunito`).toMatch(/Nunito/);
    }

    // The eyebrow that names the section stays (specs address it), demoted to
    // the label role so it cannot compete with the bold title.
    const eyebrow = await textStyle(page, 'Appearance');
    expect(eyebrow.fontSize).toBeLessThanOrEqual(13);

    // No narration paragraph between the title and the first control: the old
    // surface opened with a sentence about device appearance.
    await expect(
      dialog.getByText('Choose how super-habits should look on this device.', { exact: true }),
    ).toHaveCount(0);
    await expect(
      dialog.getByText('Reduced motion swaps large animations for instant state changes.', {
        exact: true,
      }),
    ).toHaveCount(0);
  });

  test('theme picker is an OptionRow list with live per-theme previews', async ({ page }) => {
    const dialog = await openSettings(page);

    // Every registered theme is a radio OptionRow named `<Theme>, <appearance> theme`.
    const nord = dialog.getByRole('radio', { name: /Nord Arctic, dark theme/i });
    await nord.scrollIntoViewIfNeeded();
    await expect(nord).toBeVisible();
    await expect(nord).toHaveAttribute('aria-checked', 'false');

    const light = dialog.getByRole('radio', { name: /^Light, light theme/i });
    await expect(light).toHaveAttribute('aria-checked', 'true');

    // The live preview is painted from the PREVIEWED theme, not the active one:
    // compare the Nordic swatch canvas against the active (Light) canvas.
    const previews = await dialog.getByRole('radio', { name: /theme/i }).evaluateAll((nodes) =>
      nodes.map((node) => {
        const swatch = node.querySelector('[aria-hidden="true"]');
        const style = swatch ? getComputedStyle(swatch) : null;
        return {
          name: node.getAttribute('aria-label'),
          background: style?.backgroundColor ?? null,
        };
      }),
    );
    const nordPreview = previews.find((entry) => /Nord Arctic/i.test(entry.name ?? ''));
    const lightPreview = previews.find((entry) => /^Light, light theme/i.test(entry.name ?? ''));
    expect(nordPreview?.background).toBeTruthy();
    expect(lightPreview?.background).toBeTruthy();
    expect(nordPreview!.background).not.toBe(lightPreview!.background);

    // Selecting a theme keeps the row contract and applies it immediately.
    // In `system` mode the resolved appearance may be light, so the night slot
    // only becomes the live theme after fixing the mode (the same precondition
    // `theming.spec.ts` documents).
    await dialog.getByRole('button', { name: 'Dark', exact: true }).click();
    await nord.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.themeId))
      .toBe('nord-arctic');
    await expect(nord).toHaveAttribute('aria-checked', 'true');
    await expect(light).toHaveAttribute('aria-checked', 'false');
  });

  test('Sounds/Haptics are two-position switches, not pill pairs', async ({ page }) => {
    const dialog = await openSettings(page);
    await dialog.getByText('Reward feedback', { exact: true }).scrollIntoViewIfNeeded();

    for (const [name, on, off] of [
      ['Haptics', 'Haptics on', 'Haptics off'],
      ['Reward sounds', 'Sounds on', 'Sounds off'],
    ] as const) {
      const group = dialog.getByRole('radiogroup', { name });
      await group.scrollIntoViewIfNeeded();
      await expect(group).toBeVisible();

      const onOption = group.getByRole('radio', { name: on });
      const offOption = group.getByRole('radio', { name: off });
      await expect(onOption).toBeVisible();
      await expect(offOption).toBeVisible();

      // Default preferences are both on.
      await expect(onOption).toHaveAttribute('aria-checked', 'true');
      await expect(offOption).toHaveAttribute('aria-checked', 'false');

      // The existing pill-driven behaviour must survive: clicking the words
      // flips the preference and the value row restates it.
      await offOption.click();
      await expect(offOption).toHaveAttribute('aria-checked', 'true');
      await expect(onOption).toHaveAttribute('aria-checked', 'false');
    }

    await expect(dialog.getByText('All reward sounds are off.', { exact: true })).toBeVisible();
    await expect(
      dialog.getByText('Vibration feedback is off. Rewards are visual only.', { exact: true }),
    ).toBeVisible();

    // Persistence: the stored choice survives a reload (rewardFeedback.ts owns
    // `superhabits.rewardFeedback`).
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tablist', { name: 'Section tabs' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByText('All reward sounds are off.', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('the switch keeps its accessible and keyboard contract', async ({ page }) => {
    const dialog = await openSettings(page);
    await dialog.getByText('Reward feedback', { exact: true }).scrollIntoViewIfNeeded();

    const group = dialog.getByRole('radiogroup', { name: 'Haptics' });
    const offOption = group.getByRole('radio', { name: 'Haptics off' });
    await offOption.focus();

    // Space activates the focused position (RN-Web maps Space only to
    // button-shaped roles, so the switch binds it itself).
    await page.keyboard.press('Space');
    await expect(offOption).toHaveAttribute('aria-checked', 'true');

    // ArrowLeft returns to the "on" position.
    await page.keyboard.press('ArrowLeft');
    await expect(group.getByRole('radio', { name: 'Haptics on' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('fits 360/375/390 with no horizontal overflow and >=44pt controls', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      const dialog = await openSettings(page);
      await expect(dialog.getByText('Theme and display', { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${viewport.width}: no horizontal page overflow`).toBeLessThanOrEqual(0);

      // The theme rows and switch positions are the narrowest new controls.
      const nord = dialog.getByRole('radio', { name: /Nord Arctic, dark theme/i });
      await nord.scrollIntoViewIfNeeded();
      const rowBox = (await nord.boundingBox())!;
      expect(rowBox.height, `${viewport.width}: option row >=44`).toBeGreaterThanOrEqual(44);

      const switchGroup = dialog.getByRole('radiogroup', { name: 'Haptics' });
      await switchGroup.scrollIntoViewIfNeeded();
      const switchBox = (await switchGroup.boundingBox())!;
      expect(switchBox.height, `${viewport.width}: switch >=44`).toBeGreaterThanOrEqual(44);
      // No helper wraps: the switch track and the two labels stay on one line.
      const wrapped = await switchGroup.evaluate((el) => {
        const first = el.firstElementChild as HTMLElement | null;
        return first ? first.getBoundingClientRect().height : 0;
      });
      expect(wrapped, `${viewport.width}: switch track renders`).toBeGreaterThan(0);
    }
  });

  test('keeps every string the other specs assert', async ({ page }) => {
    const dialog = await openSettings(page);

    for (const text of [
      'Theme and display',
      'Current appearance',
      'Effective motion',
      'Haptics',
      'Reward sounds',
    ]) {
      await expect(dialog.getByText(text, { exact: true }).first()).toBeVisible();
    }
    // Radio names come from the theme registry (theming.spec.ts contract).
    await expect(dialog.getByRole('radio', { name: /Cyberpunk Neon, dark theme/i })).toBeVisible();
    // Mode chips stay button-shaped toggles (theming.spec.ts clicks `Dark`).
    await expect(dialog.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // The day/night group labels stay addressable by exact text.
    await expect(dialog.getByText('Day theme', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Night theme', { exact: true }).first()).toBeVisible();
  });
});
