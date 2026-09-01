import { expect, type Page } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { expectOutbox, expectRows, switchSection } from '../helpers/oracles';
import { ensureAppContext, returnToApp } from '../helpers/dbHarness';

/**
 * J10 — "Settings ripple" (P3, Priya the Power User)
 *
 * Goal: a change made in the Settings drawer reaches the owning section and
 * survives a reload, across the app's two persistence stores:
 *   - calorie goal    → `app_meta.calorie_goal` (SQLite) → Calories section
 *   - pomodoro defaults → `app_meta.pomodoro_settings` (SQLite) → Focus section
 *   - theme           → AsyncStorage slots (`superhabits.theme.*`) → whole app
 * and the specific "settings changed while a Pomodoro timer is paused" case.
 *
 * Starting state: SMALL fixture (2 todos, 1 habit, 2 calorie entries, 1
 * pomodoro session) on a clean device (both stores cleared).
 *
 * Risks: R11 (settings → feature propagation across permanently-mounted
 * sections, two-persistence-store split).
 *
 * Every mutating step asserts persisted state (SQLite row or AsyncStorage
 * slot), not only rendered text, plus a negative oracle for what must not have
 * changed.
 */

// RN Web NumberStepperField: a label Text + <input> inside a `mb-3` wrapper.
// Reuse the established idiom from helpers/forms.ts (click + clear + type with
// delay so the controlled input fires onChange as the user types).
function stepperInput(page: Page, label: string) {
  return page
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::*[contains(@class,'mb-3')][1]//input")
    .first();
}

async function setNumberStepper(page: Page, label: string, value: string) {
  const input = stepperInput(page, label);
  await input.click();
  await input.fill('');
  await input.type(value, { delay: 15 });
}

async function dismissStartupRestorePromptIfPresent(page: Page) {
  const dismissButton = page.getByText('Not now', { exact: true });
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

/**
 * Switch to the Focus section. Once the Focus section is mounted it also
 * renders a 'Focus' mode PillChip, so the rail tab (first in DOM order) is
 * targeted explicitly to avoid a strict-mode collision in `switchSection`.
 */
async function goToFocus(page: Page) {
  await page.getByRole('button', { name: 'Focus', exact: true }).first().click();
}

function getThemeIdAttr(page: Page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme-id'));
}

function getCssVar(page: Page, name: string) {
  return page.evaluate(
    (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim(),
    name,
  );
}

async function readThemeSlots(page: Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('superhabits.theme.slots.v2');
    return raw ? (JSON.parse(raw) as { lightThemeId?: string; darkThemeId?: string }) : {};
  });
}

