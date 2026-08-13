import { createId } from '@/lib/id';
import {
  createLinkedActionEvent,
  createLinkedActionExecution,
  claimLinkedActionExecution,
  getAppliedHabitIncrementExecution,
  getAppliedHabitDayCalorieExecution,
  getLinkedActionEvent,
  getLinkedActionExecutionByChainFingerprint,
  getLinkedActionExecutionByRuleAndSourceEvent,
  listMatchingLinkedActionRules,
  updateLinkedActionExecution,
} from '@/core/linked-actions/linkedActions.data';
import {
  linkedActionEffectRegistry,
  type LinkedActionEffectExecutor,
} from '@/core/linked-actions/linkedActions.effects';
import {
  buildLinkedActionsNoticePayload,
  createLinkedActionsNoticeFromPayload,
} from '@/core/linked-actions/linkedActionsNotice';
import {
  isAllowedLinkedActionSourceEntity,
  isAllowedLinkedActionTrigger,
  isSupportedLinkedActionRule,
  serializeLinkedActionEffectPayload,
  type LinkedActionEffectPlan,
  type LinkedActionEffectResult,
  type LinkedActionExecutionRecord,
  type LinkedActionOriginMetadata,
  type LinkedActionProcessMode,
  type LinkedActionProcessResult,
  type LinkedActionRuleDefinition,
  type LinkedActionSupportedRuleDefinition,
  type LinkedActionSourceAction,
  type LinkedActionSourceActionInput,
} from '@/core/linked-actions/linkedActions.types';
import type { AppNotice } from '@/core/notifications/inAppNotices.types';

type LinkedActionsEngineOptions = {
  effectRegistry?: Partial<Record<string, LinkedActionEffectExecutor>>;
  onNotice?: (notice: AppNotice) => void | Promise<void>;
  /** Deterministic fault hooks used by recovery tests and diagnostics. */
  beforeEffect?: (executionId: string, plan: LinkedActionEffectPlan) => void | Promise<void>;
  afterEffectBeforeFinalize?: (
    executionId: string,
    plan: LinkedActionEffectPlan,
  ) => void | Promise<void>;
};

export class LinkedActionCrashError extends Error {
  constructor(message = 'Simulated process crash') {
    super(message);
    this.name = 'LinkedActionCrashError';
  }
}

const EXECUTION_STALE_AFTER_MS = 5 * 60 * 1000;

function executionIsTerminal(execution: LinkedActionExecutionRecord): boolean {
  return execution.status === 'applied' || execution.status === 'skipped';
}

function staleExecutionCutoff(): string {
  return new Date(Date.now() - EXECUTION_STALE_AFTER_MS).toISOString();
}

function inferProducedEntityPlan(
  rule: LinkedActionSupportedRuleDefinition,
): Pick<LinkedActionEffectPlan, 'plannedProducedEntityType' | 'plannedProducedEntityId'> {
  switch (rule.target.effect.type) {
    case 'calorie.log':
      return {
        plannedProducedEntityType: 'calorie_log',
        plannedProducedEntityId: createId('cal'),
      };
    case 'workout.log':
      return {
        plannedProducedEntityType: 'workout_log',
        plannedProducedEntityId: createId('wrk'),
      };
    case 'pomodoro.log':
      return {
        plannedProducedEntityType: 'pomodoro_session',
        plannedProducedEntityId: createId('pom'),
      };
    default:
      return {
        plannedProducedEntityType: null,
        plannedProducedEntityId: null,
      };
  }
}

function buildEffectFingerprint(rule: LinkedActionSupportedRuleDefinition) {
  return [
    rule.id,
    rule.target.feature,
    rule.target.entityType,
    rule.target.entityId ?? 'none',
    rule.target.effect.type,
    serializeLinkedActionEffectPayload(rule.target.effect),
  ].join('|');
}

