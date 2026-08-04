/**
 * Hard production-isolation guard for the disposable-backend lane (design D8,
 * task 8.3).
 *
 * The disposable lane may only ever target a Supabase project that, all at
 * once, (a) is not the production host, (b) runs in a shell with NO ambient
 * production client credentials, and (c) carries the disposable project marker
 * (a project name prefixed with the disposable marker string, e.g.
 * `superhabits-disposable-<run>`). This module is deliberately PURE: it reads
 * nothing from `process.env` and performs no I/O, so every rule can be
 * exercised from Vitest with no network, filesystem, or Supabase dependency.
 *
 * The caller (provision.ts / build-dist-live.sh) resolves the three inputs
 * from the CLI environment and hands them to `checkDisposableBackend` /
 * `assertDisposableBackend`; the guard decides. The guard MUST run before any
 * build or network call touches the target project.
 */

/** The three rules that can fire, in evaluation order. */
export type GuardRule = 'production-host' | 'production-credentials' | 'disposable-marker';

/**
 * Environment variables that, when present and non-empty in the ambient shell,
 * prove a production client is configured. The disposable lane refuses to run
 * in such a shell: the app compiles `EXPO_PUBLIC_SUPABASE_*` into the client
 * at build time, so a single ambient credential can leak into the `dist-live/`
 * export.
 */
export const DEFAULT_CREDENTIAL_ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
] as const;

export interface DisposableBackendGuardInput {
  /** The host (or full URL) the lane would build against, e.g. `https://abcdefghij.supabase.co`. */
  targetHost: string;
  /** Hosts that must never be targeted by any lane. Left empty, the rule is vacuous. */
  productionHosts: readonly string[];
  /** The ambient environment. The guard scans it for production client credentials. */
  ambientEnv: Record<string, string | undefined>;
  /** Prefix that identifies a disposable project name (e.g. `superhabits-disposable`). */
  disposableMarkerPrefix: string;
  /** Name of the project this lane targets (used for the disposable-marker rule). */
  targetProjectName: string | null;
  /** Extra env var names to treat as production client credentials. */
  credentialEnvKeys?: readonly string[];
}

export interface GuardResult {
  ok: boolean;
  /** Rules that fired, in evaluation order. Empty when `ok` is true. */
  rules: GuardRule[];
  /** Human-readable message; names the fired rule(s) on abort. */
  message: string;
}

/**
 * Normalize a host/URL to a comparable form: lower-case, scheme stripped,
 * default ports (80/443) dropped, trailing slash and dot removed, path/query
 * discarded. Returns the authority (`host[:port]`).
 */
export function normalizeHost(hostOrUrl: string): string {
  const trimmed = hostOrUrl.trim().toLowerCase();
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const authority = withoutScheme.split('/')[0].replace(/\/+$/, '');
  const withoutDefaultPort = authority.replace(/:(443|80)$/, '');
  return withoutDefaultPort.replace(/\.$/, '');
}

function isNonEmptyEnv(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Evaluate all three hard-isolation rules. PURE — no I/O, no process.env.
 *
 * Rules (in order):
 *   (a) `production-host`      — target host matches a production host.
 *   (b) `production-credentials` — an ambient production client credential is present.
 *   (c) `disposable-marker`    — the target project does not carry the disposable marker.
 */
export function checkDisposableBackend(input: DisposableBackendGuardInput): GuardResult {
  const rules: GuardRule[] = [];
  const details: string[] = [];

  const push = (rule: GuardRule, detail: string): void => {
    rules.push(rule);
    details.push(`${rule}: ${detail}`);
  };

  // (a) production-host
  const prodMatch = input.productionHosts.find((host) => {
    const hostNorm = normalizeHost(host);
    return hostNorm !== '' && hostNorm === normalizeHost(input.targetHost);
  });
  if (prodMatch) {
    push(
      'production-host',
      `target host '${input.targetHost}' matches a production host ('${prodMatch}')`,
    );
  }

  // (b) production-credentials
  const credentialKeys = input.credentialEnvKeys ?? DEFAULT_CREDENTIAL_ENV_KEYS;
  const presentCreds = credentialKeys.filter((key) => isNonEmptyEnv(input.ambientEnv[key]));
  if (presentCreds.length > 0) {
    push(
      'production-credentials',
      `ambient production client credentials present in the shell: ${presentCreds.join(', ')}`,
    );
  }

  // (c) disposable-marker
  const prefix = input.disposableMarkerPrefix;
  const projectName = input.targetProjectName;
  if (!prefix || !projectName || !projectName.includes(prefix)) {
    push(
      'disposable-marker',
      `project '${projectName ?? '(none)'}' lacks the disposable marker prefix '${prefix}'`,
    );
  }

  const ok = rules.length === 0;
  const message = ok
    ? 'disposable-backend guard passed'
    : `Disposable-backend guard ABORT (${rules.join(', ')}): ${details.join('; ')}`;

  return { ok, rules, message };
}

/** Convenience: true when the guard passes. PURE. */
export function isDisposableBackendAllowed(input: DisposableBackendGuardInput): boolean {
  return checkDisposableBackend(input).ok;
}

/**
 * Throw when the guard fails. The thrown Error's message names the rule(s)
 * fired, so callers and CI logs can attribute the abort precisely.
 */
export function assertDisposableBackend(input: DisposableBackendGuardInput): void {
  const result = checkDisposableBackend(input);
  if (!result.ok) {
    throw new Error(result.message);
  }
}

/** Human-readable names for the rules, for logs and diagnostics. */
export const GUARD_RULE_LABELS: Record<GuardRule, string> = {
  'production-host': 'production host',
  'production-credentials': 'production credentials',
  'disposable-marker': 'disposable marker',
};
