import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';

/**
 * Regression coverage for the Android `command-center-v2` smoke residual
 * (`windows-closure-reconciliation` tasks 3.1-3.3).
 *
 * Evidence: `simulation-output/native/apply-closure-2026-10-01/native-android-smoke-Nitro_API_36-2026-10-01T013333396Z.json`
 * and its debug extract. The flow failed at `tapOn: 'Create'` with
 * `Element not found: Text matching regex: Create`, while the step-14 hierarchy
 * contained no `Create`, `Ask`, or `Auto` element at all. `CommandScreen`
 * returns the command content without mounting `ModeToggle` while
 * `AI_ASK_EXPERIMENT_ENABLED` is false, so an ordinary build has no mode chip:
 * the step is a stale TEST_BUG against the intentional default-off render
 * boundary, not a product defect.
 *
 * These guards keep the repaired shape and the unchanged iOS sequence, and they
 * prove they reject the original defect instead of passing vacuously.
 *
 * See `openspec/changes/windows-closure-reconciliation/android-smoke-triage.md`.
 */
const ROOT = resolve(__dirname, '..');
const flowsDir = join(ROOT, '.maestro', 'flows');
const flowPath = join(flowsDir, 'command-center-v2.yaml');
// The flow is CRLF in the working tree (core.autocrlf); normalize so the
// multi-line assertions are line-ending agnostic.
const flow = readFileSync(flowPath, 'utf8').replace(/\r\n/g, '\n');

const ANDROID_BLOCK = [
  '- runFlow:',
  '    when:',
  '      platform: Android',
  '    commands:',
  "      - assertVisible: 'Command input'",
  "      - assertNotVisible: 'Ask'",
  "      - assertNotVisible: 'Auto'",
].join('\n');

const IOS_BLOCK = [
  '- runFlow:',
  '    when:',
  '      platform: iOS',
  '    commands:',
  "      - tapOn: 'Create'",
].join('\n');

/** The exact commands run 68db684 aborted on, before the repair. */
function preFixFlow(source: string): string {
  return source.replace(ANDROID_BLOCK, '').replace(IOS_BLOCK, "- tapOn: 'Create'");
}

/**
 * Pure guard predicate, exported through the tests below so the same rules are
 * applied to the real flow and to the reconstructed defect.
 */
function findCommandCenterFlowDefects(source: string): string[] {
  const defects: string[] = [];
  if (source.replace(IOS_BLOCK, '').includes("- tapOn: 'Create'")) {
    defects.push(
      "tapOn 'Create' outside the iOS branch: the default-off build never mounts the mode selector, so this step can never match on Android",
    );
  }
  if (!source.includes(ANDROID_BLOCK)) {
    defects.push(
      'Android must assert the ordinary Create surface: Command input visible and Ask/Auto absent',
    );
  }
  if (!source.includes(IOS_BLOCK)) {
    defects.push('the iOS branch must retain the historical tapOn Create command unchanged');
  }
  const requiredSteps = [
    "tapOn: 'Use example: Add a todo to call mom tomorrow'",
    "tapOn: 'Parse command'",
    'Nothing has been saved yet.',
    'Ready to save',
    'Confirm and save',
  ];
  for (const step of requiredSteps) {
    if (!source.includes(step)) defects.push(`missing unchanged step: ${step}`);
  }
  if (/\boptional:\s*true/.test(source)) {
    defects.push('the flow must not make steps optional to pass');
  }
  if (/\btestID\b|\btestId\b/.test(source)) {
    defects.push('the flow must not depend on app test IDs');
  }
  return defects;
}

