import { describe, expect, it } from 'vitest';
import {
  MAX_REPEAT_TIMES,
  REPEAT_SUITES,
  buildRepeatRecord,
  parseRepeatArgs,
  resolveSuiteCommand,
  summarizeRepeats,
} from '../scripts/repeat.mjs';

describe('repetition runner helpers', () => {
  it('parses valid invocations', () => {
    expect(parseRepeatArgs(['--suite', 'p0', '--times', '5'])).toMatchObject({
      suite: 'p0',
      times: 5,
      timeoutMin: null,
      avd: null,
      skipBuild: false,
    });
    expect(
      parseRepeatArgs(['--suite', 'native-smoke', '--avd', 'Nitro_API_36', '--times', '2']),
    ).toMatchObject({ suite: 'native-smoke', avd: 'Nitro_API_36', times: 2 });
  });

  it('rejects unknown suites, bad counts, and misplaced targets', () => {
    expect(() => parseRepeatArgs(['--suite', 'nope'])).toThrow(/Unknown suite/);
    expect(() => parseRepeatArgs(['--suite', 'p0', '--times', '0'])).toThrow(/--times/);
    expect(() => parseRepeatArgs(['--suite', 'p0', '--times', `${MAX_REPEAT_TIMES + 1}`])).toThrow(
      /--times/,
    );
    expect(() => parseRepeatArgs(['--suite', 'native-smoke'])).toThrow(/--avd/);
    expect(() => parseRepeatArgs(['--suite', 'p0', '--avd', 'X'])).toThrow(/takes no --avd/);
    expect(() => parseRepeatArgs(['--bogus'])).toThrow(/Unknown argument/);
  });

  it('resolves every suite to an executable command', () => {
    expect(resolveSuiteCommand('unit', {})).toMatchObject({
      kind: 'npm',
      args: ['run', 'test:unit'],
    });
    expect(resolveSuiteCommand('p0', {}).needsDist).toBe(true);
    expect(resolveSuiteCommand('native-auth', { avd: 'Nitro_API_36' })).toMatchObject({
      kind: 'node',
      args: [
        'scripts/qa-native.mjs',
        '--platform',
        'android',
        '--tag',
        'auth-persistence',
        '--auth-mock',
        '--avd',
        'Nitro_API_36',
      ],
    });
    expect(resolveSuiteCommand('native-smoke', { avd: 'A', timeoutMin: 7 }).timeoutMin).toBe(7);
    expect(resolveSuiteCommand('native-smoke', { avd: 'A' }).timeoutMin).toBe(
      REPEAT_SUITES['native-smoke'].timeoutMin,
    );
    expect(() => resolveSuiteCommand('nope', {})).toThrow(/Unknown suite/);
  });

  it('builds attempt records with measured durations', () => {
    const record = buildRepeatRecord({
      suite: 'p0',
      attempt: 2,
      repoSha: 'abc',
      startedAt: '2026-09-04T08:00:00.000Z',
      endedAt: '2026-09-04T08:01:00.000Z',
      exitCode: 0,
      timedOut: false,
      artifactHint: 'hint',
      replayCommand: 'replay',
    });
    expect(record).toMatchObject({
      schemaVersion: 1,
      suite: 'p0',
      attempt: 2,
      durationMs: 60000,
      status: 'PASS',
      seed: null,
    });
    expect(
      buildRepeatRecord({ suite: 'p0', attempt: 1, exitCode: 1, timedOut: false }).status,
    ).toBe('FAILED_NEEDS_TRIAGE');
    expect(buildRepeatRecord({ suite: 'p0', attempt: 1, exitCode: 1, timedOut: true }).status).toBe(
      'TIMEOUT',
    );
  });

  it('collates repeats honestly: any non-pass fails the battery', () => {
    expect(summarizeRepeats([]).status).toBe('EMPTY');
    const summary = summarizeRepeats([
      buildRepeatRecord({ suite: 'p0', attempt: 1, exitCode: 0, timedOut: false }),
      buildRepeatRecord({ suite: 'p0', attempt: 2, exitCode: 1, timedOut: false }),
      buildRepeatRecord({ suite: 'p0', attempt: 3, exitCode: 1, timedOut: true }),
    ]);
    expect(summary).toEqual({ total: 3, pass: 1, failed: 1, timeout: 1, status: 'FAIL' });
  });
});
