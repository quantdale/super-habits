/**
 * Model validation (`add-user-simulation-platform` task 1.4).
 *
 * `validateSimulationModel` is a pure function: it takes a `SimulationModel`
 * and returns an array of `ValidationIssue`s (empty = valid). The caller (a
 * lane entry point, e.g. `sim:validate`) exits non-zero on a non-empty result
 * BEFORE touching a browser. Alongside the required-field, unknown-name, and
 * out-of-range checks, it enforces the spec's "Every step carries its own
 * oracles" rule: a mutating step must declare at least one oracle, and at least
 * one of those must be a persisted-row or second-surface check (`rows` or
 * `across-surfaces`) — a bare toast or list re-render is never the only
 * evidence.
 *
 * References are resolved against the model's own personas and workflows only
 * (no I/O), so dangling `personaId` / `workflowId` references fail here.
 */

import type {
  BehaviorParams,
  Oracle,
  Persona,
  Scenario,
  SemanticStep,
  SimulationModel,
  Workflow,
} from './types';
import {
  isKnownFeatureName,
  isKnownOracle,
  isKnownSectionName,
  isKnownStep,
  isMutatingStep,
  KNOWN_FEATURE_NAMES,
  KNOWN_SECTION_NAMES,
} from './steps';

/** A single validation finding, with a stable dot-path for tooling. */
export interface ValidationIssue {
  /** Dot-path into the model, e.g. `personas.daily-driver.behavior.mistakeRate`. */
  path: string;
  /** Human-readable description of the violation. */
  message: string;
}

const RATE_KEYS = [
  'mistakeRate',
  'doubleTapRate',
  'typoRate',
  'abandonmentRate',
  'offlineToggleRate',
  'tabHideRate',
] as const;

