import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { installClock } from './helpers/clock';
import { seedSql } from './helpers/seed';

/**
 * Tier-2 silent-write honesty: Focus (Pomodoro) metadata writes.
 *
 * Sites pinned at the REAL SQLite boundary:
 *
 *  1. Post-session note prompt (`pomodoro_sessions.note`) — rejected write.
 *  2. The post-hoc History editor (`setPomodoroSessionMeta` no-op) — the
 *     session row is gone, so the update changes nothing.
 *  3. Preset save / delete (`app_meta.pomodoro_presets`) — rejected write.
 *  4. Selecting a preset (`app_meta.pomodoro_settings` + active preset id) —
 *     rejected write; the timer must not end up showing a selection the
 *     database does not have.
 *
 * Per site the contract is: (a) the failure is VISIBLE (inline
 * `accessibilityRole="alert"`, or the screen's own notice card with a
 * dismiss control), (b) the database and the UI both keep the pre-write state
 * (typed draft preserved, no row / app_meta rewrite, no backup intent), and
 * (c) a retry once the injected failure is removed commits exactly once.
 *
 * Failure injection is the established real-SQLite `RAISE(ABORT)` trigger
 * installed through `e2e/helpers/dbHarness.ts` (see `habits-w7*.spec.ts`,
 * `calories.spec.ts`, `planning-w115-reliability.spec.ts`);
 * `e2e/helpers/failure.ts` injects only at the REMOTE (`*.supabase.co`)
 * boundary, which cannot fail a local OPFS write in the hermetic `dist/`
 * export (no Supabase host is bundled there).
 *
 * The "session row vanished before the note was saved" case is reproduced
 * WITHOUT a DB round trip (which would destroy the app's React state): an
 * AFTER INSERT trigger removes the just-logged session, exactly the ordering a
 * concurrent delete/restore leaves behind, so the note write resolves without
 * having changed anything.
 */

const NOTE_TRIGGER = 'focus_wfail_note';
const PRESET_TRIGGER = 'focus_wfail_presets';
const SETTINGS_TRIGGER = 'focus_wfail_settings';

const NOTE_BLOCK_SQL = `CREATE TRIGGER ${NOTE_TRIGGER}
  BEFORE UPDATE ON pomodoro_sessions
  WHEN NEW.note IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'note-write-blocked'); END;`;

/** Run one full focus session on the fake clock and land on the summary frame. */
async function completeFocusSession(page: Page): Promise<void> {
  await installClock(page);
  await page.getByText('Start focus', { exact: true }).click();
  await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
  await page.clock.fastForward(25 * 60 * 1000);
  await expect(page.getByText('Session complete', { exact: true })).toBeVisible({
    timeout: 10_000,
  });
}

async function sessionRows(page: Page): Promise<Record<string, unknown>[]> {
  return queryRows(page, 'SELECT id, note FROM pomodoro_sessions');
}

async function settingsValue(page: Page): Promise<Record<string, unknown>[]> {
  return queryRows(page, `SELECT value FROM app_meta WHERE key = 'pomodoro_settings'`);
}

