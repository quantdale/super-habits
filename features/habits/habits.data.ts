import { getDatabase } from "@/core/db/client";
import { Habit, HabitCategory, HabitCompletion, HabitIcon } from "@/core/db/types";
import type { LinkedActionEffectAdapterResult } from "@/core/linked-actions/linkedActions.types";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";
import {
  linkedActionsEngine,
  type LinkedActionsDispatchResult,
} from "@/core/linked-actions/linkedActions.engine";
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from "@/features/habits/habitPresets";

const CATEGORY_ORDER = "CASE category WHEN 'anytime' THEN 0 WHEN 'morning' THEN 1 WHEN 'afternoon' THEN 2 WHEN 'evening' THEN 3 ELSE 4 END";

const EMPTY_LINKED_ACTIONS_RESULT: LinkedActionsDispatchResult = {
  matchedRuleCount: 0,
  dryRunRuleIds: [],
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
  category: HabitCategory = "anytime",
  icon: HabitIcon = DEFAULT_HABIT_ICON,
  color: string = DEFAULT_HABIT_COLOR,
): Promise<void> {
  const id = createId("habit");
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO habits (id, name, target_per_day, reminder_time, category, icon, color, created_at, updated_at, deleted_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)",
    [id, name, targetPerDay, category, icon, color, now, now],
  );
  syncEngine.enqueue({ entity: "habits", id, updatedAt: now, operation: "create" });
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
  const habit = await db.getFirstAsync<{ name: string; target_per_day: number }>(
    `SELECT name, target_per_day
     FROM habits
     WHERE id = ?
       AND deleted_at IS NULL`,
    [habitId],
  );
  const existing = await db.getFirstAsync<{ id: string; count: number }>(
    "SELECT id, count FROM habit_completions WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey],
  );
  const previousCount = existing?.count ?? 0;
  const nextCount = previousCount + 1;
  const completionId = existing?.id ?? createId("hcmp");

  if (existing) {
    await db.runAsync("UPDATE habit_completions SET count = ?, updated_at = ? WHERE id = ?", [
      nextCount,
      now,
      existing.id,
    ]);
  } else {
    await db.runAsync(
      "INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
      [completionId, habitId, dateKey, now, now],
    );
  }

  if (!habit || previousCount >= habit.target_per_day || nextCount < habit.target_per_day) {
    return {
      count: nextCount,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const linkedActions = await linkedActionsEngine.handleSourceEvent({
    occurredAt: now,
    origin: {
      originKind: "user",
      originRuleId: null,
      originEventId: null,
    },
    source: {
      feature: "habits",
      entityType: "habit",
      entityId: habitId,
      label: habit.name,
      triggerType: "habit.completed_for_day",
      dateKey,
      recordId: completionId,
    },
    payload: {
      previousCount,
      currentCount: nextCount,
      targetPerDay: habit.target_per_day,
    },
  });

  return {
    count: nextCount,
    linkedActions,
  };
}

export async function decrementHabit(habitId: string, dateKey = toDateKey()): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const existing = await db.getFirstAsync<{ id: string; count: number }>(
    "SELECT id, count FROM habit_completions WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey],
  );
  if (!existing || existing.count <= 0) return;
  if (existing.count === 1) {
    // Hard delete intentional: habit_completions is a toggle-off
    // operation (non-synced entity, allowed exception per db-and-sync-invariants)
    await db.runAsync("DELETE FROM habit_completions WHERE id = ?", [existing.id]);
    return;
  }
  await db.runAsync("UPDATE habit_completions SET count = ?, updated_at = ? WHERE id = ?", [
    existing.count - 1,
    now,
    existing.id,
  ]);
}

export async function getHabitCountByDate(habitId: string, dateKey = toDateKey()): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?",
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
  days: number = 30,
): Promise<HabitCompletion[]> {
  const db = await getDatabase();

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
  },
): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE habits SET name = ?, target_per_day = ?, category = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?",
    [
      updates.name,
      updates.targetPerDay,
      updates.category,
      updates.icon ?? DEFAULT_HABIT_ICON,
      updates.color ?? DEFAULT_HABIT_COLOR,
      now,
      habitId,
    ],
  );
  syncEngine.enqueue({ entity: "habits", id: habitId, updatedAt: now, operation: "update" });
}

export async function deleteHabit(habitId: string): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync("UPDATE habits SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, habitId]);
  syncEngine.enqueue({ entity: "habits", id: habitId, updatedAt: now, operation: "delete" });
}

async function getLinkedActionHabitTarget(habitId: string) {
  const db = await getDatabase();
  const habit = await db.getFirstAsync<Pick<Habit, "id" | "name" | "target_per_day" | "deleted_at">>(
    `SELECT id, name, target_per_day, deleted_at
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
    return { status: "skipped", reason: "target_missing" };
  }

  if (input.amount <= 0) {
    return {
      status: "skipped",
      reason: "invalid_amount",
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
      [createId("hcmp"), input.habitId, input.dateKey, input.amount, now, now],
    );
  }

  return {
    status: "applied",
    targetLabel: habit.name,
  };
}

export async function ensureHabitDailyTargetFromLinkedAction(input: {
  habitId: string;
  minimumCount: number | "target_per_day";
  dateKey: string;
}): Promise<LinkedActionEffectAdapterResult> {
  const { db, habit } = await getLinkedActionHabitTarget(input.habitId);
  if (!habit || habit.deleted_at !== null) {
    return { status: "skipped", reason: "target_missing" };
  }

  const desiredCount = Math.max(
    0,
    input.minimumCount === "target_per_day" ? habit.target_per_day : input.minimumCount,
  );
  if (desiredCount === 0) {
    return {
      status: "skipped",
      reason: "already_satisfied",
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
      status: "skipped",
      reason: "already_satisfied",
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
      [createId("hcmp"), input.habitId, input.dateKey, desiredCount, now, now],
    );
  }

  return {
    status: "applied",
    targetLabel: habit.name,
  };
}
