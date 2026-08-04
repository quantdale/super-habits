/**
 * Scenario-library loader (`add-user-simulation-platform` task 3.3).
 *
 * Loads all persona / workflow / scenario modules, plus the runner self-test
 * model, into one `SimulationModel`. The library directories
 * (`simulation/personas|workflows|scenarios`, tasks 6.1–6.4) are authored in
 * TypeScript; each directory's compiled `.js` modules are required at runtime
 * and their exported models merged. Modules may export either a single entity
 * (e.g. `export const dailyDriver = definePersona(...)`) or a full model
 * (`export const model = defineModel(...)`); both shapes are merged.
 *
 * Because the CLI runs from the compiled output (`simulation/.build/`), the
 * loader resolves the compiled mirrors of the library directories relative to
 * this file's compiled location (`__dirname`). The self-test model is always
 * merged so `sim:run --scenario smoke` works out of the box (task 3.5).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineModel } from '../model/builders';
import type { Persona, Scenario, SimulationModel, Workflow } from '../model/types';
import { selfTestModel } from './selfTest';

function compiledDir(libSubdir: 'personas' | 'workflows' | 'scenarios'): string {
  // Compiled layout: simulation/.build/simulation/runner/cli.js →
  // sibling compiled library dirs at simulation/.build/simulation/<subdir>.
  return path.resolve(__dirname, '..', libSubdir);
}

function collectFrom<T>(dir: string, take: (mod: Record<string, unknown>) => T[]): T[] {
  const out: T[] = [];
  if (!fs.existsSync(dir)) return out;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.d.js'))
    .sort();
  for (const file of files) {
    // Dynamic require of sibling compiled scenario modules — the loader's
    // whole point (the build is CJS; no static import graph to follow).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(path.join(dir, file)) as Record<string, unknown>;
    out.push(...take(mod));
  }
  return out;
}

/** Merge a module's exports into the collected arrays (entity or model shape). */
function mergeModule<T extends { id: string }>(
  mod: Record<string, unknown>,
  into: T[],
  isEntity: (v: unknown) => v is T,
): void {
  for (const value of Object.values(mod)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    if (isEntity(value)) {
      into.push(value);
      continue;
    }
    if (Array.isArray(v.personas) && isEntity(v.personas[0])) {
      into.push(...(v.personas as T[]));
    }
  }
}

const isPersona = (v: unknown): v is Persona =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as { id?: unknown }).id === 'string' &&
  typeof (v as { behavior?: unknown }).behavior === 'object';
const isWorkflow = (v: unknown): v is Workflow =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as { id?: unknown }).id === 'string' &&
  Array.isArray((v as { steps?: unknown }).steps);
const isScenario = (v: unknown): v is Scenario =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as { id?: unknown }).id === 'string' &&
  typeof (v as { personaId?: unknown }).personaId === 'string' &&
  Array.isArray((v as { steps?: unknown }).steps);

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) seen.set(item.id, item);
  return [...seen.values()];
}

/**
 * Load the full simulation model: compiled library directories (personas,
 * workflows, scenarios) + the runner self-test model. The self-test model is
 * merged LAST so its entities win id collisions (the smoke must always exist).
 */
export function loadSimulationModel(): SimulationModel {
  const personas = collectFrom<Persona>(compiledDir('personas'), (mod) => {
    const out: Persona[] = [];
    mergeModule(mod, out, isPersona);
    return out;
  });
  const workflows = collectFrom<Workflow>(compiledDir('workflows'), (mod) => {
    const out: Workflow[] = [];
    mergeModule(mod, out, isWorkflow);
    return out;
  });
  const scenarios = collectFrom<Scenario>(compiledDir('scenarios'), (mod) => {
    const out: Scenario[] = [];
    mergeModule(mod, out, isScenario);
    return out;
  });

  personas.push(...selfTestModel.personas);
  workflows.push(...(selfTestModel.workflows ?? []));
  scenarios.push(...selfTestModel.scenarios);

  return defineModel({
    personas: dedupeById(personas),
    workflows: dedupeById(workflows),
    scenarios: dedupeById(scenarios),
  });
}

/** Compile-time helper for tests / specs to build a model without the loader. */
export function modelWithSelfTest(extra?: {
  personas?: Persona[];
  workflows?: Workflow[];
  scenarios?: Scenario[];
}): SimulationModel {
  return defineModel({
    personas: dedupeById([...(extra?.personas ?? []), ...selfTestModel.personas]),
    workflows: dedupeById([...(extra?.workflows ?? []), ...(selfTestModel.workflows ?? [])]),
    scenarios: dedupeById([...(extra?.scenarios ?? []), ...selfTestModel.scenarios]),
  });
}
