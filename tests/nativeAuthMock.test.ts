import { describe, expect, it } from 'vitest';
import {
  addCleartextAttr,
  assertMockProof,
  interpretDeviceProbe,
  isPidAlive,
  mockSliceTouched,
  parseMockLog,
  reverseSpecPresent,
} from '../scripts/native-avd.mjs';

const GREEN_LOG = `[mock] native auth mock listening on :4545 (user 00000000-0000-0000-0000-00000000ca1a)
[mock] signup count=1 user=00000000-0000-0000-0000-00000000ca1a
[mock] user-check authed=1 user=00000000-0000-0000-0000-00000000ca1a
[mock] user-check authed=2 user=00000000-0000-0000-0000-00000000ca1a
[mock] put user email-change requested for canary@example.test user=00000000-0000-0000-0000-00000000ca1a count=1
[mock] otp requested email=canary@example.test shouldCreateUser=false count=1
[mock] email-change requested for canary@example.test user=00000000-0000-0000-0000-00000000ca1a
[mock] verify email_change -> permanent user=00000000-0000-0000-0000-00000000ca1a
[mock] token refresh ok count=1 user=00000000-0000-0000-0000-00000000ca1a
`;

describe('native auth-mock proof helpers', () => {
  it('parses mock request counters and the observed user ids', () => {
    expect(parseMockLog(GREEN_LOG)).toEqual({
      signupCount: 1,
      unauthenticatedChecks: 0,
      userIds: ['00000000-0000-0000-0000-00000000ca1a'],
      verifyPermanentIds: ['00000000-0000-0000-0000-00000000ca1a'],
      otpRequests: 1,
      refreshes: 1,
      logouts: 0,
      putUserRequests: 1,
      restProbes: 0,
    });
  });

  it('accepts the green per-run proof', () => {
    expect(assertMockProof(parseMockLog(GREEN_LOG))).toEqual({ ok: true, reasons: [] });
  });

  it('rejects a second signup, unauthenticated checks, and id drift', () => {
    const doubleSignup = `${GREEN_LOG}[mock] signup count=2 user=11111111-0000-0000-0000-00000000ca1a\n`;
    const signupProof = assertMockProof(parseMockLog(doubleSignup));
    expect(signupProof.ok).toBe(false);
    expect(signupProof.reasons.join(';')).toMatch(/exactly 1 anonymous signup/);

    const unauth = assertMockProof(
      parseMockLog(`${GREEN_LOG}[mock] user-check UNAUTHENTICATED (3)\n`),
    );
    expect(unauth.ok).toBe(false);
    expect(unauth.reasons.join(';')).toMatch(/0 unauthenticated/);

    const drifted = assertMockProof(
      parseMockLog(
        '[mock] signup count=1 user=aaa\n[mock] verify email_change -> permanent user=bbb\n',
      ),
    );
    expect(drifted.ok).toBe(false);
    expect(drifted.reasons.join(';')).toMatch(/single user id|changed the user id/);
  });

  it('rejects a lane slice with no protect request', () => {
    const proof = assertMockProof(
      parseMockLog('[mock] signup count=1 user=aaa\n[mock] user-check authed=1 user=aaa\n'),
    );
    expect(proof.ok).toBe(false);
    expect(proof.reasons.join(';')).toMatch(/PUT \/auth\/v1\/user/);
  });

  it('counts signup events per slice, not the cumulative counter', () => {
    const parsed = parseMockLog('[mock] signup count=2 user=aaa\n[mock] signup count=3 user=aaa\n');
    expect(parsed.signupCount).toBe(2);
    expect(parsed.restProbes).toBe(0);
    const withProbes = parseMockLog('[mock] rest probe GET /rest/v1/todos -> empty\n');
    expect(withProbes.restProbes).toBe(1);
  });

  it('rejects a lane slice with no protection verify', () => {
    const proof = assertMockProof(
      parseMockLog('[mock] signup count=1 user=aaa\n[mock] user-check authed=1 user=aaa\n'),
    );
    expect(proof.ok).toBe(false);
    expect(proof.reasons.join(';')).toMatch(/email_change verify/);
  });

  it('detects an exact adb reverse forward spec', () => {
    const listing = 'emulator-5554 tcp:4545 tcp:4545\n';
    expect(reverseSpecPresent(listing, 4545)).toBe(true);
    expect(reverseSpecPresent(listing, 4546)).toBe(false);
    expect(reverseSpecPresent('emulator-5554 tcp:4545 tcp:9999\n', 4545)).toBe(false);
    expect(reverseSpecPresent('', 4545)).toBe(false);
  });

  it('probes process liveness without signaling anyone', () => {
    expect(isPidAlive(process.pid)).toBe(true);
    expect(isPidAlive(2147483647)).toBe(false);
    expect(isPidAlive(0)).toBe(false);
    expect(isPidAlive('not-a-pid')).toBe(false);
  });

  it('interprets the device-side connectivity probe', () => {
    expect(interpretDeviceProbe({ status: 0, stdout: 'PROBE_OPEN\n', stderr: '' })).toEqual({
      ok: true,
      skipped: false,
      reason: null,
    });
    const refused = interpretDeviceProbe({ status: 0, stdout: 'PROBE_CLOSED\n', stderr: '' });
    expect(refused).toEqual({
      ok: false,
      skipped: false,
      reason: 'device TCP connection to the mock was refused',
    });
    const missing = interpretDeviceProbe({
      status: 1,
      stdout: '',
      stderr: "/system/bin/sh: can't create /dev/tcp/127.0.0.1/4545: No such file or directory",
    });
    expect(missing.skipped).toBe(true);
    const odd = interpretDeviceProbe({ status: 1, stdout: '', stderr: 'boom' });
    expect(odd.ok).toBe(false);
    expect(odd.skipped).toBe(false);
  });

  it('detects whether a mock-log slice saw any traffic', () => {
    expect(mockSliceTouched(null)).toBe(false);
    expect(mockSliceTouched(parseMockLog(''))).toBe(false);
    expect(mockSliceTouched(parseMockLog(GREEN_LOG))).toBe(true);
    expect(mockSliceTouched(parseMockLog('[mock] rest probe GET /rest/v1/todos -> empty\n'))).toBe(
      true,
    );
  });

  it('patches the application tag for test-only cleartext exactly once', () => {
    const manifest =
      '<manifest><application android:name=".MainApplication" android:label="app"></application></manifest>';
    const patched = addCleartextAttr(manifest);
    expect(patched).toContain('<application android:usesCleartextTraffic="true"');
    expect(addCleartextAttr(patched)).toBe(patched);
    expect(() => addCleartextAttr('<manifest></manifest>')).toThrow(/no <application> tag/);
  });
});
