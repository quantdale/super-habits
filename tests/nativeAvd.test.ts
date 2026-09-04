import { describe, expect, it } from 'vitest';
import {
  buildTargetRunRecord,
  findNewEmulatorSerial,
  isBootReady,
  matchConnectedAvd,
  parseAvdListOutput,
  planAvdSequence,
  summarizeTargetRuns,
  targetLabel,
} from '../scripts/native-avd.mjs';

describe('native multi-AVD orchestration helpers', () => {
  it('parses emulator AVD listings and ignores blank lines', () => {
    expect(parseAvdListOutput('Nitro_API_36\r\nCRBABot_API_36\n\nbraintraining36\n')).toEqual([
      'Nitro_API_36',
      'CRBABot_API_36',
      'braintraining36',
    ]);
    expect(parseAvdListOutput('')).toEqual([]);
    expect(parseAvdListOutput(null)).toEqual([]);
  });

  it('reports boot readiness only when sys.boot_completed is 1', () => {
    expect(isBootReady({ 'sys.boot_completed': '1' })).toEqual({ ready: true, reason: null });
    const pending = isBootReady({ 'sys.boot_completed': '0' });
    expect(pending.ready).toBe(false);
    expect(pending.reason).toMatch(/sys\.boot_completed/);
    const missing = isBootReady({});
    expect(missing.ready).toBe(false);
    expect(missing.reason).toMatch(/<missing>/);
  });

  it('matches a requested AVD against connected devices by reported AVD name', () => {
    const devices = [
      { serial: 'emulator-5554', state: 'device', avd: 'Nitro_API_36' },
      { serial: 'emulator-5556', state: 'device', avd: 'CRBABot_API_36' },
      { serial: 'emulator-5558', state: 'offline', avd: 'Nitro_API_36' },
    ];
    expect(matchConnectedAvd(devices, 'CRBABot_API_36')).toBe('emulator-5556');
    expect(matchConnectedAvd(devices, 'braintraining36')).toBe(null);
  });

  it('plans a validated sequential AVD order and fails fast on bad requests', () => {
    const available = ['Nitro_API_36', 'CRBABot_API_36'];
    expect(planAvdSequence(['Nitro_API_36', 'CRBABot_API_36'], available)).toEqual({
      sequence: ['Nitro_API_36', 'CRBABot_API_36'],
    });
    expect(() => planAvdSequence([], available)).toThrow(/No AVD targets/);
    expect(() => planAvdSequence(['Missing_AVD'], available)).toThrow(/Unknown AVD/);
    expect(() => planAvdSequence(['Nitro_API_36', 'Nitro_API_36'], available)).toThrow(
      /Duplicate AVD/,
    );
  });

  it('identifies a freshly booted emulator serial without guessing', () => {
    const before = 'List of devices attached\nemulator-5554\tdevice\n';
    const after = 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n';
    expect(findNewEmulatorSerial(before, after)).toEqual({ serial: 'emulator-5556', reason: null });
    const none = findNewEmulatorSerial(before, before);
    expect(none.serial).toBe(null);
    expect(none.reason).toMatch(/No new connected device/);
    const ambiguous = findNewEmulatorSerial(
      before,
      'List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\nemulator-5558\tdevice\n',
    );
    expect(ambiguous.serial).toBe(null);
    expect(ambiguous.reason).toMatch(/refusing to guess/);
  });

  it('builds filename-safe target labels', () => {
    expect(targetLabel({ avd: 'Nitro_API_36', serial: 'emulator-5554' })).toBe('Nitro_API_36');
    expect(targetLabel({ avd: null, serial: 'emulator-5554' })).toBe('emulator-5554');
    expect(targetLabel({ avd: 'weird name/1', serial: null })).toBe('weird_name_1');
    expect(targetLabel({ avd: null, serial: null })).toBe('unknown-target');
  });

  it('builds provenance records with measured durations', () => {
    const record = buildTargetRunRecord({
      sourceSha: 'abc123',
      apkSha256: 'DEADBEEF',
      avd: 'Nitro_API_36',
      serial: 'emulator-5554',
      ownedEmulator: true,
      tag: 'smoke',
      startedAt: '2026-09-04T08:00:00.000Z',
      endedAt: '2026-09-04T08:05:00.000Z',
      status: 'PASS',
      replayCommand: 'npm run qa:native -- --platform android --tag smoke',
    });
    expect(record.schemaVersion).toBe(1);
    expect(record.buildKind).toBe('canonical');
    expect(record.durationMs).toBe(300000);
    expect(record.lane).toEqual({ tag: 'smoke', flow: null });
  });

  it('collates per-target runs into a campaign summary', () => {
    expect(summarizeTargetRuns([])).toEqual({
      total: 0,
      pass: 0,
      failed: 0,
      blocked: 0,
      status: 'EMPTY',
    });
    const summary = summarizeTargetRuns([
      buildTargetRunRecord({ status: 'PASS' }),
      buildTargetRunRecord({ status: 'FAILED_NEEDS_TRIAGE' }),
      buildTargetRunRecord({ status: 'BLOCKED' }),
    ]);
    expect(summary).toEqual({ total: 3, pass: 1, failed: 1, blocked: 1, status: 'FAIL' });
  });
});
