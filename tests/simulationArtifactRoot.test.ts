import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildRunArtifacts,
  runOutputDir,
  simulationOutputRoot,
  tracePath,
  videoDir,
} from '../simulation/observe/artifacts';

afterEach(() => vi.unstubAllEnvs());

describe('simulation evidence root', () => {
  it('keeps the default repository output location', () => {
    vi.stubEnv('SIMULATION_OUTPUT_DIR', undefined);
    expect(simulationOutputRoot()).toBe(path.resolve('simulation-output'));
    expect(
      buildRunArtifacts({ runId: 'run_default', reportPath: 'report.json', screenshots: [] }).root,
    ).toBe('simulation-output/run_default');
  });

  it('honours an absolute session-artifact root without changing cwd', () => {
    const root = path.resolve('..', '_AgentArtifacts', 'test-session', 'simulation');
    vi.stubEnv('SIMULATION_OUTPUT_DIR', root);
    expect(simulationOutputRoot()).toBe(root);
    expect(runOutputDir('run_a')).toBe(path.join(root, 'run_a'));
    expect(tracePath('run_a')).toBe(path.join(root, 'run_a', 'artifacts', 'trace.zip'));
    expect(videoDir('run_a')).toBe(path.join(root, 'run_a', 'artifacts', 'video'));
    expect(
      buildRunArtifacts({ runId: 'run_a', reportPath: 'report.json', screenshots: [] }).root,
    ).toBe(path.relative(process.cwd(), path.join(root, 'run_a')).split(path.sep).join('/'));
  });

  it('resolves a relative override consistently', () => {
    vi.stubEnv('SIMULATION_OUTPUT_DIR', 'local-evidence/simulation');
    expect(runOutputDir('run_b')).toBe(path.resolve('local-evidence/simulation/run_b'));
    expect(
      buildRunArtifacts({ runId: 'run_b', reportPath: 'report.json', screenshots: [] }).root,
    ).toBe('local-evidence/simulation/run_b');
  });
});
