import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createRequire } from 'node:module';

/**
 * Security guards for the pinned `node-forge` exposure
 * (change `resolve-windows-dependency-security`, tasks 4.1/4.2 in their
 * blocked-branch form; the goal's "dependency/cryptographic regression tests").
 *
 * WHAT THIS IS NOT: remediation. The known-vulnerable `node-forge@1.4.0`
 * (GHSA-86w9-cpqp-85rv) is still installed and the live audit must stay red
 * until a safe repair exists (see `openspec/changes/.../options-ledger.md`).
 * These guards execute the ACTUAL security behavior instead of script text:
 *
 *  1. A semantic dependency-resolution guard that pins the DOCUMENTED exposure
 *     accounting (copies, parents, versions) and demonstrably rejects drifted
 *     graphs, so a silent dedupe break, new parent, nested copy or version
 *     change forces a fresh security review instead of passing unnoticed.
 *
 *  2. A cryptographic tripwire that exercises the installed forge RSA
 *     PKCS#1 v1.5 verifier with vetted synthetic material (never real keys)
 *     and pins the exact GHSA-86w9-cpqp-85rv defect: a DigestInfo whose
 *     DigestAlgorithm SEQUENCE carries an extra nested element is ACCEPTED.
 *     When a fixed forge release lands and the documented resolution above is
 *     updated, this assertion flips and this test must be updated in the same
 *     change to require rejection — that flip is the regression signal.
 */

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const forge: any = require('node-forge');

// --- 1. semantic dependency-resolution guard ---------------------------------

