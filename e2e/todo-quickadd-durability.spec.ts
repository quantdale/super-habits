import { test, expect } from './fixtures';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { clickSwipeDeleteAction, swipeLeftToRevealRowActions } from './helpers/gestures';

/**
 * Todo Quick Add remount durability (Quick-Add draft state loss).
 *
 * The defect: `TodosScreen` rendered TWO `TodoQuickCapture` instances in
 * mutually-exclusive branches (empty vs populated), so a change that flips the
 * empty/populated state unmounted one instance and mounted the other, silently
 * discarding whatever the user had typed but not yet submitted.
 *
 * The contract under test: typing a new task must not lose unsaved input merely
 * because the underlying Todo collection changed. The fix keeps ONE stable
 * Quick Capture mounted across the transition, so the draft and the input
 * identity survive. These specs assert the UNSAVED TEXT (not a screenshot), the
 * input identity, single-instance, submission creating exactly one Todo, and
 * the durable database + outbox effects. Reload semantics are covered
 * separately: an in-screen remount is not a full application restart.
 */
test.describe('Todos Quick Add durability', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'todos');
    await clearDatabase(page);
    await goToTab(page, 'todos');
  });

  test('keeps an in-progress draft and input identity across an empty→populated transition', async ({
    page,
  }) => {
    const quickAdd = page.getByLabel('Quick add task title');
    await expect(quickAdd).toHaveCount(1);
    await expect(page.getByText('No pending tasks', { exact: true }).last()).toBeVisible();

    // Type a partial draft (do NOT submit). Pin the input node so we can observe
    // the exact remount behaviour across the transition.
    await quickAdd.click();
    await quickAdd.pressSequentially('Draft in pro');
    await expect(quickAdd).toHaveValue('Draft in pro');

    // Another surface adds the FIRST todo: empty becomes populated.
    await openNewTodoModal(page);
    await page.getByPlaceholder('Add a task...', { exact: true }).fill('First real task');
    await submitTodoModal(page, { waitForClose: true });
    await expect(page.getByText('First real task')).toBeVisible();

    // The DRAFT survives the empty→populated transition. The container is now
    // pinned non-scrolling (see the identity/focus regression below), so the
    // input node itself survives too — the draft lives in the section, which
    // makes the no-data-loss guarantee hold regardless of any future remount.
    await expect(quickAdd).toHaveCount(1);
    await expect(quickAdd).toHaveValue('Draft in pro');

    // Focus stays established and the preserved draft is submittable, so the
    // unsaved text both survived AND creates exactly one Todo.
    await quickAdd.click();
    await expect(quickAdd).toBeFocused();
    await quickAdd.press('Enter');

    await expect(page.getByText('Draft in pro', { exact: true })).toBeVisible();
    // No duplicated Quick Capture controls, and no duplicated created todo.
    await expect(quickAdd).toHaveCount(1);
    await expect(page.getByText('Draft in pro', { exact: true })).toHaveCount(1);

    // Durable database + outbox effects (this navigates the DB harness).
    const rows = await queryRows(page, `SELECT title FROM todos WHERE deleted_at IS NULL`);
    expect(rows.map((r) => r.title).sort()).toEqual(['Draft in pro', 'First real task']);
    const outbox = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'todos'`,
    );
    expect(outbox).toHaveLength(2);
    expect(outbox.every((r) => r.operation === 'create')).toBe(true);
    await returnToApp(page);
  });

  test('keeps the draft across a populated→empty transition', async ({ page }) => {
    // Start populated with a single todo.
    await openNewTodoModal(page);
    await page.getByPlaceholder('Add a task...', { exact: true }).fill('Only task');
    await submitTodoModal(page, { waitForClose: true });
    await expect(page.getByText('Only task')).toBeVisible();

    const quickAdd = page.getByLabel('Quick add task title');
    await quickAdd.click();
    await quickAdd.pressSequentially('Survivor draft');
    await expect(quickAdd).toHaveValue('Survivor draft');

    // Delete the only todo: populated becomes empty.
    await swipeLeftToRevealRowActions(page, 'Only task');
    await clickSwipeDeleteAction(page, 'Only task');
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog.getByText('Delete "Only task"?')).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('No pending tasks', { exact: true }).last()).toBeVisible();

    // Draft survives the populated→empty transition; still a single control.
    await expect(quickAdd).toHaveCount(1);
    await expect(quickAdd).toHaveValue('Survivor draft');

    // It still submits to exactly one todo.
    await quickAdd.press('Enter');
    await expect(page.getByText('Survivor draft')).toHaveCount(1);
    const rows = await queryRows(page, `SELECT title FROM todos WHERE deleted_at IS NULL`);
    expect(rows.map((r) => r.title)).toEqual(['Survivor draft']);
    await returnToApp(page);
  });

  test('keeps the input NODE across an empty→populated transition', async ({ page }) => {
    // Discriminating regression for the hosted long-title visual failure.
    //
    // Lifting the draft into the section preserved the VALUE but not the DOM
    // node: `Screen` renders a scrolling container when `scroll` is true and a
    // plain view when it is false, and To Do derived that flag from
    // `totallyEmpty`. Flipping it changed the container's element type, so React
    // unmounted and recreated the whole subtree — including the Quick Capture
    // input — and keystrokes still in flight were dropped. The hosted trace
    // showed a 115-character title landing as "Call th".
    //
    // The value-only assertions above cannot catch that: they pass as long as
    // SOME prefix survived. This test pins node IDENTITY, the property that was
    // actually destroyed, so it fails if the container swap is reintroduced.
    const quickAdd = page.getByLabel('Quick add task title');
    await expect(quickAdd).toHaveCount(1);
    await expect(page.getByText('No pending tasks', { exact: true }).last()).toBeVisible();

    // Tag the live node so a remount is detectable after the fact.
    await quickAdd.evaluate((el) => ((el as unknown as Record<string, unknown>).__nodeTag = 'A'));
    await quickAdd.click();
    await quickAdd.pressSequentially('Draft in pro');
    await expect(quickAdd).toHaveValue('Draft in pro');
    await expect(quickAdd).toBeFocused();

    // Another surface adds the FIRST todo: empty becomes populated.
    await openNewTodoModal(page);
    await page.getByPlaceholder('Add a task...', { exact: true }).fill('First real task');
    await submitTodoModal(page, { waitForClose: true });
    await expect(page.getByText('First real task')).toBeVisible();

    // Same node, draft intact: no remount, so no input loss. Identity is the
    // discriminator — a value-only assertion passes on any surviving prefix.
    // (Focus is deliberately NOT asserted here: opening the add-task modal
    // moves focus by design, so asserting it across that step would test the
    // modal, not the container swap.)
    await expect(quickAdd).toHaveCount(1);
    await expect(quickAdd).toHaveValue('Draft in pro');
    const survivedWithIdentity = await quickAdd.evaluate(
      (el) => (el as unknown as Record<string, unknown>).__nodeTag === 'A',
    );
    expect(survivedWithIdentity).toBe(true);

    // And the intact draft still submits to exactly one durable Todo.
    await quickAdd.click();
    await quickAdd.press('Enter');
    await expect(page.getByText('Draft in pro', { exact: true })).toBeVisible();
    const rows = await queryRows(page, `SELECT title FROM todos WHERE deleted_at IS NULL`);
    expect(rows.map((r) => r.title).sort()).toEqual(['Draft in pro', 'First real task']);
    await returnToApp(page);
  });

  test('reload clears the draft — an app restart is not an in-screen remount', async ({ page }) => {
    // Documents the deliberate boundary: the draft is in-memory UI state, kept
    // across an in-screen empty/populated remount (tests above) but intentionally
    // NOT persisted across a full application restart.
    const quickAdd = page.getByLabel('Quick add task title');
    await quickAdd.click();
    await quickAdd.pressSequentially('Ephemeral draft');
    await expect(quickAdd).toHaveValue('Ephemeral draft');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await goToTab(page, 'todos');
    await expect(page.getByLabel('Quick add task title')).toHaveValue('');
  });
});
