import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Vercel Ignored Build Step (`ignoreCommand` -> scripts/vercel-ignore-build.sh).
 *
 * Vercel semantics (vercel.json#ignorecommand): the command's exit code 1
 * continues the build; exit code 0 skips (ignores) it. The script must
 * therefore SKIP only for documentation-only commit ranges (`*.md` anywhere,
 * `docs/`, `.agent/`, `openspec/`) and BUILD for anything else — including
 * whenever the diff cannot be computed (shallow clone, missing sha), because a
 * false skip silently ships stale source.
 *
 * These tests drive the real script with `sh` against throwaway git repos so
 * the range-base selection (VERCEL_GIT_PREVIOUS_SHA vs HEAD^) and the
 * failure-to-build fallbacks are exercised end to end, not reimplemented.
 */

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = resolve(repositoryRoot, 'scripts/vercel-ignore-build.sh');

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vercel-ignore-build-'));
  tempDirs.push(dir);
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.name', 'Vercel Ignore Test']);
  git(dir, ['config', 'user.email', 'vercel-ignore-test@example.invalid']);
  return dir;
}

function write(repo: string, relativePath: string, contents: string): void {
  const fullPath = join(repo, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents);
}

function commitAll(repo: string, message: string): string {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

function runIgnoreScript(repo: string, previousSha?: string): number | null {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (previousSha === undefined) {
    delete env.VERCEL_GIT_PREVIOUS_SHA;
  } else {
    env.VERCEL_GIT_PREVIOUS_SHA = previousSha;
  }
  const result = spawnSync('sh', [scriptPath], { cwd: repo, encoding: 'utf8', env });
  return result.status;
}

describe('vercel-ignore-build.sh (Vercel ignoreCommand)', () => {
  it('skips the build when the range changes only markdown, docs, .agent and openspec paths', () => {
    const repo = makeRepo();
    write(repo, 'src/app.ts', 'export const app = true;\n');
    const base = commitAll(repo, 'base commit with code');
    write(repo, 'README.md', '# Docs\n');
    write(repo, 'docs/architecture.md', '# Architecture\n');
    write(repo, 'docs/reports/notes.txt', 'non-markdown under docs/ is still docs\n');
    write(repo, '.agent/execplans/vercel-task.md', '# Plan\n');
    write(repo, 'openspec/changes/my-change/tasks.md', '- [ ] task\n');
    commitAll(repo, 'docs-only commit');
    expect(runIgnoreScript(repo, base)).toBe(0);
  });

  it('skips the build for markdown files anywhere in the tree', () => {
    const repo = makeRepo();
    write(repo, 'src/app.ts', 'export const app = true;\n');
    const base = commitAll(repo, 'base commit with code');
    write(repo, 'CHANGELOG.md', 'notes\n');
    write(repo, 'features/todos/NOTES.md', 'notes\n');
    commitAll(repo, 'markdown anywhere commit');
    expect(runIgnoreScript(repo, base)).toBe(0);
  });

  it('builds when docs changes mix with any code change', () => {
    const repo = makeRepo();
    write(repo, 'src/app.ts', 'export const app = true;\n');
    const base = commitAll(repo, 'base commit with code');
    write(repo, 'docs/guide.md', '# Guide\n');
    write(repo, 'src/feature.ts', 'export const feature = true;\n');
    commitAll(repo, 'mixed docs and code commit');
    expect(runIgnoreScript(repo, base)).toBe(1);
  });

  it('builds when only code changes', () => {
    const repo = makeRepo();
    write(repo, 'src/app.ts', 'export const app = true;\n');
    const base = commitAll(repo, 'base commit with code');
    write(repo, 'src/app.ts', 'export const app = false;\n');
    commitAll(repo, 'code-only commit');
    expect(runIgnoreScript(repo, base)).toBe(1);
  });

  it('skips the build for openspec-only changes', () => {
    const repo = makeRepo();
    write(repo, 'src/app.ts', 'export const app = true;\n');
    const base = commitAll(repo, 'base commit with code');
    write(repo, 'openspec/changes/my-change/spec.md', '# Spec\n');
    write(repo, 'openspec/changes/my-change/schema.json', '{}\n');
    commitAll(repo, 'openspec-only commit');
    expect(runIgnoreScript(repo, base)).toBe(0);
  });

  it('skips the build for .agent-only changes', () => {
    const repo = makeRepo();
    write(repo, 'src/app.ts', 'export const app = true;\n');
    const base = commitAll(repo, 'base commit with code');
    write(repo, '.agent/PLANS.md', '# Plans\n');
    write(repo, '.agent/execplans/other.json', '{}\n');
    commitAll(repo, '.agent-only commit');
    expect(runIgnoreScript(repo, base)).toBe(0);
  });

  it('builds when the diff cannot be computed (unknown VERCEL_GIT_PREVIOUS_SHA)', () => {
    const repo = makeRepo();
    write(repo, 'src/app.ts', 'export const app = true;\n');
    commitAll(repo, 'base commit with code');
    // Even with a docs-only commit on top, an unresolvable base means an
    // unknown diff — never skip on that.
    write(repo, 'README.md', '# Docs\n');
    commitAll(repo, 'docs-only commit');
    const missingSha = '0'.repeat(40);
    expect(runIgnoreScript(repo, missingSha)).toBe(1);
  });

  it('builds when there is no HEAD^ and no VERCEL_GIT_PREVIOUS_SHA (shallow/single-commit)', () => {
    const repo = makeRepo();
    write(repo, 'README.md', '# Docs\n');
    commitAll(repo, 'only commit in the repo');
    expect(runIgnoreScript(repo)).toBe(1);
  });

  it('falls back to HEAD^ when VERCEL_GIT_PREVIOUS_SHA is unset', () => {
    const repo = makeRepo();
    write(repo, 'src/app.ts', 'export const app = true;\n');
    commitAll(repo, 'base commit with code');
    write(repo, 'docs/guide.md', '# Guide\n');
    commitAll(repo, 'docs-only commit');
    expect(runIgnoreScript(repo)).toBe(0);
  });

  it('uses VERCEL_GIT_PREVIOUS_SHA as the range base in preference to HEAD^', () => {
    const repo = makeRepo();
    write(repo, 'src/app.ts', 'export const app = true;\n');
    const previous = commitAll(repo, 'previous deployment commit');
    write(repo, 'src/feature.ts', 'export const feature = true;\n');
    commitAll(repo, 'code commit beyond HEAD^');
    write(repo, 'docs/guide.md', '# Guide\n');
    commitAll(repo, 'docs-only tip commit');
    // Against HEAD^ (the docs-only parent) the range is docs-only...
    expect(runIgnoreScript(repo)).toBe(0);
    // ...but against the previous deployment commit it includes the code.
    expect(runIgnoreScript(repo, previous)).toBe(1);
  });
});
