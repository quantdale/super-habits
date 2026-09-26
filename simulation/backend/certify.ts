/**
 * Guarded launcher for the opt-in, real Supabase backup/restore integration test.
 *
 * The Supabase CLI supplies only the disposable project's publishable/anon key.
 * Neither the key nor user tokens are printed, persisted, or passed on a command
 * line. The child test owns disposable test rows and removes its test users.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertDisposableBackend } from './guard';

const execFileAsync = promisify(execFile);
const REF_PATTERN = /^[a-z0-9]{20}$/;

interface ProjectEntry {
  id?: string;
  ref?: string;
  name?: string;
}

interface ApiKeyEntry {
  name?: string;
  type?: string;
  api_key?: string;
}

function requiredFlag(argv: string[], flag: string): string {
  const position = argv.indexOf(flag);
  const value = position >= 0 ? argv[position + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`Missing ${flag}.`);
  return value;
}

async function cli(args: readonly string[]): Promise<string> {
  // All args are fixed tokens or the validated project ref. Never include keys.
  const { stdout } = await execFileAsync('supabase', [...args], {
    shell: process.platform === 'win32',
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout.trim();
}

export function parseProjectName(payload: string, ref: string): string {
  const parsed = JSON.parse(payload) as { projects?: ProjectEntry[] };
  const project = parsed.projects?.find(
    (candidate) => candidate.id === ref && candidate.ref === ref,
  );
  if (!project?.name)
    throw new Error('Disposable project identity was not found in the CLI result.');
  return project.name;
}

export function parseClientKeys(payload: string): { publicKey: string; serviceKey: string } {
  const entries = JSON.parse(payload) as ApiKeyEntry[];
  if (!Array.isArray(entries)) throw new Error('Unexpected Supabase API-key response.');
  const publicKey =
    entries.find((entry) => entry.name === 'default' && entry.type === 'publishable')?.api_key ??
    entries.find((entry) => entry.name === 'anon' && entry.type === 'legacy')?.api_key;
  const serviceKey = entries.find((entry) => entry.name === 'service_role')?.api_key;
  if (!publicKey || !serviceKey)
    throw new Error('Disposable public or cleanup key is unavailable.');
  return { publicKey, serviceKey };
}

export async function main(argv: string[]): Promise<number> {
  const edgeOnly = argv.includes('--edge-only');
  const deployEdge = argv.includes('--deploy-edge');
  if (deployEdge && !edgeOnly) throw new Error('--deploy-edge requires --edge-only.');
  const ref = requiredFlag(argv, '--project-ref');
  const productionHost = requiredFlag(argv, '--production-host');
  if (!REF_PATTERN.test(ref)) throw new Error('Invalid disposable project ref.');
  if (!productionHost.includes('supabase.co'))
    throw new Error('A production Supabase host is required.');
  const url = `https://${ref}.supabase.co`;

  // Reject the target host and ambient client credentials before any network call.
  // The real project-name marker is rechecked immediately after the read-only
  // CLI identity lookup and before the key lookup or any database write.
  assertDisposableBackend({
    targetHost: url,
    productionHosts: [productionHost],
    ambientEnv: process.env,
    disposableMarkerPrefix: 'superhabits-disposable',
    targetProjectName: 'superhabits-disposable-preflight',
  });
  const name = parseProjectName(await cli(['projects', 'list', '--output-format', 'json']), ref);
  assertDisposableBackend({
    targetHost: url,
    productionHosts: [productionHost],
    ambientEnv: process.env,
    disposableMarkerPrefix: 'superhabits-disposable',
    targetProjectName: name,
  });

  const { publicKey, serviceKey } = parseClientKeys(
    await cli(['projects', 'api-keys', '--project-ref', ref, '--output', 'json']),
  );
  if (edgeOnly) {
    const rawSecrets = await cli(['secrets', 'list', '--project-ref', ref, '--output', 'json']);
    const secrets = rawSecrets ? (JSON.parse(rawSecrets) as { name?: string }[]) : [];
    if (!Array.isArray(secrets)) throw new Error('Unexpected disposable secrets list.');
    const providerNames = new Set(['OPENAI_API_KEY', 'AI_COMMAND_MODEL', 'DEEPSEEK_API_KEY']);
    if (secrets.some((secret) => secret.name && providerNames.has(secret.name))) {
      throw new Error(
        'Disposable provider configuration is present; aborting no-spend Edge probes.',
      );
    }
    if (deployEdge) {
      // Deployment is permitted only after the same exact project/marker guard
      // as the data lane. No provider secrets exist on this target.
      await cli([
        'functions',
        'deploy',
        'parse-ai-command',
        'user-ai-ask',
        '--project-ref',
        ref,
        '--use-api',
      ]);
    }
  }
  const scrub = (value: string): string =>
    value.replaceAll(publicKey, '[PUBLIC_KEY]').replaceAll(serviceKey, '[SERVICE_KEY]');
  try {
    const vitest = await execFileAsync(
      'npx',
      [
        'vitest',
        'run',
        '--project',
        'integration',
        'tests/integration/disposableCloudRoundTrip.test.ts',
        ...(edgeOnly ? ['-t', 'edge function'] : []),
      ],
      {
        shell: process.platform === 'win32',
        timeout: 8 * 60_000,
        maxBuffer: 3 * 1024 * 1024,
        env: {
          ...process.env,
          DISPOSABLE_CERTIFY_RUN: '1',
          DISPOSABLE_CERTIFY_URL: url,
          DISPOSABLE_CERTIFY_NAME: name,
          DISPOSABLE_CERTIFY_PUBLIC_KEY: publicKey,
          DISPOSABLE_CERTIFY_SERVICE_KEY: serviceKey,
          DISPOSABLE_CERTIFY_PRODUCTION_HOST: productionHost,
          DISPOSABLE_CERTIFY_EDGE: edgeOnly ? '1' : '0',
        },
      },
    );
    process.stdout.write(scrub(vitest.stdout));
    process.stderr.write(scrub(vitest.stderr));
    return 0;
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string };
    if (result.stdout) process.stdout.write(scrub(result.stdout));
    if (result.stderr) process.stderr.write(scrub(result.stderr));
    return 1;
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      // execFile failure messages can contain environment details. Print only
      // a bounded, fixed diagnostic; Vitest itself reports test failures.
      console.error(
        error instanceof Error && error.message.includes('Command failed')
          ? 'Disposable certification child exited nonzero.'
          : `Disposable certification aborted: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      process.exit(1);
    },
  );
}
