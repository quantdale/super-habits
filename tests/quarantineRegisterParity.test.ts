import { describe, expect, it } from 'vitest';
import {
  findGateFiles,
  findStaleEntries,
  findUnregistered,
  parseRegisterEntries,
  stripComments,
} from '../scripts/quarantine-register-parity.mjs';

describe('quarantine-register-parity helpers', () => {
  it('keeps real gate calls and drops line-comment mentions', () => {
    const source = [
      '// test.fixme(!remoteBackupDetected, ...) — doc note, not a gate',
      "test.fixme(!remoteBackupDetected, 'runs in journeys-sync');",
      "await page.goto('https://dummy.supabase.co/rest/v1/todos');",
    ].join('\n');
    const stripped = stripComments(source);
    expect(stripped).not.toContain('doc note');
    expect(stripped).toContain('test.fixme(!remoteBackupDetected');
    // The URL string survives comment stripping intact.
    expect(stripped).toContain('https://dummy.supabase.co/rest/v1/todos');
  });

  it('drops block-comment gate mentions', () => {
    const source = "/*\n * test.fixme(!x, ...) — historical note\n */\ntest.skip(true, 'gated');";
    const stripped = stripComments(source);
    expect(stripped).not.toContain('historical note');
    expect(stripped).toContain('test.skip(true');
  });

  it('keeps route strings that contain comment delimiters (the-commute class)', () => {
    const source = [
      "await page.unroute('**/*.supabase.co/**');",
      "await page.context().route('**/*.supabase.co/**', handler);",
      "test.fixme(!remoteBoundaryDetected, 'runs in journeys-sync');",
    ].join('\n');
    const stripped = stripComments(source);
    expect(stripped).toContain('test.fixme(!remoteBoundaryDetected');
  });

  it('scans template expressions as code and keeps literal text', () => {
    const source = 'const label = `switch ${s.label} ${ms}ms // not a comment`;';
    const stripped = stripComments(source);
    expect(stripped).toContain('// not a comment');
  });

  it('finds gate files only among spec files with real calls', () => {
    const files = new Map([
      ['e2e/journeys/new-phone.spec.ts', "test.fixme(!detected, 'lane');"],
      ['e2e/journeys/three-months-in.spec.ts', 'expect(ms).toBeLessThanOrEqual(800);'],
      ['e2e/helpers/journey.ts', 'test.fixme(true, step.quarantine);'],
      ['e2e/journeys/notes.spec.ts', '// test.fixme(!x, ...) — just a comment'],
    ]);
    // Helpers implement the mechanism and non-spec/doc mentions do not count.
    expect(findGateFiles(files)).toEqual(['new-phone']);
  });

  it('flags stems with no structured register entry and passes registered ones', () => {
    // A prose mention is NOT a registration any more: only a `**Gate site:**`
    // line counts, so the incidental mention that used to keep this green fails.
    const register = [
      '### 8. Restore remote boundary',
      '',
      '**Gate site:** `e2e/journeys/new-phone.spec.ts`',
      '',
      '**Reason:** an incidental mention of command-center-v2-ask in prose.',
    ].join('\n');
    const entries = parseRegisterEntries(register);
    expect(findUnregistered(['new-phone', 'command-center-v2-ask'], entries)).toEqual([
      'command-center-v2-ask',
    ]);
    expect(findUnregistered(['new-phone'], entries)).toEqual([]);
  });
});

/**
 * The widened guard (harden-ci-lane-integrity task 6): the Vitest skip and
 * quarantine mechanisms count as gates, registration must be STRUCTURED (a
 * `**Gate site:**` line rather than an incidental prose mention), and the
 * reverse direction must fail when an entry names a file with no gate call.
 */
describe('quarantine-register-parity — widened detection and both directions', () => {
  it('recognizes the Vitest skip and quarantine mechanisms as gates', () => {
    const files = new Map([
      [
        'tests/integration/disposableCloudRoundTrip.test.ts',
        "describe.skipIf(!run)('x', () => {});",
      ],
      ['tests/some.test.ts', 'it.skipIf(cond)("y", () => {});'],
      ['tests/other.test.ts', "it.fails('z', () => {});"],
      ['tests/none.test.ts', 'expect(1).toBe(1);'],
    ]);
    expect(findGateFiles(files)).toEqual(['disposableCloudRoundTrip', 'other', 'some']);
  });

  it('treats a structured Gate site line as the registration and prose as none', () => {
    const register = [
      '### 8. Restore remote boundary',
      '',
      '**Gate site:** `e2e/journeys/new-phone.spec.ts`',
      '',
      '**Reason:** an incidental mention of recoverable-account-v1 in prose.',
      '',
      '### 20. Another lane',
      '',
      '**Reason:** mentions `e2e/journeys/portable-owner-recovery.spec.ts` without a gate site line.',
    ].join('\n');

    const entries = parseRegisterEntries(register);
    expect(entries.map((entry) => entry.stem)).toEqual(['new-phone']);
    expect(
      findUnregistered(['new-phone', 'recoverable-account-v1', 'portable-owner-recovery'], entries),
    ).toEqual(['portable-owner-recovery', 'recoverable-account-v1']);
  });

  it('reports the reverse direction: an entry whose named file has no gate call', () => {
    const register = [
      '### 13. Ask provider-unavailable journey step',
      '',
      '**Gate site:** `e2e/journeys/command-center-v2.spec.ts`',
      '',
      '### 20. V2-era files',
      '',
      '**Gate site:** `e2e/journeys/new-phone-v2.spec.ts`',
    ].join('\n');
    const gateFiles = ['e2e/journeys/new-phone-v2.spec.ts'];

    const stale = findStaleEntries(parseRegisterEntries(register), gateFiles);
    expect(stale.map((entry: { stem: string }) => entry.stem)).toEqual(['command-center-v2']);
  });

  it('accepts several gate sites owned by one register heading', () => {
    const register = [
      '### 9. Reconnect-push boundary',
      '',
      '**Gate site:** `e2e/journeys/the-commute.spec.ts`',
      '**Gate site:** `e2e/journeys/bad-backend.spec.ts`',
    ].join('\n');

    expect(
      parseRegisterEntries(register)
        .map((entry) => entry.stem)
        .sort(),
    ).toEqual(['bad-backend', 'the-commute']);
  });
});
