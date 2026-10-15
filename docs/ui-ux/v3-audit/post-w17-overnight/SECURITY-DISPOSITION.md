# SECURITY-DISPOSITION — PR #79 final convergence (2026-10-15)

Scope: the two undocumented HIGH advisories that keep `scripts/audit-runtime-deps.mjs`
(and therefore the CI `quality` job) red at PR #79 head `b1b4ee2`:

| Advisory              | Package      | Installed | Registry latest (re-checked 2026-10-15) | Advisory range / patch                    |
| --------------------- | ------------ | --------- | --------------------------------------- | ----------------------------------------- |
| `GHSA-vfj7-8cjw-p6xm` | `braces`     | 3.0.3     | 3.0.3                                   | `<= 3.0.3`, `first_patched_version: null` |
| `GHSA-86w9-cpqp-85rv` | `node-forge` | 1.4.0     | 1.4.0                                   | `<= 1.4.0`, `first_patched_version: null` |

**Verdict: SECURITY_UNREMEDIATED.** No published fix exists for either package, and
neither package can leave the production dependency tree by a safe change. The audit
gate is therefore **correctly red** and is retained as the hard release blocker. This
campaign changed no audit policy, added no allowlist entry, and skipped no scan.

All registry/advisory facts below were re-queried on 2026-10-15 from this host
(`npm view`, GitHub advisory API, live `npm ls`/`npm explain`, and a real
`npm install` experiment in a throwaway worktree). Raw captures from the earlier
campaigns remain in `simulation-output/security-*` (gitignored) and in
`openspec/changes/resolve-windows-dependency-security/{options-ledger,exposure-assessment}.md`.

## 1. `braces` GHSA-vfj7-8cjw-p6xm — stack-exhaustion DoS

**Production paths (computed from the live lockfile, 24126 edge walk, 2026-10-15):**

```
root -> tailwindcss (dependencies) -> chokidar -> braces
root -> tailwindcss -> micromatch -> braces
root -> tailwindcss -> fast-glob -> micromatch -> braces
root -> nativewind (peer tailwindcss) -> chokidar/micromatch -> braces   (keeps tailwindcss prod even from devDeps)
root -> react-native-css-interop (peer tailwindcss) -> ... -> braces
root -> expo -> @expo/metro -> metro-file-map -> micromatch -> braces   (framework-internal; tailwindcss-independent)
```

The last path is decisive: even with `tailwindcss` gone, `braces` stays in the
production tree through the framework's own Metro file-map matcher.

**Options tested, in risk order (all executed or verified today):**

