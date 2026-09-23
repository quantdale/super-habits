import { describe, expect, it } from 'vitest';
import { baseReplayCommand, replayForAvd, stripAvdArgs } from '@/scripts/qa-native-replay.mjs';

/**
 * Regression coverage for the native-QA replay-command defects found by the
 * 2026-09-23 production-closure adversarial certification:
 *  - reports emitted `npm run qa:native …`, a script that does not exist, so
 *    every printed replay errored;
 *  - multi-AVD outcomes appended a second `--avd <name>` onto a base that
 *    already carried one, producing duplicated flags.
 */

describe('native QA replay commands', () => {
  it('emits a paste-runnable node-script invocation, never the nonexistent npm script', () => {
    const base = baseReplayCommand('android', { tag: 'smoke', serial: 'emulator-5554' });
    expect(base.startsWith('node scripts/qa-native.mjs ')).toBe(true);
    expect(base).toContain('--platform android');
    expect(base).toContain('--tag smoke');
    expect(base).toContain('--serial emulator-5554');
    expect(base).not.toContain('npm run qa:native');
    expect(base).not.toContain('-- --');
  });

  it('includes optional flags exactly once each', () => {
    const base = baseReplayCommand('android', {
      flow: '.maestro/flows/native-smoke.yaml',
      noProvision: true,
      avds: ['Nitro_API_36'],
      noStop: true,
      buildMetadata: 'meta.json',
    });
    expect(base).toContain('--flow .maestro/flows/native-smoke.yaml');
    expect(base).toContain('--no-provision');
    expect(base).toContain('--avd Nitro_API_36');
    expect(base).toContain('--no-stop');
    expect(base).toContain('--build-metadata meta.json');
    expect(base.match(/--no-provision/g)).toHaveLength(1);
    expect(base.match(/--no-stop/g)).toHaveLength(1);
  });

  it('pins the per-target --avd to exactly one occurrence (duplicate-avd regression)', () => {
    const base = baseReplayCommand('android', {
      tag: 'smoke',
      avds: ['Nitro_API_36'],
      noStop: true,
    });
    const replay = replayForAvd(base, 'Nitro_API_36');
    expect(replay.match(/--avd Nitro_API_36/g)).toHaveLength(1);
    expect(replay.endsWith('--avd Nitro_API_36')).toBe(true);
    expect(replay).toContain('--tag smoke');
    expect(replay).toContain('--no-stop');
  });

  it('replaces a multi-target avd list with the single failing target', () => {
    const base = baseReplayCommand('android', {
      tag: 'smoke',
      avds: ['Nitro_API_36', 'CRBABot_API_36'],
    });
    const replay = replayForAvd(base, 'CRBABot_API_36');
    expect(replay).toContain('--avd CRBABot_API_36');
    expect(replay).not.toContain('Nitro_API_36');
    expect(replay.match(/--avd /g)).toHaveLength(1);
  });

  it('stripAvdArgs removes every avd token and leaves the rest intact', () => {
    const stripped = stripAvdArgs(
      'node scripts/qa-native.mjs --platform android --avd A --tag smoke --avd B',
    );
    expect(stripped).toBe('node scripts/qa-native.mjs --platform android --tag smoke');
  });
});
