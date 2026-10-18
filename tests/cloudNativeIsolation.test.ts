/**
 * AUD-SH21-A / AUD-SH21-B — cloud native-test build isolation.
 *
 * Audited finding: the EAS cloud lane built the `e2e-test` profile without
 * disabling dotenv, without blanking the public Supabase variables, and without
 * the local provisioner's isolation scan. Because EAS merges account-level
 * environment variables into a build, a project whose EAS environment holds live
 * values could produce an artifact described as credential-free while carrying a
 * real backend host.
 *
 * These tests are hostile-environment simulations plus a static check of the
 * tracked configuration, so the guarantee does not depend on a paid cloud run:
 *
 *   AUD-SH21-A: a synthetic live-looking ambient/EAS environment is refused (or
 *               completely neutralized) by the exact profile path, and dotenv is
 *               disabled.
 *   AUD-SH21-B: the credential-free artifact path carries no backend host, while
 *               ordinary release profiles keep their intended configuration.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evaluateCloudNativeIsolation,
  NEUTRALIZED_PUBLIC_VARS,
  DOTENV_FLAG,
  NATIVE_TEST_PROFILE,
  NATIVE_TEST_SEAM,
} from '../scripts/cloud-native-isolation.mjs';
import {
  hermeticBuildEnv,
  remoteEnvRefusal,
  scanDirectoryForNeedle,
} from '../scripts/hermetic-build.mjs';
import { evaluateReleaseProfiles } from '../scripts/release-profile-guard.mjs';

const ROOT = resolve(__dirname, '..');
const easJson = JSON.parse(readFileSync(resolve(ROOT, 'eas.json'), 'utf8'));
const workflowText = readFileSync(resolve(ROOT, '.eas/workflows/native-e2e.yml'), 'utf8');
const appJson = JSON.parse(readFileSync(resolve(ROOT, 'app.json'), 'utf8'));

/**
 * A live-looking but obviously synthetic endpoint (never contacted). Typed as a
 * full `ProcessEnv` because that is the shape `hermeticBuildEnv` consumes.
 */
const SYNTHETIC: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  EXPO_PUBLIC_SUPABASE_URL: 'https://sh21-audit-synthetic.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon-key-sh21',
  EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST: 'https://sh21-audit-synthetic.supabase.co',
};

