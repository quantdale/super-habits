import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import { readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Hermetic-build envelope + APK bundle scan + native flow coverage
 * (OpenSpec change `harden-native-evidence-and-release-posture`).
 *
 * These three modules are the whole hermeticity and coverage proof for the
 * native lane, and every one of them is a guard: a guard that cannot fail is
 * not a guard. Each test below therefore includes a non-vacuity case that
 * replays the exact failure the module exists to catch.
 */
const ROOT = resolve(__dirname, '..');
const SCRIPT_DIR = join(ROOT, 'scripts');

async function hermeticModule() {
  return import(/* @vite-ignore */ join(SCRIPT_DIR, 'hermetic-build.mjs'));
}
async function apkScanModule() {
  return import(/* @vite-ignore */ join(SCRIPT_DIR, 'native-apk-scan.mjs'));
}
async function coverageModule() {
  return import(/* @vite-ignore */ join(SCRIPT_DIR, 'native-flow-coverage.mjs'));
}

// --- ZIP fixture writer -------------------------------------------------
// A minimal stored/deflated ZIP writer, so the scanner's central-directory
// reader, inflater, and needle search are exercised against archives this
// repository built here — never against a fixture whose contents the test
// cannot see.
function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
  deflate: boolean;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const payload = entry.deflate ? deflateRawSync(entry.data) : entry.data;
    const method = entry.deflate ? 8 : 0;
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + payload.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, eocd]);
}