type LockPackage = {
  version?: string;
  dev?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type ForgeParent = { path: string; range: string; dev: boolean };

type ForgeGraph = {
  copies: { path: string; version: string; dev: boolean }[];
  parents: ForgeParent[];
  installedVersion: string;
};

/**
 * The documented resolution as of 2026-10-02 (exposure-assessment.md §1):
 * ONE physical copy at node_modules/node-forge, version 1.4.0 — still
 * VULNERABLE on purpose; the audit gate stays red. This constant documents
 * KNOWN state, not safety. Updating the dependency must update this constant
 * in the same change (the drift tests below enforce that).
 *
 * Parents: the two Expo CLI tooling paths (production lineage) plus the root
 * devDependency `node-forge@^1.3.3` added 2026-10-02 solely so this guard can
 * execute the installed forge API (same range as the tooling parents, deduped
 * to the same physical copy; no effect on the production audit tree).
 */
const DOCUMENTED_RESOLUTION: ForgeGraph = {
  copies: [{ path: 'node_modules/node-forge', version: '1.4.0', dev: false }],
  parents: [
    { path: '(root)', range: '^1.3.3', dev: true },
    { path: 'node_modules/@expo/cli', range: '^1.3.3', dev: false },
    { path: 'node_modules/@expo/code-signing-certificates', range: '^1.3.3', dev: false },
  ],
  installedVersion: '1.4.0',
};

function extractForgeGraph(
  packages: Record<string, LockPackage>,
  installedVersion: string,
): ForgeGraph {
  const copies: ForgeGraph['copies'] = [];
  const parents: ForgeParent[] = [];
  for (const [path, meta] of Object.entries(packages)) {
    if (/(^|\/)node-forge$/.test(path)) {
      copies.push({ path: path || '(root)', version: meta.version ?? '', dev: !!meta.dev });
    }
    const declared: [Record<string, string>, boolean][] = [
      [meta.dependencies ?? {}, !!meta.dev],
      [meta.devDependencies ?? {}, true],
      [meta.optionalDependencies ?? {}, !!meta.dev],
    ];
    for (const [entries, dev] of declared) {
      if (entries['node-forge']) {
        parents.push({ path: path || '(root)', range: entries['node-forge'], dev });
      }
    }
  }
  return { copies, parents, installedVersion };
}

/** Pure validator: returns the list of drift problems (empty = documented). */
function assessForgeResolution(graph: ForgeGraph): string[] {
  const problems: string[] = [];
  const sameSet = <T>(a: T[], b: T[], key: (item: T) => string) => {
    const ka = a.map(key).sort();
    const kb = b.map(key).sort();
    return ka.length === kb.length && ka.every((value, index) => value === kb[index]);
  };
  if (
    !sameSet(graph.copies, DOCUMENTED_RESOLUTION.copies, (c) => `${c.path}@${c.version}#${c.dev}`)
  ) {
    problems.push(
      `node-forge copy set drifted: ${JSON.stringify(graph.copies)} != documented ${JSON.stringify(DOCUMENTED_RESOLUTION.copies)}`,
    );
  }
  if (
    !sameSet(graph.parents, DOCUMENTED_RESOLUTION.parents, (p) => `${p.path}@${p.range}#${p.dev}`)
  ) {
    problems.push(
      `node-forge parent set drifted: ${JSON.stringify(graph.parents)} != documented ${JSON.stringify(DOCUMENTED_RESOLUTION.parents)}`,
    );
  }
  if (graph.installedVersion !== DOCUMENTED_RESOLUTION.installedVersion) {
    problems.push(
      `installed node-forge version drifted: ${graph.installedVersion} != documented ${DOCUMENTED_RESOLUTION.installedVersion}`,
    );
  }
  return problems;
}

describe('node-forge dependency-resolution guard', () => {
  const lock = JSON.parse(readFileSync(resolve(__dirname, '..', 'package-lock.json'), 'utf8'));
  const installed = JSON.parse(
    readFileSync(resolve(__dirname, '..', 'node_modules', 'node-forge', 'package.json'), 'utf8'),
  );
  const liveGraph = extractForgeGraph(lock.packages, installed.version);

  it('matches the documented resolution of the live lockfile and install', () => {
    expect(assessForgeResolution(liveGraph)).toEqual([]);
  });

  it('rejects a reconstructed bad graph (non-vacuous on every axis)', () => {
    // Equivalent-bad-fixture demonstration required by the regression
    // requirement: each drift below must be rejected.
    const nestedCopy: ForgeGraph = {
      ...liveGraph,
      copies: [
        ...liveGraph.copies,
        { path: 'node_modules/@expo/cli/node_modules/node-forge', version: '1.4.0', dev: false },
      ],
    };
    expect(assessForgeResolution(nestedCopy).join('\n')).toContain('copy set drifted');

    const extraParent: ForgeGraph = {
      ...liveGraph,
      parents: [
        ...liveGraph.parents,
        { path: 'node_modules/rogue-parent', range: '^1.0.0', dev: true },
      ],
    };
    expect(assessForgeResolution(extraParent).join('\n')).toContain('parent set drifted');

    const versionDrift: ForgeGraph = {
      ...liveGraph,
      installedVersion: '1.3.100',
      copies: [{ path: 'node_modules/node-forge', version: '1.3.100', dev: false }],
    };
    expect(assessForgeResolution(versionDrift).join('\n')).toContain('drifted');

    const devRelocation: ForgeGraph = {
      ...liveGraph,
      copies: [{ path: 'node_modules/node-forge', version: '1.4.0', dev: true }],
    };
    expect(assessForgeResolution(devRelocation).join('\n')).toContain('copy set drifted');
  });
});

// --- 2. cryptographic tripwire: GHSA-86w9-cpqp-85rv exact defect -------------

describe('node-forge nested-DigestAlgorithm verification defect (GHSA-86w9-cpqp-85rv)', () => {
  const message = 'superhabits synthetic control message';
  const keyPair = forge.pki.rsa.generateKeyPair(2048);

  const digestBytes = () => {
    const md = forge.md.sha256.create();
    md.update(message);
    return md.digest().getBytes();
  };
  const signDigest = () => {
    const md = forge.md.sha256.create();
    md.update(message);
    return keyPair.privateKey.sign(md, 'RSASSA-PKCS1-V1_5');
  };
  const tryVerify = (digest: string, signature: string) => {
    try {
      return keyPair.publicKey.verify(digest, signature);
    } catch {
      return 'rejected';
    }
  };

  /** DigestInfo with an EXTRA nested element inside DigestAlgorithmIdentifier. */
  const nestedGarbageDigestInfoDer = (digest: string) => {
    const digestAlgorithm = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.OID,
          false,
          forge.asn1.oidToDer(forge.oids.sha256).getBytes(),
        ),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
        // The extra nested element a conformant verifier must reject.
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
      ],
    );
    const digestInfo = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [
        digestAlgorithm,
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, digest),
      ],
    );
    return forge.asn1.toDer(digestInfo).getBytes();
  };

  it('preserves legitimate RSA PKCS#1 v1.5 verification (synthetic control)', () => {
    expect(tryVerify(digestBytes(), signDigest())).toBe(true);
  });

  it('rejects a tampered signature (controls are not vacuous)', () => {
    const signature = signDigest();
    const tampered = signature.slice(0, -1) + String.fromCharCode(signature.charCodeAt(-1) ^ 0xff);
    expect(tryVerify(digestBytes(), tampered)).toBe('rejected');
  });

  it('fixture self-check: the crafted DigestInfo really has the extra nested element', () => {
    const der = nestedGarbageDigestInfoDer(digestBytes());
    const reparsed = forge.asn1.fromDer(forge.util.createBuffer(der));
    expect(reparsed.value).toHaveLength(2); // DigestInfo: { DigestAlgorithm, digest }
    expect(reparsed.value[0].value).toHaveLength(3); // OID + NULL + EXTRA
  });

  it('TRIPWIRE: installed node-forge 1.4.0 ACCEPTS the nested-DigestAlgorithm forgery shape', () => {
    // This assertion DOCUMENTS the advisory's presence at the documented
    // resolution (GHSA-86w9-cpqp-85rv: "RSA PKCS#1 v1.5 signature verification
    // accepts extra nested DigestAlgorithm elements"). A conformant verifier
    // must REJECT this input. When a fixed node-forge release replaces the
    // documented resolution, this test flips red on purpose — update it in the
    // same change to require `rejected`, alongside the resolution guard.
    const signature = keyPair.privateKey.sign(nestedGarbageDigestInfoDer(digestBytes()), 'NONE');
    expect(tryVerify(digestBytes(), signature)).toBe(true);
  });

  it('the digest content is still compared (acceptance is specific, not blanket)', () => {
    const signature = keyPair.privateKey.sign(nestedGarbageDigestInfoDer(digestBytes()), 'NONE');
    expect(tryVerify('other digest bytes................', signature)).toBe(false);
  });
});
