/**
 * Attempt actual Android notification delivery for the test-build-only
 * near-term Habit reminder hook. The Maestro flow schedules through the real
 * Expo notification API, backgrounds and terminates the app, then this script
 * observes Android's notification manager instead of claiming delivery from
 * the app UI.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPORT_DIR = resolve(ROOT, 'simulation-output', 'native');
const APP_ID = 'com.dale16.superhabits';
const TITLE = 'Native delivery habit';
const BODY = 'Time to complete your habit.';
const POLL_MS = 1000;
const TIMEOUT_MS = 45_000;

function run(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function report(status, classification, details) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const path = resolve(
    REPORT_DIR,
    `habit-reminder-delivery-${new Date().toISOString().replaceAll(':', '').replaceAll('.', '')}.json`,
  );
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        status,
        classification,
        appId: APP_ID,
        title: TITLE,
        body: BODY,
        flow: '.maestro/flows/habit-reminder-delivery.yaml',
        ...details,
        capturedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`Habit reminder delivery report: ${path}`);
}

const maestro = run(process.execPath, [
  resolve(ROOT, 'scripts/qa-native.mjs'),
  '--platform',
  'android',
  '--flow',
  '.maestro/flows/habit-reminder-delivery.yaml',
]);
process.stdout.write(maestro.stdout ?? '');
process.stderr.write(maestro.stderr ?? '');
if (maestro.status !== 0) {
  report('NOT_RUN', maestro.status === null ? 'ENVIRONMENT' : 'TEST_BUG', {
    reason: 'The delivery Maestro flow did not complete.',
    exitCode: maestro.status,
  });
  process.exit(maestro.status ?? 2);
}

const deadline = Date.now() + TIMEOUT_MS;
let lastDump = '';
while (Date.now() < deadline) {
  const result = run('adb', ['shell', 'dumpsys', 'notification', '--noredact']);
  lastDump = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (
    result.status === 0 &&
    lastDump.includes(APP_ID) &&
    lastDump.includes(TITLE) &&
    lastDump.includes(BODY)
  ) {
    report('VERIFIED', null, {
      observation:
        'Android notification manager contained the app package, title, and body after app process termination.',
    });
    process.exit(0);
  }
  await new Promise((resolveTimer) => setTimeout(resolveTimer, POLL_MS));
}

report('NOT_VERIFIED', 'EXPECTED_KNOWN_GAP', {
  reason:
    'Android notification manager did not expose the expected posted notification within the 45-second test window.',
  observation: 'The real scheduling flow completed, but tray delivery was not proven.',
  lastDumpTail: lastDump.slice(-4000),
});
process.exit(1);
