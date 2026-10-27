import type {
  LinkedActionRuleDefinition,
  SaveLinkedActionRuleForSourceInput,
} from '@/core/linked-actions/linkedActions.types';

/**
 * Seed linked-action rules through the SHIPPED authoring path.
 *
 * The direct `createLinkedActionRule` CRUD helper was test-only (no production
 * caller — production authors rules through the composed parent save), so it was
 * deleted. Tests that need a rule for a real source entity seed it with
 * `saveTodoLinkedActionRules` / `saveHabitLinkedActionRules`, which is exactly
 * what the editor uses: same transaction, same outbox intent, same ordering.
 *
 * These wrappers additionally return the created rule ids **in the order the
 * rules were supplied**. One replace call stamps every new rule with the same
 * `created_at`, so ordering by that column is ambiguous; `rowid` preserves the
 * insertion order, which is the array order. Several suites pin per-rule
 * execution rows and rule iteration order by id, so the order matters.
 */
async function ruleIdsForSource(
  feature: 'todos' | 'habits',
  entityType: 'todo' | 'habit',
  entityId: string,
): Promise<string[]> {
  // Resolve the client dynamically: `freshDatabase()` calls `vi.resetModules()`,
  // so a module-scope import of `getDatabase` would point at the previous
  // database instance and read another test's rows.
  const { getDatabase } = await import('@/core/db/client');
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id
     FROM linked_action_rules
     WHERE deleted_at IS NULL
       AND source_feature = ?
       AND source_entity_type = ?
       AND source_entity_id = ?
     ORDER BY rowid ASC`,
    [feature, entityType, entityId],
  );
  return rows.map((row) => row.id);
}

export async function saveTodoRules(
  todoId: string,
  rules: SaveLinkedActionRuleForSourceInput[],
): Promise<string[]> {
  const todos = await import('@/features/todos/todos.data');
  await todos.saveTodoLinkedActionRules(todoId, rules);
  return ruleIdsForSource('todos', 'todo', todoId);
}

export async function saveHabitRules(
  habitId: string,
  rules: SaveLinkedActionRuleForSourceInput[],
): Promise<string[]> {
  const habits = await import('@/features/habits/habits.data');
  await habits.saveHabitLinkedActionRules(habitId, rules);
  return ruleIdsForSource('habits', 'habit', habitId);
}

/**
 * Resubmit an existing rule unchanged (optionally paused). Unsupported rules
 * cannot be resubmitted — the save path refuses them — so they are dropped,
 * which is also what the editor forces.
 */
function toSaveInput(
  rule: LinkedActionRuleDefinition,
  status: LinkedActionRuleDefinition['status'],
): SaveLinkedActionRuleForSourceInput | null {
  if (rule.isUnsupported) return null;
  return {
    existingRuleId: rule.id,
    status,
    directionPolicy: rule.directionPolicy,
    bidirectionalGroupId: rule.bidirectionalGroupId,
    triggerType: rule.source.triggerType,
    target: rule.target,
  };
}

function keepSupported(
  rules: LinkedActionRuleDefinition[],
  status: (rule: LinkedActionRuleDefinition) => LinkedActionRuleDefinition['status'],
): SaveLinkedActionRuleForSourceInput[] {
  return rules
    .map((rule) => toSaveInput(rule, status(rule)))
    .filter((entry): entry is SaveLinkedActionRuleForSourceInput => entry !== null);
}

/**
 * Pause one rule by resubmitting its source's whole rule set through the
 * editor's save path. The rule stays authored (status `paused`), matching what
 * the rule editor does when the user toggles a rule off.
 */
export async function pauseTodoRule(todoId: string, ruleId: string): Promise<void> {
  const todos = await import('@/features/todos/todos.data');
  const existing = await todos.listTodoLinkedActionRules(todoId);
  await todos.saveTodoLinkedActionRules(
    todoId,
    keepSupported(existing, (rule) => (rule.id === ruleId ? 'paused' : rule.status)),
  );
}

/** Delete one rule by resubmitting its source's rule set without it. */
export async function removeTodoRule(todoId: string, ruleId: string): Promise<void> {
  const todos = await import('@/features/todos/todos.data');
  const existing = await todos.listTodoLinkedActionRules(todoId);
  await todos.saveTodoLinkedActionRules(
    todoId,
    keepSupported(
      existing.filter((rule) => rule.id !== ruleId),
      (rule) => rule.status,
    ),
  );
}
