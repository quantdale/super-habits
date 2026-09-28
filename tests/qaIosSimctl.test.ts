import { describe, expect, it } from 'vitest';
import {
  buildIosSimctlInvocation,
  runIosSimctlOperation,
  runIosSimulatorDiagnostics,
} from '../scripts/qa-ios-simctl.mjs';

describe('iOS simulator command evidence', () => {
  it('builds a separate install command for the exact simulator and app path', () => {
    expect(
      buildIosSimctlInvocation('install', {
        simulatorId: 'SIMULATOR-UDID',
        appPath: '/tmp/SuperHabits.app',
      }),
    ).toEqual({
      command: 'xcrun',
      args: ['simctl', 'install', 'SIMULATOR-UDID', '/tmp/SuperHabits.app'],
    });
  });

  it('runs install with its own deadline and preserves output and timing', () => {
    const calls: { command: string; args: string[]; timeoutMs: number }[] = [];
    const clocks = [100, 147];
    const times = ['2026-09-28T00:00:00.000Z', '2026-09-28T00:00:00.047Z'];
    const report = runIosSimctlOperation('install', {
      simulatorId: 'SIMULATOR-UDID',
      appPath: '/tmp/SuperHabits.app',
      timeoutMs: 150_000,
      runCommand: (command: string, args: string[], { timeoutMs }: { timeoutMs: number }) => {
        calls.push({ command, args, timeoutMs });
        return { status: 0, stdout: 'installed', stderr: 'install notice', timedOut: false };
      },
      clock: () => clocks.shift() ?? 147,
      now: () => times.shift() ?? times[0],
    });

    expect(calls).toEqual([
      {
        command: 'xcrun',
        args: ['simctl', 'install', 'SIMULATOR-UDID', '/tmp/SuperHabits.app'],
        timeoutMs: 150_000,
      },
    ]);
    expect(report).toMatchObject({
      operation: 'install',
      startedAt: '2026-09-28T00:00:00.000Z',
      completedAt: '2026-09-28T00:00:00.047Z',
      durationMs: 47,
      stdout: 'installed',
      stderr: 'install notice',
      timedOut: false,
      success: true,
    });
  });

  it('builds launch separately and reports the launch command timeout', () => {
    const calls: { command: string; args: string[]; timeoutMs: number }[] = [];
    const report = runIosSimctlOperation('launch', {
      simulatorId: 'SIMULATOR-UDID',
      timeoutMs: 150_000,
      runCommand: (command: string, args: string[], { timeoutMs }: { timeoutMs: number }) => {
        calls.push({ command, args, timeoutMs });
        return {
          status: 124,
          stdout: '',
          stderr: 'launch did not return',
          error: 'ETIMEDOUT',
          timedOut: true,
        };
      },
    });

    expect(calls).toEqual([
      {
        command: 'xcrun',
        args: ['simctl', 'launch', 'SIMULATOR-UDID', 'com.dale16.superhabits'],
        timeoutMs: 150_000,
      },
    ]);
    expect(report).toMatchObject({
      operation: 'launch',
      status: 124,
      stderr: 'launch did not return',
      error: 'ETIMEDOUT',
      timedOut: true,
      success: false,
      timeoutMs: 150_000,
    });
  });

  it('runs bounded diagnostics independently and continues after one times out', () => {
    const calls: { args: string[]; timeoutMs: number }[] = [];
    const report = runIosSimulatorDiagnostics({
      simulatorId: 'SIMULATOR-UDID',
      screenshotPath: '/tmp/ios-simulator.png',
      runCommand: (_command: string, args: string[], { timeoutMs }: { timeoutMs: number }) => {
        calls.push({ args, timeoutMs });
        if (args[1] === 'get_app_container') {
          return { status: 124, stdout: '', stderr: '', error: 'ETIMEDOUT', timedOut: true };
        }
        return { status: 0, stdout: 'diagnostic output', stderr: '', error: null, timedOut: false };
      },
    });

    expect(calls).toHaveLength(4);
    expect(calls.map((call) => call.timeoutMs)).toEqual([15_000, 15_000, 30_000, 30_000]);
    expect(report.commands.map((command) => command.name)).toEqual([
      'booted-devices',
      'installed-app-container',
      'recent-app-log',
      'screenshot',
    ]);
    expect(report.commands[1]).toMatchObject({ status: 124, timedOut: true });
    expect(report.commands[2]).toMatchObject({ status: 0, stdout: 'diagnostic output' });
  });
});
