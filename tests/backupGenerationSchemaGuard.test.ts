import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaScript = resolve(repoRoot, 'scripts/validate-supabase-schema.mjs');
const migrationRel = 'supabase/migrations/20261020090000_enforce_backup_publication_provenance.sql';

const runValidator = () => {
  try {
    const stdout = execFileSync(process.execPath, [schemaScript], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: stdout };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
};

/**
 * `supabase:schema:validate` is a pure text-matcher over the migrations — it
 * never connects to a hosted project — so its value is entirely the set of
 * invariants it actually asserts.
 *
 * It previously asserted NOTHING about the five backup-generation tables or the
 * two privileged functions that implement validate-before-publish. That is the
 * most security-sensitive surface in the schema (concurrent-generation
 * reservation, manifest-checksum verification, atomic publication), so a dropped
 * policy, a widened grant, or a definer function losing its pinned search_path
 * could regress it while the validator stayed green.
 *
 * These tests pin the guard AND prove it can fail: a guard that cannot reject a
 * broken input is indistinguishable from no guard at all.
 */
describe('backup generation protocol schema guard', () => {
  it('passes on the current migration set', () => {
    const result = runValidator();
    expect(result.ok, result.output).toBe(true);
    expect(result.output).toMatch(/Supabase schema contract PASS/);
  });

  it('asserts RLS is enabled on every generation table', () => {
    const source = readFileSync(schemaScript, 'utf8');
    for (const table of [
      'backup_generation',
      'backup_generation_chunk',
      'backup_generation_head',
      'backup_generation_sequence_reservation',
      'backup_generation_publication',
    ]) {
      expect(source, `${table} should be guarded`).toContain(
        `ALTER TABLE public.\${table} ENABLE ROW LEVEL SECURITY`,
      );
    }
  });

  it('asserts no blanket or anon-targeted generation policy', () => {
    const source = readFileSync(schemaScript, 'utf8');
    // Both are asserted ABSENT, which is the failure mode a naive port forgets:
    // a `USING (true)` policy makes every generation row world-readable, and a
    // `TO anon` policy hands the backup protocol to unauthenticated callers.
    expect(source).toContain('generation policies must not be blanket');
    expect(source).toContain('generation policies must not target anon');
  });

  it('asserts head/reservation/publication stay read-only for clients', () => {
    const source = readFileSync(schemaScript, 'utf8');
    // The client may read these but must never write them directly — writes go
    // through the SECURITY DEFINER publisher so provenance cannot be forged.
    expect(source).toContain('generation must not grant client writes to');
  });

  it('asserts the retired v1 publisher is not executable by clients', () => {
    const source = readFileSync(schemaScript, 'utf8');
    expect(source).toContain('legacy v1 publisher must not be executable by clients');
  });

  it('FAILS when a required generation grant is removed (the guard has teeth)', () => {
    // Mutate the real migration in place, run the real validator, restore.
    const target = resolve(repoRoot, migrationRel);
    const original = readFileSync(target, 'utf8');
    const dir = mkdtempSync(join(tmpdir(), 'sh-schema-guard-'));
    const backup = join(dir, 'migration.bak');
    copyFileSync(target, backup);
    try {
      writeFileSync(
        target,
        original.replace(
          'GRANT SELECT, INSERT, UPDATE ON TABLE public.backup_generation_chunk TO authenticated;',
          '',
        ),
      );
      const result = runValidator();
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/generation chunk DML grant is missing/);
    } finally {
      copyFileSync(backup, target);
      unlinkSync(backup);
      rmSync(dir, { recursive: true, force: true });
    }
    // Restored: the validator is green again, so the test cannot leak state.
    expect(runValidator().ok).toBe(true);
  });

  it('FAILS when a blanket generation policy is introduced', () => {
    const target = resolve(repoRoot, migrationRel);
    const original = readFileSync(target, 'utf8');
    const dir = mkdtempSync(join(tmpdir(), 'sh-schema-guard-blanket-'));
    const backup = join(dir, 'migration.bak');
    copyFileSync(target, backup);
    try {
      writeFileSync(
        target,
        `${original}\nCREATE POLICY backup_generation_leak ON public.backup_generation FOR SELECT USING (true);\n`,
      );
      const result = runValidator();
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/must not be blanket/);
    } finally {
      copyFileSync(backup, target);
      unlinkSync(backup);
      rmSync(dir, { recursive: true, force: true });
    }
    expect(runValidator().ok).toBe(true);
  });
});
