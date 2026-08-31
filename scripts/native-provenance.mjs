// @ts-nocheck
/** Git provenance helpers for certification artifacts and native QA. */
import { execFileSync } from 'node:child_process';

/**
 * @param {string} root
 * @param {string[]} args
 */
function gitOutput(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Read the commit and porcelain status for a repository.
 *
 * `git status --porcelain` intentionally omits ignored files, so generated
 * reports/build output remain outside the certification cleanliness decision.
 * `--untracked-files=all` prevents a relevant untracked source nested in a
 * directory from being hidden behind a directory-level `??` entry.
 */
export function readGitProvenance(root) {
  /** @type {string | null} */
  let sourceSha = null;
  /** @type {string | null} */
  let sourceShaError = null;
  /** @type {string[]} */
  let sourceTreeStatus = [];
  /** @type {string | null} */
  let sourceTreeStatusError = null;

  try {
    sourceSha = gitOutput(root, ['rev-parse', 'HEAD']) || null;
  } catch (error) {
    sourceShaError = errorMessage(error);
  }

  try {
    const status = gitOutput(root, ['status', '--porcelain=v1', '--untracked-files=all']);
    sourceTreeStatus = status ? status.split(/\r?\n/).filter(Boolean) : [];
  } catch (error) {
    sourceTreeStatusError = errorMessage(error);
  }

  return {
    sourceSha,
    sourceTreeClean:
      sourceSha !== null &&
      sourceShaError === null &&
      sourceTreeStatusError === null &&
      sourceTreeStatus.length === 0,
    sourceTreeStatus,
    sourceShaError,
    sourceTreeStatusError,
  };
}

/**
 * Require a verifiable clean checkout before a certification build.
 *
 * @param {string} root
 */
export function requireCleanGitTree(root) {
  const provenance = readGitProvenance(root);
  if (provenance.sourceShaError || provenance.sourceSha === null) {
    throw new Error(
      `Refusing certification build because Git HEAD could not be determined: ${provenance.sourceShaError ?? 'unknown Git error'}.`,
    );
  }
  if (provenance.sourceTreeStatusError) {
    throw new Error(
      `Refusing certification build because Git working-tree status could not be verified: ${provenance.sourceTreeStatusError}.`,
    );
  }
  if (!provenance.sourceTreeClean) {
    const changes = provenance.sourceTreeStatus.join('\n');
    throw new Error(
      `Refusing certification build because the Git working tree is dirty. Commit, stash, or reconcile tracked and relevant untracked changes before building.\nGit status --porcelain:\n${changes}`,
    );
  }
  return provenance;
}
