import type {
  LinkedActionCalorieLogEffectDefinition,
  LinkedActionEffectAdapterResult,
  LinkedActionEffectPlan,
  LinkedActionHabitEnsureTargetEffectDefinition,
  LinkedActionHabitIncrementEffectDefinition,
  LinkedActionPomodoroLogEffectDefinition,
  LinkedActionWorkoutLogEffectDefinition,
} from "@/core/linked-actions/linkedActions.types";
import { toDateKey } from "@/lib/time";
import { addCalorieEntryFromLinkedAction } from "@/features/calories/calories.data";
import {
  ensureHabitDailyTargetFromLinkedAction,
  incrementHabitFromLinkedAction,
} from "@/features/habits/habits.data";
import { logPomodoroSessionFromLinkedAction } from "@/features/pomodoro/pomodoro.data";
import { completeTodoFromLinkedAction } from "@/features/todos/todos.data";
import { logWorkoutFromLinkedAction } from "@/features/workout/workout.data";

export type LinkedActionEffectExecutor = (
  plan: LinkedActionEffectPlan,
) => Promise<LinkedActionEffectAdapterResult>;

function resolveDateKey(plan: LinkedActionEffectPlan, strategy: "today" | "source_date") {
  if (strategy === "source_date" && plan.sourceEvent.sourceDateKey) {
    return plan.sourceEvent.sourceDateKey;
  }
  if (strategy === "source_date") {
    return toDateKey(new Date(plan.sourceEvent.occurredAt));
  }
  return toDateKey();
}

export const linkedActionEffectRegistry: Record<string, LinkedActionEffectExecutor> = {
  "todo.complete": async (plan) => {
    const targetId = plan.rule.target.entityId;
    if (!targetId) {
      return { status: "skipped", reason: "missing_target_entity" };
    }
    return completeTodoFromLinkedAction(targetId);
  },
  "habit.increment": async (plan) => {
    const targetId = plan.rule.target.entityId;
    if (!targetId) {
      return { status: "skipped", reason: "missing_target_entity" };
    }
    const effect = plan.rule.target.effect as LinkedActionHabitIncrementEffectDefinition;
    return incrementHabitFromLinkedAction({
      habitId: targetId,
      amount: effect.amount,
      dateKey: resolveDateKey(plan, effect.dateStrategy),
    });
  },
  "habit.ensure_daily_target": async (plan) => {
    const targetId = plan.rule.target.entityId;
    if (!targetId) {
      return { status: "skipped", reason: "missing_target_entity" };
    }
    const effect = plan.rule.target.effect as LinkedActionHabitEnsureTargetEffectDefinition;
    return ensureHabitDailyTargetFromLinkedAction({
      habitId: targetId,
      minimumCount: effect.minimumCount,
      dateKey: resolveDateKey(plan, effect.dateStrategy),
    });
  },
  "calorie.log": async (plan) => {
    const effect = plan.rule.target.effect as LinkedActionCalorieLogEffectDefinition;
    if (!plan.plannedProducedEntityId) {
      return { status: "skipped", reason: "missing_planned_entity_id" };
    }
    return addCalorieEntryFromLinkedAction({
      id: plan.plannedProducedEntityId,
      foodName: effect.foodName,
      calories: effect.calories,
      protein: effect.protein,
      carbs: effect.carbs,
      fats: effect.fats,
      fiber: effect.fiber,
      mealType: effect.mealType,
      consumedOn: resolveDateKey(plan, effect.dateStrategy),
    });
  },
  "workout.log": async (plan) => {
    const targetId = plan.rule.target.entityId;
    if (!targetId) {
      return { status: "skipped", reason: "missing_target_entity" };
    }
    if (!plan.plannedProducedEntityId) {
      return { status: "skipped", reason: "missing_planned_entity_id" };
    }
    const effect = plan.rule.target.effect as LinkedActionWorkoutLogEffectDefinition;
    return logWorkoutFromLinkedAction({
      id: plan.plannedProducedEntityId,
      routineId: targetId,
      notes: effect.notes,
    });
  },
  "pomodoro.log": async (plan) => {
    if (!plan.plannedProducedEntityId) {
      return { status: "skipped", reason: "missing_planned_entity_id" };
    }
    const effect = plan.rule.target.effect as LinkedActionPomodoroLogEffectDefinition;
    return logPomodoroSessionFromLinkedAction({
      id: plan.plannedProducedEntityId,
      durationSeconds: effect.durationSeconds,
      type: effect.sessionType,
    });
  },
};
