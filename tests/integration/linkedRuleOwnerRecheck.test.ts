import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { saveTodoRules } from './helpers/linkedActionRules';

const SESSION = 'stale-temporary-session';
const OWNER = 'durable-source-owner';

describe('standalone linked-rule writes recheck durable ownership', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.closeAsync();
  });

  async function seed() {
    const { getSupabaseSessionUserId } = await import('@/lib/supabase');
    vi.mocked(getSupabaseSessionUserId).mockResolvedValue(null);
    const { addTodo } = await import('@/features/todos/todos.data');
    const source = await addTodo({ title: 'Source' });
    const target = await addTodo({ title: 'Target' });
    const [rule] = await saveTodoRules(source, [
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'todos',
          entityType: 'todo',
          entityId: target,
          effect: { kind: 'binary', type: 'todo.complete' },
        },
      },
    ]);
    await db.runAsync('DELETE FROM sync_outbox');
    vi.mocked(getSupabaseSessionUserId).mockResolvedValue(SESSION);
    return { source, target, rule };
  }

  it.each(['owner', 'protected-origin'] as const)(
    'uses the current %s when deletion queued behind an ownership change',
    async (mode) => {
      const { target, rule } = await seed();
      const transactions = await import('@/core/db/transactions');
      const original = transactions.withSQLiteTransaction;
      const account = await import('@/core/auth/account.data');
      const { appMetaKeys, setAppMetaText } = await import('@/core/db/appMeta');
      const { portableOwnerFingerprint } = await import('@/lib/portableOwnerFingerprint');
      vi.spyOn(transactions, 'withSQLiteTransaction').mockImplementationOnce(
        async (database, task) => {
          // Session evidence is already resolved, but the queued writer has not
          // entered its authoritative transaction. A recovery/import wins first.
          if (mode === 'owner') await account.setLocalDatasetOwner(database, OWNER);
          else
            await setAppMetaText(
              database,
              appMetaKeys.portableLastImportOwnerFingerprint,
              portableOwnerFingerprint(OWNER),
            );
          return original(database, task);
        },
      );
      const { deleteLinkedActionRulesForTargetEntity } =
        await import('@/core/linked-actions/linkedActions.data');
      await deleteLinkedActionRulesForTargetEntity({
        feature: 'todos',
        entityType: 'todo',
        entityId: target,
      });
      expect(await account.getLocalDatasetOwner(db as never)).toBe(mode === 'owner' ? OWNER : null);
      expect(
        await db.getFirstAsync(
          'SELECT owner_user_id, operation FROM sync_outbox WHERE entity = ? AND id = ?',
          ['linked_action_rules', rule],
        ),
      ).toEqual({ owner_user_id: mode === 'owner' ? OWNER : null, operation: 'delete' });
      const persisted = await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM linked_action_rules WHERE id=?',
        [rule],
      );
      expect(persisted).toMatchObject({ deleted_at: expect.any(String) });
    },
  );
});