test.describe('Focus write-failure honesty', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'pomodoro');
    await clearDatabase(page);
    await goToTab(page, 'pomodoro');
  });

  test('a rejected session note stays on the prompt with its alert and typed text, then saves on retry', async ({
    page,
  }) => {
    await seedSql(page, NOTE_BLOCK_SQL);
    await returnToApp(page);
    await goToTab(page, 'pomodoro');
    await completeFocusSession(page);
    await expect(page.getByText('What did you focus on?')).toBeVisible();

    const noteField = page.getByLabel('Session note');
    await noteField.fill('Draft that must survive');
    await page.getByRole('button', { name: 'Save note' }).click();

    // (a) visible + accessible failure, prompt still open on the typed draft.
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(noteField).toHaveValue('Draft that must survive');
    await expect(page.getByRole('button', { name: 'Save note' })).toBeVisible();
    // (b) durable truth unchanged: the session exists, its note is still NULL,
    // and no metadata intent was minted.
    const afterFailure = await sessionRows(page);
    expect(afterFailure).toHaveLength(1);
    expect(afterFailure[0]?.note ?? null).toBeNull();
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'pomodoro_sessions' AND operation = 'update'`,
      ),
    ).toEqual([{ n: 0 }]);

    // (c) retry after the failure is cleared persists the note exactly once.
    await runSql(page, `DROP TRIGGER ${NOTE_TRIGGER};`);
    await returnToApp(page);
    await goToTab(page, 'pomodoro');
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page
      .getByRole('button', { name: /Edit focus session from/ })
      .first()
      .click();
    const editor = page.getByRole('dialog');
    await editor.getByRole('textbox', { name: 'Session note' }).fill('Saved on retry');
    await editor.getByRole('button', { name: 'Save session changes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 });

    const afterRetry = await sessionRows(page);
    expect(afterRetry).toHaveLength(1);
    expect(afterRetry[0]?.note).toBe('Saved on retry');
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'pomodoro_sessions'`),
    ).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });

  test('a note for a session that no longer exists is reported instead of closing as saved', async ({
    page,
  }) => {
    // The just-logged session is removed by SQLite itself AFTER the insert, so
    // the note prompt owns an id that resolves to no row: the meta write is a
    // no-op whose failure the user must still see.
    await seedSql(
      page,
      `CREATE TRIGGER focus_wfail_vanish_after_insert
         AFTER INSERT ON pomodoro_sessions
         BEGIN DELETE FROM pomodoro_sessions WHERE id = NEW.id; END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'pomodoro');
    await completeFocusSession(page);

    const noteField = page.getByLabel('Session note');
    await expect(noteField).toBeVisible();
    await noteField.fill('Nothing to attach to');
    await page.getByRole('button', { name: 'Save note' }).click();

    // Silence here is the defect: the write changed nothing, so the prompt must
    // stay open with an alert and the typed draft, never close as saved.
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(noteField).toHaveValue('Nothing to attach to');
    expect(await sessionRows(page)).toHaveLength(0);
    await returnToApp(page);
  });

  test('a rejected preset save keeps the draft and list intact, then creates exactly one preset on retry', async ({
    page,
  }) => {
    await seedSql(
      page,
      `CREATE TRIGGER ${PRESET_TRIGGER}
         BEFORE INSERT ON app_meta
         WHEN NEW.key = 'pomodoro_presets'
         BEGIN SELECT RAISE(ABORT, 'preset-write-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'pomodoro');

    await page.getByRole('button', { name: 'Manage presets' }).click();
    const manager = page.getByRole('dialog');
    await manager.getByRole('button', { name: 'New preset' }).click();
    await manager.getByRole('textbox', { name: 'Preset name' }).fill('Blocked preset');
    await manager.getByRole('textbox', { name: 'Preset focus minutes' }).fill('45');
    await manager.getByRole('button', { name: 'Create preset' }).click();

    // (a) visible failure inside the open manager, (b) draft + list unchanged.
    await expect(manager.getByRole('alert')).toBeVisible();
    await expect(manager.getByRole('textbox', { name: 'Preset name' })).toHaveValue(
      'Blocked preset',
    );
    await expect(manager.getByRole('button', { name: /^Delete preset / })).toHaveCount(0);
    expect(
      await queryRows(page, `SELECT value FROM app_meta WHERE key = 'pomodoro_presets'`),
    ).toEqual([]);

    // (c) retry with the failure cleared creates exactly one preset.
    await runSql(page, `DROP TRIGGER ${PRESET_TRIGGER};`);
    await returnToApp(page);
    await goToTab(page, 'pomodoro');
    await page.getByRole('button', { name: 'Manage presets' }).click();
    const retried = page.getByRole('dialog');
    await retried.getByRole('button', { name: 'New preset' }).click();
    await retried.getByRole('textbox', { name: 'Preset name' }).fill('Blocked preset');
    await retried.getByRole('textbox', { name: 'Preset focus minutes' }).fill('45');
    await retried.getByRole('button', { name: 'Create preset' }).click();
    await expect(
      retried.getByRole('button', { name: 'Delete preset Blocked preset' }),
    ).toBeVisible();

    const stored = await queryRows(
      page,
      `SELECT value FROM app_meta WHERE key = 'pomodoro_presets'`,
    );
    expect(stored).toHaveLength(1);
    expect(String(stored[0]?.value).match(/Blocked preset/g)).toHaveLength(1);
    await returnToApp(page);
  });

  test('a rejected preset delete keeps the preset and shows the failure, then deletes on retry', async ({
    page,
  }) => {
    // Author one preset through the UI (real write path), then reject deletes.
    await page.getByRole('button', { name: 'Manage presets' }).click();
    const manager = page.getByRole('dialog');
    await manager.getByRole('button', { name: 'New preset' }).click();
    await manager.getByRole('textbox', { name: 'Preset name' }).fill('Doomed preset');
    await manager.getByRole('button', { name: 'Create preset' }).click();
    await expect(
      manager.getByRole('button', { name: 'Delete preset Doomed preset' }),
    ).toBeVisible();
    await manager.getByLabel('Close').click();

    await seedSql(
      page,
      `CREATE TRIGGER ${PRESET_TRIGGER}
         BEFORE INSERT ON app_meta
         WHEN NEW.key = 'pomodoro_presets'
           AND NEW.value NOT LIKE '%Doomed preset%'
         BEGIN SELECT RAISE(ABORT, 'preset-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'pomodoro');
    await page.getByRole('button', { name: 'Manage presets' }).click();
    const failing = page.getByRole('dialog');
    await failing.getByRole('button', { name: 'Delete preset Doomed preset' }).click();
    await failing.getByRole('button', { name: 'Delete preset', exact: true }).click();

    // (a) failure visible, (b) the preset is still listed and still stored.
    await expect(failing.getByRole('alert')).toBeVisible();
    await expect(
      failing.getByRole('button', { name: 'Delete preset Doomed preset' }),
    ).toBeVisible();
    const storedAfterFailure = await queryRows(
      page,
      `SELECT value FROM app_meta WHERE key = 'pomodoro_presets'`,
    );
    expect(String(storedAfterFailure[0]?.value)).toContain('Doomed preset');

    // (c) retry once the failure is cleared deletes exactly that row.
    await runSql(page, `DROP TRIGGER ${PRESET_TRIGGER};`);
    await returnToApp(page);
    await goToTab(page, 'pomodoro');
    await page.getByRole('button', { name: 'Manage presets' }).click();
    const retried = page.getByRole('dialog');
    await retried.getByRole('button', { name: 'Delete preset Doomed preset' }).click();
    await retried.getByRole('button', { name: 'Delete preset', exact: true }).click();
    await expect(retried.getByRole('button', { name: 'Delete preset Doomed preset' })).toHaveCount(
      0,
    );

    const storedAfterRetry = await queryRows(
      page,
      `SELECT value FROM app_meta WHERE key = 'pomodoro_presets'`,
    );
    expect(storedAfterRetry).toHaveLength(1);
    expect(String(storedAfterRetry[0]?.value)).not.toContain('Doomed preset');
    await returnToApp(page);
  });

  test('a rejected preset selection reports it and leaves the timer on the stored durations, then applies on retry', async ({
    page,
  }) => {
    await seedSql(
      page,
      `CREATE TRIGGER ${SETTINGS_TRIGGER}
         BEFORE INSERT ON app_meta
         WHEN NEW.key = 'pomodoro_settings'
         BEGIN SELECT RAISE(ABORT, 'settings-write-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'pomodoro');
    // Classic is the stored default.
    await expect(page.getByText('25:00')).toBeVisible();

    await page.getByRole('button', { name: 'Choose preset' }).click();
    await page.getByRole('radio', { name: /^Sprint · / }).click();

    // (a) the failure is visible, (b) the idle timer keeps the durations the
    // database actually holds (no unsaved 15:00).
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('25:00')).toBeVisible();
    // The selection must not claim a rhythm the timer never adopted.
    await page.getByRole('button', { name: 'Choose preset' }).click();
    await expect(page.getByRole('radio', { name: /^Classic · / })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('dialog').getByLabel('Close').click();
    // Nothing landed in the database (this read leaves app context; no UI
    // interaction may follow until returnToApp).
    expect(await settingsValue(page)).toEqual([]);

    // (c) retry after the failure is cleared applies and persists the choice.
    await runSql(page, `DROP TRIGGER ${SETTINGS_TRIGGER};`);
    await returnToApp(page);
    await goToTab(page, 'pomodoro');
    await page.getByRole('button', { name: 'Choose preset' }).click();
    await page.getByRole('radio', { name: /^Sprint · / }).click();
    await expect(page.getByText('15:00')).toBeVisible();

    // The timer paints 15:00 optimistically, BEFORE the durable settings write
    // resolves. Reaching the DB harness destroys the app's SQLite worker, so
    // give that queued write the same short quiescence window the lifecycle
    // journey uses before a harness round trip, then read the committed row
    // exactly once.
    await page.waitForTimeout(1_000);
    const storedAfterRetry = await settingsValue(page);
    expect(storedAfterRetry).toHaveLength(1);
    expect(JSON.parse(String(storedAfterRetry[0]?.value))).toMatchObject({
      focusMinutes: 15,
      shortBreakMinutes: 3,
      longBreakMinutes: 10,
      sessionsBeforeLongBreak: 4,
    });
    await returnToApp(page);
  });

  test('a rejection landing AFTER Start never strips the running session of its preset (auto-start survives)', async ({
    page,
  }) => {
    // Codex P2 on PR #206: the catch block used to restore the previous
    // governing preset unconditionally. When the selection write survived the
    // Start press and only then rejected, that revert silently removed Sprint
    // from the RUNNING session (`planSessionCompletion` reads the governing
    // preset for `autoStartBreaks`), so the break never auto-started.
    //
    // Deterministic ordering with no sleeps: the durable `pomodoro_settings`
    // WRITE is held at the worker boundary (the established W7 harness
    // technique) so Start is pressed while it is still in flight; releasing it
    // afterwards lets the real `RAISE(ABORT)` trigger reject it AFTER the
    // session owns the clock.
    await page.addInitScript(() => {
      const hold = { armed: false, queued: [] as (() => void)[] };
      const control = window as unknown as {
        __holdPresetWrite(on: boolean): void;
        __releasePresetWrite(): void;
      };
      control.__holdPresetWrite = (on: boolean) => {
        hold.armed = on;
      };
      control.__releasePresetWrite = () => {
        hold.armed = false;
        for (const send of hold.queued.splice(0)) send();
      };
      const original = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (
        this: Worker,
        message: unknown,
        transferOrOptions?: Transferable[] | StructuredSerializeOptions,
      ) {
        const payload = JSON.stringify(message);
        // Only the settings WRITE carries the preset's durations.
        if (hold.armed && payload.includes('"pomodoro_settings","1"')) {
          // SAFETY: the hold/release path forwards the caller's own arguments
          // verbatim, exactly as an unmodified `postMessage` would.
          const forward = () =>
            original.call(
              this,
              message,
              transferOrOptions as Transferable[] & StructuredSerializeOptions,
            );
          hold.queued.push(forward);
          return;
        }
        original.call(
          this,
          message,
          transferOrOptions as Transferable[] & StructuredSerializeOptions,
        );
      };
    });

    await seedSql(
      page,
      `CREATE TRIGGER ${SETTINGS_TRIGGER}
         BEFORE INSERT ON app_meta
         WHEN NEW.key = 'pomodoro_settings'
         BEGIN SELECT RAISE(ABORT, 'settings-write-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'pomodoro');
    await installClock(page);
    await expect(page.getByText('25:00')).toBeVisible();

    // Select Sprint while its durable write is held, then Start.
    await page.evaluate(() =>
      (window as unknown as { __holdPresetWrite(on: boolean): void }).__holdPresetWrite(true),
    );
    await page.getByRole('button', { name: 'Choose preset' }).click();
    await page.getByRole('radio', { name: /^Sprint · / }).click();
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    // The accepted session claimed Sprint's 15-minute focus.
    await expect(page.getByText('15:00')).toBeVisible();

    // Release: the queued write now reaches SQLite and is rejected.
    await page.evaluate(() =>
      (window as unknown as { __releasePresetWrite(): void }).__releasePresetWrite(),
    );

    // (a) the late failure is still surfaced — exactly once — even though the
    // preset surfaces are withdrawn for the running session.
    await expect(page.getByRole('alert')).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveText('Could not save that preset. Try again.');
    // The running clock is untouched by the reconciliation.
    await expect(page.getByText('15:00')).toBeVisible();
    await expect(page.getByText('Focus started — 15 minutes')).toBeVisible();

    // (b) the session still completes with SPRINT's behaviour: the short break
    // auto-starts. On the pre-fix code the governing preset reverted to Classic
    // (`autoStartBreaks: false`), so this wait is the regression assertion.
    await page.clock.fastForward(15 * 60 * 1000);
    await expect(page.getByLabel(/^Short Break running, \d{2}:\d{2} remaining$/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Pause', { exact: true })).toBeVisible();

    // Durable truth: nothing was stored for the rejected selection, and only
    // the completed focus session was logged once (breaks never log).
    await returnToApp(page);
    expect(await settingsValue(page)).toEqual([]);
    const sessions = await queryRows(
      page,
      'SELECT COUNT(*) AS n, SUM(duration_seconds) AS total FROM pomodoro_sessions',
    );
    expect(Number(sessions[0]?.n ?? 0)).toBe(1);
    expect(Number(sessions[0]?.total ?? 0)).toBe(15 * 60);
  });
});
