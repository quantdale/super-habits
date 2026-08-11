import { getDatabase } from '@/core/db/client';
import { Habit, HabitCategory, HabitCompletion, HabitIcon } from '@/core/db/types';
import type {
  LinkedActionEffectAdapterResult,
  LinkedActionProcessResult,
  LinkedActionRuleDefinition,
  SaveLinkedActionRuleForSourceInput,
} from '@/core/linked-actions/linkedActions.types';
import { createId } from '@/lib/id';
import { nowIso, timestampToLocalDateKey, toDateKey } from '@/lib/time';
import { syncEngine } from '@/core/sync/sync.engine';
import { linkedActionsEngine } from '@/core/linked-actions/linkedActions.engine';
import {
  deleteLinkedActionRulesForTargetEntity,
  listLinkedActionRulesForSourceEntity,
  replaceLinkedActionRulesForSourceEntity,
} from '@/core/linked-actions/linkedActions.data';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/features/habits/habitPresets';
import {
  ALL_HABIT_WEEKDAYS,
  buildInitialHabitRule,
  createHabitRule,
  getHabitRuleForDate,
  getHabitTargetForDate,
  parseHabitRuleHistory,
  serializeHabitRuleHistory,
  upsertHabitRule,
  type HabitRule,
  type HabitWeekday,
} from '@/features/habits/habits.domain';

const CATEGORY_ORDER =
  "CASE category WHEN 'anytime' THEN 0 WHEN 'morning' THEN 1 WHEN 'afternoon' THEN 2 WHEN 'evening' THEN 3 ELSE 4 END";

function safeTimestampToLocalDateKey(timestamp: string, fallback = toDateKey()): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? fallback : timestampToLocalDateKey(timestamp);
}

export type LinkedActionsDispatchResult = Pick<
  LinkedActionProcessResult,
  'matchedRuleCount' | 'notices'
>;

const EMPTY_LINKED_ACTIONS_RESULT: LinkedActionsDispatchResult = {
  matchedRuleCount: 0,
  notices: [],
};

export async function listHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(
    `SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY ${CATEGORY_ORDER}, created_at DESC`,
  );
}

export async function addHabit(
  name: string,
  targetPerDay: number,
  category: HabitCategory = 'anytime',
  icon: HabitIcon = DEFAULT_HABIT_ICON,
  color: string = DEFAULT_HABIT_COLOR,
  weekdays: readonly HabitWeekday[] = ALL_HABIT_WEEKDAYS,
): Promise<string> {
  const id = createId('habit');
  const now = nowIso();
  const ruleHistory = buildInitialHabitRule(timestampToLocalDateKey(now), targetPerDay, weekdays);
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO habits (id, name, target_per_day, reminder_time, category, icon, color, rule_history, created_at, updated_at, deleted_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL)',
    [
      id,
      name,
      targetPerDay,
      category,
      icon,
      color,
      serializeHabitRuleHistory(ruleHistory),
      now,
      now,
    ],
  );
  syncEngine.enqueue({ entity: 'habits', id, updatedAt: now, operation: 'create' });
  return id;
}

export type IncrementHabitResult = {
  count: number;
  linkedActions: LinkedActionsDispatchResult;
};