defineJourney({
  persona: 'P3 — Priya, the Power User',
  goal: 'settings changes ripple to their sections and survive a reload',
  fixture: 'SMALL',
  risks: ['R11'],
  steps: [
    {
      name: 'reset and seed SMALL, then confirm the seeded baseline rows exist',
      run: async ({ page }) => {
        // The declaration's `fixture: 'SMALL'` already reset + seeded. Assert
        // the seeded rows are reachable (row-level oracle) before any change.
        await ensureAppContext(page);
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL',
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(2);
          },
        );
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) => {
          expect(Number(rows[0]?.n ?? 0)).toBe(1);
        });
        await returnToApp(page);
        await dismissStartupRestorePromptIfPresent(page);
        // The overview shell is the entry point to the settings launcher.
        await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
      },
    },
    {
      name: 'change the daily calorie goal in Settings; it reaches Calories and survives reload',
      run: async ({ page }) => {
        // --- Change the goal in Settings (default 2000 kcal). ---
        await ensureAppContext(page);
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(
          page.getByText('Daily calorie and macro goals', { exact: true }),
        ).toBeVisible();
        await page
          .getByText('Daily calorie and macro goals', { exact: true })
          .scrollIntoViewIfNeeded();
        // Wait for the async load of the saved goal before editing (otherwise the
        // load could overwrite the typed value).
        await expect(
          page.getByText('2000 kcal, 150g protein, 200g carbs, 65g fats.', { exact: true }),
        ).toBeVisible({ timeout: 15_000 });
        await setNumberStepper(page, 'Calories (kcal)', '2400');
        await page.getByRole('button', { name: 'Save nutrition defaults' }).click();
        await expect(
          page.getByText('2400 kcal, 150g protein, 200g carbs, 65g fats.', { exact: true }),
        ).toBeVisible({ timeout: 15_000 });

        // Close the drawer.
        await page.getByRole('button', { name: 'Close settings' }).click();
        await expect(page.getByText('Theme and display', { exact: true })).toHaveCount(0);

        // --- Ripple: the Calories section shows the new goal. ---
        await switchSection(page, 'calories');
        await expect(page.getByText(/Goal: 2400 kcal/).first()).toBeVisible({ timeout: 15_000 });
        // With the default 2000 kcal goal the remaining would read 2000; the
        // new goal must drive the progress display.
        await expect(page.getByText('2400 kcal remaining')).toBeVisible();
        await expect(page.getByText('2000 kcal remaining')).toHaveCount(0);

        // --- Persisted row (app_meta.calorie_goal). ---
        await expectRows(page, "SELECT value FROM app_meta WHERE key = 'calorie_goal'", (rows) => {
          expect(rows).toHaveLength(1);
          expect(JSON.parse(String(rows[0]?.value))).toEqual({
            calories: 2400,
            protein: 150,
            carbs: 200,
            fats: 65,
          });
        });

        // --- Survives a reload. ---
        await returnToApp(page);
        await switchSection(page, 'calories');
        await expect(page.getByText(/Goal: 2400 kcal/).first()).toBeVisible({ timeout: 15_000 });

        // --- Negative oracle: no calorie rows were created by the settings change. ---
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL',
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(2);
          },
        );
      },
    },
    {
      name: 'change Pomodoro defaults in Settings; the Focus section shows the new duration and keeps it after reload',
      run: async ({ page }) => {
        // --- Change the focus duration in Settings (default 25 min). ---
        await ensureAppContext(page);
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText('Focus defaults', { exact: true })).toBeVisible();
        await page.getByText('Focus defaults', { exact: true }).scrollIntoViewIfNeeded();
        await expect(
          page.getByText(
            '25m focus, 5m short break, 15m long break, long break every 4 focus sessions.',
            { exact: true },
          ),
        ).toBeVisible({ timeout: 15_000 });
        await setNumberStepper(page, 'Focus minutes', '35');
        await page.getByRole('button', { name: 'Save timer defaults' }).click();
        await expect(
          page.getByText(
            '35m focus, 5m short break, 15m long break, long break every 4 focus sessions.',
            { exact: true },
          ),
        ).toBeVisible({ timeout: 15_000 });

        await page.getByRole('button', { name: 'Close settings' }).click();
        await expect(page.getByText('Theme and display', { exact: true })).toHaveCount(0);

        // --- Ripple: the Focus section (first activation) shows the new duration. ---
        await switchSection(page, 'pomodoro');
        await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).toHaveText('35:00', {
          timeout: 15_000,
        });

        // --- Persisted row (app_meta.pomodoro_settings). ---
        await expectRows(
          page,
          "SELECT value FROM app_meta WHERE key = 'pomodoro_settings'",
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(JSON.parse(String(rows[0]?.value))).toEqual({
              focusMinutes: 35,
              shortBreakMinutes: 5,
              longBreakMinutes: 15,
              sessionsBeforeLongBreak: 4,
            });
          },
        );

        // --- Survives a reload. ---
        await returnToApp(page);
        await switchSection(page, 'pomodoro');
        await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).toHaveText('35:00', {
          timeout: 15_000,
        });
      },
    },
    {
      name: 'change the theme in Settings; the AsyncStorage slot and a reload keep it',
      run: async ({ page }) => {
        // --- Change the theme: fix to Dark mode, then pick a night theme. ---
        await ensureAppContext(page);
        // The settings launcher lives in the Overview header.
        await switchSection(page, 'overview');
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText('Theme and display', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Dark', exact: true }).click();
        await page.getByText('Night theme', { exact: true }).scrollIntoViewIfNeeded();
        await page.getByRole('radio', { name: /Nord Arctic, dark theme/i }).click();
        await expect.poll(() => getThemeIdAttr(page)).toBe('nord-arctic');

        // The theme is applied to the whole app while the drawer is open.
        await page.getByRole('button', { name: 'Close settings' }).click();
        await expect(page.getByText('Theme and display', { exact: true })).toHaveCount(0);
        await expect.poll(() => getThemeIdAttr(page)).toBe('nord-arctic');

        // --- AsyncStorage-backed slot (not just the current render). ---
        const slots = await readThemeSlots(page);
        expect(slots.darkThemeId).toBe('nord-arctic');
        const themeMode = await page.evaluate(() =>
          window.localStorage.getItem('superhabits.theme.mode'),
        );
        expect(themeMode).toBe('dark');

        // --- Survives a reload: attribute + live CSS token. ---
        await returnToApp(page);
        await expect.poll(() => getThemeIdAttr(page)).toBe('nord-arctic');
        await expect.poll(() => getCssVar(page, '--sh-background')).toBe('#2e3440');
      },
    },
    {
      name: 'change Pomodoro defaults while a timer is paused: the paused session is untouched and no session is logged',
      run: async ({ page }) => {
        // The Focus section shows the default saved earlier (35 min).
        await ensureAppContext(page);
        await goToFocus(page);
        await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).toHaveText('35:00', {
          timeout: 15_000,
        });

        // Start a focus session, let it tick, then pause it.
        await page.getByText('Start focus', { exact: true }).click();
        await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).not.toHaveText('35:00', {
          timeout: 5_000,
        });
        await page.getByText('Pause', { exact: true }).click();
        await expect(page.getByText('Resume', { exact: true })).toBeVisible();
        const timerText = page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/);
        const pausedText = (await timerText.textContent()) ?? '';
        expect(pausedText).toMatch(/^\d{2}:\d{2}$/);

        // Change the focus duration while the timer is paused.
        await switchSection(page, 'overview');
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText('Focus defaults', { exact: true })).toBeVisible();
        await page.getByText('Focus defaults', { exact: true }).scrollIntoViewIfNeeded();
        await expect(
          page.getByText(
            '35m focus, 5m short break, 15m long break, long break every 4 focus sessions.',
            { exact: true },
          ),
        ).toBeVisible({ timeout: 15_000 });
        await setNumberStepper(page, 'Focus minutes', '40');
        await page.getByRole('button', { name: 'Save timer defaults' }).click();
        await expect(
          page.getByText(
            '40m focus, 5m short break, 15m long break, long break every 4 focus sessions.',
            { exact: true },
          ),
        ).toBeVisible({ timeout: 15_000 });
        await page.getByRole('button', { name: 'Close settings' }).click();
        await expect(page.getByText('Theme and display', { exact: true })).toHaveCount(0);

        // The paused session is untouched: still paused, same remaining time.
        await goToFocus(page);
        await expect(page.getByText('Resume', { exact: true })).toBeVisible();
        await expect(timerText).toHaveText(pausedText);

        // Resume continues from the same remaining time.
        await page.getByText('Resume', { exact: true }).click();
        await expect(page.getByText('Pause', { exact: true })).toBeVisible();
        await expect.poll(() => timerText.textContent(), { timeout: 5_000 }).not.toBe(pausedText);

        // End the session with Reset (no focus session completes). The control
        // is labelled "Reset (not logged)" — or "Abandon (not logged)" once a
        // focus session has ≥60s elapsed.
        await page.getByRole('button', { name: /^(?:Reset|Abandon) \(not logged\)$/ }).click();

        // Live-section contract: after the paused session is reset, the
        // already-mounted idle timer must use the newly saved default before
        // any reload.
        await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).toHaveText('40:00', {
          timeout: 15_000,
        });

        // The changed default is persisted and, after a reload, is what a fresh
        // Focus section shows.
        await expectRows(
          page,
          "SELECT value FROM app_meta WHERE key = 'pomodoro_settings'",
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(JSON.parse(String(rows[0]?.value))).toEqual({
              focusMinutes: 40,
              shortBreakMinutes: 5,
              longBreakMinutes: 15,
              sessionsBeforeLongBreak: 4,
            });
          },
        );
        // Negative oracles: no pomodoro session was logged (D11 — an interrupted
        // session is never logged), no calorie rows changed, and the settings
        // changes enqueued no sync records.
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) => {
          expect(Number(rows[0]?.n ?? 0)).toBe(1);
        });
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL',
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(2);
          },
        );
        // Backup Completeness V2: changing Pomodoro defaults enqueues the
        // allowlisted settings snapshot (coalesced to a single record) —
        // but never a pomodoro session row.
        await expectOutbox(page, (outbox) => {
          expect(outbox).toHaveLength(1);
          expect(outbox[0].entity).toBe('user_backup_settings');
          expect(outbox[0].id).toBe('settings');
          expect(outbox[0].operation).toBe('update');
        });

        // Survives a reload: the fresh Focus section idle timer is the new
        // default (40:00), not the old 35:00.
        await returnToApp(page);
        await goToFocus(page);
        await expect(page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/)).toHaveText('40:00', {
          timeout: 15_000,
        });
      },
    },
    {
      name: 'enable the Weekly Review cadence on web; preference persists with honest native-only copy',
      run: async ({ page }) => {
        await ensureAppContext(page);
        await switchSection(page, 'overview');
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText('Weekly review reminder', { exact: true })).toBeVisible();
        await expect(
          page.getByText(
            'Saved on this device. Native notification delivery is unavailable on web.',
            { exact: true },
          ),
        ).toBeVisible();

        await page.getByRole('button', { name: 'Weekly review on Fri' }).click();
        const weeklyTime = page.getByRole('textbox', { name: 'Weekly review reminder time' });
        await weeklyTime.fill('17:45');
        await page.getByRole('button', { name: 'Save weekly review reminder time' }).click();
        await expect(
          page.getByText('Saved for Fri 17:45. Native reminders are unavailable here.', {
            exact: true,
          }),
        ).toBeVisible();

        const stored = await page.evaluate(() =>
          window.localStorage.getItem('superhabits.notifications.weekly-review-reminder'),
        );
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored as string)).toEqual({
          enabled: true,
          weekday: 5,
          hour: 17,
          minute: 45,
        });

        await page.getByRole('button', { name: 'Close settings' }).click();
        await returnToApp(page);
        await switchSection(page, 'overview');
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(
          page.getByRole('textbox', { name: 'Weekly review reminder time' }),
        ).toHaveValue('17:45');
        const restored = await page.evaluate(() =>
          window.localStorage.getItem('superhabits.notifications.weekly-review-reminder'),
        );
        expect(JSON.parse(restored as string)).toEqual({
          enabled: true,
          weekday: 5,
          hour: 17,
          minute: 45,
        });
      },
    },
  ],
});