1. **Patched upstream version** — none exists. `npm view braces versions` ends at
   3.0.3 (published 2024-05-21); the GitHub advisory records no patched version and
   an individual vulnerable range of `<= 3.0.3`. (npm's grouped report shows `range: *`
   for the metavuln; the advisory's own range is authoritative here.)
2. **Update a consumer to drop braces** — `chokidar`/`micromatch` are pinned at
   `braces ^3.0.x`/`~3.0.2`; `metro-file-map@0.83.8` requires `micromatch ^4.0.4`,
   whose only `braces` range is the vulnerable one. No consumer version removes it.
3. **Remove/reclassify `tailwindcss`** — EXECUTED EXPERIMENT, DISPROVEN:
   in throwaway worktree `superhabits-sec-exp` (now removed) at PR head, moving
   `tailwindcss` from `dependencies` to `devDependencies` and regenerating the
   lockfile (npm 10.9.2, the CI-pinned major) and performing a full `npm install`
   left `node_modules/tailwindcss` **without** a `dev` marker: `nativewind`
   (production) and `react-native-css-interop` (production) both declare
   `tailwindcss` as a **non-optional peerDependency**, so npm keeps it (and the
   `braces` chain) in the production tree. The audit still reported
   `[UNDOCUMENTED] high braces GHSA-vfj7-8cjw-p6xm [node_modules/braces]`,
   exit 1 — identical to baseline. Reverted; no source change was kept.
4. **Fork/patch braces** — no maintained fork exists; a local patch cannot change the
   locked version npm audit evaluates; rejected per campaign policy.
5. **Audit classification bug** — none. The classification is correct under npm's
   documented peer/dev-marking semantics (option 3 proved the graph, not a gate bug).
6. **Policy relaxation** — not authorized by the campaign; nothing changed.

## 2. `node-forge` GHSA-86w9-cpqp-85rv — RSA PKCS#1 v1.5 verification forgery

**Production paths (live lockfile, 2026-10-15):**

```
root -> expo (dependencies) -> @expo/cli -> node-forge               (direct CLI dep, ^1.3.3)
root -> expo -> @expo/cli -> @expo/code-signing-certificates -> node-forge
```

(The root devDependency `node-forge@^1.3.3` exists solely so
`tests/nodeForgeSecurityGuards.test.ts` can execute the installed cryptographic
tripwire; it dedupes to the same copy and does not affect the production tree.)

**Options tested, in risk order (all verified 2026-10-15):**

1. **Patched upstream version** — none exists. Registry ends at 1.4.0
   (`time.modified 2026-03-24`); advisory range `<= 1.4.0`, no patched version.
   The upstream fix PR `digitalbazaar/forge#1152` remains a PR, not a release.
2. **Update the parent to drop it** — every published `@expo/cli` release requires
   `node-forge@^1.3.3` **and** `@expo/code-signing-certificates@^0.0.6`:
   verified today across 55.0.30–55.0.36 (installed family), 56.x, 57.0.x and
   58.0.x. `@expo/code-signing-certificates@0.0.7` still requires the vulnerable
   range. No viable target exists at any Expo major.
3. **Framework migration** — an SDK 56/57/58 migration is a major migration the
   campaign forbids proposing for appearances — and it would not fix the finding
   (option 2).
4. **Remove/substitute the chain** — the code-signing chain is exercised tooling
   (dev-certificate validation, CSR issuance, signing-identity parsing); replacing
   a mature PKI library with an unvetted substitute is forbidden for cryptography
   without expert validation.
5. **Override/stub** — explicitly rejected: overriding `node-forge` to a nonexistent
   version, an unvetted fork, or an empty stub would either not clear the advisory
   (audit evaluates the locked version) or break `@expo/cli`. A fake green is a
   policy violation.

**Executing regression guards (already in the repo, re-verified green at this head):**

- `tests/nodeForgeSecurityGuards.test.ts` — dependency-resolution drift guard plus
  the cryptographic tripwire that _proves_ installed forge 1.4.0 accepts the
  nested-DigestAlgorithm forgery shape (legit verify ✓, tampered reject ✓,
  forgery accepted ✓ — the tripwire flips red the day a fixed forge installs).
- `tests/auditRuntimeDeps.test.ts` — 80 unit tests pinning the fail-closed audit
  boundary (no false greens from transport/report defects).

## 3. Exposure evidence (context, NOT a gate substitute)

Both packages are build-time-only in the shipped artifacts: nothing in `app/`,
`features/`, `core/`, or `lib/` imports `tailwindcss`, `braces`, `chokidar`,
`micromatch`, or `node-forge` (verified by source scan), and the hermetic web export
(`dist/`) contains no reference to them. `node-forge`'s vulnerable API
(`publicKey.verify`) is reached only inside `@expo/cli` tooling paths
(`certificate.verify`, CSR checks), not by the app bundle. This explains _risk_, but
per the campaign the hard gate is the production dependency tree, and it stays red.

## 4. The three allowlisted `brace-expansion` entries (unchanged)

The dated 2026-09-29 allowlist (three `brace-expansion` advisories behind
`test-exclude`/`glob@9` tooling) is untouched: same three advisory ids, same node
paths, same reason; any new path for a known advisory still fails the gate. As a
secondary objective the `glob@9`/`test-exclude` chain was re-checked: it remains
unfixable without the breaking `react-native@0.87.1` resolution npm offers, and the
5.x copy stays fixed by the existing `brace-expansion@^5.0.0 -> ^5.0.12` override.

## 5. Exact upstream events that would re-open this lane

For `braces`: a published `braces` release outside `<= 3.0.3` whose range satisfies
`chokidar ~3.0.2`, `micromatch ^3.0.3`/`^4.0.x` and `metro-file-map`'s transitive
requirement — or an Expo SDK release whose Metro file-map no longer reaches
`micromatch@4` (removing the framework-internal path).

For `node-forge`: a published, independently verified `node-forge >= 1.4.1`
satisfying both `@expo/cli`'s and `@expo/code-signing-certificates`' `^1.3.3`
ranges (PR merge alone is insufficient), or a supported Expo CLI release that
removes **both** vulnerable paths.

Resume sequence (unchanged from `resolve-windows-dependency-security`):
`git fetch` → re-query advisory API + registry + parent manifests → repeat the
graph/exposure checks → pursue only an evidenced safe candidate → re-run
`node scripts/audit-runtime-deps.mjs` and the guard suites.
