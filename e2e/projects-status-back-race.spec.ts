import { test, expect, type Page } from './fixtures';
import { goToTab, planningHubTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { seedSql } from './helpers/seed';

/**
 * Planning > Projects: leaving the detail view while a status write is still
 * in flight must not freeze a stale row on the list.
 *
 * `ProjectListView` loads exactly once on mount, so if it mounts before the
 * `UPDATE projects` commits, its read wins and nothing ever refreshes the
 * render. The product contract this spec locks in: pressing the detail back
 * arrow during a lifecycle write serialises behind that write, so the list's
 * single read happens after the commit.
 *
 * The write is delayed DETERMINISTICALLY in the test (no product hook): the
 * page's SQLite worker wrapper holds the `UPDATE projects SET ...` `run`
 * message for DELAY_MS on the main thread, while every read the freshly
 * mounted list issues goes straight through. Pre-fix, the list reads the
 * pre-commit row; post-fix, the list is not mounted until the write resolves.
 */

const DELAY_MS = 600;

/** Delay delivery of the project status UPDATE to the SQLite worker. */
function delayProjectStatusWrite(delayMs: number): void {
  type WorkerMessage = {
    type?: string;
    data?: { source?: unknown; nativeStatementId?: unknown };
  };

  const WorkerCtor = window.Worker;
  const sources = new Map<number, string>();
  // The DOM type is an overload set (`transfer` list OR options bag); one loose
  // signature is enough to delay a single message without altering its payload.
  type LoosePostMessage = (this: Worker, message: unknown, options?: unknown) => void;
  const proto = WorkerCtor.prototype as unknown as { postMessage: LoosePostMessage };
  const originalPostMessage = proto.postMessage;

  proto.postMessage = function (message: unknown, options?: unknown): void {
    const msg = message as WorkerMessage | undefined;
    const statementId =
      typeof msg?.data?.nativeStatementId === 'number' ? msg.data.nativeStatementId : null;
    if (statementId !== null && msg?.type === 'prepare' && typeof msg.data?.source === 'string') {
      sources.set(statementId, msg.data.source);
    }
    const isProjectStatusWrite =
      statementId !== null &&
      msg?.type === 'run' &&
      (sources.get(statementId) ?? '').startsWith('UPDATE projects SET');
    if (isProjectStatusWrite) {
      setTimeout(() => originalPostMessage.call(this, message, options), delayMs);
      return;
    }
    originalPostMessage.call(this, message, options);
  };
}

function seedActiveProjectSql(): string {
  const now = new Date().toISOString();
  return `INSERT INTO projects (id, name, description, color, status, target_date, completed_at, sort_order, created_at, updated_at, deleted_at)
    VALUES ('proj_status_back_race', 'Race Project', NULL, '#3b82f6', 'active', NULL, NULL, 1, '${now}', '${now}', NULL);`;
}

async function openProjects(page: Page): Promise<void> {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
  await planningHubTab(page, 'Projects').click();
}

test.describe('Projects status write vs. back navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('back arrow during an in-flight completion shows the committed status', async ({ page }) => {
    await page.addInitScript(delayProjectStatusWrite, DELAY_MS);
    await seedSql(page, seedActiveProjectSql());
    await openProjects(page);

    await page.getByRole('button', { name: 'Race Project, Active, 0 percent progress' }).click();
    await expect(page.getByText('Project', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Complete project' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    // The confirm panel stays up until the write resolves and the back arrow is
    // never disabled, so this click is exactly the user's "I'm done here" path.
    await page.getByRole('button', { name: 'Back to projects' }).click();

    await expect(
      page.getByRole('button', { name: 'Race Project, Completed, 0 percent progress' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Race Project, Active, 0 percent progress' }),
    ).toHaveCount(0);
  });
});
