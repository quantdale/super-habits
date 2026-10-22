import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaScriptRel = 'scripts/validate-supabase-schema.mjs';

/**
 * `supabase:schema:validate` is a pure text-matcher over the migrations — it
 * never connects to a hosted project — so its value is entirely the set of
 * invariants it actually asserts over the most security-sensitive surface in
 * the schema: the five backup-generation tables and the privileged functions
 * that implement validate-before-publish.
 *
 * This suite pins the guard AND proves it can fail per property family. A
 * guard that cannot reject a broken input is indistinguishable from no guard,
 * so every security property gets a MUTATION of the real migration chain and
 * asserts the specific rejection. The earlier revision of this file asserted
 * the RLS loop with a static `toContain` over a template literal that never
 * interpolated (`\${table}`), which passed for all five tables regardless of
 * what the validator checked — this rewrite makes coverage per-table and
 * behavioral.
 *
 * HERMETIC FIXTURE: mutations copy the validator + its input trees into a
 * temp directory instead of editing `supabase/migrations/` in place. The
 * previous in-place approach raced `planningSchemaConvergence.test.ts` (which
 * execSyncs the same validator over the same files under Vitest's parallel
 * workers). Here every test owns its own fixture; no repository file is ever
 * modified.
 */

const FIXTURE_COPIES = ['supabase', 'simulation/backend', 'lib', 'core/sync'] as const;

function makeFixture(): { root: string; script: string } {
  const root = mkdtempSync(join(tmpdir(), 'sh-schema-guard-'));
  for (const rel of FIXTURE_COPIES) {
    cpSync(join(repoRoot, rel), join(root, rel), { recursive: true });
  }
  cpSync(join(repoRoot, schemaScriptRel), join(root, schemaScriptRel));
  return { root, script: join(root, schemaScriptRel) };
}

function runValidator(script: string): { ok: boolean; output: string } {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: stdout };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

/**
 * Apply `transform` to EVERY migration file (for statements asserted over the
 * whole chain — e.g. RLS enablement, which more than one generation can hold).
 */
function mutateEveryMigration(root: string, transform: (source: string) => string): void {
  const migrationsDir = join(root, 'supabase', 'migrations');
  let changed = 0;
  for (const name of readdirSync(migrationsDir).sort()) {
    if (!name.endsWith('.sql')) continue;
    const target = join(migrationsDir, name);
    const original = readFileSync(target, 'utf8');
    const mutated = transform(original);
    if (mutated !== original) {
      writeFileSync(target, mutated);
      changed += 1;
    }
  }
  if (changed === 0) throw new Error('mutation needle matched no migration file');
}

/** Apply `transform` to the migration whose name contains `nameNeedle`. */
function mutateFile(root: string, nameNeedle: string, transform: (source: string) => string): void {
  const migrationsDir = join(root, 'supabase', 'migrations');
  for (const name of readdirSync(migrationsDir).sort()) {
    if (!name.endsWith('.sql') || !name.includes(nameNeedle)) continue;
    const target = join(migrationsDir, name);
    writeFileSync(target, transform(readFileSync(target, 'utf8')));
    return;
  }
  throw new Error(`no migration file matches ${nameNeedle}`);
}

function appendToProvenance(root: string, sql: string): void {
  mutateFile(root, '_enforce_backup_publication_provenance', (source) => `${source}\n${sql}\n`);
}