describe('command-center-v2 Android smoke flow', () => {
  it('is valid YAML with its original tags', () => {
    const documents = parseAllDocuments(flow);
    expect(documents.map((doc) => doc.errors.length)).toEqual([0, 0]);
    expect(documents[0].toJS()).toMatchObject({
      appId: 'com.dale16.superhabits',
      tags: ['native', 'command-v2', 'smoke'],
    });
  });

  it('has no defects under the reviewed guard rules', () => {
    expect(findCommandCenterFlowDefects(flow)).toEqual([]);
  });

  it('rejects the original unconditional Create step (guard is not vacuous)', () => {
    const reconstructed = preFixFlow(flow);
    // The reconstruction must really be the pre-fix shape, not a no-op.
    expect(reconstructed).not.toBe(flow);
    expect(reconstructed).toContain("- tapOn: 'Create'");
    expect(findCommandCenterFlowDefects(reconstructed)).toContain(
      "tapOn 'Create' outside the iOS branch: the default-off build never mounts the mode selector, so this step can never match on Android",
    );
  });

  it('keeps the draft/review/confirmation assertions after the repaired step', () => {
    const androidBlockAt = flow.indexOf(ANDROID_BLOCK);
    const confirmAt = flow.indexOf("assertVisible: 'Confirm and save'");
    expect(androidBlockAt).toBeGreaterThan(-1);
    expect(confirmAt).toBeGreaterThan(androidBlockAt);
    // The parse/review path still runs in order after the mode decision.
    for (const step of [
      "tapOn: 'Use example: Add a todo to call mom tomorrow'",
      "tapOn: 'Parse command'",
      'Ready to save',
    ]) {
      expect(flow.indexOf(step)).toBeGreaterThan(androidBlockAt);
    }
  });

  it('the repair changes the flow file only, never the iOS semantics', () => {
    // The iOS branch is the only remaining `tapOn: 'Create'`, and no step was
    // added for iOS beyond the historical one.
    const iosBranch = flow.slice(
      flow.indexOf(IOS_BLOCK),
      flow.indexOf(IOS_BLOCK) + IOS_BLOCK.length,
    );
    expect(iosBranch).toBe(IOS_BLOCK);
    expect(flow.split("- tapOn: 'Create'").length - 1).toBe(1);
  });
});

describe('the ordinary render boundary makes the Create chip unreachable', () => {
  const commandScreen = readFileSync(
    join(ROOT, 'features', 'command', 'CommandScreen.tsx'),
    'utf8',
  );
  const modeToggle = readFileSync(join(ROOT, 'features', 'command', 'ModeToggle.tsx'), 'utf8');

  it('returns the command content without mounting ModeToggle while the flag is off', () => {
    const earlyReturn = commandScreen.indexOf('if (!AI_ASK_EXPERIMENT_ENABLED) {');
    const selector = commandScreen.indexOf('<ModeToggle');
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(selector).toBeGreaterThan(-1);
    // The ordinary branch returns BEFORE the selector can render.
    expect(earlyReturn).toBeLessThan(selector);
    const ordinaryBranch = commandScreen.slice(earlyReturn, selector);
    expect(ordinaryBranch).toContain('{commandContent}');
    expect(ordinaryBranch).not.toContain('<ModeToggle');
  });

  it('keeps the selector driven by the pure surface (no parallel chip list)', () => {
    expect(modeToggle).toContain("from './commandSurface'");
    expect(modeToggle).toContain('commandModeOptions(AI_ASK_EXPERIMENT_ENABLED)');
    expect(commandScreen).toContain("from './commandSurface'");
  });
});

describe('smoke tag selection stays complete after the repair', () => {
  it('still selects both smoke flows with no errors and no duplicates', async () => {
    const { resolveExpectedFlows } = await import(
      /* @vite-ignore */ join(ROOT, 'scripts', 'native-flow-coverage.mjs')
    );
    const { flows, errors } = resolveExpectedFlows({ flowsDir, tag: 'smoke' });
    expect(errors).toEqual([]);
    const ids = flows.map((entry: { id: string }) => entry.id).sort();
    expect(ids).toEqual(['command-center-v2', 'native-smoke']);
  });
});
