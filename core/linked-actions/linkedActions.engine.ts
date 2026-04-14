import { createId } from "@/lib/id";
import {
  createLinkedActionEvent,
  createLinkedActionExecution,
  getLinkedActionEvent,
  getLinkedActionExecutionByChainFingerprint,
  getLinkedActionExecutionByRuleAndSourceEvent,
  listMatchingLinkedActionRules,
  updateLinkedActionExecution,
} from "@/core/linked-actions/linkedActions.data";
import {
  linkedActionEffectRegistry,
  type LinkedActionEffectExecutor,
} from "@/core/linked-actions/linkedActions.effects";
import {
  createLinkedActionsNoticeFromPayload,
} from "@/core/linked-actions/linkedActionsNotice";
import {
  isAllowedLinkedActionSourceEntity,
  isAllowedLinkedActionTrigger,
  serializeLinkedActionEffectPayload,
  type LinkedActionEffectPlan,
  type LinkedActionEffectResult,
  type LinkedActionExecutionRecord,
  type LinkedActionOriginMetadata,
  type LinkedActionProcessMode,
  type LinkedActionProcessResult,
  type LinkedActionRuleDefinition,
  type LinkedActionSourceAction,
  type LinkedActionSourceActionInput,
} from "@/core/linked-actions/linkedActions.types";
import type { AppNotice, LinkedActionsNoticePayload } from "@/core/notifications/inAppNotices.types";

type LinkedActionsEngineOptions = {
  effectRegistry?: Partial<Record<string, LinkedActionEffectExecutor>>;
  onNotice?: (notice: AppNotice) => void | Promise<void>;
};

const TAB_HREF_BY_FEATURE = {
  todos: "/(tabs)/todos",
  habits: "/(tabs)/habits",
  calories: "/(tabs)/calories",
  workout: "/(tabs)/workout",
  pomodoro: "/(tabs)/pomodoro",
} as const;

