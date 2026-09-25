import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const serverScript = resolve(process.cwd(), 'scripts/serve-e2e.js');
const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function checkRejectedBeforeListen(embeddedHost: string): void {
  const fixture = mkdtempSync(join(tmpdir(), 'superhabits-e2e-guard-'));
  fixtures.push(fixture);
  writeFileSync(join(fixture, 'index.html'), `<script>const backend = '${embeddedHost}'</script>`);

  const result = spawnSync(process.execPath, [serverScript, '--dist', fixture, '--port', '19871'], {
    encoding: 'utf8',
    timeout: 3000,
  });

  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('REFUSING to serve');
  expect(result.stdout).not.toContain('E2E static server:');
}

describe('E2E runtime host guard', () => {
  it('rejects a live host before listening', () => {
    checkRejectedBeforeListen('https://fixture-live.supabase.co');
  });

  it('rejects a case-variant live host before listening', () => {
    checkRejectedBeforeListen('https://FIXTURE-LIVE.SUPABASE.CO');
  });

  it('rejects the dummy host outside the dedicated dist-sync export', () => {
    checkRejectedBeforeListen('https://dummy.supabase.co');
  });
});
