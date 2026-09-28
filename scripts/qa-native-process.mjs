import { spawnSync } from 'node:child_process';

function quoteWindowsShellArg(value) {
  const text = String(value);
  return /[\s"]/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
}

export function runNativeCommand(command, args, options = {}) {
  const { timeoutMs, ...spawnOptions } = options;
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    throw new RangeError('timeoutMs must be a positive finite number.');
  }
  const useWindowsBatchShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  const spawnCommand = useWindowsBatchShell
    ? [command, ...args].map(quoteWindowsShellArg).join(' ')
    : command;
  const spawnArgs = useWindowsBatchShell ? [] : args;
  const result = spawnSync(spawnCommand, spawnArgs, {
    encoding: 'utf8',
    shell: useWindowsBatchShell,
    ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
    ...spawnOptions,
  });
  const timedOut = result.error?.code === 'ETIMEDOUT';
  return {
    status: result.status ?? (timedOut ? 124 : 1),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? null,
    timedOut,
  };
}

/**
 * @param {(command: string, args: string[], options: { timeoutMs: number }) => { status: number, stdout?: string, stderr?: string, error?: string | null, timedOut?: boolean }} runCommand
 * @param {string} xcrun
 * @param {string} appId
 * @param {number} timeoutMs
 * @returns {{ blocked: string, remediation: string } | null}
 */
export function checkIosSimulatorReadiness(runCommand, xcrun, appId, timeoutMs) {
  const remediation =
    'Restart the iOS simulator and Xcode services, then rerun the same exact-source flow.';
  const devices = runCommand(xcrun, ['simctl', 'list', 'devices', 'booted'], { timeoutMs });
  if (devices.timedOut) {
    return {
      blocked: `Timed out after ${timeoutMs}ms while checking booted iOS simulators.`,
      remediation,
    };
  }
  if (devices.status !== 0) {
    return {
      blocked: `Could not inspect booted iOS simulators: ${devices.error ?? devices.stderr ?? 'simctl exited unsuccessfully'}.`,
      remediation,
    };
  }
  if (!/Booted/.test(devices.stdout)) {
    return {
      blocked: 'No booted iOS simulator is available.',
      remediation: 'Boot an iOS simulator or use the EAS native-e2e workflow.',
    };
  }

  const installed = runCommand(xcrun, ['simctl', 'get_app_container', 'booted', appId], {
    timeoutMs,
  });
  if (installed.timedOut) {
    return {
      blocked: `Timed out after ${timeoutMs}ms while checking the installed app container on iOS Simulator.`,
      remediation,
    };
  }
  if (installed.status !== 0) {
    return {
      blocked: `${appId} is not installed on the booted iOS simulator.`,
      remediation: 'Build/install the e2e-test simulator app, then rerun the same command.',
    };
  }
  return null;
}