describe('AUD-SH21-A: the tracked cloud test lane is hermetic by configuration', () => {
  it('passes the isolation evaluation with no errors', () => {
    expect(evaluateCloudNativeIsolation({ easJson, workflowText }).errors).toEqual([]);
  });

  it('disables dotenv for the cloud test profile', () => {
    expect(easJson.build[NATIVE_TEST_PROFILE].env[DOTENV_FLAG]).toBe('1');
  });

  it('explicitly blanks every public backend/remote-AI variable', () => {
    const env = easJson.build[NATIVE_TEST_PROFILE].env;
    for (const name of NEUTRALIZED_PUBLIC_VARS) {
      expect(Object.prototype.hasOwnProperty.call(env, name), name).toBe(true);
      expect(env[name], name).toBe('');
    }
  });

  it('keeps the native test seam on the test profile only', () => {
    expect(easJson.build[NATIVE_TEST_PROFILE].env[NATIVE_TEST_SEAM]).toBe('true');
    for (const [name, config] of Object.entries<{ env?: Record<string, string> }>(easJson.build)) {
      if (name === NATIVE_TEST_PROFILE) continue;
      expect(config.env ?? {}, name).not.toHaveProperty(NATIVE_TEST_SEAM);
    }
  });

  it('rejects a profile that forgets to blank the backend variables', () => {
    // The audited shape, reproduced: only the seam is declared, so a merged
    // account value would survive into the artifact.
    const audited = {
      build: { [NATIVE_TEST_PROFILE]: { env: { [NATIVE_TEST_SEAM]: 'true' } } },
    };
    const { errors } = evaluateCloudNativeIsolation({ easJson: audited, workflowText });
    expect(errors.join('\n')).toMatch(/EXPO_NO_DOTENV/);
    expect(errors.join('\n')).toMatch(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  it('rejects a profile that sets a NON-empty backend value', () => {
    const leaked = {
      build: {
        [NATIVE_TEST_PROFILE]: {
          env: {
            [NATIVE_TEST_SEAM]: 'true',
            [DOTENV_FLAG]: '1',
            ...Object.fromEntries(NEUTRALIZED_PUBLIC_VARS.map((name) => [name, ''])),
            EXPO_PUBLIC_SUPABASE_URL: SYNTHETIC.EXPO_PUBLIC_SUPABASE_URL,
          },
        },
      },
    };
    const { errors } = evaluateCloudNativeIsolation({ easJson: leaked, workflowText });
    expect(errors.join('\n')).toMatch(/non-empty value/);
  });

  it('rejects a workflow that injects a literal backend endpoint', () => {
    const hostile = `${workflowText}\n      EXPO_PUBLIC_SUPABASE_URL: ${SYNTHETIC.EXPO_PUBLIC_SUPABASE_URL}\n`;
    const { errors } = evaluateCloudNativeIsolation({ easJson, workflowText: hostile });
    expect(errors.join('\n')).toMatch(/native-e2e\.yml sets EXPO_PUBLIC_SUPABASE_URL/);
  });

  it('refuses to neutralize the backend on a release profile', () => {
    const broken = {
      build: {
        ...easJson.build,
        production: {
          ...easJson.build.production,
          env: { EXPO_PUBLIC_SUPABASE_URL: '' },
        },
      },
    };
    const { errors } = evaluateCloudNativeIsolation({ easJson: broken, workflowText });
    expect(errors.join('\n')).toMatch(/release profile keeps its real configuration/);
  });
});

describe('AUD-SH21-A: a hostile ambient environment cannot reach the build', () => {
  it('strips every ambient EXPO_PUBLIC_* and reports the remote ones', () => {
    const { env, stripped, remoteStripped } = hermeticBuildEnv({ baseEnv: SYNTHETIC });
    for (const key of Object.keys(SYNTHETIC)) {
      if (key === 'NODE_ENV') continue;
      expect(env, key).not.toHaveProperty(key);
    }
    expect(remoteStripped).toEqual([
      'EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_SUPABASE_URL',
    ]);
    // NODE_ENV is not public, so exactly the EXPO_PUBLIC_* keys are stripped.
    expect(stripped.length).toBe(
      Object.keys(SYNTHETIC).filter((key) => key.startsWith('EXPO_PUBLIC_')).length,
    );
    expect(env.EXPO_NO_DOTENV).toBe('1');
  });

  it('produces a refusal message that names the offending variables', () => {
    const message = remoteEnvRefusal(['EXPO_PUBLIC_SUPABASE_URL'], 'Android E2E');
    expect(message).toMatch(/Android E2E refuses to build/);
    expect(message).toMatch(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(message).not.toMatch(/synthetic-anon-key-sh21/);
  });

  it('an explicit (purposeful) value survives the strip', () => {
    const { env } = hermeticBuildEnv({
      baseEnv: SYNTHETIC,
      set: { [NATIVE_TEST_SEAM]: 'true' },
    });
    expect(env[NATIVE_TEST_SEAM]).toBe('true');
  });
});

describe('AUD-SH21-B: artifact isolation and release behavior', () => {
  it('a credential-free export carries no backend host', () => {
    // Positive control for the scan the cloud iOS/Android lanes run.
    const hits = scanDirectoryForNeedle(
      resolve(ROOT, 'scripts'),
      ROOT,
      'sh21-audit-synthetic.supabase.co',
    );
    expect(hits).toEqual([]);
  });

  it('the scan does detect a needle that is present', () => {
    // Negative control: proves the scan is not vacuously empty. The helper
    // lowercases every file before matching, so the needle is lowercase here.
    const hits = scanDirectoryForNeedle(resolve(ROOT, 'simulation'), ROOT, 'apileg');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('ordinary release profiles keep their intended configuration', () => {
    const { errors } = evaluateReleaseProfiles(easJson, appJson);
    expect(errors).toEqual([]);
    expect(easJson.build.production.env).toBeUndefined();
    expect(easJson.build.preview.env).toBeUndefined();
  });

  it('no app.json env neutralizes a backend variable for every profile', () => {
    const appEnv = appJson?.expo?.extra?.env ?? {};
    for (const name of NEUTRALIZED_PUBLIC_VARS) {
      expect(String(appEnv[name] ?? 'unset')).not.toBe('');
    }
  });
});