function normalizeOrigin(
  origin: LinkedActionSourceActionInput['origin'],
): LinkedActionOriginMetadata {
  return {
    originKind: origin?.originKind ?? 'user',
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

  const eventId = input.eventId ?? createId('levt');
  const origin = normalizeOrigin(input.origin);
  const chainId = input.chain?.chainId ?? createId('lchain');
  const rootEventId = input.chain?.rootEventId ?? eventId;
  const parentEventId = input.chain?.parentEventId ?? origin.originEventId ?? null;
  const depth = input.chain?.depth ?? (origin.originKind === 'linked_action' ? 1 : 0);

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

async function findPriorAppliedExecutionForFirstRealPath(
  plan: LinkedActionEffectPlan,
): Promise<LinkedActionExecutionRecord | null> {
  if (plan.rule.target.effect.type !== 'calorie.log') {
    return null;
  }
  if (
    plan.sourceEvent.feature !== 'habits' ||
    plan.sourceEvent.entityType !== 'habit' ||
    plan.sourceEvent.triggerType !== 'habit.completed_for_day' ||
    !plan.sourceEvent.entityId ||
    !plan.sourceEvent.sourceDateKey
  ) {
    return null;
  }

  return getAppliedHabitDayCalorieExecution(
    plan.rule.id,
    plan.sourceEvent.entityId,
    plan.sourceEvent.sourceDateKey,
  );
}

async function findPriorAppliedExecutionForStableSourceIdentity(
  plan: LinkedActionEffectPlan,
): Promise<LinkedActionExecutionRecord | null> {
  if (plan.rule.target.effect.type !== 'habit.increment') {
    return null;
  }

  const sourceEvent = plan.sourceEvent;
  if (!sourceEvent.entityId || !sourceEvent.sourceDateKey) {
    return null;
  }

  return getAppliedHabitIncrementExecution(
    plan.rule.id,
    sourceEvent.feature,
    sourceEvent.entityType,
    sourceEvent.entityId,
    sourceEvent.triggerType,
    sourceEvent.sourceDateKey,
  );
}

function isSelfTargetNoop(plan: LinkedActionEffectPlan): boolean {
  if (plan.rule.target.effect.type !== 'todo.complete') {
    return false;
  }

  return (
    plan.sourceEvent.feature === 'todos' &&
    plan.sourceEvent.entityType === 'todo' &&
    Boolean(plan.sourceEvent.entityId) &&
    plan.sourceEvent.entityId === plan.rule.target.entityId
  );
}

function buildPlan(
  sourceEvent: LinkedActionSourceAction,
  rule: LinkedActionSupportedRuleDefinition,
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
    noticePreview: buildLinkedActionsNoticePayload(plan, 'planned'),
  };
}

function buildUnsupportedRuleEffectFingerprint(rule: LinkedActionRuleDefinition) {
  return [
    rule.id,
    rule.rawTargetFeature,
    rule.rawTargetEntityType,
    rule.target.entityId ?? 'none',
    rule.rawEffectType,
  ].join('|');
}

function buildUnsupportedRuleResult(rule: LinkedActionRuleDefinition): LinkedActionEffectResult {
  console.warn('Skipping unsupported linked action rule', {
    ruleId: rule.id,
    targetFeature: rule.rawTargetFeature,
    targetEntityType: rule.rawTargetEntityType,
    effectType: rule.rawEffectType,
  });

  return {
    executionId: null,
    ruleId: rule.id,
    status: 'skipped',
    effectType: rule.rawEffectType,
    effectFingerprint: buildUnsupportedRuleEffectFingerprint(rule),
    targetFeature: rule.rawTargetFeature,
    targetEntityType: rule.rawTargetEntityType,
    targetEntityId: rule.target.entityId,
    producedEntityType: null,
    producedEntityId: null,
    reason: 'unsupported_rule',
    errorMessage: rule.unsupportedReason,
    notice: null,
    noticePreview: null,
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
    status: 'duplicate',
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
    mode: LinkedActionProcessMode = 'apply',
  ): Promise<LinkedActionProcessResult> {
    const normalizedEvent = normalizeSourceAction(input);
    const sourceEvent =
      mode === 'apply'
        ? ((await getLinkedActionEvent(normalizedEvent.eventId)) ??
          (await createLinkedActionEvent(normalizedEvent)))
        : normalizedEvent;

    const rules = await listMatchingLinkedActionRules(sourceEvent);
    const effects: LinkedActionEffectResult[] = [];
    const notices: AppNotice[] = [];

    for (const rule of rules) {
      if (!isSupportedLinkedActionRule(rule)) {
        effects.push(buildUnsupportedRuleResult(rule));
        continue;
      }

      const plan = buildPlan(sourceEvent, rule);

      if (mode === 'plan') {
        effects.push({
          executionId: null,
          ruleId: plan.rule.id,
          status: 'planned',
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
        });
        continue;
      }

      let execution: LinkedActionExecutionRecord | null = null;
      let executionPlan = plan;

      const recoverOrDedupe = (candidate: LinkedActionExecutionRecord, reason: string): boolean => {
        if (executionIsTerminal(candidate)) {
          effects.push(mapExecutionToDuplicateResult(candidate, executionPlan, reason));
          return true;
        }
        if (
          candidate.status === 'running' &&
          new Date(candidate.updatedAt).getTime() > Date.now() - EXECUTION_STALE_AFTER_MS
        ) {
          effects.push(
            mapExecutionToDuplicateResult(candidate, executionPlan, 'execution_in_progress'),
          );
          return true;
        }
        execution = candidate;
        executionPlan = {
          ...executionPlan,
          executionId: candidate.id,
          plannedProducedEntityId:
            candidate.producedEntityId ?? executionPlan.plannedProducedEntityId,
          plannedProducedEntityType:
            candidate.producedEntityType ?? executionPlan.plannedProducedEntityType,
        };
        return false;
      };

      const priorExecution = await getLinkedActionExecutionByRuleAndSourceEvent(
        plan.rule.id,
        sourceEvent.eventId,
      );
      if (priorExecution && recoverOrDedupe(priorExecution, 'source_event_already_executed')) {
        continue;
      }

      if (!execution) {
        const chainGuardHit = await getLinkedActionExecutionByChainFingerprint(
          sourceEvent.chain.chainId,
          plan.rule.id,
          plan.effectFingerprint,
        );
        if (chainGuardHit && recoverOrDedupe(chainGuardHit, 'chain_guard_duplicate')) continue;
      }

      if (!execution) {
        const priorStableSourceExecution =
          await findPriorAppliedExecutionForStableSourceIdentity(plan);
        if (
          priorStableSourceExecution &&
          recoverOrDedupe(priorStableSourceExecution, 'source_identity_already_executed')
        ) {
          continue;
        }
      }

      if (!execution) {
        const priorAppliedExecution = await findPriorAppliedExecutionForFirstRealPath(plan);
        if (
          priorAppliedExecution &&
          recoverOrDedupe(priorAppliedExecution, 'habit_day_already_logged')
        ) {
          continue;
        }
      }

      if (isSelfTargetNoop(plan)) {
        effects.push({
          executionId: null,
          ruleId: plan.rule.id,
          status: 'skipped',
          effectType: plan.rule.target.effect.type,
          effectFingerprint: plan.effectFingerprint,
          targetFeature: plan.rule.target.feature,
          targetEntityType: plan.rule.target.entityType,
          targetEntityId: plan.rule.target.entityId,
          producedEntityType: null,
          producedEntityId: null,
          reason: 'self_target_noop',
          errorMessage: null,
          notice: null,
          noticePreview: null,
        });
        continue;
      }

      if (!execution) {
        execution = await createLinkedActionExecution({
          ruleId: executionPlan.rule.id,
          sourceEventId: sourceEvent.eventId,
          chainId: sourceEvent.chain.chainId,
          rootEventId: sourceEvent.chain.rootEventId,
          originRuleId: sourceEvent.origin.originRuleId,
          effectType: executionPlan.rule.target.effect.type,
          effectFingerprint: executionPlan.effectFingerprint,
          status: 'planned',
          targetFeature: executionPlan.rule.target.feature,
          targetEntityType: executionPlan.rule.target.entityType,
          targetEntityId: executionPlan.rule.target.entityId,
          producedEntityType: executionPlan.plannedProducedEntityType,
          producedEntityId: executionPlan.plannedProducedEntityId,
          noticePayload: null,
          errorMessage: null,
        });
        executionPlan = {
          ...executionPlan,
          executionId: execution.id,
        };
      }

      const claimed = await claimLinkedActionExecution(execution.id, staleExecutionCutoff());
      if (!claimed) {
        const current = await getLinkedActionExecutionByRuleAndSourceEvent(
          executionPlan.rule.id,
          sourceEvent.eventId,
        );
        if (current) {
          effects.push(
            mapExecutionToDuplicateResult(current, executionPlan, 'execution_in_progress'),
          );
        }
        continue;
      }

      try {
        await Promise.resolve(this.options.beforeEffect?.(execution.id, executionPlan));
        const executor = this.effectRegistry[executionPlan.rule.target.effect.type];
        if (!executor) {
          throw new Error(
            `No linked action executor registered for ${executionPlan.rule.target.effect.type}`,
          );
        }

        const outcome = await executor(executionPlan);
        await Promise.resolve(
          this.options.afterEffectBeforeFinalize?.(execution.id, executionPlan),
        );
        const producedEntityType =
          outcome.producedEntityType ?? executionPlan.plannedProducedEntityType;
        const producedEntityId = outcome.producedEntityId ?? executionPlan.plannedProducedEntityId;
        const noticePayload =
          outcome.status === 'applied'
            ? buildLinkedActionsNoticePayload(executionPlan, 'applied', outcome.targetLabel)
            : null;

        await updateLinkedActionExecution(execution.id, {
          ...(outcome.executionFinalized ? {} : { status: outcome.status }),
          producedEntityType,
          producedEntityId,
          noticePayload,
          errorMessage: null,
        });

        const notice = noticePayload ? createLinkedActionsNoticeFromPayload(noticePayload) : null;
        if (notice) {
          notices.push(notice);
          await Promise.resolve(this.options.onNotice?.(notice));
        }

        effects.push({
          executionId: execution.id,
          ruleId: executionPlan.rule.id,
          status: outcome.status,
          effectType: executionPlan.rule.target.effect.type,
          effectFingerprint: executionPlan.effectFingerprint,
          targetFeature: executionPlan.rule.target.feature,
          targetEntityType: executionPlan.rule.target.entityType,
          targetEntityId: executionPlan.rule.target.entityId,
          producedEntityType,
          producedEntityId,
          reason: outcome.reason ?? null,
          errorMessage: null,
          notice,
          noticePreview: noticePayload ?? executionPlan.noticePreview,
        });
      } catch (error) {
        if (error instanceof LinkedActionCrashError) throw error;
        const message = error instanceof Error ? error.message : 'Unknown execution failure';
        await updateLinkedActionExecution(execution.id, {
          status: 'failed',
          errorMessage: message,
        });

        effects.push({
          executionId: execution.id,
          ruleId: executionPlan.rule.id,
          status: 'failed',
          effectType: executionPlan.rule.target.effect.type,
          effectFingerprint: executionPlan.effectFingerprint,
          targetFeature: executionPlan.rule.target.feature,
          targetEntityType: executionPlan.rule.target.entityType,
          targetEntityId: executionPlan.rule.target.entityId,
          producedEntityType: executionPlan.plannedProducedEntityType,
          producedEntityId: executionPlan.plannedProducedEntityId,
          reason: null,
          errorMessage: message,
          notice: null,
          noticePreview: executionPlan.noticePreview,
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
