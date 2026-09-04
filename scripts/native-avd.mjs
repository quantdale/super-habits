/**
 * Pure multi-AVD orchestration helpers for the native QA runner.
 *
 * Sequential multi-target certification means: discover configured AVDs, boot
 * each requested target deterministically, wait for readiness with a bounded
 * deadline, run one lane per target, persist labeled artifacts, then stop only
 * the emulators this campaign started and continue to the next target.
 *
 * Every function in this module is pure (no I/O, no process access) so the
 * orchestration decisions are unit-testable. The runner (`scripts/qa-native.mjs`)
 * performs all ADB/emulator I/O and owns every spawned process. Parallel
 * execution against one shared emulator is never planned here; targets run in
 * the requested order, one at a time.
 */

import { spawnSync } from 'node:child_process';
import { parseAdbDevices } from './native-qa-utils.mjs';

/**
 * Parse `emulator -list-avds` output into an ordered list of AVD names.
 * Blank lines are ignored; names are returned verbatim (never trimmed
 * internally beyond surrounding whitespace).
 *
 * @param {unknown} output
 * @returns {string[]}
 */
export function parseAvdListOutput(output) {
  return String(output ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Readiness predicate for a booted Android target, evaluated against parsed
 * `adb shell getprop` properties.
 *
 * @param {Record<string, string>} properties
 * @returns {{ ready: boolean, reason: string | null }}
 */
export function isBootReady(properties) {
  const props = properties ?? {};
  if (props['sys.boot_completed'] !== '1') {
    return {
      ready: false,
      reason: `sys.boot_completed is '${props['sys.boot_completed'] ?? '<missing>'}' (want '1').`,
    };
  }
  return { ready: true, reason: null };
}

/**
 * Match a requested AVD name against connected devices whose AVD identity is
 * already known (via `ro.boot.qemu.avd_name`).
 *
 * @param {Array<{ serial: string, state: string, avd: string | null }>} devices
 * @param {string} avdName
 * @returns {string | null} the matching serial, or null when no connected
 * device reports that AVD name.
 */
export function matchConnectedAvd(devices, avdName) {
  const match = (devices ?? []).find(
    (device) => device.state === 'device' && device.avd === avdName,
  );
  return match ? match.serial : null;
}

/**
 * Validate and normalize a requested multi-AVD sequence before anything is
 * booted. Fails fast on unknown, duplicated, or empty requests so a typo can
 * never start (and strand) an emulator.
 *
 * @param {string[]} requestedAvds ordered AVD names from `--avd`.
 * @param {string[]} availableAvds names from `emulator -list-avds`.
 * @returns {{ sequence: string[] }} the validated boot/run order.
 * @throws {Error} with the exact reason when the request is invalid.
 */
export function planAvdSequence(requestedAvds, availableAvds) {
  const requested = (requestedAvds ?? []).map((name) => String(name).trim()).filter(Boolean);
  if (requested.length === 0) {
    throw new Error('No AVD targets were requested; pass --avd <name> at least once.');
  }
  const available = new Set(parseAvdListOutput((availableAvds ?? []).join('\n')));
  const unknown = requested.filter((name) => !available.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown AVD target(s): ${unknown.join(', ')}. Available: ${[...available].join(', ') || 'none'}.`,
    );
  }
  const seen = new Set();
  const duplicates = [];
  for (const name of requested) {
    if (seen.has(name)) duplicates.push(name);
    seen.add(name);
  }
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate AVD target(s): ${[...new Set(duplicates)].join(', ')}. Each target runs once per invocation.`,
    );
  }
  return { sequence: requested };
}

/**
 * Identify the serial of a freshly booted emulator by diffing `adb devices`
 * output captured before and after the boot. Prefers `emulator-*` serials so
 * a physical device plugged in mid-boot can never be mistaken for the owned
 * emulator.
 *
 * @param {string} beforeOutput `adb devices` before boot.
 * @param {string} afterOutput `adb devices` after the new target appears.
 * @returns {{ serial: string | null, reason: string | null }}
 */
export function findNewEmulatorSerial(beforeOutput, afterOutput) {
  const before = new Set(
    parseAdbDevices(beforeOutput)
      .filter((device) => device.state === 'device')
      .map((device) => device.serial),
  );
  const fresh = parseAdbDevices(afterOutput).filter(
    (device) => device.state === 'device' && !before.has(device.serial),
  );
  if (fresh.length === 0) {
    return { serial: null, reason: 'No new connected device appeared after boot.' };
  }
  const emulatorSerials = fresh.filter((device) => device.serial.startsWith('emulator-'));
  if (emulatorSerials.length === 1) return { serial: emulatorSerials[0].serial, reason: null };
  if (emulatorSerials.length > 1) {
    return {
      serial: null,
      reason: `Multiple new emulator serials appeared (${emulatorSerials.map((device) => device.serial).join(', ')}); refusing to guess which one this campaign owns.`,
    };
  }
  if (fresh.length === 1) return { serial: fresh[0].serial, reason: null };
  return {
    serial: null,
    reason: `Multiple new non-emulator serials appeared (${fresh.map((device) => device.serial).join(', ')}); refusing to guess which one this campaign owns.`,
  };
}

/**
 * Check `adb reverse --list` output for our exact forward spec.
 * Lines look like `<serial> tcp:<port> tcp:<port>`; matching requires
 * both ends so a same-port-different-target line can never qualify.
 *
 * @param {unknown} listOutput stdout of `adb reverse --list`.
 * @param {number} port the device/host port.
 * @returns {boolean}
 */
export function reverseSpecPresent(listOutput, port) {
  const spec = `tcp:${port} tcp:${port}`;
  return String(listOutput ?? '')
    .split(/\r?\n/)
    .some((line) => line.includes(spec));
}

/**
 * Process-liveness probe used ONLY to observe helper processes the native
 * runner itself started and owns (the auth-mock server). Implemented with
 * synchronous OS queries that never signal anyone: `tasklist` on win32,
 * `kill -0` elsewhere. It must never be used to discover, adopt, or manage
 * foreign processes. (Async `ChildProcess.exitCode` polling cannot work
 * here: the runner blocks the event loop with bounded sleeps, so exit
 * events would never be delivered while waiting.)
 *
 * @param {unknown} pid process id.
 * @returns {boolean} true when a process with that id exists right now.
 */
export function isPidAlive(pid) {
  const id = Number(pid);
  if (!Number.isInteger(id) || id <= 0) return false;
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('tasklist', ['/FI', `PID eq ${id}`, '/FO', 'CSV', '/NH'], {
        encoding: 'utf8',
      });
      if (result.status !== 0) return false;
      return String(result.stdout ?? '')
        .split(/\r?\n/)
        .some((line) => line.split(',').some((field) => field === `"${id}"`));
    }
    return spawnSync('kill', ['-0', String(id)], { stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

/**
 * Interpret a device-side mock-connectivity probe. The probe opens a TCP
 * connection from the device to the reversed mock port using the shell's
 * `/dev/tcp` redirection (no curl needed):
 * `cat < /dev/null > /dev/tcp/127.0.0.1/<port> && echo PROBE_OPEN ||
 * echo PROBE_CLOSED`. The `adb reverse --list` entry proves the forward
 * exists, not that bytes flow (stale ADBD state can list a dead
 * forward); this probe proves the app will actually reach the mock.
 *
 * @param {{ status: number, stdout: string, stderr: string }} result
 * @returns {{ ok: boolean, skipped: boolean, reason: string | null }}
 */
export function interpretDeviceProbe(result) {
  const combined = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
  if (/no such file|not found|unknown command|not recognized|bad/i.test(combined)) {
    return { ok: false, skipped: true, reason: 'device shell has no /dev/tcp; probe skipped' };
  }
  if (/PROBE_OPEN/.test(combined)) {
    return { ok: true, skipped: false, reason: null };
  }
  if (/PROBE_CLOSED/.test(combined)) {
    return { ok: false, skipped: false, reason: 'device TCP connection to the mock was refused' };
  }
  const detail = combined.trim().slice(-300) || `exit ${result?.status ?? '?'}`;
  return { ok: false, skipped: false, reason: `device probe failed: ${detail}` };
}

/**
 * Filename-safe label identifying one certification target.
 *
 * @param {{ avd: string | null, serial: string | null }} target
 * @returns {string}
 */
export function targetLabel(target) {
  const raw = target?.avd ?? target?.serial ?? 'unknown-target';
  const safe = String(raw).replace(/[^a-zA-Z0-9_.-]+/g, '_');
  return safe.length > 0 ? safe : 'unknown-target';
}

/**
 * Wave 6 per-run provenance record. One record is emitted per target lane run
 * so results never depend on ambiguous filenames.
 *
 * @param {object} fields
 * @returns {object} the provenance record (schemaVersion 1).
 */
export function buildTargetRunRecord(fields = {}) {
  const {
    repoSha = null,
    sourceSha = null,
    apkSha256 = null,
    buildKind = 'canonical',
    platform = 'android',
    avd = null,
    api = null,
    abi = null,
    serial = null,
    ownedEmulator = false,
    stateReset = false,
    tag = null,
    flow = null,
    seed = null,
    startedAt = null,
    endedAt = null,
    status = 'UNKNOWN',
    classification = null,
    artifactPath = null,
    mockState = null,
    replayCommand = null,
  } = fields;
  let durationMs = null;
  if (startedAt && endedAt) {
    const duration = Date.parse(endedAt) - Date.parse(startedAt);
    durationMs = Number.isFinite(duration) && duration >= 0 ? duration : null;
  }
  return {
    schemaVersion: 1,
    repoSha,
    sourceSha,
    apkSha256,
    buildKind,
    platform,
    avd,
    api,
    abi,
    serial,
    ownedEmulator,
    stateReset,
    lane: { tag, flow },
    seed,
    startedAt,
    endedAt,
    durationMs,
    status,
    classification,
    artifactPath,
    mockState,
    replayCommand,
  };
}

/**
 * Parse the deterministic `[mock]` log lines of
 * `scripts/native-auth-mock-server.mjs` into request-proof counters.
 *
 * Recognized lines: `signup count=N user=<id>`,
 * `user-check UNAUTHENTICATED (N)`, `user-check authed=N user=<id>`,
 * `put user ...` (protect request), `verify email_change -> permanent
 * user=<id>`, plus otp/refresh/logout counters. Anything else is
 * ignored so future log lines cannot break proof parsing.
 *
 * @param {unknown} logText full or sliced mock stdout.
 */
export function parseMockLog(logText) {
  const text = String(logText ?? '');
  let signupCount = 0;
  let unauthenticatedChecks = 0;
  let otpRequests = 0;
  let refreshes = 0;
  let logouts = 0;
  let putUserRequests = 0;
  const userIds = [];
  const verifyPermanentIds = [];
  const noteUser = (id) => {
    if (id && !userIds.includes(id)) userIds.push(id);
  };
  for (const line of text.split(/\r?\n/)) {
    let match = line.match(/\[mock\] signup count=(\d+) user=(\S+)/);
    if (match) {
      signupCount = Math.max(signupCount, Number(match[1]));
      noteUser(match[2]);
      continue;
    }
    if (/\[mock\] user-check UNAUTHENTICATED/.test(line)) {
      unauthenticatedChecks += 1;
      continue;
    }
    match = line.match(/\[mock\] user-check authed=\d+ user=(\S+)/);
    if (match) {
      noteUser(match[1]);
      continue;
    }
    match = line.match(/\[mock\] verify email_change -> permanent user=(\S+)/);
    if (match) {
      verifyPermanentIds.push(match[1]);
      noteUser(match[1]);
      continue;
    }
    if (/\[mock\] put user/.test(line)) putUserRequests += 1;
    else if (/\[mock\] otp requested/.test(line)) otpRequests += 1;
    else if (/\[mock\] token refresh ok/.test(line)) refreshes += 1;
    else if (/\[mock\] logout count=/.test(line)) logouts += 1;
  }
  return {
    signupCount,
    unauthenticatedChecks,
    userIds,
    verifyPermanentIds,
    otpRequests,
    refreshes,
    logouts,
    putUserRequests,
  };
}

/**
 * Assert the per-run auth proof for one lane slice: exactly one anonymous
 * signup, zero unauthenticated session checks, at least one PUT
 * /auth/v1/user protect request, a single user id across every observed
 * request, and at least one email_change verify preserving that id.
 *
 * @param {ReturnType<typeof parseMockLog>} parsed
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function assertMockProof(parsed) {
  const reasons = [];
  const proof = parsed ?? {};
  if (proof.signupCount !== 1) {
    reasons.push(`expected exactly 1 anonymous signup, observed ${proof.signupCount ?? 0}`);
  }
  if ((proof.unauthenticatedChecks ?? 0) !== 0) {
    reasons.push(
      `expected 0 unauthenticated session checks, observed ${proof.unauthenticatedChecks}`,
    );
  }
  if ((proof.putUserRequests ?? 0) < 1) {
    reasons.push('expected at least one PUT /auth/v1/user protect request, observed none');
  }
  const ids = proof.userIds ?? [];
  if (ids.length !== 1) {
    reasons.push(`expected a single user id across requests, observed [${ids.join(', ')}]`);
  }
  const verified = proof.verifyPermanentIds ?? [];
  if (verified.length === 0) {
    reasons.push('expected at least one email_change verify preserving the user id');
  } else if (ids.length === 1 && verified.some((id) => id !== ids[0])) {
    reasons.push(
      `verify changed the user id (expected ${ids[0]}, observed [${verified.join(', ')}])`,
    );
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * TEST-ONLY manifest transform for mock-URL builds: allow cleartext HTTP
 * (the device-loopback mock) in the generated, gitignored
 * `android/app/src/main/AndroidManifest.xml`. Never applied to tracked
 * config; release builds never pass through here.
 *
 * @param {unknown} manifestXml manifest source text.
 * @returns {string} patched text (unchanged when already patched).
 * @throws {Error} when no `<application` tag is present.
 */
export function addCleartextAttr(manifestXml) {
  const text = String(manifestXml ?? '');
  if (!/<application[\s>]/.test(text)) {
    throw new Error('Android manifest has no <application> tag to patch.');
  }
  if (/usesCleartextTraffic\s*=/.test(text)) return text;
  return text.replace('<application', '<application android:usesCleartextTraffic="true"');
}

/**
 * Collate per-target run records into one campaign summary.
 *
 * @param {object[]} records output of {@link buildTargetRunRecord}.
 * @returns {{ total: number, pass: number, failed: number, blocked: number, status: string }}
 */
export function summarizeTargetRuns(records) {
  const list = records ?? [];
  const pass = list.filter((record) => record.status === 'PASS').length;
  const failed = list.filter((record) => record.status === 'FAILED_NEEDS_TRIAGE').length;
  const blocked = list.filter((record) => record.status === 'BLOCKED').length;
  const status = list.length === 0 ? 'EMPTY' : failed + blocked > 0 ? 'FAIL' : 'PASS';
  return { total: list.length, pass, failed, blocked, status };
}
