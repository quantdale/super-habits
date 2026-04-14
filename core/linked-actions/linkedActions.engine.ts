import { getDatabase } from "@/core/db/client";
import { listActiveLinkedActionRulesForSource } from "@/core/linked-actions/linkedActions.data";
import type {
  LinkedActionOriginMetadata,
  LinkedActionRuleDefinition,
} from "@/core/linked-actions/linkedActions.types";
import { createLinkedActionsNotice } from "@/core/linked-actions/linkedActionsNotice";
import type { AppNotice } from "@/core/notifications/inAppNotices.types";

export type HabitCompletedSourceEvent = {
  occurredAt: string;
  origin: LinkedActionOriginMetadata;
  source: {
    feature: "habits";
    entityType: "habit";
    entityId: string;
    label: string | null;
    triggerType: "habit.completed_for_day";
    dateKey: string;
    recordId: string;
  };
  payload: {
    previousCount: number;
    currentCount: number;
    targetPerDay: number;
  };
};

export type LinkedActionsDispatchResult = {
  matchedRuleCount: number;
  dryRunRuleIds: string[];
  notices: AppNotice[];
};

const EMPTY_DISPATCH_RESULT: LinkedActionsDispatchResult = {
  matchedRuleCount: 0,
  dryRunRuleIds: [],
  notices: [],
};

export class LinkedActionsEngine {
  async handleSourceEvent(
    event: HabitCompletedSourceEvent,
  ): Promise<LinkedActionsDispatchResult> {
    if (event.origin.originKind !== "user") {
      return EMPTY_DISPATCH_RESULT;
    }

    const rules = await listActiveLinkedActionRulesForSource({
      feature: event.source.feature,
      entityType: event.source.entityType,
      entityId: event.source.entityId,
      triggerType: event.source.triggerType,
    });

    if (rules.length === 0) {
      return EMPTY_DISPATCH_RESULT;
    }

    const notices: AppNotice[] = [];
    const dryRunRuleIds: string[] = [];

    for (const rule of rules) {
      const notice = await this.createHabitDryRunNotice(rule, event);
      if (!notice) continue;
      dryRunRuleIds.push(rule.id);
      notices.push(notice);
    }

    return {
      matchedRuleCount: rules.length,
      dryRunRuleIds,
      notices,
    };
  }

  private async createHabitDryRunNotice(
    rule: LinkedActionRuleDefinition,
    event: HabitCompletedSourceEvent,
  ): Promise<AppNotice | null> {
    if (rule.target.feature !== "habits" || rule.target.entityType !== "habit") {
      return null;
    }

    if (
      rule.target.effect.type !== "habit.increment" &&
      rule.target.effect.type !== "habit.ensure_daily_target"
    ) {
      return null;
    }

    if (!rule.target.entityId) {
      return null;
    }

    const targetHabit = await this.getHabitNoticeContext(rule.target.entityId);
    if (!targetHabit) {
      return null;
    }

    const sourceLabel = event.source.label?.trim() || "Habit";
    const reason =
      rule.target.effect.type === "habit.increment"
        ? `${sourceLabel} reached its goal for ${event.source.dateKey}. Version 1 previews a single linked increment for ${targetHabit.label}.`
        : `${sourceLabel} reached its goal for ${event.source.dateKey}. Version 1 previews ensuring ${targetHabit.label} is complete for today.`;

    return createLinkedActionsNotice({
      message: `Linked Actions preview: ${sourceLabel} would update ${targetHabit.label}.`,
      reason,
      source: {
        feature: event.source.feature,
        entityType: event.source.entityType,
        entityId: event.source.entityId,
        label: event.source.label ?? undefined,
      },
      target: targetHabit,
      destination: {
        kind: "linked-actions-target",
        href: "/(tabs)/habits",
        feature: "habits",
        entityType: "habit",
        entityId: targetHabit.entityId,
        label: targetHabit.label,
      },
    });
  }

  private async getHabitNoticeContext(habitId: string) {
    const db = await getDatabase();
    const habit = await db.getFirstAsync<{ id: string; name: string }>(
      `SELECT id, name
       FROM habits
       WHERE id = ?
         AND deleted_at IS NULL`,
      [habitId],
    );

    if (!habit) {
      return null;
    }

    return {
      feature: "habits",
      entityType: "habit",
      entityId: habit.id,
      label: habit.name,
    } as const;
  }
}

export const linkedActionsEngine = new LinkedActionsEngine();
