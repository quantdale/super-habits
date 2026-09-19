import { describe, expect, it } from 'vitest';
import {
  findGateFiles,
  findUnregistered,
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

  it('flags stems missing from the register and passes named ones', () => {
    const register = 'Covered files: `e2e/journeys/new-phone.spec.ts` (J5).';
    expect(findUnregistered(['new-phone', 'command-center-v2-ask'], register)).toEqual([
      'command-center-v2-ask',
    ]);
    expect(findUnregistered(['new-phone'], register)).toEqual([]);
  });
});
