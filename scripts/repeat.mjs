/**
 * Pure repetition helpers for `scripts/qa-repeat.mjs` (Certification
 * Infrastructure V2, Waves 5/6).
 *
 * One checked-in, finite, strictly sequential repetition runner for the
 * repo's deterministic lanes. Fixed named suites only (no generic command
 * passthrough); OPFS holds one lock per origin and native targets are
 * exclusive, so attempts never parallelize. Every attempt runs to
 * completion (no early abort); timeouts are generous backstops, never
 * fixes. Per-attempt evidence stays in lane-native artifacts (Playwright
 * reports, Maestro debug dirs, mock logs); records carry the Wave 6
 * provenance contract (suite, repo SHA, attempt, lane/tag, seed where
 * applicable, start/end, result, timings, artifact hints, replay).
 */

export const MAX_REPEAT_TIMES = 10;

export const REPEAT_SUITES = {
  unit: {
    description: 'Vitest unit project',
    kind: 'npm',
    args: ['run', 'test:unit'],
    timeoutMin: 10,
    needsDist: false,
    artifactHint: 'vitest unit reporter output (this console)',
  },
  integration: {
    description: 'Vitest integration project (real SQLite)',
    kind: 'npm',
    args: ['run', 'test:integration'],
    timeoutMin: 20,
    needsDist: false,
    artifactHint: 'vitest integration reporter output (this console)',
  },
  p0: {
    description: 'P0 journeys against a fresh web export',
    kind: 'npm',
    args: ['run', 'e2e:journeys:p0'],
    timeoutMin: 15,
    needsDist: true,
    artifactHint: '.cursor/playwright-output/e2e-report/',
  },
  sim: {
    description: 'Deterministic simulation gate (qa:simulation)',
    kind: 'npm',
    args: ['run', 'qa:simulation'],
    timeoutMin: 30,
    needsDist: true,
    artifactHint: 'simulation-output/ run reports + digests',
  },
  'native-smoke': {
    description: 'Native smoke lane on one owned-selected AVD',
    kind: 'node',
    script: 'scripts/qa-native.mjs',
    scriptArgs: ['--platform', 'android', '--tag', 'smoke'],
    timeoutMin: 30,
    needsDist: false,
    needsAvd: true,
    artifactHint: 'simulation-output/native/ labeled reports + debug dirs',
  },
  'native-auth': {
    description: 'Native auth lane with owned auth-mock lifecycle',
    kind: 'node',
    script: 'scripts/qa-native.mjs',
    scriptArgs: ['--platform', 'android', '--tag', 'auth-persistence', '--auth-mock'],
    timeoutMin: 30,
    needsDist: false,
    needsAvd: true,
    artifactHint: 'simulation-output/native/ labeled reports + mock logs',
  },
  'native-lifecycle': {
    description: 'Native lifecycle lane on one owned-selected AVD',
    kind: 'node',
    script: 'scripts/qa-native.mjs',
    scriptArgs: ['--platform', 'android', '--tag', 'lifecycle'],
    timeoutMin: 30,
    needsDist: false,
    needsAvd: true,
    artifactHint: 'simulation-output/native/ labeled reports + debug dirs',
  },
};

/**
 * @param {string[]} argv e.g. ['--suite','p0','--times','5','--avd','Nitro_API_36']
 * @returns {{ suite: string, times: number, timeoutMin: number|null, avd: string|null, skipBuild: boolean }}
 * @throws {Error} with the exact reason on invalid input.
 */
