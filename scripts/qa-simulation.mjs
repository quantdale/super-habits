import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = process.argv.slice(2);
const port = process.env.E2E_PORT ?? '8081';
const baseUrl = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const endpoint = new URL(baseUrl);
if (
  endpoint.protocol !== 'http:' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname) ||
  Number(endpoint.port || 80) !== Number(port)
) {
  throw new Error('qa:simulation must target its owned local HTTP server on E2E_PORT.');
}
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
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
    // npm.cmd needs a shell; a node executable (including one in Program Files)
    // must receive its executable path and arguments separately.
    shell: process.platform === 'win32' && command !== process.execPath,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`QA child failed (${result.status ?? result.signal}): ${command}`);
  }
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
  run(npmCommand, ['run', 'build:e2e:sim']);
  const server = spawn(
    process.execPath,
    ['scripts/serve-e2e.js', '--port', port, '--dist', 'dist-sim'],
    {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, E2E_DIST_DIR: 'dist-sim' },
      windowsHide: true,
    },
  );
  try {
    // An HTTP response alone could belong to a foreign server on the same port.
    // Wait for this exact child to finish its hermetic scan and bind first.
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Owned simulation server did not bind')),
        30_000,
      );
      let output = '';
      const fail = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
      server.once('error', fail);
      server.once('exit', (code) =>
        fail(new Error(`Owned simulation server exited before readiness (${code})`)),
      );
      server.stdout.on('data', (data) => {
        process.stdout.write(data);
        output += data.toString();
        if (output.includes('E2E static server:')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    await waitForServer(baseUrl);
    run(npmCommand, ['run', 'sim:validate']);
    run(process.execPath, [
      'simulation/.build/simulation/runner/cli.js',
      'run',
      ...runnerArgs,
      '--base-url',
      baseUrl,
    ]);
  } finally {
    await new Promise((resolve, reject) => {
      if (server.exitCode !== null || server.signalCode !== null) return resolve();
      const timeout = setTimeout(
        () => reject(new Error('Owned simulation server did not stop')),
        5000,
      );
      server.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
      server.kill();
    });
  }
}

main().catch((error) => {
  console.error(`QA simulation gate failed: ${error.message}`);
  process.exitCode = 1;
});