export async function incrementHabit(
  habitId: string,
  dateKey = toDateKey(),
): Promise<IncrementHabitResult> {
  const db = await getDatabase();
  const now = nowIso();
  const habit = await db.getFirstAsync<{
    name: string;
    target_per_day: number;
    created_at: string;
    rule_history: string | null;
  }>(
    `SELECT name, target_per_day, created_at, rule_history
     FROM habits
     WHERE id = ?
       AND deleted_at IS NULL`,
    [habitId],
  );

  // Guard before writing: a missing/soft-deleted habit must not accrete
  // orphan completion rows.
  if (!habit) {
    return {
      count: 0,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const targetPerDay = getHabitTargetForDate(
    parseHabitRuleHistory(habit.rule_history),
    dateKey,
    habit.target_per_day,
    safeTimestampToLocalDateKey(habit.created_at),
  );

  // Atomic upsert instead of read-modify-write: two rapid taps previously
  // either raced the UNIQUE(habit_id, date_key) constraint (crash) or lost
  // an increment.
  await db.runAsync(
    `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT(habit_id, date_key) DO UPDATE SET
       count = count + 1,
       updated_at = excluded.updated_at`,
    [createId('hcmp'), habitId, dateKey, now, now],
  );

  const row = await db.getFirstAsync<{ id: string; count: number }>(
    'SELECT id, count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
    [habitId, dateKey],
  );
  const nextCount = row?.count ?? 1;
  const previousCount = nextCount - 1;
  const completionId = row?.id ?? null;

  if (previousCount >= targetPerDay || nextCount < targetPerDay) {
    return {
      count: nextCount,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const processResult = await linkedActionsEngine.processSourceAction({
    occurredAt: now,
    feature: 'habits',
    entityType: 'habit',
    entityId: habitId,
    triggerType: 'habit.completed_for_day',
    label: habit.name,
    sourceDateKey: dateKey,
    sourceRecordId: completionId,
    origin: {
      originKind: 'user',
      originRuleId: null,
      originEventId: null,
    },
    payload: {
      previousCount,
      currentCount: nextCount,
      targetPerDay,
    },
  });
  const linkedActions: LinkedActionsDispatchResult = {
    matchedRuleCount: processResult.matchedRuleCount,
    notices: processResult.notices,
  };

  return {
    count: nextCount,
    linkedActions,
  };
}

export async function decrementHabit(habitId: string, dateKey = toDateKey()): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  // Atomic decrement instead of a read-modify-write: two rapid taps previously
  // SELECTed the same count and both wrote count-1, losing a decrement (the
  // same race incrementHabit was fixed for). Decrement count > 0, then hard
  // delete the row when it reaches 0 (habit_completions is the documented
  // non-synced toggle-off exception).
  await db.runAsync(
    'UPDATE habit_completions SET count = count - 1, updated_at = ? WHERE habit_id = ? AND date_key = ? AND count > 0',
    [now, habitId, dateKey],
  );
  await db.runAsync(
    'DELETE FROM habit_completions WHERE habit_id = ? AND date_key = ? AND count = 0',
    [habitId, dateKey],
  );
}

export async function getHabitCountByDate(habitId: string, dateKey = toDateKey()): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
    [habitId, dateKey],
  );
  return row?.count ?? 0;
}

export type HabitCompletionRow = {
  habit_id: string;
  date_key: string;
  count: number;
};

export async function getAllHabitCompletionsForRange(
  startDateKey: string,
  endDateKey: string,
): Promise<HabitCompletionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<HabitCompletionRow>(
    `SELECT habit_id, date_key, count
     FROM habit_completions
     WHERE date_key >= ?
       AND date_key <= ?
     ORDER BY date_key ASC`,
    [startDateKey, endDateKey],
  );
}

export async function getCompletionHistory(
  habitId: string,
  days?: number,
): Promise<HabitCompletion[]> {
  const db = await getDatabase();

  if (days === undefined) {
    return db.getAllAsync<HabitCompletion>(
      `SELECT * FROM habit_completions
       WHERE habit_id = ?
       ORDER BY date_key ASC`,
      [habitId],
    );
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(new Date());

  return db.getAllAsync<HabitCompletion>(
    `SELECT * FROM habit_completions
     WHERE habit_id = ?
       AND date_key >= ?
       AND date_key <= ?
     ORDER BY date_key ASC`,
    [habitId, startKey, endKey],
  );
}

export async function updateHabit(
  habitId: string,
  updates: {
    name: string;
    targetPerDay: number;
    category: HabitCategory;
    icon?: HabitIcon;
    color?: string;
    weekdays?: readonly HabitWeekday[];
    effectiveFromDate?: string;
  },
): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{
    target_per_day: number;
    created_at: string;
    rule_history: string | null;
  }>(
    `SELECT target_per_day, created_at, rule_history
     FROM habits
     WHERE id = ?
       AND deleted_at IS NULL`,
    [habitId],
  );
  if (!existing) return;

  const effectiveFromDate = updates.effectiveFromDate ?? timestampToLocalDateKey(now);
  const fallbackCreationDate = safeTimestampToLocalDateKey(existing.created_at);
  const history = parseHabitRuleHistory(existing.rule_history);
  const normalizedHistory =
    history.length > 0
      ? history
      : buildInitialHabitRule(fallbackCreationDate, existing.target_per_day);
  const currentRule = getHabitRuleForDate(
    normalizedHistory,
    effectiveFromDate,
    existing.target_per_day,
    fallbackCreationDate,
  );
  const nextRule: HabitRule = createHabitRule(
    effectiveFromDate,
    updates.weekdays ?? currentRule?.weekdays ?? ALL_HABIT_WEEKDAYS,
    updates.targetPerDay,
  );
  const nextHistory = upsertHabitRule(normalizedHistory, nextRule);

  await db.runAsync(
    'UPDATE habits SET name = ?, target_per_day = ?, category = ?, icon = ?, color = ?, rule_history = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    [
      updates.name,
      updates.targetPerDay,
      updates.category,
      updates.icon ?? DEFAULT_HABIT_ICON,
      updates.color ?? DEFAULT_HABIT_COLOR,
      serializeHabitRuleHistory(nextHistory),
      now,
      habitId,
    ],
  );
  syncEngine.enqueue({ entity: 'habits', id: habitId, updatedAt: now, operation: 'update' });
}

export async function listHabitLinkedActionRules(
  habitId: string,
): Promise<LinkedActionRuleDefinition[]> {
  return listLinkedActionRulesForSourceEntity({
    feature: 'habits',
    entityType: 'habit',
    entityId: habitId,
  });
}