function push(issues: ValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

/** Validate the behavior parameters of a persona. */
function validateBehavior(
  issues: ValidationIssue[],
  personaPath: string,
  behavior: BehaviorParams,
): void {
  const path = `${personaPath}.behavior`;

  for (const key of RATE_KEYS) {
    const v = behavior[key];
    if (typeof v !== 'number' || Number.isNaN(v)) {
      push(issues, `${path}.${key}`, `must be a number, got ${String(v)}`);
    } else if (v < 0 || v > 1) {
      push(issues, `${path}.${key}`, `must be in [0, 1], got ${v}`);
    }
  }

  const tt = behavior.thinkTime;
  if (tt) {
    if (typeof tt.minMs !== 'number' || tt.minMs < 0) {
      push(issues, `${path}.thinkTime.minMs`, 'must be a number >= 0');
    }
    if (typeof tt.maxMs !== 'number' || tt.maxMs < tt.minMs) {
      push(issues, `${path}.thinkTime.maxMs`, `must be >= minMs (${tt.minMs})`);
    }
    if (typeof tt.sigma !== 'number' || tt.sigma < 0) {
      push(issues, `${path}.thinkTime.sigma`, 'must be a number >= 0');
    }
  }

  const sl = behavior.sessionLength;
  if (sl) {
    if (typeof sl.minMinutes !== 'number' || sl.minMinutes < 0) {
      push(issues, `${path}.sessionLength.minMinutes`, 'must be a number >= 0');
    }
    if (typeof sl.maxMinutes !== 'number' || sl.maxMinutes < sl.minMinutes) {
      push(issues, `${path}.sessionLength.maxMinutes`, `must be >= minMinutes (${sl.minMinutes})`);
    }
  }

  const affinity = behavior.featureAffinity;
  if (affinity) {
    for (const [feature, weight] of Object.entries(affinity)) {
      if (!isKnownFeatureName(feature)) {
        push(
          issues,
          `${path}.featureAffinity.${feature}`,
          `unknown feature name; known: ${KNOWN_FEATURE_NAMES.join(', ')}`,
        );
      }
      if (typeof weight !== 'number' || Number.isNaN(weight) || weight < 0) {
        push(issues, `${path}.featureAffinity.${feature}`, 'weight must be a number >= 0');
      }
    }
  }
}

/** Validate a single oracle and normalize its path prefix. */
function validateOracle(issues: ValidationIssue[], path: string, oracle: Oracle): void {
  if (!isKnownOracle(oracle)) {
    push(issues, path, `unknown oracle kind: ${String((oracle as { kind?: unknown }).kind)}`);
    return;
  }
  switch (oracle.kind) {
    case 'rows':
      if (typeof oracle.sql !== 'string' || oracle.sql.trim() === '') {
        push(issues, `${path}.sql`, 'rows oracle requires a non-empty sql string');
      }
      break;
    case 'across-surfaces':
      if (typeof oracle.text !== 'string' || oracle.text.trim() === '') {
        push(issues, `${path}.text`, 'across-surfaces oracle requires a non-empty text');
      }
      if (!Array.isArray(oracle.tabs) || oracle.tabs.length < 2) {
        push(issues, `${path}.tabs`, 'across-surfaces oracle requires >= 2 tabs');
      } else {
        for (const tab of oracle.tabs) {
          if (!isKnownSectionName(tab)) {
            push(
              issues,
              `${path}.tabs.${String(tab)}`,
              `unknown section; known: ${KNOWN_SECTION_NAMES.join(', ')}`,
            );
          }
        }
      }
      break;
    case 'outbox':
      if (oracle.expected !== undefined && !Array.isArray(oracle.expected)) {
        push(issues, `${path}.expected`, 'outbox oracle expected must be an array');
      }
      break;
    case 'unchanged':
      if (typeof oracle.sql !== 'string' || oracle.sql.trim() === '') {
        push(issues, `${path}.sql`, 'unchanged oracle requires a non-empty sql string');
      }
      break;
  }
}

/**
 * Evaluate the oracle requirements for a step. `path` is the step's location
 * (e.g. `scenarios.week.scenarios[0]`). A mutating step must declare >= 1 oracle
 * and at least one of them must be a persisted-row or second-surface check.
 */
function validateStepOracles(issues: ValidationIssue[], path: string, step: SemanticStep): void {
  const oracles = step.oracles ?? [];
  if (oracles.length === 0) {
    if (isMutatingStep(step.kind)) {
      push(
        issues,
        `${path}.oracles`,
        `mutating step '${step.kind}' declares no oracles; every mutating step must carry its own oracles`,
      );
    }
    return;
  }
  for (let i = 0; i < oracles.length; i++) {
    validateOracle(issues, `${path}.oracles[${i}]`, oracles[i]);
  }
  if (isMutatingStep(step.kind)) {
    const hasPersistedCheck = oracles.some(
      (o) => o.kind === 'rows' || o.kind === 'across-surfaces',
    );
    if (!hasPersistedCheck) {
      push(
        issues,
        `${path}.oracles`,
        `mutating step '${step.kind}' lacks a persisted-row or second-surface oracle (rows/across-surfaces)`,
      );
    }
  }
}

/** Validate a semantic step's kind-specific fields. */
function validateStepShape(issues: ValidationIssue[], path: string, step: SemanticStep): void {
  switch (step.kind) {
    case 'switchSection':
      if (!isKnownSectionName(step.tab)) {
        push(
          issues,
          `${path}.tab`,
          `unknown section '${String(step.tab)}'; known: ${KNOWN_SECTION_NAMES.join(', ')}`,
        );
      }
      break;
    case 'expectAcrossSurfaces':
      if (!Array.isArray(step.tabs) || step.tabs.length < 2) {
        push(issues, `${path}.tabs`, 'expectAcrossSurfaces requires >= 2 tabs');
      } else {
        for (const tab of step.tabs) {
          if (!isKnownSectionName(tab)) {
            push(
              issues,
              `${path}.tabs.${String(tab)}`,
              `unknown section '${String(tab)}'; known: ${KNOWN_SECTION_NAMES.join(', ')}`,
            );
          }
        }
      }
      break;
    case 'expectOracle':
      validateOracle(issues, `${path}.oracle`, step.oracle);
      break;
    case 'apiLeg':
      if (typeof step.functionName !== 'string' || step.functionName.trim() === '') {
        push(issues, `${path}.functionName`, 'apiLeg requires a non-empty functionName');
      }
      break;
    case 'injectFailure':
      if (!['server-error', 'timeout', 'malformed', 'partial', 'offline'].includes(step.failure)) {
        push(issues, `${path}.failure`, `unknown failure kind: ${String(step.failure)}`);
      }
      break;
    default:
      break;
  }
}

/** Validate every step in a sequence (inline steps or a workflow's steps). */
function validateSteps(issues: ValidationIssue[], path: string, steps: SemanticStep[]): void {
  if (!Array.isArray(steps) || steps.length === 0) {
    push(issues, path, 'must contain at least one step');
    return;
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepPath = `${path}[${i}]`;
    if (!step || typeof step !== 'object' || !isKnownStep(step.kind)) {
      push(
        issues,
        stepPath,
        `unknown semantic step kind: ${String((step as { kind?: unknown })?.kind)}`,
      );
      continue;
    }
    validateStepShape(issues, stepPath, step);
    validateStepOracles(issues, stepPath, step);
  }
}

/** Validate a persona. */
function validatePersona(issues: ValidationIssue[], persona: Persona): void {
  const path = `personas.${persona.id}`;
  if (!persona.id || persona.id.trim() === '') {
    push(issues, 'personas', 'persona is missing a non-empty id');
  }
  if (!persona.name || persona.name.trim() === '') {
    push(issues, `${path}.name`, 'persona requires a non-empty name');
  }
  if (!persona.description || persona.description.trim() === '') {
    push(issues, `${path}.description`, 'persona requires a non-empty description');
  }
  if (!persona.goals || !Array.isArray(persona.goals) || persona.goals.length === 0) {
    push(issues, `${path}.goals`, 'persona requires at least one goal');
  }
  if (!persona.behavior || typeof persona.behavior !== 'object') {
    push(issues, `${path}.behavior`, 'persona requires a behavior object');
  } else {
    validateBehavior(issues, path, persona.behavior);
  }
}

/** Validate a workflow fragment. */
function validateWorkflow(issues: ValidationIssue[], workflow: Workflow): void {
  const path = `workflows.${workflow.id}`;
  if (!workflow.id || workflow.id.trim() === '') {
    push(issues, 'workflows', 'workflow is missing a non-empty id');
  }
  validateSteps(issues, `${path}.steps`, workflow.steps);
}

/** Validate a scenario and its references. */
function validateScenario(
  issues: ValidationIssue[],
  scenario: Scenario,
  model: SimulationModel,
): void {
  const path = `scenarios.${scenario.id}`;
  if (!scenario.id || scenario.id.trim() === '') {
    push(issues, 'scenarios', 'scenario is missing a non-empty id');
  }
  if (!scenario.personaId || scenario.personaId.trim() === '') {
    push(issues, `${path}.personaId`, 'scenario requires a non-empty personaId');
  } else if (!model.personas.some((p) => p.id === scenario.personaId)) {
    push(
      issues,
      `${path}.personaId`,
      `dangling persona reference: '${scenario.personaId}' not found`,
    );
  }
  if (!scenario.goal || scenario.goal.trim() === '') {
    push(issues, `${path}.goal`, 'scenario requires a non-empty goal');
  }
  if (scenario.fixture && !['SMALL', 'TYPICAL', 'HEAVY'].includes(scenario.fixture)) {
    push(issues, `${path}.fixture`, `unknown fixture: ${scenario.fixture}`);
  }
  if (scenario.mode && !['deterministic', 'seeded', 'exploratory'].includes(scenario.mode)) {
    push(issues, `${path}.mode`, `unknown run mode: ${scenario.mode}`);
  }

  const workflowRefs = scenario.workflows ?? [];
  for (let i = 0; i < workflowRefs.length; i++) {
    const ref = workflowRefs[i];
    const refPath = `${path}.workflows[${i}]`;
    if (!ref || !ref.workflowId || ref.workflowId.trim() === '') {
      push(issues, refPath, 'workflow reference requires a non-empty workflowId');
      continue;
    }
    const workflows = model.workflows ?? [];
    if (!workflows.some((w) => w.id === ref.workflowId)) {
      push(
        issues,
        `${refPath}.workflowId`,
        `dangling workflow reference: '${ref.workflowId}' not found`,
      );
    }
  }

  validateSteps(issues, `${path}.steps`, scenario.steps);
}

/**
 * Validate a full simulation model. Returns `[]` when valid; otherwise a list
 * of `ValidationIssue`s. Pure — no I/O, no side effects.
 */
export function validateSimulationModel(model: SimulationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!model || typeof model !== 'object') {
    push(issues, 'model', 'model must be an object with personas, workflows, scenarios');
    return issues;
  }

  if (!Array.isArray(model.personas)) {
    push(issues, 'personas', 'personas must be an array');
  } else {
    for (const persona of model.personas) {
      validatePersona(issues, persona);
    }
  }

  if (!Array.isArray(model.scenarios)) {
    push(issues, 'scenarios', 'scenarios must be an array');
  } else {
    for (const scenario of model.scenarios) {
      validateScenario(issues, scenario, model);
    }
  }

  if (model.workflows !== undefined) {
    if (!Array.isArray(model.workflows)) {
      push(issues, 'workflows', 'workflows must be an array');
    } else {
      for (const workflow of model.workflows) {
        validateWorkflow(issues, workflow);
      }
    }
  }

  return issues;
}

/** Convenience: true when the model has no validation issues. */
export function isSimulationModelValid(model: SimulationModel): boolean {
  return validateSimulationModel(model).length === 0;
}
