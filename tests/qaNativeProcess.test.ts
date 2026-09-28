import { describe, expect, it } from 'vitest';
import { checkIosSimulatorReadiness, runNativeCommand } from '../scripts/qa-native-process.mjs';

describe('native QA command runner', () => {
  it('ends a stalled simulator command at its configured deadline', () => {
    const startedAt = performance.now();
    const result = runNativeCommand(
      process.execPath,
      ['-e', 'setTimeout(() => process.exit(0), 250)'],
      { timeoutMs: 50 },
    );

    expect(result.timedOut).toBe(true);
    expect(result.status).toBe(124);
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });

  it('reports a blocked booted-device probe as an environment failure', () => {
    const calls: { args: string[]; timeoutMs: number }[] = [];
    const result = checkIosSimulatorReadiness(
      (_command, args, { timeoutMs }) => {
        calls.push({ args, timeoutMs });
        return runNativeCommand(
          process.execPath,
          ['-e', 'setTimeout(() => process.exit(0), 250)'],
          { timeoutMs },
        );
      },
      'xcrun',
      'com.dale16.superhabits',
      50,
    );

    expect(result?.blocked).toMatch(/timed out/i);
    expect(result?.remediation).toMatch(/restart.*simulator/i);
    expect(calls).toEqual([{ args: ['simctl', 'list', 'devices', 'booted'], timeoutMs: 50 }]);
  });

  it('also bounds the installed-app probe after the booted-device check passes', () => {
    const calls: { args: string[]; timeoutMs: number }[] = [];
    const result = checkIosSimulatorReadiness(
      (_command, args, { timeoutMs }) => {
        calls.push({ args, timeoutMs });
        if (args[1] === 'list') return { status: 0, stdout: 'Booted' };
        return runNativeCommand(
          process.execPath,
          ['-e', 'setTimeout(() => process.exit(0), 250)'],
          { timeoutMs },
        );
      },
      'xcrun',
      'com.dale16.superhabits',
      50,
    );

    expect(result?.blocked).toMatch(/installed app container/i);
    expect(result?.remediation).toMatch(/restart.*simulator/i);
    expect(calls).toEqual([
      { args: ['simctl', 'list', 'devices', 'booted'], timeoutMs: 50 },
      {
        args: ['simctl', 'get_app_container', 'booted', 'com.dale16.superhabits'],
        timeoutMs: 50,
      },
    ]);
  });
});
