import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Vercel Git deployment rules.
 *
 * History: `main` was held (`"main": false`) while production builds failed at
 * the web-export simulation-bridge defect, so an unprotected `main` push could
 * not release unqualified source (see `docs/reports/web-export-todo-durability-
 * acceptance-report.md`). That defect is fixed (PR previews build READY), CI
 * quality is green, and the duplicate `superhabits` Vercel project has been
 * deleted (2026-10-31), so the hold is lifted: every `main` push
 * now produces exactly one Production deployment, on the `super-habits`
 * project (super-habits.vercel.app).
 *
 * What stays enforced: bot and campaign namespaces never deploy, and no rule
 * may be `true`. Vercel: "If a branch matches multiple rules and at least one
 * rule is `true`, a deployment will occur" — so a `true` rule would silently
 * re-enable the disabled namespaces. `main` and every other branch deploy by
 * Vercel's default (unlisted = enabled); docs-only commits are skipped by the
 * `ignoreCommand` (see `vercelIgnoreBuild.test.ts`).
 *
 * LIMIT: this is a configuration-shape test. It cannot detect dashboard Git
 * toggles or non-Git release paths (`vercel --prod`, Promote to Production).
 */

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vercelConfigPath = resolve(repositoryRoot, 'vercel.json');

type VercelConfig = {
  $schema?: string;
  buildCommand?: string;
  outputDirectory?: string;
  git?: { deploymentEnabled?: boolean | Record<string, boolean> };
  rewrites?: { source: string; destination: string }[];
  headers?: { source: string; headers: { key: string; value: string }[] }[];
};

function readVercelConfig(): VercelConfig {
  return JSON.parse(readFileSync(vercelConfigPath, 'utf8')) as VercelConfig;
}

describe('Vercel Git deployment rules', () => {
  it('lets main deploy by default (no main rule, per-branch form)', () => {
    const config = readVercelConfig();
    expect(config.git).toBeDefined();
    const enabled = config.git?.deploymentEnabled;
    // The boolean `false` form would disable every branch; the per-branch form
    // is deliberate.
    expect(typeof enabled).toBe('object');
    expect(enabled).not.toBe(false);
    expect(Object.keys(enabled as Record<string, boolean>)).not.toContain('main');
  });

  it('disables Git-triggered deployments for bot and campaign branches', () => {
    // Bot-fix and campaign/frontend-v3 namespaces are never reviewed through
    // PR previews and must not consume build minutes or create deployments.
    // These rules are per-branch minimatch patterns; every one must stay
    // `false` — see the precedence note below.
    const enabled = readVercelConfig().git?.deploymentEnabled as Record<string, boolean>;
    expect(enabled['snyk-fix-*']).toBe(false);
    expect(enabled['campaign/*']).toBe(false);
    expect(enabled['frontend-v3-*']).toBe(false);
  });

  it('contains no true rule that could re-enable a disabled namespace', () => {
    const enabled = readVercelConfig().git?.deploymentEnabled;
    expect(typeof enabled).toBe('object');
    const rules = enabled as Record<string, boolean>;
    // The exact-key assertion in the last test is the load-bearing guard (any
    // added rule fails it); this states the intent: a `true` rule matching a
    // disabled namespace would re-enable it, so no rule may be `true` at all.
    const trueRules = Object.entries(rules)
      .filter(([, value]) => value === true)
      .map(([pattern]) => pattern);
    expect(trueRules).toEqual([]);
  });

  it('preserves the build, output, SPA rewrite and COOP/COEP configuration', () => {
    // These settings are load-bearing:
    // `build:web` is the guarded production export, and COOP/COEP are required
    // for SQLite WASM (`crossOriginIsolated`) on the deployed PWA.
    const config = readVercelConfig();
    expect(config.$schema).toBe('https://openapi.vercel.sh/vercel.json');
    expect(config.buildCommand).toBe('npm run build:web');
    expect(config.outputDirectory).toBe('dist');
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
    const headers = config.headers?.[0]?.headers ?? [];
    const byKey = new Map(headers.map((entry) => [entry.key, entry.value]));
    expect(byKey.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    expect(byKey.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(config.headers?.[0]?.source).toBe('/(.*)');
  });

  it('scopes deployment disabling to the declared bot/campaign branches only', () => {
    // Only the bot/campaign namespaces are disabled; `main` (production) and
    // every PR branch keep Vercel's default `true`. This exact-key assertion is
    // the primary guard: any added rule (true or false) fails here.
    const enabled = readVercelConfig().git?.deploymentEnabled as Record<string, boolean>;
    expect(Object.keys(enabled).sort()).toEqual(['campaign/*', 'frontend-v3-*', 'snyk-fix-*']);
    expect(Object.values(enabled).every((value) => value === false)).toBe(true);
  });
});
