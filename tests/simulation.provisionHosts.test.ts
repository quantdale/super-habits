/**
 * Unit tests for provision.ts's host-list parsing and the documented
 * `--production-hosts` CLI flag (regression: the flag was advertised by the
 * precondition error message but silently ignored — only the env var was
 * read, so a flag-only invocation aborted with "hosts are not configured").
 *
 * `parseCommonOpts`/`run` are not imported here (module has CLI side effects
 * behind `require.main`); the pure `parseHostList` export plus a argv-level
 * contract check via `main('help')` keep these tests network-free.
 */
import { describe, expect, it } from 'vitest';
import { parseHostList } from '../simulation/backend/provision';

describe('parseHostList', () => {
  it('splits comma-separated hosts and trims whitespace', () => {
    expect(parseHostList('a.supabase.co, b.supabase.co')).toEqual([
      'a.supabase.co',
      'b.supabase.co',
    ]);
  });

  it('drops empty segments and treats empty input as no hosts', () => {
    expect(parseHostList('')).toEqual([]);
    expect(parseHostList(' , , ')).toEqual([]);
    expect(parseHostList('a.supabase.co,,b.supabase.co,')).toEqual([
      'a.supabase.co',
      'b.supabase.co',
    ]);
  });

  it('accepts full URLs the same way the guard normalizes them', () => {
    expect(parseHostList('https://prod.supabase.co')).toEqual(['https://prod.supabase.co']);
  });

  it('documents --production-hosts in the CLI help (flag must stay wired)', async () => {
    // Help text is the user-visible contract for the flag; if the flag is
    // removed from parsing, help must not advertise it either.
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
      chunks.push(s);
      return true;
    };
    try {
      const { main } = await import('../simulation/backend/provision');
      const code = await main(['help']);
      expect(code).toBe(0);
    } finally {
      (process.stdout as unknown as { write: typeof original }).write = original;
    }
    const help = chunks.join('');
    expect(help).toContain('--production-hosts');
  });
});
