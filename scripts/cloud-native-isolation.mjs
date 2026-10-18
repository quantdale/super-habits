// @ts-nocheck
/**
 * Cloud native-test build isolation (`AUD-SH21-A` / `AUD-SH21-B`).
 *
 * ## The audited finding
 *
 * `.eas/workflows/native-e2e.yml` builds both platforms with the `e2e-test`
 * profile. That profile enables the habit-reminder test seam but does NOT
 * disable dotenv, does not blank the public Supabase variables, and does not
 * run the local provisioner's isolation scan. EAS merges account-level
 * environment variables into a build, so a project whose EAS environment holds
 * live `EXPO_PUBLIC_SUPABASE_*` values can produce an APK/IPA described as
 * credential-free while it carries a real backend host. The local Android
 * provisioner and the GitHub iOS workflow already avoid this; the CLOUD path
 * was the gap.
 *
 * ## The rule this module enforces
 *
 * The cloud e2e-test lane must be hermetic BY CONFIGURATION, not by trusting
 * account defaults:
 *   - every EAS build profile may declare exactly the env it needs, and
 *     `e2e-test` must (a) enable the native seam, (b) set `EXPO_NO_DOTENV`,
 *     and (c) explicitly BLANK the public backend/remote-AI variables so a
 *     merged account value cannot survive;
 *   - the workflow must not inject any Supabase/remote-AI value of its own;
 *   - `production`/`preview` must not inherit the blanking or the seam.
 *
 * This is a static, falsifiable check on tracked configuration, so it runs in
 * the ordinary quality gate without triggering a paid cloud build. Real
 * cloud/device qualification stays a separate, explicitly-authorized step
 * (see the campaign report's external gates).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Variables a hermetic native test build must neutralize if EAS could inject them. */
export const NEUTRALIZED_PUBLIC_VARS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST',
  'EXPO_PUBLIC_AI_COMMAND_PROXY_URL',
  'EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME',
];

/** The one profile allowed to carry the native test seam. */
export const NATIVE_TEST_PROFILE = 'e2e-test';

/** The native test seam. */
export const NATIVE_TEST_SEAM = 'EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST';

/** Flag that blocks `.env`/`.env.local` loading at build time. */
export const DOTENV_FLAG = 'EXPO_NO_DOTENV';

/** Substrings that identify a live-looking backend variable in workflow env. */
export const REMOTE_MARKERS = ['SUPABASE', 'AI_COMMAND'];

/**
 * Evaluate the cloud native-test build posture.
 *
 * @param {object} input
 * @param {Record<string, any>} input.easJson parsed eas.json
 * @param {string} input.workflowText raw `.eas/workflows/native-e2e.yml`
 * @returns {{ errors: string[] }}
 */
export function evaluateCloudNativeIsolation({ easJson, workflowText }) {
  const errors = [];
  const profile = easJson?.build?.[NATIVE_TEST_PROFILE];
  if (!profile) {
    errors.push(
      `.eas/workflows/native-e2e.yml builds with the '${NATIVE_TEST_PROFILE}' profile, but eas.json defines no such profile.`,
    );
    return { errors };
  }
  const env = profile.env ?? {};

  if (env[NATIVE_TEST_SEAM] !== 'true') {
    errors.push(
      `eas.json '${NATIVE_TEST_PROFILE}' must set ${NATIVE_TEST_SEAM}="true"; the native flows depend on it.`,
    );
  }
  if (String(env[DOTENV_FLAG] ?? '') !== '1') {
    errors.push(
      `eas.json '${NATIVE_TEST_PROFILE}' must set ${DOTENV_FLAG}="1" so a build machine's .env/.env.local can never inline a live backend.`,
    );
  }
  for (const name of NEUTRALIZED_PUBLIC_VARS) {
    if (!Object.prototype.hasOwnProperty.call(env, name)) {
      errors.push(
        `eas.json '${NATIVE_TEST_PROFILE}' must explicitly blank ${name} ("" ). EAS merges account-level environment variables into a build, so an unset key does not mean "no value" — only an explicit empty value does.`,
      );
      continue;
    }
    if (String(env[name] ?? '') !== '') {
      errors.push(
        `eas.json '${NATIVE_TEST_PROFILE}' sets ${name} to a non-empty value. The cloud native test lane must build credential-free.`,
      );
    }
  }

  // Release profiles must not inherit the seam or a blanked backend.
  for (const [name, config] of Object.entries(easJson?.build ?? {})) {
    if (name === NATIVE_TEST_PROFILE) continue;
    const otherEnv = config?.env ?? {};
    if (Object.prototype.hasOwnProperty.call(otherEnv, NATIVE_TEST_SEAM)) {
      errors.push(`eas.json '${name}' must not set ${NATIVE_TEST_SEAM}; only '${NATIVE_TEST_PROFILE}' may.`);
    }
    if (Object.prototype.hasOwnProperty.call(otherEnv, DOTENV_FLAG)) {
      errors.push(
        `eas.json '${name}' must not set ${DOTENV_FLAG}; a release profile keeps its intended dotenv behavior.`,
      );
    }
    for (const key of NEUTRALIZED_PUBLIC_VARS) {
      if (Object.prototype.hasOwnProperty.call(otherEnv, key) && String(otherEnv[key] ?? '') === '') {
        errors.push(
          `eas.json '${name}' blanks ${key}. Neutralizing backend vars belongs to the hermetic test profile only; a release profile keeps its real configuration.`,
        );
      }
    }
  }

  // The workflow itself must not inject a remote value.
  const workflowLines = workflowText.split(/\r?\n/);
  for (const line of workflowLines) {
    const match = /^\s*([A-Z0-9_]+)\s*:\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!REMOTE_MARKERS.some((marker) => key.includes(marker))) continue;
    if (key === DOTENV_FLAG) continue;
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    if (value !== '' && !value.startsWith('${{')) {
      errors.push(
        `.eas/workflows/native-e2e.yml sets ${key} to a literal value. The cloud test lane must not carry a backend endpoint; neutralize it in the '${NATIVE_TEST_PROFILE}' profile instead.`,
      );
    }
  }

  return { errors };
}

// --- CLI ----------------------------------------------------------------
const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  const easJson = JSON.parse(readFileSync(resolve(ROOT, 'eas.json'), 'utf8'));
  const workflowText = readFileSync(resolve(ROOT, '.eas/workflows/native-e2e.yml'), 'utf8');
  const { errors } = evaluateCloudNativeIsolation({ easJson, workflowText });
  if (errors.length > 0) {
    console.error(`cloud-native-isolation: FAILED — ${errors.length} problem(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(
    `cloud-native-isolation: OK — '${NATIVE_TEST_PROFILE}' blanks ${NEUTRALIZED_PUBLIC_VARS.length} public backend variable(s), disables dotenv, and the workflow injects none.`,
  );
}
