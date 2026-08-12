import { spawnSync } from 'node:child_process';

const zones = ['Asia/Manila', 'UTC', 'America/New_York', 'Pacific/Honolulu', 'Pacific/Kiritimati'];
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const testArgs = [
  'test',
  '--',
  'tests/time.test.ts',
  'tests/integration/dateKeys.test.ts',
  'tests/habitReminders.domain.test.ts',
];

for (const timezone of zones) {
  console.log(`\n[timezone] ${timezone}`);
  const isWindows = process.platform === 'win32';
  const result = spawnSync(
    isWindows ? (process.env.ComSpec ?? 'cmd.exe') : npmCommand,
    isWindows ? ['/d', '/s', '/c', [npmCommand, ...testArgs].join(' ')] : testArgs,
    { stdio: 'inherit', env: { ...process.env, TZ: timezone } },
  );
  if (result.error) {
    console.error(`[timezone] ${timezone} could not start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[timezone] ${timezone} failed with exit code ${result.status ?? 'unknown'}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nTimezone matrix passed: ${zones.join(', ')}`);
