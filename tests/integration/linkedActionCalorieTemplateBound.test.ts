import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import {
  applyLinkedActionEffectType,
  applyLinkedActionTargetFeature,
  createEmptyLinkedActionEditorRow,
  createSaveLinkedActionRuleInputFromEditorRow,
  validateLinkedActionEditorRow,
} from '@/core/linked-actions/linkedActionsEditor.model';
import { saveTodoRules } from './helpers/linkedActionRules';

/**
 * The linked-action calorie template must be authorable at exactly the values
 * the calorie ledger accepts.
 *
 * The editor validated `1..10000` kcal — an off-by-one against the ledger's
 * documented whole-kcal contract (`Calories cannot exceed 9999 kcal.`, enforced
 * by `assertCalorieEntryWrite` for every writer). A rule authored at 10000
 * therefore saves (and displays "valid") but can never fire: completing the
 * source todo records a FAILED execution and no calorie entry is written, so
 * the user's rule silently does nothing forever.
 *
 * Oracles below are the real authoring path plus a real SQLite execution:
 * the ledger maximum is authorable and lands its entry, and one kcal above the
 * ledger maximum is refused at authoring time instead of producing a dead rule.
 */
describe('linked-action calorie template bound matches the ledger (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  function authorRow(calories: string) {
    const empty = createEmptyLinkedActionEditorRow({
      key: 'todo_1',
      feature: 'todos',
      entityType: 'todo',
      entityId: 'todo_1',
      label: 'Task',
      description: '',
    });
    let row = applyLinkedActionTargetFeature(
      { ...empty, triggerType: 'todo.completed' },
      'calories',
    );
    row = applyLinkedActionEffectType(row, 'calorie.log');
    return {
      ...row,
      calorieLogParams: { foodName: 'Post-run smoothie', calories, mealType: 'snack' as const },
    };
  }

  it('fires at the ledger maximum and refuses one kcal above it at authoring time', async () => {
    db = await freshDatabase();

    // The maximum the ledger accepts is authorable AND fires.
    expect(validateLinkedActionEditorRow(authorRow('9999'))).toEqual({});

    // One above the ledger cap must be rejected here, not accepted and then
    // rejected by every execution.
    const over = validateLinkedActionEditorRow(authorRow('10000'));
    expect(over.calorieParams).toBe('Enter calories as a whole number between 1 and 9999.');
    expect(() => createSaveLinkedActionRuleInputFromEditorRow(authorRow('10000'))).toThrow(
      'Enter calories as a whole number between 1 and 9999.',
    );

    const todos = await import('@/features/todos/todos.data');
    const todoId = await todos.addTodo({ title: 'Evening run' });
    const [ruleId] = await saveTodoRules(todoId, [
      createSaveLinkedActionRuleInputFromEditorRow(authorRow('9999')),
    ]);
    await todos.completeTodo(todoId);

    const entry = await db.getFirstAsync<{ calories: number; food_name: string }>(
      `SELECT calories, food_name FROM calorie_entries WHERE deleted_at IS NULL`,
    );
    expect(entry).toEqual({ calories: 9999, food_name: 'Post-run smoothie' });
    const execution = await db.getFirstAsync<{ status: string; error_message: string | null }>(
      `SELECT status, error_message FROM linked_action_executions WHERE rule_id = ?`,
      [ruleId],
    );
    expect(execution?.status).toBe('applied');
    expect(execution?.error_message).toBeNull();
  });
});