export function parseRepeatArgs(argv) {
  const args = { suite: null, times: 1, timeoutMin: null, avd: null, skipBuild: false };
  const list = argv ?? [];
  for (let i = 0; i < list.length; i += 1) {
    const arg = list[i];
    if (arg === '--suite') args.suite = list[++i] ?? null;
    else if (arg === '--times') args.times = Number(list[++i]);
    else if (arg === '--timeout-minutes') args.timeoutMin = Number(list[++i]);
    else if (arg === '--avd') args.avd = list[++i] ?? null;
    else if (arg === '--skip-build') args.skipBuild = true;
    else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument '${arg}'. Use --help for usage.`);
    }
  }
  if (args.help) return args;
  if (!args.suite || !REPEAT_SUITES[args.suite]) {
    throw new Error(
      `Unknown suite '${args.suite ?? ''}'. Available: ${Object.keys(REPEAT_SUITES).join(', ')}.`,
    );
  }
  if (!Number.isInteger(args.times) || args.times < 1 || args.times > MAX_REPEAT_TIMES) {
    throw new Error(`Invalid --times '${args.times}'. Pass an integer 1..${MAX_REPEAT_TIMES}.`);
  }
  if (args.timeoutMin !== null && (!Number.isFinite(args.timeoutMin) || args.timeoutMin <= 0)) {
    throw new Error(`Invalid --timeout-minutes '${args.timeoutMin}'. Pass positive minutes.`);
  }
  const needsAvd = Boolean(REPEAT_SUITES[args.suite].needsAvd);
  if (needsAvd && !args.avd) {
    throw new Error(`Suite '${args.suite}' requires an explicit --avd target.`);
  }
  if (!needsAvd && args.avd) {
    throw new Error(`Suite '${args.suite}' takes no --avd target.`);
  }
  return args;
}

/**
 * Resolve a suite to an executable command (logical form; the CLI maps
 * `npm`/`node` kinds to platform-safe spawning).
 *
 * @param {string} suite
 * @param {{ avd?: string|null, timeoutMin?: number|null, scriptPath?: string }} [options]
 */
export function resolveSuiteCommand(suite, options = {}) {
  const definition = REPEAT_SUITES[suite];
  if (!definition) throw new Error(`Unknown suite '${suite}'.`);
  const timeoutMin = options.timeoutMin ?? definition.timeoutMin;
  if (definition.kind === 'npm') {
    return {
      kind: 'npm',
      args: [...definition.args],
      timeoutMin,
      needsDist: definition.needsDist,
      description: definition.description,
      artifactHint: definition.artifactHint,
    };
  }
  const scriptArgs = [...definition.scriptArgs];
  if (definition.needsAvd) scriptArgs.push('--avd', options.avd);
  return {
    kind: 'node',
    args: [options.scriptPath ?? 'scripts/qa-native.mjs', ...scriptArgs],
    timeoutMin,
    needsDist: definition.needsDist,
    description: definition.description,
    artifactHint: definition.artifactHint,
  };
}

/**
 * One attempt record (Wave 6 provenance contract for repeated lanes).
 */
export function buildRepeatRecord(fields = {}) {
  const {
    suite = null,
    attempt = 1,
    repoSha = null,
    startedAt = null,
    endedAt = null,
    exitCode = null,
    timedOut = false,
    artifactHint = null,
    replayCommand = null,
  } = fields;
  let durationMs = null;
  if (startedAt && endedAt) {
    const duration = Date.parse(endedAt) - Date.parse(startedAt);
    durationMs = Number.isFinite(duration) && duration >= 0 ? duration : null;
  }
  return {
    schemaVersion: 1,
    suite,
    attempt,
    repoSha,
    startedAt,
    endedAt,
    durationMs,
    status: timedOut ? 'TIMEOUT' : exitCode === 0 ? 'PASS' : 'FAILED_NEEDS_TRIAGE',
    classification: null,
    seed: null,
    exitCode,
    timedOut,
    artifactHint,
    replayCommand,
  };
}

/**
 * Collate attempt records. Every attempt counts (no early abort, no
 * retry-as-fix); a repeated battery passes only when all pass.
 */
export function summarizeRepeats(records) {
  const list = records ?? [];
  const pass = list.filter((record) => record.status === 'PASS').length;
  const failed = list.filter((record) => record.status === 'FAILED_NEEDS_TRIAGE').length;
  const timeout = list.filter((record) => record.status === 'TIMEOUT').length;
  return {
    total: list.length,
    pass,
    failed,
    timeout,
    status: list.length === 0 ? 'EMPTY' : failed + timeout > 0 ? 'FAIL' : 'PASS',
  };
}

export function repeatUsage() {
  return [
    'Usage: node scripts/qa-repeat.mjs --suite NAME [--times N] [--timeout-minutes M] [--avd NAME] [--skip-build]',
    `Suites: ${Object.keys(REPEAT_SUITES).join(', ')} (max --times ${MAX_REPEAT_TIMES}; native suites require --avd).`,
    'Web suites build a fresh dist/ once up front unless --skip-build.',
    'Strictly sequential; one invocation at a time (OPFS + device exclusivity).',
  ].join('\n');
}