export async function saveHabitLinkedActionRules(
  habitId: string,
  rules: SaveLinkedActionRuleForSourceInput[],
): Promise<void> {
  await replaceLinkedActionRulesForSourceEntity({
    feature: 'habits',
    entityType: 'habit',
    entityId: habitId,
    rules,
  });
}

export async function deleteHabit(habitId: string): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync('UPDATE habits SET deleted_at = ?, updated_at = ? WHERE id = ?', [
    now,
    now,
    habitId,
  ]);
  await saveHabitLinkedActionRules(habitId, []);
  await deleteLinkedActionRulesForTargetEntity({
    feature: 'habits',
    entityType: 'habit',
    entityId: habitId,
    deletedAt: now,
  });
  syncEngine.enqueue({ entity: 'habits', id: habitId, updatedAt: now, operation: 'delete' });
}

async function getLinkedActionHabitTarget(habitId: string) {
  const db = await getDatabase();
  const habit = await db.getFirstAsync<
    Pick<Habit, 'id' | 'name' | 'target_per_day' | 'deleted_at' | 'created_at' | 'rule_history'>
  >(
    `SELECT id, name, target_per_day, deleted_at, created_at, rule_history
     FROM habits
     WHERE id = ?`,
    [habitId],
  );
  return { db, habit };
}

export async function incrementHabitFromLinkedAction(input: {
  habitId: string;
  amount: number;
  dateKey: string;
}): Promise<LinkedActionEffectAdapterResult> {
  const { db, habit } = await getLinkedActionHabitTarget(input.habitId);
  if (!habit || habit.deleted_at !== null) {
    return { status: 'skipped', reason: 'target_missing' };
  }

  if (input.amount <= 0) {
    return {
      status: 'skipped',
      reason: 'invalid_amount',
      targetLabel: habit.name,
    };
  }

  const now = nowIso();
  const existing = await db.getFirstAsync<{ id: string; count: number }>(
    `SELECT id, count
     FROM habit_completions
     WHERE habit_id = ?
       AND date_key = ?`,
    [input.habitId, input.dateKey],
  );

  if (existing) {
    await db.runAsync(
      `UPDATE habit_completions
       SET count = ?, updated_at = ?
       WHERE id = ?`,
      [existing.count + input.amount, now, existing.id],
    );
  } else {
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [createId('hcmp'), input.habitId, input.dateKey, input.amount, now, now],
    );
  }

  return {
    status: 'applied',
    targetLabel: habit.name,
  };
}

export async function ensureHabitDailyTargetFromLinkedAction(input: {
  habitId: string;
  minimumCount: number | 'target_per_day';
  dateKey: string;
}): Promise<LinkedActionEffectAdapterResult> {
  const { db, habit } = await getLinkedActionHabitTarget(input.habitId);
  if (!habit || habit.deleted_at !== null) {
    return { status: 'skipped', reason: 'target_missing' };
  }

  const targetPerDay = getHabitTargetForDate(
    parseHabitRuleHistory(habit.rule_history),
    input.dateKey,
    habit.target_per_day,
    safeTimestampToLocalDateKey(habit.created_at),
  );

  const desiredCount = Math.max(
    0,
    input.minimumCount === 'target_per_day' ? targetPerDay : input.minimumCount,
  );
  if (desiredCount === 0) {
    return {
      status: 'skipped',
      reason: 'already_satisfied',
      targetLabel: habit.name,
    };
  }

  const now = nowIso();
  const existing = await db.getFirstAsync<{ id: string; count: number }>(
    `SELECT id, count
     FROM habit_completions
     WHERE habit_id = ?
       AND date_key = ?`,
    [input.habitId, input.dateKey],
  );

  if (existing && existing.count >= desiredCount) {
    return {
      status: 'skipped',
      reason: 'already_satisfied',
      targetLabel: habit.name,
    };
  }

  if (existing) {
    await db.runAsync(
      `UPDATE habit_completions
       SET count = ?, updated_at = ?
       WHERE id = ?`,
      [desiredCount, now, existing.id],
    );
  } else {
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [createId('hcmp'), input.habitId, input.dateKey, desiredCount, now, now],
    );
  }

  return {
    status: 'applied',
    targetLabel: habit.name,
  };
}

export async function applyRemoteHabits(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: Habit[],
): Promise<void> {
  for (const row of rows) {
    const fallbackCreationDate = safeTimestampToLocalDateKey(row.created_at);
    const history = parseHabitRuleHistory(row.rule_history);
    const ruleHistory =
      history.length > 0
        ? history
        : buildInitialHabitRule(fallbackCreationDate, row.target_per_day);
    await db.runAsync(
      `INSERT OR REPLACE INTO habits (
         id,
         name,
         target_per_day,
         reminder_time,
         category,
         icon,
         color,
         rule_history,
         created_at,
         updated_at,
         deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.name,
        row.target_per_day,
        row.reminder_time,
        row.category,
        row.icon,
        row.color,
        serializeHabitRuleHistory(ruleHistory),
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  }
}
