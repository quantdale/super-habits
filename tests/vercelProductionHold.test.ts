import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Production-release hold (Vercel Git deployment control).
 *
 * Two Vercel projects (`super-habits`, `superhabits`) are connected to this
 * repository and both track `main` as their Production branch. Historically
 * every `main` push created a Production-target deployment, which failed at the
 * web-export simulation-bridge defect; once that defect was fixed, an
 * unprotected `main` push would have built and released unqualified source.
 *
 * `git.deploymentEnabled` is Vercel's documented, repository-controlled control
 * for this. Its behavior for the *introducing* commit is not documented, so it
 * was established empirically before being relied on, using a throwaway branch
 * keyed to itself:
 *
 *   - commit that excludes its own branch (`branch: false`): 0 Vercel commit
 *     statuses at all on the pushed SHA (no deployment record created), for 90s+
 *     after the push;
 *   - a follow-up commit on the same branch with that exclusion reverted out:
 *     Vercel statuses present and 1 Preview deployment on BOTH projects.
 *
 * That control argues against "unrelated webhook failure" and shows the rule is
 * evaluated at webhook ingestion, including for the commit that introduces it.
 *
 * SCOPE OF THAT EVIDENCE — do not overclaim it: the probe arms were both
 * PREVIEW branch events, so on their own they do not demonstrate the
 * production-branch path. The production case was proven separately, by
 * observation instead of experiment: every pre-hold `main` push produced TWO
 * Production deployments (one per project), while the `main` push that carried
 * this hold produced ZERO Production deployments and left both Production
 * environments serving `e6cf0d34`. See `docs/reports/web-export-todo-durability-
 * acceptance-report.md` for the recorded figures.
 *
 * These assertions exist because the whole hold is one small JSON object. A
 * well-meaning refactor that drops `git`, renames the key, or adds a wildcard
 * `true` rule would silently re-open production auto-release, and nothing else
 * in the suite would notice. Note the precedence rule from Vercel's docs:
 * "If a branch matches multiple rules and at least one rule is `true`, a
 * deployment will occur" — so an added `true` rule is a hold bypass, not a
 * harmless extra.
 *
 * IMPORTANT LIMIT: this is a configuration-shape test. It cannot detect Vercel
 * ignoring the setting (a dashboard Root Directory, a dashboard Git toggle, or
 * a production-branch behavior change all pass it). It also does not cover
 * non-Git release paths: `vercel --prod`, dashboard "Promote to Production" of
 * an existing Preview, and "Create Deployment" are outside this mechanism and
 * remain open by design under Policy B.
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

describe('Vercel production-release hold', () => {
  it('disables Git-triggered deployments for main', () => {
    const config = readVercelConfig();
    expect(config.git).toBeDefined();
    const enabled = config.git?.deploymentEnabled;
    // The boolean `false` form would also disable previews for every branch,
    // which the project does not want; the per-branch form is deliberate.
    expect(typeof enabled).toBe('object');
    expect(enabled).not.toBe(true);
    expect((enabled as Record<string, boolean>)['main']).toBe(false);
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

  it('contains no rule that can re-enable main deployments', () => {
    const enabled = readVercelConfig().git?.deploymentEnabled;
    expect(typeof enabled).toBe('object');
    const rules = enabled as Record<string, boolean>;
    // Two layers, because a hand-rolled minimatch is easy to get wrong:
    //
    // 1. The PRIMARY guard is the exact-key assertion in the last test
    //    (`Object.keys(...)` equals the declared four-key set). Any rule
    //    outside that set, `true` or `false`, fails it — so no pattern can be
    //    smuggled in at all.
    // 2. The scans below are readable, targeted statements of intent for the
    //    common bypass shapes. They are deliberately NOT a general minimatch
    //    implementation (they would miss `mai*`, `**`, `[m]ain`, `{main}`),
    //    which is exactly why the exact-key assertion is the load-bearing one.
    //
    // Vercel: "If a branch matches multiple rules and at least one rule is
    // `true`, a deployment will occur." A `true` rule matching `main` therefore
    // re-opens auto-release and defeats the hold — and a `true` rule is a hold
    // bypass for ANY branch it matches, so no rule may be `true` at all.
    const trueRules = Object.entries(rules)
      .filter(([, value]) => value === true)
      .map(([pattern]) => pattern);
    expect(trueRules).toEqual([]);
    const matchesMain = (pattern: string): boolean =>
      ['main', '*', 'm*', '*ain', 'ma*'].includes(pattern);
    const bypasses = Object.entries(rules)
      .filter(([, value]) => value === true)
      .map(([pattern]) => pattern)
      .filter(matchesMain);
    expect(bypasses).toEqual([]);
  });

  it('preserves the build, output, SPA rewrite and COOP/COEP configuration', () => {
    // The hold is an additive change. These settings are load-bearing:
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

  it('scopes deployment disabling to main plus the declared bot/campaign branches', () => {
    // The hold must not blanket-disable previews: PR previews are how a change
    // gets reviewed and verified before integration. Only `main` (the
    // production hold) and the bot/campaign namespaces (`snyk-fix-*`,
    // `campaign/*`, `frontend-v3-*`) are disabled; every other branch keeps
    // its default `true`.
    //
    // This exact-key assertion is ALSO the primary bypass guard for the rule
    // scan above: any rule beyond these four (true or false, any pattern)
    // fails here, so a pattern that the scan's limited matcher would miss
    // cannot be introduced without a deliberate edit to this test.
    const enabled = readVercelConfig().git?.deploymentEnabled as Record<string, boolean>;
    expect(Object.keys(enabled).sort()).toEqual([
      'campaign/*',
      'frontend-v3-*',
      'main',
      'snyk-fix-*',
    ]);
    expect(Object.values(enabled).every((value) => value === false)).toBe(true);
    expect(enabled['main']).toBe(false);
  });
});