describe('backup generation protocol schema guard (hermetic mutation suite)', () => {
  it('passes on the current migration set (fixture is faithful)', () => {
    const { root, script } = makeFixture();
    try {
      const result = runValidator(script);
      expect(result.ok, result.output).toBe(true);
      expect(result.output).toMatch(/Supabase schema contract PASS/);
      // The fixture run agrees with the repository run — mutations below are
      // therefore testing the real guard, not a degraded copy.
      expect(runValidator(join(repoRoot, schemaScriptRel)).ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ---- Mandatory negative family 1: missing RLS (per table) ---------------
  for (const table of [
    'backup_generation',
    'backup_generation_chunk',
    'backup_generation_head',
    'backup_generation_sequence_reservation',
    'backup_generation_publication',
  ]) {
    it(`FAILS when ${table} loses RLS enablement (per-table, not a shared literal)`, () => {
      const { root, script } = makeFixture();
      try {
        mutateEveryMigration(root, (source) =>
          source.replace(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`, ''),
        );
        const result = runValidator(script);
        expect(result.ok).toBe(false);
        expect(result.output).toMatch(new RegExp(`generation RLS ${table} is missing`));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  // ---- Mandatory negative family 2: blanket access ------------------------
  it('FAILS when a blanket generation policy is introduced', () => {
    const { root, script } = makeFixture();
    try {
      appendToProvenance(
        root,
        'CREATE POLICY backup_generation_leak ON public.backup_generation FOR SELECT USING (true);',
      );
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/must not be blanket/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ---- Mandatory negative family 3: unauthorized anonymous grants ---------
  it('FAILS when a generation table is granted to anon', () => {
    const { root, script } = makeFixture();
    try {
      appendToProvenance(root, 'GRANT SELECT ON TABLE public.backup_generation TO anon;');
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/must not target anon/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('FAILS when a privileged generation function is granted to anon', () => {
    const { root, script } = makeFixture();
    try {
      appendToProvenance(
        root,
        'GRANT EXECUTE ON FUNCTION public.reserve_backup_generation_sequence(text, text, bigint, integer) TO anon;',
      );
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/never be granted to anon/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ---- Mandatory negative family 4: missing privilege reset ---------------
  it('FAILS when the five-table TRUNCATE-closing privilege reset is deleted', () => {
    const { root, script } = makeFixture();
    try {
      mutateFile(root, '_enforce_backup_publication_provenance', (source) =>
        source.replace(
          /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*?FROM authenticated, anon, PUBLIC;/,
          '',
        ),
      );
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/privilege reset is missing or incomplete/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ---- Mandatory negative family 5: unsafe SECURITY DEFINER ---------------
  it('FAILS when a privileged function loses SECURITY DEFINER', () => {
    const { root, script } = makeFixture();
    try {
      mutateFile(root, '_enforce_backup_publication_provenance', (source) =>
        source.replace(/LANGUAGE plpgsql\s*\r?\n\s*SECURITY DEFINER/, 'LANGUAGE plpgsql'),
      );
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/must be SECURITY DEFINER/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ---- Mandatory negative family 6: unpinned search_path ------------------
  it('FAILS when ONE definer function loses its search_path pin', () => {
    const { root, script } = makeFixture();
    try {
      // Remove only the FIRST definer's pin; the sibling pins remain. The old
      // single-occurrence check passed exactly this mutation.
      mutateFile(root, '_enforce_backup_publication_provenance', (source) =>
        source.replace(/(SECURITY DEFINER)\s*\r?\n\s*SET search_path = pg_catalog/, '$1'),
      );
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/must pin search_path/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ---- Mandatory negative family 7: weakened owner predicates -------------
  it('FAILS when a policy predicate stops constraining rows to auth.uid()', () => {
    const { root, script } = makeFixture();
    try {
      mutateFile(root, '_add_backup_generation_protocol', (source) =>
        source.replace('(select auth.uid()) = user_id', 'user_id IS NOT NULL'),
      );
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/constrain rows to the caller's uid/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ---- Mandatory negative family 8: incorrect execution/write grants ------
  it('FAILS when a read-only generation table gains a write-shaped grant', () => {
    const { root, script } = makeFixture();
    try {
      appendToProvenance(
        root,
        'GRANT INSERT ON TABLE public.backup_generation_publication TO authenticated;',
      );
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(
        /must not grant client writes to backup_generation_publication/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('FAILS when a required generation grant is removed', () => {
    const { root, script } = makeFixture();
    try {
      mutateFile(root, '_enforce_backup_publication_provenance', (source) =>
        source.replace(
          'GRANT SELECT, INSERT, UPDATE ON TABLE public.backup_generation_chunk TO authenticated;',
          '',
        ),
      );
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/generation chunk DML grant is missing/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ---- Mandatory negative family 9: retired publisher callable ------------
  it('FAILS when the retired v1 publisher is re-granted to a client role', () => {
    const { root, script } = makeFixture();
    try {
      appendToProvenance(
        root,
        'GRANT EXECUTE ON FUNCTION public.backup_generation_publish_v1(text, bigint, integer, text) TO authenticated;',
      );
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/legacy v1 publisher must not be executable by clients/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('FAILS on a schema-wide EXECUTE grant (the v1-callable evasion)', () => {
    const { root, script } = makeFixture();
    try {
      appendToProvenance(root, 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;');
      const result = runValidator(script);
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/function-scoped/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // ---- Honesty ------------------------------------------------------------
  it('states it is static validation only and never claims hosted certification', () => {
    const { root, script } = makeFixture();
    try {
      const result = runValidator(script);
      expect(result.ok, result.output).toBe(true);
      expect(result.output).toMatch(/static source validation only/i);
      expect(result.output).toMatch(/not hosted certification/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
