// @ts-nocheck
/**
 * Release-profile guard (OpenSpec change
 * `harden-native-evidence-and-release-posture`, task 3.6).
 *
 * WHY: `EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST` is the native E2E test seam. It is
 * an `EXPO_PUBLIC_*` value, so Metro INLINES it into the JavaScript bundle at
 * build time — a release build carrying it ships the test seam to every user,
 * and the flag is not detectable at runtime. `eas.json` currently sets it on
 * `build.e2e-test` only, but nothing prevented a later edit from adding it to
 * `production`, `preview`, or a new release-candidate profile, and the failure
 * would be invisible until a store artifact was already built.
 *
 * The rule: ONLY the E2E test profile may set the seam. Every other build
 * profile must be free of it, in `eas.json` and in `app.json`.
 *
 * A test-only seam in a release build is also the same class of defect as
 * `AI_ASK_EXPERIMENT_ENABLED`: a flag whose default matters but whose default
 * is only asserted in source.
 *
 * Exported for the unit test; the CLI is the production entry point.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The one profile allowed to carry the native E2E seam. */
export const E2E_TEST_PROFILE = 'e2e-test';

/** The test-only native seam that must never reach a release build. */
export const NATIVE_TEST_SEAM = 'EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST';

/**
 * Profiles that produce an artifact a human installs outside CI. `development`
 * is excluded because it is a development client, not a release candidate, and
 * because Metro's dev server is where the seam is exercised interactively.
 *
 * @param {Record<string, unknown>} easJson
 * @returns {string[]}
 */
export function releaseCandidateProfiles(easJson) {
  return Object.keys(easJson?.build ?? {}).filter((name) => name !== 'development');
}

/**
 * Find profiles that set the native test seam.
 *
 * @param {Record<string, unknown>} easJson
 * @returns {{ profile: string, value: unknown }[]}
 */
export function profilesCarryingSeam(easJson) {
  const offenders = [];
  for (const [profile, config] of Object.entries(easJson?.build ?? {})) {
    const env = /** @type {Record<string, unknown> | undefined} */ (config?.env);
    if (env && Object.prototype.hasOwnProperty.call(env, NATIVE_TEST_SEAM)) {
      offenders.push({ profile, value: env[NATIVE_TEST_SEAM] });
    }
  }
  return offenders;
}

/**
 * Evaluate the whole release-profile posture.
 *
 * @param {Record<string, unknown>} easJson
 * @param {Record<string, unknown>} appJson
 * @returns {{ errors: string[], offenders: { profile: string, value: unknown }[], checkedProfiles: string[] }}
 */
export function evaluateReleaseProfiles(easJson, appJson) {
  const errors = [];
  const offenders = profilesCarryingSeam(easJson);

  for (const { profile, value } of offenders) {
    if (profile === E2E_TEST_PROFILE) continue;
    errors.push(
      `eas.json build profile '${profile}' sets ${NATIVE_TEST_SEAM}=${JSON.stringify(value)}. ` +
        `Only '${E2E_TEST_PROFILE}' may carry the native test seam: it is inlined into the ` +
        `JavaScript bundle, so a release build would ship the seam to every user.`,
    );
  }

  // app.json has no profile concept, so a seam there is unconditionally wrong:
  // it would apply to every build profile, including production.
  const appEnv = appJson?.expo?.extra?.eas?.env;
  if (appEnv && Object.prototype.hasOwnProperty.call(appEnv, NATIVE_TEST_SEAM)) {
    errors.push(
      `app.json expo.extra.eas.env sets ${NATIVE_TEST_SEAM}. That applies to EVERY build profile, ` +
        `including production; remove it and keep the seam on the '${E2E_TEST_PROFILE}' profile in eas.json.`,
    );
  }
  const appExtraEnv = appJson?.expo?.extra?.env;
  if (appExtraEnv && Object.prototype.hasOwnProperty.call(appExtraEnv, NATIVE_TEST_SEAM)) {
    errors.push(
      `app.json expo.extra.env sets ${NATIVE_TEST_SEAM}, which Metro inlines into every build ` +
        `including production. The seam belongs only on the '${E2E_TEST_PROFILE}' eas.json profile.`,
    );
  }

  return { errors, offenders, checkedProfiles: releaseCandidateProfiles(easJson) };
}

// --- CLI ----------------------------------------------------------------
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const easJson = JSON.parse(readFileSync(resolve(ROOT, 'eas.json'), 'utf8'));
  const appJson = JSON.parse(readFileSync(resolve(ROOT, 'app.json'), 'utf8'));
  const { errors, offenders, checkedProfiles } = evaluateReleaseProfiles(easJson, appJson);
  if (errors.length > 0) {
    console.error(`release-profile-guard: FAILED — ${errors.length} problem(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(
    `release-profile-guard: OK — ${checkedProfiles.length} release-candidate profile(s) ` +
      `(${checkedProfiles.join(', ')}) carry no ${NATIVE_TEST_SEAM}; only '${E2E_TEST_PROFILE}' may, ` +
      `and ${offenders.length} profile(s) do.`,
  );
}
