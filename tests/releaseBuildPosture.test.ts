import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Release signing and build posture, asserted against the sources the record
 * cites (OpenSpec change `harden-native-evidence-and-release-posture`, task 3.7).
 *
 * The record in `docs/release/release-signing-posture.md` is a claim about
 * unproven release posture. A claim like that rots silently: an owner adds a
 * signing config, or flips a minification property, and the document keeps
 * saying "debug-signed and unminified" while the build no longer is. These
 * assertions read the same tracked sources, so the drift fails the gate.
 */
import {
  evaluateReleaseProfiles,
  E2E_TEST_PROFILE,
  NATIVE_TEST_SEAM,
} from '../scripts/release-profile-guard.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const posturePath = resolve(repositoryRoot, 'docs', 'release', 'release-signing-posture.md');

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), 'utf8'));
}

function generatedAndroidGradle(): string | null {
  const path = resolve(repositoryRoot, 'android', 'app', 'build.gradle');
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

describe('release signing posture', () => {
  it('keeps the E2E seam on the E2E test profile and nowhere else', () => {
    const easJson = readJson('eas.json');
    const appJson = readJson('app.json');
    const { errors, checkedProfiles } = evaluateReleaseProfiles(easJson, appJson);
    expect(errors).toEqual([]);
    // Every release-candidate profile is actually checked, so adding a new
    // profile to eas.json brings it under the guard.
    expect(checkedProfiles).toEqual(
      expect.arrayContaining(['preview', 'production', E2E_TEST_PROFILE]),
    );

    // ...and the seam is genuinely present on the one profile that may carry
    // it, so the guard is not passing because the feature was removed.
    const build = (easJson.build ?? {}) as Record<string, { env?: Record<string, string> }>;
    expect(build[E2E_TEST_PROFILE]?.env?.[NATIVE_TEST_SEAM]).toBe('true');
  });

  it('shares one application identity and version code between the E2E and store builds', () => {
    const appJson = readJson('app.json') as {
      expo?: {
        android?: { package?: string; versionCode?: number; allowBackup?: boolean };
        ios?: { bundleIdentifier?: string; buildNumber?: string };
      };
    };
    // No applicationIdSuffix: the E2E APK and a store build are the same app.
    const gradle = generatedAndroidGradle();
    if (gradle) expect(gradle).not.toContain('applicationIdSuffix');
    expect(appJson.expo?.android?.package).toBe('com.dale16.superhabits');
    expect(appJson.expo?.ios?.bundleIdentifier).toBe('com.dale16.superhabits');
    expect(appJson.expo?.android?.versionCode).toBe(1);
    expect(appJson.expo?.ios?.buildNumber).toBe('1');
  });

  it('the only Android release signing config is the debug keystore', () => {
    const gradle = generatedAndroidGradle();
    if (!gradle) {
      // Fresh clone: the generated tree does not exist, so the claim is checked
      // against the record, which must still state it as unproven.
      expect(existsSync(posturePath)).toBe(true);
      return;
    }
    const signingConfigs = /signingConfigs \{([\s\S]*?)\n {4}\}/.exec(gradle)?.[1] ?? '';
    expect(signingConfigs).toContain('debug');
    // The release block signs with the debug config, and there is no upload or
    // production signing config anywhere in the generated project.
    const releaseBlock = /release \{([\s\S]*?)\n {8}\}/.exec(gradle)?.[1] ?? '';
    expect(releaseBlock).toContain('signingConfig signingConfigs.debug');
    expect(gradle).not.toMatch(/signingConfigs\.upload|signingConfigs\.release/);
    // No production keystore is committed.
    for (const name of [
      'keystore.properties',
      'android/keystores',
      'android/app/upload-keystore.jks',
    ]) {
      expect(existsSync(resolve(repositoryRoot, name)), `${name} must not exist`).toBe(false);
    }
  });

  it('release builds are neither shrunk nor obfuscated by default', () => {
    const gradle = generatedAndroidGradle();
    const posture = readFileSync(posturePath, 'utf8');
    if (gradle) {
      expect(gradle).toContain(
        "findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'",
      );
      expect(gradle).toContain("findProperty('android.enableMinifyInReleaseBuilds') ?: false");
    }
    // The record must state the posture, and must not claim a store artifact.
    expect(posture).toMatch(/UNPROVEN RELEASE POSTURE/);
    expect(posture).toMatch(/debug[- ]signed|debug keystore/i);
    expect(posture).toMatch(/unminified|neither shrunk nor obfuscated/i);
    expect(posture).toMatch(/No APK\/AAB hash|not.*store-buildable/i);
    // Each recorded item carries a resume action, so the record is actionable
    // rather than a list of worries.
    expect((posture.match(/Exact resume action/gi) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
