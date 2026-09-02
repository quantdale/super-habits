#!/usr/bin/env node
/**
 * Web server hygiene gate for campaign completion (read-only by default).
 *
 * Reports whether the standard web ports (8081, 8082) are free, and when a
 * port is occupied it identifies the owning PID and command line so the
 * agent can judge provenance. It NEVER kills anything without an explicit
 * `--kill <pid>`, and `--kill` terminates only the exact process tree of the
 * PID given (never `taskkill /IM node.exe` or `killall node`).
 *
 * Usage:
 *   node scripts/web-hygiene.mjs                 # check 8081 and 8082
 *   node scripts/web-hygiene.mjs 8081 8083       # custom ports
 *   node scripts/web-hygiene.mjs --kill <pid>    # terminate an exact owned tree
 *   node scripts/web-hygiene.mjs --json          # machine-readable output
 *
 * Exit codes: 0 = all checked ports free (or all freed after --kill),
 *             1 = at least one checked port is occupied / kill failed.
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { isPortAvailable } from './web-lifecycle.mjs';

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8' });
}

function parseArgs(argv) {
  const args = { ports: [], kill: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--kill') args.kill = Number(argv[++i]);
    else if (a === '--json') args.json = true;
    else if (/^\d+$/.test(a)) args.ports.push(Number(a));
    else throw new Error(`unknown argument ${JSON.stringify(a)}`);
  }
  if (args.ports.length === 0) args.ports = [8081, 8082];
  if (args.kill !== null && (!Number.isInteger(args.kill) || args.kill <= 0)) {
    throw new Error(`--kill requires a positive integer PID, got ${args.kill}`);
  }
  return args;
}

/** Owner PIDs listening on `port`, or [] when none. */
function ownerPidsForPort(port) {
  if (process.platform === 'win32') {
    const result = run('netstat', ['-ano', '-p', 'tcp']);
    const pids = new Set();
    for (const line of (result.stdout ?? '').split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !line.includes('LISTENING')) continue;
      const tokens = line.trim().split(/\s+/);
      const pid = Number(tokens[tokens.length - 1]);
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  }
  const result = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
  return (result.stdout ?? '')
    .trim()
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function commandLineForPid(pid) {
  if (process.platform === 'win32') {
    const result = run('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'CommandLine']);
    const line = (result.stdout ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !/^CommandLine$/i.test(l));
    return line ?? '(unknown)';
  }
  const result = run('ps', ['-o', 'command=', '-p', String(pid)]);
  return (result.stdout ?? '').trim() || '(unknown)';
}

function terminateExactTree(pid) {
  if (process.platform === 'win32') {
    const result = run('taskkill', ['/PID', String(pid), '/T', '/F']);
    return { ok: result.status === 0, detail: (result.stderr ?? result.stdout ?? '').trim() };
  }
  // POSIX: collect descendants from ps and kill children first, then root.
  const ps = run('ps', ['-o', 'pid=', '-o', 'ppid=']);
  const childrenByParent = new Map();
  for (const line of (ps.stdout ?? '').split(/\r?\n/)) {
    const [child, parent] = line.trim().split(/\s+/).map(Number);
    if (!Number.isInteger(child) || !Number.isInteger(parent)) continue;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(child);
  }
  const tree = [];
  const queue = [pid];
  while (queue.length > 0) {
    const current = queue.shift();
    tree.push(current);
    for (const childPid of childrenByParent.get(current) ?? []) queue.push(childPid);
  }
  let killed = 0;
  let failed = null;
  for (const current of tree.reverse()) {
    try {
      process.kill(current, 'SIGKILL');
      killed += 1;
    } catch (error) {
      if (error && error.code !== 'ESRCH') failed = String(error);
    }
  }
  return {
    ok: killed > 0 || tree.length === 0,
    detail: failed ?? `terminated ${killed} owned process(es) (PID ${pid} + descendants)`,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = [];
  if (args.kill !== null) {
    const result = terminateExactTree(args.kill);
    report.push({ action: 'kill', pid: args.kill, ok: result.ok, detail: result.detail });
    if (!result.ok) throw new Error(`failed to terminate PID ${args.kill}: ${result.detail}`);
  }
  let allFree = true;
  for (const port of args.ports) {
    if (await isPortAvailable(port)) {
      report.push({ port, status: 'FREE' });
    } else {
      allFree = false;
      const pids = ownerPidsForPort(port);
      const owners = pids.map((pid) => ({ pid, cmd: commandLineForPid(pid) }));
      report.push({ port, status: 'OCCUPIED', owners });
    }
  }
  if (args.json) {
    console.log(JSON.stringify({ allFree, report }, null, 2));
  } else {
    for (const entry of report) {
      if (entry.action === 'kill') {
        console.log(`${entry.ok ? 'KILLED' : 'FAILED'} ${entry.pid} — ${entry.detail}`);
      } else if (entry.status === 'FREE') {
        console.log(`PORT ${entry.port} FREE`);
      } else {
        console.log(`PORT ${entry.port} OCCUPIED`);
        for (const owner of entry.owners) {
          console.log(`  pid=${owner.pid} cmd=${owner.cmd}`);
        }
      }
    }
    console.log(
      allFree
        ? 'Hygiene result: PASS — checked ports are free.'
        : 'Hygiene result: FAIL — see above.',
    );
  }
  return allFree ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`web-hygiene: ${error && error.message ? error.message : String(error)}`);
    process.exitCode = 1;
  });
