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
