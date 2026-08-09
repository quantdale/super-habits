import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = process.argv.slice(2);
const port = process.env.E2E_PORT ?? '8081';
const baseUrl = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const modeIndex = args.indexOf('--mode');
const scenarioIndex = args.indexOf('--scenario');
const allScenarios = args.includes('--all');
const mode = modeIndex >= 0 ? args[modeIndex + 1] : 'deterministic';
const scenario = scenarioIndex >= 0 ? args[scenarioIndex + 1] : allScenarios ? null : '@p0';
const runnerArgs = [
  '--mode',
  mode,
  ...(scenario ? ['--scenario', scenario] : []),
  ...args.filter((arg, index) => {
    if (modeIndex >= 0 && (index === modeIndex || index === modeIndex + 1)) return false;
    if (scenarioIndex >= 0 && (index === scenarioIndex || index === scenarioIndex + 1))
      return false;
    if (arg === '--all') return false;
    return true;
  }),
];

function run(command, commandArgs) {
  const isWindows = process.platform === 'win32';
  const result = spawnSync(
    isWindows ? (process.env.ComSpec ?? 'cmd.exe') : command,
    isWindows ? ['/d', '/s', '/c', [command, ...commandArgs].join(' ')] : commandArgs,
    { stdio: 'inherit', env: process.env },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if ((response.statusCode ?? 500) < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.on('error', retry);
      request.setTimeout(1_000, () => {
        request.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(probe, 250);
    };
    probe();
  });
}

async function main() {
  run(npmCommand, ['run', 'build:web']);
  const server = spawn(process.execPath, ['scripts/serve-e2e.js', '--port', port], {
    stdio: 'inherit',
    env: process.env,
  });
  try {
    await waitForServer(baseUrl);
    run(npmCommand, ['run', 'sim:validate']);
    run(npmCommand, ['run', 'sim:run', '--', ...runnerArgs, '--base-url', baseUrl]);
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(`QA simulation gate failed: ${error.message}`);
  process.exit(1);
});