function featureLabel(feature: keyof typeof TAB_HREF_BY_FEATURE) {
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

function inferProducedEntityPlan(
  rule: LinkedActionRuleDefinition,
): Pick<LinkedActionEffectPlan, "plannedProducedEntityType" | "plannedProducedEntityId"> {
  switch (rule.target.effect.type) {
    case "calorie.log":
      return {
        plannedProducedEntityType: "calorie_log",
        plannedProducedEntityId: createId("cal"),
      };
    case "workout.log":
      return {
        plannedProducedEntityType: "workout_log",
        plannedProducedEntityId: createId("wrk"),
      };
    case "pomodoro.log":
      return {
        plannedProducedEntityType: "pomodoro_session",
        plannedProducedEntityId: createId("pom"),
      };
    default:
      return {
        plannedProducedEntityType: null,
        plannedProducedEntityId: null,
      };
  }
}

function buildEffectFingerprint(rule: LinkedActionRuleDefinition) {
  return [
    rule.id,
    rule.target.feature,
    rule.target.entityType,
    rule.target.entityId ?? "none",
    rule.target.effect.type,
    serializeLinkedActionEffectPayload(rule.target.effect),
  ].join("|");
}

function normalizeOrigin(
  origin: LinkedActionSourceActionInput["origin"],
): LinkedActionOriginMetadata {
  return {
    originKind: origin?.originKind ?? "user",
    originRuleId: origin?.originRuleId ?? null,
    originEventId: origin?.originEventId ?? null,
  };
}

function normalizeSourceAction(input: LinkedActionSourceActionInput): LinkedActionSourceAction {
  if (!isAllowedLinkedActionSourceEntity(input.feature, input.entityType)) {
    throw new Error(
      `Source entity type ${input.entityType} is not allowed for feature ${input.feature}`,
    );
  }
  if (!isAllowedLinkedActionTrigger(input.entityType, input.triggerType)) {
    throw new Error(
      `Trigger ${input.triggerType} is not allowed for source entity ${input.entityType}`,
    );
  }

  const eventId = input.eventId ?? createId("levt");
  const origin = normalizeOrigin(input.origin);
  const chainId = input.chain?.chainId ?? createId("lchain");
  const rootEventId = input.chain?.rootEventId ?? eventId;
  const parentEventId = input.chain?.parentEventId ?? origin.originEventId ?? null;
  const depth = input.chain?.depth ?? (origin.originKind === "linked_action" ? 1 : 0);

  return {
    eventId,
    feature: input.feature,
    entityType: input.entityType,
    entityId: input.entityId,
    triggerType: input.triggerType,
    sourceRecordId: input.sourceRecordId ?? null,
    sourceDateKey: input.sourceDateKey ?? null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    label: input.label ?? null,
    payload: input.payload ?? {},
    origin,
    chain: {
      chainId,
      rootEventId,
      parentEventId,
      depth,
    },
  };
}

function buildNoticePayload(
  plan: LinkedActionEffectPlan,
  status: "planned" | "applied",
  targetLabel?: string | null,
): LinkedActionsNoticePayload {
  const sourceLabel =
    plan.sourceEvent.label ??
    plan.sourceEvent.entityId ??
    featureLabel(plan.rule.source.feature);
  const resolvedTargetLabel =
    targetLabel ??
    plan.rule.target.entityId ??
    plan.plannedProducedEntityId ??
    featureLabel(plan.rule.target.feature);

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

function buildPlan(
  sourceEvent: LinkedActionSourceAction,
  rule: LinkedActionRuleDefinition,
): LinkedActionEffectPlan {
  const produced = inferProducedEntityPlan(rule);
  const plan: LinkedActionEffectPlan = {
    sourceEvent,
    rule,
    chain: sourceEvent.chain,
    origin: sourceEvent.origin,
    effectFingerprint: buildEffectFingerprint(rule),
    plannedProducedEntityType: produced.plannedProducedEntityType,
    plannedProducedEntityId: produced.plannedProducedEntityId,
    noticePreview: null,
  };

  return {
    ...plan,
    noticePreview: buildNoticePayload(plan, "planned"),
  };
}

function mapExecutionToDuplicateResult(
  execution: LinkedActionExecutionRecord,
  plan: LinkedActionEffectPlan,
  reason: string,
): LinkedActionEffectResult {
  const notice = execution.noticePayload
    ? createLinkedActionsNoticeFromPayload(execution.noticePayload)
    : null;

  return {
    executionId: execution.id,
    ruleId: plan.rule.id,
    status: "duplicate",
    effectType: plan.rule.target.effect.type,
    effectFingerprint: plan.effectFingerprint,
    targetFeature: plan.rule.target.feature,
    targetEntityType: plan.rule.target.entityType,
    targetEntityId: plan.rule.target.entityId,
    producedEntityType: execution.producedEntityType,
    producedEntityId: execution.producedEntityId,
    reason,
    errorMessage: null,
    notice,
    noticePreview: execution.noticePayload ?? plan.noticePreview,
  };
}

export class LinkedActionsEngine {
  private readonly effectRegistry: Record<string, LinkedActionEffectExecutor>;

  constructor(private readonly options: LinkedActionsEngineOptions = {}) {
    this.effectRegistry = {
      ...linkedActionEffectRegistry,
      ...(options.effectRegistry ?? {}),
    } as Record<string, LinkedActionEffectExecutor>;
  }

  async processSourceAction(
    input: LinkedActionSourceActionInput,
    mode: LinkedActionProcessMode = "apply",
  ): Promise<LinkedActionProcessResult> {
    const normalizedEvent = normalizeSourceAction(input);
    const sourceEvent =
      mode === "apply"
        ? ((await getLinkedActionEvent(normalizedEvent.eventId)) ??
          (await createLinkedActionEvent(normalizedEvent)))
        : normalizedEvent;

    const rules = await listMatchingLinkedActionRules(sourceEvent);
    const plans = rules.map((rule) => buildPlan(sourceEvent, rule));

    if (mode === "plan") {
      return {
        mode,
        sourceEvent,
        matchedRuleCount: rules.length,
        notices: [],
        effects: plans.map((plan) => ({
          executionId: null,
          ruleId: plan.rule.id,
          status: "planned",
          effectType: plan.rule.target.effect.type,
          effectFingerprint: plan.effectFingerprint,
          targetFeature: plan.rule.target.feature,
          targetEntityType: plan.rule.target.entityType,
          targetEntityId: plan.rule.target.entityId,
          producedEntityType: plan.plannedProducedEntityType,
          producedEntityId: plan.plannedProducedEntityId,
          reason: null,
          errorMessage: null,
          notice: null,
          noticePreview: plan.noticePreview,
        })),
      };
    }

    const effects: LinkedActionEffectResult[] = [];
    const notices: AppNotice[] = [];

    for (const plan of plans) {
      const priorExecution = await getLinkedActionExecutionByRuleAndSourceEvent(
        plan.rule.id,
        sourceEvent.eventId,
      );
      if (priorExecution) {
        effects.push(
          mapExecutionToDuplicateResult(
            priorExecution,
            plan,
            "source_event_already_executed",
          ),
        );
        continue;
      }

      const chainGuardHit = await getLinkedActionExecutionByChainFingerprint(
        sourceEvent.chain.chainId,
        plan.rule.id,
        plan.effectFingerprint,
      );
      if (chainGuardHit) {
        effects.push(
          mapExecutionToDuplicateResult(chainGuardHit, plan, "chain_guard_duplicate"),
        );
        continue;
      }

      const execution = await createLinkedActionExecution({
        ruleId: plan.rule.id,
        sourceEventId: sourceEvent.eventId,
        chainId: sourceEvent.chain.chainId,
        rootEventId: sourceEvent.chain.rootEventId,
        originRuleId: sourceEvent.origin.originRuleId,
        effectType: plan.rule.target.effect.type,
        effectFingerprint: plan.effectFingerprint,
        status: "planned",
        targetFeature: plan.rule.target.feature,
        targetEntityType: plan.rule.target.entityType,
        targetEntityId: plan.rule.target.entityId,
        producedEntityType: plan.plannedProducedEntityType,
        producedEntityId: plan.plannedProducedEntityId,
        noticePayload: null,
        errorMessage: null,
      });

      try {
        const executor = this.effectRegistry[plan.rule.target.effect.type];
        if (!executor) {
          throw new Error(
            `No linked action executor registered for ${plan.rule.target.effect.type}`,
          );
        }

        const outcome = await executor(plan);
        const producedEntityType =
          outcome.producedEntityType ?? plan.plannedProducedEntityType;
        const producedEntityId =
          outcome.producedEntityId ?? plan.plannedProducedEntityId;
        const noticePayload =
          outcome.status === "applied"
            ? buildNoticePayload(plan, "applied", outcome.targetLabel)
            : null;

        await updateLinkedActionExecution(execution.id, {
          status: outcome.status,
          producedEntityType,
          producedEntityId,
          noticePayload,
          errorMessage: null,
        });

        const notice = noticePayload
          ? createLinkedActionsNoticeFromPayload(noticePayload)
          : null;
        if (notice) {
          notices.push(notice);
          await Promise.resolve(this.options.onNotice?.(notice));
        }

        effects.push({
          executionId: execution.id,
          ruleId: plan.rule.id,
          status: outcome.status,
          effectType: plan.rule.target.effect.type,
          effectFingerprint: plan.effectFingerprint,
          targetFeature: plan.rule.target.feature,
          targetEntityType: plan.rule.target.entityType,
          targetEntityId: plan.rule.target.entityId,
          producedEntityType,
          producedEntityId,
          reason: outcome.reason ?? null,
          errorMessage: null,
          notice,
          noticePreview: noticePayload ?? plan.noticePreview,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown execution failure";
        await updateLinkedActionExecution(execution.id, {
          status: "failed",
          errorMessage: message,
        });

        effects.push({
          executionId: execution.id,
          ruleId: plan.rule.id,
          status: "failed",
          effectType: plan.rule.target.effect.type,
          effectFingerprint: plan.effectFingerprint,
          targetFeature: plan.rule.target.feature,
          targetEntityType: plan.rule.target.entityType,
          targetEntityId: plan.rule.target.entityId,
          producedEntityType: plan.plannedProducedEntityType,
          producedEntityId: plan.plannedProducedEntityId,
          reason: null,
          errorMessage: message,
          notice: null,
          noticePreview: plan.noticePreview,
        });
      }
    }

    return {
      mode,
      sourceEvent,
      matchedRuleCount: rules.length,
      effects,
      notices,
    };
  }
}

export const linkedActionsEngine = new LinkedActionsEngine();