describe('hermetic build envelope', () => {
  it('blocks dotenv loading and strips every ambient EXPO_PUBLIC_* value', async () => {
    const { hermeticBuildEnv, describeStrippedEnv } = await hermeticModule();
    // `undefined` stands in for "set to empty" the way a caller's env object
    // can carry a cleared key; the strip must not depend on the value.
    const ambient = {
      EXPO_NO_DOTENV: '0',
      EXPO_PUBLIC_SUPABASE_URL: 'https://kruubbynsmxzxfdunaal.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'live-anon-key',
      EXPO_PUBLIC_AI_COMMAND_PARSE_MODE: 'mock',
      PATH: 'keep-me',
    };
    const { env, stripped, remoteStripped } = hermeticBuildEnv({
      baseEnv: ambient,
      set: { EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST: 'true' },
    });

    expect(env.EXPO_NO_DOTENV).toBe('1');
    // The caller's explicit build value survives the strip.
    expect(env.EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST).toBe('true');
    expect(env.EXPO_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
    expect(env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE).toBeUndefined();
    expect(env.PATH).toBe('keep-me');
    expect(stripped).toEqual([
      'EXPO_PUBLIC_AI_COMMAND_PARSE_MODE',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_SUPABASE_URL',
    ]);
    expect(remoteStripped).toEqual(['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_URL']);
    expect(describeStrippedEnv([])).toContain('no ambient');
    expect(describeStrippedEnv(['A', 'B'])).toContain('A, B');
  });

  it('a workstation naming a live project still yields a local-only, host-free build', async () => {
    // Task 1.6, end to end at the decision level: this host's `.env` really
    // does name kruubbynsmxzxfdunaal.supabase.co, and the 2026-09-24 APK really
    // did inline it. Feed that exact ambient environment through the envelope
    // and assert both halves of the contract: the child env carries no remote,
    // and the recorded remote configuration says "none" rather than staying
    // silent.
    const { hermeticBuildEnv, describeRemoteConfiguration } = await hermeticModule();
    const { createHash } = await import('node:crypto');

    const devWorkstation = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://kruubbynsmxzxfdunaal.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'live-anon-key-value',
      EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST: undefined as unknown as string,
    };
    delete (devWorkstation as Record<string, unknown>).EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST;

    const { env, stripped, remoteStripped } = hermeticBuildEnv({
      baseEnv: devWorkstation,
      set: { EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST: 'true' },
    });

    // The live host is gone from the child environment...
    expect(env.EXPO_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
    expect(JSON.stringify(env)).not.toContain('supabase.co');
    expect(remoteStripped).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(stripped).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');

    // ...and the provenance record states the remote explicitly.
    const remote = describeRemoteConfiguration(env, false, createHash);
    expect(remote.mode).toBe('local-only');
    expect(remote.endpoint).toBeNull();
    expect(remote.anonKeyFingerprint).toBeNull();
    expect(remote.note).toMatch(/no remote configured/);
  });

  it('records the mock endpoint and a key FINGERPRINT, never the key itself', async () => {
    const { describeRemoteConfiguration } = await hermeticModule();
    const { createHash } = await import('node:crypto');
    const remote = describeRemoteConfiguration(
      {
        EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4545',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key-for-tests-only',
      },
      true,
      createHash,
    );
    expect(remote.mode).toBe('test-only-mock');
    expect(remote.endpoint).toBe('http://127.0.0.1:4545');
    // The fingerprint identifies the key without recording it.
    expect(remote.anonKeyFingerprint).toMatch(/^[0-9A-F]{16}$/);
    expect(JSON.stringify(remote)).not.toContain('mock-anon-key-for-tests-only');
    // A canonical build that somehow resolved a remote is a contradiction the
    // record must refuse rather than write down.
    expect(() =>
      describeRemoteConfiguration(
        { EXPO_PUBLIC_SUPABASE_URL: 'https://kruubbynsmxzxfdunaal.supabase.co' },
        false,
        createHash,
      ),
    ).toThrow(/refusing to certify/);
  });
  it('names the offending variable instead of stripping a live remote silently', async () => {
    const { remoteEnvRefusal } = await hermeticModule();
    const message = remoteEnvRefusal(['EXPO_PUBLIC_SUPABASE_URL'], 'Android E2E');
    expect(message).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(message).toContain('refuses to build');
    expect(message).toContain('unset the variable');
  });

  it('the web E2E build path still uses the shared envelope', () => {
    const source = readFileSync(join(SCRIPT_DIR, 'build-dist-e2e.mjs'), 'utf8');
    expect(source).toContain("from './hermetic-build.mjs'");
    expect(source).toContain('runHermeticBuild');
    expect(source).toContain('scanDirectoryForNeedle');
    // The old inline envelope must be gone: two copies drift.
    expect(source).not.toMatch(/const env = \{ \.\.\.process\.env, EXPO_NO_DOTENV/);
  });

  it('the native provisioner builds under the shared envelope and scans the bundle', () => {
    const source = readFileSync(join(SCRIPT_DIR, 'qa-native-provision.mjs'), 'utf8');
    expect(source).toContain("from './hermetic-build.mjs'");
    expect(source).toContain('hermeticBuildEnv');
    expect(source).toContain("from './native-apk-scan.mjs'");
    expect(source).toContain('assertApkHasNoHost');
    // The old `{ ...process.env }` envelope is exactly the defect.
    expect(source).not.toMatch(/const buildEnv = \{ \.\.\.process\.env/);
  });
});

describe('APK bundle Supabase-host scan', () => {
  it('finds a live host in a stored JS bundle (the shape RN ships)', async () => {
    const { scanArchiveForNeedle } = await apkScanModule();
    const apk = buildZip([
      { name: 'classes.dex', data: Buffer.from('binary-ish'), deflate: true },
      {
        name: 'assets/index.android.bundle',
        data: Buffer.from('const S="https://kruubbynsmxzxfdunaal.supabase.co";', 'utf8'),
        deflate: false,
      },
    ]);
    const hits = scanArchiveForNeedle(apk, 'supabase.co');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.name).toBe('assets/index.android.bundle');
  });

  it('finds a live host inside a deflated bundle too', async () => {
    const { scanArchiveForNeedle } = await apkScanModule();
    const apk = buildZip([
      {
        name: 'assets/index.android.bundle',
        data: Buffer.from('x'.repeat(4096) + 'https://live-project.supabase.co', 'utf8'),
        deflate: true,
      },
    ]);
    expect(scanArchiveForNeedle(apk, 'supabase.co')).toHaveLength(1);
  });

  it('clears a credential-free bundle and ignores non-JS entries', async () => {
    const { scanArchiveForNeedle } = await apkScanModule();
    const apk = buildZip([
      { name: 'assets/index.android.bundle', data: Buffer.from('no remote here'), deflate: false },
      {
        name: 'resources.arsc',
        data: Buffer.from('supabase.co in a resource table'),
        deflate: true,
      },
    ]);
    expect(scanArchiveForNeedle(apk, 'supabase.co')).toEqual([]);
  });

  it('throws with the offending entry when a host is present', async () => {
    const { assertApkHasNoHost } = await apkScanModule();
    const dir = join(ROOT, 'simulation-output', 'native', 'apk-scan-fixture');
    mkdirSync(dir, { recursive: true });
    const apkPath = join(dir, 'leaky.apk');
    try {
      writeFileSync(
        apkPath,
        buildZip([
          {
            name: 'assets/index.android.bundle',
            data: Buffer.from('https://kruubbynsmxzxfdunaal.supabase.co', 'utf8'),
            deflate: false,
          },
        ]),
      );
      expect(() => assertApkHasNoHost(apkPath)).toThrow(/Supabase host/);
      writeFileSync(
        apkPath,
        buildZip([
          { name: 'assets/index.android.bundle', data: Buffer.from('clean'), deflate: false },
        ]),
      );
      expect(assertApkHasNoHost(apkPath).scanned).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the CLI exits non-zero on a leaky archive (the provisioning seam)', () => {
    const dir = join(ROOT, 'simulation-output', 'native', 'apk-scan-cli-fixture');
    mkdirSync(dir, { recursive: true });
    const apkPath = join(dir, 'leaky.apk');
    try {
      writeFileSync(
        apkPath,
        buildZip([
          {
            name: 'assets/index.android.bundle',
            data: Buffer.from('https://kruubbynsmxzxfdunaal.supabase.co'),
            deflate: false,
          },
        ]),
      );
      let status = 0;
      try {
        execFileSync(process.execPath, [join(SCRIPT_DIR, 'native-apk-scan.mjs'), apkPath], {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (error) {
        status = (error as { status?: number }).status ?? 0;
      }
      expect(status).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('native flow coverage proof', () => {
  const flowsDir = join(ROOT, '.maestro', 'flows');

  it('resolves the real repository tags to real flows, non-empty and duplicate-free', async () => {
    const { resolveExpectedFlows } = await coverageModule();
    for (const tag of ['smoke', 'lifecycle', 'persistence']) {
      const { flows, errors } = resolveExpectedFlows({ flowsDir, tag });
      expect(errors, `tag ${tag}`).toEqual([]);
      expect(flows.length).toBeGreaterThan(0);
      const ids = flows.map((entry: { id: string }) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('reports a tag that matches nothing as an error, never a pass', async () => {
    const { resolveExpectedFlows } = await coverageModule();
    const { flows, errors } = resolveExpectedFlows({ flowsDir, tag: 'no-such-tag-xyz' });
    expect(flows).toEqual([]);
    expect(errors.join(' ')).toMatch(/No Maestro flow carries the requested tag/);
  });

  it('parses a flow header tag list and ignores the document body', async () => {
    const { parseFlowTags } = await coverageModule();
    const flow = readFileSync(join(flowsDir, 'native-smoke.yaml'), 'utf8');
    expect(parseFlowTags(flow)).toEqual(['native', 'smoke']);
    expect(parseFlowTags('appId: x\n---\n- runFlow:\n    when: true\n')).toEqual([]);
  });

  it('reads the executed flow set from a Maestro debug tree', async () => {
    const { readExecutedFlows } = await coverageModule();
    const dir = join(ROOT, 'simulation-output', 'native', 'coverage-fixture');
    const runDir = join(dir, '.maestro', 'tests', '2026-01-01_000000');
    mkdirSync(join(runDir, 'flow-a'), { recursive: true });
    mkdirSync(join(runDir, 'flow-b'), { recursive: true });
    mkdirSync(join(runDir, 'not-a-flow'), { recursive: true });
    writeFileSync(join(runDir, 'flow-a', 'manifest.json'), '{}');
    writeFileSync(join(runDir, 'flow-b', 'manifest.json'), '{}');
    writeFileSync(join(runDir, 'not-a-flow', 'commands.json'), '{}');
    writeFileSync(join(runDir, 'maestro.log'), 'log');
    try {
      expect(readExecutedFlows(dir).executed).toEqual(['flow-a', 'flow-b']);
      // Missing evidence is UNPROVEN, never an assumed pass.
      const absent = readExecutedFlows(join(dir, 'nope'));
      expect(absent.executed).toBeNull();
      expect(absent.reason).toMatch(/cannot be proven/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes only when the executed set equals the expected set and Maestro exited 0', async () => {
    const { evaluateFlowCoverage } = await coverageModule();
    const expected = [
      { id: 'a', path: 'a.yaml' },
      { id: 'b', path: 'b.yaml' },
    ];
    const ok = evaluateFlowCoverage({
      expected,
      errors: [],
      executed: ['b', 'a'],
      reason: null,
      exitCode: 0,
    });
    expect(ok.verdict).toBe('OK');
  });

  it('fails when a flow was dropped, when extra flows ran, or when Maestro failed', async () => {
    const { evaluateFlowCoverage } = await coverageModule();
    const expected = [
      { id: 'a', path: 'a.yaml' },
      { id: 'b', path: 'b.yaml' },
    ];
    const dropped = evaluateFlowCoverage({
      expected,
      errors: [],
      executed: ['a'],
      reason: null,
      exitCode: 0,
    });
    expect(dropped.verdict).toBe('MISMATCH');
    expect(dropped.missing).toEqual(['b']);
    const extra = evaluateFlowCoverage({
      expected,
      errors: [],
      executed: ['a', 'b', 'c'],
      reason: null,
      exitCode: 0,
    });
    expect(extra.unexpected).toEqual(['c']);
    const failed = evaluateFlowCoverage({
      expected,
      errors: [],
      executed: ['a'],
      reason: null,
      exitCode: 1,
    });
    expect(failed.verdict).toBe('MISMATCH');
    expect(failed.reason).toMatch(/exited 1/);
  });

  it('treats unreadable coverage and resolution errors as non-passes', async () => {
    const { evaluateFlowCoverage } = await coverageModule();
    const unproven = evaluateFlowCoverage({
      expected: [{ id: 'a', path: 'a.yaml' }],
      errors: [],
      executed: null,
      reason: 'no debug output',
      exitCode: 0,
    });
    expect(unproven.verdict).toBe('UNPROVEN');
    const errored = evaluateFlowCoverage({
      expected: [],
      errors: ['tag matched nothing'],
      executed: [],
      reason: null,
      exitCode: 0,
    });
    expect(errored.verdict).toBe('MISMATCH');
  });

  it('states in its own text when a run was NOT on a verified current-source binary', async () => {
    // Task 2.4: a --no-provision run is permitted, but the record has to
    // identify itself, so the wording is a tested contract.
    const { describeBinaryEvidence } = await coverageModule();

    const provisioned = describeBinaryEvidence({
      provisioned: true,
      installedApkSha256: 'ABCDEF0123456789',
    });
    expect(provisioned.binaryVerified).toBe(true);
    expect(provisioned.note).toContain('ABCDEF0123456789');

    const unverified = describeBinaryEvidence({
      provisioned: false,
      installedApkSha256: 'ABCDEF0123456789',
    });
    expect(unverified.binaryVerified).toBe(false);
    expect(unverified.note).toContain('UNVERIFIED INSTALLED BINARY');
    expect(unverified.note).toContain('not current-source evidence');
    expect(unverified.note).toContain('ABCDEF0123456789');

    // An unobtainable hash must not read as a verified run.
    const unknown = describeBinaryEvidence({ provisioned: false, installedApkSha256: null });
    expect(unknown.binaryVerified).toBe(false);
    expect(unknown.note).toContain('<unobtainable on this target>');
    // A platform with no identity at all (iOS on this host) is also unverified.
    expect(
      describeBinaryEvidence({ provisioned: null, installedApkSha256: null }).binaryVerified,
    ).toBe(false);
  });

  it('the Android runner wires coverage, binary identity, and no --force', () => {
    const source = readFileSync(join(SCRIPT_DIR, 'qa-native.mjs'), 'utf8');
    expect(source).toContain("from './native-flow-coverage.mjs'");
    expect(source).toContain('resolveExpectedFlows');
    expect(source).toContain('evaluateFlowCoverage');
    expect(source).toContain('readExecutedFlows');
    // Binary identity fields.
    expect(source).toContain('installedApkSha256');
    expect(source).toContain('provisioned');
    // The no-op flag is gone from both the runner and the provisioner.
    expect(source).not.toContain('--force');
    expect(readFileSync(join(SCRIPT_DIR, 'qa-native-provision.mjs'), 'utf8')).not.toContain(
      '--force',
    );
  });
});
