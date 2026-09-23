/**
 * Replay-command construction for qa-native reports.
 *
 * The report's `replayCommand` must be paste-runnable from the repository
 * root. Two defects are fixed here (2026-09-23 adversarial certification):
 *  - it previously started with `npm run qa:native`, a script that does not
 *    exist in package.json (only qa:native:smoke/provision/android/ios/
 *    lifecycle/targeted exist), so every emitted replay errored;
 *  - multi-AVD outcomes appended `--avd <name>` on top of a base that already
 *    carried `--avd` tokens, producing duplicated flags (e.g.
 *    `--avd Nitro_API_36 --no-stop --avd Nitro_API_36`).
 *
 * The helper is pure so reports can be replay-command-checked without
 * executing the CLI.
 */

/** Strip every `--avd <name>` token from a joined replay command. */
export function stripAvdArgs(base) {
  return base.replace(/ --avd \S+/g, '').trimEnd();
}

/**
 * Base replay invocation: direct node form (always runnable; no npm script dependency).
 *
 * @param {string} platform
 * @param {{ tag?: string, flow?: string, serial?: string, noProvision?: boolean,
 *   avds?: string[], reset?: boolean, noStop?: boolean, authMock?: boolean,
 *   authMockPort?: number, buildMetadata?: string }} [options]
 * @returns {string}
 */
export function baseReplayCommand(platform, { tag, flow, serial, noProvision, avds, reset, noStop, authMock, authMockPort, buildMetadata } = {}) {
  const parts = [`node scripts/qa-native.mjs --platform ${platform}`];
  if (tag) parts.push(`--tag ${tag}`);
  if (flow) parts.push(`--flow ${flow}`);
  if (serial) parts.push(`--serial ${serial}`);
  if (noProvision) parts.push('--no-provision');
  for (const avd of avds ?? []) parts.push(`--avd ${avd}`);
  if (reset) parts.push('--reset');
  if (noStop) parts.push('--no-stop');
  if (authMock) {
    parts.push('--auth-mock');
    if (authMockPort !== undefined && authMockPort !== 4545) parts.push(`--auth-mock-port ${authMockPort}`);
  }
  if (buildMetadata) parts.push(`--build-metadata ${buildMetadata}`);
  return parts.join(' ');
}

/** Per-target replay: exactly one `--avd <name>`, never duplicated. */
export function replayForAvd(base, avdName) {
  return `${stripAvdArgs(base)} --avd ${avdName}`;
}
