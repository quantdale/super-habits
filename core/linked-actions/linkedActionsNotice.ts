import type { AppNotice, LinkedActionsNoticePayload } from "@/core/notifications/inAppNotices.types";
import type { LinkedActionEffectPlan, LinkedActionFeature } from "@/core/linked-actions/linkedActions.types";

type CreateLinkedActionsNoticeInput = {
  message: string;
  reason: string;
  source: LinkedActionsNoticePayload["source"];
  target: LinkedActionsNoticePayload["target"];
  destination?: LinkedActionsNoticePayload["destination"];
  onPress?: () => void;
};

function createInAppNoticeId() {
  return `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TAB_HREF_BY_FEATURE = {
  todos: "/(tabs)/todos",
  habits: "/(tabs)/habits",
  calories: "/(tabs)/calories",
  workout: "/(tabs)/workout",
  pomodoro: "/(tabs)/pomodoro",
} as const;

function getLinkedActionFeatureSingularLabel(feature: LinkedActionFeature) {
  switch (feature) {
    case "todos":
      return "Todo";
    case "habits":
      return "Habit";
    case "calories":
      return "Calories";
    case "workout":
      return "Workout";
    case "pomodoro":
      return "Pomodoro";
  }
}

export function createLinkedActionsNotice({
  message,
  reason,
  source,
  target,
  destination,
  onPress,
}: CreateLinkedActionsNoticeInput): AppNotice {
  return {
    id: createInAppNoticeId(),
    createdAt: new Date().toISOString(),
    onPress,
    payload: {
      kind: "linked-actions",
      message,
      reason,
      source,
      target,
      destination,
    },
  };
}

export function createLinkedActionsNoticeFromPayload(
  payload: LinkedActionsNoticePayload,
  onPress?: () => void,
): AppNotice {
  return {
    id: createInAppNoticeId(),
    createdAt: new Date().toISOString(),
    onPress,
    payload,
  };
}

export function buildLinkedActionsNoticePayload(
  plan: LinkedActionEffectPlan,
  status: "planned" | "applied",
  targetLabel?: string | null,
): LinkedActionsNoticePayload {
  const sourceLabel =
    plan.sourceEvent.label ??
    plan.sourceEvent.entityId ??
    getLinkedActionFeatureSingularLabel(plan.rule.source.feature);
  const resolvedTargetLabel =
    targetLabel ??
    plan.rule.target.entityId ??
    plan.plannedProducedEntityId ??
    getLinkedActionFeatureSingularLabel(plan.rule.target.feature);

  if (plan.rule.target.effect.type === "calorie.log") {
    return {
      kind: "linked-actions",
      message:
        status === "planned"
          ? `Linked Actions will log ${resolvedTargetLabel}.`
          : `Linked Actions logged ${resolvedTargetLabel}.`,
      reason:
        status === "planned"
          ? `${sourceLabel} will add a calorie entry when it completes for the day.`
          : `${sourceLabel} completed for the day and added a calorie entry.`,
      source: {
        feature: plan.rule.source.feature,
        entityType: plan.rule.source.entityType,
        entityId: plan.sourceEvent.entityId ?? undefined,
        label: sourceLabel,
      },
      target: {
        feature: plan.rule.target.feature,
        entityType: plan.rule.target.entityType,
        entityId:
          plan.rule.target.entityId ??
          plan.plannedProducedEntityId ??
          undefined,
        label: resolvedTargetLabel,
      },
      destination: {
        kind: "linked-actions-target",
        href: TAB_HREF_BY_FEATURE[plan.rule.target.feature],
        feature: plan.rule.target.feature,
        entityType: plan.rule.target.entityType,
        entityId:
          plan.rule.target.entityId ??
          plan.plannedProducedEntityId ??
          undefined,
        label: resolvedTargetLabel,
      },
    };
  }

  const verb = status === "planned" ? "planned" : "updated";
  const reasonVerb = status === "planned" ? "will apply" : "applied";

  return {
    kind: "linked-actions",
    message: `Linked Actions ${verb} ${resolvedTargetLabel}.`,
    reason: `${sourceLabel} ${reasonVerb} ${plan.rule.target.effect.type}.`,
    source: {
      feature: plan.rule.source.feature,
      entityType: plan.rule.source.entityType,
      entityId: plan.sourceEvent.entityId ?? undefined,
      label: sourceLabel,
    },
    target: {
      feature: plan.rule.target.feature,
      entityType: plan.rule.target.entityType,
      entityId:
        plan.rule.target.entityId ??
        plan.plannedProducedEntityId ??
        undefined,
      label: resolvedTargetLabel,
    },
    destination: {
      kind: "linked-actions-target",
      href: TAB_HREF_BY_FEATURE[plan.rule.target.feature],
      feature: plan.rule.target.feature,
      entityType: plan.rule.target.entityType,
      entityId:
        plan.rule.target.entityId ??
        plan.plannedProducedEntityId ??
        undefined,
      label: resolvedTargetLabel,
    },
  };
}
