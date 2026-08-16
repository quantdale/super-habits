import { expect, test } from './fixtures';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Download } from '@playwright/test';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { openSettingsScreen } from './helpers/commandObservation';

/**
 * Portable Data Export & Import V1 — web E2E.
 *
 * Deterministic round trips through the REAL web UI: export produces a local
 * Blob download (Playwright captures it directly — no OS dialog), the
 * downloaded file previews on an empty device, Cancel writes nothing, Import
 * restores the dataset, corrupt files are rejected with the database
 * unchanged, and a populated device blocks import. Owner-mismatch is covered
 * by the integration suite (the standard web build has no Supabase account).
 */

const IMPORT_INPUT = 'input[type="file"]';

async function dismissStartupRestorePromptIfPresent(page: import('@playwright/test').Page) {
  const dismissButton = page.getByText('Not now', { exact: true });
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

async function addTodoViaUi(page: import('@playwright/test').Page, title: string) {
  await goToTab(page, 'todos');
  await openNewTodoModal(page);
  await page.getByPlaceholder(/Add a task/i).type(title);
  await submitTodoModal(page, { waitForClose: true });
}

async function readDownload(download: Download): Promise<string> {
  const downloadPath = await download.path();
  if (downloadPath) return fs.readFile(downloadPath, 'utf8');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function writeTempJson(name: string, text: string): Promise<string> {
  const filePath = path.join(os.tmpdir(), name);
  await fs.writeFile(filePath, text, 'utf8');
  return filePath;
}

async function exportPortableFile(page: import('@playwright/test').Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^superhabits-backup-.*\.json$/);
  await expect(page.getByText(/Backup exported:/)).toBeVisible();
  return readDownload(download);
}

test.describe('Portable data export & import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await clearDatabase(page);
  });

  test('exports a downloadable portable file containing the seeded scope', async ({ page }) => {
    await addTodoViaUi(page, 'Portable export todo');
    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);

    const text = await exportPortableFile(page);

    // Envelope contract + entity content of the downloaded file.
    const file = JSON.parse(text) as Record<string, unknown>;
    expect(file.format).toBe('superhabits-portable-backup');
    expect(file.formatVersion).toBe(1);
    expect(file.backupSchemaVersion).toBe(2);
    expect(typeof file.exportedAt).toBe('string');
    const entities = file.entities as Record<string, unknown[]>;
    expect(entities.todos).toHaveLength(1);
    expect(entities.habits).toHaveLength(0);
    expect((file.integrity as Record<string, unknown>).payloadChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(text).not.toContain('access_token');
    expect(text).not.toContain('sync_outbox');
  });

  test('exports a large-enough representative file from many history rows', async ({ page }) => {
    // Seed 500 calorie entries directly (fast, deterministic).
    const values: string[] = [];
    for (let i = 1; i <= 500; i += 1) {
      const day = i % 30;
      values.push(
        `('cal_e2e_${i}', 'Bulk food ${i}', 200, 10, 30, 5, 2, 'snack', '2026-07-${String(day + 1).padStart(2, '0')}', '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z', NULL)`,
      );
    }
    await queryRows(
      page,
      `INSERT INTO calorie_entries (id, food_name, calories, protein, carbs, fats, fiber, meal_type, consumed_on, created_at, updated_at, deleted_at) VALUES ${values.join(', ')}`,
    );
    await returnToApp(page);

    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);
    const text = await exportPortableFile(page);
    const file = JSON.parse(text) as { entities: Record<string, unknown[]> };
    expect(file.entities.calorie_entries).toHaveLength(500);
    expect(text.length).toBeGreaterThan(50_000);
  });

  test('imports the downloaded file on an empty device: preview → cancel → confirm', async ({
    page,
  }) => {
    await addTodoViaUi(page, 'Alpha task');
    await addTodoViaUi(page, 'Beta task');
    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);
    const text = await exportPortableFile(page);

    // Fresh empty device.
    await clearDatabase(page);
    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);
    // Portable import is the offline path: enabled on an empty device even
    // without a remote backup account.
    await expect(page.getByRole('button', { name: 'Import data', exact: true })).toBeEnabled();

    // Select the exported file → readable preview.
    const filePath = await writeTempJson('roundtrip.json', text);
    await page.locator(IMPORT_INPUT).setInputFiles(filePath);
    await expect(page.getByText('Portable Super Habits backup')).toBeVisible();
    await expect(page.getByText(/Created:/)).toBeVisible();
    await expect(page.getByText(/Todos: 2/)).toBeVisible();
    await expect(page.getByText(/Integrity: Verified/)).toBeVisible();
    await expect(page.getByText(/Settings: included/)).toBeVisible();

    // NO-WRITE-BEFORE-CONFIRM: cancel leaves the database empty.
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const rowsAfterCancel = await queryRows(page, 'SELECT COUNT(*) AS count FROM todos');
    expect(rowsAfterCancel[0]?.count).toBe(0);
    await returnToApp(page);
    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);

    // Select again and confirm.
    await page.locator(IMPORT_INPUT).setInputFiles(filePath);
    await expect(page.getByText(/Todos: 2/)).toBeVisible();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByText(/Import complete\. 2 records were restored\./)).toBeVisible();

    // The imported data is visible in the app.
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await goToTab(page, 'todos');
    await expect(page.getByText('Alpha task', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Beta task', { exact: true }).first()).toBeVisible();
  });

  test('rejects a corrupt file and leaves the database unchanged', async ({ page }) => {
    await addTodoViaUi(page, 'Export me');
    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);
    const text = await exportPortableFile(page);

    // Tamper the payload checksum.
    const file = JSON.parse(text) as Record<string, unknown>;
    const integrity = file.integrity as Record<string, unknown>;
    integrity.payloadChecksum = '0'.repeat(64);
    const corruptText = JSON.stringify(file);

    await clearDatabase(page);
    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);
    const corruptPath = await writeTempJson('corrupt.json', corruptText);
    await page.locator(IMPORT_INPUT).setInputFiles(corruptPath);
    await expect(
      page.getByText(/did not pass validation|failed integrity verification/),
    ).toBeVisible();
    await expect(page.getByText('Portable Super Habits backup')).toBeHidden();

    const rows = await queryRows(page, 'SELECT COUNT(*) AS count FROM todos');
    expect(rows[0]?.count).toBe(0);
  });

  test('rejects invalid JSON with a readable error', async ({ page }) => {
    await clearDatabase(page);
    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);
    const badPath = await writeTempJson('invalid.json', '{"format": ');
    await page.locator(IMPORT_INPUT).setInputFiles(badPath);
    await expect(page.getByText(/not valid JSON/)).toBeVisible();
    const rows = await queryRows(page, 'SELECT COUNT(*) AS count FROM todos');
    expect(rows[0]?.count).toBe(0);
  });

  test('blocks import on a populated device', async ({ page }) => {
    await addTodoViaUi(page, 'Local only task');
    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);

    await expect(page.getByText(/Import is available only on an empty device/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import data', exact: true })).toBeDisabled();
  });
});
